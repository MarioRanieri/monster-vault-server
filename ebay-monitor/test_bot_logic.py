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
            t(); print(f"  + {t.__name__}")
        except Exception:
            failed += 1; print(f"  - {t.__name__}"); traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} test passati.")
    raise SystemExit(1 if failed else 0)
