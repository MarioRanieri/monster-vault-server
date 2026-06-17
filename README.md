# Monster Vault Server

Spring Boot 3.3 backend for the **Monster Vault** energy drink can collection app.
Provides a stateless REST API with JWT authentication, Firestore persistence, and Cloudinary photo storage.
The frontend (`index.html`) is served as a static resource from the same server — no CORS needed.

**Live:** https://monster-vault-server.onrender.com  
**Repo:** https://github.com/MarioRanieri/monster-vault-server

---

## Architecture

```
HTTP Request
     │
     ▼
JwtFilter          ← reads Authorization: Bearer <token>, validates it,
     │               sets authentication in Spring SecurityContext
     ▼
SecurityConfig     ← decides if the route is public or requires authentication
     │
     ▼
Controller         ← receives the HTTP request, delegates to services
  ├── AuthController   → POST /api/auth/login
  └── CanController    → CRUD /api/cans, photo upload

     │
     ▼
Service            ← business logic
  ├── AdminAuthService  → verifies credentials, generates JWT
  ├── CanService        → in-memory cache + delegates to repository
  └── CloudinaryService → uploads photos to Cloudinary

     │
     ▼
Repository         ← data persistence
  └── FirestoreCanRepository → reads/writes to Firestore (Google Firebase)
```

Every layer depends on **interfaces**, not on concrete classes (SOLID Dependency Inversion Principle).
This makes each component independently testable with mocks.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.3.0 (Java 17) |
| Security | Spring Security + JWT (jjwt 0.12.3) |
| Password hashing | BCrypt |
| Database | Google Firestore (Firebase Admin SDK 9.3.0, paginated 500 docs/page) |
| Photo storage | Cloudinary |
| Validation | Jakarta Validation (`@NotBlank`) |
| Boilerplate reduction | Lombok 1.18.34 (`@Data`, `@Slf4j`) — compatible with JDK 21+ |
| Rate limiting | Bucket4j 8.10.1 — 10 login attempts/min per IP (LRU-bounded IP map) |
| API docs | SpringDoc OpenAPI 2.6.0 — Swagger UI at `/swagger-ui.html` |
| Containerization | Docker (multi-stage build) |
| Hosting | Render free tier |
| Frontend | PWA (manifest + service worker), installable as app |

---

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Returns a JWT token on valid credentials |
| POST | `/api/auth/refresh` | JWT | Silent refresh — returns a fresh JWT for a still-valid token |

**Request body:**
```json
{ "username": "admin", "password": "yourpassword" }
```
**Response 200:**
```json
{ "token": "<JWT>" }
```
**Response 401:** Invalid credentials.

---

### Can Collection

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cans` | Public | Returns all cans |
| GET | `/api/cans/{id}` | Public | Returns a single can, 404 if not found |
| POST | `/api/cans` | JWT | Creates a new can |
| PUT | `/api/cans/{id}` | JWT | Updates an existing can (orphan photos cleaned from Cloudinary) |
| DELETE | `/api/cans/{id}` | JWT | Soft-deletes a can (sets `deletedAt`; hidden from `GET`, photos kept) |
| DELETE | `/api/cans/{id}/permanent` | JWT | Permanent delete — removes from Firestore + Cloudinary |
| PUT | `/api/cans/{id}/restore` | JWT | Restores a soft-deleted can |
| POST | `/api/cans/batch` | JWT | Atomically saves multiple cans (Excel import) |
| DELETE | `/api/cans` | JWT + header | Deletes the entire collection |

For `DELETE /api/cans` a confirmation header is required to prevent accidental deletion:
```
X-Confirm-Delete: all
```

---

### Photo Upload

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/cans/{id}/photo/{slot}` | JWT | Upload a photo file (multipart) |
| POST | `/api/cans/{id}/photo/{slot}/from-url` | JWT | Upload a photo from an external URL |

- `slot` is 1–4 (each can has up to 4 photos: p1, p2, p3, p4)
- Photos are stored on Cloudinary; the returned HTTPS URL is saved in Firestore

**File upload** — `multipart/form-data`, field name: `file`  
**URL upload** — JSON body: `{ "url": "https://example.com/image.jpg" }`  
**Response:** `{ "url": "https://res.cloudinary.com/..." }`

---

## Authentication Flow

```
1. Client → POST /api/auth/login { username, password }
2. Server → BCrypt verifies password against stored hash
3. Server → generates signed JWT (HMAC-SHA256, 24h expiry)
4. Client ← { "token": "eyJ..." }

5. Client → GET /api/cans  Authorization: Bearer eyJ...
6. JwtFilter → verifies JWT signature and expiry
7. JwtFilter → sets authentication in SecurityContext
8. SecurityConfig → allows the request
9. Client ← [ { id: "...", nome: "...", ... }, ... ]
```

The server is **stateless**: no sessions, no cookies. Every request carries its own JWT.

---

## In-Memory Cache

`CanService` maintains a thread-safe in-memory cache of the entire collection to avoid hitting the Firestore daily read quota (50,000 reads/day free tier with ~1,800 documents).

```
cache = null        → cold cache: next getAll() reads from Firestore
cache = []          → known empty collection: no Firestore read needed
cache = [Can, ...]  → warm cache: all reads served from memory
```

**Thread safety:**
- `volatile` keyword: ensures every thread sees the latest written value
- `CopyOnWriteArrayList`: allows concurrent reads without blocking
- `synchronized` + double-checked locking in `getAll()`: prevents two threads from loading Firestore simultaneously on the first request

**ACID Consistency:** if any Firestore write fails, the cache is set to `null` so the next read reloads from the database — cache and Firestore can never diverge.

---

## Project Structure

```
src/main/java/com/monstervault/
├── MonsterVaultApplication.java          # Entry point
├── model/
│   └── Can.java                          # Data model; photoAt: Long; p1Id-p4Id: Cloudinary public_id
├── config/
│   ├── FirebaseConfig.java               # Firebase Admin SDK init + Firestore bean
│   ├── SecurityConfig.java               # Spring Security: routes, JWT filter, BCrypt
│   ├── WebConfig.java                    # Registers LoginRateLimitInterceptor on /api/auth/login
│   └── OpenApiConfig.java                # SpringDoc OpenAPI: JWT Bearer "Authorize" button
├── security/
│   ├── TokenValidator.java               # Interface: isValid, getUsername
│   ├── TokenGenerator.java               # Interface: generate
│   ├── JwtUtil.java                      # Implements both interfaces (HMAC-SHA256)
│   ├── JwtFilter.java                    # HTTP filter: reads Bearer token per request
│   └── LoginRateLimitInterceptor.java    # Bucket4j: 10 req/min per IP on login
├── repository/
│   ├── CanRepository.java                # Interface: CRUD contract
│   └── FirestoreCanRepository.java       # Firestore implementation (paginated, WriteBatch)
├── service/
│   ├── AuthService.java                  # Interface: authenticate → Optional<String>
│   ├── AdminAuthService.java             # Implementation: BCrypt + TokenGenerator
│   ├── CanService.java                   # Cache + photo orchestration (update/delete/upload with Cloudinary cleanup)
│   ├── PhotoStorage.java                 # Interface: upload, uploadFromUrl, delete(urlOrId), deleteFolder()
│   └── CloudinaryService.java            # Cloudinary: upload, delete (URL or publicId), deleteFolder (prefix API)
├── controller/
│   ├── AuthController.java               # POST /api/auth/login
│   ├── CanController.java                # CRUD + photo endpoints
│   └── GlobalExceptionHandler.java       # @RestControllerAdvice: 400/429/500 error handling
└── exception/
    └── FirestoreQuotaExceededException.java  # Custom exception for Firestore 429
```

---

## Running Locally

### Prerequisites
- **JDK 17** (recommended — matches the Docker/Render target). JDK 21+ also works with Lombok 1.18.34.
- Maven 3.9.x
- A `src/main/resources/application.properties` file (not committed — see below)
- A `src/main/resources/firebase-service-account.json` file (not committed)

### application.properties

```properties
server.port=8080
firestore.collection=cans
app.admin.username=YourAdminUsername
app.admin.password=$2a$10$<bcrypt_hash_of_your_password>
app.jwt.secret=<random_string_at_least_32_chars>
app.jwt.expiration=86400000
cloudinary.cloud-name=<your_cloud_name>
cloudinary.api-key=<your_api_key>
cloudinary.api-secret=<your_api_secret>
firebase.service-account=src/main/resources/firebase-service-account.json
```

### Run Tests

```bash
# Maven wrapper (Windows, PowerShell) — JDK 17 recommended (matches Docker/Render)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
.\mvnw.cmd test

# Linux / macOS (or JDK 21+, Lombok 1.18.34 is compatible)
mvn test
```

> The Windows wrapper `mvnw.cmd` requires CRLF line endings and the
> `-Dmaven.multiModuleProjectDirectory` flag to run; both are enforced
> (`.gitattributes` pins `*.cmd` to CRLF). Avoid JDK 25 locally — it fails
> Lombok annotation processing (`TypeTag::UNKNOWN`); use JDK 17.

### Start the Server

```bash
JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.14.7-hotspot" \
  mvn spring-boot:run
```

---

## Test Suite

### Backend — 59 unit/integration + 58 E2E, 0 failures

| File | Tests | What it covers |
|---|---|---|
| `CanServiceTest` | 19 | Cache warm/cold, save/update/softDelete/restore/permanentDelete with Cloudinary cleanup, InOrder save-before-delete, publicId preference, deleteFolder, Cloudinary failure resilience |
| `AdminAuthServiceTest` | 7 | Correct/wrong credentials, BCrypt short-circuit, JWT refresh (valid/invalid/null) |
| `JwtUtilTest` | 4 | Token generation, validation, username extraction, invalid token |
| `AuthControllerTest` | 3 | Login success / wrong password / wrong username |
| `CanControllerTest` | 16 | Full CRUD with/without JWT, soft-delete/restore/permanent, @Valid enforcement, deleteAll header |
| `SecurityHeadersTest` | 10 | ETag deterministic/mutable/304, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

Controller tests use `@WebMvcTest` with `@Import({SecurityConfig.class, JwtUtil.class})` — required to load the JWT filter in the test context, otherwise all requests return 401/403.

**E2E (Selenium, headless Chrome)** — `AdminFlowE2ETest` (25), `GuestFlowE2ETest` (14), `ResponsiveE2ETest` (19) = 58 tests. Base class mocks Firebase/Firestore/repository/storage and injects the JWT via `localStorage`. 2 responsive tests are `assumeTrue`-skipped on Windows (headless Chrome clamps the viewport to ~480px) and pass on the Linux CI runner. Full run: `Tests run: 117, Failures: 0, Errors: 0, Skipped: 2`.

### Frontend — 86 tests, 0 failures

Located in `frontend-tests/` (Jest + jsdom). Each test loads the real `index.html` in jsdom and exercises production code directly. Run with:

```bash
cd frontend-tests && npm test
```

| Suite | Tests | What it covers |
|---|---|---|
| `esc()` | 3 | XSS escaping: `< > & "`, null/undefined, plain text |
| `simpleHash()` | 3 | Non-empty output, determinism, different inputs → different hashes |
| `apiCall()` | 2 | `Authorization: Bearer` header, `extraHeaders` merging |
| `batchDeleteAllFS()` | 2 | Sends `X-Confirm-Delete: all` header, not sent on other DELETE calls |
| `shareCanLink()` | 6 | `can.lingua` used (not the removed `can.paese`), FULL detection from `can.note`, no-op when share name not set |
| `clearAll()` | 3 | localStorage cache emptied, in-memory `cans` cleared, confirm cancellation |
| `renderComparePanel()` | 4 | Est. Value hidden in guest mode, visible in admin mode |
| `statsFreq()` | 3 | Frequency map sorted desc, ignores empty values, respects limit (pure fn) |
| `buildStatsData()` | 3 | total/withPhoto/promo/fullCans/pct aggregation, empty-safe pct, case-insensitive FULL (pure fn) |
| `buildTimelineData()` | 2 | 12 monthly buckets, counts current month, excludes out-of-window (pure fn) |
| `renderTimeline()` | 2 | Empty string when no can has `updatedAt`; SVG + Months/Years toggle when data present |
| `buildYearlyData()` | 3 | Groups cans by year (all-time): count `n` + summed value `v`, ignores missing/non-numeric (pure fn) |
| `setTimelineMode()` | 1 | Switches the timeline months↔years; chart reflects the active mode |
| `setTimelineMetric()` | 1 | Switches the timeline Count↔€ Value; chart shows the amount |
| `jsq()` | 5 | XSS escaping for ids/values inside inline handlers: quote/backslash/HTML neutralised, hostile id rendered inert in `cardHTML` |
| `watch flag (eBay monitor)` | 4 | `watch` toggle on a can: eye button, `.watching` class, persisted on the can object |
| `colorizeTop()` | 5 | Top/Tab colour map: word after the slash rendered in its own colour (orange→arancione), escaped output |
| `captureFilterState() / applyFilterState()` | 3 | Saved-view filter round-trip: captures and re-applies search/select/year |
| `extractYearFromCan() / year filter from SKU` | 3 | Year decoded from SKU (`0610`→2010, `093`→2003); month >12 or bad format → excluded when filter active |
| `buildTopValue()` | 2 | Top 10 by value: descending sort, ignores non-numeric values (pure fn) |
| `renderWall()` | 2 | Wall view: only cans with photos, ids via jsq; `setView('wall')` activates the view |
| `cloudinaryThumb()` | 3 | CDN `c_fit` transform (whole can, no crop) + dimensions; non-Cloudinary/null URLs left unchanged |
| `lightbox: viewer foto` | 4 | `setLbPhoto` resets opacity (anti dark-photo) + 1600 CDN, 128 thumbs, arrows don't navigate the can underneath |
| `regressioni layout foto (CSS/markup)` | 5 | Guards: lightbox `#000`, `onload` opacity reset, mobile `100dvh` max-height, details `contain`, LQIP `background-image:none` |
| `calcolatore valore (filtri + somma)` | 11 | `calcMatch` per ogni criterio (gusto, paese multi-nation, full, promo, photo, SKU contains/starts/exact, year, AND), `calcTotals`, `calcGroups` (subtotals sorted desc), opzioni "solo possibili" (`calcDistinct` sul sottoinsieme filtrato) |
| `demo / fallback offline` | 1 | `showDemo` mostra le mock senza salvare (no cache, no POST) — regressione "2 lattine prova" su cold start |

### API — Newman collection

Located in `src/test/api/monster-vault.collection.json`. Run with:

```bash
newman run src/test/api/monster-vault.collection.json -e src/test/api/local.environment.json
```

Covers: Auth (login OK/wrong-password/wrong-username), public GET, JWT-protected CRUD, batch save, `DELETE /api/cans` header enforcement, and self-cleaning test data.

---

## Deployment (Render)

The app is containerized with a multi-stage Dockerfile and deployed on Render free tier.

**Environment variables on Render:**

| Variable | Description |
|---|---|
| `FIREBASE_CREDENTIALS_JSON` | Base64-encoded Firebase service account JSON |
| `FIRESTORE_COLLECTION` | Firestore collection name (e.g. `cans`) |
| `APP_ADMIN_USERNAME` | Admin username |
| `APP_ADMIN_PASSWORD` | BCrypt hash of admin password |
| `APP_JWT_SECRET` | JWT signing secret (min. 32 chars) |
| `APP_JWT_EXPIRATION` | Token expiry in ms (e.g. `86400000` = 24h) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

**Cold start:** Render free tier spins down containers after 15 minutes of inactivity. First request after idle takes 30–50 seconds. Mitigated two ways — a scheduled **keep-warm** GitHub Action (`.github/workflows/keep-warm.yml`) pings `GET /api/cans` every 10 min during the day (UTC) so the container rarely sleeps (a free alternative to upgrading Render); and the frontend retries on cold start in two places:
- **Login:** retries `/api/auth/login` up to 3× (3s apart) on 5xx; shows "Server warming up…" message in the auth card after 5s
- **Data load:** retries `GET /api/cans` up to 3× (2s apart) on 5xx; updates the loading message to "Server warming up… Free tier cold start · usually 30–50s" on the first retry

---

## Key Design Decisions

**Stateless JWT over sessions** — no server-side state, horizontally scalable, works naturally with Render's ephemeral containers.

**Interface-based architecture (SOLID DIP)** — `CanService` depends on `CanRepository`, not on `FirestoreCanRepository`. Switching persistence layer means writing one new class, not modifying existing ones.

**In-memory cache instead of CDN/Redis** — free and sufficient for a single-user app. The cache is invalidated on any write failure to maintain consistency with Firestore.

**`deleteAll` requires a confirmation header** — prevents accidental erasure of 1,800+ documents from a misfire or curl typo.

**BCrypt short-circuit** — username is checked first (cheap string comparison), password BCrypt only runs if the username matches. Prevents wasting CPU on brute-force attempts with wrong usernames.

**Rate limiting on login** — `LoginRateLimitInterceptor` (Bucket4j) allows 10 login attempts per minute per IP. Uses `X-Forwarded-For` header to get the real client IP behind Render's proxy. The IP→bucket map is an **LRU-bounded** `LinkedHashMap` (cap 10,000 IPs) so a client rotating its source IP / `X-Forwarded-For` cannot grow the map without bound (memory-exhaustion DoS). Buckets reset on container restart (acceptable on free tier where containers sleep frequently).

**Frontend XSS escaping** — all dynamic text is rendered through `esc()` (HTML-entity encoding); any id/value interpolated into an inline `onclick="…('<value>')"` handler goes through `jsq()`, which neutralises the JS-string breakout (quote/backslash) and the attribute's HTML special chars. Because collections can be shared read-only to untrusted viewers and the CSP allows `'unsafe-inline'`, an un-escaped id (e.g. from an Excel import) would otherwise be a stored-XSS vector. Covered by Jest tests (`jsq()` + a hostile-id case rendered inert in `cardHTML`).

**Deterministic JWT signing key** — `JwtUtil` derives the HMAC key with `secret.getBytes(StandardCharsets.UTF_8)` rather than the platform default charset, so a token signed on Windows (Cp1252) verifies on Linux/Render (UTF-8) even if the secret contains non-ASCII characters.

**`<form>`-based login for mobile autofill** — the login form uses a proper HTML `<form autocomplete="on">` with `<button type="submit">`, which is required for iOS Safari Face ID and Android password managers to autofill and submit correctly. Without a `<form>` element browsers cannot map the autofill gesture to the submit action.

**`photoAt` timestamp** — each Can has a `photoAt: Long` field set to the current epoch milliseconds whenever any photo slot (p1–p4) is saved. The "Recently Photographed" sort uses this to surface recently-photographed cans first; cans with no photos (photoAt = null) sort to the bottom.

**Cloudinary cleanup order (safety invariant)** — Firestore is always written/deleted *before* touching Cloudinary. If the DB operation fails, photos are never deleted and the state remains consistent. If the Cloudinary operation fails, at worst photos are orphaned on Cloudinary (recoverable), but the DB is always correct. `deleteAll()` uses `deleteResourcesByPrefix` (one Admin API call per 1000 resources) instead of N individual `destroy()` calls.

**Cloudinary `publicId` stored alongside URL** — each Can stores `p1Id`–`p4Id` (the Cloudinary public_id, e.g. `monster-vault/abc_1_xyz`) set at upload time. Deletions use the stored ID directly — no URL parsing. Old cans without `pNId` fall back to URL parsing for backward compatibility.
