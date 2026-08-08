"""Test della logica pura del monitor (niente rete/Mongo). Esegui:  py test_ebay_monitor.py
   Compatibile anche con pytest."""
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


# ─── parse_command ────────────────────────────────────────────────────────────

def test_parse_command_add_with_arg():
    assert m.parse_command("/add camicia rossa") == ("add", "camicia rossa")

def test_parse_command_strips_bot_mention():
    assert m.parse_command("/add@MonsterBot felpa") == ("add", "felpa")

def test_parse_command_no_arg():
    assert m.parse_command("/list") == ("list", "")

def test_parse_command_not_a_command():
    assert m.parse_command("ciao") == (None, "")


# ─── validate_add_word (guardia) ──────────────────────────────────────────────

def test_add_rejects_empty_and_short():
    assert not m.validate_add_word("", REQ)[0]
    assert not m.validate_add_word("e", REQ)[0]

def test_add_rejects_required_words():
    assert not m.validate_add_word("monster", REQ)[0]
    assert not m.validate_add_word("Energy", REQ)[0]   # case-insensitive

def test_add_accepts_normal_word():
    ok, reason = m.validate_add_word("camicia", REQ)
    assert ok and reason == ""


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


# ─── mercati: resolve / effective / apply (comando /market) ───────────────────

DEF = ["EBAY_IT", "EBAY_DE", "EBAY_GB"]


def test_resolve_marketplace_friendly_and_full():
    assert m.resolve_marketplace("uk") == "EBAY_GB"
    assert m.resolve_marketplace("UK") == "EBAY_GB"
    assert m.resolve_marketplace("it") == "EBAY_IT"
    assert m.resolve_marketplace("EBAY_DE") == "EBAY_DE"
    assert m.resolve_marketplace("ebay_fr") == "EBAY_FR"

def test_resolve_marketplace_unknown_is_none():
    assert m.resolve_marketplace("narnia") is None
    assert m.resolve_marketplace("") is None
    assert m.resolve_marketplace("EBAY_ZZ") is None

def test_effective_markets_default_when_no_override():
    assert m.effective_markets(DEF, None) == DEF
    assert m.effective_markets(DEF, {}) == DEF

def test_effective_markets_applies_disabled_and_extra():
    ov = {"disabled": ["EBAY_GB"], "extra": ["EBAY_FR"]}
    assert m.effective_markets(DEF, ov) == ["EBAY_IT", "EBAY_DE", "EBAY_FR"]

def test_apply_remove_default_disables_it():
    ov, ok, _ = m.apply_market_change({}, "remove", "EBAY_GB", DEF)
    assert ok and "EBAY_GB" in ov["disabled"]
    assert m.effective_markets(DEF, ov) == ["EBAY_IT", "EBAY_DE"]

def test_apply_add_new_market_as_extra():
    ov, ok, _ = m.apply_market_change({}, "add", "EBAY_FR", DEF)
    assert ok and "EBAY_FR" in ov["extra"]
    assert "EBAY_FR" in m.effective_markets(DEF, ov)

def test_apply_add_reenables_a_disabled_default():
    ov, ok, _ = m.apply_market_change({"disabled": ["EBAY_GB"]}, "add", "EBAY_GB", DEF)
    assert ok and "EBAY_GB" not in ov.get("disabled", [])

def test_apply_remove_already_inactive_is_noop():
    _, ok, _ = m.apply_market_change({"disabled": ["EBAY_GB"]}, "remove", "EBAY_GB", DEF)
    assert not ok

def test_apply_add_already_active_is_noop():
    _, ok, _ = m.apply_market_change({}, "add", "EBAY_IT", DEF)
    assert not ok

def test_apply_cannot_remove_last_market():
    _, ok, _ = m.apply_market_change({}, "remove", "EBAY_IT", ["EBAY_IT"])
    assert not ok

def test_parse_command_market_subcommand():
    assert m.parse_command("/market remove uk") == ("market", "remove uk")
    assert m.parse_command("/market") == ("market", "")


# ─── daily_ebay_calls (guardia budget) ────────────────────────────────────────

def test_daily_ebay_calls_scales_with_markets():
    assert m.daily_ebay_calls(1, n_queries=10, runs_per_day=12) == 120
    assert m.daily_ebay_calls(6, n_queries=10, runs_per_day=12) == 720


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
