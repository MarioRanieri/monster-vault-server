/**
 * Frontend unit tests per Monster Vault (index.html).
 *
 * Strategia: ogni test carica l'HTML reale in un ambiente jsdom con
 * runScripts:'dangerously', in modo da eseguire esattamente il codice
 * di produzione — non una copia.  fetch, confirm e window.open sono
 * mockati prima che gli script girino (beforeParse).
 *
 * Per eseguire:
 *   cd frontend-tests && npm install && npm test
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(
  path.resolve(__dirname, '../src/main/resources/static/index.html'),
  'utf-8'
);

/**
 * Crea una finestra jsdom con l'HTML reale.
 * fetch è mockato prima che gli script girino così il boot IIFE
 * non fa richieste reali.
 *
 * @param {object} opts
 * @param {Function} opts.fetchImpl  - implementazione custom di fetch
 * @param {Function} opts.confirm    - risposta al confirm() del browser
 */
function buildDom(opts = {}) {
  const fetchImpl = opts.fetchImpl || jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
  );

  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost:8080/',
    beforeParse(win) {
      win.fetch   = fetchImpl;
      win.confirm = opts.confirm || (() => true);
      win.open    = jest.fn();
    },
  });

  return { win: dom.window, fetchImpl };
}

/** Svuota la coda delle microtask (Promise) prima di continuare. */
const flushPromises = () => new Promise(r => setTimeout(r, 0));


// ─────────────────────────────────────────────────────────────────────────────
// esc()
// ─────────────────────────────────────────────────────────────────────────────

describe('esc()', () => {
  test('escapes < > & " in modo sicuro contro XSS', () => {
    const { win } = buildDom();
    expect(win.esc('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(win.esc('a & b')).toBe('a &amp; b');
    expect(win.esc('"quoted"')).toBe('&quot;quoted&quot;');
    expect(win.esc('<>')).toBe('&lt;&gt;');
  });

  test('restituisce stringa vuota per null/undefined', () => {
    const { win } = buildDom();
    expect(win.esc(null)).toBe('');
    expect(win.esc(undefined)).toBe('');
    expect(win.esc('')).toBe('');
  });

  test('non modifica testo senza caratteri speciali', () => {
    const { win } = buildDom();
    expect(win.esc('Monster Ultra')).toBe('Monster Ultra');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// simpleHash()
// ─────────────────────────────────────────────────────────────────────────────

describe('simpleHash()', () => {
  test('restituisce una stringa non vuota', () => {
    const { win } = buildDom();
    const h = win.simpleHash('test');
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(0);
  });

  test('stesso input → stesso hash (determinismo)', () => {
    const { win } = buildDom();
    expect(win.simpleHash('Monster Ultra 500ml EN'))
      .toBe(win.simpleHash('Monster Ultra 500ml EN'));
  });

  test('input diversi → hash diversi', () => {
    const { win } = buildDom();
    expect(win.simpleHash('foo')).not.toBe(win.simpleHash('bar'));
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// apiCall() — headers
// ─────────────────────────────────────────────────────────────────────────────

describe('apiCall()', () => {
  test('include Authorization: Bearer quando il token è presente', async () => {
    const { win, fetchImpl } = buildDom();
    win.localStorage.setItem('mv_jwt_token', 'my-test-token');

    await win.apiCall('GET', '/api/cans');

    // L'ultima chiamata a GET /api/cans (non quella del boot)
    const calls = fetchImpl.mock.calls.filter(
      ([, opts]) => opts && opts.method === 'GET'
    );
    const last = calls[calls.length - 1];
    expect(last[1].headers['Authorization']).toBe('Bearer my-test-token');
  });

  test('unisce extraHeaders con gli header di autenticazione', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    );
    const { win } = buildDom({ fetchImpl });
    win.localStorage.setItem('mv_jwt_token', 'tok');

    await win.apiCall('DELETE', '/api/test', null, { 'X-Custom': 'hello' });

    const deleteCalls = fetchImpl.mock.calls.filter(
      ([, opts]) => opts && opts.method === 'DELETE'
    );
    const headers = deleteCalls[0][1].headers;
    expect(headers['X-Custom']).toBe('hello');
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['Content-Type']).toBe('application/json');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// batchDeleteAllFS() — BUG FIX: deve inviare X-Confirm-Delete: all
// ─────────────────────────────────────────────────────────────────────────────

describe('batchDeleteAllFS()', () => {
  test('invia X-Confirm-Delete: all nella richiesta DELETE', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) })
    );
    const { win } = buildDom({ fetchImpl });
    win.localStorage.setItem('mv_jwt_token', 'test-token');

    await win.batchDeleteAllFS();

    const deleteCalls = fetchImpl.mock.calls.filter(
      ([url, opts]) => url.endsWith('/api/cans') && opts && opts.method === 'DELETE'
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
    expect(deleteCalls[0][1].headers['X-Confirm-Delete']).toBe('all');
  });

  test('NON invia X-Confirm-Delete in altri endpoint DELETE', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) })
    );
    const { win } = buildDom({ fetchImpl });
    win.localStorage.setItem('mv_jwt_token', 'test-token');

    await win.deleteCanFS('can-123');

    const deleteCalls = fetchImpl.mock.calls.filter(
      ([url, opts]) => url.endsWith('/can-123') && opts && opts.method === 'DELETE'
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
    expect(deleteCalls[0][1].headers['X-Confirm-Delete']).toBeUndefined();
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// shareCanLink() — BUG FIX: usare can.lingua (non can.paese) e can.note per FULL
// ─────────────────────────────────────────────────────────────────────────────

describe('shareCanLink()', () => {
  /**
   * Prepara lo stato globale necessario a shareCanLink() e installa
   * un mock di copyToClipboard che cattura il testo condiviso.
   * Restituisce una funzione getter per leggere il testo catturato.
   */
  function setupShare(win, canData) {
    win.cans = [canData];
    win.detailCurrentId = canData.id;
    win.localStorage.setItem('mv_share_name', 'Tester');

    let captured = '';
    win.copyToClipboard = (text, cb) => { captured = text; if (cb) cb(); };

    return () => captured;
  }

  test('include can.lingua nella stringa condivisa', () => {
    const { win } = buildDom();
    const getText = setupShare(win, {
      id: 'can-1', nome: 'Monster Ultra', lingua: 'EN',
      size: '500ml', sku: 'SKU1', note: ''
    });
    win.shareCanLink('text');
    expect(getText()).toContain('EN');
  });

  test('NON contiene "undefined" o "paese" (campo inesistente rimosso)', () => {
    const { win } = buildDom();
    const getText = setupShare(win, {
      id: 'can-2', nome: 'Test Can', lingua: 'IT',
      size: '500ml', sku: 'SKU2', note: ''
    });
    win.shareCanLink('text');
    expect(getText()).not.toContain('undefined');
    expect(getText()).not.toContain('paese');
  });

  test('include FULL quando can.note contiene la parola FULL', () => {
    const { win } = buildDom();
    const getText = setupShare(win, {
      id: 'can-3', nome: 'Full Can', lingua: 'DE',
      size: '500ml', sku: 'SKU3', note: 'FULL, pull tab'
    });
    win.shareCanLink('text');
    expect(getText()).toContain('FULL');
  });

  test('NON include FULL quando can.note non contiene FULL', () => {
    const { win } = buildDom();
    const getText = setupShare(win, {
      id: 'can-4', nome: 'Empty Can', lingua: 'FR',
      size: '500ml', sku: 'SKU4', note: 'pull tab'
    });
    win.shareCanLink('text');
    expect(getText()).not.toContain('FULL');
  });

  test('FULL è case-insensitive (nota in minuscolo)', () => {
    const { win } = buildDom();
    const getText = setupShare(win, {
      id: 'can-5', nome: 'Case Test', lingua: 'ES',
      size: '500ml', sku: 'SKU5', note: 'full, tab'
    });
    win.shareCanLink('text');
    expect(getText()).toContain('FULL');
  });

  test('non fa nulla se il nome utente share non è impostato', () => {
    const { win } = buildDom();
    setupShare(win, { id: 'can-6', nome: 'Test', lingua: 'EN', size: '', sku: '', note: '' });
    win.localStorage.removeItem('mv_share_name');
    let copied = false;
    win.copyToClipboard = () => { copied = true; };
    win.shareCanLink('text');
    expect(copied).toBe(false);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// clearAll() — BUG FIX: deve aggiornare la cache localStorage dopo la cancellazione
// ─────────────────────────────────────────────────────────────────────────────

describe('clearAll()', () => {
  test('aggiorna la cache localStorage con array vuoto dopo la cancellazione', async () => {
    // Call 1 (boot GET /api/cans): restituisce array vuoto
    // Call 2 (clearAll DELETE /api/cans): restituisce 204
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) });

    const { win } = buildDom({ fetchImpl });

    // Aspetta che il boot completi la chiamata GET iniziale
    await flushPromises();

    // Imposta alcune lattine di test
    win.cans = [{ id: 'test-1', nome: 'Test Can', sku: 'SKU-T1' }];

    // Esegui clearAll (auto-conferma grazie al mock di confirm)
    win.clearAll();
    await flushPromises();

    // La cache deve essere aggiornata con array vuoto
    const rawCache = win.localStorage.getItem('mv_cache');
    expect(rawCache).not.toBeNull();
    const cache = JSON.parse(rawCache);
    expect(Array.isArray(cache.cans)).toBe(true);
    expect(cache.cans).toHaveLength(0);
  });

  test('in-memory cans viene svuotato dopo la cancellazione', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) });

    const { win } = buildDom({ fetchImpl });
    await flushPromises();

    win.cans = [
      { id: 'test-1', nome: 'Can A', sku: 'A' },
      { id: 'test-2', nome: 'Can B', sku: 'B' },
    ];

    win.clearAll();
    await flushPromises();

    expect(win.cans).toHaveLength(0);
  });

  test('non elimina se l\'utente annulla il confirm', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
    );
    // confirm restituisce false → l'utente annulla
    const { win } = buildDom({ fetchImpl, confirm: () => false });
    await flushPromises();

    win.cans = [{ id: 'test-1', nome: 'Test', sku: 'SKU' }];
    win.clearAll();
    await flushPromises();

    // Nessuna chiamata DELETE deve essere partita
    const deleteCalls = fetchImpl.mock.calls.filter(
      ([url, opts]) => url.endsWith('/api/cans') && opts && opts.method === 'DELETE'
    );
    expect(deleteCalls).toHaveLength(0);
    // Le lattine devono essere rimaste
    expect(win.cans).toHaveLength(1);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// renderComparePanel() — BUG FIX: il prezzo non deve apparire in guest mode
// ─────────────────────────────────────────────────────────────────────────────

describe('renderComparePanel()', () => {
  function setupCompare(win, publicMode) {
    const testCans = [
      { id: 'c1', nome: 'Monster Ultra', sku: 'SKU1', produttore: 'Monster', lingua: 'EN',
        size: '500ml', top: 'Pull Tab', note: '', stato: 'Mint', valore: '5', promo: '' },
      { id: 'c2', nome: 'Monster Zero', sku: 'SKU2', produttore: 'Monster', lingua: 'IT',
        size: '473ml', top: 'Pull Tab', note: '', stato: 'Good', valore: '3', promo: '' },
    ];
    win.cans = testCans;
    win.selectedForCompare = ['c1', 'c2'];
    win.isPublicMode = publicMode;
    win.renderComparePanel();
  }

  test('in admin mode mostra la riga Est. Value', () => {
    const { win } = buildDom();
    setupCompare(win, false);
    const body = win.document.getElementById('compare-panel-body').innerHTML;
    expect(body).toContain('Est. Value');
  });

  test('in guest mode NON mostra la riga Est. Value', () => {
    const { win } = buildDom();
    setupCompare(win, true);
    const body = win.document.getElementById('compare-panel-body').innerHTML;
    expect(body).not.toContain('Est. Value');
  });

  test('in guest mode gli altri campi (Condition, SKU, ecc.) sono visibili', () => {
    const { win } = buildDom();
    setupCompare(win, true);
    const body = win.document.getElementById('compare-panel-body').innerHTML;
    expect(body).toContain('Condition');
    expect(body).toContain('SKU');
    expect(body).toContain('Manufacturer');
  });

  test('in admin mode il valore numerico della lattina è visibile', () => {
    const { win } = buildDom();
    setupCompare(win, false);
    const body = win.document.getElementById('compare-panel-body').innerHTML;
    // valore '5' e '3' devono comparire
    expect(body).toContain('>5<');
    expect(body).toContain('>3<');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// statsFreq() — funzione pura: frequenza per campo (estratta in refactor SOLID/SRP)
// ─────────────────────────────────────────────────────────────────────────────

describe('statsFreq()', () => {
  test('conta le occorrenze e ordina per frequenza decrescente', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', lingua: 'EN' }, { id: '2', lingua: 'EN' },
      { id: '3', lingua: 'IT' }, { id: '4', lingua: 'EN' }, { id: '5', lingua: 'IT' },
    ];
    const res = win.statsFreq('lingua');
    expect(res).toEqual([{ k: 'EN', n: 3 }, { k: 'IT', n: 2 }]);
  });

  test('ignora i valori vuoti/assenti del campo', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', size: '500ml' }, { id: '2', size: '' },
      { id: '3' }, { id: '4', size: '500ml' },
    ];
    expect(win.statsFreq('size')).toEqual([{ k: '500ml', n: 2 }]);
  });

  test('rispetta il parametro limit', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', produttore: 'A' }, { id: '2', produttore: 'A' },
      { id: '3', produttore: 'B' }, { id: '4', produttore: 'C' },
    ];
    const res = win.statsFreq('produttore', 1);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({ k: 'A', n: 2 });
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// buildStatsData() — funzione pura: aggregazione summary (refactor SOLID/SRP)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildStatsData()', () => {
  test('aggrega total, withPhoto, promo, fullCans e pct', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', p1: 'https://x/a.jpg', promo: '1', note: 'FULL can' },
      { id: '2', p1: 'https://x/b.jpg', promo: '',  note: 'pull tab' },
      { id: '3', p1: '',                promo: '1', note: 'full sealed' },
      { id: '4' },
    ];
    expect(win.buildStatsData()).toEqual({
      total: 4, withPhoto: 2, promo: 2, fullCans: 2, pct: 50,
    });
  });

  test('pct è 0 quando la collezione è vuota (nessuna divisione per zero)', () => {
    const { win } = buildDom();
    win.cans = [];
    expect(win.buildStatsData()).toEqual({
      total: 0, withPhoto: 0, promo: 0, fullCans: 0, pct: 0,
    });
  });

  test('FULL è case-insensitive in fullCans', () => {
    const { win } = buildDom();
    win.cans = [{ id: '1', note: 'Full' }, { id: '2', note: 'FULL' }, { id: '3', note: 'empty' }];
    expect(win.buildStatsData().fullCans).toBe(2);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// buildTimelineData() / renderTimeline() — timeline ultimi 12 mesi (refactor SOLID)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTimelineData()', () => {
  /** Timestamp a metà mese, mezzogiorno: stesso mese sia in locale che in UTC. */
  function midMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 15, 12, 0, 0).getTime();
  }

  test('restituisce sempre 12 bucket mensili con shape {k, n}', () => {
    const { win } = buildDom();
    win.cans = [];
    const data = win.buildTimelineData();
    expect(data).toHaveLength(12);
    data.forEach(d => {
      expect(typeof d.k).toBe('string');
      expect(typeof d.n).toBe('number');
    });
  });

  test('conta le lattine del mese corrente ed esclude quelle fuori dalla finestra di 12 mesi', () => {
    const { win } = buildDom();
    const now = new Date();
    win.cans = [
      { id: '1', updatedAt: midMonth(now) },                 // mese corrente → contato
      { id: '2', updatedAt: midMonth(now) },                 // mese corrente → contato
      { id: '3', updatedAt: new Date(2000, 0, 15, 12).getTime() }, // anno 2000 → escluso
      { id: '4' },                                           // updatedAt assente → ignorato
    ];
    const data = win.buildTimelineData();
    const total = data.reduce((s, d) => s + d.n, 0);
    expect(total).toBe(2);
    expect(data[data.length - 1].n).toBe(2); // l'ultimo bucket è il mese corrente
  });
});

describe('renderTimeline()', () => {
  test('restituisce stringa vuota quando NESSUNA lattina ha updatedAt', () => {
    const { win } = buildDom();
    win.cans = [{ id: '1' }, { id: '2' }];
    expect(win.renderTimeline()).toBe('');
  });

  test('produce la sezione con SVG e il toggle Months/Years quando ci sono dati', () => {
    const { win } = buildDom();
    const now = new Date();
    win.cans = [{ id: '1', updatedAt: new Date(now.getFullYear(), now.getMonth(), 15, 12).getTime() }];
    const html = win.renderTimeline();
    expect(html).toContain('<svg');
    expect(html).toContain('Added over time');
    expect(html).toContain('12 months');
    expect(html).toContain('By year');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// buildYearlyData() / setTimelineMode() — timeline interattiva (#16)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildYearlyData()', () => {
  test('raggruppa le lattine per anno (all-time): conteggio n + somma valore v', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', updatedAt: new Date(2024, 5, 1, 12).getTime(), valore: '10' },
      { id: '2', updatedAt: new Date(2024, 11, 1, 12).getTime(), valore: '5.5' },
      { id: '3', updatedAt: new Date(2026, 0, 1, 12).getTime(), valore: '3' },
      { id: '4' }, // niente updatedAt → ignorata
    ];
    expect(win.buildYearlyData()).toEqual([{ k: '2024', n: 2, v: 15.5 }, { k: '2026', n: 1, v: 3 }]);
  });

  test('valore non numerico/assente conta come 0 nel totale v', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', updatedAt: new Date(2025, 0, 1, 12).getTime(), valore: '8' },
      { id: '2', updatedAt: new Date(2025, 1, 1, 12).getTime() },           // no valore
      { id: '3', updatedAt: new Date(2025, 2, 1, 12).getTime(), valore: 'n/a' },
    ];
    expect(win.buildYearlyData()).toEqual([{ k: '2025', n: 3, v: 8 }]);
  });

  test('array vuoto se nessuna lattina ha updatedAt', () => {
    const { win } = buildDom();
    win.cans = [{ id: '1' }];
    expect(win.buildYearlyData()).toEqual([]);
  });
});

describe('setTimelineMetric()', () => {
  test('passa da conteggio a valore € e il grafico mostra l\'importo', () => {
    const { win } = buildDom();
    const now = new Date();
    win.cans = [
      { id: '1', updatedAt: new Date(now.getFullYear(), now.getMonth(), 15, 12).getTime(), valore: '42' },
    ];
    win.setTimelineMetric('value');
    expect(win.statsTlMetric).toBe('value');
    expect(win.renderTimelineChart()).toContain('€42');
    win.setTimelineMetric('count');
    expect(win.statsTlMetric).toBe('count');
  });
});

describe('setTimelineMode()', () => {
  test('cambia modalità e il grafico riflette months↔years', () => {
    const { win } = buildDom();
    const now = new Date();
    win.cans = [
      { id: '1', updatedAt: new Date(now.getFullYear(), now.getMonth(), 15, 12).getTime() },
      { id: '2', updatedAt: new Date(2020, 0, 15, 12).getTime() }, // fuori dai 12 mesi
    ];
    win.setTimelineMode('years');
    expect(win.statsTlMode).toBe('years');
    expect(win.renderTimelineChart()).toContain('2020'); // visibile solo nella vista per anno
    win.setTimelineMode('months');
    expect(win.statsTlMode).toBe('months');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// jsq() — escaping sicuro per id/valori dentro handler inline (XSS hardening)
// ─────────────────────────────────────────────────────────────────────────────

describe('jsq()', () => {
  test('lascia invariati gli id alfanumerici normali (identità)', () => {
    const { win } = buildDom();
    expect(win.jsq('1234')).toBe('1234');
    expect(win.jsq('og-original-2020')).toBe('og-original-2020');
  });

  test('null/undefined → stringa vuota', () => {
    const { win } = buildDom();
    expect(win.jsq(null)).toBe('');
    expect(win.jsq(undefined)).toBe('');
  });

  test('neutralizza apice singolo e backslash (no breakout dalla stringa JS)', () => {
    const { win } = buildDom();
    const out = win.jsq("x');alert(1)//");
    // nessun apice singolo grezzo che possa chiudere la stringa JS
    expect(out).not.toMatch(/(^|[^\\])'/);
    expect(out).toContain('\\x27');
    // backslash raddoppiato
    expect(win.jsq('a\\b')).toBe('a\\\\b');
  });

  test('neutralizza i caratteri speciali HTML del delimitatore attributo', () => {
    const { win } = buildDom();
    const out = win.jsq('a"<>&b');
    expect(out).not.toContain('"');      // delimitatore attributo
    expect(out).toContain('&quot;');
    expect(out).toContain('&amp;');
    expect(out).toContain('\\x3C');      // <
    expect(out).toContain('\\x3E');      // >
  });

  test('un id ostile non sopravvive come HTML/JS eseguibile in cardHTML', () => {
    const { win } = buildDom();
    win.cans = [{ id: "'><img src=x onerror=alert(1)>", nome: 'Evil', sku: 'E1' }];
    win.selectedForCompare = [];
    const html = win.cardHTML(win.cans[0]);
    // l'id ostile non deve comparire grezzo: né apice di breakout né tag iniettato
    expect(html).not.toContain("onclick=\"openDetail(''>");
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// watch flag (monitor eBay)
// ─────────────────────────────────────────────────────────────────────────────

describe('watch flag (eBay monitor)', () => {
  test('buildCanData include il campo watch dal form', () => {
    const { win } = buildDom();
    const photos = { 1: '', 2: '', 3: '', 4: '' };
    expect(win.buildCanData('id1', { watch: true }, photos).watch).toBe(true);
    expect(win.buildCanData('id2', { watch: false }, photos).watch).toBe(false);
  });

  test('readCanForm legge la checkbox e-watch', () => {
    const { win } = buildDom();
    win.document.getElementById('e-watch').checked = true;
    expect(win.readCanForm().watch).toBe(true);
    win.document.getElementById('e-watch').checked = false;
    expect(win.readCanForm().watch).toBe(false);
  });

  test('toggleWatch attiva il flag (ottimistico) e fa PUT con watch=true', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    );
    const { win } = buildDom({ fetchImpl });
    win.cans = [{ id: 'can1', nome: 'X', sku: 'S', watch: false }];

    win.toggleWatch('can1');
    expect(win.cans[0].watch).toBe(true);            // aggiornamento ottimistico sincrono

    await flushPromises();
    const put = fetchImpl.mock.calls.filter(([, o]) => o && o.method === 'PUT').pop();
    expect(put).toBeTruthy();
    expect(put[0]).toContain('/api/cans/can1');
    expect(JSON.parse(put[1].body).watch).toBe(true);
  });

  test('toggleWatch fa rollback se il PUT fallisce', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
    );
    const { win } = buildDom({ fetchImpl });
    win.cans = [{ id: 'can1', nome: 'X', sku: 'S', watch: false }];

    win.toggleWatch('can1');
    expect(win.cans[0].watch).toBe(true);            // ottimistico

    await flushPromises();
    await flushPromises();
    expect(win.cans[0].watch).toBe(false);           // ripristinato dopo l'errore
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// colorizeTop() — campo Top/Tab: la parola dopo lo slash prende il suo colore
// ─────────────────────────────────────────────────────────────────────────────

describe('colorizeTop()', () => {
  test('colora la parola dopo lo slash col colore che nomina (silver/orange)', () => {
    const { win } = buildDom();
    const html = win.colorizeTop('silver/orange');
    expect(html.startsWith('silver/')).toBe(true);   // la parte PRIMA dello slash resta normale
    expect(html).toContain('#ff8c00');               // orange → arancione
    expect(html).toContain('>orange</span>');
  });

  test('senza slash il testo resta invariato (non colorato)', () => {
    const { win } = buildDom();
    expect(win.colorizeTop('GREEN')).toBe('GREEN');
  });

  test('colore sconosciuto dopo lo slash resta testo normale', () => {
    const { win } = buildDom();
    expect(win.colorizeTop('silver/boh')).toBe('silver/boh');
  });

  test('più slash: ogni segmento riconosciuto prende il suo colore', () => {
    const { win } = buildDom();
    const html = win.colorizeTop('black/white/red');
    expect(html).toContain('color:#fff');            // white
    expect(html).toContain('#ff4136');               // red
  });

  test('escapa input ostile (niente XSS) e gestisce null', () => {
    const { win } = buildDom();
    expect(win.colorizeTop('<img src=x onerror=1>/red')).not.toContain('<img');
    expect(win.colorizeTop(null)).toBe('');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// captureFilterState() / applyFilterState() — preset filtri "Views"
// ─────────────────────────────────────────────────────────────────────────────

describe('captureFilterState() / applyFilterState()', () => {
  test('cattura e riapplica lo stato dei filtri (roundtrip)', () => {
    const { win } = buildDom();
    win.document.getElementById('search-input').value = 'khaos';
    win.document.getElementById('fl-vmin').value = '10';
    win.activeChips.promo = true;

    const st = win.captureFilterState();
    expect(st.q).toBe('khaos');
    expect(st.vmin).toBe('10');
    expect(st.chips.promo).toBe(true);

    // azzera tutto e riapplica lo stato salvato
    win.document.getElementById('search-input').value = '';
    win.document.getElementById('fl-vmin').value = '';
    win.activeChips.promo = false;
    win.applyFilterState(st);
    expect(win.document.getElementById('search-input').value).toBe('khaos');
    expect(win.document.getElementById('fl-vmin').value).toBe('10');
    expect(win.activeChips.promo).toBe(true);
  });

  test('applyFilterState ignora un sort inesistente/ostile senza crash', () => {
    const { win } = buildDom();
    const cur = win.document.getElementById('sort-select').value;
    win.applyFilterState({ q: '', sort: '"]<img src=x>', chips: {} });
    expect(win.document.getElementById('sort-select').value).toBe(cur);
  });

  test('canMatchesFilters è la fonte unica: filterCans la usa (chip FULL)', () => {
    const { win } = buildDom();
    win.cans = [
      { id: '1', nome: 'A', sku: 'S1', note: 'FULL, TOP OPENED' },
      { id: '2', nome: 'B', sku: 'S2', note: 'EMPTY' },
    ];
    win.activeChips.full = true;
    const list = win.filterCans();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('1');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// extractYearFromCan() + filtro per anno
// ─────────────────────────────────────────────────────────────────────────────

describe('extractYearFromCan() / filtro anno da SKU', () => {
  test('decodifica mese+anno dallo SKU: 0610→2010, 093→2003, 128→2008', () => {
    const { win } = buildDom();
    expect(win.extractYearFromCan({ sku: '0610' })).toBe(2010);  // MM=06, anno 20"10"
    expect(win.extractYearFromCan({ sku: '093' })).toBe(2003);   // MM=09, anno 200"3"
    expect(win.extractYearFromCan({ sku: '128' })).toBe(2008);   // MM=12, anno 200"8"
    expect(win.extractYearFromCan({ sku: '0114' })).toBe(2014);
  });

  test('SKU non valido → null (mese >12, lettere, lunghezza sbagliata)', () => {
    const { win } = buildDom();
    expect(win.extractYearFromCan({ sku: '1310' })).toBe(null);  // mese 13 non esiste
    expect(win.extractYearFromCan({ sku: 'ABC' })).toBe(null);
    expect(win.extractYearFromCan({ sku: '12' })).toBe(null);    // troppo corto
    expect(win.extractYearFromCan({ sku: '12345' })).toBe(null); // troppo lungo
    expect(win.extractYearFromCan({})).toBe(null);
  });

  test('filterCans applica il range anni dallo SKU (senza SKU valido → esclusa)', () => {
    const { win } = buildDom();
    win.cans = [
      { id: 'a', nome: 'Tour Water', sku: '0606' },  // 2006
      { id: 'b', nome: 'Mixxd',      sku: '0610' },  // 2010
      { id: 'c', nome: 'Ultra Rosa', sku: 'X1' },    // nessun anno
    ];
    win.document.getElementById('fl-ymin').value = '2007';
    const list = win.filterCans();
    expect(list.map(c => c.id)).toEqual(['b']);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// buildTopValue() — Top 10 più preziose (Stats)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTopValue()', () => {
  test('ordina per valore decrescente e rispetta il limite', () => {
    const { win } = buildDom();
    const rows = win.buildTopValue([
      { id: '1', valore: '10' }, { id: '2', valore: '300' }, { id: '3', valore: '50' },
    ], 2);
    expect(rows.map(c => c.id)).toEqual(['2', '3']);
  });

  test('esclude le lattine senza valore', () => {
    const { win } = buildDom();
    const rows = win.buildTopValue([
      { id: '1', valore: '' }, { id: '2', valore: '5' }, { id: '3' },
    ], 10);
    expect(rows.map(c => c.id)).toEqual(['2']);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// renderWall() — wall view (mosaico foto)
// ─────────────────────────────────────────────────────────────────────────────

describe('renderWall()', () => {
  test('mostra solo le lattine con foto e usa jsq per gli id', () => {
    const { win } = buildDom();
    win.filteredList = [
      { id: 'p1can', nome: 'Con foto', p1: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' },
      { id: 'nofoto', nome: 'Senza foto' },
    ];
    win.renderWall();
    const html = win.document.getElementById('wall-view').innerHTML;
    expect(html).toContain('wall-tile');
    expect(html).toContain('p1can');
    expect(html).not.toContain('nofoto');
  });

  test('setView(\'wall\') attiva il bottone e mostra il contenitore', () => {
    const { win } = buildDom();
    win.filteredList = [];
    win.setView('wall');
    expect(win.document.getElementById('vbtn-wall').classList.contains('active')).toBe(true);
    expect(win.document.getElementById('wall-view').style.display).toBe('');
    expect(win.document.getElementById('grid').style.display).toBe('none');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// cloudinaryThumb() — trasformazione URL ottimizzata (c_fit, niente crop)
// ─────────────────────────────────────────────────────────────────────────────

describe('cloudinaryThumb()', () => {
  const CL = 'https://res.cloudinary.com/demo/image/upload/v1/can.jpg';

  test('inserisce c_fit + dimensioni + f_auto/q_auto dopo /upload/ (lattina intera, niente crop)', () => {
    const { win } = buildDom();
    expect(win.cloudinaryThumb(CL, 800, 800))
      .toBe('https://res.cloudinary.com/demo/image/upload/c_fit,w_800,h_800,f_auto,q_auto/v1/can.jpg');
  });

  test('rispetta le dimensioni passate', () => {
    const { win } = buildDom();
    expect(win.cloudinaryThumb(CL, 1600, 1600)).toContain('c_fit,w_1600,h_1600');
    expect(win.cloudinaryThumb(CL, 128, 128)).toContain('c_fit,w_128,h_128');
  });

  test('lascia invariati gli URL non-Cloudinary e i valori nulli', () => {
    const { win } = buildDom();
    expect(win.cloudinaryThumb('https://example.com/x.jpg', 800, 800)).toBe('https://example.com/x.jpg');
    expect(win.cloudinaryThumb('', 800, 800)).toBe('');
    expect(win.cloudinaryThumb(null, 800, 800)).toBe(null);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Lightbox: viewer foto (anti-foto-scura, velocità thumb, priorità tastiera)
// ─────────────────────────────────────────────────────────────────────────────

describe('lightbox: viewer foto', () => {
  const CL = 'https://res.cloudinary.com/demo/image/upload/v1/can.jpg';
  function seed(win) {
    win.cans = [
      { id: 'A', nome: 'Can A', sku: '0412', p1: CL, p2: CL, p3: CL },
      { id: 'B', nome: 'Can B', sku: '0512', p1: CL },
    ];
    win.filteredList = win.cans;
  }

  test('setLbPhoto ripristina opacity a 1 (fix foto scura) e usa la versione CDN 1600', () => {
    const { win } = buildDom();
    seed(win);
    win.openLightbox('A');
    const img = win.document.getElementById('lb-img');
    img.style.opacity = '0.15';            // stato "scuro" incollato da un onerror precedente
    win.setLbPhoto(win.cans[0], 2);
    expect(img.style.opacity).toBe('1');   // deve tornare luminosa
    expect(img.getAttribute('src')).toContain('c_fit,w_1600,h_1600');
  });

  test('le thumbnail della lightbox usano la versione CDN ridotta 128 (velocità)', () => {
    const { win } = buildDom();
    seed(win);
    win.openLightbox('A');                 // A ha 3 foto → thumb costruite
    const html = win.document.getElementById('lb-thumbs').innerHTML;
    expect(html).toContain('c_fit,w_128,h_128');
    expect(html).not.toContain('/upload/v1/can.jpg"'); // non l'originale grezzo
  });

  test('frecce nella lightbox cambiano la FOTO senza navigare la lattina del details sotto', () => {
    const { win } = buildDom();
    seed(win);
    win.openDetail('A');
    win.openLightbox('A');                  // aperta DAL details (che resta aperto sotto)
    const slotBefore = win.lbSlot;
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(win.lbSlot).not.toBe(slotBefore); // la foto è avanzata
    expect(win.detailCurrentId).toBe('A');   // la lattina sotto NON è cambiata (no leak)
  });

  test('con solo il details aperto le frecce navigano tra le lattine', () => {
    const { win } = buildDom();
    seed(win);
    win.closeLightbox();
    win.openDetail('A');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(win.detailCurrentId).toBe('B');   // A → B
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Regressioni layout foto (CSS/markup nel file statico)
// ─────────────────────────────────────────────────────────────────────────────

describe('regressioni layout foto (CSS/markup)', () => {
  test('lightbox: sfondo nero pieno (no detail panel in trasparenza dietro)', () => {
    expect(HTML).toContain('.lightbox{position:fixed;inset:0;background:#000;');
  });

  test('lightbox: lb-img ripristina opacity su onload (anti foto scura incollata)', () => {
    expect(HTML).toContain('onload="this.style.opacity=\'1\'"');
  });

  test('lightbox: max-height legata a dvh per non andare fuoribordo su mobile', () => {
    expect(HTML).toContain('100dvh - 210px');
  });

  test('details: immagine principale object-fit:contain (lattina intera, non croppata)', () => {
    expect(HTML).toContain('.detail-main-img{width:100%;aspect-ratio:1;object-fit:contain;');
  });

  test('card: lo sfondo LQIP sparisce a caricamento avvenuto (no bordi colorati)', () => {
    expect(HTML).toContain('.card-img-lqip.lqip-loaded{filter:none;transform:scale(1);background-image:none!important;}');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Calcolatore valore (filtri combinabili in AND + somma raggruppata)
// ─────────────────────────────────────────────────────────────────────────────

describe('calcolatore valore (filtri + somma)', () => {
  test('calcMatch: gusto = sottostringa case-insensitive sul nome', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ nome: 'Monster Khaos' }, { gusto: 'khaos' })).toBe(true);
    expect(win.calcMatch({ nome: 'Mad Dog' }, { gusto: 'khaos' })).toBe(false);
  });

  test('calcMatch: paese trova anche le multi-nazione (sottostringa su lingua)', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ lingua: 'Albania/Romania' }, { paese: 'Romania' })).toBe(true);
    expect(win.calcMatch({ lingua: 'Mexico' }, { paese: 'USA' })).toBe(false);
  });

  test('calcMatch: full = note contiene FULL', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ note: 'FULL can sealed' }, { full: 'yes' })).toBe(true);
    expect(win.calcMatch({ note: '' }, { full: 'yes' })).toBe(false);
    expect(win.calcMatch({ note: '' }, { full: 'no' })).toBe(true);
  });

  test('calcMatch: promo = campo promo truthy', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ promo: 'YES' }, { promo: 'yes' })).toBe(true);
    expect(win.calcMatch({ promo: '' }, { promo: 'yes' })).toBe(false);
    expect(win.calcMatch({ promo: '' }, { promo: 'no' })).toBe(true);
  });

  test('calcMatch: SKU contiene / inizia per / esatto', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ sku: '0289' }, { sku: '028', skuOp: 'contains' })).toBe(true);
    expect(win.calcMatch({ sku: '0289' }, { sku: '028', skuOp: 'starts' })).toBe(true);
    expect(win.calcMatch({ sku: '1028' }, { sku: '028', skuOp: 'starts' })).toBe(false);
    expect(win.calcMatch({ sku: '0289' }, { sku: '028', skuOp: 'exact' })).toBe(false);
    expect(win.calcMatch({ sku: '028' }, { sku: '028', skuOp: 'exact' })).toBe(true);
  });

  test('calcMatch: filtro anno decodificato da SKU (range)', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ sku: '0610' }, { yearFrom: '2010' })).toBe(true);   // 06/2010
    expect(win.calcMatch({ sku: '0610' }, { yearFrom: '2011' })).toBe(false);
    expect(win.calcMatch({ sku: '0610' }, { yearTo: '2009' })).toBe(false);
    expect(win.calcMatch({ sku: 'XX' }, { yearFrom: '2000' })).toBe(false);     // senza data → escluso
  });

  test('calcMatch: criteri combinati in AND; query vuota = sempre vero', () => {
    const { win } = buildDom();
    const c = { nome: 'Khaos', lingua: 'Mexico', note: 'FULL', valore: '10' };
    expect(win.calcMatch(c, { gusto: 'khaos', paese: 'Mexico', full: 'yes' })).toBe(true);
    expect(win.calcMatch(c, { gusto: 'khaos', paese: 'USA' })).toBe(false);
    expect(win.calcMatch(c, {})).toBe(true);
  });

  test('calcTotals: somma, conteggio, media e lattine senza valore', () => {
    const { win } = buildDom();
    const t = win.calcTotals([{ valore: '10' }, { valore: '5' }, { valore: '' }]);
    expect(t.count).toBe(3);
    expect(t.total).toBe(15);
    expect(t.valued).toBe(2);
    expect(t.noValue).toBe(1);
    expect(t.avg).toBe(7.5);
  });

  test('calcGroups: subtotali per gruppo, ordinati per valore decrescente', () => {
    const { win } = buildDom();
    const list = [
      { nome: 'Khaos', valore: '10' }, { nome: 'Khaos', valore: '5' },
      { nome: 'Mad Dog', valore: '12' }, { nome: 'Ultra', valore: '8' },
    ];
    const g = win.calcGroups(list, 'nome');
    expect(g.map(x => x.key)).toEqual(['Khaos', 'Mad Dog', 'Ultra']); // 15, 12, 8
    expect(g[0]).toMatchObject({ key: 'Khaos', count: 2, subtotal: 15 });
  });

  test('calcMatch: foto = ha almeno una foto (p1..p4)', () => {
    const { win } = buildDom();
    expect(win.calcMatch({ p1: 'a.jpg' }, { foto: 'yes' })).toBe(true);
    expect(win.calcMatch({ p3: 'c.jpg' }, { foto: 'yes' })).toBe(true);
    expect(win.calcMatch({}, { foto: 'yes' })).toBe(false);
    expect(win.calcMatch({}, { foto: 'no' })).toBe(true);
  });

  test('filtri "solo possibili": calcDistinct sul sottoinsieme filtrato', () => {
    const { win } = buildDom();
    const list = [
      { top: 'BLACK', note: 'FULL' }, { top: 'MAGENTA', note: '' }, { top: 'SILVER', note: 'FULL' },
    ];
    // tra le sole FULL i Top disponibili sono BLACK e SILVER (MAGENTA escluso)
    const fullOnly = win.calcFilter(list, { full: 'yes' });
    expect(win.calcDistinct('top', false, fullOnly)).toEqual(['BLACK', 'SILVER']);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Demo / fallback offline — NON deve persistere (regressione "2 lattine prova")
// ─────────────────────────────────────────────────────────────────────────────

describe('demo / fallback offline', () => {
  test('showDemo mostra le mock SENZA salvare (no cache, no POST sul server)', () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
    );
    const { win } = buildDom({ fetchImpl });
    win.localStorage.removeItem('mv_cache');
    fetchImpl.mockClear();
    win.showDemo(null);
    expect(win.cans.length).toBe(win.MOCK_CANS.length);          // demo mostrata
    expect(win.localStorage.getItem('mv_cache')).toBeNull();      // cache NON avvelenata
    const writes = fetchImpl.mock.calls.filter(([, o]) => o && o.method && o.method !== 'GET');
    expect(writes.length).toBe(0);                                // nessuna scrittura (no batchSave)
  });
});
