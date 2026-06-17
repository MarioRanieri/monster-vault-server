#!/usr/bin/env python3
"""
Monster Energy eBay Monitor — radar multi-mercato su Telegram.

MODALITÀ ATTIVA (A) — ricerca per NOME:
  Per ogni query in config.SEARCH_QUERIES, su ogni mercato (config.EBAY_MARKETPLACES),
  notifica via Telegram i NUOVI annunci ("appena listati"). Niente confronto foto:
  immediato e gratis, ma più rumoroso (lo scremi tu).

MODALITÀ VLM (B) — DISATTIVA (idea nel cassetto):
  Se config.USE_VLM = True, prima di notificare confronta la foto dell'annuncio con le
  tue lattine di riferimento (watch=true sul sito + rare_cans/) usando un modello
  multimodale Anthropic e notifica solo i match. Per attivarla: vedi config.py (B).

Avvio:
  py ebay_monitor.py                            # monitoraggio continuo (notifica solo i NUOVI)
  py ebay_monitor.py --send-now                 # one-shot: manda subito gli annunci attuali (TEST)
  py ebay_monitor.py --send-now 10              # ...max 10 per ricerca
  py ebay_monitor.py --send-now 5 --hours 168   # ...per i TEST: ignora la finestra (qui ultimi 7 gg)
"""
import sys
import time
import base64
import sqlite3
import requests
import threading
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import config

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DB_FILE        = Path(__file__).parent / "seen_listings.db"
RARE_CANS_DIR  = Path(__file__).parent / "rare_cans"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
HTTP_HEADERS   = {"User-Agent": "Mozilla/5.0 (MonsterVaultMonitor)"}

EBAY_OAUTH_URL = {
    "production": "https://api.ebay.com/identity/v1/oauth2/token",
    "sandbox":    "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
}
EBAY_SEARCH_URL = {
    "production": "https://api.ebay.com/buy/browse/v1/item_summary/search",
    "sandbox":    "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search",
}
EBAY_ITEM_URL = {
    "production": "https://api.ebay.com/buy/browse/v1/item/",
    "sandbox":    "https://api.sandbox.ebay.com/buy/browse/v1/item/",
}


# ─── EBAY BROWSE API ──────────────────────────────────────────────────────────

_token_cache = {"token": None, "exp": 0.0}

# Fallimenti ricerche del giro corrente. Senza questo contatore il radar può "diventare
# cieco" in silenzio (es. token revocato → tutte le ricerche tornano vuote per sempre):
# a fine giro, se troppi fallimenti, lo segnaliamo a video e su Telegram.
_search_stats = {"fail": 0, "last": None}
_stats_lock = threading.Lock()

def _note_search_failure(exc):
    with _stats_lock:
        _search_stats["fail"] += 1
        _search_stats["last"] = exc

def get_ebay_token():
    """Token applicativo OAuth (client_credentials), cache finché valido."""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["exp"] - 60:
        return _token_cache["token"]
    basic = base64.b64encode(f"{config.EBAY_CLIENT_ID}:{config.EBAY_CLIENT_SECRET}".encode()).decode()
    try:
        r = requests.post(
            EBAY_OAUTH_URL[config.EBAY_ENV],
            headers={"Authorization": f"Basic {basic}",
                     "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials",
                  "scope": "https://api.ebay.com/oauth/api_scope"}, timeout=20)
        r.raise_for_status()
        j = r.json()
        _token_cache["token"] = j["access_token"]
        _token_cache["exp"] = now + int(j.get("expires_in", 7200))
        return _token_cache["token"]
    except Exception as exc:
        print(f"  [ERRORE] OAuth eBay fallito: {exc}")
        return None


def search_ebay(marketplace, query, token):
    """Cerca su UN mercato con UNA query (ordine: appena listati). Nessun filtro spedizione.
    Con config.MAX_LISTING_AGE_HOURS filtra lato eBay (itemStartDate) i SOLI annunci
    listati nelle ultime N ore → ricevi solo roba fresca."""
    params = {"q": query, "limit": "50", "sort": "newlyListed"}
    filters = []
    max_age = getattr(config, "MAX_LISTING_AGE_HOURS", None)
    if max_age:
        since = datetime.now(timezone.utc) - timedelta(hours=max_age)
        filters.append(f"itemStartDate:[{since.strftime('%Y-%m-%dT%H:%M:%S.000Z')}..]")
    if config.MAX_PRICE_EUR is not None:
        filters.append(f"price:[..{config.MAX_PRICE_EUR}],priceCurrency:EUR")
    if filters:
        params["filter"] = ",".join(filters)
    headers = {"Authorization": f"Bearer {token}",
               "X-EBAY-C-MARKETPLACE-ID": marketplace,
               "Content-Type": "application/json"}
    try:
        r = requests.get(EBAY_SEARCH_URL[config.EBAY_ENV], params=params, headers=headers, timeout=25)
        if r.status_code == 429:   # rate limit eBay: pausa e UN retry
            print(f"\n  [WARN] eBay 429 (rate limit) su {marketplace} '{query}' — riprovo tra 30s")
            time.sleep(30)
            r = requests.get(EBAY_SEARCH_URL[config.EBAY_ENV], params=params, headers=headers, timeout=25)
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


# ─── DATABASE (anti-duplicati) ────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen (
            item_id TEXT PRIMARY KEY, title TEXT, price REAL, currency TEXT,
            url TEXT, site TEXT, query TEXT, seen_at TEXT DEFAULT (datetime('now'))
        )""")
    conn.commit()
    return conn

def already_seen(conn, item_id):
    return conn.execute("SELECT 1 FROM seen WHERE item_id=?", (item_id,)).fetchone() is not None

def mark_seen(conn, item_id, title, price, currency, url, site, query):
    try:
        price_val = float(price or 0)
    except (TypeError, ValueError):
        price_val = 0.0   # prezzo malformato da eBay: non deve bloccare il mark_seen (rinotifica infinita)
    conn.execute(
        "INSERT OR IGNORE INTO seen (item_id,title,price,currency,url,site,query)"
        " VALUES (?,?,?,?,?,?,?)",
        (item_id, title, price_val, currency, url, site, query))
    conn.commit()


# ─── TELEGRAM ─────────────────────────────────────────────────────────────────

def send_telegram(title, price, currency, url, image_url, site, reason):
    caption = f"⚡ <b>{title}</b>\n💰 {price} {currency}\n🌍 {site}  |  {reason}\n{url}"
    api = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"
    try:
        if image_url:
            r = requests.post(f"{api}/sendPhoto",
                              data={"chat_id": config.TELEGRAM_CHAT_ID, "photo": image_url,
                                    "caption": caption, "parse_mode": "HTML"}, timeout=25)
            if not (r.ok and r.json().get("ok")):
                r = requests.post(f"{api}/sendMessage",
                                  data={"chat_id": config.TELEGRAM_CHAT_ID, "text": caption,
                                        "parse_mode": "HTML"}, timeout=25)
        else:
            r = requests.post(f"{api}/sendMessage",
                              data={"chat_id": config.TELEGRAM_CHAT_ID, "text": caption,
                                    "parse_mode": "HTML"}, timeout=25)
        ok = r.ok and r.json().get("ok")
        print(("  ✅ " if ok else "  ❌ ") + f"{title[:50]}" + ("" if ok else f"  Telegram: {r.text[:120]}"))
        return ok
    except Exception as exc:
        print(f"  ❌ Errore Telegram: {exc}")
        return False

def notify(title, price, currency, url, image_url, site, reason):
    methods = [m.strip().lower() for m in (getattr(config, "NOTIFY_VIA", "telegram") or "").split(",")]
    if "telegram" in methods:
        send_telegram(title, price, currency, url, image_url, site, reason)


# ─── TELEGRAM: comando /delete (listener in un thread) ─────────────────────────
# Mentre il monitor gira, un thread ascolta i comandi in chat. Con /delete il bot
# cancella i propri messaggi recenti. ⚠️ Telegram permette a un bot di eliminare SOLO
# i propri messaggi e SOLO se inviati da meno di 48 ore.

def _tg_url():
    return f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"

def _tg_text(text):
    """Manda un messaggio di servizio (semplice testo) nella chat."""
    try:
        requests.post(f"{_tg_url()}/sendMessage",
                      data={"chat_id": config.TELEGRAM_CHAT_ID, "text": text}, timeout=15)
    except Exception:
        pass

def delete_bot_messages(up_to_id):
    """Cancella a ritroso i messaggi del bot prima di up_to_id (fino a DELETE_SCAN_BACK).
    Telegram rifiuta quelli non del bot o più vecchi di 48h: contiamo solo i cancellati."""
    scan = getattr(config, "DELETE_SCAN_BACK", 300)
    deleted = 0
    for mid in range(up_to_id - 1, max(0, up_to_id - scan - 1), -1):
        try:
            r = requests.post(f"{_tg_url()}/deleteMessage",
                              data={"chat_id": config.TELEGRAM_CHAT_ID, "message_id": mid}, timeout=15)
            if r.ok and r.json().get("ok"):
                deleted += 1
        except Exception:
            pass
        time.sleep(0.05)   # gentile col rate limit Telegram
    return deleted

def telegram_command_listener():
    """[Thread daemon] Long-polling getUpdates: gestisce /delete dalla chat autorizzata."""
    url = _tg_url()
    try:   # mostra /delete nel menu comandi del bot (UX)
        requests.post(f"{url}/setMyCommands",
                      json={"commands": [{"command": "delete",
                                          "description": "Cancella i messaggi inviati dal bot"}]}, timeout=15)
    except Exception:
        pass
    def _drain():
        """Salta gli update arretrati: ritorna l'offset successivo all'ultimo (0 = coda vuota),
        None se il drenaggio fallisce — in quel caso NON va processato nulla (si riprova)."""
        try:
            ups0 = requests.get(f"{url}/getUpdates", params={"timeout": 0}, timeout=20).json().get("result", [])
            return (ups0[-1]["update_id"] + 1) if ups0 else 0
        except Exception:
            return None

    # drena gli update arretrati: MAI eseguire comandi inviati PRIMA dell'avvio
    offset = _drain()
    while True:
        try:
            if offset is None:        # drenaggio fallito: riprova prima di processare qualsiasi cosa
                time.sleep(10)
                offset = _drain()
                continue
            params = {"timeout": 50}
            if offset:                # 0 = coda vuota al boot: nessun offset da passare
                params["offset"] = offset
            ups = requests.get(f"{url}/getUpdates", params=params, timeout=60).json().get("result", [])
            for u in ups:
                offset = u["update_id"] + 1
                msg = u.get("message") or {}
                text = (msg.get("text") or "").strip().lower()
                chat_id = str((msg.get("chat") or {}).get("id", ""))
                if chat_id != str(config.TELEGRAM_CHAT_ID) or not text.startswith("/delete"):
                    continue
                cmd_id = msg.get("message_id", 0)
                n = delete_bot_messages(cmd_id)
                try:   # cancella anche il comando /delete stesso
                    requests.post(f"{url}/deleteMessage",
                                  data={"chat_id": config.TELEGRAM_CHAT_ID, "message_id": cmd_id}, timeout=15)
                except Exception:
                    pass
                _tg_text(f"🗑️ Cancellati {n} messaggi del bot." if n else
                         "Niente da cancellare (i messaggi oltre 48h non sono eliminabili da un bot).")
        except Exception:
            time.sleep(5)


# ─── (B) VERIFICA VLM — DISATTIVA (attivala da config.USE_VLM) ────────────────
# Confronta la foto dell'annuncio con le lattine di riferimento e ritorna True solo
# se il modello multimodale conferma che è la stessa lattina. Richiede `pip install
# anthropic` + config.ANTHROPIC_API_KEY. È uno scheletro: la prompt va rifinita
# quando si attiva B.

def _fetch_bytes(url):
    try:
        r = requests.get(url, timeout=15, headers=HTTP_HEADERS); r.raise_for_status()
        return r.content
    except Exception:
        return None

def load_reference_images():
    """[B] Lattine di riferimento: watch=true sul sito (1 foto l'una) + rare_cans/."""
    refs = []
    try:
        for c in requests.get(config.SITE_API_URL, timeout=30, headers=HTTP_HEADERS).json():
            if not c.get("watch"):
                continue
            nome = c.get("nome") or c.get("sku") or c.get("id") or "?"
            for slot in ("p1", "p2", "p3", "p4"):
                if c.get(slot):
                    b = _fetch_bytes(c[slot])
                    if b:
                        refs.append((nome, b)); break
    except Exception as exc:
        print(f"  [WARN] referenze dal sito: {exc}")
    for p in sorted(RARE_CANS_DIR.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES:
            try:
                refs.append((p.parent.name if p.parent != RARE_CANS_DIR else p.stem, p.read_bytes()))
            except Exception:
                pass
    return refs

def _img_media_type(b):
    """Media type dai magic bytes (jpeg/png/webp/gif) — l'API rifiuta il tipo sbagliato."""
    if b[:3] == b"\xff\xd8\xff":                 return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":            return "image/png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":  return "image/webp"
    if b[:4] == b"GIF8":                         return "image/gif"
    return "image/jpeg"

def vlm_match(listing_image_url, references):
    """[B] True se il VLM conferma che l'annuncio mostra UNA delle lattine di riferimento:
    confronta la foto dell'annuncio con OGNI referenza e si ferma al primo match.
    Scheletro: prompt da rifinire al primo utilizzo reale."""
    if not references or not listing_image_url:
        return False
    import anthropic  # pip install anthropic
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    img = _fetch_bytes(listing_image_url)
    if not img:
        return False
    def b64(b): return base64.standard_b64encode(b).decode()
    listing_block = {"type": "image",
                     "source": {"type": "base64", "media_type": _img_media_type(img), "data": b64(img)}}
    for ref_label, ref_bytes in references:
        try:
            resp = client.messages.create(
                model=config.VLM_MODEL, max_tokens=50,
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": f"Prima foto = lattina di riferimento ('{ref_label}'). "
                                             "Seconda = annuncio eBay. È la STESSA identica lattina "
                                             "(stesso design/variante)? Rispondi solo SI o NO."},
                    {"type": "image", "source": {"type": "base64",
                                                 "media_type": _img_media_type(ref_bytes),
                                                 "data": b64(ref_bytes)}},
                    listing_block,
                ]}])
            ans = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip().upper()
            if ans.startswith("SI") or ans.startswith("YES"):
                return True
        except Exception as exc:
            print(f"  [WARN] VLM ({ref_label}): {exc}")
    return False


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def iter_listings(token, label=""):
    """Itera (mercato, query, annuncio) su tutti i mercati × ricerche, mostrando
    l'avanzamento IN-PLACE (così vedi che sta lavorando, mercato per mercato)."""
    nq = len(config.SEARCH_QUERIES)
    pfx = f"{label} " if label else ""
    for mk in config.EBAY_MARKETPLACES:
        for idx, q in enumerate(config.SEARCH_QUERIES, 1):
            print(f"\r  {pfx}{mk:<8} [{idx:>2}/{nq}] {q[:30]:<30}", end="", flush=True)
            for it in search_ebay(mk, q, token):
                yield mk, q, it
        print(f"\r  {pfx}{mk:<8} [{nq:>2}/{nq}] completato ✓{' ' * 24}")


def fetch_all(token, label=""):
    """[Opzione B] Esegue TUTTE le ricerche (mercati × query) IN PARALLELO →
    un giro completo in ~15-25s invece di ~3,5 min. Ritorna lista (mercato, query, item)."""
    tasks = [(mk, q) for mk in config.EBAY_MARKETPLACES for q in config.SEARCH_QUERIES]
    total = len(tasks)
    workers = max(1, getattr(config, "PARALLEL_WORKERS", 8))
    pfx = f"{label} " if label else ""
    results, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(search_ebay, mk, q, token): (mk, q) for mk, q in tasks}
        for fut in as_completed(futures):
            done += 1
            print(f"\r  {pfx}ricerche {done:>3}/{total} (parallele x{workers})   ", end="", flush=True)
            try:
                mk, q = futures[fut]
                for it in fut.result():
                    results.append((mk, q, it))
            except Exception as exc:
                _note_search_failure(exc)
    print(f"\r  {pfx}ricerche {total}/{total} completate ✓{' ' * 18}")
    return results


def _reset_search_stats():
    with _stats_lock:
        _search_stats["fail"] = 0
        _search_stats["last"] = None

def _report_search_stats():
    """A fine giro: se ci sono stati fallimenti li stampa; se è fallita PIÙ DELLA METÀ
    delle ricerche manda anche un allarme Telegram (radar quasi/completamente cieco)."""
    total = len(config.EBAY_MARKETPLACES) * len(config.SEARCH_QUERIES)
    with _stats_lock:
        fail, last = _search_stats["fail"], _search_stats["last"]
    if not fail:
        return
    print(f"  [WARN] {fail}/{total} ricerche fallite in questo giro (ultimo errore: {last})")
    if fail * 2 > total:
        _tg_text(f"⚠️ eBay Monitor: {fail}/{total} ricerche FALLITE in questo giro — "
                 f"il radar è quasi cieco. Controlla chiavi/quota eBay. Ultimo errore: {last}")

def gather_listings(token, label=""):
    """Annunci di tutti i mercati × ricerche: in PARALLELO (opzione B) o sequenziale,
    secondo config.PARALLEL_SEARCH. A fine giro segnala gli eventuali fallimenti."""
    _reset_search_stats()
    if getattr(config, "PARALLEL_SEARCH", True):
        res = fetch_all(token, label)
        _report_search_stats()
        return res
    def _seq():
        for tup in iter_listings(token, label):
            yield tup
        _report_search_stats()
    return _seq()

def process(conn, token, notify_all, cap_per_query=None):
    """notify_all=False → notifica solo i NUOVI. notify_all=True → manda anche gli
    annunci già esistenti (test 'send-now'). cap_per_query limita gli invii per ricerca."""
    refs = load_reference_images() if config.USE_VLM else []
    if config.USE_VLM:
        print(f"  [B] VLM attivo ({config.VLM_MODEL}): {len(refs)} referenze.")
    sent_ids, per_query = set(), {}
    examined = sent = 0
    for mk, q, item in gather_listings(token):
        item_id, title, price, currency, url, image = parse_summary(item)
        if not item_id or item_id in sent_ids:
            continue
        # Filtri sul titolo: PRETENDI le parole obbligatorie (REQUIRE_WORDS, di default
        # "monster"+"energy" — eBay non fa un AND stretto) e scarta il rumore (EXCLUDE_WORDS).
        title_l = (title or "").lower()
        if not all(w.lower() in title_l for w in getattr(config, "REQUIRE_WORDS", ())) \
           or any(w.lower() in title_l for w in getattr(config, "EXCLUDE_WORDS", ())):
            if not notify_all:
                mark_seen(conn, item_id, title, price, currency, url, mk, q)
            continue
        if not notify_all and already_seen(conn, item_id):
            continue
        if cap_per_query is not None and per_query.get(q, 0) >= cap_per_query:
            mark_seen(conn, item_id, title, price, currency, url, mk, q)
            continue
        examined += 1
        if config.USE_VLM and not vlm_match(image, refs):
            mark_seen(conn, item_id, title, price, currency, url, mk, q)
            continue
        reason = f"VLM match · {q}" if config.USE_VLM else f"ricerca: {q}"
        print()  # a capo: stacca la notifica dalla riga di avanzamento
        notify(title, price, currency, url, image, mk, reason)
        mark_seen(conn, item_id, title, price, currency, url, mk, q)
        sent_ids.add(item_id); sent += 1
        per_query[q] = per_query.get(q, 0) + 1
        time.sleep(0.4)
    return examined, sent

def establish_baseline(conn, token):
    total = 0
    for mk, q, item in gather_listings(token, label="Baseline"):
        item_id, title, price, currency, url, _ = parse_summary(item)
        if item_id and not already_seen(conn, item_id):
            mark_seen(conn, item_id, title, price, currency, url, mk, q); total += 1
    print(f"  Baseline: {total} annunci esistenti segnati come visti (non notificati).")

def _prevent_sleep(enable=True):
    """[Windows] Impedisce lo standby AUTOMATICO (per inattività) mentre il monitor gira.
    NON blocca la sospensione MANUALE / chiusura coperchio. No-op su altri OS."""
    try:
        import ctypes
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(
            ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if enable else 0))
    except Exception:
        pass


def _countdown(seconds):
    """Attesa col TIMER visibile. Basato sulla deadline: se il PC va in standby, al
    risveglio si accorge che il tempo è passato e riparte subito."""
    deadline = time.time() + seconds
    try:
        while True:
            rem = int(round(deadline - time.time()))
            if rem <= 0:
                break
            mm, ss = divmod(rem, 60)
            print(f"\r  ⏳ prossimo giro tra {mm:02d}:{ss:02d}   (Ctrl+C per fermare)   ", end="", flush=True)
            time.sleep(1)
    finally:
        print("\r" + " " * 52 + "\r", end="", flush=True)


def run():
    nq, nm = len(config.SEARCH_QUERIES), len(config.EBAY_MARKETPLACES)
    print("=" * 60)
    print(f"  Monster eBay Monitor — {nm} mercati × {nq} ricerche")
    mode = "VLM (B)" if config.USE_VLM else "ricerca per nome (A)"
    par = f"parallelo x{getattr(config, 'PARALLEL_WORKERS', 8)}" if getattr(config, "PARALLEL_SEARCH", True) else "sequenziale"
    print(f"  Modalità: {mode}  |  {par}  |  polling {config.POLL_INTERVAL_SECONDS // 60} min")
    print("=" * 60)
    _prevent_sleep(True)   # evita lo standby AUTOMATICO mentre gira (non la sospensione manuale)
    threading.Thread(target=telegram_command_listener, daemon=True).start()
    print("  Comando Telegram /delete attivo (cancella i messaggi del bot < 48h).")
    conn = init_db()
    if not get_ebay_token():
        print("⚠️  Niente token eBay (controlla Client ID/Secret in config.py)."); return
    if conn.execute("SELECT COUNT(*) FROM seen").fetchone()[0] == 0:
        print("Primo avvio: baseline (gli annunci già online non vengono notificati).")
        establish_baseline(conn, get_ebay_token())
    while True:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{ts}] Controllo...")
        token = get_ebay_token()
        if token:
            examined, sent = process(conn, token, notify_all=False)
            print(f"  → {examined} nuovi, {sent} notificati.")
        _countdown(config.POLL_INTERVAL_SECONDS)

def send_now(cap_per_query=10):
    print(f"Invio one-shot (TEST): max {cap_per_query} annunci/ricerca su {len(config.EBAY_MARKETPLACES)} mercati...\n")
    conn = init_db()
    token = get_ebay_token()
    if not token:
        print("⚠️  Niente token eBay."); return
    examined, sent = process(conn, token, notify_all=True, cap_per_query=cap_per_query)
    print(f"\n→ Inviati {sent} annunci su Telegram (esaminati {examined}).")


if __name__ == "__main__":
    try:
        args = sys.argv[1:]
        if "--send-now" in args:
            # --hours N: solo per i TEST, sovrascrive la finestra temporale (es. ultimi 7 giorni)
            if "--hours" in args:
                j = args.index("--hours")
                try:
                    config.MAX_LISTING_AGE_HOURS = float(args[j + 1])
                except (IndexError, ValueError):
                    print("⚠️  --hours richiede un numero (es. --hours 72). Opzione ignorata.")
            # cap = numero subito dopo --send-now (default 10)
            i = args.index("--send-now")
            cap = int(args[i + 1]) if i + 1 < len(args) and args[i + 1].isdigit() else 10
            send_now(cap_per_query=cap)
        else:
            run()
    except KeyboardInterrupt:
        print("\nMonitor fermato.")
