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

# Richieste eBay simultanee (le ricerche mercati×query partono in parallelo).
PARALLEL_WORKERS = 8

# /delete: quanti messaggi a ritroso provare a cancellare (< 48h, solo del bot).
DELETE_SCAN_BACK = 300
DELETE_WORKERS = 12
