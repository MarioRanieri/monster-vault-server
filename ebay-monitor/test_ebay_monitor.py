"""Test della logica pura del monitor (niente rete/Mongo). Esegui:  py test_ebay_monitor.py
   Compatibile anche con pytest."""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import ebay_monitor as m
import settings


class _FakeStore:
    """Store in memoria: sostituisce Mongo nei test dell'handler (get_meta/set_meta)."""
    def __init__(self):
        self._m = {}
    def get_meta(self, k, d=None):
        return self._m.get(k, d)
    def set_meta(self, k, v):
        self._m[k] = v


def _capture_market(arg, store=None):
    """Esegue /market <arg> con Telegram stubbato; ritorna (store, ultimo_messaggio)."""
    sent = []
    orig, m._tg_text = m._tg_text, lambda t: sent.append(t)
    try:
        store = store or _FakeStore()
        m._handle_command(store, "market", arg, 0)
        return store, (sent[-1] if sent else "")
    finally:
        m._tg_text = orig


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


# ─── sweep_due (gate ricerca eBay ogni 2h, comandi ogni 5 min) ────────────────

INT = 7200  # 2h

def test_sweep_due_first_time():
    assert m.sweep_due(None, 1000, INT) is True          # mai fatto → sweep

def test_sweep_due_send_now_forces():
    assert m.sweep_due(999, 1000, INT, send_now=True) is True   # test ignora il gate

def test_sweep_due_too_soon():
    assert m.sweep_due(1000, 1000 + 600, INT) is False   # 10 min dopo → solo drain

def test_sweep_due_elapsed():
    assert m.sweep_due(1000, 1000 + INT, INT) is True     # passate 2h → sweep


# ─── handler /market (store finto, Telegram stubbato) ─────────────────────────

def test_market_remove_persists_and_confirms():
    store, msg = _capture_market("remove uk")
    assert "EBAY_GB" in store.get_meta("market_override")["disabled"]
    assert msg.startswith("✅")
    eff = m.effective_markets(settings.EBAY_MARKETPLACES, store.get_meta("market_override"))
    assert "EBAY_GB" not in eff

def test_market_invalid_rejected_without_state_change():
    store, msg = _capture_market("add narnia")
    assert store.get_meta("market_override") is None      # nessuna scrittura
    assert "non valido" in msg

def test_market_no_arg_lists_active():
    _, msg = _capture_market("")
    assert "Mercati attivi" in msg

def test_market_add_near_budget_warns():
    # abbastanza mercati da superare l'80% del budget → il messaggio deve avvisare
    store = _FakeStore()
    big = [f"EBAY_X{i}" for i in range(40)]
    store.set_meta("market_override", {"disabled": [], "extra": big})
    _, msg = _capture_market("add fr", store)
    assert "chiamate eBay/giorno" in msg


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
