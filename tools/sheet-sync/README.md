# Monster Vault — Sheet ↔ Firestore sync

> ⚠️ **Deprecated (2026-06-25).** The backend migrated from Firestore to MongoDB. This tool
> talks **directly to Firestore**, so it no longer reflects live data and is effectively
> broken. It needs a rewrite to go through the Spring REST API (or the Mongo driver) before
> it can be used again.

A Google Apps Script (`MonsterVaultSync.gs`) bound to the **"Monster Vault Sync"**
Google Sheet. It syncs the **text fields** of the collection between the sheet and
Firestore, talking **directly to Firestore** (REST API + service account) — it does
**not** go through the Spring backend.

Use it to bulk-edit cans in a spreadsheet. Photos are managed only in the app.

## What it does

| Menu item | Action |
|---|---|
| ⬇️ Scarica completo | Firestore → Sheet, all cans (trashed ones excluded) |
| ⚡ Scarica novità | Only cans changed since last sync (and removes rows that were trashed) |
| ⬆️ Carica | Sheet → Firestore, text fields only |
| 🔄 Reset sync | Forget the last-sync timestamp |

The push uses an `updateMask` of text fields only, so **photos (`p1..p4`,
`p1Id..p4Id`) and the soft-delete / `updatedAt` / `watch` fields are never
overwritten**.

## Setup (one-time)

The service-account key is **not** stored in the script (this repo is public).
Provide it via Script Properties:

1. Open the Sheet → **Extensions → Apps Script**.
2. Paste the contents of `MonsterVaultSync.gs`.
3. **Project Settings (⚙) → Script properties → Add script property**:
   - Name: `SERVICE_ACCOUNT_JSON`
   - Value: the **full** Firebase service-account JSON, on one line
     (Firebase console → Project settings → Service accounts → Generate new private key).
4. Reload the Sheet → the **🥤 Monster Vault** menu appears → run any item
   (authorize when prompted).

> ⚠️ Never paste the key into the `.gs` file or commit it. Keep it in Script
> Properties only. If a key was ever committed/shared, rotate it in the Firebase console.

## Changes vs the old script

- **No hardcoded credentials** — the service-account key now lives in Script
  Properties instead of being inlined in the source (the old file leaked it).
- **Soft-delete aware** — cans in the trash (`deletedAt` set by the app) are
  excluded from the full pull, and the incremental pull removes their rows. The
  old script showed trashed cans and could resurrect them.
- **Matching IDs** — a new can added from the sheet now gets the **same** id the
  app would generate (`can_` + hash of `nome|sku|produttore|lingua|size|top|promo`).
  The old script hashed only 5 fields → duplicates.

## Note on the `.xlsx`

The columns already match the current data model, so the `Monster Vault Sync.xlsx`
file itself needs no change — only the bound Apps Script (this file) is updated.
