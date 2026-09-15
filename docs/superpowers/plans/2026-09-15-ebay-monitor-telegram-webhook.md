# eBay Monitor — Telegram Webhook + Reliable Sweep Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Monster Energy eBay-monitor Telegram bot respond to commands in seconds instead
of hours, and make the eBay sweep run on a dependable cadence, by splitting the bot into two
independent processes instead of one process sharing a single (unreliable) GitHub Actions cron tick.

**Architecture:** `ebay-monitor/bot_logic.py` (new) holds the Mongo `Store` and the pure
command/market logic, shared by two entry points: `ebay_monitor.py` (trimmed to sweep-only, still
GitHub Actions, now on its own hourly cron) and `webhook_app.py` (new, a small Flask app deployed as
a second, separate Render Web Service that receives Telegram's webhook calls and answers commands
instantly). Both read/write the same MongoDB Atlas collections they use today.

**Tech Stack:** Python 3.12, Flask + gunicorn (new), pymongo, requests — no new external services
beyond a second free Render Web Service.

**Spec:** `docs/superpowers/specs/2026-09-15-ebay-monitor-telegram-webhook-design.md`

## Global Constraints

- Do not modify anything under `backend/` (the Java site) — this project is entirely separate.
- Stay within eBay's Browse API free-tier budget of 5,000 calls/day (verified current for 2026).
- Python 3.12 (matches `.github/workflows/ebay-monitor.yml`'s `actions/setup-python@v5` config).
- Tests follow the existing project convention: a plain script with a `if __name__ == "__main__"`
  runner (`py test_x.py`), also pytest-compatible — no new test framework dependency.
- No real network or Mongo calls in any test — mock at the same boundary the existing tests do
  (module-level function/attribute swap, e.g. `m._tg_text = ...`), not a mocking library.
- Deploying the second Render service and calling Telegram's `setWebhook` are manual, one-time
  operational steps — no `render.yaml` or IaC exists in this repo for the first Render service
  either, so none is introduced here.

---

### Task 1: Extract `bot_logic.py` (Store + command/market logic), no behavior change

**Files:**
- Create: `ebay-monitor/bot_logic.py`
- Create: `ebay-monitor/test_bot_logic.py`
- Modify: `ebay-monitor/ebay_monitor.py` (remove the relocated definitions, import them instead)
- Modify: `ebay-monitor/test_ebay_monitor.py` (remove the tests that moved)

**Interfaces:**
- Produces (used by Task 2's trimmed `ebay_monitor.py` and Task 4's `webhook_app.py`):
  - `class Store` — `Store(uri)`, methods `seen_count()`, `already_seen(item_id)`,
    `mark_seen(item_id, title, price, currency, url, site, query)`, `blacklist_additions()`,
    `add_blacklist_word(word)`, `get_meta(key, default=None)`, `set_meta(key, value)`
  - `parse_command(text) -> (cmd: str|None, arg: str)`
  - `validate_add_word(word, require_words) -> (ok: bool, reason: str)`
  - `resolve_marketplace(text) -> str|None`
  - `apply_market_change(override, action, marketplace, defaults) -> (override, ok, message)`
  - `effective_markets(defaults, override) -> list[str]`
  - `daily_ebay_calls(n_markets, n_queries=None, runs_per_day=None) -> int`
  - `_tg_token() -> str`, `_chat_id() -> str`, `_tg_url() -> str`, `_tg_text(text) -> None`

This is a pure relocation (copy the exact current bodies from `ebay_monitor.py`, no logic change)
— existing tests just need to import from the new location and keep passing unchanged.

- [ ] **Step 1: Create `ebay-monitor/bot_logic.py`**

```python
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

def _tg_text(text):
    """Messaggio di servizio (testo semplice) nella chat."""
    try:
        requests.post(f"{_tg_url()}/sendMessage",
                      data={"chat_id": _chat_id(), "text": text}, timeout=15)
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

    def seen_count(self):
        return self.seen.estimated_document_count()

    def already_seen(self, item_id):
        return self.seen.find_one({"_id": item_id}, {"_id": 1}) is not None

    def mark_seen(self, item_id, title, price, currency, url, site, query):
        try:
            price_val = float(price or 0)
        except (TypeError, ValueError):
            price_val = 0.0
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
```

- [ ] **Step 2: Create `ebay-monitor/test_bot_logic.py`**

```python
"""Test della logica pura condivisa (bot_logic.py) — comandi, mercati, budget.
Niente rete/Mongo. Esegui:  py test_bot_logic.py   (compatibile anche con pytest)."""
import bot_logic as bl


# ─── parse_command ────────────────────────────────────────────────────────────

def test_parse_command_add_with_arg():
    assert bl.parse_command("/add camicia rossa") == ("add", "camicia rossa")

def test_parse_command_strips_bot_mention():
    assert bl.parse_command("/add@MonsterBot felpa") == ("add", "felpa")

def test_parse_command_no_arg():
    assert bl.parse_command("/list") == ("list", "")

def test_parse_command_not_a_command():
    assert bl.parse_command("ciao") == (None, "")

def test_parse_command_market_subcommand():
    assert bl.parse_command("/market remove uk") == ("market", "remove uk")
    assert bl.parse_command("/market") == ("market", "")


# ─── validate_add_word (guardia) ──────────────────────────────────────────────

REQ = ["monster", "energy"]

def test_add_rejects_empty_and_short():
    assert not bl.validate_add_word("", REQ)[0]
    assert not bl.validate_add_word("e", REQ)[0]

def test_add_rejects_required_words():
    assert not bl.validate_add_word("monster", REQ)[0]
    assert not bl.validate_add_word("Energy", REQ)[0]

def test_add_accepts_normal_word():
    ok, reason = bl.validate_add_word("camicia", REQ)
    assert ok and reason == ""


# ─── mercati: resolve / effective / apply (comando /market) ───────────────────

DEF = ["EBAY_IT", "EBAY_DE", "EBAY_GB"]

def test_resolve_marketplace_friendly_and_full():
    assert bl.resolve_marketplace("uk") == "EBAY_GB"
    assert bl.resolve_marketplace("UK") == "EBAY_GB"
    assert bl.resolve_marketplace("it") == "EBAY_IT"
    assert bl.resolve_marketplace("EBAY_DE") == "EBAY_DE"
    assert bl.resolve_marketplace("ebay_fr") == "EBAY_FR"

def test_resolve_marketplace_unknown_is_none():
    assert bl.resolve_marketplace("narnia") is None
    assert bl.resolve_marketplace("") is None
    assert bl.resolve_marketplace("EBAY_ZZ") is None

def test_effective_markets_default_when_no_override():
    assert bl.effective_markets(DEF, None) == DEF
    assert bl.effective_markets(DEF, {}) == DEF

def test_effective_markets_applies_disabled_and_extra():
    ov = {"disabled": ["EBAY_GB"], "extra": ["EBAY_FR"]}
    assert bl.effective_markets(DEF, ov) == ["EBAY_IT", "EBAY_DE", "EBAY_FR"]

def test_apply_remove_default_disables_it():
    ov, ok, _ = bl.apply_market_change({}, "remove", "EBAY_GB", DEF)
    assert ok and "EBAY_GB" in ov["disabled"]
    assert bl.effective_markets(DEF, ov) == ["EBAY_IT", "EBAY_DE"]

def test_apply_add_new_market_as_extra():
    ov, ok, _ = bl.apply_market_change({}, "add", "EBAY_FR", DEF)
    assert ok and "EBAY_FR" in ov["extra"]
    assert "EBAY_FR" in bl.effective_markets(DEF, ov)

def test_apply_add_reenables_a_disabled_default():
    ov, ok, _ = bl.apply_market_change({"disabled": ["EBAY_GB"]}, "add", "EBAY_GB", DEF)
    assert ok and "EBAY_GB" not in ov.get("disabled", [])

def test_apply_remove_already_inactive_is_noop():
    _, ok, _ = bl.apply_market_change({"disabled": ["EBAY_GB"]}, "remove", "EBAY_GB", DEF)
    assert not ok

def test_apply_add_already_active_is_noop():
    _, ok, _ = bl.apply_market_change({}, "add", "EBAY_IT", DEF)
    assert not ok

def test_apply_cannot_remove_last_market():
    _, ok, _ = bl.apply_market_change({}, "remove", "EBAY_IT", ["EBAY_IT"])
    assert not ok


# ─── daily_ebay_calls (guardia budget) ────────────────────────────────────────

def test_daily_ebay_calls_scales_with_markets():
    assert bl.daily_ebay_calls(1, n_queries=10, runs_per_day=12) == 120
    assert bl.daily_ebay_calls(6, n_queries=10, runs_per_day=12) == 720


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t(); print(f"  ✓ {t.__name__}")
        except Exception:
            failed += 1; print(f"  ✗ {t.__name__}"); traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} test passati.")
    raise SystemExit(1 if failed else 0)
```

- [ ] **Step 3: Run the new test file to verify it passes**

Run (from `ebay-monitor/`): `py test_bot_logic.py`
Expected: `24/24 test passati.` (all pass — this is a straight copy of already-correct logic)

- [ ] **Step 4: Remove the relocated definitions from `ebay_monitor.py`, import from `bot_logic` instead**

In `ebay-monitor/ebay_monitor.py`:

Replace the import block near the top:

```python
import os
import sys
import time
import base64
import hashlib
import json
import requests
import threading
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import settings
```

with:

```python
import os
import sys
import time
import base64
import requests
import threading
from pathlib import Path
from datetime import timedelta, timezone, datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import settings
from bot_logic import (
    Store, parse_command, validate_add_word, resolve_marketplace,
    apply_market_change, effective_markets, daily_ebay_calls,
    _tg_text, _tg_url, _chat_id,
)
```

(`hashlib`/`json` were only used by `register_commands_menu`'s change-signature check, which moves
to `webhook_app.py` in Task 4 without that check — see Task 2.)

Delete these entire definitions from `ebay_monitor.py` (now supplied by the `bot_logic` import
above — same names, same behavior, just imported instead of defined locally):

- `def _tg_token(): ...` / `def _chat_id(): ...` / `def _tg_url(): ...` / `def _tg_text(text): ...`
  (the `# ─── TELEGRAM ───` section's first block, keep `send_telegram` — that one stays, it's
  sweep-only)
- `class Store: ...` (the entire `# ─── MONGODB ───` class)
- `def parse_command(text): ...`
- `def validate_add_word(word, require_words): ...`
- `def resolve_marketplace(text): ...`
- `def daily_ebay_calls(n_markets, n_queries=None, runs_per_day=None): ...`
- `def effective_markets(defaults, override): ...`
- `def apply_market_change(override, action, marketplace, defaults): ...`

Everything else in `ebay_monitor.py` stays exactly as-is for this step (including
`drain_commands`, `_handle_command`, the banner/menu functions — those are cut in Task 2, not
here, so this step is a pure, behavior-preserving relocation).

- [ ] **Step 5: Move the corresponding tests out of `test_ebay_monitor.py`**

In `ebay-monitor/test_ebay_monitor.py`, delete these test functions (now covered by
`test_bot_logic.py`, Step 2 above — same assertions, new home):
`test_parse_command_add_with_arg`, `test_parse_command_strips_bot_mention`,
`test_parse_command_no_arg`, `test_parse_command_not_a_command`,
`test_parse_command_market_subcommand`, `test_add_rejects_empty_and_short`,
`test_add_rejects_required_words`, `test_add_accepts_normal_word`,
`test_resolve_marketplace_friendly_and_full`, `test_resolve_marketplace_unknown_is_none`,
`test_effective_markets_default_when_no_override`,
`test_effective_markets_applies_disabled_and_extra`, `test_apply_remove_default_disables_it`,
`test_apply_add_new_market_as_extra`, `test_apply_add_reenables_a_disabled_default`,
`test_apply_remove_already_inactive_is_noop`, `test_apply_add_already_active_is_noop`,
`test_apply_cannot_remove_last_market`, `test_daily_ebay_calls_scales_with_markets`.

Leave everything else in `test_ebay_monitor.py` untouched for this step (the `/market` handler
tests — `_FakeStore`, `_capture_market`, `test_market_*` — are removed in Task 2 along with
`_handle_command` itself, not here).

- [ ] **Step 6: Run both test files to verify nothing broke**

Run: `py test_bot_logic.py` — expect all pass.
Run: `py test_ebay_monitor.py` — expect all remaining tests pass (fewer than before, none newly
failing).

- [ ] **Step 7: Commit**

```bash
git add ebay-monitor/bot_logic.py ebay-monitor/test_bot_logic.py ebay-monitor/ebay_monitor.py ebay-monitor/test_ebay_monitor.py
git commit -m "refactor(ebay-monitor): extract bot_logic.py (Store + command/market logic)"
```

---

### Task 2: Trim `ebay_monitor.py` to sweep-only; move the sweep cadence to 1h

**Files:**
- Modify: `ebay-monitor/ebay_monitor.py`
- Modify: `ebay-monitor/settings.py`
- Modify: `ebay-monitor/test_ebay_monitor.py`

**Interfaces:**
- Consumes: `bot_logic.Store`, `bot_logic.effective_markets`, `bot_logic._tg_text`,
  `bot_logic._tg_url`, `bot_logic._chat_id` (from Task 1)
- Produces: `ebay_monitor.run_once(send_now=False, cap_per_query=None)` — unchanged signature,
  now sweep-only (no more command draining or menu/banner registration)

This step removes the command-handling code that has no more callers once commands are handled by
the webhook (Task 4) — until Task 4 exists, this behavior is simply gone from the sweep script,
which is correct: the sweep should never have owned it.

- [ ] **Step 1: Delete the command-handling code from `ebay_monitor.py`**

Delete these entire definitions (all now dead code — no test currently exercises the sweep
calling them, so nothing breaks by removing them first; Task 4 writes a fresh version of the
`/delete`-message and menu logic inside `webhook_app.py`, not a relocation of these bodies):

- `def _delete_one(mid): ...`
- `def delete_bot_messages(up_to_id, protected=()): ...`
- `def _handle_command(store, cmd, arg, msg_id): ...`
- `BANNER_TEXT = (...)`
- `def ensure_banner(store): ...`
- `BOT_COMMANDS = [...]`
- `def register_commands_menu(store): ...`
- `def register_bot_ui(store): ...`
- `def drain_commands(store): ...`

- [ ] **Step 2: Trim the `bot_logic` import to only what `ebay_monitor.py` still uses**

Replace:

```python
from bot_logic import (
    Store, parse_command, validate_add_word, resolve_marketplace,
    apply_market_change, effective_markets, daily_ebay_calls,
    _tg_text, _tg_url, _chat_id,
)
```

with:

```python
from bot_logic import Store, effective_markets, _tg_text, _tg_url, _chat_id
```

- [ ] **Step 3: Update `run_once()` to drop the command-draining/menu/banner calls**

Replace:

```python
    drain_commands(store)         # OGNI giro (5 min): la parte reattiva
    register_commands_menu(store) # menu "/" sempre aggiornato (chiama Telegram solo se cambia)

    # Ricerca eBay: solo se sono passati ≥ SWEEP_INTERVAL_SECONDS dall'ultimo sweep (o test).
    now = time.time()
    last = store.get_meta("last_sweep_at")
    if not sweep_due(last, now, settings.SWEEP_INTERVAL_SECONDS, send_now):
        wait = int((settings.SWEEP_INTERVAL_SECONDS - (now - last)) / 60)
        print(f"  Comandi drenati. Prossima ricerca eBay tra ~{wait} min.")
        return

    register_bot_ui(store)   # housekeeping UI: solo negli sweep, non ogni 5 min
    token = get_ebay_token()
```

with:

```python
    # Ricerca eBay: solo se sono passati ≥ SWEEP_INTERVAL_SECONDS dall'ultimo sweep (o test).
    # I comandi Telegram non passano più di qui: li gestisce webhook_app.py (Render), istantanei.
    now = time.time()
    last = store.get_meta("last_sweep_at")
    if not sweep_due(last, now, settings.SWEEP_INTERVAL_SECONDS, send_now):
        wait = int((settings.SWEEP_INTERVAL_SECONDS - (now - last)) / 60)
        print(f"  Prossima ricerca eBay tra ~{wait} min.")
        return

    token = get_ebay_token()
```

- [ ] **Step 4: Update the module docstring**

Replace the docstring's numbered flow (near the top of the file):

```python
Gira su GitHub Actions (schedule ogni 2h + trigger manuale). Ogni esecuzione:
  1. si connette a MongoDB (stato anti-duplicati + blacklist dinamica); se è giù, salta il giro
  2. drena i comandi Telegram arrivati dall'ultimo giro (/add, /list, /delete)
  3. per ogni query × mercato cerca gli annunci "appena listati" e notifica i NUOVI su Telegram
```

with:

```python
Gira su GitHub Actions (schedule ogni 1h + trigger manuale). Ogni esecuzione:
  1. si connette a MongoDB (stato anti-duplicati); se è giù, salta il giro
  2. per ogni query × mercato cerca gli annunci "appena listati" e notifica i NUOVI su Telegram

I comandi Telegram (/add /list /market /delete) non passano più da qui: li gestisce
webhook_app.py, un servizio Render separato, istantaneo — vedi
docs/superpowers/specs/2026-09-15-ebay-monitor-telegram-webhook-design.md.
```

- [ ] **Step 5: Update `settings.py`'s sweep cadence and listing-age window**

Replace:

```python
# Il workflow gira ogni 5 min per drenare i COMANDI Telegram in fretta, ma la RICERCA eBay
# resta ogni ~2h (altrimenti sfori il limite ~5.000 chiamate/giorno): ogni giro fa lo sweep
# solo se sono passati almeno SWEEP_INTERVAL_SECONDS dall'ultimo (timestamp su Mongo).
# Deve restare < MAX_LISTING_AGE_HOURS (finestra), o perdi annunci tra uno sweep e l'altro.
SWEEP_INTERVAL_SECONDS = 7200   # 2 ore
```

with:

```python
# I comandi Telegram (/add /list /market /delete) non passano più da qui: li gestisce
# webhook_app.py (servizio Render separato, istantaneo). Questo script fa solo lo sweep
# eBay, su un cron GitHub Actions dedicato ogni ora — vedi .github/workflows/ebay-monitor.yml
# e docs/superpowers/specs/2026-09-15-ebay-monitor-telegram-webhook-design.md.
# sweep_due() resta comunque un gate di sicurezza (es. run_once() lanciato più volte a mano).
# Deve restare < MAX_LISTING_AGE_HOURS (finestra), o perdi annunci tra uno sweep e l'altro.
SWEEP_INTERVAL_SECONDS = 3600   # 1 ora
```

Replace:

```python
# ⏱️ Solo annunci listati nelle ultime N ore (filtro lato eBay). Allargata da 2.5 a 3.5:
# i cron di GitHub Actions non partono all'orario esatto (slittano di minuti, a volte saltano
# un giro) → 3.5h assorbe i ritardi. Costo: qualche duplicato in più, già filtrato dal DB.
MAX_LISTING_AGE_HOURS = 3.5
```

with:

```python
# ⏱️ Solo annunci listati nelle ultime N ore (filtro lato eBay). Margine di sicurezza sopra
# SWEEP_INTERVAL_SECONDS (1h): un cron orario reale ha molto meno drift da assorbire di prima
# (era 3.5h per assorbire le ore di ritardo del vecchio schedule ogni 5 min, non più usato).
MAX_LISTING_AGE_HOURS = 2
```

- [ ] **Step 6: Remove the `/market` handler tests from `test_ebay_monitor.py` and update the sweep cadence constant**

Delete: the `_FakeStore` class, `_capture_market` helper, and `test_market_remove_persists_and_confirms`,
`test_market_invalid_rejected_without_state_change`, `test_market_no_arg_lists_active`,
`test_market_add_near_budget_warns` (these exercised `_handle_command`, deleted in Step 1 — a
fresh equivalent lands in `test_webhook_app.py`, Task 4).

Remove the now-unused `import settings` line if nothing else in the file references `settings`
(check: after this deletion, `sweep_due` tests use only literal ints, not `settings` — remove the
import).

Update the sweep-cadence test constant to match the new default:

```python
INT = 7200  # 2h
```

to:

```python
INT = 3600  # 1h
```

(the 4 `test_sweep_due_*` tests below already use `INT` symbolically, no other change needed).

- [ ] **Step 7: Run the trimmed test file to verify it passes**

Run: `py test_ebay_monitor.py`
Expected: all remaining tests pass (blacklist, `merge_blacklist`, `title_passes`, `sweep_due` —
9 tests).

- [ ] **Step 8: Commit**

```bash
git add ebay-monitor/ebay_monitor.py ebay-monitor/settings.py ebay-monitor/test_ebay_monitor.py
git commit -m "refactor(ebay-monitor): trim sweep script to eBay-only, cadence to 1h"
```

---

### Task 3: Add Flask + gunicorn to dependencies

**Files:**
- Modify: `ebay-monitor/requirements.txt`

**Interfaces:**
- Produces: `flask` and `gunicorn` importable in the local environment, needed by Task 4's tests.

- [ ] **Step 1: Update `requirements.txt`**

Replace:

```
# Dipendenze del monitor (gira su GitHub Actions). Install: pip install -r requirements.txt
requests==2.32.3
pymongo>=4.6
```

with:

```
# Dipendenze del monitor. Install: pip install -r requirements.txt
# requests/pymongo: sweep (ebay_monitor.py, GitHub Actions). flask/gunicorn: webhook comandi
# (webhook_app.py, servizio Render separato) — vedi docs/superpowers/specs/2026-09-15-ebay-
# monitor-telegram-webhook-design.md.
requests==2.32.3
pymongo>=4.6
flask==3.1.0
gunicorn==23.0.0
```

- [ ] **Step 2: Install locally**

Run (from `ebay-monitor/`): `pip install -r requirements.txt`
Expected: Flask and gunicorn install without error (needed for Task 4's test client).

- [ ] **Step 3: Commit**

```bash
git add ebay-monitor/requirements.txt
git commit -m "chore(ebay-monitor): add flask + gunicorn for the webhook service"
```

---

### Task 4: `webhook_app.py` — instant Telegram commands via webhook

**Files:**
- Create: `ebay-monitor/webhook_app.py`
- Create: `ebay-monitor/test_webhook_app.py`

**Interfaces:**
- Consumes: `bot_logic.Store`, `bot_logic.parse_command`, `bot_logic.validate_add_word`,
  `bot_logic.resolve_marketplace`, `bot_logic.apply_market_change`, `bot_logic.effective_markets`,
  `bot_logic.daily_ebay_calls`, `bot_logic._tg_text`, `bot_logic._tg_url`, `bot_logic._chat_id`
  (Task 1)
- Produces: a Flask `app` object with routes `GET /` (health check) and
  `POST /telegram-webhook` (Telegram webhook receiver) — this is what Render's start command
  (`gunicorn webhook_app:app`) serves.

This is new request/response behavior (a route that didn't exist before), so it follows TDD:
tests first, then the implementation.

- [ ] **Step 1: Write the failing tests**

Create `ebay-monitor/test_webhook_app.py`:

```python
"""Test dell'app webhook (webhook_app.py): validazione secret/chat, dispatch
comandi. Niente rete/Mongo vera — Store e le chiamate Telegram sono sostituite.
Esegui:  py test_webhook_app.py   (compatibile anche con pytest)."""
import os
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("TELEGRAM_CHAT_ID", "12345")
os.environ.setdefault("TELEGRAM_WEBHOOK_SECRET", "test-secret")

import webhook_app as w


class _FakeStore:
    """Store in memoria: sostituisce Mongo (get_meta/set_meta/blacklist)."""
    def __init__(self):
        self._meta = {}
        self._blacklist = set()
    def get_meta(self, k, d=None):
        return self._meta.get(k, d)
    def set_meta(self, k, v):
        self._meta[k] = v
    def blacklist_additions(self):
        return list(self._blacklist)
    def add_blacklist_word(self, word):
        self._blacklist.add(word)


def _client(store=None):
    """Client di test Flask con Store finto (niente Mongo) e commands-menu già
    'registrato' (niente chiamata di rete a setMyCommands durante i test)."""
    w._store = store if store is not None else _FakeStore()
    w.get_store = lambda: w._store
    w._commands_registered = True
    return w.app.test_client()


def _post(client, text, chat_id="12345", secret="test-secret", msg_id=1):
    return client.post(
        "/telegram-webhook",
        json={"message": {"chat": {"id": chat_id}, "text": text, "message_id": msg_id}},
        headers={"X-Telegram-Bot-Api-Secret-Token": secret},
    )


def test_missing_secret_is_rejected():
    client = _client()
    r = _post(client, "/list", secret="")
    assert r.status_code == 401


def test_wrong_secret_is_rejected():
    client = _client()
    r = _post(client, "/list", secret="not-the-secret")
    assert r.status_code == 401


def test_wrong_chat_id_is_ignored():
    store = _FakeStore()
    client = _client(store)
    r = _post(client, "/add camicia", chat_id="99999")
    assert r.status_code == 200
    assert store.blacklist_additions() == []   # nessuna scrittura: chat non autorizzata


def test_add_command_writes_to_store():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/add camicia rossa")
        assert r.status_code == 200
        assert "camicia rossa" in store.blacklist_additions()
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_list_command_reports_dynamic_words():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.add_blacklist_word("felpa")
        client = _client(store)
        r = _post(client, "/list")
        assert r.status_code == 200
        assert sent and "felpa" in sent[-1]
    finally:
        w._tg_text = orig_tg_text


def test_market_command_persists_override():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/market remove uk")
        assert r.status_code == 200
        assert "EBAY_GB" in store.get_meta("market_override")["disabled"]
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_delete_command_calls_delete_bot_messages():
    calls = []
    orig_delete = w.delete_bot_messages
    w.delete_bot_messages = lambda up_to_id, protected=(): (calls.append((up_to_id, protected)) or 3)
    orig_delete_one = w._delete_one
    w._delete_one = lambda mid: True
    try:
        client = _client()
        r = _post(client, "/delete", msg_id=42)
        assert r.status_code == 200
        assert calls and calls[0][0] == 42
    finally:
        w.delete_bot_messages = orig_delete
        w._delete_one = orig_delete_one


def test_store_error_replies_gracefully_not_500():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    client = _client()   # baseline (secret/store setup)
    orig_get_store = w.get_store
    def _boom():
        raise RuntimeError("mongo down")
    w.get_store = _boom
    try:
        r = _post(client, "/add x")
        assert r.status_code == 200   # non deve esplodere con un 500
        assert sent and "problema temporaneo" in sent[-1]
    finally:
        w._tg_text = orig_tg_text
        w.get_store = orig_get_store


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t(); print(f"  ✓ {t.__name__}")
        except Exception:
            failed += 1; print(f"  ✗ {t.__name__}"); traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} test passati.")
    raise SystemExit(1 if failed else 0)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `py test_webhook_app.py`
Expected: `ModuleNotFoundError: No module named 'webhook_app'` (the module doesn't exist yet).

- [ ] **Step 3: Write `webhook_app.py`**

```python
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
    if secret != os.environ.get("TELEGRAM_WEBHOOK_SECRET", ""):
        return ("", 401)

    _ensure_commands_registered()

    update = request.get_json(silent=True) or {}
    msg = update.get("message") or {}
    chat_id = str((msg.get("chat") or {}).get("id", ""))
    if chat_id != str(_chat_id()):
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `py test_webhook_app.py`
Expected: `8/8 test passati.`

- [ ] **Step 5: Commit**

```bash
git add ebay-monitor/webhook_app.py ebay-monitor/test_webhook_app.py
git commit -m "feat(ebay-monitor): add Telegram webhook app for instant commands"
```

---

### Task 5: Move the sweep cron to a dedicated, reliable hourly trigger

**Files:**
- Modify: `.github/workflows/ebay-monitor.yml`

**Interfaces:** none (workflow config only).

- [ ] **Step 1: Update the workflow's schedule and header comment**

Replace:

```yaml
name: eBay Monitor

# Radar Monster Energy: gira ogni 5 min per drenare in fretta i COMANDI Telegram
# (/add /list /delete). La RICERCA eBay resta ogni ~2h (gated via timestamp su Mongo:
# SWEEP_INTERVAL_SECONDS) per non sforare il limite chiamate. Repo pubblica → minuti
# Actions gratis. I cron GitHub slittano: la finestra lato codice è 3.5h per assorbire.
# Segreti in Settings → Secrets → Actions.
on:
  schedule:
    - cron: '*/5 * * * *'   # ogni 5 minuti (drain comandi; sweep eBay gated a 2h)
  workflow_dispatch:
```

with:

```yaml
name: eBay Monitor

# Radar Monster Energy: SOLO ricerca eBay + notifica, ogni ora. I comandi Telegram
# (/add /list /market /delete) non passano più da qui — li gestisce webhook_app.py,
# un servizio Render separato, istantaneo (vedi docs/superpowers/specs/2026-09-15-
# ebay-monitor-telegram-webhook-design.md). Cron offset a :07 (non in punta d'ora):
# GitHub segnala l'inizio ora come il momento di massimo ritardo/carico degli schedule.
# Segreti in Settings → Secrets → Actions.
on:
  schedule:
    - cron: '7 * * * *'   # ogni ora, alle :07
  workflow_dispatch:
```

Everything else in the workflow (env vars, `concurrency`, `timeout-minutes`, the `send_now` input
and its run step) stays unchanged — `ebay_monitor.py` still needs all 5 secrets for the sweep
itself (eBay auth, Telegram notify, Mongo).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ebay-monitor.yml
git commit -m "ci(ebay-monitor): move sweep cron to a dedicated hourly schedule"
```

---

### Task 6: Update `ebay-monitor/README.md` to match the new architecture

**Files:**
- Modify: `ebay-monitor/README.md`

**Interfaces:** none (documentation only).

The README describes the old single-process design in several places; left as-is it would
actively mislead the next person (including a future Claude session) reading it. This task edits
each section that references the old cadence/flow.

- [ ] **Step 1: Update the intro paragraph**

Replace:

```markdown
Radar che avvisa su **Telegram** quando spunta un **nuovo annuncio eBay** di una lattina
Monster che ti interessa, su **più mercati**. Gira **in cloud, gratis** su GitHub Actions,
con lo stato su **MongoDB Atlas** — nessun PC da tenere acceso. Il workflow parte **ogni 5 min**
(per eseguire in fretta i comandi Telegram), ma la **ricerca eBay** è limitata a **~ogni 2h**.

Vive in `ebay-monitor/` dentro il repo del sito, ma è un tool **separato**: non fa parte
dell'app Java deployata su Render. Il suo workflow è `.github/workflows/ebay-monitor.yml`.
```

with:

```markdown
Radar che avvisa su **Telegram** quando spunta un **nuovo annuncio eBay** di una lattina
Monster che ti interessa, su **più mercati**. Due parti separate, gratis, nessun PC da
tenere acceso:

- **Ricerca eBay**: gira **in cloud su GitHub Actions**, **ogni ora**, stato su
  **MongoDB Atlas**. Workflow: `.github/workflows/ebay-monitor.yml`.
- **Comandi Telegram** (`/add /list /market /delete`): gira su un **secondo Web Service
  Render**, separato dal sito principale — riceve un **webhook** da Telegram e risponde
  **istantaneamente**, niente attesa di un giro cron. Codice: `webhook_app.py`.

Vivono entrambi in `ebay-monitor/` dentro il repo del sito, ma sono tool **separati**: non
fanno parte dell'app Java deployata su Render (root directory diversa, deploy indipendente).
```

- [ ] **Step 2: Update "Come funziona"**

Replace:

```markdown
## Come funziona

Ogni 5 min il workflow lancia `ebay_monitor.py`, che fa **un giro solo** ed esce:

1. **Connette MongoDB** (stato anti-duplicati + blacklist dinamica). Se il DB è irraggiungibile,
   **salta il giro** e avvisa su Telegram (non processa nulla, per non rifare la baseline).
2. **Drena i comandi Telegram** (`/add`, `/list`, `/delete`) — **a ogni giro** (ogni ~5 min),
   così i comandi rispondono in fretta.
3. **Solo se** sono passate ~2h dall'ultima ricerca (`SWEEP_INTERVAL_SECONDS`, timestamp su Mongo):
   per ogni `SEARCH_QUERIES` × `EBAY_MARKETPLACES` cerca gli annunci **appena listati** e notifica i
   **nuovi** su Telegram. Altrimenti il giro fa solo il punto 2 ed esce (niente chiamate eBay).

Perché così: i comandi devono rispondere in fretta (5 min), ma la ricerca eBay va tenuta a ~2h per
non sforare il budget chiamate. Il repo è **pubblico** → i minuti GitHub Actions sono gratis, quindi
girare ogni 5 min non costa nulla.
```

with:

```markdown
## Come funziona

**Ricerca eBay** (`ebay_monitor.py`, GitHub Actions, ogni ora): un giro solo ed esce.

1. **Connette MongoDB** (stato anti-duplicati). Se il DB è irraggiungibile, **salta il giro** e
   avvisa su Telegram (non processa nulla, per non rifare la baseline).
2. **Solo se** è passata ~1h dall'ultima ricerca (`SWEEP_INTERVAL_SECONDS`, timestamp su Mongo,
   gate di sicurezza — il cron è già orario): per ogni `SEARCH_QUERIES` × `EBAY_MARKETPLACES`
   cerca gli annunci **appena listati** e notifica i **nuovi** su Telegram.

**Comandi Telegram** (`webhook_app.py`, servizio Render separato, sempre in ascolto): Telegram
chiama l'endpoint `/telegram-webhook` **nell'istante** in cui arriva un comando — niente attesa
di un giro cron. Unico limite: come il sito, il servizio gratuito Render si addormenta se
inattivo, quindi il primissimo comando dopo una pausa lunga ha un cold-start di ~30-50s prima
della risposta (Telegram ritenta la consegna finché non risponde).
```

(leave the "Ricerca **per NOME**..." paragraph right after it untouched — still accurate.)

- [ ] **Step 3: Update the `⏱️ Finestra temporale` section**

Replace:

```markdown
## ⏱️ Finestra temporale

`MAX_LISTING_AGE_HOURS = 3.5` → eBay manda solo gli annunci listati nelle ultime ~3,5h. La ricerca
gira ~ogni 2h, quindi c'è ~1,5h di margine: serve perché **i cron di GitHub Actions non partono
all'orario esatto** (slittano di minuti, a volte saltano un giro). Il margine assorbe i ritardi;
gli eventuali duplicati sono già filtrati dallo stato su Mongo.
```

with:

```markdown
## ⏱️ Finestra temporale

`MAX_LISTING_AGE_HOURS = 2` → eBay manda solo gli annunci listati nelle ultime ~2h. La ricerca
gira ogni 1h, quindi c'è ~1h di margine per il drift naturale dei cron GitHub Actions (minuti,
non più le ore osservate col vecchio schedule `*/5 * * * *` — vedi lo spec di design). Gli
eventuali duplicati residui sono comunque filtrati dallo stato su Mongo.
```

- [ ] **Step 4: Update `## 🤖 Comandi Telegram`'s intro**

Replace:

```markdown
Vengono eseguiti al **giro successivo** (~5–15 min: i cron di GitHub slittano, non c'è un processo
sempre acceso). Un **messaggio fissato** in cima alla chat lo ricorda; è protetto dal `/delete` e si
rigenera da solo se sparisce. I comandi sono idempotenti.
```

with:

```markdown
Rispondono **istantaneamente** (webhook, vedi sopra) — eccetto il primissimo comando dopo una
pausa lunga, che ha un cold-start di ~30-50s (servizio Render gratuito). I comandi sono
idempotenti.
```

(the individual command bullets below — `/add`, `/list`, `/market`, `/delete` — stay unchanged,
their behavior didn't change, only when they run.)

- [ ] **Step 5: Update `## Setup (una tantum)`**

Replace:

```markdown
## Setup (una tantum)

Il monitor gira su GitHub Actions e legge i segreti dalle **Secrets del repo**
(*Settings → Secrets and variables → Actions*). Servono 5 Secret:

| Secret | Cos'è |
|--------|-------|
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Keyset **Production** della Browse API eBay |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot Telegram (token da @BotFather + chat id) |
| `MONGODB_URI` | URI di MongoDB Atlas (stesso cluster del sito; il monitor usa collection dedicate `ebay_seen`/`ebay_blacklist`/`ebay_meta`, **non** tocca `cans`) |

Nessun altro setup: il workflow installa le dipendenze e parte da solo ogni 5 min.
```

with:

```markdown
## Setup (una tantum)

**Ricerca eBay** (GitHub Actions) legge i segreti dalle **Secrets del repo**
(*Settings → Secrets and variables → Actions*). Servono 5 Secret:

| Secret | Cos'è |
|--------|-------|
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Keyset **Production** della Browse API eBay |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot Telegram (token da @BotFather + chat id) |
| `MONGODB_URI` | URI di MongoDB Atlas (stesso cluster del sito; il monitor usa collection dedicate `ebay_seen`/`ebay_blacklist`/`ebay_meta`, **non** tocca `cans`) |

Nessun altro setup lato GitHub: il workflow installa le dipendenze e parte da solo ogni ora.

**Comandi Telegram** (secondo Web Service Render, separato dal sito):

1. Crea un nuovo Web Service su Render, root directory `ebay-monitor/`, start command
   `gunicorn webhook_app:app --bind 0.0.0.0:$PORT`.
2. Env vars sul servizio: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONGODB_URI` (stessi valori
   dei Secret GitHub sopra — store separati, vanno copiati) + `TELEGRAM_WEBHOOK_SECRET` (nuovo,
   generato una tantum, es. `openssl rand -hex 32`).
3. Una volta deployato, registra il webhook su Telegram (una tantum):
   ```
   curl https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url=https://<nome-servizio>.onrender.com/telegram-webhook \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
```

- [ ] **Step 6: Update `## Uso`**

Replace:

```markdown
## Uso

- **Automatico**: ogni 5 min via `schedule` (drain comandi); la ricerca eBay scatta ~ogni 2h. Al
  **primo giro** con Mongo vuoto fa la **baseline** (segna gli annunci già online come "visti", senza
  notificarli) → poi notifica solo i nuovi.
- **Test on-demand**: *Actions → eBay Monitor → Run workflow*. Spunta **`send_now`** per farti
  mandare subito gli annunci attuali (ignora i già-visti), altrimenti fa un giro normale.
```

with:

```markdown
## Uso

- **Automatico**: la ricerca eBay scatta ogni ora via `schedule`. Al **primo giro** con Mongo
  vuoto fa la **baseline** (segna gli annunci già online come "visti", senza notificarli) → poi
  notifica solo i nuovi. I comandi Telegram rispondono da soli, istantaneamente, appena scrivi in
  chat (nessuna azione da fare su GitHub per quelli).
- **Test on-demand**: *Actions → eBay Monitor → Run workflow*. Spunta **`send_now`** per farti
  mandare subito gli annunci attuali (ignora i già-visti), altrimenti fa un giro normale.
```

- [ ] **Step 7: Update `## Test / sviluppo locale`**

Replace:

```markdown
## Test / sviluppo locale

```bash
py test_ebay_monitor.py     # logica pura (blacklist, filtri, comandi) — niente rete/Mongo
```
Per un giro reale in locale: crea `config.py` con i 5 segreti (è gitignored) ed esporta le stesse
variabili d'ambiente prima di lanciare `py ebay_monitor.py --send-now 5`.
```

with:

```markdown
## Test / sviluppo locale

```bash
py test_ebay_monitor.py     # logica sweep pura (blacklist, filtro titoli) — niente rete/Mongo
py test_bot_logic.py        # logica comandi pura (parsing, mercati, budget) — niente rete/Mongo
py test_webhook_app.py      # handler webhook (Flask test client) — Store e Telegram mockati
```
Per un giro reale in locale: crea `config.py` con i segreti (è gitignored) ed esporta le stesse
variabili d'ambiente prima di lanciare `py ebay_monitor.py --send-now 5`. Per il webhook in
locale: `py webhook_app.py` (dev server Flask su `:5000`).
```

- [ ] **Step 8: Update the `## File` table**

Replace:

```markdown
| File | Ruolo |
|------|-------|
| `ebay_monitor.py` | Logica: Mongo + Browse API + filtri + Telegram + comandi. |
| `settings.py` | Config **non-segreta** versionata (query, mercati, finestra). |
| `blacklist.txt` | Blacklist di base (versionata). Le aggiunte `/add` vivono su Mongo. |
| `test_ebay_monitor.py` | Test della logica pura + canary spazi blacklist. |
| `requirements.txt` | Dipendenze (`requests`, `pymongo`). |
| `config.py` | **Solo locale** (gitignored): segreti per i test manuali. |
```

with:

```markdown
| File | Ruolo |
|------|-------|
| `ebay_monitor.py` | Sweep: Mongo + Browse API + filtri + notifica Telegram. GitHub Actions, ogni ora. |
| `webhook_app.py` | Comandi Telegram via webhook, istantanei. Servizio Render separato. |
| `bot_logic.py` | Condiviso da entrambi: `Store` (Mongo) + logica comandi/mercati pura. |
| `settings.py` | Config **non-segreta** versionata (query, mercati, finestra, cadenza sweep). |
| `blacklist.txt` | Blacklist di base (versionata). Le aggiunte `/add` vivono su Mongo. |
| `test_ebay_monitor.py` | Test della logica sweep pura + canary spazi blacklist. |
| `test_bot_logic.py` | Test della logica comandi/mercati pura. |
| `test_webhook_app.py` | Test dell'handler webhook (Flask test client, Mongo/Telegram mockati). |
| `requirements.txt` | Dipendenze (`requests`, `pymongo`, `flask`, `gunicorn`). |
| `config.py` | **Solo locale** (gitignored): segreti per i test manuali. |
```

- [ ] **Step 9: Update `## ⚠️ Budget chiamate eBay`**

Replace:

```markdown
## ⚠️ Budget chiamate eBay

```
chiamate/giorno ≈ n_query × n_mercati × (24 / 2h) = 26 × 6 × 12 ≈ 1.870/giorno
```
Sotto il limite tipico (~5.000/giorno della Browse API). Se aggiungi query o mercati, ricontrolla.
```

with:

```markdown
## ⚠️ Budget chiamate eBay

```
chiamate/giorno ≈ n_query × n_mercati × (24 / 1h) = 26 × 6 × 24 ≈ 3.744/giorno
```
Sotto il limite tipico (~5.000/giorno della Browse API, verificato 2026), ma più vicino al tetto
di prima (era ~1.870/giorno a sweep ogni 2h) — se aggiungi query o mercati, ricontrolla con più
margine di prima.
```

- [ ] **Step 10: Commit**

```bash
git add ebay-monitor/README.md
git commit -m "docs(ebay-monitor): update README for the webhook + hourly-sweep architecture"
```

---

## Manual deployment (do this yourself — not agent-executable, no dashboard/API access)

Code and docs are done after Task 6. The bot won't actually use the new webhook until these
one-time, external steps happen:

1. On Render: create a **second** Web Service (free tier), pointed at this same repo,
   **root directory** `ebay-monitor/`, start command `gunicorn webhook_app:app --bind 0.0.0.0:$PORT`.
2. On that service, set env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONGODB_URI` (copy
   the same values already used as GitHub Secrets), plus a new `TELEGRAM_WEBHOOK_SECRET`
   (generate one, e.g. `openssl rand -hex 32`).
3. Deploy it, note its public URL (`https://<name>.onrender.com`).
4. Register the webhook with Telegram (one-time):
   ```
   curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook \
     -d url=https://<name>.onrender.com/telegram-webhook \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
5. Verify: send `/add test123` in the Telegram chat — expect a reply within seconds (or ~30-50s
   if the service was asleep). Then `/list` should show it.
6. Wait for (or manually trigger via `workflow_dispatch`) the next GitHub Actions run and confirm
   its log shows the dynamically-added blacklist word being read.
7. Clean up the test word by deleting it directly from the `ebay_blacklist` Mongo collection (no
   `/remove` command exists — unchanged, out of scope for this plan).
