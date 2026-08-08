# ============================================================
#  Monster Energy — eBay Monitor  |  settings.py
#  Config NON-segreta, VERSIONATA. Gira in cloud (GitHub Actions, un giro ogni 2h).
#  I SEGRETI arrivano dalle variabili d'ambiente (GitHub Secrets), NON da qui:
#    EBAY_CLIENT_ID · EBAY_CLIENT_SECRET · TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · MONGODB_URI
#  La blacklist di base sta in blacklist.txt; le aggiunte /add vivono su MongoDB.
# ============================================================

EBAY_ENV = "production"

# Mercati (marketplace ID). EBAY_IT mostra già le inserzioni internazionali che spediscono
# in IT; EBAY_DE = grande mercato europeo.
EBAY_MARKETPLACES = [
    "EBAY_IT", "EBAY_DE", "EBAY_US", "EBAY_CA", "EBAY_GB", "EBAY_AU",
]

# Alias amichevoli (sigla paese → marketplace ID) per i comandi /market da Telegram,
# es. "/market remove uk". I valori sono anche la whitelist dei marketplace VALIDI per
# la Browse API (X-EBAY-C-MARKETPLACE-ID): aggiungere solo mercati che eBay supporta.
MARKET_ALIASES = {
    "us": "EBAY_US", "usa": "EBAY_US", "gb": "EBAY_GB", "uk": "EBAY_GB",
    "it": "EBAY_IT", "de": "EBAY_DE", "fr": "EBAY_FR", "es": "EBAY_ES",
    "ca": "EBAY_CA", "au": "EBAY_AU", "at": "EBAY_AT", "be": "EBAY_BE",
    "ch": "EBAY_CH", "ie": "EBAY_IE", "nl": "EBAY_NL", "pl": "EBAY_PL",
    "hk": "EBAY_HK", "my": "EBAY_MY", "ph": "EBAY_PH", "sg": "EBAY_SG",
    "tw": "EBAY_TW", "in": "EBAY_IN",
}
VALID_MARKETPLACES = set(MARKET_ALIASES.values())

# Ogni ricerca è "monster energy <keyword>": eBay matcha tutte le parole (non frase esatta).
_KEYWORDS = [
    "all star", "billabong", "ufc", "assault", "hydro", "tour water",
    "muscle", "sales sample", "lot", "gadget", "limited", "shot",
    "promo", "dub", "heavy metal", "full", "rare", "khaos",
    "java", "dragon", "rehab", "maxx", "mixxd", "m80", "drink",
    "",   # ricerca generica "monster energy" (molti risultati, anche merch)
]
SEARCH_QUERIES = [f"monster energy {kw}".strip() for kw in _KEYWORDS]

MAX_PRICE_EUR = None

# ⏱️ Solo annunci listati nelle ultime N ore (filtro lato eBay). Allargata da 2.5 a 3.5:
# i cron di GitHub Actions non partono all'orario esatto (slittano di minuti, a volte saltano
# un giro) → 3.5h assorbe i ritardi. Costo: qualche duplicato in più, già filtrato dal DB.
MAX_LISTING_AGE_HOURS = 3.5

# Parole OBBLIGATORIE nel titolo (tutte, in qualsiasi ordine): eBay non fa un AND stretto.
REQUIRE_WORDS = ["monster", "energy"]

# Il workflow gira ogni 5 min per drenare i COMANDI Telegram in fretta, ma la RICERCA eBay
# resta ogni ~2h (altrimenti sfori il limite ~5.000 chiamate/giorno): ogni giro fa lo sweep
# solo se sono passati almeno SWEEP_INTERVAL_SECONDS dall'ultimo (timestamp su Mongo).
# Deve restare < MAX_LISTING_AGE_HOURS (finestra), o perdi annunci tra uno sweep e l'altro.
SWEEP_INTERVAL_SECONDS = 7200   # 2 ore

# Tetto orientativo chiamate/giorno della Browse API (per l'avviso su /market add: aggiungere
# mercati moltiplica le chiamate query×mercati×sweep-al-giorno e può sforare in silenzio).
EBAY_DAILY_BUDGET = 5000

# Richieste eBay simultanee (le ricerche mercati×query partono in parallelo).
PARALLEL_WORKERS = 8

# /delete: quanti messaggi a ritroso provare a cancellare (< 48h, solo del bot).
DELETE_SCAN_BACK = 300
DELETE_WORKERS = 12
