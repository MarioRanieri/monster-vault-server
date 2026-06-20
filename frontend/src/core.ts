// ── Monster Vault — Core: state, API, auth, utils, cache, theme ────────────
import type { Can, ActiveChips, FilterState } from './types';

// ── STATE ──────────────────────────────────────────────
export const state = {
  isAdmin: false,
  isPublicMode: false,
  cans: [] as Can[],
  filteredList: [] as Can[],
  showPrice: JSON.parse(localStorage.getItem('mv_showprice') || 'false') as boolean,
  activeChips: { promo: false, full: false, confoto: false, nofoto: false } as ActiveChips,
  editingId: null as string | null,
  saving: false,
  pendingFiles: { 1: null, 2: null, 3: null, 4: null } as Record<number, File | null>,
  pendingURLs: { 1: null, 2: null, 3: null, 4: null } as Record<number, string | null>,
  pendingImport: [] as Can[],
  lbCanId: null as string | null,
  selectedForCompare: [] as string[],
  lbSlot: 1,
  lbZoom: { scale: 1, x: 0, y: 0 },
  currentView: 'grid' as string,
  PAGE_SIZE: 60,
  pageShown: 60,
  listSortKey: null as string | null,
  listSortDir: 1,
  lightTheme: JSON.parse(localStorage.getItem('mv_lighttheme') || 'false') as boolean,
  dragSrcSlot: null as number | null,
  detailCurrentId: null as string | null,
  deepLinkCanId: null as string | null,
  statsTlMode: 'months' as string,
  statsTlMetric: 'count' as string,
  deferredInstallPrompt: null as any,
  guestChosen: false,
};

// ── API / JWT ──────────────────────────────────────────
export const API = '';
export const JWT_KEY = 'mv_jwt_token';
let _accessToken: string | null = null;
let _refreshing: Promise<boolean> | null = null;

export function getToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

export function _tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(function (data: any) {
      if (data && data.accessToken) {
        _accessToken = data.accessToken;
        return true;
      }
      return false;
    })
    .catch(function () {
      _accessToken = null;
      return false;
    })
    .then(function (ok: boolean) {
      _refreshing = null;
      return ok;
    });
  return _refreshing;
}

export function apiCall(
  method: string,
  path: string,
  body?: any,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const headers = Object.assign(authHeaders(), extraHeaders || {});
  return fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined }).then(
    function (r) {
      if (r.status === 401 && _accessToken) {
        return _tryRefresh()
          .then(function (ok) {
            if (!ok) {
              _accessToken = null;
              state.isAdmin = false;
              document.body.classList.add('no-edit');
              (window as any).openAuthOverlay();
              const msg = document.getElementById('auth-required-msg');
              if (msg) {
                msg.textContent = 'Session expired. Please sign in again.';
                msg.style.display = 'block';
              }
              throw new Error('session_expired');
            }
            const retryHeaders = Object.assign(authHeaders(), extraHeaders || {});
            return fetch(API + path, {
              method,
              headers: retryHeaders,
              body: body ? JSON.stringify(body) : undefined,
            });
          })
          .then(function (r2: any) {
            if (!r2.ok) throw new Error(String(r2.status));
            return r2.status === 204 ? null : r2.json();
          });
      }
      if (r.status === 401) {
        state.isAdmin = false;
        document.body.classList.add('no-edit');
        (window as any).openAuthOverlay();
        const msg = document.getElementById('auth-required-msg');
        if (msg) {
          msg.textContent = 'Session expired. Please sign in again.';
          msg.style.display = 'block';
        }
        throw new Error('session_expired');
      }
      if (!r.ok) throw new Error(String(r.status));
      return r.status === 204 ? null : r.json();
    },
  );
}

// ── STATO NORMALIZE / COLORS ──────────────────────────
export const STATO_NORMALIZE: Record<string, string> = {
  'piccole bozze': 'Minor Dents',
  'Piccole bozze': 'Minor Dents',
  'Piccole Bozze': 'Minor Dents',
  'PICCOLE BOZZE': 'Minor Dents',
  danneggiata: 'Damaged',
  Danneggiata: 'Damaged',
  DANNEGGIATA: 'Damaged',
  'MINOR DENTS': 'Minor Dents',
  'minor dents': 'Minor Dents',
  'Minor dents': 'Minor Dents',
  DAMAGED: 'Damaged',
  damaged: 'Damaged',
  ok: 'OK',
  Ok: 'OK',
};

export function migrateStato(list: Can[]): Can[] {
  const changed: Can[] = [];
  list.forEach(function (c) {
    const m = STATO_NORMALIZE[c.stato || ''];
    if (m) {
      c.stato = m;
      changed.push(c);
    }
  });
  return changed;
}

export const STATO_COLORS: Record<string, string> = {
  OK: 'badge-stato-ok',
  Ok: 'badge-stato-ok',
  ok: 'badge-stato-ok',
  'MINOR DENTS': 'badge-stato-bozze',
  'Minor Dents': 'badge-stato-bozze',
  'minor dents': 'badge-stato-bozze',
  DAMAGED: 'badge-stato-danneggiata',
  Damaged: 'badge-stato-danneggiata',
  damaged: 'badge-stato-danneggiata',
  'PICCOLE BOZZE': 'badge-stato-bozze',
  'Piccole bozze': 'badge-stato-bozze',
  'piccole bozze': 'badge-stato-bozze',
  DANNEGGIATA: 'badge-stato-danneggiata',
  Danneggiata: 'badge-stato-danneggiata',
  danneggiata: 'badge-stato-danneggiata',
};

export const CHART_COLORS = [
  '#a8ff00',
  '#00d4ff',
  '#ff6b00',
  '#ff3cac',
  '#7b2fff',
  '#00ff9d',
  '#ffcc00',
  '#ff5555',
  '#00b8d9',
  '#b3e53d',
];

// ── COUNTRY FLAGS / ISO ───────────────────────────────
export const COUNTRY_FLAGS: Record<string, string> = {
  ITALY: 'IT',
  ITALIA: 'IT',
  ITALIAN: 'IT',
  ITALIANO: 'IT',
  GERMANY: 'DE',
  GERMANIA: 'DE',
  DEUTSCHLAND: 'DE',
  GERMAN: 'DE',
  TEDESCO: 'DE',
  FRANCE: 'FR',
  FRANCIA: 'FR',
  FRENCH: 'FR',
  FRANCESE: 'FR',
  SPAIN: 'ES',
  SPAGNA: 'ES',
  SPANISH: 'ES',
  SPAGNOLO: 'ES',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  ENGLAND: 'GB',
  'GRAN BRETAGNA': 'GB',
  BRITISH: 'GB',
  ENGLISH: 'GB',
  INGLESE: 'GB',
  PORTUGAL: 'PT',
  PORTOGALLO: 'PT',
  PORTUGUESE: 'PT',
  NETHERLANDS: 'NL',
  OLANDA: 'NL',
  HOLLAND: 'NL',
  'PAESI BASSI': 'NL',
  BELGIUM: 'BE',
  BELGIO: 'BE',
  LUXEMBOURG: 'LU',
  LUSSEMBURGO: 'LU',
  SWITZERLAND: 'CH',
  SVIZZERA: 'CH',
  SWISS: 'CH',
  AUSTRIA: 'AT',
  SWEDEN: 'SE',
  SVEZIA: 'SE',
  NORWAY: 'NO',
  NORVEGIA: 'NO',
  DENMARK: 'DK',
  DANIMARCA: 'DK',
  FINLAND: 'FI',
  FINLANDIA: 'FI',
  IRELAND: 'IE',
  IRLANDA: 'IE',
  ICELAND: 'IS',
  ISLANDA: 'IS',
  POLAND: 'PL',
  POLONIA: 'PL',
  POLSKA: 'PL',
  POLKA: 'PL',
  CZECH: 'CZ',
  CZECHIA: 'CZ',
  'CZECH REPUBLIC': 'CZ',
  'REPUBBLICA CECA': 'CZ',
  SLOVAKIA: 'SK',
  SLOVACCHIA: 'SK',
  HUNGARY: 'HU',
  UNGHERIA: 'HU',
  GREECE: 'GR',
  GRECIA: 'GR',
  ROMANIA: 'RO',
  BULGARIA: 'BG',
  CROATIA: 'HR',
  CROAZIA: 'HR',
  SERBIA: 'RS',
  SLOVENIA: 'SI',
  ESTONIA: 'EE',
  LATVIA: 'LV',
  LETTONIA: 'LV',
  LITHUANIA: 'LT',
  LITUANIA: 'LT',
  ALBANIA: 'AL',
  'NORTH MACEDONIA': 'MK',
  MACEDONIA: 'MK',
  BOSNIA: 'BA',
  MOLDOVA: 'MD',
  UKRAINE: 'UA',
  UCRAINA: 'UA',
  BELARUS: 'BY',
  BIELORUSSIA: 'BY',
  RUSSIA: 'RU',
  MALTA: 'MT',
  CYPRUS: 'CY',
  CIPRO: 'CY',
  USA: 'US',
  'UNITED STATES': 'US',
  AMERICA: 'US',
  'STATI UNITI': 'US',
  CANADA: 'CA',
  MEXICO: 'MX',
  MESSICO: 'MX',
  BRAZIL: 'BR',
  BRASILE: 'BR',
  BRASIL: 'BR',
  ARGENTINA: 'AR',
  CHILE: 'CL',
  COLOMBIA: 'CO',
  PERU: 'PE',
  VENEZUELA: 'VE',
  ECUADOR: 'EC',
  BOLIVIA: 'BO',
  PARAGUAY: 'PY',
  URUGUAY: 'UY',
  CUBA: 'CU',
  JAMAICA: 'JM',
  'PUERTO RICO': 'PR',
  TRINIDAD: 'TT',
  'TRINIDAD E TOBAGO': 'TT',
  'TRINIDAD AND TOBAGO': 'TT',
  'T&T': 'TT',
  'DOMINICAN REPUBLIC': 'DO',
  DOMINICAN: 'DO',
  'REPUBBLICA DOMINICANA': 'DO',
  'COSTA RICA': 'CR',
  PANAMA: 'PA',
  GUATEMALA: 'GT',
  JAPAN: 'JP',
  GIAPPONE: 'JP',
  CHINA: 'CN',
  CINA: 'CN',
  'SOUTH KOREA': 'KR',
  KOREA: 'KR',
  COREA: 'KR',
  INDIA: 'IN',
  AUSTRALIA: 'AU',
  'NEW ZEALAND': 'NZ',
  'NUOVA ZELANDA': 'NZ',
  INDONESIA: 'ID',
  MALAYSIA: 'MY',
  MALASYA: 'MY',
  MALESIA: 'MY',
  THAILAND: 'TH',
  TAILANDIA: 'TH',
  VIETNAM: 'VN',
  PHILIPPINES: 'PH',
  FILIPPINE: 'PH',
  SINGAPORE: 'SG',
  TAIWAN: 'TW',
  'HONG KONG': 'HK',
  CAMBODIA: 'KH',
  CAMBOGIA: 'KH',
  MYANMAR: 'MM',
  BURMA: 'MM',
  BIRMANIA: 'MM',
  BRUNEI: 'BN',
  MONGOLIA: 'MN',
  PAKISTAN: 'PK',
  AFGHANISTAN: 'AF',
  BANGLADESH: 'BD',
  'SRI LANKA': 'LK',
  TURKEY: 'TR',
  TURCHIA: 'TR',
  ISRAEL: 'IL',
  ISRAELE: 'IL',
  'SAUDI ARABIA': 'SA',
  'ARABIA SAUDITA': 'SA',
  UAE: 'AE',
  EMIRATI: 'AE',
  DUBAI: 'AE',
  JORDAN: 'JO',
  JORDANIA: 'JO',
  GIORDANIA: 'JO',
  QATAR: 'QA',
  IRAN: 'IR',
  EGYPT: 'EG',
  EGITTO: 'EG',
  MOROCCO: 'MA',
  MAROCCO: 'MA',
  NIGERIA: 'NG',
  KENYA: 'KE',
  'SOUTH AFRICA': 'ZA',
  SUDAFRICA: 'ZA',
  GEORGIA: 'GE',
  ARMENIA: 'AM',
  AZERBAIJAN: 'AZ',
  KAZAKHSTAN: 'KZ',
  KAZAKISTAN: 'KZ',
  UZBEKISTAN: 'UZ',
  JA: 'JP',
  KO: 'KR',
  ZH: 'CN',
  CS: 'CZ',
  SL: 'SI',
  SR: 'RS',
};

export const ISO_NAMES: Record<string, string> = {
  AF: 'Afghanistan',
  AL: 'Albania',
  AE: 'UAE',
  AM: 'Armenia',
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  AZ: 'Azerbaijan',
  BA: 'Bosnia',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BN: 'Brunei',
  BO: 'Bolivia',
  BR: 'Brazil',
  BY: 'Belarus',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CY: 'Cyprus',
  CZ: 'Czech Rep.',
  DE: 'Germany',
  DK: 'Denmark',
  DO: 'Dominican Rep.',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  ES: 'Spain',
  EU: 'Europe',
  FI: 'Finland',
  FR: 'France',
  GB: 'UK',
  GE: 'Georgia',
  GR: 'Greece',
  GT: 'Guatemala',
  HK: 'Hong Kong',
  HR: 'Croatia',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KH: 'Cambodia',
  KR: 'South Korea',
  KZ: 'Kazakhstan',
  LK: 'Sri Lanka',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MA: 'Morocco',
  MD: 'Moldova',
  MK: 'N. Macedonia',
  MM: 'Myanmar',
  MN: 'Mongolia',
  MT: 'Malta',
  MX: 'Mexico',
  MY: 'Malaysia',
  NG: 'Nigeria',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  PA: 'Panama',
  PE: 'Peru',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PR: 'Puerto Rico',
  PT: 'Portugal',
  PY: 'Paraguay',
  QA: 'Qatar',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  SA: 'Saudi Arabia',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TH: 'Thailand',
  TT: 'Trinidad & Tobago',
  TR: 'Turkey',
  TW: 'Taiwan',
  UA: 'Ukraine',
  US: 'USA',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VE: 'Venezuela',
  VN: 'Vietnam',
  ZA: 'South Africa',
};

export const CUSTOM_FLAGS: Record<string, { url?: string; emoji?: string; name: string }> = {
  UTAH: { url: 'https://flagcdn.com/20x15/us-ut.png', name: 'Utah, USA' },
  CARIBBEAN: { emoji: '\u{1F3DD}️', name: 'Caribbean' },
};

export function flagBlock(iso: string): string {
  const name = ISO_NAMES[iso.toUpperCase()] || iso;
  return (
    '<img src="https://flagcdn.com/16x12/' +
    iso.toLowerCase() +
    '.png" alt="' +
    esc(iso) +
    '" style="display:inline-block;vertical-align:middle;border-radius:1px;margin-right:3px" loading="lazy" onerror="this.style.display=\'none\'"><span style="font-size:10px;vertical-align:middle">' +
    esc(name) +
    '</span>'
  );
}

export function linguaToFlags(lingua: string | undefined): string {
  if (!lingua) return '';
  if (lingua.trim().toUpperCase() === 'BENELUX')
    return (
      [
        ['BE', 'Belgium'],
        ['NL', 'Netherlands'],
        ['LU', 'Luxembourg'],
      ] as [string, string][]
    )
      .map(function (p) {
        return (
          '<img src="https://flagcdn.com/16x12/' +
          p[0].toLowerCase() +
          '.png" alt="' +
          p[0] +
          '" style="display:inline-block;vertical-align:middle;border-radius:1px;margin-right:3px" loading="lazy"><span style="font-size:10px;vertical-align:middle">' +
          p[1] +
          '</span>'
        );
      })
      .join('<span style="color:var(--text3)"> / </span>');

  let out = '',
    cur = '';
  const L = lingua;

  function flush() {
    const t = cur.trim(),
      up = t.toUpperCase();
    cur = '';
    if (!t) return;
    const cf = CUSTOM_FLAGS[up];
    if (cf) {
      const icon = cf.url
        ? '<img src="' +
          cf.url +
          '" alt="' +
          esc(cf.name) +
          '" style="display:inline-block;vertical-align:middle;border-radius:1px;height:12px;margin-right:3px" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<span style="font-size:13px;vertical-align:middle;margin-right:3px">' +
          cf.emoji +
          '</span>';
      out +=
        icon + '<span style="font-size:10px;vertical-align:middle">' + esc(cf.name) + '</span>';
      return;
    }
    const iso = COUNTRY_FLAGS[up];
    if (iso) {
      out += flagBlock(iso);
      return;
    }
    if (/^[A-Z]{2}$/.test(up)) {
      out += flagBlock(up);
      return;
    }
    out += esc(t);
  }

  let i = 0;
  while (i < L.length) {
    if (L[i] === '-' && L[i + 1] === '>') {
      flush();
      out += '<span style="color:var(--text3)">→</span>';
      i += 2;
    } else if (L[i] === '→') {
      flush();
      out += '<span style="color:var(--text3)">→</span>';
      i++;
    } else if (L[i] === '/') {
      flush();
      out += '<span style="color:var(--text3)"> / </span>';
      i++;
    } else if (L[i] === '-') {
      flush();
      out += '<span style="color:var(--text3)"> / </span>';
      i++;
    } else {
      cur += L[i];
      i++;
    }
  }
  flush();
  return out;
}

// ── UTILS ──────────────────────────────────────────────
export function esc(s: any): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function jsq(v: any): string {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\x27')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');
}

export function colorizeTop(v: any): string {
  const MAP: Record<string, string> = {
    black: 'color:#000;text-shadow:0 0 3px #999',
    nero: 'color:#000;text-shadow:0 0 3px #999',
    white: 'color:#fff;text-shadow:0 0 3px #555',
    bianco: 'color:#fff;text-shadow:0 0 3px #555',
    silver: 'color:#c0c0c0',
    argento: 'color:#c0c0c0',
    grey: 'color:#9e9e9e',
    gray: 'color:#9e9e9e',
    grigio: 'color:#9e9e9e',
    gold: 'color:#ffd700',
    oro: 'color:#ffd700',
    orange: 'color:#ff8c00',
    arancione: 'color:#ff8c00',
    arancio: 'color:#ff8c00',
    green: 'color:#2ecc40',
    verde: 'color:#2ecc40',
    lime: 'color:#a8ff00',
    red: 'color:#ff4136',
    rosso: 'color:#ff4136',
    maroon: 'color:#c0506e',
    blue: 'color:#4da3ff',
    blu: 'color:#4da3ff',
    navy: 'color:#5b7bd5',
    teal: 'color:#14b8a6',
    cyan: 'color:#22d3ee',
    yellow: 'color:#ffdc00',
    giallo: 'color:#ffdc00',
    purple: 'color:#b07cff',
    viola: 'color:#b07cff',
    magenta: 'color:#e879f9',
    pink: 'color:#ff7eb6',
    rosa: 'color:#ff7eb6',
    brown: 'color:#b5651d',
    marrone: 'color:#b5651d',
    copper: 'color:#b87333',
    rame: 'color:#b87333',
    bronze: 'color:#cd7f32',
    bronzo: 'color:#cd7f32',
    cream: 'color:#f1e9d2',
  };
  if (v == null || v === '') return '';
  const parts = String(v).split('/');
  let out = esc(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    const css = MAP[parts[i].trim().toLowerCase()];
    out += '/' + (css ? '<span style="' + css + '">' + esc(parts[i]) + '</span>' : esc(parts[i]));
  }
  return out;
}

export function topBg(top: any): string {
  if (!top) return '';
  const first = String(top).split('/')[0].trim().toLowerCase();
  const BG: Record<string, string> = {
    black: '#111',
    nero: '#111',
    white: '#eee',
    bianco: '#eee',
    gold: '#caa62e',
    oro: '#caa62e',
    orange: '#e67e00',
    arancione: '#e67e00',
    arancio: '#e67e00',
    green: '#1f8f3a',
    verde: '#1f8f3a',
    lime: '#7bbf00',
    red: '#c0392b',
    rosso: '#c0392b',
    maroon: '#7d2b3e',
    blue: '#1f6fd6',
    blu: '#1f6fd6',
    navy: '#2a3f8f',
    teal: '#0f8a7e',
    cyan: '#0e9bb5',
    yellow: '#d4b500',
    giallo: '#d4b500',
    purple: '#6c3fb5',
    viola: '#6c3fb5',
    magenta: '#b13fc4',
    pink: '#cf5a93',
    rosa: '#cf5a93',
    brown: '#7a4a1e',
    marrone: '#7a4a1e',
    copper: '#8a5320',
    rame: '#8a5320',
    bronze: '#8a6224',
    bronzo: '#8a6224',
    cream: '#d9cba8',
  };
  const bg = BG[first];
  if (!bg) return '';
  const light: Record<string, number> = {
    white: 1,
    bianco: 1,
    yellow: 1,
    giallo: 1,
    cream: 1,
    lime: 1,
    gold: 1,
    oro: 1,
  };
  return 'background:' + bg + ';color:' + (light[first] ? '#111' : '#fff') + ';';
}

export function updateTopPreview(): void {
  const el = document.getElementById('e-top') as HTMLInputElement | null;
  const pv = document.getElementById('e-top-preview');
  if (el && pv) pv.innerHTML = colorizeTop(el.value);
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.remove('open');
}

export function toastUndo(msg: string, onUndo: () => void, durationMs?: number): HTMLDivElement {
  durationMs = durationMs || 10000;
  const el = document.createElement('div');
  el.className = 'toast toast-undo';
  el.innerHTML =
    '<span>' +
    esc(msg) +
    '</span>' +
    '<button class="toast-undo-btn" onclick="this._undo()">Undo</button>' +
    '<div class="toast-progress"><div class="toast-progress-bar" style="animation-duration:' +
    durationMs +
    'ms"></div></div>';
  const undoBtn = el.querySelector('.toast-undo-btn') as any;
  undoBtn._undo = function () {
    clearTimeout((el as any)._timer);
    el.remove();
    onUndo();
  };
  document.getElementById('toasts')!.appendChild(el);
  (el as any)._timer = setTimeout(function () {
    el.remove();
  }, durationMs);
  return el;
}

export function toast(msg: string, err?: boolean): void {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  document.getElementById('toasts')!.appendChild(el);
  setTimeout(function () {
    el.remove();
  }, 3500);
}

export function cloudinaryThumb(
  url: string | undefined,
  w?: number,
  h?: number,
): string | undefined {
  if (!url || url.indexOf('cloudinary.com') === -1) return url;
  return url.replace(
    '/upload/',
    '/upload/c_fit,w_' + (w || 400) + ',h_' + (h || 400) + ',f_auto,q_auto/',
  );
}

export function cloudinaryLqip(url: string | undefined): string {
  if (!url || url.indexOf('cloudinary.com') === -1) return '';
  return url.replace('/upload/', '/upload/w_20,e_blur:200,q_auto,f_auto/');
}

export function extractYearFromCan(c: Can): number | null {
  const s = String(c.sku == null ? '' : c.sku).trim();
  if (!/^\d{3,4}$/.test(s)) return null;
  const mm = parseInt(s.slice(0, 2), 10);
  if (mm < 1 || mm > 12) return null;
  return 2000 + parseInt(s.slice(2), 10);
}

export function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ── STATS (pure functions) ────────────────────────────
export function statsFreq(field: string, limit?: number): { k: string; n: number }[] {
  const map: Record<string, number> = {};
  state.cans.forEach(function (c: any) {
    const v = c[field];
    if (v) {
      map[v] = (map[v] || 0) + 1;
    }
  });
  return Object.keys(map)
    .map(function (k) {
      return { k, n: map[k] };
    })
    .sort(function (a, b) {
      return b.n - a.n;
    })
    .slice(0, limit || 20);
}

export function buildStatsData(): {
  total: number;
  withPhoto: number;
  promo: number;
  fullCans: number;
  pct: number;
} {
  const total = state.cans.length;
  const withPhoto = state.cans.filter(function (c) {
    return !!c.p1;
  }).length;
  const promo = state.cans.filter(function (c) {
    return !!c.promo;
  }).length;
  const fullCans = state.cans.filter(function (c) {
    return !!(c.note && c.note.toUpperCase().indexOf('FULL') !== -1);
  }).length;
  const pct = total ? Math.round((withPhoto / total) * 100) : 0;
  return { total, withPhoto, promo, fullCans, pct };
}

export function buildTimelineData(): { k: string; n: number; v: number }[] {
  const months: Record<string, { n: number; v: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')] = { n: 0, v: 0 };
  }
  state.cans.forEach(function (c) {
    if (!c.updatedAt) return;
    const key = new Date(c.updatedAt).toISOString().slice(0, 7);
    if (Object.prototype.hasOwnProperty.call(months, key)) {
      months[key].n++;
      months[key].v += parseFloat(c.valore || '0') || 0;
    }
  });
  return Object.keys(months)
    .sort()
    .map(function (k) {
      return { k, n: months[k].n, v: months[k].v };
    });
}

export function buildYearlyData(): { k: string; n: number; v: number }[] {
  const years: Record<string, { n: number; v: number }> = {};
  state.cans.forEach(function (c) {
    if (!c.updatedAt) return;
    const y = String(new Date(c.updatedAt).getFullYear());
    if (!years[y]) years[y] = { n: 0, v: 0 };
    years[y].n++;
    years[y].v += parseFloat(c.valore || '0') || 0;
  });
  return Object.keys(years)
    .sort()
    .map(function (k) {
      return { k, n: years[k].n, v: years[k].v };
    });
}

export function setTimelineMode(mode: string): void {
  state.statsTlMode = mode;
  refreshTimelineChart('[data-mode]', 'data-mode', mode);
}

export function setTimelineMetric(metric: string): void {
  state.statsTlMetric = metric;
  refreshTimelineChart('[data-metric]', 'data-metric', metric);
}

function refreshTimelineChart(sel: string, attr: string, val: string): void {
  const c = document.getElementById('tl-chart');
  if (c) c.innerHTML = renderTimelineChart();
  document.querySelectorAll(sel).forEach(function (b) {
    b.classList.toggle('active', b.getAttribute(attr) === val);
  });
}

export function renderTimelineChart(): string {
  const isYears = state.statsTlMode === 'years',
    isValue = state.statsTlMetric === 'value';
  const data = isYears ? buildYearlyData() : buildTimelineData();
  if (!data.length)
    return '<div style="font-size:12px;color:var(--text3);padding:16px 0">No dated cans yet.</div>';
  const pick = function (d: { n: number; v: number }) {
    return isValue ? d.v : d.n;
  };
  const fmt = function (d: { n: number; v: number }) {
    return isValue ? (d.v ? '€' + Math.round(d.v) : '') : d.n || '';
  };
  const ttl = function (d: { n: number; v: number }) {
    return isValue ? '€' + Math.round(d.v) : d.n + ' cans';
  };
  const maxVal = Math.max.apply(null, data.map(pick)) || 1;
  const BW = isYears ? 44 : 32,
    GAP = 6,
    BARH = 80,
    LABELH = 20;
  const totalW = data.length * (BW + GAP) - GAP;
  const bars = data
    .map(function (d, i) {
      const v = pick(d),
        h = Math.max(3, (v / maxVal) * BARH),
        x = i * (BW + GAP),
        y = BARH - h;
      const label = isYears ? d.k : d.k.slice(5) + '/' + d.k.slice(2, 4);
      return (
        '<g class="tl-bar">' +
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        BW +
        '" height="' +
        h +
        '" rx="3"' +
        ' fill="var(--green)" fill-opacity="' +
        (v ? 0.85 : 0.15) +
        '">' +
        '<title>' +
        esc(d.k) +
        ': ' +
        ttl(d) +
        '</title></rect>' +
        (v
          ? '<text x="' +
            (x + BW / 2) +
            '" y="' +
            (y - 5) +
            '" text-anchor="middle" font-size="9" fill="var(--green)">' +
            fmt(d) +
            '</text>'
          : '') +
        '<text x="' +
        (x + BW / 2) +
        '" y="' +
        (BARH + LABELH - 2) +
        '" text-anchor="middle" font-size="' +
        (isYears ? 9 : 8) +
        '" fill="var(--text3)">' +
        esc(label) +
        '</text>' +
        '</g>'
      );
    })
    .join('');
  return (
    '<svg viewBox="0 0 ' +
    totalW +
    ' ' +
    (BARH + LABELH) +
    '" style="min-width:' +
    totalW +
    'px;height:' +
    (BARH + LABELH) +
    'px;display:block">' +
    bars +
    '</svg>'
  );
}

export function renderTimeline(): string {
  if (
    !state.cans.some(function (c) {
      return !!c.updatedAt;
    })
  )
    return '';
  function modeTab(m: string, l: string) {
    return (
      '<button class="tl-tab' +
      (state.statsTlMode === m ? ' active' : '') +
      '" data-mode="' +
      m +
      '" onclick="setTimelineMode(\'' +
      m +
      '\')">' +
      l +
      '</button>'
    );
  }
  function metricTab(m: string, l: string) {
    return (
      '<button class="tl-tab' +
      (state.statsTlMetric === m ? ' active' : '') +
      '" data-metric="' +
      m +
      '" onclick="setTimelineMetric(\'' +
      m +
      '\')">' +
      l +
      '</button>'
    );
  }
  return (
    '<div class="chart-section">' +
    '<div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
    '<span>Added over time<span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:8px">based on last update</span></span>' +
    '<span style="display:inline-flex;gap:10px;flex-wrap:wrap">' +
    '<span class="tl-tabs">' +
    metricTab('count', 'Count') +
    metricTab('value', '€ Value') +
    '</span>' +
    '<span class="tl-tabs">' +
    modeTab('months', '12 months') +
    modeTab('years', 'By year') +
    '</span>' +
    '</span></div>' +
    '<div id="tl-chart" style="overflow-x:auto;padding:4px 0">' +
    renderTimelineChart() +
    '</div></div>'
  );
}

// ── AUTH UI ────────────────────────────────────────────
export function applyAuthUI(): void {
  const admin = state.isAdmin && !state.isPublicMode;
  ['btn-export', 'btn-import', 'btn-clean', 'btn-calc', 'btn-add'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = admin ? 'inline-flex' : 'none';
  });
  const helpBtn = document.getElementById('btn-help');
  if (helpBtn) helpBtn.style.display = 'inline-flex';
  const hu = document.getElementById('header-user');
  const bl = document.getElementById('btn-login');
  if (state.isAdmin && !state.isPublicMode) {
    if (hu) hu.style.display = 'flex';
    if (bl) bl.style.display = 'none';
    const un = document.getElementById('user-name');
    if (un) un.textContent = 'RedMghost';
  } else if (!state.isPublicMode && !state.isAdmin) {
    if (hu) hu.style.display = 'none';
    if (bl) bl.style.display = 'inline-flex';
  } else {
    if (hu) hu.style.display = 'none';
    if (bl) bl.style.display = state.isPublicMode && !state.isAdmin ? 'inline-flex' : 'none';
  }
  document.body.classList.toggle('no-edit', !admin);
}

export function togglePwVisibility(): void {
  const inp = document.getElementById('auth-password') as HTMLInputElement;
  const icon = document.getElementById('pw-eye-icon');
  if (!inp || !icon) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  icon.innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

export function signIn(): void {
  const username = (document.getElementById('auth-username') as HTMLInputElement).value.trim();
  const password = (document.getElementById('auth-password') as HTMLInputElement).value;
  const msg = document.getElementById('auth-required-msg')!;
  const btn = document.getElementById('auth-submit-btn') as HTMLButtonElement;
  const coldMsg = document.getElementById('auth-cold-msg');
  msg.style.display = 'none';
  if (coldMsg) coldMsg.style.display = 'none';
  if (!username || !password) {
    msg.textContent = 'Enter username and password';
    msg.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const coldTimer = setTimeout(function () {
    if (coldMsg) coldMsg.style.display = 'block';
  }, 5000);

  function loginFetch(attempt: number): Promise<any> {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(function (r) {
      if (r.status >= 500 && attempt < 3) {
        return new Promise<void>(function (res) {
          setTimeout(res, 3000);
        }).then(function () {
          return loginFetch(attempt + 1);
        });
      }
      if (!r.ok) throw new Error('invalid');
      return r.json();
    });
  }

  loginFetch(1)
    .then(function (data: any) {
      clearTimeout(coldTimer);
      if (coldMsg) coldMsg.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Sign in';
      _accessToken = data.accessToken;
      localStorage.removeItem(JWT_KEY);
      state.guestChosen = false;
      state.isAdmin = true;
      const overlay = document.getElementById('auth-overlay');
      if (overlay) overlay.style.display = 'none';
      (window as any).restoreAdminMode();
      applyAuthUI();
      if (!state.cans.length) (window as any).loadFromServer();
    })
    .catch(function () {
      clearTimeout(coldTimer);
      if (coldMsg) coldMsg.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Sign in';
      msg.textContent = 'Invalid username or password';
      msg.style.display = 'block';
    });
}

export function signOut(): void {
  _accessToken = null;
  localStorage.removeItem(JWT_KEY);
  // Wait for logout to complete so the browser processes the cookie-clearing
  // Set-Cookie BEFORE reloading; otherwise the reload cancels the request and
  // the refresh cookie survives, re-logging the user in at boot.
  fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    .catch(function () {})
    .finally(function () {
      window.location.reload();
    });
}

// ── JWT SILENT REFRESH ─────────────────────────────────
export function checkAndRefreshToken(): void {
  const token = getToken();
  if (!token || !state.isAdmin) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return;
    const remaining = payload.exp * 1000 - Date.now();
    if (remaining <= 0) return;
    if (remaining < 2 * 60 * 1000) {
      _tryRefresh().then(function (ok) {
        if (!ok) {
          state.isAdmin = false;
          applyAuthUI();
        }
      });
    }
  } catch (_e) {
    /* ignore */
  }
}

export function continueAsGuest(explicit = true): void {
  // explicit = user clicked "Continue as guest" → drop any admin session and
  // prevent the boot cookie-refresh from silently re-promoting to admin.
  // explicit = false = same-tab reload default; let the cookie decide.
  if (explicit) {
    state.guestChosen = true;
    state.isAdmin = false;
  }
  state.isPublicMode = true;
  document.body.classList.add('public-mode');
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
  const sortSel = document.getElementById('sort-select') as HTMLSelectElement | null;
  if (sortSel) {
    ['valore-desc', 'valore-asc'].forEach(function (v) {
      const opt = sortSel.querySelector('option[value="' + v + '"]');
      if (opt) opt.remove();
    });
  }
  applyAuthUI();
}

// ── THEME ──────────────────────────────────────────────
export function toggleTheme(): void {
  state.lightTheme = !state.lightTheme;
  localStorage.setItem('mv_lighttheme', JSON.stringify(state.lightTheme));
  document.body.classList.toggle('light', state.lightTheme);
}

// ── CACHE ──────────────────────────────────────────────
export const MV_CACHE_KEY = 'mv_cache';
export const MV_FILTERS_KEY = 'mv_filters';
export const MV_VIEWS_KEY = 'mv_views';

export function saveCache(): void {
  try {
    localStorage.setItem(MV_CACHE_KEY, JSON.stringify({ ts: Date.now(), cans: state.cans }));
  } catch (_e) {
    /* ignore */
  }
}

export function loadFromCache(): Can[] | null {
  try {
    const cached = JSON.parse(localStorage.getItem(MV_CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.cans) && cached.cans.length) return cached.cans;
  } catch (_e) {
    /* ignore */
  }
  return null;
}

export function updateCacheBar(): void {
  const el = document.getElementById('cache-info');
  if (!el) return;
  try {
    const c = JSON.parse(localStorage.getItem(MV_CACHE_KEY) || 'null');
    if (c && c.ts) {
      const d = new Date(c.ts);
      el.textContent =
        '· Updated ' +
        d.toLocaleDateString('en-US') +
        ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (_e) {
    /* ignore */
  }
}

// ── FILTERS (save/restore/views) ──────────────────────
export function saveFilters(): void {
  try {
    const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
    const filterFields = ['lingua', 'size', 'produttore', 'top'];
    const data: any = {
      q: (document.getElementById('search-input') as HTMLInputElement).value,
      sort: (document.getElementById('sort-select') as HTMLSelectElement).value,
      chips: JSON.parse(JSON.stringify(state.activeChips)),
      vmin: (document.getElementById('fl-vmin') as HTMLInputElement).value,
      vmax: (document.getElementById('fl-vmax') as HTMLInputElement).value,
    };
    filterKeys.forEach(function (id, i) {
      data[filterFields[i]] = (document.getElementById(id) as HTMLInputElement).value;
    });
    localStorage.setItem(MV_FILTERS_KEY, JSON.stringify(data));
  } catch (_e) {
    /* ignore */
  }
}

export function restoreFilters(): void {
  try {
    const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
    const filterFields = ['lingua', 'size', 'produttore', 'top'];
    const f = JSON.parse(localStorage.getItem(MV_FILTERS_KEY) || 'null') as FilterState | null;
    if (!f) {
      (document.getElementById('sort-select') as HTMLSelectElement).value = 'added-desc';
      state.activeChips.confoto = true;
      document.getElementById('chip-confoto')?.classList.add('active');
      return;
    }
    (document.getElementById('search-input') as HTMLInputElement).value = f.q || '';
    const OLD: Record<string, string> = {
      lingua: 'lng',
      size: 'sz',
      produttore: 'prod',
      top: 'top',
    };
    filterFields.forEach(function (field, i) {
      const val = (f as any)[field] || (f as any)[OLD[field]] || '';
      if (val) (document.getElementById(filterKeys[i]) as any).dataset.restore = val;
    });
    const sortEl = document.getElementById('sort-select') as HTMLSelectElement;
    if (f.sort && sortEl.querySelector('option[value="' + f.sort + '"]')) sortEl.value = f.sort;
    if (f.chips) {
      Object.keys(f.chips).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(state.activeChips, k)) {
          (state.activeChips as any)[k] = !!(f.chips as any)[k];
          const chip = document.getElementById('chip-' + k);
          if (chip) chip.classList.toggle('active', (state.activeChips as any)[k]);
        }
      });
    }
    const vminEl = document.getElementById('fl-vmin') as HTMLInputElement | null;
    const vmaxEl = document.getElementById('fl-vmax') as HTMLInputElement | null;
    if (vminEl) vminEl.value = f.vmin || '';
    if (vmaxEl) vmaxEl.value = f.vmax || '';
  } catch (_e) {
    /* ignore */
  }
}

export function getViews(): { name: string; state: FilterState }[] {
  try {
    return JSON.parse(localStorage.getItem(MV_VIEWS_KEY) || '[]');
  } catch (_e) {
    return [];
  }
}

export function setViews(v: { name: string; state: FilterState }[]): void {
  try {
    localStorage.setItem(MV_VIEWS_KEY, JSON.stringify(v));
  } catch (_e) {
    /* ignore */
  }
}

export function captureFilterState(): FilterState {
  const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
  const filterFields = ['lingua', 'size', 'produttore', 'top'];
  const data: any = {
    q: (document.getElementById('search-input') as HTMLInputElement).value,
    sort: (document.getElementById('sort-select') as HTMLSelectElement).value,
    chips: JSON.parse(JSON.stringify(state.activeChips)),
    vmin: (document.getElementById('fl-vmin') as HTMLInputElement).value,
    vmax: (document.getElementById('fl-vmax') as HTMLInputElement).value,
    ymin: (document.getElementById('fl-ymin') as HTMLInputElement).value,
    ymax: (document.getElementById('fl-ymax') as HTMLInputElement).value,
  };
  filterKeys.forEach(function (id, i) {
    data[filterFields[i]] = (document.getElementById(id) as HTMLInputElement).value;
  });
  return data as FilterState;
}

export function applyFilterState(f: FilterState | null): void {
  if (!f) return;
  const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
  const filterFields = ['lingua', 'size', 'produttore', 'top'];
  (document.getElementById('search-input') as HTMLInputElement).value = f.q || '';
  filterFields.forEach(function (field, i) {
    const el = document.getElementById(filterKeys[i]) as HTMLInputElement | null;
    if (el) el.value = (f as any)[field] || '';
  });
  const sortEl = document.getElementById('sort-select') as HTMLSelectElement;
  if (f.sort) {
    for (let si = 0; si < sortEl.options.length; si++) {
      if (sortEl.options[si].value === f.sort) {
        sortEl.value = f.sort;
        break;
      }
    }
  }
  Object.keys(state.activeChips).forEach(function (k) {
    (state.activeChips as any)[k] = !!(f.chips && (f.chips as any)[k]);
    const chip = document.getElementById('chip-' + k);
    if (chip) chip.classList.toggle('active', (state.activeChips as any)[k]);
  });
  (document.getElementById('fl-vmin') as HTMLInputElement).value = f.vmin != null ? f.vmin : '';
  (document.getElementById('fl-vmax') as HTMLInputElement).value = f.vmax != null ? f.vmax : '';
  (document.getElementById('fl-ymin') as HTMLInputElement).value = f.ymin != null ? f.ymin : '';
  (document.getElementById('fl-ymax') as HTMLInputElement).value = f.ymax != null ? f.ymax : '';
  (window as any).applyFilters();
}

export function saveCurrentView(): void {
  const name = (prompt('Name this view (e.g. "F1 editions", "To photograph"):') || '').trim();
  if (!name) return;
  const views = getViews().filter(function (v) {
    return v.name !== name;
  });
  views.push({ name, state: captureFilterState() });
  setViews(views);
  renderViewsMenu();
  toast('View "' + name + '" saved ✓');
}

export function applyView(name: string): void {
  const v = getViews().find(function (x) {
    return x.name === name;
  });
  if (v) {
    applyFilterState(v.state);
    closeViewsMenu();
    toast('View "' + name + '" applied');
  }
}

export function deleteView(name: string, ev?: Event): void {
  if (ev) ev.stopPropagation();
  setViews(
    getViews().filter(function (v) {
      return v.name !== name;
    }),
  );
  renderViewsMenu();
}

export function renderViewsMenu(): void {
  const menu = document.getElementById('views-menu');
  if (!menu) return;
  const views = getViews();
  let html = views
    .map(function (v) {
      return (
        '<div class="view-item" onclick="applyView(\'' +
        jsq(v.name) +
        '\')"><span>' +
        esc(v.name) +
        '</span><button class="view-del" title="Delete" onclick="deleteView(\'' +
        jsq(v.name) +
        '\',event)">✕</button></div>'
      );
    })
    .join('');
  if (!views.length) html = '<div class="view-empty">No saved views yet</div>';
  html += '<div class="view-item view-save" onclick="saveCurrentView()">＋ Save current view</div>';
  menu.innerHTML = html;
}

export function toggleViewsMenu(ev?: Event): void {
  if (ev) ev.stopPropagation();
  const m = document.getElementById('views-menu');
  if (!m) return;
  if (m.style.display === 'none') {
    renderViewsMenu();
    m.style.display = 'block';
  } else m.style.display = 'none';
}

export function closeViewsMenu(): void {
  const m = document.getElementById('views-menu');
  if (m) m.style.display = 'none';
}

// ── SERVER ─────────────────────────────────────────────
export const MOCK_CANS: Can[] = [
  {
    id: 'mock_001',
    nome: 'Monster Original',
    sku: 'MO-500-GRN',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'USA',
    top: 'Pull Tab',
    note: '',
    descrizione: 'The original green can.',
    valore: '2.50',
    stato: 'OK',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_002',
    nome: 'Monster Ultra White',
    sku: 'MU-500-WHT',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'USA',
    top: 'Pull Tab',
    note: '',
    descrizione: 'Zero sugar, ultra series.',
    valore: '2.50',
    stato: 'OK',
    promo: 'Promo2024',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_003',
    nome: 'Monster Mango Loco',
    sku: 'ML-500-MNG',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'USA',
    top: 'Pull Tab',
    note: '',
    descrizione: 'Tropical juice monster.',
    valore: '2.80',
    stato: 'MINOR DENTS',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_004',
    nome: 'Monster Pipeline Punch',
    sku: 'MP-500-PNK',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'USA',
    top: 'Pull Tab',
    note: 'FULL can — sealed',
    descrizione: 'Hawaiian Punch flavor.',
    valore: '3.00',
    stato: 'OK',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_005',
    nome: 'Monster Lewis Hamilton',
    sku: 'LH-500-BLK',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'GBR',
    top: 'Pull Tab',
    note: '',
    descrizione: 'Limited F1 edition.',
    valore: '5.00',
    stato: 'OK',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_006',
    nome: 'Monster Ultra Fiesta',
    sku: 'MF-355-ORN',
    produttore: 'Monster Beverage',
    size: '355ml',
    lingua: 'MEX',
    top: 'Stay Tab',
    note: '',
    descrizione: 'Mexican market edition.',
    valore: '4.50',
    stato: 'OK',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_007',
    nome: 'Monster Aussie Lemonade',
    sku: 'AL-500-YLW',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'AUS',
    top: 'Pull Tab',
    note: '',
    descrizione: 'Australian market, citrus.',
    valore: '6.00',
    stato: 'DAMAGED',
    promo: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
  {
    id: 'mock_008',
    nome: 'Monster Energy ITA',
    sku: 'ME-500-ITA',
    produttore: 'Monster Beverage',
    size: '500ml',
    lingua: 'ITA',
    top: 'Pull Tab',
    note: '',
    descrizione: 'Italian market can.',
    valore: '2.20',
    stato: 'OK',
    promo: 'Promo2023',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
  },
];

export const REFRESH_BTN_HTML =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Refresh';

export function saveCanFS(c: Can): Promise<any> {
  return apiCall('PUT', '/api/cans/' + c.id, c);
}
export function deleteCanFS(id: string): Promise<any> {
  return apiCall('DELETE', '/api/cans/' + id);
}
export function permanentDeleteCanFS(id: string): Promise<any> {
  return apiCall('DELETE', '/api/cans/' + id + '/permanent');
}
export function restoreCanFS(id: string): Promise<any> {
  return apiCall('PUT', '/api/cans/' + id + '/restore');
}
export function batchSaveFS(list: Can[], btn?: HTMLElement): Promise<any> {
  if (btn) btn.textContent = 'Saving ' + list.length + '...';
  return apiCall('POST', '/api/cans/batch', list);
}
export function batchDeleteAllFS(): Promise<any> {
  return apiCall('DELETE', '/api/cans', null, { 'X-Confirm-Delete': 'all' });
}

export function installApp(): void {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  state.deferredInstallPrompt.userChoice.then(function () {
    state.deferredInstallPrompt = null;
    const b = document.getElementById('btn-install');
    if (b) b.style.display = 'none';
  });
}
