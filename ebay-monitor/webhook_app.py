"""Webhook Telegram per i comandi del bot (/add /list /market /delete): servizio
Render separato dal sito (backend/) e dallo sweep eBay (ebay_monitor.py, GitHub
Actions) — riceve gli update istantaneamente invece di aspettare un giro cron.
Condivide bot_logic.py (Store + logica comandi) con lo sweep: stessa Mongo,
stesso comportamento, solo trigger diverso. Vedi docs/superpowers/specs/
2026-09-15-ebay-monitor-telegram-webhook-design.md.

Avvio locale: py webhook_app.py (dev server Flask). In produzione: gunicorn
webhook_app:app --bind 0.0.0.0:$PORT (Render Web Service, root ebay-monitor/).
"""
import os
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import requests
from flask import Flask, request

import settings
from bot_logic import (
    Store, parse_command, validate_add_word, resolve_marketplace,
    apply_market_change, effective_markets, daily_ebay_calls, prune_expired_snoozes,
    _tg_text, _tg_url, _tg_token, _chat_id, _chat_ids,
)

app = Flask(__name__)

_store = None

def get_store():
    """Store lazy singleton: creato al primo comando, non all'avvio del processo
    (così l'app parte anche se MONGODB_URI non è ancora impostata/raggiungibile —
    fallirebbe solo al primo comando, con un messaggio chiaro, non al boot)."""
    global _store
    if _store is None:
        _store = Store(os.environ.get("MONGODB_URI", ""))
    return _store


# ─── file in chat: /export /import della blacklist dinamica ───────────────────

def _tg_send_document(filename, content, caption=None):
    """Manda un file come documento, a TUTTE le chat configurate (es. /export)."""
    for chat_id in _chat_ids():
        try:
            data = {"chat_id": chat_id}
            if caption:
                data["caption"] = caption
            requests.post(f"{_tg_url()}/sendDocument", data=data,
                          files={"document": (filename, content)}, timeout=30)
        except Exception:
            pass

def _tg_download_document(file_id):
    """Scarica un file allegato in chat (es. /import). None se non disponibile."""
    try:
        r = requests.get(f"{_tg_url()}/getFile", params={"file_id": file_id}, timeout=15)
        path = (r.json().get("result") or {}).get("file_path")
        if not path:
            return None
        dl = requests.get(f"https://api.telegram.org/file/bot{_tg_token()}/{path}", timeout=20)
        return dl.content
    except Exception:
        return None


# ─── /delete: cancellazione messaggi del bot ───────────────────────────────────

def _delete_one(mid, chat_id):
    """True se il messaggio è stato cancellato. Un retry sul 429 rispettando retry_after.
    chat_id esplicito (mai globale): i message_id sono una sequenza PER CHAT in Telegram —
    cancellare l'id sbagliato nella chat sbagliata colpirebbe messaggi a caso (multi-chat)."""
    for attempt in (1, 2):
        try:
            r = requests.post(f"{_tg_url()}/deleteMessage",
                              data={"chat_id": chat_id, "message_id": mid}, timeout=15)
            if r.status_code == 429 and attempt == 1:
                retry_after = (r.json().get("parameters") or {}).get("retry_after", 1)
                time.sleep(min(retry_after, 30) + 0.1)
                continue
            return bool(r.ok and r.json().get("ok"))
        except Exception:
            return False
    return False

def delete_bot_messages(up_to_id, protected=(), chat_id=None):
    """Cancella a ritroso i messaggi del bot prima di up_to_id (fino a DELETE_SCAN_BACK),
    SOLO nella chat che ha mandato /delete (chat_id esplicito, vedi _delete_one).
    Telegram rifiuta quelli non del bot o più vecchi di 48h: contiamo solo i cancellati."""
    chat_id = chat_id or _chat_id()
    scan = getattr(settings, "DELETE_SCAN_BACK", 300)
    workers = getattr(settings, "DELETE_WORKERS", 12)
    protected = set(protected)
    ids = [i for i in range(up_to_id - 1, max(0, up_to_id - scan - 1), -1) if i not in protected]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return sum(ex.map(lambda mid: _delete_one(mid, chat_id), ids))


# ─── dispatch comandi ──────────────────────────────────────────────────────────

def _handle_command(store, cmd, arg, msg_id, document=None, chat_id=None):
    """Esegue un comando. Ritorna True se gestito (per il log)."""
    if cmd == "export":
        words = sorted(store.blacklist_additions())
        if not words:
            _tg_text("ℹ️ nessuna parola dinamica da esportare")
            return True
        content = ("\n".join(words) + "\n").encode("utf-8")
        _tg_send_document("blacklist_dinamica.txt", content, caption=f"{len(words)} parole dinamiche")
        print(f"  [/export] {len(words)} parole")
        return True
    if cmd == "import":
        if not document:
            _tg_text("⚠️ allega un file .txt con didascalia /import")
            return True
        content = _tg_download_document(document.get("file_id", ""))
        if content is None:
            _tg_text("⚠️ impossibile scaricare il file, riprova")
            return True
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            _tg_text("⚠️ file non leggibile (serve testo UTF-8)")
            return True
        existing = {w.lower() for w in store.blacklist_additions()}
        added = ignored = 0
        for line in text.splitlines():
            word = line.strip().lower()
            if not word:
                continue
            ok, _reason = validate_add_word(word, settings.REQUIRE_WORDS)
            if not ok or word in existing:
                ignored += 1
                continue
            store.add_blacklist_word(word)
            existing.add(word)
            added += 1
        _tg_text(f"✅ import completato: {added} aggiunte, {ignored} ignorate "
                  f"(vuote/non valide/già presenti)")
        print(f"  [/import] {added} aggiunte, {ignored} ignorate")
        return True
    if cmd == "delete":
        n = delete_bot_messages(msg_id, chat_id=chat_id)
        _delete_one(msg_id, chat_id or _chat_id())
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
    if cmd == "remove":
        word = arg.strip().lower()
        if store.remove_blacklist_word(word):
            tot = len(store.blacklist_additions())
            _tg_text(f"✅ rimossa '{word}' dalla blacklist (ora {tot} parole dinamiche)")
            print(f"  [/remove] '{word}' rimossa ({tot} dinamiche)")
        else:
            _tg_text(f"⚠️ '{word}' non è nella blacklist dinamica")
            print(f"  [/remove] '{word}' non trovata")
        return True
    if cmd == "snooze":
        parts = arg.split()
        if len(parts) != 2:
            _tg_text("⚠️ uso: /snooze <parola> <ore>")
            return True
        word = parts[0].strip().lower()
        try:
            hours = float(parts[1])
            if hours <= 0:
                raise ValueError
        except ValueError:
            _tg_text(f"⚠️ '{parts[1]}' non è un numero di ore valido")
            return True
        snoozes = prune_expired_snoozes(store.get_meta("snoozes", {}), time.time())
        snoozes[word] = time.time() + hours * 3600
        store.set_meta("snoozes", snoozes)
        _tg_text(f"✅ '{word}' in snooze per {hours:g}h (si riattiva da sola allo scadere)")
        print(f"  [/snooze] '{word}' snoozata {hours:g}h")
        return True
    if cmd == "whitelist":
        parts = arg.split(maxsplit=1)
        action = parts[0].lower() if parts else "list"
        if action == "list" or not parts:
            words = sorted(store.whitelist_words())
            if words:
                _tg_text("✅🗒️ Parole whitelist (forzano il passaggio anche su un hit blacklist):\n"
                          + "\n".join(words))
            else:
                _tg_text("✅🗒️ Nessuna parola in whitelist.")
            return True
        if action not in ("add", "remove") or len(parts) < 2:
            _tg_text("⚠️ uso: /whitelist list · /whitelist add <parola> · /whitelist remove <parola>")
            return True
        word = parts[1].strip().lower()
        if action == "add":
            store.add_whitelist_word(word)
            _tg_text(f"✅ '{word}' aggiunta alla whitelist")
            print(f"  [/whitelist] '{word}' aggiunta")
        else:
            if store.remove_whitelist_word(word):
                _tg_text(f"✅ '{word}' rimossa dalla whitelist")
                print(f"  [/whitelist] '{word}' rimossa")
            else:
                _tg_text(f"⚠️ '{word}' non è in whitelist")
                print(f"  [/whitelist] '{word}' non trovata")
        return True
    if cmd == "price":
        cap = store.get_meta("max_price_eur", settings.MAX_PRICE_EUR)
        parts = arg.split()
        if not parts:
            shown = "nessun tetto" if cap is None else f"{cap:g} EUR"
            _tg_text(f"💰 Tetto prezzo attuale: {shown}\n\nUso: /price max <valore> · /price max none")
            return True
        if parts[0].lower() != "max" or len(parts) < 2:
            _tg_text("⚠️ uso: /price max <valore> · /price max none")
            return True
        raw = parts[1].strip().lower()
        if raw in ("none", "off", "0"):
            store.set_meta("max_price_eur", None)
            _tg_text("✅ tetto prezzo rimosso: nessun limite")
            print("  [/price] tetto rimosso")
            return True
        try:
            value = float(raw)
            if value <= 0:
                raise ValueError
        except ValueError:
            _tg_text(f"⚠️ '{parts[1]}' non è un prezzo valido (numero positivo, o 'none')")
            return True
        store.set_meta("max_price_eur", value)
        _tg_text(f"✅ tetto prezzo impostato: {value:g} EUR")
        print(f"  [/price] tetto impostato a {value:g} EUR")
        return True
    if cmd == "query":
        override = store.get_meta("query_override")
        parts = arg.split()
        if not parts or parts[0].lower() == "list":
            active = effective_markets(settings._KEYWORDS, override)
            _tg_text(f"🔎 Keyword attive ({len(active)}):\n" + "\n".join(active or ["(nessuna!)"])
                     + "\n\nUso: /query add <parola> · /query remove <parola> · /query list")
            print(f"  [/query] lista: {len(active)} keyword")
            return True
        action = parts[0].lower()
        if action not in ("add", "remove"):
            _tg_text("⚠️ uso: /query · /query add <parola> · /query remove <parola> · /query list")
            return True
        raw = " ".join(parts[1:]).strip().lower()
        if not raw:
            _tg_text("⚠️ uso: /query add <parola> · /query remove <parola>")
            return True
        new_override, ok, msg = apply_market_change(override, action, raw, settings._KEYWORDS)
        if ok:
            store.set_meta("query_override", new_override)
            active = effective_markets(settings._KEYWORDS, new_override)
            n_markets = len(effective_markets(settings.EBAY_MARKETPLACES, store.get_meta("market_override")))
            calls = daily_ebay_calls(n_markets, n_queries=len(active))
            warn = ""
            if calls > 0.8 * settings.EBAY_DAILY_BUDGET:
                warn = (f"\n⚠️ ~{calls} chiamate eBay/giorno (limite ~{settings.EBAY_DAILY_BUDGET}): "
                        f"vicino al tetto.")
            _tg_text(f"✅ {msg}\n🔎 keyword attive ora ({len(active)}){warn}")
            print(f"  [/query] {msg} → {len(active)} attive (~{calls} chiamate/giorno)")
        else:
            _tg_text(f"⚠️ {msg}")
            print(f"  [/query] rifiutato: {msg}")
        return True
    if cmd == "pause":
        store.set_meta("paused", True)
        _tg_text("⏸️ Controllo eBay e notifiche in pausa. Riprendi con /resume.")
        print("  [/pause] attivata")
        return True
    if cmd == "resume":
        store.set_meta("paused", False)
        _tg_text("▶️ Controllo eBay e notifiche riattivati.")
        print("  [/resume] disattivata")
        return True
    if cmd == "status":
        last = store.get_meta("last_sweep_at")
        if last is None:
            sweep_line = "🕐 Ultimo controllo eBay: mai eseguito"
        else:
            last_dt = datetime.fromtimestamp(last, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            eta_min = max(0, int((settings.SWEEP_INTERVAL_SECONDS - (time.time() - last)) / 60))
            sweep_line = f"🕐 Ultimo controllo eBay: {last_dt}\n⏳ Prossimo giro: ~{eta_min} min"
        paused = "sì" if store.get_meta("paused", False) else "no"
        _tg_text(f"📡 Stato monitor\n{sweep_line}\n👀 Annunci visti: {store.seen_count()}\n"
                 f"⏸️ In pausa: {paused}")
        print("  [/status] inviato")
        return True
    if cmd == "help":
        lines = [f"/{c['command']} — {c['description']}" for c in BOT_COMMANDS]
        _tg_text("📋 Comandi disponibili:\n" + "\n".join(lines))
        print(f"  [/help] {len(lines)} comandi elencati")
        return True
    if cmd == "list":
        words = sorted(store.blacklist_additions())
        if words:
            _tg_text("🗒️ Parole dinamiche (aggiunte via /add):\n" + "\n".join(words))
        else:
            _tg_text("🗒️ Nessuna parola dinamica: la blacklist è solo quella di base (blacklist.txt).")
        print(f"  [/list] {len(words)} parole dinamiche")
        return True
    if cmd == "market":
        override = store.get_meta("market_override")
        parts = arg.split()
        if not parts:
            active = effective_markets(settings.EBAY_MARKETPLACES, override)
            _tg_text(f"🌍 Mercati attivi ({len(active)}):\n" + "\n".join(active)
                     + "\n\nUso: /market add <paese> · /market remove <paese>  (es. uk, it, de, fr)")
            print(f"  [/market] lista: {len(active)} mercati")
            return True
        action = parts[0].lower()
        if action not in ("add", "remove"):
            _tg_text("⚠️ uso: /market · /market add <paese> · /market remove <paese>")
            return True
        raw = " ".join(parts[1:])
        target = resolve_marketplace(raw)
        if not target:
            _tg_text(f"⚠️ mercato non valido: '{raw}'. Esempi: uk, it, de, us, fr, es, ca, au…")
            print(f"  [/market] {action} rifiutato: '{raw}' non valido")
            return True
        new_override, ok, msg = apply_market_change(override, action, target, settings.EBAY_MARKETPLACES)
        if ok:
            store.set_meta("market_override", new_override)
            active = effective_markets(settings.EBAY_MARKETPLACES, new_override)
            calls = daily_ebay_calls(len(active))
            warn = ""
            if calls > 0.8 * settings.EBAY_DAILY_BUDGET:
                warn = (f"\n⚠️ ~{calls} chiamate eBay/giorno (limite ~{settings.EBAY_DAILY_BUDGET}): "
                        f"vicino al tetto, occhio ad aggiungerne altri.")
            _tg_text(f"✅ {msg}\n🌍 attivi ora ({len(active)}): {', '.join(active)}{warn}")
            print(f"  [/market] {msg} → {len(active)} attivi (~{calls} chiamate/giorno)")
        else:
            _tg_text(f"⚠️ {msg}")
            print(f"  [/market] rifiutato: {msg}")
        return True
    return False


# ─── menu comandi "/" (registrato una volta per processo, idempotente) ────────

BOT_COMMANDS = [
    {"command": "delete", "description": "Cancella i messaggi inviati dal bot"},
    {"command": "add",    "description": "Aggiungi una parola alla blacklist"},
    {"command": "help",   "description": "Elenco comandi disponibili"},
    {"command": "status", "description": "Stato: ultimo controllo eBay, prossimo giro, annunci visti"},
    {"command": "pause",  "description": "Sospendi temporaneamente il controllo eBay e le notifiche"},
    {"command": "resume", "description": "Riattiva il controllo eBay e le notifiche"},
    {"command": "remove", "description": "Rimuovi una parola dalla blacklist dinamica"},
    {"command": "list",   "description": "Mostra le parole aggiunte con /add"},
    {"command": "market", "description": "Mercati eBay: /market · add <paese> · remove <paese>"},
    {"command": "query",  "description": "Keyword di ricerca: /query · add <parola> · remove <parola>"},
    {"command": "price",  "description": "Tetto prezzo: /price · max <valore> · max none"},
    {"command": "export", "description": "Esporta la blacklist dinamica come file"},
    {"command": "import", "description": "Importa parole da un file (allegalo con questa didascalia)"},
    {"command": "whitelist", "description": "Eccezioni blacklist: list · add <parola> · remove <parola>"},
    {"command": "snooze", "description": "Sospendi una keyword: /snooze <parola> <ore>"},
]

def register_commands_menu():
    """Registra il menu comandi (quello che compare premendo "/"). Chiamata infrequente
    (una volta per processo Render, non per comando) → nessun bisogno della firma
    Mongo che serviva a saltare le chiamate ridondanti nel vecchio giro ogni 5 min."""
    url = _tg_url()
    for scope in (None, {"type": "all_private_chats"}):
        payload = {"commands": BOT_COMMANDS}
        if scope:
            payload["scope"] = scope
        try:
            requests.post(f"{url}/setMyCommands", json=payload, timeout=15)
        except Exception:
            pass

_commands_registered = False

def _ensure_commands_registered():
    """Registra il menu al primo comando autenticato ricevuto da questo processo
    (non all'import del modulo: eviterebbe una chiamata di rete reale a ogni
    avvio di gunicorn/pytest). Idempotente lato Telegram: una doppia
    registrazione in caso di race tra due prime richieste è innocua."""
    global _commands_registered
    if _commands_registered:
        return
    register_commands_menu()
    _commands_registered = True


# ─── Flask routes ───────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def health():
    return ("ok", 200)

@app.route("/health", methods=["GET"])
def health_json():
    """Stato ricco per un monitor esterno (es. UptimeRobot): NON sostituisce '/', che resta
    leggera/senza Mongo per il liveness check di Render."""
    try:
        store = get_store()
        return {
            "last_sweep_at": store.get_meta("last_sweep_at"),
            "seen_count": store.seen_count(),
            "paused": store.get_meta("paused", False),
        }, 200
    except Exception as exc:
        return {"error": str(exc)}, 503

@app.route("/telegram-webhook", methods=["POST"])
def telegram_webhook():
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    secret_expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not secret_expected or secret != secret_expected:
        return ("", 401)

    update = request.get_json(silent=True) or {}
    msg = update.get("message") or {}
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    allowed_chat_ids = {str(c) for c in _chat_ids()}
    if not allowed_chat_ids or chat_id not in allowed_chat_ids:
        return ("", 200)   # chat non autorizzata: nessuna risposta, non rivelare il bot

    _ensure_commands_registered()

    cmd, arg = parse_command(msg.get("text") or msg.get("caption") or "")
    if cmd in ("add", "remove", "list", "delete", "market", "query", "price",
               "export", "import", "whitelist", "snooze", "help", "status", "pause", "resume"):
        try:
            _handle_command(get_store(), cmd, arg, msg.get("message_id", 0),
                             document=msg.get("document"), chat_id=chat_id)
        except Exception as exc:
            print(f"  [ERRORE] comando '{cmd}' fallito: {exc}")
            _tg_text(f"⚠️ problema temporaneo, riprova tra poco ({type(exc).__name__})")
    return ("", 200)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
