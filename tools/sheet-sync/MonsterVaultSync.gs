// ═══════════════════════════════════════════════════════
//  MONSTER VAULT — Google Sheets ↔ Backend Sync
//  (Google Apps Script, bound to the "Monster Vault Sync" sheet)
//
//  Talks to the Spring backend REST API (NOT to the database directly).
//  Since the Firestore→MongoDB migration the old service-account/Firestore
//  path is gone: the sheet now logs in as admin and uses the public/JWT API.
//
//  SETUP (one-time) — Project → Settings → Script properties:
//      MV_USERNAME  =  <admin username>
//      MV_PASSWORD  =  <admin password>
//      BACKEND_URL  =  https://monster-vault-server.onrender.com   (optional, this is the default)
//    See README.md in this folder.
// ═══════════════════════════════════════════════════════

var SHEET_NAME = 'Monster Vault Sync';
var BACKEND_DEFAULT = 'https://monster-vault-server.onrender.com';

var COLUMNS = [
  'MV_ID', 'NOME', 'SKU', 'PRODUTTORE', 'SIZE',
  'LINGUA', 'TOP/TAB', 'PROMO', 'VALORE (STIMA)',
  'OPENING', 'CONDITIONS', 'MORE INFO'
];

// Text fields the push manages. Photos (p1..p4, p1Id..p4Id) and server-managed
// fields (updatedAt, deletedAt, photoAt) are preserved by merging onto the
// existing can — they are NEVER overwritten by a push.
var TEXT_FIELDS = ['id','nome','sku','produttore','size','lingua','top','promo','valore','note','stato','descrizione'];

// ── CONFIG (from Script Properties — no secret in source) ──
function backendUrl_() {
  var u = PropertiesService.getScriptProperties().getProperty('BACKEND_URL') || BACKEND_DEFAULT;
  return u.replace(/\/+$/, '');
}
function creds_() {
  var p = PropertiesService.getScriptProperties();
  var u = p.getProperty('MV_USERNAME'), pw = p.getProperty('MV_PASSWORD');
  if (!u || !pw) {
    throw new Error(
      'Mancano MV_USERNAME / MV_PASSWORD nelle Script Properties.\n' +
      'Project → Settings → Script properties. Vedi README.'
    );
  }
  return { username: u, password: pw };
}

// ── MENU ────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥤 Monster Vault')
    .addItem('⬇️  Scarica dal backend → Sheet (completo)', 'pullFromBackend')
    .addItem('⚡  Scarica solo novità (incrementale)',       'pullIncremental')
    .addItem('⬆️  Carica Sheet → backend',                   'pushToBackend')
    .addSeparator()
    .addItem('🔄  Reset sync incrementale',                  'resetIncrementalSync')
    .addToUi();
}

// ── BACKEND API ─────────────────────────────────────────

// POST /api/auth/login → accessToken (JWT). Cached per execution.
var _TOKEN = null;
function getAccessToken() {
  if (_TOKEN) return _TOKEN;
  var resp = UrlFetchApp.fetch(backendUrl_() + '/api/auth/login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(creds_()),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Login fallito (' + resp.getResponseCode() + '): ' + resp.getContentText());
  var token = JSON.parse(resp.getContentText()).accessToken;
  if (!token) throw new Error('Login: nessun accessToken nella risposta.');
  _TOKEN = token;
  return token;
}

// GET /api/cans — lattine attive (le soft-deleted sono già escluse dal backend).
// Endpoint pubblico: nessun token necessario per il pull.
function fetchCans() {
  var resp = UrlFetchApp.fetch(backendUrl_() + '/api/cans', { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200)
    throw new Error('GET /api/cans (' + resp.getResponseCode() + '): ' + resp.getContentText());
  return JSON.parse(resp.getContentText()) || [];
}

// POST /api/cans/batch — upsert per id. Gli oggetti vanno inviati COMPLETI (foto incluse):
// il backend sovrascrive l'intero documento, quindi un push parziale cancellerebbe le foto.
function batchSave(token, cans) {
  if (!cans.length) return;
  var resp = UrlFetchApp.fetch(backendUrl_() + '/api/cans/batch', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(cans),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400)
    throw new Error('POST /api/cans/batch (' + resp.getResponseCode() + '): ' + resp.getContentText());
}

// ── PULL (full): backend → Sheet ────────────────────────
function pullFromBackend() {
  var ui = SpreadsheetApp.getUi();
  try {
    var cans = fetchCans();
    if (!cans.length) { ui.alert('Nessuna lattina trovata sul backend.'); return; }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    styleHeader(sheet);

    var rows = cans.map(canToRow);
    if (rows.length) sheet.getRange(2, 1, rows.length, COLUMNS.length).setValues(rows);

    sheet.autoResizeColumns(1, COLUMNS.length);
    sheet.setFrozenRows(1);

    PropertiesService.getScriptProperties().setProperty('lastSyncTimestamp', String(Date.now()));
    ui.alert('✅ Scaricate ' + rows.length + ' lattine (escluse quelle nel cestino).');
  } catch(e) {
    ui.alert('❌ Errore: ' + e.message);
  }
}

// ── PULL (incremental): only changes since last sync ────
function pullIncremental() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var lastSync = parseInt(props.getProperty('lastSyncTimestamp') || '0');

  if (lastSync === 0) {
    ui.alert('Prima run: eseguo il pull completo.');
    pullFromBackend();
    return;
  }

  try {
    var cans  = fetchCans();
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Foglio "' + SHEET_NAME + '" non trovato. Fai prima il pull completo.');

    var data   = sheet.getDataRange().getValues();
    var rowMap = {};
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || '').trim();
      if (rowId) rowMap[rowId] = i + 1; // 1-based sheet row
    }

    var activeIds = {};
    var added = 0, updated = 0, trashed = 0;
    cans.forEach(function(can) {
      activeIds[can.id] = true;
      var updatedAt = Number(can.updatedAt || 0);
      if (updatedAt <= lastSync && rowMap[can.id]) return; // unchanged, già presente
      var row = canToRow(can);
      if (rowMap[can.id]) {
        sheet.getRange(rowMap[can.id], 1, 1, COLUMNS.length).setValues([row]);
        updated++;
      } else {
        sheet.appendRow(row);
        added++;
      }
    });

    // Righe la cui can non è più attiva (cestino o cancellata) → rimuovi, dal basso verso l'alto.
    var toDelete = [];
    Object.keys(rowMap).forEach(function(id) { if (!activeIds[id]) toDelete.push(rowMap[id]); });
    toDelete.sort(function(a, b) { return b - a; }).forEach(function(r) { sheet.deleteRow(r); trashed++; });

    if (!added && !updated && !trashed) { ui.alert('Già aggiornato — nessuna novità.'); return; }
    props.setProperty('lastSyncTimestamp', String(Date.now()));
    ui.alert('✅ +' + added + ' nuove, ' + updated + ' aggiornate, ' + trashed + ' rimosse (cestino).');
  } catch(e) {
    ui.alert('❌ Errore: ' + e.message);
  }
}

// ── PUSH: Sheet → backend ───────────────────────────────
function pushToBackend() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Caricare sul backend?', 'Vengono aggiornati solo i campi testuali. Foto e cestino non vengono toccati.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  try {
    var token = getAccessToken();
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Foglio "' + SHEET_NAME + '" non trovato.');

    // Mappa delle can esistenti: per fare merge e PRESERVARE foto + campi server.
    var existing = {};
    fetchCans().forEach(function(c) { existing[c.id] = c; });

    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows    = data.slice(1);
    var toSave = [], added = 0, updated = 0, skipped = 0;

    rows.forEach(function(row, ri) {
      if (!row.some(function(c) { return c !== ''; })) return; // riga vuota
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = String(row[i] || '').trim(); });
      if (!obj['NOME'] && !obj['SKU']) { skipped++; return; }

      var mvId = obj['MV_ID'] || ('can_' + canHash(obj));

      // Parti dalla can esistente (foto, p*Id, deletedAt, photoAt restano intatti),
      // sovrascrivi solo i campi testuali. Se è nuova, oggetto fresco.
      var can = existing[mvId] || {};
      can.id          = mvId;
      can.nome        = obj['NOME'] || '';
      can.sku         = obj['SKU'] || '';
      can.produttore  = obj['PRODUTTORE'] || '';
      can.size        = obj['SIZE'] || '';
      can.lingua      = obj['LINGUA'] || '';
      can.top         = obj['TOP/TAB'] || '';
      can.promo       = obj['PROMO'] || '';
      can.valore      = obj['VALORE (STIMA)'] || '';
      can.note        = obj['OPENING'] || '';
      can.stato       = obj['CONDITIONS'] || 'OK';
      can.descrizione = obj['MORE INFO'] || '';
      toSave.push(can);

      if (obj['MV_ID']) {
        updated++;
      } else {
        added++;
        var mvIdCol = headers.indexOf('MV_ID');
        if (mvIdCol >= 0) sheet.getRange(ri + 2, mvIdCol + 1).setValue(mvId);
      }
    });

    batchSave(token, toSave);
    ui.alert('✅ Sync completato!\n\n• Aggiornate: ' + updated + '\n• Nuove: ' + added + '\n• Saltate: ' + skipped);
  } catch(e) {
    ui.alert('❌ Errore: ' + e.message);
  }
}

// ── RESET INCREMENTAL SYNC ──────────────────────────────
function resetIncrementalSync() {
  PropertiesService.getScriptProperties().deleteProperty('lastSyncTimestamp');
  SpreadsheetApp.getUi().alert('Reset fatto. La prossima "Scarica solo novità" riscaricherà tutto.');
}

// ── UTILS ───────────────────────────────────────────────

// can (JSON dal backend) → riga del foglio nell'ordine di COLUMNS.
function canToRow(can) {
  return COLUMNS.map(function(col) {
    var v = can[colToField(col)];
    return v === undefined || v === null ? '' : String(v);
  });
}

function colToField(col) {
  var map = {
    'MV_ID':'id','NOME':'nome','SKU':'sku','PRODUTTORE':'produttore',
    'SIZE':'size','LINGUA':'lingua','TOP/TAB':'top','PROMO':'promo',
    'VALORE (STIMA)':'valore','OPENING':'note','CONDITIONS':'stato','MORE INFO':'descrizione'
  };
  return map[col] || col.toLowerCase();
}

// New-can ID — MUST match the frontend (tools.ts): same fields, same order,
// same hash. Otherwise a can added from the sheet gets a different id than the
// same can added in the app → duplicate. Fields: nome|sku|produttore|lingua|size|top|promo.
function canHash(obj) {
  var key = [
    obj['NOME']||'', obj['SKU']||'', obj['PRODUTTORE']||'',
    obj['LINGUA']||'', obj['SIZE']||'', obj['TOP/TAB']||'', obj['PROMO']||''
  ].join('||').toLowerCase().trim();
  return simpleHash(key);
}

function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function styleHeader(sheet) {
  var r = sheet.getRange(1, 1, 1, COLUMNS.length);
  r.setBackground('#a8ff00');
  r.setFontColor('#000000');
  r.setFontWeight('bold');
  r.setFontSize(11);
}
