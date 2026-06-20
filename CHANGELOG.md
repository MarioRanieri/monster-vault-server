# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Refresh token (access + refresh with rotation and revocation)
- Project restructure into `backend/` + `frontend/`
- SEO / AEO assets (robots.txt, sitemap.xml, llms.txt, JSON-LD)
- Frontend modularization (TypeScript + Vite + ESLint + Prettier)
- Backend code quality pass

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
