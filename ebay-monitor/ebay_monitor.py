#!/usr/bin/env python3
"""
Monster Energy eBay Monitor — radar multi-mercato su Telegram (cloud, un giro per esecuzione).

Gira su GitHub Actions (schedule ogni 1h + trigger manuale). Ogni esecuzione:
  1. si connette a MongoDB (stato anti-duplicati); se è giù, salta il giro
  2. per ogni query × mercato cerca gli annunci "appena listati" e notifica i NUOVI su Telegram

I comandi Telegram (/add /list /market /delete) non passano più da qui: li gestisce
webhook_app.py, un servizio Render separato, istantaneo — vedi
docs/superpowers/specs/2026-09-15-ebay-monitor-telegram-webhook-design.md.

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
import html
import base64
import requests
import threading
from pathlib import Path
from datetime import timedelta, timezone, datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import settings
from bot_logic import Store, effective_markets, prune_expired_snoozes, _tg_text, _tg_url, _chat_id, _chat_ids

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


def title_passes(title, require_words, exclude_words, whitelist=()):
    """True se l'annuncio va notificato: contiene TUTTE le require_words e NESSUNA
    exclude_word (confronto case-insensitive) — a meno che il titolo non matchi anche
    una parola whitelist, che forza il passaggio anche su un hit della blacklist
    (i require_words restano comunque obbligatori)."""
    t = (title or "").lower()
    if not all(w.lower() in t for w in require_words):
        return False
    if any(w.lower() in t for w in whitelist):
        return True
    if any(w.lower() in t for w in exclude_words):
        return False
    return True


def sweep_due(last_sweep_at, now, interval, send_now=False):
    """True se è ora di fare la ricerca eBay: mai visto prima, test send_now, o è passato
    almeno 'interval' dall'ultimo sweep. Altrimenti il giro drena solo i comandi."""
    if send_now or last_sweep_at is None:
        return True
    return (now - last_sweep_at) >= interval


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
    params = {"q": query, "limit": "200", "sort": "newlyListed"}   # 200 = max Browse API
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

def _tg_post(method, data):
    """POST all'API Telegram con UN retry sul 429 (rate limit), rispettando retry_after:
    una raffica di annunci nello stesso giro può sforare il limite (~20 msg/min nei gruppi)."""
    r = requests.post(f"{_tg_url()}/{method}", data=data, timeout=25)
    if r.status_code == 429:
        retry_after = (r.json().get("parameters") or {}).get("retry_after", 1)
        time.sleep(min(retry_after, 30) + 0.1)
        r = requests.post(f"{_tg_url()}/{method}", data=data, timeout=25)
    return r


def send_telegram(title, price, currency, url, image_url, site, reason):
    """Manda la notifica a TUTTE le chat configurate (TELEGRAM_CHAT_ID, multi-chat/gruppo).
    True se è andata a buon fine su ALMENO una chat."""
    # parse_mode HTML: un '<' o '&' nudo nel titolo/URL farebbe rifiutare il messaggio.
    caption = (f"⚡ <b>{html.escape(title)}</b>\n💰 {price} {currency}\n"
               f"🌍 {site}  |  {html.escape(reason)}\n{html.escape(url)}")
    ok = False
    for chat_id in _chat_ids():
        try:
            if image_url:
                r = _tg_post("sendPhoto", {"chat_id": chat_id, "photo": image_url,
                                           "caption": caption, "parse_mode": "HTML"})
                if not (r.ok and r.json().get("ok")):
                    r = _tg_post("sendMessage", {"chat_id": chat_id, "text": caption,
                                                 "parse_mode": "HTML"})
            else:
                r = _tg_post("sendMessage", {"chat_id": chat_id, "text": caption,
                                             "parse_mode": "HTML"})
            chat_ok = r.ok and r.json().get("ok")
            ok = ok or chat_ok
            if not chat_ok:
                print(f"  ❌ {title[:50]}  Telegram ({chat_id}): {r.text[:120]}")
        except Exception as exc:
            print(f"  ❌ Errore Telegram ({chat_id}): {exc}")
    if ok:
        print(f"  ✅ {title[:50]}")
    return ok


# ─── RICERCHE + STATS ─────────────────────────────────────────────────────────

def _reset_search_stats():
    with _stats_lock:
        _search_stats["fail"] = 0
        _search_stats["last"] = None

def _report_search_stats(markets=None, queries=None):
    """A fine giro: se è fallita PIÙ DELLA METÀ delle ricerche, allarme Telegram
    (radar quasi/completamente cieco)."""
    if markets is None:
        markets = settings.EBAY_MARKETPLACES
    if queries is None:
        queries = settings.SEARCH_QUERIES
    total = len(markets) * len(queries)
    with _stats_lock:
        fail, last = _search_stats["fail"], _search_stats["last"]
    if not fail:
        return
    print(f"  [WARN] {fail}/{total} ricerche fallite in questo giro (ultimo errore: {last})")
    if fail * 2 > total:
        _tg_text(f"⚠️ eBay Monitor: {fail}/{total} ricerche FALLITE in questo giro — "
                 f"il radar è quasi cieco. Controlla chiavi/quota eBay. Ultimo errore: {last}")

def gather_listings(token, markets=None, queries=None):
    """Tutte le ricerche (mercati × query) IN PARALLELO → lista (mercato, query, item).
    A fine giro segnala i fallimenti."""
    if markets is None:
        markets = settings.EBAY_MARKETPLACES
    if queries is None:
        queries = settings.SEARCH_QUERIES
    _reset_search_stats()
    tasks = [(mk, q) for mk in markets for q in queries]
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
    _report_search_stats(markets, queries)
    return results


# ─── PROCESSO PRINCIPALE ──────────────────────────────────────────────────────

def process(store, token, exclude_words, notify_all=False, cap_per_query=None, markets=None,
            queries=None, whitelist=()):
    """notify_all=False → notifica solo i NUOVI. notify_all=True → manda anche i già visti
    (test --send-now). cap_per_query limita gli invii per ricerca (test)."""
    sent_ids, per_query = set(), {}
    examined = sent = 0
    to_notify = []
    for mk, q, item in gather_listings(token, markets, queries):
        item_id, title, price, currency, url, image = parse_summary(item)
        if not item_id or item_id in sent_ids:
            continue
        if not title_passes(title, settings.REQUIRE_WORDS, exclude_words, whitelist):
            if not notify_all:
                store.mark_seen(item_id, title, price, currency, url, mk, q)
            continue
        if not notify_all and store.already_seen(item_id):
            continue
        if cap_per_query is not None and per_query.get(q, 0) >= cap_per_query:
            store.mark_seen(item_id, title, price, currency, url, mk, q)
            continue
        examined += 1
        to_notify.append((item_id, title, price, currency, url, image, mk, q))
        sent_ids.add(item_id)
        per_query[q] = per_query.get(q, 0) + 1

    # Un messaggio per annuncio, sempre. Segnato "visto" SOLO se l'invio riesce: un invio
    # fallito (Telegram giù, 429 persistente) viene ritentato al giro dopo, non perso.
    for item_id, title, price, currency, url, image, mk, q in to_notify:
        print()  # a capo: stacca la notifica dalla riga di avanzamento
        if send_telegram(title, price, currency, url, image, mk, f"ricerca: {q}"):
            store.mark_seen(item_id, title, price, currency, url, mk, q, notified=True)
            sent += 1
        time.sleep(0.4)
    return examined, sent


def establish_baseline(store, token, markets=None, queries=None):
    total = 0
    for mk, q, item in gather_listings(token, markets, queries):
        item_id, title, price, currency, url, _ = parse_summary(item)
        if item_id and not store.already_seen(item_id):
            store.mark_seen(item_id, title, price, currency, url, mk, q)
            total += 1
    print(f"  Baseline: {total} annunci esistenti segnati come visti (non notificati).")


def run_once(send_now=False, cap_per_query=None):
    nq = len(settings.SEARCH_QUERIES)
    print("=" * 60)
    print(f"  Monster eBay Monitor — {nq} ricerche/mercato  |  finestra {settings.MAX_LISTING_AGE_HOURS}h")
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

    if store.get_meta("paused", False):
        print("  ⏸️  Monitor in pausa (/resume da Telegram per riattivare). Giro saltato.")
        return

    # Ricerca eBay: solo se sono passati ≥ SWEEP_INTERVAL_SECONDS dall'ultimo sweep (o test).
    # I comandi Telegram non passano più di qui: li gestisce webhook_app.py (Render), istantanei.
    now = time.time()
    last = store.get_meta("last_sweep_at")
    if not sweep_due(last, now, settings.SWEEP_INTERVAL_SECONDS * 0.9, send_now):
        wait = int((settings.SWEEP_INTERVAL_SECONDS - (now - last)) / 60)
        print(f"  Prossima ricerca eBay tra ~{wait} min.")
        return

    token = get_ebay_token()
    if not token:
        print("⚠️  Niente token eBay — vedi il messaggio [ERRORE]/[RETE] sopra."); return

    exclude_words = merge_blacklist(load_base_blacklist(), store.blacklist_additions())
    whitelist = store.whitelist_words()
    markets = effective_markets(settings.EBAY_MARKETPLACES, store.get_meta("market_override"))
    if not markets:                       # override corrotto (es. edit manuale) → non restare cieco
        markets = settings.EBAY_MARKETPLACES
    print(f"  Mercati attivi ({len(markets)}): {', '.join(markets)}")

    settings.MAX_PRICE_EUR = store.get_meta("max_price_eur", settings.MAX_PRICE_EUR)

    active_keywords = effective_markets(settings._KEYWORDS, store.get_meta("query_override"))
    if not active_keywords:               # override corrotto → non restare cieco
        active_keywords = settings._KEYWORDS
    raw_snoozes = store.get_meta("snoozes", {})
    snoozes = prune_expired_snoozes(raw_snoozes, now)
    if snoozes != raw_snoozes:             # qualche snooze è scaduto: riattivazione automatica
        store.set_meta("snoozes", snoozes)
    active_keywords = [kw for kw in active_keywords if kw not in snoozes]
    queries = [f"monster energy {kw}".strip() for kw in active_keywords]
    print(f"  Keyword attive ({len(queries)}).")

    if not send_now and store.seen_count() == 0:
        print("Primo avvio: baseline (gli annunci già online non vengono notificati).")
        establish_baseline(store, token, markets, queries)
        store.set_meta("last_sweep_at", now)
        return

    examined, sent = process(store, token, exclude_words, notify_all=send_now,
                             cap_per_query=cap_per_query, markets=markets, queries=queries,
                             whitelist=whitelist)
    if not send_now:                                # il test --send-now non altera la cadenza reale
        store.set_meta("last_sweep_at", now)
    print(f"  → {examined} candidati, {sent} notificati.")


def run_once_safe(*args, **kwargs):
    """Wrapper di run_once: su un crash imprevisto (non gestito dai try/except già presenti
    per Mongo/eBay/Telegram) avvisa su Telegram, poi RILANCIA — il job GitHub Actions resta
    'failed' e visibile, non lo mascheriamo mai. Ctrl+C passa senza alert (non è un crash)."""
    try:
        run_once(*args, **kwargs)
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        print(f"⚠️  CRASH: {type(exc).__name__}: {exc}")
        _tg_text(f"🔥 eBay Monitor: crash imprevisto ({type(exc).__name__}): {exc}")
        raise


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
            run_once_safe(send_now=True, cap_per_query=cap)
        else:
            run_once_safe()
    except KeyboardInterrupt:
        print("\nMonitor fermato.")
