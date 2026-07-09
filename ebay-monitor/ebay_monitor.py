#!/usr/bin/env python3
"""
Monster Energy eBay Monitor — radar multi-mercato su Telegram (cloud, un giro per esecuzione).

Gira su GitHub Actions (schedule ogni 2h + trigger manuale). Ogni esecuzione:
  1. si connette a MongoDB (stato anti-duplicati + blacklist dinamica); se è giù, salta il giro
  2. drena i comandi Telegram arrivati dall'ultimo giro (/add, /list, /delete)
  3. per ogni query × mercato cerca gli annunci "appena listati" e notifica i NUOVI su Telegram

Ricerca per NOME (config.SEARCH_QUERIES): niente confronto foto (il VLM non distingue le
lattine, rimosso). Il rumore lo scremi curando la blacklist con /add dalla chat.

Avvio:
  py ebay_monitor.py                 # un giro: notifica solo i NUOVI
  py ebay_monitor.py --send-now      # TEST: manda subito gli annunci attuali (ignora "già visti")
  py ebay_monitor.py --send-now 5    # ...max 5 per ricerca
  py ebay_monitor.py --send-now 5 --hours 168   # ...ignora la finestra (qui ultimi 7 gg)

Segreti da variabili d'ambiente (GitHub Secrets):
  EBAY_CLIENT_ID · EBAY_CLIENT_SECRET · TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · MONGODB_URI
"""
import os
import sys
import time
import base64
import requests
import threading
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import settings

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE_DIR       = Path(__file__).parent
BLACKLIST_FILE = BASE_DIR / "blacklist.txt"

EBAY_OAUTH_URL = {
    "production": "https://api.ebay.com/identity/v1/oauth2/token",
    "sandbox":    "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
}
EBAY_SEARCH_URL = {
    "production": "https://api.ebay.com/buy/browse/v1/item_summary/search",
    "sandbox":    "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search",
}


# ─── SEGRETI (da env) ─────────────────────────────────────────────────────────

def _env(name):
    v = os.environ.get(name, "")
    if not v:
        raise RuntimeError(f"Manca la variabile d'ambiente {name} (GitHub Secret / config locale).")
    return v


# ─── LOGICA PURA (testabile senza rete/Mongo) ─────────────────────────────────

def load_base_blacklist(path=BLACKLIST_FILE):
    """Legge blacklist.txt: una voce per riga; salta righe vuote e commenti (#).
    Preserva gli spazi iniziali/finali significativi (' hat', 'atv ')."""
    words = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            raw = line.rstrip("\n").rstrip("\r")
            if not raw.strip() or raw.lstrip().startswith("#"):
                continue
            words.append(raw)
    return words


def merge_blacklist(base, additions):
    """Base statica (file) + aggiunte dinamiche (Mongo), senza duplicati (case-insensitive)."""
    seen = {w.lower() for w in base}
    out = list(base)
    for w in additions:
        if w and w.lower() not in seen:
            out.append(w)
            seen.add(w.lower())
    return out


def title_passes(title, require_words, exclude_words):
    """True se l'annuncio va notificato: contiene TUTTE le require_words e NESSUNA
    exclude_word (confronto case-insensitive)."""
    t = (title or "").lower()
    if not all(w.lower() in t for w in require_words):
        return False
    if any(w.lower() in t for w in exclude_words):
        return False
    return True


def parse_command(text):
    """'/add camicia rossa' -> ('add', 'camicia rossa'). Non-comando -> (None, '')."""
    text = (text or "").strip()
    if not text.startswith("/"):
        return None, ""
    parts = text.split(maxsplit=1)
    cmd = parts[0][1:].split("@")[0].lower()   # toglie '/' e l'eventuale @NomeBot
    arg = parts[1].strip() if len(parts) > 1 else ""
    return cmd, arg


def sweep_due(last_sweep_at, now, interval, send_now=False):
    """True se è ora di fare la ricerca eBay: mai visto prima, test send_now, o è passato
    almeno 'interval' dall'ultimo sweep. Altrimenti il giro drena solo i comandi."""
    if send_now or last_sweep_at is None:
        return True
    return (now - last_sweep_at) >= interval


def validate_add_word(word, require_words):
    """Guardia /add: rifiuta vuoto, <2 char e parole obbligatorie (accecherebbero il radar).
    Ritorna (ok, motivo). La parola valida è normalizzata lowercase dal chiamante."""
    w = (word or "").strip().lower()
    if not w:
        return False, "vuoto"
    if len(w) < 2:
        return False, "troppo corto (min 2 caratteri)"
    if w in {r.lower() for r in require_words}:
        return False, f"'{w}' è obbligatoria: escluderla accecherebbe il radar"
    return True, ""


# ─── MONGODB (stato: anti-duplicati + blacklist dinamica) ─────────────────────

class Store:
    """Stato persistente del monitor su MongoDB Atlas (stesso cluster del sito, collection
    dedicate — NON tocca mai 'cans'). Fallisce subito se il DB è irraggiungibile."""

    def __init__(self, uri):
        from pymongo import MongoClient   # import pigro: la logica pura resta testabile senza pymongo
        self.client = MongoClient(uri, serverSelectionTimeoutMS=15000)
        self.db = self.client.get_default_database()   # il nome DB è nell'URI (…/monstervault)
        self.db.command("ping")                        # fail-fast: verifica la connessione
        self.seen = self.db["ebay_seen"]
        self.blacklist = self.db["ebay_blacklist"]

    def seen_count(self):
        return self.seen.estimated_document_count()

    def already_seen(self, item_id):
        return self.seen.find_one({"_id": item_id}, {"_id": 1}) is not None

    def mark_seen(self, item_id, title, price, currency, url, site, query):
        try:
            price_val = float(price or 0)
        except (TypeError, ValueError):
            price_val = 0.0   # prezzo malformato da eBay: non deve bloccare il mark (rinotifica infinita)
        self.seen.update_one(
            {"_id": item_id},
            {"$setOnInsert": {"title": title, "price": price_val, "currency": currency,
                              "url": url, "site": site, "query": query,
                              "seen_at": datetime.now(timezone.utc)}},
            upsert=True)

    def blacklist_additions(self):
        return [d["_id"] for d in self.blacklist.find({}, {"_id": 1})]

    def add_blacklist_word(self, word):
        """Upsert idempotente (word = _id): riprocessare lo stesso /add non crea doppioni."""
        self.blacklist.update_one(
            {"_id": word},
            {"$setOnInsert": {"added_at": datetime.now(timezone.utc)}},
            upsert=True)

    def get_meta(self, key, default=None):
        d = self.db["ebay_meta"].find_one({"_id": key})
        return d["value"] if d else default

    def set_meta(self, key, value):
        self.db["ebay_meta"].update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)


# ─── EBAY BROWSE API ──────────────────────────────────────────────────────────

_token_cache = {"token": None, "exp": 0.0}

# Fallimenti ricerche del giro: senza questo il radar può "diventare cieco" in silenzio
# (es. token revocato → tutte le ricerche vuote). A fine giro, se troppi, lo segnaliamo.
_search_stats = {"fail": 0, "last": None}
_stats_lock = threading.Lock()

def _note_search_failure(exc):
    with _stats_lock:
        _search_stats["fail"] += 1
        _search_stats["last"] = exc

def get_ebay_token():
    """Token applicativo OAuth (client_credentials), cache finché valido. Riprova sugli
    errori di rete; distingue 'rete giù' da 'credenziali sbagliate'."""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["exp"] - 60:
        return _token_cache["token"]
    basic = base64.b64encode(f"{_env('EBAY_CLIENT_ID')}:{_env('EBAY_CLIENT_SECRET')}".encode()).decode()
    attempts = 3
    for i in range(1, attempts + 1):
        try:
            r = requests.post(
                EBAY_OAUTH_URL[settings.EBAY_ENV],
                headers={"Authorization": f"Basic {basic}",
                         "Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "client_credentials",
                      "scope": "https://api.ebay.com/oauth/api_scope"}, timeout=20)
            r.raise_for_status()
            j = r.json()
            _token_cache["token"] = j["access_token"]
            _token_cache["exp"] = time.time() + int(j.get("expires_in", 7200))
            return _token_cache["token"]
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else "?"
            print(f"  [ERRORE] eBay ha rifiutato le credenziali (HTTP {code}): controlla "
                  f"i Secret EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.")
            return None
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            if i < attempts:
                print(f"  [RETE] api.ebay.com non raggiungibile (tentativo {i}/{attempts}); riprovo tra 5s…")
                time.sleep(5)
            else:
                print(f"  [ERRORE] api.ebay.com non raggiungibile dopo {attempts} tentativi: "
                      f"problema di RETE/DNS, non delle credenziali. ({type(exc).__name__})")
                return None
        except Exception as exc:
            print(f"  [ERRORE] OAuth eBay fallito (imprevisto): {exc}")
            return None
    return None


def search_ebay(marketplace, query, token):
    """Cerca su UN mercato con UNA query (ordine: appena listati). Con
    settings.MAX_LISTING_AGE_HOURS filtra lato eBay i soli annunci freschi."""
    params = {"q": query, "limit": "50", "sort": "newlyListed"}
    filters = []
    max_age = getattr(settings, "MAX_LISTING_AGE_HOURS", None)
    if max_age:
        since = datetime.now(timezone.utc) - timedelta(hours=max_age)
        filters.append(f"itemStartDate:[{since.strftime('%Y-%m-%dT%H:%M:%S.000Z')}..]")
    if settings.MAX_PRICE_EUR is not None:
        filters.append(f"price:[..{settings.MAX_PRICE_EUR}],priceCurrency:EUR")
    if filters:
        params["filter"] = ",".join(filters)
    headers = {"Authorization": f"Bearer {token}",
               "X-EBAY-C-MARKETPLACE-ID": marketplace,
               "Content-Type": "application/json"}
    try:
        r = requests.get(EBAY_SEARCH_URL[settings.EBAY_ENV], params=params, headers=headers, timeout=25)
        if r.status_code == 429:   # rate limit: pausa e UN retry
            print(f"\n  [WARN] eBay 429 (rate limit) su {marketplace} '{query}' — riprovo tra 30s")
            time.sleep(30)
            r = requests.get(EBAY_SEARCH_URL[settings.EBAY_ENV], params=params, headers=headers, timeout=25)
        r.raise_for_status()
        return r.json().get("itemSummaries", []) or []
    except Exception as exc:
        _note_search_failure(exc)
        print(f"\n  [WARN] eBay {marketplace} '{query}': {exc}")
        return []


def parse_summary(item):
    """(item_id, title, price, currency, url, image_url) da un itemSummary Browse."""
    item_id  = item.get("itemId", "")
    title    = item.get("title", "")
    price    = (item.get("price") or {}).get("value", "")
    currency = (item.get("price") or {}).get("currency", "")
    url      = item.get("itemWebUrl", "")
    image    = (item.get("image") or {}).get("imageUrl", "")
    if not image:
        thumbs = item.get("thumbnailImages") or []
        if thumbs:
            image = thumbs[0].get("imageUrl", "")
    return item_id, title, price, currency, url, image


# ─── TELEGRAM ─────────────────────────────────────────────────────────────────

def _tg_token(): return os.environ.get("TELEGRAM_BOT_TOKEN", "")
def _chat_id():  return os.environ.get("TELEGRAM_CHAT_ID", "")
def _tg_url():   return f"https://api.telegram.org/bot{_tg_token()}"

def _tg_text(text):
    """Messaggio di servizio (testo semplice) nella chat."""
    try:
        requests.post(f"{_tg_url()}/sendMessage",
                      data={"chat_id": _chat_id(), "text": text}, timeout=15)
    except Exception:
        pass

def send_telegram(title, price, currency, url, image_url, site, reason):
    caption = f"⚡ <b>{title}</b>\n💰 {price} {currency}\n🌍 {site}  |  {reason}\n{url}"
    api = _tg_url()
    try:
        if image_url:
            r = requests.post(f"{api}/sendPhoto",
                              data={"chat_id": _chat_id(), "photo": image_url,
                                    "caption": caption, "parse_mode": "HTML"}, timeout=25)
            if not (r.ok and r.json().get("ok")):
                r = requests.post(f"{api}/sendMessage",
                                  data={"chat_id": _chat_id(), "text": caption,
                                        "parse_mode": "HTML"}, timeout=25)
        else:
            r = requests.post(f"{api}/sendMessage",
                              data={"chat_id": _chat_id(), "text": caption,
                                    "parse_mode": "HTML"}, timeout=25)
        ok = r.ok and r.json().get("ok")
        print(("  ✅ " if ok else "  ❌ ") + f"{title[:50]}" + ("" if ok else f"  Telegram: {r.text[:120]}"))
        return ok
    except Exception as exc:
        print(f"  ❌ Errore Telegram: {exc}")
        return False


# ─── TELEGRAM: drain comandi (una volta per giro) ─────────────────────────────
# Il cron non tiene un processo vivo: a inizio giro leggiamo i comandi arrivati dall'ultimo
# giro, li eseguiamo, e li confermiamo (Telegram li scarta). Latenza fino a ~2h, accettata.
# Tutti i comandi sono IDEMPOTENTI, così un'eventuale riprocessazione non fa danni.

def _delete_one(mid):
    """True se il messaggio è stato cancellato. Un retry sul 429 rispettando retry_after."""
    for attempt in (1, 2):
        try:
            r = requests.post(f"{_tg_url()}/deleteMessage",
                              data={"chat_id": _chat_id(), "message_id": mid}, timeout=15)
            if r.status_code == 429 and attempt == 1:
                retry_after = (r.json().get("parameters") or {}).get("retry_after", 1)
                time.sleep(min(retry_after, 30) + 0.1)
                continue
            return bool(r.ok and r.json().get("ok"))
        except Exception:
            return False
    return False

def delete_bot_messages(up_to_id, protected=()):
    """Cancella a ritroso i messaggi del bot prima di up_to_id (fino a DELETE_SCAN_BACK).
    Telegram rifiuta quelli non del bot o più vecchi di 48h: contiamo solo i cancellati.
    'protected' = message_id da NON cancellare (es. il banner fissato)."""
    scan = getattr(settings, "DELETE_SCAN_BACK", 300)
    workers = getattr(settings, "DELETE_WORKERS", 12)
    protected = set(protected)
    ids = [i for i in range(up_to_id - 1, max(0, up_to_id - scan - 1), -1) if i not in protected]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return sum(ex.map(_delete_one, ids))

def _handle_command(store, cmd, arg, msg_id):
    """Esegue un comando. Ritorna True se gestito (per il log)."""
    if cmd == "delete":
        banner = store.get_meta("banner_msg_id")           # non cancellare il banner fissato
        n = delete_bot_messages(msg_id, protected={banner} if banner else ())
        _delete_one(msg_id)   # cancella anche il comando stesso
        print(f"  [/delete] cancellati {n} messaggi del bot")
        return True
    if cmd == "add":
        word = arg.strip().lower()
        ok, reason = validate_add_word(word, settings.REQUIRE_WORDS)
        if ok:
            store.add_blacklist_word(word)
            tot = len(store.blacklist_additions())
            _tg_text(f"✅ aggiunto '{word}' alla blacklist (ora {tot} parole dinamiche)")
            print(f"  [/add] '{word}' aggiunto ({tot} dinamiche)")
        else:
            _tg_text(f"⚠️ '{arg.strip()}' ignorato: {reason}")
            print(f"  [/add] rifiutato '{arg.strip()}': {reason}")
        return True
    if cmd == "list":
        words = sorted(store.blacklist_additions())
        if words:
            _tg_text("🗒️ Parole dinamiche (aggiunte via /add):\n" + "\n".join(words))
        else:
            _tg_text("🗒️ Nessuna parola dinamica: la blacklist è solo quella di base (blacklist.txt).")
        print(f"  [/list] {len(words)} parole dinamiche")
        return True
    return False

BANNER_TEXT = (
    "ℹ️ Come funziona questo bot\n\n"
    "I comandi /add /list /delete NON sono istantanei: il radar gira in cloud ~ogni 2h e li "
    "esegue al giro successivo (attesa fino a ~2h). Scrivi pure il comando e aspetta il prossimo "
    "giro per la risposta/effetto — non è rotto, è in coda.\n"
    "È il costo dell'esecuzione gratuita: nessun processo sempre acceso in ascolto."
)

def ensure_banner(store):
    """Assicura che ci sia un messaggio fissato che spiega la latenza. Creato una volta e
    salvato su Mongo (message_id): non lo rifà a ogni giro e il /delete lo preserva."""
    if store.get_meta("banner_msg_id"):
        return
    try:
        r = requests.post(f"{_tg_url()}/sendMessage",
                          data={"chat_id": _chat_id(), "text": BANNER_TEXT,
                                "disable_notification": True}, timeout=15)
        mid = (r.json().get("result") or {}).get("message_id")
        if mid:
            requests.post(f"{_tg_url()}/pinChatMessage",
                          data={"chat_id": _chat_id(), "message_id": mid,
                                "disable_notification": True}, timeout=15)
            store.set_meta("banner_msg_id", mid)
            print(f"  [banner] creato e fissato (msg {mid})")
    except Exception as exc:
        print(f"  [banner] non creato: {exc}")


def register_bot_ui(store):
    """Housekeeping UI del bot: menu comandi, descrizione, banner fissato. Cambia di rado →
    lo chiamiamo solo negli sweep (ogni ~2h), non a ogni drain da 5 min."""
    url = _tg_url()
    # Menu comandi (tastino ☰ e autocompletamento "/"). Lo registriamo sia sullo scope
    # 'default' sia su 'all_private_chats': quest'ultimo è PIÙ SPECIFICO e vince nelle chat
    # private — se resta indietro, il client mostra solo i comandi vecchi.
    _cmds = [
        {"command": "add",    "description": "Aggiungi una parola alla blacklist"},
        {"command": "list",   "description": "Mostra le parole aggiunte con /add"},
        {"command": "delete", "description": "Cancella i messaggi inviati dal bot"},
    ]
    for scope in (None, {"type": "all_private_chats"}):
        try:
            payload = {"commands": _cmds}
            if scope:
                payload["scope"] = scope
            requests.post(f"{url}/setMyCommands", json=payload, timeout=15)
        except Exception:
            pass
    try:   # descrizione bot (schermata iniziale / profilo): spiega la latenza
        requests.post(f"{url}/setMyDescription", json={"description": BANNER_TEXT}, timeout=15)
    except Exception:
        pass
    ensure_banner(store)   # banner fissato in cima alla chat


def drain_commands(store):
    """Legge i comandi pendenti, li esegue, poi li conferma (offset) così al giro dopo
    Telegram non li rimanda. Solo dalla chat autorizzata. Chiamato a OGNI giro (5 min)."""
    url = _tg_url()
    try:
        ups = requests.get(f"{url}/getUpdates", params={"timeout": 0}, timeout=25).json().get("result", [])
    except Exception as exc:
        print(f"  [WARN] getUpdates fallito, comandi saltati: {exc}")
        return
    last = None
    for u in ups:
        last = u["update_id"]
        msg = u.get("message") or {}
        chat_id = str((msg.get("chat") or {}).get("id", ""))
        if chat_id != str(_chat_id()):
            continue
        cmd, arg = parse_command(msg.get("text") or "")
        if cmd in ("add", "list", "delete"):
            _handle_command(store, cmd, arg, msg.get("message_id", 0))
    if last is not None:   # conferma: Telegram scarta gli update <= last
        try:
            requests.get(f"{url}/getUpdates", params={"offset": last + 1, "timeout": 0}, timeout=25)
        except Exception:
            pass   # non confermati: verranno riprocessati (idempotente, nessun danno)


# ─── RICERCHE + STATS ─────────────────────────────────────────────────────────

def _reset_search_stats():
    with _stats_lock:
        _search_stats["fail"] = 0
        _search_stats["last"] = None

def _report_search_stats():
    """A fine giro: se è fallita PIÙ DELLA METÀ delle ricerche, allarme Telegram
    (radar quasi/completamente cieco)."""
    total = len(settings.EBAY_MARKETPLACES) * len(settings.SEARCH_QUERIES)
    with _stats_lock:
        fail, last = _search_stats["fail"], _search_stats["last"]
    if not fail:
        return
    print(f"  [WARN] {fail}/{total} ricerche fallite in questo giro (ultimo errore: {last})")
    if fail * 2 > total:
        _tg_text(f"⚠️ eBay Monitor: {fail}/{total} ricerche FALLITE in questo giro — "
                 f"il radar è quasi cieco. Controlla chiavi/quota eBay. Ultimo errore: {last}")

def gather_listings(token):
    """Tutte le ricerche (mercati × query) IN PARALLELO → lista (mercato, query, item).
    A fine giro segnala i fallimenti."""
    _reset_search_stats()
    tasks = [(mk, q) for mk in settings.EBAY_MARKETPLACES for q in settings.SEARCH_QUERIES]
    total = len(tasks)
    workers = max(1, getattr(settings, "PARALLEL_WORKERS", 8))
    results, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(search_ebay, mk, q, token): (mk, q) for mk, q in tasks}
        for fut in as_completed(futures):
            done += 1
            print(f"\r  ricerche {done:>3}/{total} (parallele x{workers})   ", end="", flush=True)
            try:
                mk, q = futures[fut]
                for it in fut.result():
                    results.append((mk, q, it))
            except Exception as exc:
                _note_search_failure(exc)
    print(f"\r  ricerche {total}/{total} completate ✓{' ' * 18}")
    _report_search_stats()
    return results


# ─── PROCESSO PRINCIPALE ──────────────────────────────────────────────────────

def process(store, token, exclude_words, notify_all=False, cap_per_query=None):
    """notify_all=False → notifica solo i NUOVI. notify_all=True → manda anche i già visti
    (test --send-now). cap_per_query limita gli invii per ricerca (test)."""
    sent_ids, per_query = set(), {}
    examined = sent = 0
    for mk, q, item in gather_listings(token):
        item_id, title, price, currency, url, image = parse_summary(item)
        if not item_id or item_id in sent_ids:
            continue
        if not title_passes(title, settings.REQUIRE_WORDS, exclude_words):
            if not notify_all:
                store.mark_seen(item_id, title, price, currency, url, mk, q)
            continue
        if not notify_all and store.already_seen(item_id):
            continue
        if cap_per_query is not None and per_query.get(q, 0) >= cap_per_query:
            store.mark_seen(item_id, title, price, currency, url, mk, q)
            continue
        examined += 1
        print()  # a capo: stacca la notifica dalla riga di avanzamento
        send_telegram(title, price, currency, url, image, mk, f"ricerca: {q}")
        store.mark_seen(item_id, title, price, currency, url, mk, q)
        sent_ids.add(item_id); sent += 1
        per_query[q] = per_query.get(q, 0) + 1
        time.sleep(0.4)
    return examined, sent


def establish_baseline(store, token):
    total = 0
    for mk, q, item in gather_listings(token):
        item_id, title, price, currency, url, _ = parse_summary(item)
        if item_id and not store.already_seen(item_id):
            store.mark_seen(item_id, title, price, currency, url, mk, q)
            total += 1
    print(f"  Baseline: {total} annunci esistenti segnati come visti (non notificati).")


def run_once(send_now=False, cap_per_query=None):
    nq, nm = len(settings.SEARCH_QUERIES), len(settings.EBAY_MARKETPLACES)
    print("=" * 60)
    print(f"  Monster eBay Monitor — {nm} mercati × {nq} ricerche  |  finestra {settings.MAX_LISTING_AGE_HOURS}h")
    print("=" * 60)

    uri = os.environ.get("MONGODB_URI", "")
    if not uri:
        print("⚠️  Manca MONGODB_URI (Secret). Giro annullato."); return
    try:
        store = Store(uri)
    except Exception as exc:
        # Mongo giù: NON processare (rischieresti di rifare la baseline o spammare). Avvisa e esci.
        print(f"⚠️  MongoDB irraggiungibile: giro saltato. {exc}")
        _tg_text(f"⚠️ eBay Monitor: MongoDB irraggiungibile, giro saltato. {type(exc).__name__}")
        return

    drain_commands(store)   # OGNI giro (5 min): la parte reattiva

    # Ricerca eBay: solo se sono passati ≥ SWEEP_INTERVAL_SECONDS dall'ultimo sweep (o test).
    now = time.time()
    last = store.get_meta("last_sweep_at")
    if not sweep_due(last, now, settings.SWEEP_INTERVAL_SECONDS, send_now):
        wait = int((settings.SWEEP_INTERVAL_SECONDS - (now - last)) / 60)
        print(f"  Comandi drenati. Prossima ricerca eBay tra ~{wait} min.")
        return

    register_bot_ui(store)   # housekeeping UI: solo negli sweep, non ogni 5 min
    token = get_ebay_token()
    if not token:
        print("⚠️  Niente token eBay — vedi il messaggio [ERRORE]/[RETE] sopra."); return

    exclude_words = merge_blacklist(load_base_blacklist(), store.blacklist_additions())

    if not send_now and store.seen_count() == 0:
        print("Primo avvio: baseline (gli annunci già online non vengono notificati).")
        establish_baseline(store, token)
        store.set_meta("last_sweep_at", now)
        return

    examined, sent = process(store, token, exclude_words,
                             notify_all=send_now, cap_per_query=cap_per_query)
    if not send_now:                                # il test --send-now non altera la cadenza reale
        store.set_meta("last_sweep_at", now)
    print(f"  → {examined} candidati, {sent} notificati.")


if __name__ == "__main__":
    args = sys.argv[1:]
    try:
        if "--send-now" in args:
            if "--hours" in args:   # solo TEST: sovrascrive la finestra temporale
                j = args.index("--hours")
                try:
                    settings.MAX_LISTING_AGE_HOURS = float(args[j + 1])
                except (IndexError, ValueError):
                    print("⚠️  --hours richiede un numero (es. --hours 72). Ignorato.")
            i = args.index("--send-now")
            cap = int(args[i + 1]) if i + 1 < len(args) and args[i + 1].isdigit() else 10
            run_once(send_now=True, cap_per_query=cap)
        else:
            run_once()
    except KeyboardInterrupt:
        print("\nMonitor fermato.")
