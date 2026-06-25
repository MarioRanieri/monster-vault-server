# Monster Vault — Sheet ↔ backend sync

A Google Apps Script (`MonsterVaultSync.gs`) bound to the **"Monster Vault Sync"**
Google Sheet. It syncs the **text fields** of the collection between the sheet and
the database, talking to the **Spring backend REST API** — it does **not** touch
the database directly.

> Rewritten 2026-06-25 after the Firestore→MongoDB migration. The old version spoke
> directly to Firestore with a service-account key; it now logs in as admin and uses
> the public/JWT API, so it works regardless of which database the backend runs on.

Use it to bulk-edit cans in a spreadsheet. Photos are managed only in the app.

## What it does

| Menu item | Action |
|---|---|
| ⬇️ Scarica completo | `GET /api/cans` → Sheet, all active cans (trashed ones already excluded by the backend) |
| ⚡ Scarica novità | Only cans changed since last sync, and removes rows whose can is no longer active |
| ⬆️ Carica | Sheet → `POST /api/cans/batch`, text fields only |
| 🔄 Reset sync | Forget the last-sync timestamp |

The push **merges**: each row is applied on top of the can fetched from the
backend, so **photos (`p1..p4`, `p1Id..p4Id`) and the soft-delete / `updatedAt`
fields are preserved** — only the text fields are overwritten. (The backend upserts
the whole document, so sending a partial object would wipe the photos; merging
avoids that. Side note: the server re-stamps `photoAt` on every save when photos
are present — harmless, just a timestamp bump.)

## Setup (one-time)

No service-account key is needed anymore. The script authenticates as the admin
user. Credentials live in **Script Properties** (never in the source — this repo is public):

1. Open the Sheet → **Extensions → Apps Script**.
2. Paste the contents of `MonsterVaultSync.gs`.
3. **Project Settings (⚙) → Script properties → Add script property**:
   - `MV_USERNAME` = the admin username
   - `MV_PASSWORD` = the admin password
   - `BACKEND_URL` = `https://monster-vault-server.onrender.com` *(optional — this is the default)*
4. Reload the Sheet → the **🥤 Monster Vault** menu appears → run any item
   (authorize when prompted).

> ⚠️ Keep the admin credentials in Script Properties only — never inline them in
> the `.gs` file or commit them.

## Matching IDs

A new can added from the sheet gets the **same** id the app would generate
(`can_` + hash of `nome|sku|produttore|lingua|size|top|promo`), so a can created
in the sheet and the same can created in the app collapse to one document instead
of duplicating.

## Note on the `.xlsx`

The columns already match the current data model, so the `Monster Vault Sync.xlsx`
file itself needs no change — only the bound Apps Script (this file) is updated.
