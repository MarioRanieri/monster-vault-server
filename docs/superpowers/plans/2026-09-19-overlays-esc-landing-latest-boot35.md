# Plan — Esc on every overlay, latest additions on the landing, Spring Boot 3.5, docs cleanup

Spec: none (design approved in chat 2026-09-19). Branch: `feat/overlays-esc-landing-latest-boot35`.

## Global Constraints

- TDD: write the failing test first, then the code. New-code coverage > 85%.
- Code, comments in code may stay Italian where the surrounding file is Italian; commits in English,
  small and focused (one logical change each), ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- UI text in English.
- Frontend: after editing any file, LF-normalize it and run Prettier on it
  (`npx prettier --write <file>` from `frontend/`). Checkout is CRLF (`core.autocrlf`).
- Frontend checks from `frontend/`: `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build`.
- Windows FS is case-insensitive: never create two files whose names differ only by case.
- Backend tests: JDK 17 must be first on PATH (mvnw uses java.exe from PATH; JDK 25 breaks Lombok):
  ```powershell
  $j = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
  $env:JAVA_HOME = $j; $env:PATH = "$j\bin;$env:PATH"
  & "backend\mvnw.cmd" -f "backend\pom.xml" test
  ```
  Baseline: 211 backend tests green.
- Do not push, do not open PRs. Commit on the current branch only.
- No new dependencies.

## Task 1: Esc closes every overlay, only the top-most one, with focus restore

Today only Lightbox, CanDetail, StatsModal and ValueCalc close on Escape, each with its own
`globalThis.addEventListener('keydown', ...)` (see `StatsModal.tsx:291`, `CanDetail.tsx:59`).
HelpModal, LoginForm, ComparePanel, AccountPanel, CanEditForm, PhotoCrop do not. Nested overlays
exist (PhotoCrop inside CanEditForm; Lightbox inside CanDetail — CanDetail currently disables its
handler while `lbIdx !== null` to avoid closing both).

Decision (do NOT switch to `dialog.showModal()`): showModal puts the dialog in the top layer and
makes the rest of the page inert, which would hide the app toasts (rendered outside the dialogs,
e.g. save-error toasts while CanEditForm is open) and would make the non-modal ComparePanel side
panel block the page. Keep `<dialog open>` as is.

Implement one small hook, `frontend/src/useEscapeClose.ts`:
- `useEscapeClose(onClose: () => void, enabled = true)`.
- Module-level stack of registered handlers. One `keydown` listener on `globalThis` (added when the
  stack goes non-empty, removed when empty, or simply one listener per hook — your call, the
  behaviour below is what matters). On `Escape`, ONLY the most recently mounted enabled handler
  runs. So Esc in PhotoCrop closes only PhotoCrop; Esc in Lightbox closes only the Lightbox.
- Focus: on mount remember `document.activeElement`; on unmount restore focus to it if it is still
  in the document. (CanDetail already moves focus into its panel and restores it — reuse the hook
  for the restore part and delete the duplicate code, keep its "focus into panel" behaviour.)
- Unit test file `useEscapeClose.test.ts(x)`: single overlay closes; two stacked → only top closes,
  after top unmounts Esc closes the lower one; `enabled=false` is skipped; non-Escape keys ignored;
  focus restored on unmount.

Apply it to: HelpModal, LoginForm, ComparePanel, AccountPanel, CanEditForm, PhotoCrop, and migrate
StatsModal, ValueCalc, CanDetail, Lightbox to the hook (Lightbox keeps its own arrow-key handling;
only its Escape goes through the hook). Remove CanDetail's `lbIdx` guard — the stack replaces it.

CanEditForm special case: on Escape, if the form has unsaved changes (current values differ from
the values it opened with), `globalThis.confirm('Discard changes?')`; close only if confirmed. No
changes → close immediately. Find how the form tracks its state and compare against the initial
value; if a dirty flag already exists, reuse it.

Tests per component: pressing Escape calls `onClose` (one test each for the 6 new ones), plus the
CanEditForm dirty/confirm cases (clean → closes without confirm; dirty + confirm false → stays;
dirty + confirm true → closes), plus one CanDetail+Lightbox test: Esc with lightbox open closes
only the lightbox. Existing Esc tests of StatsModal/ValueCalc/CanDetail/Lightbox must stay green.

## Task 2: Spring Boot 3.3.0 → latest 3.5.x, jjwt → latest 0.12.x

`backend/pom.xml`: `spring-boot-starter-parent` 3.3.0 → the latest 3.5.x patch on Maven Central
(check it). `jjwt` 0.12.3 (both artifacts at pom lines ~39/44) → latest 0.12.x patch. Check other
explicitly-versioned deps in the pom (springdoc, bucket4j, etc.) for versions incompatible with
Boot 3.5 and bump only what is required for compatibility. Fix deprecation-driven compile errors
if any. Full backend suite must be green (baseline 211). Also make sure `Dockerfile` base image JDK
is still compatible (Boot 3.5 needs Java 17+). One commit (`chore(backend): ...`), a second one only
if a code change was required.

## Task 3: Latest additions on the landing page

`LandingPage.tsx` gets a section "Latest additions": the 8 most recent cans **with a photo**
(`c.p1` truthy), ordered by `max(createdAt ?? 0, photoAt ?? 0)` descending (most cans have no
`createdAt`; `photoAt` is the timestamp of the latest photo). Render them with the existing
`CanGrid` (`showPrice={false}`), the same way `CanDetail.tsx:291-295` renders "Other cans from this
country" (section + `h3` title; reuse the existing `detail-related*` look or add minimal landing
CSS in the same stylesheet the landing uses). Hide the section while `loading` or if empty.

Clicking a card: enter the collection (same as "ENTER THE COLLECTION": `enterCollection()` in
`App.tsx:65`) AND open that can's detail (`setSelectedId(can.id)`). Wire via a new
`onSelect(can)` prop from `App.tsx`.

Put the selection logic in a pure function (e.g. `latestAdditions(cans, limit)` in
`computeStats.ts`, next to `addedThisMonth`) with unit tests: photo-less cans excluded; order by
max(createdAt, photoAt); limit respected; cans with neither timestamp come last / excluded — pick
"excluded" (no date = not a recent addition).

Also fix `addedThisMonth` (`computeStats.ts:25`): it only counts `createdAt`, which is missing on
almost all cans, so the landing badge nearly always says "no new cans added this month". Count a
can if `max(createdAt, photoAt)` falls in the current month. Update its tests.

Tests: LandingPage renders the section with N cards; hidden while loading/empty; clicking a card
calls `onSelect` with that can; App-level test: clicking a landing card shows the collection with
the detail of that can open.

## Task 4: HANDOFF cleanup

`HANDOFF.md` only (repo root). Italian prose, matching the file.
- "Resources" section at the end: replace the Firestore console line with MongoDB Atlas (the DB is
  on MongoDB Atlas since 2026-06-25); keep Render, GitHub, Cloudinary, Swagger lines.
- The final section "## eBay Monitor (companion tool) — progetto separato" is stale (describes the
  rev 30 PC-based setup with a VLM "Modalità B" TODO). The truth, from the 2026-07-09 entry
  (~line 288) and later entries: the monitor runs on GitHub Actions + a Render webhook service for
  Telegram commands, state in MongoDB, name-based search + blacklist, photo recognition
  (CLIP/DINOv2/OCR/VLM) was tested and dropped. Rewrite that section as a short, accurate summary
  pointing to `ebay-monitor/README.md` for details. Remove every VLM / "Modalità B" TODO and the
  "Idea futura" object-detection line.
- In "Idee valutate ma NON scelte dall'utente": remove the "Tracciamento serie/set" bullet
  (user rejected it again on 2026-09-19 and asked to forget it).
- Add a new rev 62 entry at the top (after the header block, same style as rev 61) summarising
  this branch: Esc hook on all overlays (+why not showModal), latest additions on landing +
  addedThisMonth fix, Spring Boot 3.5.x / jjwt bump, this cleanup. Read `git log main..HEAD` to
  get the facts; state test counts from the actual runs. Bump the `**Updated:**` line.

## Task 5: photoAt must change only when a photo changes (runs before Task 4)

Bug found while verifying Task 3 against prod data: `MongoCanRepository.stampTimestamps`
(`backend/src/main/java/com/monstervault/repository/MongoCanRepository.java:74`) sets
`photoAt = now` whenever any of `p1..p4` is `!= null`. The frontend sends `""` for empty slots, so
EVERY save (edit of price/name/etc., restore, batch) bumps `photoAt`. In prod the most recent
`photoAt` values belong to cans with no photo at all. `photoAt` feeds the landing "Latest
additions", `addedThisMonth`, and the guest default sort (`filterCans.ts:98`).

Required behaviour of `stampTimestamps` (used by `save` and the batch save at line ~54):
- A slot is "present" only if non-null AND non-blank.
- Load the stored record once (`mongo.findById`) when `can.getId() != null` — reuse the same
  lookup for the existing `createdAt` logic instead of doing two queries.
- `photoAt = now` only if the photo slots (`p1..p4`, compared as present/blank-normalised URLs)
  differ from the stored record's, and at least one slot is present afterwards; for a brand-new can
  (no stored record) `photoAt = now` iff at least one slot is present.
- Otherwise `photoAt` = the stored record's value (never the client-sent one; null if no stored
  record). Removing all photos keeps the stored value (no special case).
- `updatedAt` and `createdAt` behaviour unchanged.
- Check the photo-upload path (`CanService.java:~337`, `setP1(url)` then save) still stamps
  `photoAt` (the URL changes → differs → stamped).

Tests (unit, mocking `MongoTemplate` like the existing `MongoCanRepository` tests): edit with
identical photos keeps stored photoAt; edit with `""` slots and no stored photos keeps stored
(null) photoAt; changed/added photo stamps now; new can with photo stamps; new can without photo
→ null; client-sent photoAt is ignored; createdAt tests still green. Full backend suite green.
Do NOT modify production data.
