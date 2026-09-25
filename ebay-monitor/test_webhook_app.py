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
        self._whitelist = set()
        self._seen_count = 0
    def get_meta(self, k, d=None):
        return self._meta.get(k, d)
    def set_meta(self, k, v):
        self._meta[k] = v
    def blacklist_additions(self):
        return list(self._blacklist)
    def seen_count(self):
        return self._seen_count
    def add_blacklist_word(self, word):
        self._blacklist.add(word)
    def remove_blacklist_word(self, word):
        if word in self._blacklist:
            self._blacklist.discard(word)
            return True
        return False
    def whitelist_words(self):
        return list(self._whitelist)
    def add_whitelist_word(self, word):
        self._whitelist.add(word)
    def remove_whitelist_word(self, word):
        if word in self._whitelist:
            self._whitelist.discard(word)
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


def test_health_endpoint_returns_json_status():
    store = _FakeStore()
    store.set_meta("last_sweep_at", 1234567890.0)
    store.set_meta("paused", True)
    store._seen_count = 99
    client = _client(store)
    r = client.get("/health")
    assert r.status_code == 200
    data = r.get_json()
    assert data == {"last_sweep_at": 1234567890.0, "seen_count": 99, "paused": True}


def test_health_endpoint_handles_never_run_state():
    client = _client(_FakeStore())
    r = client.get("/health")
    assert r.status_code == 200
    data = r.get_json()
    assert data["last_sweep_at"] is None
    assert data["paused"] is False


def test_missing_secret_is_rejected():
    client = _client()
    r = _post(client, "/list", secret="")
    assert r.status_code == 401


def test_wrong_secret_is_rejected():
    client = _client()
    r = _post(client, "/list", secret="not-the-secret")
    assert r.status_code == 401


def test_multi_chat_authorizes_any_configured_chat():
    orig_chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    os.environ["TELEGRAM_CHAT_ID"] = "12345,67890"
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/add camicia", chat_id="67890")
        assert r.status_code == 200
        assert "camicia" in store.blacklist_additions()   # seconda chat configurata: autorizzata
    finally:
        if orig_chat_id is not None:
            os.environ["TELEGRAM_CHAT_ID"] = orig_chat_id
        else:
            os.environ.pop("TELEGRAM_CHAT_ID", None)


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


def test_help_command_lists_all_registered_commands():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        client = _client()
        r = _post(client, "/help")
        assert r.status_code == 200
        assert sent
        text = sent[-1]
        for entry in w.BOT_COMMANDS:
            assert f"/{entry['command']}" in text
            assert entry["description"] in text
    finally:
        w._tg_text = orig_tg_text


def test_status_command_reports_never_run_state():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store._seen_count = 42
        client = _client(store)
        r = _post(client, "/status")
        assert r.status_code == 200
        text = sent[-1]
        assert "mai eseguito" in text
        assert "42" in text
        assert "In pausa: no" in text
    finally:
        w._tg_text = orig_tg_text


def test_status_command_reports_last_sweep_and_eta():
    import time
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.set_meta("last_sweep_at", time.time() - 600)   # 10 min fa
        store.set_meta("paused", True)
        store._seen_count = 7
        client = _client(store)
        r = _post(client, "/status")
        assert r.status_code == 200
        text = sent[-1]
        assert "mai eseguito" not in text
        assert "7" in text
        assert "In pausa: sì" in text
    finally:
        w._tg_text = orig_tg_text


def test_pause_command_sets_paused_flag():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/pause")
        assert r.status_code == 200
        assert store.get_meta("paused") is True
        assert sent and sent[-1].startswith("⏸️")
    finally:
        w._tg_text = orig_tg_text


def test_resume_command_clears_paused_flag():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.set_meta("paused", True)
        client = _client(store)
        r = _post(client, "/resume")
        assert r.status_code == 200
        assert store.get_meta("paused") is False
        assert sent and sent[-1].startswith("▶️")
    finally:
        w._tg_text = orig_tg_text


def test_query_command_lists_active_keywords():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        client = _client()
        r = _post(client, "/query")
        assert r.status_code == 200
        assert sent and "khaos" in sent[-1]
    finally:
        w._tg_text = orig_tg_text


def test_query_add_persists_override():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/query add supercross")
        assert r.status_code == 200
        assert sent and sent[-1].startswith("✅")
        active = bot_logic.effective_markets(w.settings._KEYWORDS, store.get_meta("query_override"))
        assert "supercross" in active
    finally:
        w._tg_text = orig_tg_text


def test_query_remove_persists_override():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        existing = w.settings._KEYWORDS[0]
        r = _post(client, f"/query remove {existing}")
        assert r.status_code == 200
        assert sent and sent[-1].startswith("✅")
        active = bot_logic.effective_markets(w.settings._KEYWORDS, store.get_meta("query_override"))
        assert existing not in active
    finally:
        w._tg_text = orig_tg_text


def test_price_command_shows_no_cap_by_default():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        client = _client()
        r = _post(client, "/price")
        assert r.status_code == 200
        assert sent and "nessun tetto" in sent[-1]
    finally:
        w._tg_text = orig_tg_text


def test_price_max_sets_cap():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/price max 40")
        assert r.status_code == 200
        assert store.get_meta("max_price_eur") == 40.0
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_price_max_none_clears_cap():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.set_meta("max_price_eur", 40.0)
        client = _client(store)
        r = _post(client, "/price max none")
        assert r.status_code == 200
        assert store.get_meta("max_price_eur") is None
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_price_max_rejects_invalid_value():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/price max abc")
        assert r.status_code == 200
        assert store.get_meta("max_price_eur") is None
        assert sent and sent[-1].startswith("⚠️")
    finally:
        w._tg_text = orig_tg_text


def test_export_command_sends_document_with_dynamic_words():
    sent_docs = []
    orig_send_doc = w._tg_send_document
    w._tg_send_document = lambda filename, content, caption=None: sent_docs.append((filename, content, caption))
    try:
        store = _FakeStore()
        store.add_blacklist_word("felpa")
        store.add_blacklist_word("camicia rossa")
        client = _client(store)
        r = _post(client, "/export")
        assert r.status_code == 200
        assert sent_docs
        filename, content, caption = sent_docs[-1]
        text = content.decode("utf-8")
        assert "felpa" in text and "camicia rossa" in text
    finally:
        w._tg_send_document = orig_send_doc


def test_export_command_with_empty_blacklist_sends_info_message():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        client = _client()
        r = _post(client, "/export")
        assert r.status_code == 200
        assert sent and "nessuna parola" in sent[-1].lower()
    finally:
        w._tg_text = orig_tg_text


def test_import_command_merges_words_from_document():
    sent = []
    orig_tg_text = w._tg_text
    orig_download = w._tg_download_document
    w._tg_text = lambda t: sent.append(t)
    w._tg_download_document = lambda file_id: b"felpa\ncamicia rossa\n\n"
    try:
        store = _FakeStore()
        client = _client(store)
        r = client.post(
            "/telegram-webhook",
            json={"message": {"chat": {"id": "12345"}, "caption": "/import",
                              "document": {"file_id": "abc123"}, "message_id": 1}},
            headers={"X-Telegram-Bot-Api-Secret-Token": "test-secret"},
        )
        assert r.status_code == 200
        assert "felpa" in store.blacklist_additions()
        assert "camicia rossa" in store.blacklist_additions()
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text
        w._tg_download_document = orig_download


def test_import_command_without_document_prompts_for_attachment():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        client = _client()
        r = _post(client, "/import")
        assert r.status_code == 200
        assert sent and sent[-1].startswith("⚠️")
    finally:
        w._tg_text = orig_tg_text


def test_whitelist_add_persists_word():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/whitelist add khaos")
        assert r.status_code == 200
        assert "khaos" in store.whitelist_words()
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_whitelist_remove_word():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.add_whitelist_word("khaos")
        client = _client(store)
        r = _post(client, "/whitelist remove khaos")
        assert r.status_code == 200
        assert "khaos" not in store.whitelist_words()
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_whitelist_list_shows_words():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        store.add_whitelist_word("khaos")
        client = _client(store)
        r = _post(client, "/whitelist list")
        assert r.status_code == 200
        assert sent and "khaos" in sent[-1]
    finally:
        w._tg_text = orig_tg_text


def test_snooze_command_persists_expiry():
    import time
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        before = time.time()
        r = _post(client, "/snooze khaos 24")
        assert r.status_code == 200
        snoozes = store.get_meta("snoozes", {})
        assert "khaos" in snoozes
        assert snoozes["khaos"] > before + 23 * 3600   # ~24h da ora
        assert sent and sent[-1].startswith("✅")
    finally:
        w._tg_text = orig_tg_text


def test_snooze_command_rejects_invalid_hours():
    sent = []
    orig_tg_text = w._tg_text
    w._tg_text = lambda t: sent.append(t)
    try:
        store = _FakeStore()
        client = _client(store)
        r = _post(client, "/snooze khaos abc")
        assert r.status_code == 200
        assert store.get_meta("snoozes", {}) == {}
        assert sent and sent[-1].startswith("⚠️")
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
    w.delete_bot_messages = lambda up_to_id, protected=(), chat_id=None: (
        calls.append((up_to_id, protected, chat_id)) or 3)
    orig_delete_one = w._delete_one
    w._delete_one = lambda mid, chat_id: True
    try:
        client = _client()
        r = _post(client, "/delete", msg_id=42)
        assert r.status_code == 200
        assert calls and calls[0][0] == 42
        assert calls[0][2] == "12345"   # scoperto sulla chat che ha mandato il comando
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


# ─── /sweep: trigger esterno orario (cron-job.org) ────────────────────────────

def _post_sweep(client, secret):
    headers = {"X-Sweep-Secret": secret} if secret is not None else {}
    return client.post("/sweep", headers=headers)


def _with_fake_sweep(fn):
    import threading
    ran = threading.Event()
    orig = w.ebay_monitor.run_once_safe
    w.ebay_monitor.run_once_safe = lambda: ran.set()
    try:
        return fn(ran)
    finally:
        w.ebay_monitor.run_once_safe = orig


def test_sweep_rejects_missing_or_wrong_secret():
    os.environ["SWEEP_SECRET"] = "sweep-secret"
    try:
        def check(ran):
            client = _client()
            assert _post_sweep(client, None).status_code == 403
            assert _post_sweep(client, "nope").status_code == 403
            assert not ran.wait(0.2), "nessuno sweep senza il secret giusto"
        _with_fake_sweep(check)
    finally:
        os.environ.pop("SWEEP_SECRET", None)


def test_sweep_fails_closed_when_secret_unset():
    os.environ.pop("SWEEP_SECRET", None)
    def check(ran):
        assert _post_sweep(_client(), "").status_code == 403
        assert not ran.wait(0.2)
    _with_fake_sweep(check)


def test_sweep_with_secret_answers_202_and_runs_in_background():
    os.environ["SWEEP_SECRET"] = "sweep-secret"
    try:
        def check(ran):
            r = _post_sweep(_client(), "sweep-secret")
            assert r.status_code == 202
            assert ran.wait(2), "lo sweep deve partire in background"
        _with_fake_sweep(check)
    finally:
        os.environ.pop("SWEEP_SECRET", None)


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
