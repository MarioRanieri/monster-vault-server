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
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from flask import Flask, request

import settings
from bot_logic import (
    Store, parse_command, validate_add_word, resolve_marketplace,
    apply_market_change, effective_markets, daily_ebay_calls,
    _tg_text, _tg_url, _chat_id,
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


# ─── /delete: cancellazione messaggi del bot ───────────────────────────────────

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
    Telegram rifiuta quelli non del bot o più vecchi di 48h: contiamo solo i cancellati."""
    scan = getattr(settings, "DELETE_SCAN_BACK", 300)
    workers = getattr(settings, "DELETE_WORKERS", 12)
    protected = set(protected)
    ids = [i for i in range(up_to_id - 1, max(0, up_to_id - scan - 1), -1) if i not in protected]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return sum(ex.map(_delete_one, ids))


# ─── dispatch comandi ──────────────────────────────────────────────────────────

def _handle_command(store, cmd, arg, msg_id):
    """Esegue un comando. Ritorna True se gestito (per il log)."""
    if cmd == "delete":
        banner = store.get_meta("banner_msg_id")
        n = delete_bot_messages(msg_id, protected={banner} if banner else ())
        _delete_one(msg_id)
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
    {"command": "add",    "description": "Aggiungi una parola alla blacklist"},
    {"command": "list",   "description": "Mostra le parole aggiunte con /add"},
    {"command": "market", "description": "Mercati eBay: /market · add <paese> · remove <paese>"},
    {"command": "delete", "description": "Cancella i messaggi inviati dal bot"},
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

@app.route("/telegram-webhook", methods=["POST"])
def telegram_webhook():
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    secret_expected = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not secret_expected or secret != secret_expected:
        return ("", 401)

    _ensure_commands_registered()

    update = request.get_json(silent=True) or {}
    msg = update.get("message") or {}
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    expected_chat_id = str(_chat_id())
    if not expected_chat_id or chat_id != expected_chat_id:
        return ("", 200)   # chat non autorizzata: nessuna risposta, non rivelare il bot

    cmd, arg = parse_command(msg.get("text") or "")
    if cmd in ("add", "list", "delete", "market"):
        try:
            _handle_command(get_store(), cmd, arg, msg.get("message_id", 0))
        except Exception as exc:
            print(f"  [ERRORE] comando '{cmd}' fallito: {exc}")
            _tg_text(f"⚠️ problema temporaneo, riprova tra poco ({type(exc).__name__})")
    return ("", 200)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
