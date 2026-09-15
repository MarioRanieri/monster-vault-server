# eBay Monitor — Telegram webhook + reliable sweep cron

## Problem

The Telegram bot (`ebay-monitor/`) is unreliable in two connected ways, both traced to the same
root cause: it relies on GitHub Actions' native `schedule` cron firing every 5 minutes
(`*/5 * * * *`) to both drain Telegram commands and gate the ~2h eBay sweep. Checking the actual
run history (`gh run list --workflow=ebay-monitor.yml`) shows real gaps of 2–6 hours between runs,
not 5 minutes — GitHub deprioritizes very-frequent schedules on low-traffic public repos.

This causes the three symptoms the user reported:

1. **Commands (`/add`, `/list`, `/market`, `/delete`) take hours to respond**, not the 5–15 min the
   in-chat banner promises.
2. **Notifications arrive in bursts after long silences**: since `SWEEP_INTERVAL_SECONDS=7200` (2h)
   is gated on a tick that itself only fires every 2–6h, many new listings accumulate before a
   sweep finally runs and sends them all at once.
3. **Some listings are likely missed entirely**: `MAX_LISTING_AGE_HOURS=3.5` was sized to absorb
   *minutes* of cron drift, not the *hours* actually observed — a listing can age out of eBay's
   "freshly listed" filter window before the next sweep ever looks for it.

A fourth reported symptom — the same exact listing notified more than once — is *not* addressed by
this design: investigation of the Mongo-backed dedup (`ebay_seen`, idempotent upsert) and the
per-run `sent_ids` set found no bug. The most likely cause is eBay itself: a re-listed item gets a
new `itemId` even though it's visually identical, and the project has already tried and rejected
photo-based matching (CLIP/DINOv2/OCR/VLM — see `ebay-monitor/README.md`) as too inaccurate. Junk
listings ("non c'entrano nulla") are a blacklist curation gap, not a code bug — `/add` (now instant,
see below) is the fix, not this design.

## Goals

- Telegram commands respond in seconds, not hours.
- The eBay sweep runs on a dependable ~1h cadence (chosen by the user — see Budget below),
  independent of command traffic.
- No changes to `backend/` (the Java site) — the user explicitly does not want the bot's
  reliability problem to add risk or coupling to the deployed site.
- Stay within eBay's free Browse API budget (5,000 calls/day, verified current as of 2026 via
  eBay's own docs and developer community).

## Non-goals

- De-duplicating re-listed items with a new `itemId` (rejected approach, see Problem).
- Blacklist curation (user's ongoing job via `/add`, unaffected by this design).
- Any change to `backend/` or the deployed site.

## Budget check

Current: 6 marketplaces × 26 queries × 12 sweeps/day (2h) ≈ 1,870 calls/day (37% of the 5,000/day
free-tier cap). At the user's chosen 1h cadence: 6 × 26 × 24 ≈ 3,744 calls/day (~75% of budget) —
comfortably under the cap, with headroom shrinking if marketplaces/queries grow later via
`/market add`. eBay's Browse API free tier is confirmed still 5,000 calls/day per app (Application
Growth Check available for free if this is ever outgrown).

## Architecture

Two independent processes, split by responsibility — command handling needs to be instant and
event-driven; the eBay sweep needs to be periodic and budget-gated. Forcing both through the same
GitHub Actions cron tick is the root cause being fixed, so they're decoupled onto two different
trigger mechanisms:

- **A second Render Web Service** (free tier, separate from the existing Java site — different
  root directory in the same repo, `ebay-monitor/`), running a small Flask app that receives
  Telegram's **webhook** calls and executes commands immediately. Same trade-off the Java site
  already lives with: a free Render service sleeps after inactivity, so the very first command
  after a long quiet period has a ~30–50s cold start before Telegram's retry gets through — still
  a large improvement over today's multi-hour wait, and unlike the cron problem, this delay is
  bounded and predictable.
- **GitHub Actions, unchanged mechanism** but on its own dedicated hourly cron, running only the
  eBay sweep — no more command draining sharing (and starving) its schedule slot.

Both processes read/write the same MongoDB Atlas collections (`ebay_blacklist`, `ebay_meta`) they
use today; `ebay_seen` remains sweep-only, untouched by the webhook.

```
Telegram user
  │ /add, /list, /market, /delete
  ▼
Telegram servers ── webhook POST ──► Render Web Service #2 (webhook_app.py)
                                          │ reads/writes ebay_blacklist, ebay_meta
                                          ▼
                                      MongoDB Atlas (shared cluster, dedicated collections)
                                          ▲ reads
                                          │
GitHub Actions (hourly cron) ──► ebay_monitor.py (sweep only)
                                          │ notifies
                                          ▼
                                      Telegram chat (sendMessage/sendPhoto)
```

## Components

### `ebay-monitor/bot_logic.py` (new, shared)

Extracted from today's `ebay_monitor.py` so the sweep script and the new webhook app use the exact
same, already-tested logic — no behavior change, just a new home:

- `Store` (Mongo access: `get_meta`/`set_meta`/`blacklist_additions`/`add_blacklist_word`, plus the
  `seen`/`already_seen`/`mark_seen` methods the sweep still needs)
- `parse_command`, `validate_add_word`, `resolve_marketplace`, `apply_market_change`,
  `effective_markets`, `daily_ebay_calls`

### `ebay-monitor/webhook_app.py` (new)

Flask app, one route: `POST /telegram-webhook`.

1. Validate the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` (new
   env var/secret) — mismatch or missing → `401`, nothing processed, no reply sent.
2. Validate `message.chat.id` equals `TELEGRAM_CHAT_ID` — mismatch → `200` with no reply (don't
   reveal the bot's behavior to an unauthorized chat).
3. Parse and execute the command via `bot_logic` (same `_handle_command`-style dispatch as today,
   moved here), reply via Telegram's `sendMessage`/`deleteMessage` synchronously, return `200`.
4. On a Mongo error mid-command: reply "⚠️ problema temporaneo, riprova tra poco", log
   server-side, still return `200` (avoid Telegram retry storms on a real outage).

Also registers the bot's command menu (`setMyCommands`) and description **once at process
startup**, unconditionally — no need for the current signature-tracked skip-if-unchanged
optimization, since a Render service restarts far less often than the old 5-min cron ran.

The banner explaining "commands take up to 2h" is removed entirely (`ensure_banner`,
`register_bot_ui`, `BANNER_TEXT`) — it's no longer true.

### `ebay-monitor/ebay_monitor.py` (trimmed)

Keeps only the sweep: connect Mongo → (no more `drain_commands`/`register_commands_menu`) → search
eBay → filter → notify. Removes `drain_commands`, `_handle_command`, `_delete_one`,
`delete_bot_messages`, `ensure_banner`, `register_bot_ui`, `register_commands_menu`, `BANNER_TEXT`,
`BOT_COMMANDS` (menu list moves to `webhook_app.py`). `parse_command`, `validate_add_word`,
`resolve_marketplace`, `apply_market_change` move to `bot_logic.py` and are imported from there
(kept, not duplicated) since `effective_markets` is still needed to resolve active markets for the
sweep.

### `ebay-monitor/settings.py`

- `SWEEP_INTERVAL_SECONDS`: `7200` → `3600` (1h, user's choice).
- `MAX_LISTING_AGE_HOURS`: `3.5` → `2` (was sized to absorb multi-hour cron drift; a real hourly
  cron only needs a margin over its own 1h interval).

### `.github/workflows/ebay-monitor.yml`

- `cron: '*/5 * * * *'` → `cron: '7 * * * *'` (hourly, offset 7 minutes past the hour — GitHub's
  own docs flag the top of the hour as the highest-delay window; offsetting avoids the worst of it).
- Drop the `send_now` test path's reliance on command-draining context (unaffected — it already
  only triggers the sweep).

### Render setup (operational, not code)

1. New Web Service on Render, free tier, root directory `ebay-monitor/`, start command
   `gunicorn webhook_app:app --bind 0.0.0.0:$PORT` (gunicorn added to `requirements.txt` — Flask's
   built-in dev server isn't meant for even light production traffic).
2. Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONGODB_URI` (same values as the existing
   GitHub Secrets — Render env vars are a separate store, must be copied over once),
   `TELEGRAM_WEBHOOK_SECRET` (new, generated once, e.g. `openssl rand -hex 32`).
3. One-time `curl` to Telegram's `setWebhook`:
   ```
   curl https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url=https://<new-service>.onrender.com/telegram-webhook \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```
   After this, Telegram stops delivering updates via `getUpdates` (mutually exclusive with a
   webhook) — consistent with removing `drain_commands`, which called `getUpdates`.

## Testing

- `ebay-monitor/test_bot_logic.py` (new): the command-parsing/validation tests currently in
  `test_ebay_monitor.py` (`parse_command`, `validate_add_word`, `resolve_marketplace`,
  `apply_market_change`, `effective_markets`, `daily_ebay_calls`), moved as-is — same assertions,
  new home, since the logic itself doesn't change.
- `ebay-monitor/test_webhook_app.py` (new): Flask test client, no real network/Mongo (mock `Store`
  and `requests.post` the same way the project already avoids real network in tests) — covers:
  missing/wrong secret → 401 and nothing executed; wrong `chat_id` → 200, no Mongo write, no reply;
  each command (`/add`, `/list`, `/market`, `/delete`) → correct Mongo write/read and a Telegram
  reply attempted; Mongo failure mid-command → graceful reply + 200, not a 500.
- `ebay-monitor/test_ebay_monitor.py` (trimmed): keeps only what's still sweep-only —
  `title_passes`, `merge_blacklist`, `load_base_blacklist`, `sweep_due`, and the blacklist-file
  whitespace canary test.

## Manual verification (post-deploy, one-time)

1. Deploy the new Render service, set env vars, run `setWebhook`.
2. Send `/add test123` in the chat — confirm a reply within seconds (not hours), then `/list`
   shows it.
3. Confirm the next scheduled GitHub Actions run (hourly, `:07`) completes and reads the
   dynamically-added blacklist word (visible in its log output).
4. Remove `test123` by hand from the `ebay_blacklist` Mongo collection (no `/remove` command exists
   today — out of scope for this design, unchanged from current behavior).
