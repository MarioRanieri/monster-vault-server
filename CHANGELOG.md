# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
