// ═══════════════════════════════════════════════════════
//  MONSTER VAULT — Google Sheets ↔ Firestore Sync
//  (Google Apps Script, bound to the "Monster Vault Sync" sheet)
//
//  Talks DIRECTLY to Firestore (REST API) with a service account —
//  it does NOT go through the Spring backend.
//
//  SETUP (one-time):
//    The service-account JSON is NOT stored in this file (this repo is public).
//    Project → Settings → Script properties → add:
//        SERVICE_ACCOUNT_JSON  =  <the full service-account JSON, one line>
//    See README.md in this folder.
// ═══════════════════════════════════════════════════════

var SHEET_NAME = 'Monster Vault Sync';
var COLLECTION = 'cans';

var COLUMNS = [
  'MV_ID', 'NOME', 'SKU', 'PRODUTTORE', 'SIZE',
  'LINGUA', 'TOP/TAB', 'PROMO', 'VALORE (STIMA)',
  'OPENING', 'CONDITIONS', 'MORE INFO'
];

// Text fields push/pull manage. Photos (p1..p4, p1Id..p4Id) and server-managed
// fields (updatedAt, deletedAt, photoAt, watch) are NEVER written by the push.
var TEXT_FIELDS = ['id','nome','sku','produttore','size','lingua','top','promo','valore','note','stato','descrizione'];

// ── CREDENTIALS (from Script Properties — no secret in source) ──
var _SA = null;
function sa_() {
  if (_SA) return _SA;
  var raw = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_JSON');
  if (!raw) {
    throw new Error(
      'Manca SERVICE_ACCOUNT_JSON nelle Script Properties.\n' +
      'Project → Settings → Script properties → SERVICE_ACCOUNT_JSON = <JSON service account>. Vedi README.'
    );
  }
  _SA = JSON.parse(raw);
  return _SA;
}
function projectId_() { return sa_().project_id; }

// ── MENU ────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥤 Monster Vault')
    .addItem('⬇️  Scarica da Firestore → Sheet (completo)', 'pullFromFirestore')
    .addItem('⚡  Scarica solo novità (incrementale)',       'pullIncremental')
    .addItem('⬆️  Carica Sheet → Firestore',                 'pushToFirestore')
    .addSeparator()
    .addItem('🔄  Reset sync incrementale',                  'resetIncrementalSync')
    .addToUi();
}

// ── AUTH ────────────────────────────────────────────────
function getAccessToken() {
  var sa    = sa_();
  var now   = Math.floor(Date.now() / 1000);
  var claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now
  };
  var header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify(claim));
  var toSign  = header + '.' + payload;
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(toSign, sa.private_key)
  );
  var resp = UrlFetchApp.fetch(sa.token_uri, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + toSign + '.' + sig,
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  if (!data.access_token) throw new Error('Token error: ' + resp.getContentText());
  return data.access_token;
}

// ── FIRESTORE HELPERS ───────────────────────────────────

// All documents (paginated)
function firestoreGet(token) {
  var allDocs = [], pageToken = null;
  do {
    var url = 'https://firestore.googleapis.com/v1/projects/' + projectId_() +
              '/databases/(default)/documents/' + COLLECTION + '?pageSize=300';
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.documents) allDocs = allDocs.concat(data.documents);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return allDocs;
}

// Documents with updatedAt > since
function firestoreQueryUpdated(token, since) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId_() +
            '/databases/(default)/documents:runQuery';
  var body = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'updatedAt' },
          op: 'GREATER_THAN',
          value: { integerValue: String(since) }
        }
      }
    }
  };
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var data = JSON.parse(resp.getContentText());
  return data
    .filter(function(r) { return r.document; })
    .map(function(r) { return r.document; });
}

// Save a document (updateMask: only TEXT_FIELDS + updatedAt → photos & soft-delete untouched)
function firestoreSet(token, docId, fields) {
  var maskFields = TEXT_FIELDS.concat(['updatedAt']);
  var mask = maskFields.map(function(f) { return 'updateMask.fieldPaths=' + f; }).join('&');
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId_() +
            '/databases/(default)/documents/' + COLLECTION + '/' + docId + '?' + mask;
  var body = { fields: {} };
  TEXT_FIELDS.forEach(function(k) {
    body.fields[k] = { stringValue: String(fields[k] || '') };
  });
  body.fields['updatedAt'] = { integerValue: String(Date.now()) };
  var resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400)
    throw new Error('Firestore error: ' + resp.getContentText());
}

function docToObj(doc) {
  var obj = {};
  if (!doc.fields) return obj;
  Object.keys(doc.fields).forEach(function(k) {
    var f = doc.fields[k];
    obj[k] = f.stringValue  !== undefined ? f.stringValue  :
             f.integerValue !== undefined ? String(f.integerValue) :
             f.doubleValue  !== undefined ? String(f.doubleValue)  :
             f.booleanValue !== undefined ? String(f.booleanValue) : '';
  });
  return obj;
}

// Soft-deleted? The app sets deletedAt (ms) when a can is in the trash;
// those must NOT appear in the sheet (and must never be re-uploaded).
function isDeleted(doc) {
  if (!doc.fields || !doc.fields.deletedAt) return false;
  var f = doc.fields.deletedAt;
  var v = f.integerValue !== undefined ? Number(f.integerValue)
        : f.doubleValue  !== undefined ? Number(f.doubleValue) : 0;
  return v > 0;
}

// ── PULL (full): Firestore → Sheet ──────────────────────
function pullFromFirestore() {
  var ui = SpreadsheetApp.getUi();
  try {
    var token = getAccessToken();
    var docs  = firestoreGet(token).filter(function(d) { return !isDeleted(d); });
    if (!docs.length) { ui.alert('Nessuna lattina trovata su Firestore.'); return; }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
    styleHeader(sheet);

    var rows = docs.map(function(doc) {
      var obj = docToObj(doc);
      return COLUMNS.map(function(col) { return obj[colToField(col)] || ''; });
    });
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
    pullFromFirestore();
    return;
  }

  try {
    var token = getAccessToken();
    var docs  = firestoreQueryUpdated(token, lastSync);

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Foglio "' + SHEET_NAME + '" non trovato. Fai prima il pull completo.');

    var data   = sheet.getDataRange().getValues();
    var rowMap = {};
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || '').trim();
      if (rowId) rowMap[rowId] = i + 1;
    }

    var added = 0, updated = 0, trashed = 0;
    docs.forEach(function(doc) {
      var mvId = doc.name.split('/').pop();

      // a can moved to the trash since last sync → remove its row if present
      if (isDeleted(doc)) {
        if (rowMap[mvId]) { sheet.deleteRow(rowMap[mvId]); trashed++; }
        return;
      }

      var obj = docToObj(doc);
      var row = COLUMNS.map(function(col) { return obj[colToField(col)] || ''; });
      if (rowMap[mvId]) {
        sheet.getRange(rowMap[mvId], 1, 1, COLUMNS.length).setValues([row]);
        updated++;
      } else {
        sheet.appendRow(row);
        added++;
      }
    });

    if (!added && !updated && !trashed) { ui.alert('Già aggiornato — nessuna novità.'); return; }
    props.setProperty('lastSyncTimestamp', String(Date.now()));
    ui.alert('✅ +' + added + ' nuove, ' + updated + ' aggiornate, ' + trashed + ' rimosse (cestino).');
  } catch(e) {
    ui.alert('❌ Errore: ' + e.message);
  }
}

// ── PUSH: Sheet → Firestore ─────────────────────────────
function pushToFirestore() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Caricare su Firestore?', 'Vengono aggiornati solo i campi testuali. Foto e cestino non vengono toccati.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  try {
    var token = getAccessToken();
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Foglio "' + SHEET_NAME + '" non trovato.');

    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows    = data.slice(1).filter(function(r) { return r.some(function(c) { return c !== ''; }); });
    var added = 0, updated = 0, skipped = 0;

    rows.forEach(function(row, ri) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = String(row[i] || '').trim(); });
      if (!obj['NOME'] && !obj['SKU']) { skipped++; return; }

      var mvId = obj['MV_ID'] || ('can_' + canHash(obj));

      firestoreSet(token, mvId, {
        id: mvId, nome: obj['NOME']||'', sku: obj['SKU']||'',
        produttore: obj['PRODUTTORE']||'', size: obj['SIZE']||'',
        lingua: obj['LINGUA']||'', top: obj['TOP/TAB']||'',
        promo: obj['PROMO']||'', valore: obj['VALORE (STIMA)']||'',
        note: obj['OPENING']||'', stato: obj['CONDITIONS']||'OK',
        descrizione: obj['MORE INFO']||''
      });

      if (obj['MV_ID']) {
        updated++;
      } else {
        added++;
        var mvIdCol = headers.indexOf('MV_ID');
        if (mvIdCol >= 0) sheet.getRange(ri + 2, mvIdCol + 1).setValue(mvId);
      }
    });

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
