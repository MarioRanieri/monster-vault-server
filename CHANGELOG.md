# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Excel export/import** — the collection exports to `.xlsx` (SheetJS, lazy-loaded as a separate chunk) and imports both `.xlsx/.xls` and the legacy CSV, with header aliases for the old Google-Sheet columns and deterministic ids so re-imports merge instead of duplicating.
- **Interactive stats** — the Stats modal gained click-to-filter breakdowns, a condition section, an admin-only Top-10-by-value list (click opens the can) and a 12-month timeline switchable between can count and € value.
- **Lightbox zoom/pan** — wheel and double-click zoom to the cursor, pinch-zoom and drag pan on touch; swipe still changes photo when not zoomed.
- **Photo slot reorder** — drag & drop between slots on desktop, ⇄ tap-swap for touch; works on staged uploads before saving.
- **Offline cache & cold-start UX** — cans are cached in localStorage and shown instantly (stale-while-revalidate) with an "Updated …" timestamp; 5xx responses retry 3× with a "Server warming up…" message; the landing shows placeholders instead of zeros while loading.

### Fixed
- **Sessions survive backend restarts** — refresh tokens moved from an in-memory map to a Mongo-persisted store (keyed by SHA-256 hash, TTL index on expiry), so Render cold starts no longer force a re-login on every reload.
- **Silent token refresh** — a 401 now refreshes the access token (single-flight) and retries the request once. Also restored from the old app: the 10s undo window on can delete, PWA registration (manifest tags + service worker), filters persisting across reloads, and the green/yellow/red condition badge colors.
- **Edit form polish** — crop preselects the whole image and freezes on pointer release; slot previews show the full photo (contain); Promo is a Yes/No select that preserves historical values; Name + SKU are validated; header buttons regained their icons and the green admin avatar is back (mobile header is a single icon-only row again).

### Removed
- **eBay watch flag & photo rotate** — deliberately dropped in the React migration (leftover watch types, help text and CSS cleaned up); rotate saw no use.

### Added
- **Frontend rewritten in React** — the seven vanilla-TypeScript modules (`core/ui/tools/photos/share/pwa/types`) were replaced by a **React 19 + Vite + TypeScript (strict)** single-page app with **Zustand** state, one component per feature (grid/list/wall views, can detail, edit modal, stats, compare, value calculator, saved views, share). The old dark-theme look and all features were preserved; the build still embeds into the backend's static resources (same-origin). Tested with **Vitest + React Testing Library** (158 tests) instead of the legacy Jest suite; Playwright smoke tests kept in CI.
- **Admin password management (no email)** — the admin credential moved from `application.properties` into MongoDB (`admin_credentials`, seeded from config on first run, only hashes stored). New endpoints: `PUT /api/account/password` (change password — authenticated, verifies the current one, revokes all sessions), `POST /api/account/recovery-code` (generate a one-time backup code, shown once), `POST /api/auth/recover` (reset the password with that code — rate-limited, single-use). The recovery code is never handed to whoever requests it; it must be entered, like GitHub/Google backup codes.
- **SonarCloud quality gate** — wired into CI on the new-code period; currently **green** (0 bugs, 0 vulnerabilities, new-code coverage ≥ 80%).

### Changed
- **Login redesigned** — labels + icons, show/hide password, Caps-Lock warning, loading spinner, and distinct errors from the HTTP status (401 wrong credentials, 429 too many attempts, network). A "Forgot password?" link opens the recovery flow; an Account panel changes the password and generates the recovery code. The guest hero shows the owner's name ("RedMghost's Collection"), not "Your Collection".

### Fixed
- **Add/Edit can photo flow** — uploading a photo no longer forces the full-screen crop overlay (which covered the Save button, so saving looked broken). Uploads stage directly; cropping is on-demand by clicking a photo (works for existing Cloudinary photos too, via `crossOrigin`). Photo upload on save is wrapped so a storage hiccup shows a toast instead of hanging the modal.
- **Accessibility + SonarQube smells** — added keyboard handlers to clickable photos/slots, silenced a localStorage false-positive, and cleared ~40 code smells (read-only component props, `Number.parseInt/parseFloat`, `globalThis`, extracted nested ternaries).

### Changed
- **Database migrated from Firestore to MongoDB Atlas** — the Firestore adapter was replaced by `MongoCanRepository` behind the existing `CanRepository` port (SOLID DIP), so `CanService` and the controllers were untouched. Removed `firebase-admin`, `FirebaseConfig` and the Firestore-specific quota exception; the connection URI now comes from the `SPRING_DATA_MONGODB_URI` env var. Data was restored from the weekly `backups` branch dump.

- **Rich link previews + native mobile share** — per-can share links point at `/share/{id}` (server-rendered Open Graph with the can's photo, cropped to 1200×630 via Cloudinary); on touch devices the Share button opens the native OS share sheet (Web Share API). Sharing is now enabled in guest mode, and the collector name is fixed to `RedMghost`.

### Removed
- **Dead Firestore-quota handling (frontend)** — dropped the unreachable `429` branch and the "Firebase Free tier: daily quota exceeded" user messages in `ui.ts`; `GET /api/cans` is not rate-limited, so that path could no longer trigger.
- **Unused proactive token-refresh helper (frontend)** — removed `checkAndRefreshToken()` from `core.ts`; silent refresh now happens on-401 inside `apiCall`, so the timer-style proactive check was never called.
- **`/delete` confirmation message (eBay monitor)** — dropped the "🗑️ Cancellati N" Telegram reply; it was sent only after the whole deletion sweep, so it always landed late. The `/delete` command message is deleted too, so its disappearance is the feedback.

### Changed
- **eBay monitor `/delete` made fast** — the Telegram `/delete` sweep now deletes its messages in parallel (`ThreadPoolExecutor`, `DELETE_WORKERS`, default 12) instead of up to `DELETE_SCAN_BACK` (300) sequential `deleteMessage` calls with a per-call sleep; a single 429 retry honouring `retry_after` keeps concurrency from leaving messages behind.
- **eBay monitor noise filter** — added `wheel`, `tyre8` and `ogio` to `EXCLUDE_WORDS`.

### Changed
- **Post-migration cleanup** — `tools/sheet-sync` Apps Script rewritten to talk to the backend REST API instead of Firestore (admin login + `GET /api/cans` for pulls, `POST /api/cans/batch` for pushes, with a photo-preserving merge); frontend data-layer helpers renamed `*FS` → `*Api` (they call REST, not Firestore); backend javadoc/comments de-Firestored and the false batch-atomicity claim removed.

## [0.2.0] - 2026-06-21

### Added
- **Refresh token flow** — short-lived access token (15 min) in memory + long-lived refresh token (7 days) in an HttpOnly/Secure/SameSite=Strict cookie; rotation on every refresh, revocation on logout, in-memory `RefreshTokenStore` (SHA-256 hashed). New endpoints `POST /api/auth/logout`; `POST /api/auth/refresh` now reads the cookie. Frontend does silent refresh on 401 and recovers the session at boot.
- **SEO / AEO assets** — `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD structured data, meta description, canonical URL, preconnect hints; `ShareController` (`GET /share/{id}`) serves per-can Open Graph meta for social/chat previews.
- **Frontend tooling** — Vite bundler, TypeScript strict, ESLint, Prettier; CI gate runs lint + format-check + build.
- **Playwright E2E smoke tests** — 4 tests against the built frontend with the API mocked (no backend/DB), failing on any uncaught JS error; dedicated CI job installs Chromium and runs them (the Selenium E2E never ran in CI for lack of a browser).

### Changed
- **Project restructure** — split into `backend/` (Spring Boot) and `frontend/` (PWA); root `Dockerfile` is now 3-stage (Node build → Maven build → JRE run); CI and `.gitignore` paths updated. Same-origin serving preserved (frontend built into the backend's static resources).
- **Frontend modularization** — the ~4000-line `index.html` monolith extracted into 7 TypeScript modules (`core`, `ui`, `tools`, `photos`, `share`, `pwa`, `types`); CSS extracted to `styles/main.css`; static assets moved to `public/`; production build is a 102 KB JS + 50 KB CSS bundle.
- **Backend code quality** — constructor injection throughout (removed field `@Autowired`), unused imports removed, Lombok upgraded to 1.18.38.
- **Landing redesign** — replaced the sci-fi "HUD" landing with a "Flavor Spectrum" hero: a claw-slash mark revealing a Monster flavor-color band, a Monster claw-M logo, a monospace stats ledger wired to live counts, and a dismissible "what's new" notice. "With photo" now counts cans with ≥1 of the 4 photo slots.
- **Release docs** — added a "Release & rollback" section to the README (branch+PR + CI gate, Render build-fail safety net, health check, rollback).

### Fixed
- **Vite asset 401 (white screen)** — `SecurityConfig` now permits `/assets/**` (and `/*.css`); the hashed Vite bundles fell through to `authenticated()` and returned 401, so no JS/CSS loaded.
- **Broken cross-module calls** — `main.ts` exposes every module export on `window` (via `Object.assign`); 10 functions called through `(window as any).fn()` were never assigned, crashing render (grid/map-return), photo arrows, edit/add, upload, and filters.
- **Sign-out / guest** — `signOut` now awaits `/api/auth/logout` before reload so the refresh cookie is actually cleared; an explicit "Continue as guest" no longer gets silently re-promoted to admin by the boot cookie-refresh.
- **E2E `openAsAdmin`** helper adapted to the in-memory token auth flow (was still injecting the removed `localStorage` token).
- Removed the misleading "reset zoom" (↺) button from the map.

## [0.1.0] - 2026-06-17

Initial public release on GitHub. Includes all features developed through 40 internal revisions.

### Added
- **REST API** — Spring Boot 3.3 / Java 17 with full CRUD for Monster Energy can collection
- **JWT authentication** — Stateless HMAC-SHA256 tokens, single-admin model with BCrypt
- **Firestore persistence** — Paginated reads, WriteBatch writes, soft-delete with restore
- **Cloudinary photo storage** — Upload (file and URL), delete, orphan cleanup on update
- **In-memory cache** — CopyOnWriteArrayList with TTL, thread-safe double-checked locking, ETag support
- **Rate limiting** — Bucket4j on login endpoint (10 attempts/min per IP, LRU-bounded)
- **Security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **PWA frontend** — Single-file vanilla JS app (~3900 lines), installable with offline support
- **Three gallery views** — Grid, dense list, photo wall (toggle with `g` key)
- **Interactive world map** — SVG planisphere with per-country can list, flavour picker (5 chips)
- **Value calculator** — Combinable filters (country, flavour, size, full, promo, photo, SKU, year) with grouped subtotals
- **Stats modal** — Collection breakdowns, Top 10 by value, timeline chart
- **Lightbox** — Full-screen photo viewer with pinch-zoom, keyboard navigation, priority key handling
- **Photo editor** — In-form rotate and crop via canvas, drag reorder slots
- **Sharing** — Public read-only links, shared filtered views, QR code generation
- **Saved views** — Save/apply/delete filter combinations (localStorage)
- **Service worker** — Network-first for HTML/JS, cache-first for images
- **Export/Import** — XLSX export and import with field mapping
- **Compare mode** — Side-by-side can comparison panel
- **Top/Tab colorization** — ~35 color keywords mapped to styled labels
- **Year filter from SKU** — Decodes manufacturing date from SKU convention
- **eBay monitor** — Companion Python tool watching 6 marketplaces (26 keyword searches, Telegram notifications, ~200 exclude words)
- **Observability** — Spring Boot Actuator + Micrometer/Prometheus, custom `monstervault_cans_active` gauge, Prometheus + Grafana docker-compose stack
- **Kubernetes** — Deployment, Service, ConfigMap, Secret manifests for minikube/cloud
- **Terraform IaC** — GCP Cloud Run + Artifact Registry configuration (dry-run ready)
- **CI/CD** — GitHub Actions: backend Maven tests + frontend Jest tests, weekly Firestore backup, UptimeRobot keep-warm
- **Docker** — Multi-stage build (Maven build + JRE runtime), deployed on Render free tier
- **Test suite** — 117 backend tests (61 unit/integration + 56 E2E Selenium) + 89 Jest frontend tests
- **Documentation** — README with architecture overview, HANDOFF.md with 40-revision history

### Post-release patches (2026-06-18 — 2026-06-19)

#### Added
- Terraform IaC for GCP Cloud Run with observability test coverage

#### Changed
- Detail panel: TOP/TAB background color now matches the written color keyword (e.g. PURPLE → violet, BLACK → black with white text)

#### Fixed
- Mobile iOS: keyboard covering input fields — fixed via visualViewport API
- Mobile iOS: precise scroll positioning when keyboard opens (field scrolled just above keyboard, not centered)
