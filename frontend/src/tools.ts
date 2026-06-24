// ── tools.ts — Stats, Calculator, Import/Export ─────────────────────────────
// Extracted from monolithic index.html into a typed ES module.

import type { Can } from './types';
import {
  state,
  esc,
  jsq,
  toast,
  closeModal,
  cloudinaryThumb,
  simpleHash,
  saveCache,
  batchSaveFS,
  batchDeleteAllFS,
  extractYearFromCan,
  STATO_COLORS,
  CHART_COLORS,
} from './core';

// ── Shortcuts into shared state ────────────────────────────────────────────
// These read from / write to the single mutable `state` object exported by core.
const getCans = (): Can[] => state.cans;
const getFiltered = (): Can[] => state.filteredList;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COUNTRY FLAGS / lingua helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const COUNTRY_FLAGS: Record<string, string> = {
  // Europe
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
  // Americas
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
  // Asia-Pacific
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
  // Middle East / Africa
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
  // Caucasus / Central Asia
  GEORGIA: 'GE',
  ARMENIA: 'AM',
  AZERBAIJAN: 'AZ',
  KAZAKHSTAN: 'KZ',
  KAZAKISTAN: 'KZ',
  UZBEKISTAN: 'UZ',
  // Language codes → country flag
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
    '" style="display:inline-block;vertical-align:middle;border-radius:1px;margin-right:3px" loading="lazy"' +
    ' onerror="this.style.display=\'none\'"><span style="font-size:10px;vertical-align:middle">' +
    esc(name) +
    '</span>'
  );
}

export function linguaToFlags(lingua: string): string {
  if (!lingua) return '';
  // BENELUX -> expand to 3 flags
  if (lingua.trim().toUpperCase() === 'BENELUX') {
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
          '" style="display:inline-block;vertical-align:middle;border-radius:1px;margin-right:3px" loading="lazy">' +
          '<span style="font-size:10px;vertical-align:middle">' +
          p[1] +
          '</span>'
        );
      })
      .join('<span style="color:var(--text3)"> / </span>');
  }
  // Parse char by char, splitting on ->, →, /, -
  let out = '',
    cur = '';
  let i = 0;
  const L = lingua;

  function flush(): void {
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
          '" style="display:inline-block;vertical-align:middle;border-radius:1px;height:12px;margin-right:3px" loading="lazy"' +
          ' onerror="this.style.display=\'none\'">'
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATS — pure functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Frequency count for a given field, sorted descending, top `limit`. */
export function statsFreq(field: string, limit?: number): { k: string; n: number }[] {
  const cans = getCans();
  const map: Record<string, number> = {};
  cans.forEach(function (c: any) {
    const v = c[field];
    if (v) {
      map[v] = (map[v] || 0) + 1;
    }
  });
  return Object.keys(map)
    .map(function (k) {
      return { k: k, n: map[k] };
    })
    .sort(function (a, b) {
      return b.n - a.n;
    })
    .slice(0, limit || 20);
}

/** Summary aggregation — pure object, no DOM dependency. */
export function buildStatsData(): {
  total: number;
  withPhoto: number;
  promo: number;
  fullCans: number;
  pct: number;
} {
  const cans = getCans();
  const total = cans.length;
  const withPhoto = cans.filter(function (c) {
    return c.p1 || c.p2 || c.p3 || c.p4;
  }).length;
  const promo = cans.filter(function (c) {
    return c.promo;
  }).length;
  const fullCans = cans.filter(function (c) {
    return c.note && c.note.toUpperCase().indexOf('FULL') !== -1;
  }).length;
  const pct = total ? Math.round((withPhoto / total) * 100) : 0;
  return { total, withPhoto, promo, fullCans, pct };
}

/** Timeline data — cans per month (last 12), count AND value (based on updatedAt). */
export function buildTimelineData(): { k: string; n: number; v: number }[] {
  const cans = getCans();
  const months: Record<string, { n: number; v: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')] = { n: 0, v: 0 };
  }
  cans.forEach(function (c: any) {
    if (!c.updatedAt) return;
    const key = new Date(c.updatedAt).toISOString().slice(0, 7);
    if (Object.prototype.hasOwnProperty.call(months, key)) {
      months[key].n++;
      months[key].v += parseFloat(c.valore) || 0;
    }
  });
  return Object.keys(months)
    .sort()
    .map(function (k) {
      return { k: k, n: months[k].n, v: months[k].v };
    });
}

/** Yearly timeline data — all-time, count AND value. */
export function buildYearlyData(): { k: string; n: number; v: number }[] {
  const cans = getCans();
  const years: Record<string, { n: number; v: number }> = {};
  cans.forEach(function (c: any) {
    if (!c.updatedAt) return;
    const y = new Date(c.updatedAt).getFullYear();
    if (!years[y]) years[y] = { n: 0, v: 0 };
    years[y].n++;
    years[y].v += parseFloat(c.valore) || 0;
  });
  return Object.keys(years)
    .sort()
    .map(function (k) {
      return { k: k, n: years[k].n, v: years[k].v };
    });
}

// Timeline state: period 'months'|'years' — metric 'count'|'value'
let statsTlMode: 'months' | 'years' = 'months';
let statsTlMetric: 'count' | 'value' = 'count';

export function setTimelineMode(mode: 'months' | 'years'): void {
  statsTlMode = mode;
  refreshTimelineChart('[data-mode]', 'data-mode', mode);
}

export function setTimelineMetric(metric: 'count' | 'value'): void {
  statsTlMetric = metric;
  refreshTimelineChart('[data-metric]', 'data-metric', metric);
}

function refreshTimelineChart(sel: string, attr: string, val: string): void {
  const c = document.getElementById('tl-chart');
  if (c) c.innerHTML = renderTimelineChart();
  document.querySelectorAll(sel).forEach(function (b) {
    b.classList.toggle('active', b.getAttribute(attr) === val);
  });
}

/** SVG bar chart for current period+metric — pure on cans, no DOM dependency. */
export function renderTimelineChart(): string {
  const isYears = statsTlMode === 'years';
  const isValue = statsTlMetric === 'value';
  const data = isYears ? buildYearlyData() : buildTimelineData();
  if (!data.length)
    return '<div style="font-size:12px;color:var(--text3);padding:16px 0">No dated cans yet.</div>';
  const pick = function (d: { v: number; n: number }) {
    return isValue ? d.v : d.n;
  };
  const fmt = function (d: { v: number; n: number }) {
    return isValue ? (d.v ? '€' + Math.round(d.v) : '') : d.n || '';
  };
  const ttl = function (d: { v: number; n: number }) {
    return isValue ? '€' + Math.round(d.v) : d.n + ' cans';
  };
  const maxVal = Math.max(...data.map(pick)) || 1;
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

/** Timeline section with period toggle (Months/Years) + metric toggle (Count/Value). */
export function renderTimeline(): string {
  const cans = getCans();
  if (
    !cans.some(function (c: any) {
      return c.updatedAt;
    })
  )
    return '';
  function modeTab(m: string, l: string) {
    return (
      '<button class="tl-tab' +
      (statsTlMode === m ? ' active' : '') +
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
      (statsTlMetric === m ? ' active' : '') +
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PRICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function refreshPrices(): void {
  document.querySelectorAll<HTMLElement>('.card-price').forEach(function (el) {
    el.style.display = state.showPrice && (el.dataset.val || '').trim() ? 'block' : 'none';
  });
  const d = state.showPrice ? '' : 'none';
  document.querySelectorAll<HTMLElement>('.td-price').forEach(function (el) {
    el.style.display = d;
  });
  const thV = document.querySelector<HTMLElement>('.th-valore');
  if (thV) thV.style.display = d;
}

export function mostraValore(): void {
  const cans = getCans();
  const tot = cans.reduce(function (s: number, c: any) {
    return s + (parseFloat(c.valore) || 0);
  }, 0);
  document.getElementById('stat-valore')!.textContent = '€' + tot.toLocaleString('en-US');
  document.getElementById('stat-valore')!.style.display = 'block';
  document.getElementById('stat-valore-lbl')!.style.display = 'block';
  document.getElementById('valore-btn')!.style.display = 'none';
  document.getElementById('valore-hide-btn')!.style.display = 'block';
}

export function nascondiValore(): void {
  document.getElementById('stat-valore')!.style.display = 'none';
  document.getElementById('stat-valore-lbl')!.style.display = 'none';
  document.getElementById('valore-hide-btn')!.style.display = 'none';
  document.getElementById('valore-btn')!.style.display = 'inline-block';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATS — DOM (chip counts + hero stats)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function updateChipCounts(): void {
  const cans = getCans();
  const counts: Record<string, number> = {
    promo: cans.filter(function (c) {
      return !!c.promo;
    }).length,
    full: cans.filter(function (c) {
      return !!(c.note && c.note.toUpperCase().indexOf('FULL') !== -1);
    }).length,
    confoto: cans.filter(function (c) {
      return !!c.p1;
    }).length,
    nofoto: cans.filter(function (c) {
      return !c.p1;
    }).length,
  };
  Object.keys(counts).forEach(function (k) {
    const el = document.getElementById('cnt-' + k);
    if (el) el.textContent = String(counts[k] || '');
  });
}

export function updateStats(): void {
  const cans = getCans();
  const n = cans.length;
  document.getElementById('count-num')!.textContent = String(n);
  if (!n) {
    document.getElementById('hero-sub')!.textContent = 'Import your Excel or add manually';
    document.getElementById('stats-row')!.style.display = 'none';
    return;
  }
  document.getElementById('hero-sub')!.textContent = n + ' cans in your collection';
  document.getElementById('stats-row')!.style.display = 'flex';
  document.getElementById('stat-total')!.textContent = String(n);
  document.getElementById('stat-paesi')!.textContent = String(
    new Set(
      cans
        .map(function (c) {
          return c.lingua;
        })
        .filter(Boolean),
    ).size,
  );
  document.getElementById('stat-foto')!.textContent = String(
    cans.filter(function (c) {
      return c.p1;
    }).length,
  );
  const fullCount = cans.filter(function (c) {
    return !!(c.note && c.note.toUpperCase().indexOf('FULL') !== -1);
  }).length;
  document.getElementById('stat-full')!.textContent = String(fullCount);
  document.getElementById('stat-valore')!.style.display = 'none';
  document.getElementById('stat-valore-lbl')!.style.display = 'none';
  document.getElementById('valore-btn')!.style.display = 'inline-block';
  document.getElementById('valore-hide-btn')!.style.display = 'none';
  updateChipCounts();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATS MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Top N cans by estimated value (excludes those without a value) — pure, testable. */
export function buildTopValue(list: Can[], n?: number): Can[] {
  return (list || [])
    .filter(function (c: any) {
      return (parseFloat(c.valore) || 0) > 0;
    })
    .sort(function (a: any, b: any) {
      return (parseFloat(b.valore) || 0) - (parseFloat(a.valore) || 0);
    })
    .slice(0, n || 10);
}

/** "Top most valuable" section of the Stats modal (admin only: contains euro values). */
export function renderTopValueHTML(rows: Can[]): string {
  if (!rows.length) return '';
  let html =
    '<div class="chart-section"><div class="chart-title">&#127942; Top ' +
    rows.length +
    ' most valuable</div><div>';
  rows.forEach(function (c: any, i: number) {
    html +=
      '<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer" onclick="closeModal(\'stats-modal\');openDetail(\'' +
      jsq(c.id) +
      '\')">' +
      '<span style="width:22px;text-align:right;color:var(--text3);font-size:11px">' +
      (i + 1) +
      '</span>' +
      (c.p1
        ? '<img src="' +
          esc(cloudinaryThumb(c.p1, 72, 72)) +
          '" style="width:36px;height:36px;object-fit:contain;background:var(--bg3);border-radius:6px" loading="lazy"/>'
        : '<span style="width:36px;height:36px;background:var(--bg3);border-radius:6px;display:inline-block;flex-shrink:0"></span>') +
      '<span style="flex:1;font-size:12.5px;font-weight:600">' +
      esc(c.nome || '—') +
      '<span style="color:var(--text3);font-weight:400;font-size:10.5px"> &middot; SKU ' +
      esc(c.sku || '—') +
      '</span></span>' +
      '<span style="color:var(--green);font-weight:700;font-size:12.5px">&euro;' +
      (parseFloat(c.valore as any) || 0).toLocaleString('en-US') +
      '</span></div>';
  });
  return html + '</div></div>';
}

export function openStatsModal(): void {
  const cans = getCans();
  const body = document.getElementById('stats-modal-body')!;
  body.innerHTML = '';

  function donutSVG(data: { k: string; n: number }[], total: number): string {
    const r = 56,
      cx = 70,
      cy = 70,
      circ = 2 * Math.PI * r;
    const parts: string[] = [];
    let offset = 0;
    data.slice(0, 10).forEach(function (d, i) {
      const frac = d.n / total,
        dash = frac * circ;
      parts.push(
        '<g><title>' +
          esc(d.k) +
          ': ' +
          d.n +
          '</title><circle cx="' +
          cx +
          '" cy="' +
          cy +
          '" r="' +
          r +
          '" fill="none" stroke="' +
          CHART_COLORS[i % CHART_COLORS.length] +
          '" stroke-width="20" stroke-dasharray="' +
          dash +
          ' ' +
          (circ - dash) +
          '" stroke-dashoffset="' +
          -(offset * circ) +
          '" transform="rotate(-90 ' +
          cx +
          ' ' +
          cy +
          ')" /></g>',
      );
      offset += frac;
    });
    return (
      '<svg viewBox="0 0 140 140" width="140" height="140" style="display:block">' +
      parts.join('') +
      '<circle cx="70" cy="70" r="46" fill="var(--bg2)"/><text x="70" y="66" text-anchor="middle" font-family="Bebas Neue,sans-serif" font-size="24" fill="var(--text)">' +
      total +
      '</text><text x="70" y="82" text-anchor="middle" font-size="10" fill="var(--text3)">total</text></svg>'
    );
  }

  function renderSection(
    title: string,
    data: { k: string; n: number }[],
    total: number,
    field: string,
  ): string {
    let html =
      '<div class="chart-section"><div class="chart-title">' +
      title +
      '</div><div class="donut-wrap">';
    html += '<div class="donut-canvas-wrap">' + donutSVG(data, total) + '</div>';
    html += '<div class="donut-legend">';
    data.slice(0, 10).forEach(function (d, i) {
      html +=
        '<div class="legend-item" style="cursor:pointer" onclick="statsFilter(\'' +
        jsq(field) +
        "','" +
        jsq(d.k) +
        '\')">' +
        '<span class="legend-dot" style="background:' +
        CHART_COLORS[i % CHART_COLORS.length] +
        '"></span>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        esc(d.k) +
        '</span>' +
        '<span class="legend-count">' +
        d.n +
        '</span><span style="margin-left:4px;color:var(--text3);font-size:10px">→</span></div>';
    });
    html += '</div></div><div class="bar-chart" style="margin-top:12px">';
    const maxBar = data[0] ? data[0].n : 1;
    data.slice(0, 15).forEach(function (d, i) {
      html +=
        '<div class="bar-row" style="cursor:pointer" onclick="statsFilter(\'' +
        jsq(field) +
        "','" +
        jsq(d.k) +
        '\')">' +
        '<span class="bar-label">' +
        esc(d.k) +
        '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' +
        (d.n / maxBar) * 100 +
        '%;background:' +
        CHART_COLORS[i % CHART_COLORS.length] +
        '"></div></div>' +
        '<span class="bar-count">' +
        d.n +
        '</span><span style="margin-left:4px;color:var(--text3);font-size:11px">→</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  const sd = buildStatsData();
  let html = '';

  // Summary tiles
  html +=
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">' +
    '<div style="flex:1;min-width:90px;background:var(--bg3);border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:700;color:var(--green)">' +
    sd.total +
    '</div><div style="font-size:10px;letter-spacing:.5px;color:var(--text3);margin-top:2px">TOTAL</div></div>' +
    '<div style="flex:1;min-width:90px;background:var(--bg3);border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="statsFilter(\'promo\',\'1\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'"><div style="font-size:26px;font-weight:700;color:#f5a623">' +
    sd.promo +
    '</div><div style="font-size:10px;letter-spacing:.5px;color:var(--text3);margin-top:2px">PROMO</div></div>' +
    '<div style="flex:1;min-width:90px;background:var(--bg3);border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="statsFilter(\'confoto\',\'1\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'"><div style="font-size:26px;font-weight:700;color:var(--green)">' +
    sd.pct +
    '%</div><div style="font-size:10px;letter-spacing:.5px;color:var(--text3);margin-top:2px">WITH PHOTO</div></div>' +
    '<div style="flex:1;min-width:90px;background:var(--bg3);border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="statsFilter(\'full\',\'1\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'"><div style="font-size:26px;font-weight:700;color:#8b5cf6">' +
    sd.fullCans +
    '</div><div style="font-size:10px;letter-spacing:.5px;color:var(--text3);margin-top:2px">FULL</div></div>' +
    '</div>';

  html += renderSection('By country / language', statsFreq('lingua', 15), sd.total, 'lingua');
  html += renderSection('By size', statsFreq('size', 15), sd.total, 'size');
  html += renderSection('By manufacturer', statsFreq('produttore', 15), sd.total, 'produttore');
  if (!state.isPublicMode) html += renderTopValueHTML(buildTopValue(cans, 10));

  html +=
    '<div class="chart-section"><div class="chart-title">Condition</div><div style="display:flex;gap:10px;flex-wrap:wrap;">';
  statsFreq('stato', 10).forEach(function (d) {
    const cls = (STATO_COLORS as any)[d.k] || 'badge-stato-ok';
    html +=
      '<div style="background:var(--bg3);border-radius:8px;padding:12px 18px;text-align:center;cursor:pointer" onclick="statsFilter(\'stato\',\'' +
      jsq(d.k) +
      '\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'">' +
      '<div style="font-size:22px;font-weight:700;margin-bottom:4px">' +
      d.n +
      '</div>' +
      '<span class="badge ' +
      cls +
      '">' +
      esc(d.k) +
      '</span>' +
      '<div style="font-size:10px;color:var(--text3);margin-top:4px">click →</div></div>';
  });
  html +=
    '<div style="background:var(--bg3);border-radius:8px;padding:12px 18px;text-align:center;cursor:pointer" onclick="statsFilter(\'confoto\',\'1\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'"><div style="font-size:22px;font-weight:700;margin-bottom:4px">' +
    sd.withPhoto +
    '</div><span class="badge badge-photo">With photo</span><div style="font-size:10px;color:var(--text3);margin-top:4px">click →</div></div>';
  html +=
    '<div style="background:var(--bg3);border-radius:8px;padding:12px 18px;text-align:center;cursor:pointer" onclick="statsFilter(\'nofoto\',\'1\')" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\'var(--bg3)\'"><div style="font-size:22px;font-weight:700;margin-bottom:4px">' +
    (sd.total - sd.withPhoto) +
    '</div><span class="badge" style="background:var(--bg4);color:var(--text3)">No photo</span><div style="font-size:10px;color:var(--text3);margin-top:4px">click →</div></div>';
  html +=
    '</div>' +
    '<div style="margin-top:12px;padding:14px;background:var(--bg3);border-radius:8px">' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span style="font-weight:600;color:var(--text)">Photo coverage</span><span style="color:var(--text3)">' +
    sd.withPhoto +
    ' / ' +
    sd.total +
    ' (' +
    sd.pct +
    '%)</span></div>' +
    '<div style="height:10px;background:var(--bg4);border-radius:5px;overflow:hidden"><div style="height:100%;width:' +
    sd.pct +
    '%;background:var(--green);border-radius:5px;transition:width .6s ease"></div></div>' +
    '</div>' +
    '</div></div>';

  // Timeline (admin only)
  if (!state.isPublicMode) html += renderTimeline();
  body.innerHTML = html;
  document.getElementById('stats-modal')!.classList.add('open');
}

// ponytail: duplicated from ui.ts to avoid circular import
const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
const filterFields = ['lingua', 'size', 'produttore', 'top'];

/** Close stats modal and apply a filter to the main grid. */
export function statsFilter(field: string, value: string): void {
  closeModal('stats-modal');
  (document.getElementById('search-input') as HTMLInputElement).value = '';
  filterKeys.forEach(function (id: string) {
    (document.getElementById(id) as HTMLSelectElement).value = '';
  });
  ['promo', 'full', 'confoto', 'nofoto'].forEach(function (k) {
    (state.activeChips as unknown as Record<string, boolean>)[k] = false;
    document.getElementById('chip-' + k)!.classList.remove('active');
  });
  if (field === 'stato') {
    (window as any).applyFilters();
    state.filteredList = getCans().filter(function (c) {
      return (c.stato || '') === value;
    });
    document.getElementById('grid-info')!.textContent =
      state.filteredList.length + ' of ' + getCans().length + ' cans';
    document.getElementById('reset-filters-btn')!.style.display = 'inline';
    const svBtn2 = document.getElementById('share-view-btn');
    if (svBtn2) (svBtn2 as HTMLElement).style.display = 'inline-block';
    (window as any).renderActiveView();
    window.scrollTo({
      top: document.getElementById('filter-bar')!.offsetTop - 70,
      behavior: 'smooth',
    });
    toast('Filter: ' + value + ' (' + state.filteredList.length + ' cans)');
    return;
  }
  const fieldIdx = filterFields.indexOf(field);
  if (fieldIdx >= 0) {
    (document.getElementById(filterKeys[fieldIdx]) as HTMLSelectElement).value = value;
  } else if (field === 'confoto') {
    state.activeChips.confoto = true;
    document.getElementById('chip-confoto')!.classList.add('active');
  } else if (field === 'nofoto') {
    state.activeChips.nofoto = true;
    document.getElementById('chip-nofoto')!.classList.add('active');
  } else if (field === 'promo') {
    state.activeChips.promo = true;
    document.getElementById('chip-promo')!.classList.add('active');
  } else if (field === 'full') {
    state.activeChips.full = true;
    document.getElementById('chip-full')!.classList.add('active');
  }
  (window as any).applyFilters();
  window.scrollTo({
    top: document.getElementById('filter-bar')!.offsetTop - 70,
    behavior: 'smooth',
  });
  toast('Filter: ' + value);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CALCOLATORE VALORE (value calculator — combinable AND filters + grouped sum)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Numeric value of a can (null if missing/non-numeric). */
export function calcVal(c: any): number | null {
  const v = parseFloat(c && c.valore != null ? c.valore : '');
  return isNaN(v) ? null : v;
}

/** Does a can satisfy ALL set criteria? (empty fields = ignored). Pure/testable. */
export function calcMatch(can: any, q?: any): boolean {
  if (!can) return false;
  q = q || {};
  if (q.gusto && (can.nome || '').toLowerCase().indexOf(q.gusto.toLowerCase()) === -1) return false;
  if (q.paese && (can.lingua || '').toLowerCase().indexOf(q.paese.toLowerCase()) === -1)
    return false;
  if (q.size && (can.size || '') !== q.size) return false;
  if (q.produttore && (can.produttore || '') !== q.produttore) return false;
  if (q.top && (can.top || '') !== q.top) return false;
  if (q.stato && (can.stato || '') !== q.stato) return false;
  if (q.full) {
    const f = (can.note || '').toUpperCase().indexOf('FULL') !== -1;
    if (q.full === 'yes' && !f) return false;
    if (q.full === 'no' && f) return false;
  }
  if (q.promo) {
    const p = !!can.promo;
    if (q.promo === 'yes' && !p) return false;
    if (q.promo === 'no' && p) return false;
  }
  if (q.foto) {
    const hp = !!(can.p1 || can.p2 || can.p3 || can.p4);
    if (q.foto === 'yes' && !hp) return false;
    if (q.foto === 'no' && hp) return false;
  }
  if (q.sku) {
    const s = (can.sku || '').toLowerCase(),
      k = q.sku.toLowerCase();
    if (q.skuOp === 'starts') {
      if (s.indexOf(k) !== 0) return false;
    } else if (q.skuOp === 'exact') {
      if (s !== k) return false;
    } else {
      if (s.indexOf(k) === -1) return false;
    }
  }
  if (q.yearFrom || q.yearTo) {
    const y = extractYearFromCan(can);
    if (y == null) return false;
    if (q.yearFrom && y < parseInt(q.yearFrom, 10)) return false;
    if (q.yearTo && y > parseInt(q.yearTo, 10)) return false;
  }
  return true;
}

export function calcFilter(list: any[], q: any): any[] {
  return (list || []).filter(function (c) {
    return calcMatch(c, q);
  });
}

/** Totals on a list (sum euro, count, avg, cans without value). Pure/testable. */
export function calcTotals(list: any[]): {
  count: number;
  total: number;
  valued: number;
  noValue: number;
  avg: number;
  min: number;
  max: number;
} {
  list = list || [];
  let total = 0,
    valued = 0,
    noValue = 0,
    min: number | null = null,
    max: number | null = null;
  list.forEach(function (c) {
    const v = calcVal(c);
    if (v == null) {
      noValue++;
      return;
    }
    total += v;
    valued++;
    if (min == null || v < min) min = v;
    if (max == null || v > max) max = v;
  });
  return {
    count: list.length,
    total,
    valued,
    noValue,
    avg: valued ? total / valued : 0,
    min: min || 0,
    max: max || 0,
  };
}

/** Grouping key for a can. Pure/testable. */
export function calcGroupKey(c: any, by: string): string {
  switch (by) {
    case 'nome':
      return c.nome || '—';
    case 'paese':
      return c.lingua || '—';
    case 'size':
      return c.size || '—';
    case 'produttore':
      return c.produttore || '—';
    case 'top':
      return c.top || '—';
    case 'stato':
      return c.stato || '—';
    case 'anno': {
      const y = extractYearFromCan(c);
      return y == null ? '—' : String(y);
    }
    default:
      return '';
  }
}

/** Group with subtotals, sorted by subtotal descending. Pure/testable. */
export function calcGroups(
  list: any[],
  by: string,
): { key: string; items: any[]; count: number; subtotal: number }[] {
  const map: Record<string, any[]> = {};
  (list || []).forEach(function (c) {
    const k = calcGroupKey(c, by);
    (map[k] = map[k] || []).push(c);
  });
  return Object.keys(map)
    .map(function (k) {
      const t = calcTotals(map[k]);
      return { key: k, items: map[k], count: map[k].length, subtotal: t.total };
    })
    .sort(function (a, b) {
      return b.subtotal - a.subtotal || b.count - a.count;
    });
}

/** Distinct values for a field (optionally splitting multi-nation strings). */
function calcDistinct(field: string, split?: boolean, list?: any[]): string[] {
  const set: Record<string, number> = {};
  (list || getCans()).forEach(function (c: any) {
    const v = c[field];
    if (!v) return;
    if (split) {
      String(v)
        .split(/->|→|[/-]/)
        .forEach(function (t: string) {
          t = t.trim();
          if (t) set[t] = 1;
        });
    } else {
      set[String(v).trim()] = 1;
    }
  });
  return Object.keys(set).sort(function (a, b) {
    return a.localeCompare(b);
  });
}

function calcFillSelect(id: string, values: string[]): void {
  const sel = document.getElementById(id) as HTMLSelectElement | null;
  if (!sel) return;
  const first = sel.querySelector('option');
  sel.innerHTML = '';
  if (first) sel.appendChild(first);
  values.forEach(function (v) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
}

function calcReadQuery(): any {
  return {
    gusto: (document.getElementById('calc-gusto') as HTMLInputElement).value.trim(),
    paese: (document.getElementById('calc-paese') as HTMLSelectElement).value,
    size: (document.getElementById('calc-size') as HTMLSelectElement).value,
    produttore: (document.getElementById('calc-prod') as HTMLSelectElement).value,
    top: (document.getElementById('calc-top') as HTMLSelectElement).value,
    stato: (document.getElementById('calc-stato') as HTMLSelectElement).value,
    full: (document.getElementById('calc-full') as HTMLSelectElement).value,
    promo: (document.getElementById('calc-promo') as HTMLSelectElement).value,
    foto: (document.getElementById('calc-foto') as HTMLSelectElement).value,
    sku: (document.getElementById('calc-sku') as HTMLInputElement).value.trim(),
    skuOp: (document.getElementById('calc-skuop') as HTMLSelectElement).value,
    yearFrom: (document.getElementById('calc-yfrom') as HTMLInputElement).value,
    yearTo: (document.getElementById('calc-yto') as HTMLInputElement).value,
  };
}

/** Refresh options: each select only shows values that, given OTHER active filters, still produce results. */
export function calcRefreshOptions(): void {
  const cans = getCans();
  let q = calcReadQuery();
  const selectDefs = [
    { id: 'calc-paese', key: 'paese', field: 'lingua', split: true },
    { id: 'calc-size', key: 'size', field: 'size' },
    { id: 'calc-prod', key: 'produttore', field: 'produttore' },
    { id: 'calc-top', key: 'top', field: 'top' },
    { id: 'calc-stato', key: 'stato', field: 'stato' },
  ];
  selectDefs.forEach(function (d: any) {
    const sub = Object.assign({}, q);
    sub[d.key] = '';
    const values = calcDistinct(d.field, !!d.split, calcFilter(cans, sub));
    const sel = document.getElementById(d.id) as HTMLSelectElement;
    const cur = sel.value;
    calcFillSelect(d.id, values);
    sel.value = values.indexOf(cur) !== -1 ? cur : '';
  });
  q = calcReadQuery(); // re-read after possible select resets above
  const toggleDefs = [
    { id: 'calc-full', key: 'full' },
    { id: 'calc-promo', key: 'promo' },
    { id: 'calc-foto', key: 'foto' },
  ];
  toggleDefs.forEach(function (t) {
    const base = Object.assign({}, q);
    (base as any)[t.key] = '';
    const sel = document.getElementById(t.id) as HTMLSelectElement;
    Array.prototype.forEach.call(sel.options, function (opt: HTMLOptionElement) {
      if (opt.value === '') {
        opt.disabled = false;
        return;
      }
      const test = Object.assign({}, base);
      (test as any)[t.key] = opt.value;
      opt.disabled = calcFilter(cans, test).length === 0;
    });
    if (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].disabled) sel.value = '';
  });
}

function calcRow(c: any): string {
  const v = calcVal(c);
  const thumb = c.p1
    ? '<img class="calc-thumb" src="' +
      cloudinaryThumb(c.p1, 80, 80) +
      '" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="calc-thumb"></span>';
  return (
    '<div class="calc-row" onclick="closeCalc();openDetail(\'' +
    jsq(c.id) +
    '\')">' +
    thumb +
    '<span class="calc-row-name">' +
    esc(c.nome || '—') +
    '</span>' +
    '<span class="calc-row-meta">' +
    esc([c.sku, c.size].filter(Boolean).join(' · ')) +
    '</span>' +
    '<span class="calc-row-val">' +
    (v == null ? '—' : '€' + v.toFixed(2)) +
    '</span>' +
    '</div>'
  );
}

export function calcRun(): void {
  const cans = getCans();
  calcRefreshOptions();
  const q = calcReadQuery();
  const list = calcFilter(cans, q);
  const t = calcTotals(list);
  document.getElementById('calc-summary')!.innerHTML =
    '<span class="calc-big">€' +
    t.total.toFixed(2) +
    '</span>' +
    '<span class="calc-sub">' +
    t.count +
    (t.count === 1 ? ' can' : ' cans') +
    (t.noValue ? ' · ' + t.noValue + ' without value' : '') +
    '</span>';
  const by = (document.getElementById('calc-group') as HTMLSelectElement).value;
  let html = '';
  if (!list.length) {
    html = '<div class="calc-empty">No cans match these filters.</div>';
  } else if (by) {
    calcGroups(list, by).forEach(function (g) {
      html +=
        '<div class="calc-group"><div class="calc-group-head"><span>' +
        esc(g.key) +
        '</span>' +
        '<span class="calc-group-tot">' +
        g.count +
        ' · €' +
        g.subtotal.toFixed(2) +
        '</span></div>' +
        g.items.map(calcRow).join('') +
        '</div>';
    });
  } else {
    html = list.map(calcRow).join('');
  }
  document.getElementById('calc-results')!.innerHTML = html;
}

export function calcReset(): void {
  ['calc-gusto', 'calc-sku', 'calc-yfrom', 'calc-yto'].forEach(function (id) {
    (document.getElementById(id) as HTMLInputElement).value = '';
  });
  [
    'calc-paese',
    'calc-size',
    'calc-prod',
    'calc-top',
    'calc-stato',
    'calc-full',
    'calc-promo',
    'calc-foto',
    'calc-group',
  ].forEach(function (id) {
    (document.getElementById(id) as HTMLSelectElement).value = '';
  });
  (document.getElementById('calc-skuop') as HTMLSelectElement).value = 'contains';
  calcRun();
}

export function openCalc(): void {
  document.getElementById('calc-panel')!.classList.add('open');
  calcRun();
}

export function closeCalc(): void {
  document.getElementById('calc-panel')!.classList.remove('open');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

declare const XLSX: any;

export function openExportModal(): void {
  document.getElementById('exp-total')!.textContent = String(getCans().length);
  document.getElementById('export-modal')!.classList.add('open');
}

export function exportExcel(all: boolean): void {
  const data = all ? getCans() : getFiltered();
  const rows = data.map(function (c: any) {
    return {
      MV_ID: c.id || '',
      NOME: c.nome || '',
      SKU: c.sku || '',
      PRODUTTORE: c.produttore || '',
      SIZE: c.size || '',
      LINGUA: c.lingua || '',
      'TOP/TAB': c.top || '',
      PROMO: c.promo || '',
      'VALORE (STIMA)': c.valore || '',
      OPENING: c.note || '',
      CONDITIONS: c.stato || '',
      'MORE INFO': c.descrizione || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monster Vault');
  XLSX.writeFile(wb, 'monster_vault_export.xlsx');
  closeModal('export-modal');
  toast('Export complete ✓');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  IMPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function openImportModal(): void {
  document.getElementById('import-modal')!.classList.add('open');
  document.getElementById('import-preview')!.style.display = 'none';
  document.getElementById('import-btn')!.style.display = 'none';
  (document.getElementById('excel-input') as HTMLInputElement).value = '';
  state.pendingImport = [];
}

export function handleExcelDrop(e: DragEvent): void {
  e.preventDefault();
  document.getElementById('drop-zone')!.classList.remove('dragover');
  const f = e.dataTransfer?.files[0];
  if (f) parseExcel(f);
}

export function handleExcelInput(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) parseExcel(f);
}

function parseExcel(file: File): void {
  const reader = new FileReader();
  reader.onload = function (ev: any) {
    const wb = XLSX.read(ev.target.result, { type: 'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let hIdx = 0;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      if (
        raw[i].some(function (cell: any) {
          return String(cell).toUpperCase().trim() === 'NOME';
        })
      ) {
        hIdx = i;
        break;
      }
    }
    const headers = raw[hIdx].map(function (h: any) {
      return String(h).trim();
    });
    const rows = raw
      .slice(hIdx + 1)
      .filter(function (r: any[]) {
        return r.some(function (c: any) {
          return c !== '';
        });
      })
      .map(function (r: any[]) {
        const o: any = {};
        headers.forEach(function (h: string, i: number) {
          o[h] = r[i] !== undefined ? r[i] : '';
        });
        return o;
      });

    function col(r: any, ...keys: string[]): string {
      for (let k = 0; k < keys.length; k++) {
        const found = Object.keys(r).find(function (rk) {
          return rk.toUpperCase().trim() === keys[k].toUpperCase().trim();
        });
        if (found && r[found] !== '' && r[found] !== undefined) return String(r[found]).trim();
      }
      return '';
    }

    state.pendingImport = rows
      .map(function (r: any) {
        const mvId = col(r, 'MV_ID', 'ID');
        const nome = col(r, 'NOME');
        const sku = col(r, 'SKU');
        const produttore = col(r, 'PRODUTTORE');
        const size = col(r, 'SIZE');
        const lingua = col(r, 'LINGUA');
        const promo = col(r, 'PROMO');
        const top = col(r, 'TOP/TAB', 'TOP', 'TAB');
        const note = col(r, 'OPENING', 'MORE INFO', 'Colonna1', 'NOTE', 'INFO');
        const valore = col(r, 'VALORE (STIMA)', 'VALORE', 'VALUE');
        const stato = col(r, 'CONDITIONS', 'Colonna2', 'STATO', 'STATUS') || 'OK';
        const descrizione = col(r, 'MORE INFO', 'DESCRIZIONE') || '';
        const id =
          mvId ||
          'can_' +
            simpleHash(
              [nome, sku, produttore, lingua, size, top, promo].join('||').toLowerCase().trim(),
            );
        return {
          id,
          nome,
          sku,
          produttore,
          size,
          lingua,
          promo,
          top,
          note,
          valore,
          stato,
          descrizione,
          p1: '',
          p2: '',
          p3: '',
          p4: '',
        };
      })
      .filter(function (r: any) {
        return r.nome || r.sku;
      });

    const seen: Record<string, boolean> = {};
    const dupNames: string[] = [];
    state.pendingImport.forEach(function (r: any) {
      const fp = [
        r.nome,
        r.sku,
        r.produttore,
        r.size,
        r.lingua,
        r.promo,
        r.top,
        r.note,
        r.valore,
        r.stato,
      ]
        .join('|')
        .toLowerCase();
      if (seen[fp]) dupNames.push(r.nome || r.sku || '—');
      else seen[fp] = true;
    });

    const cans = getCans();
    const existIds = new Set(
      cans.map(function (c) {
        return c.id;
      }),
    );
    const newItems = state.pendingImport.filter(function (r: any) {
      return !existIds.has(r.id);
    });
    const newCount = newItems.length;
    const updCount = state.pendingImport.length - newCount;

    let dupHtml = '';
    if (dupNames.length) {
      const shown = dupNames.slice(0, 8);
      const extra = dupNames.length - shown.length;
      dupHtml =
        '<div style="margin-top:10px;padding:10px 12px;background:rgba(255,136,0,0.08);border:1px solid rgba(255,136,0,0.25);border-radius:6px">' +
        '<div style="color:#ff8800;font-weight:500;margin-bottom:6px">⚠ ' +
        dupNames.length +
        ' duplicate rows</div>' +
        '<ul style="list-style:none;padding:0;margin:0;font-size:12px;color:var(--text2);max-height:110px;overflow-y:auto">' +
        shown
          .map(function (n) {
            return '<li style="padding:2px 0">' + esc(n) + '</li>';
          })
          .join('') +
        (extra > 0 ? '<li style="color:var(--text3)">...and ' + extra + ' more</li>' : '') +
        '</ul></div>';
    }

    let newListHtml = '';
    if (newCount > 0) {
      const showNew = newItems.slice(0, 20);
      const extraNew = newItems.length - showNew.length;
      newListHtml =
        '<div class="import-new-list"><div class="import-new-list-title">✨ ' +
        newCount +
        ' cans to be added</div>' +
        showNew
          .map(function (r: any) {
            return (
              '<div class="import-new-item"><span class="in-nome">' +
              esc(r.nome || '—') +
              '</span><span class="in-sku">SKU ' +
              esc(r.sku || '—') +
              '</span></div>'
            );
          })
          .join('') +
        (extraNew > 0
          ? '<div style="font-size:11px;color:var(--text3);padding-top:4px">...and ' +
            extraNew +
            ' more</div>'
          : '') +
        '</div>';
    }

    const preview = document.getElementById('import-preview')!;
    preview.style.display = 'block';
    preview.innerHTML =
      'Found <strong>' +
      state.pendingImport.length +
      '</strong> cans &mdash; <strong style="color:var(--green)">' +
      newCount +
      ' new</strong>, ' +
      updCount +
      ' already present.' +
      newListHtml +
      dupHtml +
      '<div style="margin-top:8px;font-size:12px;color:var(--text3)">Photos will never be touched.</div>';
    document.getElementById('import-btn')!.style.display = 'inline-flex';
  };
  reader.readAsBinaryString(file);
}

export function confirmImport(): void {
  const cans = getCans();
  const btn = document.getElementById('import-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Preparing...';

  const seen: Record<string, boolean> = {};
  const deduped = state.pendingImport.filter(function (r: any) {
    const fp = [
      r.nome,
      r.sku,
      r.produttore,
      r.size,
      r.lingua,
      r.promo,
      r.top,
      r.note,
      r.valore,
      r.stato,
    ]
      .join('|')
      .toLowerCase();
    if (seen[fp]) return false;
    seen[fp] = true;
    return true;
  });

  const existMap: Record<string, any> = {};
  cans.forEach(function (c: any) {
    existMap[c.id] = c;
  });

  const toSave: any[] = [];
  let added = 0,
    updated = 0;
  deduped.forEach(function (r: any) {
    const ex = existMap[r.id];
    if (ex) {
      const changed =
        ex.nome !== r.nome ||
        ex.sku !== r.sku ||
        ex.produttore !== r.produttore ||
        ex.size !== r.size ||
        ex.lingua !== r.lingua ||
        ex.promo !== r.promo ||
        ex.top !== r.top ||
        ex.note !== r.note ||
        ex.valore !== r.valore ||
        ex.stato !== r.stato;
      if (changed) {
        ex.nome = r.nome;
        ex.sku = r.sku;
        ex.produttore = r.produttore;
        ex.size = r.size;
        ex.lingua = r.lingua;
        ex.promo = r.promo;
        ex.top = r.top;
        ex.note = r.note;
        ex.valore = r.valore;
        ex.stato = r.stato;
        toSave.push(ex);
        updated++;
      }
    } else {
      cans.push(r);
      toSave.push(r);
      added++;
    }
  });

  batchSaveFS(toSave, btn)
    .then(function () {
      saveCache();
      closeModal('import-modal');
      document.getElementById('filter-bar')!.style.display = 'flex';
      (window as any).populateFilters();
      (window as any).applyFilters();
      updateStats();
      const parts: string[] = [];
      if (added) parts.push(added + ' new');
      if (updated) parts.push(updated + ' updated');
      toast((parts.length ? parts.join(', ') + ' saved' : 'No changes') + ' ✓');
      btn.disabled = false;
      btn.textContent = 'Import cans';
    })
    .catch(function (e: any) {
      toast('Server error: ' + e.message, true);
      btn.disabled = false;
      btn.textContent = 'Import cans';
    });
}

export function clearAll(): void {
  const cans = getCans();
  const n = cans.length;
  if (!confirm('Delete all ' + n + ' cans?\nPhotos on Cloudinary will not be touched.')) return;
  batchDeleteAllFS()
    .then(function () {
      state.cans = [];
      state.filteredList = [];
      saveCache();
      document.getElementById('import-modal')!.classList.remove('open');
      document.getElementById('filter-bar')!.style.display = 'none';
      document.getElementById('import-preview')!.style.display = 'none';
      document.getElementById('import-btn')!.style.display = 'none';
      (document.getElementById('excel-input') as HTMLInputElement).value = '';
      state.pendingImport = [];
      if (state.currentView === 'grid') (window as any).renderGrid();
      else (window as any).renderList();
      updateStats();
      toast('Collection cleared (' + n + ' cans removed)');
    })
    .catch(function (e: any) {
      toast('Error: ' + e.message, true);
    });
}
