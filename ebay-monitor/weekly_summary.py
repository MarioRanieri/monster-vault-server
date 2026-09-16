#!/usr/bin/env python3
"""Riepilogo settimanale Monster Energy eBay Monitor: quanti annunci notificati negli ultimi
7 giorni, raggruppati per query (quali keyword rendono di più). Gira su un workflow GitHub
Actions dedicato (cron settimanale, separato dallo sweep orario) — vedi
.github/workflows/ebay-monitor-weekly-summary.yml.

Segreti da variabili d'ambiente (GitHub Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, MONGODB_URI.
"""
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

from bot_logic import Store, _tg_text

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


# ─── LOGICA PURA (testabile senza rete/Mongo) ─────────────────────────────────

def summarize_by_query(docs):
    """docs: lista di {'query': ...}. Ritorna [(query, count), ...], ordinato per count
    decrescente (a parità, alfabetico — risultato deterministico). Puro."""
    counts = Counter(d.get("query", "") for d in docs)
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))


def build_weekly_summary_text(docs):
    """Testo del messaggio Telegram del riepilogo. Puro."""
    total = len(docs)
    if total == 0:
        return "📊 Riepilogo settimanale: nessun annuncio notificato negli ultimi 7 giorni."
    lines = [f"• {q or '(query generica)'}: {c}" for q, c in summarize_by_query(docs)]
    return f"📊 Riepilogo settimanale: {total} annunci notificati\n\n" + "\n".join(lines)


# ─── RUN ────────────────────────────────────────────────────────────────────

def run_weekly_summary():
    uri = os.environ.get("MONGODB_URI", "")
    if not uri:
        print("⚠️  Manca MONGODB_URI (Secret)."); return
    store = Store(uri)
    since = datetime.now(timezone.utc) - timedelta(days=7)
    docs = store.notified_since(since)
    text = build_weekly_summary_text(docs)
    _tg_text(text)
    print(text)


if __name__ == "__main__":
    run_weekly_summary()
