// Bandiere delle nazioni sulla card (mappe + parser), portate dal vanilla core.ts.
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
  CARIBBEAN: { emoji: '🏝️', name: 'Caribbean' },
};

// Un pezzo del rendering flag: una bandiera (con nome), un separatore, o testo grezzo.
export type FlagToken =
  | { kind: 'flag'; iso?: string; url?: string; emoji?: string; name: string }
  | { kind: 'sep'; text: string }
  | { kind: 'text'; text: string };

function toFlag(cur: string): FlagToken {
  const t = cur.trim();
  const up = t.toUpperCase();
  const cf = CUSTOM_FLAGS[up];
  if (cf) return { kind: 'flag', url: cf.url, emoji: cf.emoji, name: cf.name };
  const iso = COUNTRY_FLAGS[up];
  if (iso) return { kind: 'flag', iso, name: ISO_NAMES[iso] ?? iso };
  if (/^[A-Z]{2}$/.test(up)) return { kind: 'flag', iso: up, name: ISO_NAMES[up] ?? up };
  return { kind: 'text', text: t };
}

// Traduce il campo "lingua" (es. "ITALY", "USA -> UK", "BENELUX") in una lista di
// bandiere e separatori. Pura e testabile (nessun DOM), portata da core.ts:linguaToFlags.
export function parseFlags(lingua: string | undefined): FlagToken[] {
  if (!lingua) return [];
  if (lingua.trim().toUpperCase() === 'BENELUX') {
    return [
      { kind: 'flag', iso: 'BE', name: 'Belgium' },
      { kind: 'sep', text: '/' },
      { kind: 'flag', iso: 'NL', name: 'Netherlands' },
      { kind: 'sep', text: '/' },
      { kind: 'flag', iso: 'LU', name: 'Luxembourg' },
    ];
  }
  const out: FlagToken[] = [];
  let cur = '';
  const flush = () => {
    if (cur.trim()) out.push(toFlag(cur));
    cur = '';
  };
  const L = lingua;
  let i = 0;
  while (i < L.length) {
    if (L[i] === '-' && L[i + 1] === '>') {
      flush();
      out.push({ kind: 'sep', text: '→' });
      i += 2;
    } else if (L[i] === '→') {
      flush();
      out.push({ kind: 'sep', text: '→' });
      i++;
    } else if (L[i] === '/' || L[i] === '-') {
      flush();
      out.push({ kind: 'sep', text: '/' });
      i++;
    } else {
      cur += L[i];
      i++;
    }
  }
  flush();
  return out;
}

// Rende le bandiere del campo lingua (immagini flagcdn + nome), come nel vecchio.
export function Flags({ lingua }: Readonly<{ lingua?: string }>) {
  const tokens = parseFlags(lingua);
  if (tokens.length === 0) return null;
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === 'sep')
          return (
            <span key={i} className="flag-sep">
              {' '}
              {t.text}{' '}
            </span>
          );
        if (t.kind === 'text') return <span key={i}>{t.text}</span>;
        return (
          <span key={i} className="flag-chip">
            {t.url ? (
              <img src={t.url} alt="" className="flag-img" loading="lazy" />
            ) : t.emoji ? (
              <span className="flag-emoji">{t.emoji}</span>
            ) : (
              <img
                src={`https://flagcdn.com/16x12/${t.iso!.toLowerCase()}.png`}
                alt=""
                className="flag-img"
                loading="lazy"
              />
            )}
            <span className="flag-name">{t.name}</span>
          </span>
        );
      })}
    </>
  );
}
