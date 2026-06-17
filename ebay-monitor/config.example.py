# ============================================================
#  MONSTER ENERGY — eBay Monitor  |  config.example.py
#  TEMPLATE versionato. Copia in config.py e compila:  copy config.example.py config.py
#  config.py è in .gitignore (contiene i segreti) e NON va su git.
# ============================================================

# --- eBay Browse API (OAuth, Production) ---
EBAY_CLIENT_ID     = "INSERISCI_CLIENT_ID"
EBAY_CLIENT_SECRET = "INSERISCI_CLIENT_SECRET"
EBAY_ENV           = "production"

# Mercati da monitorare (marketplace ID). Più mercati = più chiamate (vedi BUDGET).
# 6 mercati con polling 57 min ≈ 4.850 call/giorno. EBAY_IT mostra già le inserzioni
# internazionali che spediscono in IT; EBAY_DE = grande mercato europeo.
EBAY_MARKETPLACES = [
    "EBAY_IT", "EBAY_DE", "EBAY_US", "EBAY_CA", "EBAY_GB", "EBAY_AU",
]

# --- Ricerche per NOME (modalità A) ---
# OGNI ricerca contiene SEMPRE "monster energy" (parole obbligatorie, non frase esatta):
# eBay matcha tutte le parole → fuori Pokémon/Monster High ecc.
_KEYWORDS = [
    "all star", "billabong", "ufc", "assault", "hydro", "tour water",
    "muscle", "sales sample", "lot", "gadget", "limited", "shot",
    "promo", "dub", "heavy metal", "full", "rare", "khaos",
    "java", "dragon", "rehab", "maxx", "mixxd", "m80", "drink",
    "",   # ricerca generica "monster energy" (molti risultati, anche merch)
]
SEARCH_QUERIES = [f"monster energy {kw}".strip() for kw in _KEYWORDS]

MAX_PRICE_EUR = None

# ⏱️ Solo annunci listati nelle ultime N ore (None = no limite). Filtro lato eBay.
# ⚠️ POLL_INTERVAL_SECONDS deve essere < di questa finestra.
MAX_LISTING_AGE_HOURS = 2.5

# Parole OBBLIGATORIE nel titolo (tutte, in qualsiasi ordine): impone "Monster Energy"
# perché eBay non fa un AND stretto. Svuota la lista ([]) per disattivare.
REQUIRE_WORDS = ["monster", "energy"]

# Anti-rumore: scarta i titoli che contengono una di queste parole/sequenze.
# Confronto CASE-INSENSITIVE. ⚠️ Le voci con SPAZIO iniziale (es. " hat") evitano
# falsi positivi dentro altre parole ("that" contiene "hat", "steel" contiene "tee").
EXCLUDE_WORDS = [
    # ── altri brand "Monster" / carte / giochi ──
    "monster high", "monster jam", "monster truck", "monster hunter", "monster cable",
    "hdmi", "pokemon", "pokémon", "yu-gi-oh", "yugioh", "tcg", "trading card",
    "labubu", "pop mart", "ps4", "ps5", "game",
    # ── fumetti / anime / cartoon ──
    "doujinshi", "evangelion", "neon genesis", "disney", "pixar", "big into energy",
    # ── moto: MODELLI (i ricambi citano sempre il modello, le lattine mai;
    #    niente "kawasaki" secco → salva eventuali lattine collab Kawasaki) ──
    "kawasaki kx", "kawasaki klx", "kawasaki kfx", "kfx", "kx 65", "kx65", "kx 85", "kx85",
    "kx 125", "kx125", "kx 250", "kx250", "kx 450", "kx450", "klx 140", "klx140",
    "yamaha yz", "yamaha wr", "yz 85", "yz85", "yz 125", "yz125", "yz 250", "yz250",
    "yz 450", "yz450", "yzf", "wr450", "honda crf", "crf250", "crf450",
    "suzuki rm", "rmz", "rm-z", "husqvarna", "ktm ", "motocross", "enduro",
    "pit bike", "dirt bike", "quad ", "atv ",
    # ── moto: ricambi / officina ──
    "oil filter", "filtro olio", "hiflo", "spark plug", "brake pad", "fuel pump",
    "carburetor", "carburatore", "clutch", "frizione", "leva freno", "caliper",
    "bearing", "swingarm", "kickstart", "throttle", "piston", "thrust washer",
    "washer", "bolt", "gear lever", "brake lever", "lever", "exhaust", "marmitta",
    "sprocket", "pignone", "chain kit", "drive chain", "handlebar", "manubrio",
    "fender", "parafango", "mudguard", "fork", "forcella", "radiator", "radiatore",
    "plastiche", "plastic kit", "snap-on", "tappetino", "wrench",
    "helmet", "casco", "arai", "agv", "shoei",
    "dcor", "graphic", "athena", "koyo", "o'neal", "pit board",
    "fits kawasaki", "for kawasaki", "per kawasaki", "fits yamaha", "for yamaha",
    "supercross",
    # ── modellini & motorsport ──
    "1:24", "1:32", "1:64", "1:18", "1:43", "1:6", "1/24", "1/32", "1/64", "1/18", "1/43",
    "diecast", "die-cast", "slot car", "matchbox", "traxxas", "quadcopter", "drone",
    "nascar", "dragster", "sprintcar", "sprint car", "top fuel", "panini", "prizm",
    "autograph", "autografo", "autografato", " signed",
    # ── abbigliamento / accessori ──
    "felpa", "felpe", "maglietta", "magliette", "maglia", "canotta", "camicia",
    "occhiali", "goggle", "gloves", "guanti", "boots", "stivali",
    "jacket", "giacca", "jersey", "softshell", "pullover", "sweatshirt", "hoodie", "zip",
    "tank top", "pants", " tee", "t-shirt", "tshirt", "shirt", "polo",
    " hat", "snapback", "beanie", "trucker", "cappello", "cappellino",
    # ── bundle / multipack / casse (le lattine SINGOLE passano) ──
    "pack", "case of", " x 500", " x 330", " x 355", " x 250", " x 16oz", " x 12oz",
    "lattine da 500", "lattine da 250", "lattine da 355", "lattine da 330",
]

# --- Notifiche ---
NOTIFY_VIA = "telegram"
TELEGRAM_BOT_TOKEN = "INSERISCI_BOT_TOKEN"
TELEGRAM_CHAT_ID   = "INSERISCI_CHAT_ID"

# Comando Telegram /delete: quanti messaggi a ritroso provare a cancellare (< 48h, solo del bot).
DELETE_SCAN_BACK = 300

# --- Polling / BUDGET ---
# Chiamate/giorno ≈ n_query × n_mercati × (86400 / POLL). Tienile sotto il limite eBay.
# DEVE essere < di MAX_LISTING_AGE_HOURS, o perdi annunci tra un giro e l'altro.
POLL_INTERVAL_SECONDS = 7200   # 2 ore (finestra 2,5h dà ~30 min di margine)

# --- Ricerca in PARALLELO (opzione B): giro completo in ~15-25s invece di ~3,5 min ---
PARALLEL_SEARCH  = True   # False = sequenziale (avanzamento mercato per mercato)
PARALLEL_WORKERS = 8      # richieste eBay simultanee

# --- (B) Verifica foto multimodale — opzionale, spenta di default ---
USE_VLM           = False
ANTHROPIC_API_KEY = ""
VLM_MODEL         = "claude-haiku-4-5"
SITE_API_URL      = "https://monster-vault-server.onrender.com/api/cans"
