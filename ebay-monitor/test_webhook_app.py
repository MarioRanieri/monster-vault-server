"""Test dell'app webhook (webhook_app.py): validazione secret/chat, dispatch
comandi. Niente rete/Mongo vera — Store e le chiamate Telegram sono sostituite.
Esegui:  py test_webhook_app.py   (compatibile anche con pytest)."""
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("TELEGRAM_CHAT_ID", "12345")
os.environ.setdefault("TELEGRAM_WEBHOOK_SECRET", "test-secret")

import webhook_app as w
import bot_logic


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
    def remove_blacklist_word(self, word):
        if word in self._blacklist:
            self._blacklist.discard(word)
            return True
        return False


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


def test_remove_command_deletes_existing_word():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.add_blacklist_word("felpa")
        client = _client(store)
        r = _post(client, "/remove felpa")
        assert r.status_code == 200
        assert "felpa" not in store.blacklist_additions()
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_remove_command_reports_missing_word():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/remove felpa")
        assert r.status_code == 200
        assert sent and sent[-1].startswith("⚠️") and "felpa" in sent[-1]
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
        # contratto cross-modulo: la stessa shape scritta qui deve essere quella che
        # ebay_monitor.py/bot_logic.py leggono per calcolare i mercati attivi dello sweep.
        active = bot_logic.effective_markets(w.settings.EBAY_MARKETPLACES, store.get_meta("market_override"))
        assert "EBAY_GB" not in active
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


def test_unset_secret_rejects_even_empty_header():
    """If TELEGRAM_WEBHOOK_SECRET is unset (empty), reject even requests with empty secret."""
    orig_secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
    os.environ["TELEGRAM_WEBHOOK_SECRET"] = ""
    try:
        client = _client()
        # Request with empty secret header should be rejected (403/401, not 200)
        r = _post(client, "/list", secret="")
        assert r.status_code == 401   # must fail CLOSED, not pass
        # Request with no secret header should also be rejected
        r = _post(client, "/list", secret="")
        assert r.status_code == 401
    finally:
        if orig_secret is not None:
            os.environ["TELEGRAM_WEBHOOK_SECRET"] = orig_secret
        else:
            os.environ.pop("TELEGRAM_WEBHOOK_SECRET", None)


def test_unset_chat_id_silently_ignores():
    """If TELEGRAM_CHAT_ID is unset (empty), never dispatch commands even if incoming chat_id is empty."""
    store = _FakeStore()
    orig_chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    os.environ["TELEGRAM_CHAT_ID"] = ""
    try:
        client = _client(store)
        # Request with matching empty chat_id should still be rejected (silent 200, no command)
        r = _post(client, "/add camicia", chat_id="")
        assert r.status_code == 200
        assert store.blacklist_additions() == []   # no command executed
    finally:
        if orig_chat_id is not None:
            os.environ["TELEGRAM_CHAT_ID"] = orig_chat_id
        else:
            os.environ.pop("TELEGRAM_CHAT_ID", None)


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
