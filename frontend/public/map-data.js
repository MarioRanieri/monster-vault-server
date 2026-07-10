/**
 * Monster Vault — World Map: dati paesi + parser del campo Country/Language.
 *
 * Tenuto IN SINCRONO con COUNTRY_FLAGS/ISO_NAMES di index.html (copia deliberata:
 * index.html resta single-file, e questo file è testabile da solo anche in Node).
 *
 * parseLinguaToIsos("ALBANIA-ROMANIA") → { isos:['AL','RO'], regions:[], unknown:[] }
 * Le lattine multi-nazione (separatori "-", "/", "->", "→") contano per TUTTE le nazioni.
 */
var MAP_COUNTRY = {
  // Europe
  'ITALY':'IT','ITALIA':'IT','GERMANY':'DE','GERMANIA':'DE','FRANCE':'FR','FRANCIA':'FR',
  'SPAIN':'ES','SPAGNA':'ES','UK':'GB','UNITED KINGDOM':'GB','ENGLAND':'GB',
  'PORTUGAL':'PT','PORTOGALLO':'PT','NETHERLANDS':'NL','OLANDA':'NL','HOLLAND':'NL',
  'BELGIUM':'BE','BELGIO':'BE','LUXEMBOURG':'LU','LUSSEMBURGO':'LU',
  'SWITZERLAND':'CH','SVIZZERA':'CH','SWISS':'CH','AUSTRIA':'AT',
  'SWEDEN':'SE','SVEZIA':'SE','NORWAY':'NO','NORVEGIA':'NO','DENMARK':'DK','DANIMARCA':'DK',
  'FINLAND':'FI','FINLANDIA':'FI','IRELAND':'IE','IRLANDA':'IE','ICELAND':'IS','ISLANDA':'IS',
  'POLAND':'PL','POLONIA':'PL','POLSKA':'PL','POLKA':'PL',
  'CZECH':'CZ','CZECHIA':'CZ','CZECH REPUBLIC':'CZ','SLOVAKIA':'SK','SLOVACCHIA':'SK',
  'HUNGARY':'HU','UNGHERIA':'HU','GREECE':'GR','GRECIA':'GR','ROMANIA':'RO','BULGARIA':'BG',
  'CROATIA':'HR','CROAZIA':'HR','SERBIA':'RS','SLOVENIA':'SI',
  'ESTONIA':'EE','LATVIA':'LV','LITHUANIA':'LT','LITUANIA':'LT','ALBANIA':'AL',
  'NORTH MACEDONIA':'MK','MACEDONIA':'MK','BOSNIA':'BA','MOLDOVA':'MD',
  'UKRAINE':'UA','UCRAINA':'UA','BELARUS':'BY','RUSSIA':'RU',
  'MALTA':'MT','CYPRUS':'CY','CIPRO':'CY',
  // Americas
  'USA':'US','UNITED STATES':'US','AMERICA':'US','CANADA':'CA','MEXICO':'MX','MESSICO':'MX',
  'BRAZIL':'BR','BRASILE':'BR','BRASIL':'BR','ARGENTINA':'AR','CHILE':'CL','COLOMBIA':'CO',
  'PERU':'PE','PERÙ':'PE','VENEZUELA':'VE','ECUADOR':'EC','BOLIVIA':'BO','PARAGUAY':'PY','URUGUAY':'UY',
  'CUBA':'CU','JAMAICA':'JM','PUERTO RICO':'PR','TRINIDAD':'TT','TRINIDAD E TOBAGO':'TT',
  'DOMINICAN REPUBLIC':'DO','DOMINICAN':'DO','COSTA RICA':'CR','PANAMA':'PA','GUATEMALA':'GT',
  // Asia-Pacific
  'JAPAN':'JP','GIAPPONE':'JP','CHINA':'CN','CINA':'CN','SOUTH KOREA':'KR','KOREA':'KR',
  'INDIA':'IN','AUSTRALIA':'AU','NEW ZEALAND':'NZ','NUOVA ZELANDA':'NZ','INDONESIA':'ID',
  'MALAYSIA':'MY','MALASYA':'MY','MALESIA':'MY','THAILAND':'TH','VIETNAM':'VN',
  'PHILIPPINES':'PH','FILIPPINE':'PH','SINGAPORE':'SG','TAIWAN':'TW','HONG KONG':'HK',
  'CAMBODIA':'KH','CAMBOGIA':'KH','MYANMAR':'MM','BRUNEI':'BN','MONGOLIA':'MN',
  'PAKISTAN':'PK','AFGHANISTAN':'AF','BANGLADESH':'BD','SRI LANKA':'LK',
  // Middle East / Africa
  'TURKEY':'TR','TURCHIA':'TR','ISRAEL':'IL','SAUDI ARABIA':'SA','UAE':'AE','DUBAI':'AE',
  'JORDAN':'JO','GIORDANIA':'JO','QATAR':'QA','IRAN':'IR','EGYPT':'EG','EGITTO':'EG',
  'MOROCCO':'MA','MAROCCO':'MA','NIGERIA':'NG','KENYA':'KE','SOUTH AFRICA':'ZA','SUDAFRICA':'ZA',
  // Caucasus / Central Asia
  'GEORGIA':'GE','ARMENIA':'AM','AZERBAIJAN':'AZ','KAZAKHSTAN':'KZ','KAZAKISTAN':'KZ','UZBEKISTAN':'UZ'
};
var MAP_ISO_NAMES = {
  'AF':'Afghanistan','AL':'Albania','AE':'UAE','AM':'Armenia','AR':'Argentina','AT':'Austria',
  'AU':'Australia','AZ':'Azerbaijan','BA':'Bosnia','BD':'Bangladesh','BE':'Belgium','BG':'Bulgaria',
  'BN':'Brunei','BO':'Bolivia','BR':'Brazil','BY':'Belarus','CA':'Canada','CH':'Switzerland',
  'CL':'Chile','CN':'China','CO':'Colombia','CR':'Costa Rica','CU':'Cuba','CY':'Cyprus',
  'CZ':'Czech Rep.','DE':'Germany','DK':'Denmark','DO':'Dominican Rep.','EC':'Ecuador','EE':'Estonia',
  'EG':'Egypt','ES':'Spain','FI':'Finland','FR':'France','GB':'UK','GE':'Georgia','GR':'Greece',
  'GT':'Guatemala','HK':'Hong Kong','HR':'Croatia','HU':'Hungary','ID':'Indonesia','IE':'Ireland',
  'IL':'Israel','IN':'India','IR':'Iran','IS':'Iceland','IT':'Italy','JM':'Jamaica','JO':'Jordan',
  'JP':'Japan','KE':'Kenya','KH':'Cambodia','KR':'South Korea','KZ':'Kazakhstan','LK':'Sri Lanka',
  'LT':'Lithuania','LU':'Luxembourg','LV':'Latvia','MA':'Morocco','MD':'Moldova','MK':'N. Macedonia',
  'MM':'Myanmar','MN':'Mongolia','MT':'Malta','MX':'Mexico','MY':'Malaysia','NG':'Nigeria',
  'NL':'Netherlands','NO':'Norway','NZ':'New Zealand','PA':'Panama','PE':'Peru','PH':'Philippines',
  'PK':'Pakistan','PL':'Poland','PR':'Puerto Rico','PT':'Portugal','PY':'Paraguay','QA':'Qatar',
  'RO':'Romania','RS':'Serbia','RU':'Russia','SA':'Saudi Arabia','SE':'Sweden','SG':'Singapore',
  'SI':'Slovenia','SK':'Slovakia','TH':'Thailand','TT':'Trinidad & Tobago','TR':'Turkey','TW':'Taiwan',
  'UA':'Ukraine','US':'USA','UY':'Uruguay','UZ':'Uzbekistan','VE':'Venezuela','VN':'Vietnam',
  'ZA':'South Africa',
  'AG':'Antigua & Barbuda','BB':'Barbados','BS':'Bahamas','DM':'Dominica','GD':'Grenada',
  'HT':'Haiti','KN':'St Kitts & Nevis','LC':'St Lucia','VC':'St Vincent & Gren.'
};
// Token speciali: espansioni multi-paese.
// CARIBBEAN = tutte le isole caraibiche TRANNE Rep. Dominicana (DO), Trinidad & Tobago (TT)
// e Giamaica (JM), che hanno/avranno una lattina propria (decisione utente).
var MAP_EXPAND = {
  'BENELUX':['BE','NL','LU'], 'UTAH':['US'],
  'CARIBBEAN':['AG','BS','BB','CU','DM','GD','HT','KN','LC','VC']
};
var MAP_REGIONS = { 'EU':1, 'EUROPE':1 };

/** ROSSO = paesi dove la lattina ESISTE ma MI MANCA (es. OG Indonesia).
 *  Per ora VUOTA: l'utente la popolerà rivedendo la lista del popup Info.
 *  (Prima conteneva 'IS' come "usa lattina altrui" — unificato in "no can" nero.) */
var SHARED_CAN_ISO = [];

/** Lista (futura) dei paesi dove la Monster NON esiste proprio — la fornirà l'utente. */
var NO_MONSTER_ISO = [];

function parseLinguaToIsos(lingua){
  var isos = [], regions = [], unknown = [];
  function addIso(i){ if(isos.indexOf(i)===-1) isos.push(i); }
  function flush(tok){
    var t = tok.trim().toUpperCase();
    if(!t) return;
    if(MAP_EXPAND[t]){ MAP_EXPAND[t].forEach(addIso); return; }
    if(MAP_REGIONS[t]){ if(regions.indexOf(t)===-1) regions.push(t); return; }
    var iso = MAP_COUNTRY[t];
    if(iso){ addIso(iso); return; }
    if(/^[A-Z]{2}$/.test(t)){ addIso(t); return; }
    if(unknown.indexOf(t)===-1) unknown.push(t);
  }
  var s = String(lingua||''), cur = '', i = 0;
  while(i < s.length){
    if(s[i]==='-' && s[i+1]==='>'){ flush(cur); cur=''; i+=2; }
    else if(s[i]==='→'){ flush(cur); cur=''; i++; }          // →
    else if(s[i]==='/' || s[i]==='-'){ flush(cur); cur=''; i++; }
    else { cur += s[i]; i++; }
  }
  flush(cur);
  return { isos: isos, regions: regions, unknown: unknown };
}

/* Chiave d'ordine dallo SKU (MMYY o MMY = mese[2 cifre] + anno; es. 079 = luglio 2009):
   prime 2 cifre = mese, il resto = anno (200Y o 20YY). Più vecchio prima; non-data in fondo. */
function skuKey(sku){
  var s = String(sku == null ? '' : sku).trim();
  if(/^\d{3,4}$/.test(s)){
    var mm = parseInt(s.slice(0, 2), 10);
    if(mm >= 1 && mm <= 12) return (2000 + parseInt(s.slice(2), 10)) * 100 + mm;
  }
  return Infinity;
}

/* True se il NOME lattina match il gusto: tutte le `words` presenti e nessuna `exclude`
   (es. /zero ?sugar/). Le regex passate portano già i confini di parola. */
function flavourMatch(name, words, exclude){
  var n = String(name == null ? '' : name);
  if(exclude && exclude.some(function(re){ return re.test(n); })) return false;
  return words.every(function(re){ return re.test(n); });
}

/* Gruppi di una lattina per la LISTA: come la mappa, ma le CARIBBEAN confluiscono in un
   solo gruppo "_CARIB" (sulla mappa restano accese tutte le isole). */
function listGroups(c){
  var isos = parseLinguaToIsos(c.lingua).isos.slice();
  if(/\bCARIBBEAN\b/i.test(String(c.lingua || ''))){
    var car = MAP_EXPAND['CARIBBEAN'] || [];
    isos = isos.filter(function(i){ return car.indexOf(i) === -1; });
    isos.push('_CARIB');
  }
  return isos;
}

/* Fascia choropleth dal n° di lattine: 1 / 2–3 / 4–7 / 8+. Guida colore mappa E legenda. */
function litBand(n){ return n >= 8 ? 'q4' : n >= 4 ? 'q3' : n >= 2 ? 'q2' : 'q1'; }

// Esporta per Node (test) senza toccare il comportamento browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MAP_COUNTRY: MAP_COUNTRY, MAP_ISO_NAMES: MAP_ISO_NAMES,
                     MAP_EXPAND: MAP_EXPAND, MAP_REGIONS: MAP_REGIONS,
                     SHARED_CAN_ISO: SHARED_CAN_ISO, NO_MONSTER_ISO: NO_MONSTER_ISO,
                     parseLinguaToIsos: parseLinguaToIsos, skuKey: skuKey,
                     flavourMatch: flavourMatch, listGroups: listGroups, litBand: litBand };
}
