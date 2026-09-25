"""Test della logica pura del monitor (niente rete/Mongo). Esegui:  py test_ebay_monitor.py
   Compatibile anche con pytest."""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import ebay_monitor as m


# ─── blacklist.txt: parsing + integrità degli spazi di confine ────────────────

def test_load_base_blacklist_skips_comments_and_blanks():
    words = m.load_base_blacklist()
    assert words, "blacklist vuota?"
    assert not any(w.lstrip().startswith("#") for w in words), "commento finito tra le parole"
    assert all(w.strip() for w in words), "riga vuota finita tra le parole"

def test_blacklist_preserves_boundary_spaces():
    # Canary: se git/un editor strippa gli spazi, questi cambiano semantica silenziosamente.
    words = set(m.load_base_blacklist())
    for w in ("atv ", "quad ", "ktm "):        # spazio FINALE
        assert w in words, f"perso lo spazio finale in {w!r}"
    for w in (" hat", " tee", " signed"):      # spazio INIZIALE
        assert w in words, f"perso lo spazio iniziale in {w!r}"


# ─── merge_blacklist ──────────────────────────────────────────────────────────

def test_merge_dedups_case_insensitive_and_appends():
    base = ["felpa", " hat"]
    out = m.merge_blacklist(base, ["Felpa", "camicia", "camicia"])
    assert out == ["felpa", " hat", "camicia"], out

def test_merge_empty_additions_returns_base():
    base = ["a", "b"]
    assert m.merge_blacklist(base, []) == base


# ─── title_passes ─────────────────────────────────────────────────────────────

REQ = ["monster", "energy"]

def test_title_requires_all_words():
    assert m.title_passes("Monster Energy Khaos", REQ, [])
    assert not m.title_passes("Monster Scooby Doo #160", REQ, [])   # manca 'energy'

def test_title_excludes_hit():
    assert not m.title_passes("Monster Energy Felpa L", REQ, ["felpa"])

def test_title_case_insensitive():
    assert not m.title_passes("MONSTER ENERGY SUPERCROSS", REQ, ["supercross"])

def test_leading_space_avoids_substring_false_positive():
    # ' hat' NON deve scattare su 'that' (t-h-a-t): il trucco dello spazio iniziale.
    assert m.title_passes("Monster Energy that rare can", REQ, [" hat"])
    assert not m.title_passes("Monster Energy trucker hat", REQ, [" hat"])

def test_whitelist_overrides_exclude_match():
    assert m.title_passes("Monster Energy Khaos felpa promo", REQ, ["felpa"], whitelist=["khaos"])

def test_whitelist_does_not_bypass_require_words():
    assert not m.title_passes("Scooby Doo Khaos felpa", REQ, ["felpa"], whitelist=["khaos"])

def test_no_whitelist_match_still_excludes():
    assert not m.title_passes("Monster Energy Khaos felpa promo", REQ, ["felpa"], whitelist=["rare"])


# ─── process: un messaggio per annuncio, "notificato" solo se l'invio riesce ──

class FakeStore:
    def __init__(self):
        self.marked = {}   # item_id -> notified
    def already_seen(self, item_id):
        return item_id in self.marked
    def mark_seen(self, item_id, *a, notified=False):
        self.marked[item_id] = notified


def _listing(i):
    return ("EBAY_IT", "monster energy", {
        "itemId": f"id{i}", "title": f"Monster Energy can {i}",
        "price": {"value": "5", "currency": "EUR"}, "itemWebUrl": f"https://e/{i}"})


def _run_process(n, send_result):
    calls = []
    orig = (m.gather_listings, m.send_telegram, m.time.sleep)
    m.gather_listings = lambda *a, **k: [_listing(i) for i in range(n)]
    m.send_telegram = lambda *a, **k: calls.append(a) or send_result
    m.time.sleep = lambda s: None
    try:
        store = FakeStore()
        examined, sent = m.process(store, "tok", [])
        return store, calls, examined, sent
    finally:
        m.gather_listings, m.send_telegram, m.time.sleep = orig


def test_process_sends_one_message_per_listing_even_when_many():
    store, calls, examined, sent = _run_process(8, True)
    assert len(calls) == 8, "niente digest: un messaggio per ogni annuncio"
    assert (examined, sent) == (8, 8)
    assert all(store.marked[f"id{i}"] is True for i in range(8))


def test_process_leaves_listing_unseen_when_send_fails():
    # Invio fallito → l'annuncio NON va segnato come visto: il giro dopo lo riprova.
    store, calls, examined, sent = _run_process(2, False)
    assert len(calls) == 2
    assert (examined, sent) == (2, 0)
    assert store.marked == {}


# ─── Telegram: retry sul 429 + escape HTML ────────────────────────────────────

class FakeResp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body
        self.ok = status == 200
        self.text = str(body)
    def json(self):
        return self._body


def _with_fake_post(responses, fn):
    posted, slept = [], []
    orig = (m.requests.post, m.time.sleep)
    m.requests.post = lambda url, data=None, timeout=None: posted.append((url, data)) or responses.pop(0)
    m.time.sleep = lambda s: slept.append(s)
    try:
        return fn(), posted, slept
    finally:
        m.requests.post, m.time.sleep = orig


def test_tg_post_retries_once_on_429_respecting_retry_after():
    responses = [FakeResp(429, {"ok": False, "parameters": {"retry_after": 3}}),
                 FakeResp(200, {"ok": True})]
    r, posted, slept = _with_fake_post(responses, lambda: m._tg_post("sendMessage", {"chat_id": "1"}))
    assert r.ok and len(posted) == 2
    assert slept and slept[0] >= 3


def test_send_telegram_escapes_html_in_title_and_url():
    import os
    os.environ["TELEGRAM_CHAT_ID"] = "1"
    responses = [FakeResp(200, {"ok": True})]
    ok, posted, _ = _with_fake_post(responses, lambda: m.send_telegram(
        "Monster <Ultra> & Co", "5", "EUR", "https://e/1?a=1&b=2", "", "EBAY_IT", "ricerca: x"))
    caption = posted[0][1]["text"]
    assert ok
    assert "Monster &lt;Ultra&gt; &amp; Co" in caption
    assert "a=1&amp;b=2" in caption


# ─── run_once: il turno di sweep si prenota su Mongo (claim_sweep) ────────────

class ClaimStore:
    """Store finto per run_once: claim_sweep risponde come configurato."""
    def __init__(self, claim_ok):
        self.claim_ok, self.claims, self.closed = claim_ok, [], False
        self.client = self
    def close(self):
        self.closed = True
    def get_meta(self, key, default=None):
        return default
    def claim_sweep(self, now, min_interval):
        self.claims.append(min_interval)
        return self.claim_ok


def _run_once_with(store, **kwargs):
    import os
    tokens = []
    orig = (m.Store, m.get_ebay_token, os.environ.get("MONGODB_URI"))
    m.Store = lambda uri: store
    m.get_ebay_token = lambda: tokens.append(1)   # None → run_once si ferma subito dopo
    os.environ["MONGODB_URI"] = "mongodb://fake"
    try:
        m.run_once(**kwargs)
        return tokens
    finally:
        m.Store, m.get_ebay_token = orig[0], orig[1]
        if orig[2] is None:
            os.environ.pop("MONGODB_URI", None)
        else:
            os.environ["MONGODB_URI"] = orig[2]


def test_run_once_skips_when_sweep_already_claimed():
    # Un altro trigger (GitHub Actions o /sweep) ha già il turno: niente ricerca eBay.
    store = ClaimStore(claim_ok=False)
    assert _run_once_with(store) == []
    assert store.claims, "run_once deve prenotare il turno prima di cercare"
    assert store.closed, "il MongoClient va chiuso anche quando il giro si ferma presto"


def test_run_once_searches_when_claim_succeeds():
    store = ClaimStore(claim_ok=True)
    assert _run_once_with(store) == [1]


def test_run_once_send_now_bypasses_the_claim():
    # Il test --send-now non tocca la cadenza reale: niente prenotazione.
    store = ClaimStore(claim_ok=False)
    assert _run_once_with(store, send_now=True) == [1]
    assert store.claims == []


# ─── run_once_safe (alert Telegram sui crash imprevisti) ──────────────────────

def test_run_once_safe_alerts_and_reraises_on_crash():
    alerts = []
    orig_run_once = m.run_once
    orig_tg_text = m._tg_text
    m.run_once = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom"))
    m._tg_text = lambda t: alerts.append(t)
    try:
        raised = False
        try:
            m.run_once_safe()
        except RuntimeError:
            raised = True
        assert raised, "run_once_safe deve rilanciare l'eccezione (il job resta 'failed')"
        assert alerts and "boom" in alerts[-1]
    finally:
        m.run_once = orig_run_once
        m._tg_text = orig_tg_text


def test_run_once_safe_lets_keyboard_interrupt_through_without_alert():
    alerts = []
    orig_run_once = m.run_once
    orig_tg_text = m._tg_text
    m.run_once = lambda *a, **k: (_ for _ in ()).throw(KeyboardInterrupt())
    m._tg_text = lambda t: alerts.append(t)
    try:
        raised = False
        try:
            m.run_once_safe()
        except KeyboardInterrupt:
            raised = True
        assert raised
        assert not alerts, "Ctrl+C non è un crash: nessun alert"
    finally:
        m.run_once = orig_run_once
        m._tg_text = orig_tg_text


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
