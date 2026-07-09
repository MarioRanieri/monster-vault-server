"""Test della logica pura del monitor (niente rete/Mongo). Esegui:  py test_ebay_monitor.py
   Compatibile anche con pytest."""
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
