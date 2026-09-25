"""Logica e stato condivisi tra lo sweep (ebay_monitor.py, GitHub Actions) e il
webhook comandi (webhook_app.py, servizio Render separato): entrambi leggono/
scrivono le stesse collection Mongo (ebay_blacklist, ebay_meta) e parlano con lo
stesso bot Telegram. Spostato qui da ebay_monitor.py per evitare la duplicazione,
comportamento invariato — vedi test_bot_logic.py."""
import os
import requests
from datetime import datetime, timezone

import settings


# ─── SEGRETI (da env) ─────────────────────────────────────────────────────────

def _tg_token(): return os.environ.get("TELEGRAM_BOT_TOKEN", "")
def _chat_id():  return os.environ.get("TELEGRAM_CHAT_ID", "")
def _tg_url():   return f"https://api.telegram.org/bot{_tg_token()}"

def _chat_ids():
    """TELEGRAM_CHAT_ID può contenere più chat separate da virgola (multi-chat/gruppo).
    Puro: nessun accesso a Mongo. Ordine preservato, vuoti scartati."""
    return [c.strip() for c in _chat_id().split(",") if c.strip()]

def _tg_text(text):
    """Messaggio di servizio (testo semplice), a TUTTE le chat configurate."""
    for chat_id in _chat_ids():
        try:
            requests.post(f"{_tg_url()}/sendMessage",
                          data={"chat_id": chat_id, "text": text}, timeout=15)
        except Exception:
            pass


# ─── MONGODB (stato: anti-duplicati sweep + blacklist/mercati dinamici) ───────

class Store:
    """Stato persistente su MongoDB Atlas (stesso cluster del sito, collection
    dedicate — NON tocca mai 'cans'). Fallisce subito se il DB è irraggiungibile."""

    def __init__(self, uri):
        from pymongo import MongoClient   # import pigro: la logica pura resta testabile senza pymongo
        self.client = MongoClient(uri, serverSelectionTimeoutMS=15000)
        self.db = self.client.get_default_database()
        self.db.command("ping")
        self.seen = self.db["ebay_seen"]
        self.blacklist = self.db["ebay_blacklist"]
        self.whitelist = self.db["ebay_whitelist"]

    def seen_count(self):
        return self.seen.estimated_document_count()

    def already_seen(self, item_id):
        return self.seen.find_one({"_id": item_id}, {"_id": 1}) is not None

    def mark_seen(self, item_id, title, price, currency, url, site, query, notified=False):
        """notified=True SOLO per gli annunci davvero notificati (invio Telegram riuscito) — usato
        dal riepilogo settimanale per non contare anche gli scartati/baseline."""
        try:
            price_val = float(price or 0)
        except (TypeError, ValueError):
            price_val = 0.0
        self.seen.update_one(
            {"_id": item_id},
            {"$setOnInsert": {"title": title, "price": price_val, "currency": currency,
                              "url": url, "site": site, "query": query, "notified": notified,
                              "seen_at": datetime.now(timezone.utc)}},
            upsert=True)

    def notified_since(self, since_dt):
        """Annunci notificati (notified=True) da since_dt in poi — per il riepilogo settimanale."""
        return list(self.seen.find({"notified": True, "seen_at": {"$gte": since_dt}},
                                    {"query": 1, "_id": 0}))

    def blacklist_additions(self):
        return [d["_id"] for d in self.blacklist.find({}, {"_id": 1})]

    def add_blacklist_word(self, word):
        """Upsert idempotente (word = _id): riprocessare lo stesso /add non crea doppioni."""
        self.blacklist.update_one(
            {"_id": word},
            {"$setOnInsert": {"added_at": datetime.now(timezone.utc)}},
            upsert=True)

    def remove_blacklist_word(self, word):
        """Rimuove una parola dinamica. True se c'era, False se non trovata (inverso di /add)."""
        return self.blacklist.delete_one({"_id": word}).deleted_count > 0

    def whitelist_words(self):
        return [d["_id"] for d in self.whitelist.find({}, {"_id": 1})]

    def add_whitelist_word(self, word):
        """Upsert idempotente, stesso pattern di add_blacklist_word."""
        self.whitelist.update_one(
            {"_id": word},
            {"$setOnInsert": {"added_at": datetime.now(timezone.utc)}},
            upsert=True)

    def remove_whitelist_word(self, word):
        return self.whitelist.delete_one({"_id": word}).deleted_count > 0

    def get_meta(self, key, default=None):
        d = self.db["ebay_meta"].find_one({"_id": key})
        return d["value"] if d else default

    def set_meta(self, key, value):
        self.db["ebay_meta"].update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)


# ─── COMANDI: parsing + validazione (puro, testabile senza rete/Mongo) ────────

def parse_command(text):
    """'/add camicia rossa' -> ('add', 'camicia rossa'). Non-comando -> (None, '')."""
    text = (text or "").strip()
    if not text.startswith("/"):
        return None, ""
    parts = text.split(maxsplit=1)
    cmd = parts[0][1:].split("@")[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""
    return cmd, arg


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


# ─── MERCATI: risoluzione + override dinamico (comando /market) ───────────────

def prune_expired_snoozes(snoozes, now):
    """Rimuove le keyword (/snooze) il cui timer è scaduto — riattivazione automatica.
    Puro: nessun accesso a Mongo. {keyword: expiry_epoch_seconds} -> stesso shape, filtrato."""
    return {k: exp for k, exp in (snoozes or {}).items() if exp > now}


def resolve_marketplace(text):
    """'uk'/'UK' -> 'EBAY_GB', 'EBAY_DE'/'ebay_fr' -> se stesso se valido. Ignoto -> None."""
    t = (text or "").strip().lower()
    if not t:
        return None
    if t in settings.MARKET_ALIASES:
        return settings.MARKET_ALIASES[t]
    up = t.upper()
    if not up.startswith("EBAY_"):
        up = "EBAY_" + up
    return up if up in settings.VALID_MARKETPLACES else None


def daily_ebay_calls(n_markets, n_queries=None, runs_per_day=None):
    """Stima chiamate Browse/giorno = mercati × query × sweep-al-giorno. Puro."""
    nq = n_queries if n_queries is not None else len(settings.SEARCH_QUERIES)
    rpd = runs_per_day if runs_per_day is not None else round(86400 / settings.SWEEP_INTERVAL_SECONDS)
    return n_markets * nq * rpd


def effective_markets(defaults, override):
    """Lista mercati attiva = (defaults ∪ extra) − disabled, ordine preservato
    (defaults prima, poi gli extra). Puro: nessun accesso a Mongo."""
    override = override or {}
    disabled = set(override.get("disabled", []))
    out = [m for m in defaults if m not in disabled]
    for m in override.get("extra", []):
        if m not in disabled and m not in out:
            out.append(m)
    return out


def apply_market_change(override, action, marketplace, defaults):
    """Applica add/remove di un marketplace (già risolto) all'override. Puro.
    Ritorna (nuovo_override, ok, messaggio). Rifiuta i no-op e la rimozione dell'ultimo."""
    ov = {"disabled": list((override or {}).get("disabled", [])),
          "extra":    list((override or {}).get("extra", []))}
    before = effective_markets(defaults, ov)
    if action == "add":
        if marketplace in before:
            return override or ov, False, f"{marketplace} è già attivo"
        if marketplace in ov["disabled"]:
            ov["disabled"].remove(marketplace)
        elif marketplace not in defaults:
            ov["extra"].append(marketplace)
        return ov, True, f"aggiunto {marketplace}"
    if action == "remove":
        if marketplace not in before:
            return override or ov, False, f"{marketplace} non è attivo"
        if len(before) <= 1:
            return override or ov, False, "non puoi rimuovere l'ultimo mercato"
        if marketplace in ov["extra"]:
            ov["extra"].remove(marketplace)
        elif marketplace not in ov["disabled"]:
            ov["disabled"].append(marketplace)
        return ov, True, f"rimosso {marketplace}"
    return override or ov, False, "azione sconosciuta"
