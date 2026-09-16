"""Test della logica pura del riepilogo settimanale (weekly_summary.py). Niente rete/Mongo.
Esegui:  py test_weekly_summary.py   (compatibile anche con pytest)."""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import weekly_summary as ws


def test_summarize_by_query_counts_and_sorts_desc():
    docs = [{"query": "khaos"}, {"query": "khaos"}, {"query": "rare"}, {"query": "khaos"}]
    assert ws.summarize_by_query(docs) == [("khaos", 3), ("rare", 1)]

def test_summarize_by_query_ties_break_alphabetically():
    docs = [{"query": "rare"}, {"query": "khaos"}]
    assert ws.summarize_by_query(docs) == [("khaos", 1), ("rare", 1)]

def test_summarize_by_query_empty():
    assert ws.summarize_by_query([]) == []


def test_build_weekly_summary_text_empty_week():
    text = ws.build_weekly_summary_text([])
    assert "nessun annuncio" in text.lower()

def test_build_weekly_summary_text_includes_total_and_breakdown():
    docs = [{"query": "khaos"}, {"query": "khaos"}, {"query": "rare"}]
    text = ws.build_weekly_summary_text(docs)
    assert "3" in text          # totale
    assert "khaos: 2" in text
    assert "rare: 1" in text


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
