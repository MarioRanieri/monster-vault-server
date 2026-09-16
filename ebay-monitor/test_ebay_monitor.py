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


# ─── build_digest_text (digest quando il giro trova molti annunci) ────────────

def test_build_digest_text_includes_count_and_all_items():
    items = [
        {"title": "Monster Khaos", "price": "10", "currency": "EUR", "url": "https://a", "site": "EBAY_IT"},
        {"title": "Monster Rare", "price": "20", "currency": "EUR", "url": "https://b", "site": "EBAY_DE"},
    ]
    text = m.build_digest_text(items)
    assert "2" in text.split("\n", 1)[0]   # intestazione con il conteggio
    for it in items:
        assert it["title"] in text
        assert it["url"] in text


# ─── sweep_due (gate ricerca eBay ogni 1h) ────────────────

INT = 3600  # 1h

def test_sweep_due_first_time():
    assert m.sweep_due(None, 1000, INT) is True          # mai fatto → sweep

def test_sweep_due_send_now_forces():
    assert m.sweep_due(999, 1000, INT, send_now=True) is True   # test ignora il gate

def test_sweep_due_too_soon():
    assert m.sweep_due(1000, 1000 + 600, INT) is False   # 10 min dopo → solo drain

def test_sweep_due_elapsed():
    assert m.sweep_due(1000, 1000 + INT, INT) is True     # passate 2h → sweep


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
