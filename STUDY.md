# 🎓 Monster Vault — Handoff di Studio (interview prep)

> Documento **personale** per recuperare il contesto del progetto e individuare le lacune.
> Ogni punto: **Teoria** (cosa devi sapere) → **Dove nel progetto** → **Domande tipiche** a colloquio.
> Studia leggendo qui + aprendo il file reale citato. (Non committato: è materiale tuo.)

## Indice
0. Panoramica & stack
1. Architettura a layer & flusso di una richiesta
2. Principi SOLID
3. Design pattern usati
4. Backend — Spring Boot (security, JWT, persistenza, cache, errori…)
5. Frontend — PWA vanilla JS
6. Testing
7. DevOps / Cloud-native (Docker, CI/CD, observability, K8s, IaC)
8. Companion tool (eBay monitor)
9. Concetti trasversali
10. Lacune probabili + piano 5 giorni

---

## 0. Panoramica & stack

**Cos'è:** app full-stack per gestire una collezione di ~1.850 lattine Monster.
- **Backend:** Spring Boot 3.3 / Java 17 — REST API stateless con JWT (access + refresh token con rotazione).
- **Persistenza:** Firestore (NoSQL, Google Cloud). **Foto:** Cloudinary.
- **Frontend:** PWA modulare — 7 macro-moduli **TypeScript strict** bundlati con **Vite**, lint ESLint + Prettier. Servito dallo stesso origin (no CORS).
- **Struttura:** monorepo `backend/` + `frontend/` con Dockerfile 3-stage (Node build → Maven build → JRE).
- **Deploy:** Docker → Render. **CI:** GitHub Actions (lint + format + tsc + test + build). **Observability:** Actuator+Prometheus+Grafana. **IaC/Orchestrazione:** Terraform (Cloud Run) + manifest Kubernetes.
- **SEO/AEO:** robots.txt, sitemap.xml, llms.txt, JSON-LD, OG meta dinamici per le lattine condivise (ShareController).

**Frase da colloquio (elevator pitch):** *"Ho costruito da solo un'app full-stack per gestire 1.850 lattine: backend Spring Boot con JWT refresh token + rotazione, frontend TypeScript modulare con Vite, persistenza NoSQL su Firestore, test su 3 livelli, CI con lint/format/coverage gate, Docker 3-stage e observability. Monorepo su GitHub con SEO e PWA."*

---

## 1. Architettura a layer & flusso di una richiesta

**Teoria:** architettura **a strati** (layered): ogni layer ha UNA responsabilità e parla solo col layer sotto, tramite **interfacce**. Separa le preoccupazioni → testabile, manutenibile.

**Dove nel progetto** (flusso di `GET/POST /api/cans`):
```
HTTP → JwtFilter (valida token) → SecurityConfig (rotta pubblica o protetta?)
     → Controller (CanController/AuthController: riceve HTTP, valida input)
     → Service (CanService: business logic + cache)
     → Repository (CanRepository → FirestoreCanRepository: legge/scrive Firestore)
```
Layer (package): `controller` → `service` → `repository` + `model` (Can), `security`, `config`, `exception`.

**Domande tipiche:**
- Differenza tra Controller, Service, Repository? (HTTP / logica / dati)
- Perché ogni layer dipende da un'**interfaccia** e non dall'implementazione? (→ vedi SOLID-DIP)
- Dove metteresti la business logic? (Service, mai nel Controller)

---

## 2. Principi SOLID (sai dirli TUTTI con esempio?)

- **S — Single Responsibility:** una classe = un motivo per cambiare. *Es:* `CanService` (logica), `CloudinaryService` (foto), `JwtUtil` (token). Lo split `TokenGenerator`/`TokenValidator` separa generazione e validazione.
- **O — Open/Closed:** aperto all'estensione, chiuso alla modifica. *Es:* aggiungere una nuova sezione nelle Stats o una nuova `PhotoStorage` non richiede toccare il codice esistente.
- **L — Liskov:** un'implementazione deve poter sostituire l'interfaccia senza rompere nulla. *Es:* qualsiasi `CanRepository` (Firestore, o un mock nei test) funziona al posto dell'altro.
- **I — Interface Segregation:** interfacce piccole e mirate. *Es:* `PhotoStorage` espone solo upload/delete, non un'interfaccia monstre.
- **D — Dependency Inversion:** dipendi da **astrazioni**, non da classi concrete. *Es:* `CanService` dipende da `CanRepository` e `PhotoStorage` (interfacce), non da Firestore/Cloudinary → posso mockarle nei test.

**Dove:** `repository/CanRepository` (interfaccia) + `FirestoreCanRepository` (impl); `service/PhotoStorage` + `CloudinaryService`; `service/AuthService` + `AdminAuthService`.

**Domande tipiche:** *"Dimmi un esempio di Dependency Inversion nel tuo codice"* → CanService ↔ CanRepository. *"Come ti ha aiutato SOLID nei test?"* → mock delle interfacce.

---

## 3. Design pattern usati

- **Repository pattern:** astrae l'accesso ai dati (`CanRepository`). Il service non sa che sotto c'è Firestore.
- **Dependency Injection / IoC:** Spring crea e "inietta" i bean nei costruttori (constructor injection). Non fai `new`.
- **Strategy (di fatto):** `PhotoStorage`/`AuthService`/`CanRepository` sono strategie intercambiabili dietro un'interfaccia.
- **Filter / Chain of Responsibility:** `JwtFilter` nella filter chain di Spring Security.
- **Interceptor:** `LoginRateLimitInterceptor` (rate limiting prima del controller).
- **Facade:** `CanService` fa da facciata su repository + storage, orchestrando.
- **Singleton:** i bean Spring sono singleton di default.
- **(Frontend) Cache-aside / LQIP / Strategy del service worker.**

**Domande tipiche:** *"Che pattern hai usato e perché?"* — sai motivare ognuno, non solo nominarlo.

---

## 4. Backend — Spring Boot

### 4.1 Spring core (IoC/DI, stereotipi, auto-config)
**Teoria:** Spring è un **container IoC**: gestisce il ciclo di vita degli oggetti (bean) e li inietta dove servono. **Auto-configuration** + **starters** = convenzione su configurazione.
- Stereotipi: `@Component` (generico), `@Service` (logica), `@Repository` (dati), `@RestController` (web), `@Configuration` (definisce bean con `@Bean`).
- **Constructor injection** (preferita): dipendenze final, immutabili, testabili.
**Dove:** `MonsterVaultApplication` (`@SpringBootApplication` = `@Configuration`+`@EnableAutoConfiguration`+`@ComponentScan`); `CanService` (constructor injection di repo+storage).
**Domande:** *Cos'è un bean? Cos'è l'IoC? Differenza @Component/@Service? Constructor vs field injection (perché constructor)?*

### 4.2 REST API
**Teoria:** REST = risorse identificate da URL, verbi HTTP (GET legge, POST crea, PUT aggiorna, DELETE cancella), **stateless**, status code corretti (200, 201, 400, 401, 404, 429…). Validazione input.
**Dove:** `CanController` (CRUD `/api/cans`, upload foto), `AuthController` (`POST /api/auth/login`). `@Valid` + `@NotBlank` sul model. `model/Can`.
**Domande:** *Differenza PUT vs PATCH vs POST? Cos'è l'idempotenza (GET/PUT/DELETE idempotenti, POST no)? Quali status code usi e quando?*

### 4.3 Sicurezza: Spring Security + JWT (access + refresh token)
**Teoria:** **JWT** = token firmato (header.payload.signature). **Stateless**: il server non tiene sessioni. Login → emette **access token** (15 min) + **refresh token** (7 giorni).
**Architettura refresh token (refactoring):**
- **Access token** (breve, 15 min): inviato nel header `Authorization: Bearer`, vive **in memoria JS** (non localStorage → immune a XSS persistente).
- **Refresh token** (lungo, 7 giorni): inviato come **HttpOnly cookie** (`Secure`, `SameSite=Strict`, `Path=/api/auth`) → **immune a XSS** (JS non può leggerlo).
- **Rotazione**: ogni refresh invalida il vecchio token e ne genera uno nuovo (monouso). Store in-memory `ConcurrentHashMap<SHA-256(token), username>` (`RefreshTokenStore`).
- **Claim `type`**: nel JWT payload, `"type":"access"` o `"type":"refresh"` → il `JwtFilter` accetta solo access token.
- **Logout**: `POST /api/auth/logout` revoca tutti i refresh dell'utente e cancella il cookie.
- **Frontend**: al boot tenta `/api/auth/refresh` per recuperare la sessione dal cookie. Su 401 → refresh → retry automatico.
**Dove:**
- `SecurityConfig`: constructor injection, `SessionCreationPolicy.STATELESS`, rotte pubbliche + `/share/**`.
- `JwtFilter`: accetta SOLO `isAccessToken()`.
- `JwtUtil`: `generateAccess()`, `generateRefresh()`, claim `type`, due expiration configurabili.
- `AdminAuthService`: `authenticate()` → `AuthResponse(accessToken, refreshToken)`, `refresh()` con rotazione, `logout()`.
- `AuthController`: login setta cookie HttpOnly + body `{accessToken}`, refresh legge cookie e ruota, logout cancella cookie.
- `RefreshTokenStore`: `ConcurrentHashMap` con hash SHA-256.
**Domande:** *JWT vs sessione? Access vs refresh token? Perché HttpOnly cookie? Cos'è la rotazione? Cosa succede al restart del server?* (refresh token invalidati, l'utente ri-logga — accettabile su Render). *Perché il claim type?* (impedisce di usare un refresh come access).

### 4.4 Security headers / CSP
**Teoria:** header HTTP che mitigano attacchi: **CSP** (limita da dove caricare script/img → anti-XSS), **X-Frame-Options: DENY** (anti-clickjacking), **X-Content-Type-Options: nosniff**, Referrer-Policy, Permissions-Policy.
**Dove:** `SecurityConfig` (CSP con whitelist Cloudinary/flagcdn, frameOptions deny, ecc.). Test: `SecurityHeadersTest`.
**Domande:** *Cos'è XSS e come lo previeni? Cos'è una CSP? Clickjacking?*

### 4.5 Rate limiting
**Teoria:** limitare le richieste per prevenire brute-force/abuso. **Token bucket** (Bucket4j): un "secchio" di gettoni che si ricarica nel tempo.
**Dove:** `LoginRateLimitInterceptor` (Bucket4j) — 10 tentativi login/min per IP, registrato in `WebConfig`.
**Domande:** *Come previeni il brute-force sul login? Cos'è l'algoritmo token bucket?*

### 4.6 Persistenza: Firestore (NoSQL) + Repository
**Teoria:** **NoSQL documentale** (Firestore): documenti JSON in collezioni, schema flessibile, scala orizzontale, ma niente JOIN/transazioni complesse come SQL. **Repository pattern** isola questa scelta.
**Dove:** `CanRepository` (interfaccia) + `FirestoreCanRepository` (impl, paginazione 500 doc/pagina), `FirebaseConfig` (init con credenziali da env). Model `Can`.
**Domande:** *SQL vs NoSQL, quando usi cosa? Perché Firestore qui? Come gestisci la mancanza di JOIN?* (denormalizzazione / logica nel service).

### 4.7 Caching in CanService (⭐ punto forte, studialo bene)
**Teoria:** cache in-memoria per evitare letture ripetute a Firestore (quota free tier). Concetti: **thread-safety**, **volatile** (visibilità tra thread), **double-checked locking** (DCL) per non sincronizzare ad ogni lettura, **TTL** (scadenza), **CopyOnWriteArrayList** (lista thread-safe per lettura), **cache invalidation** (la cosa "difficile" in informatica).
**Dove:** `CanService` — `private volatile List<Can> cache`, `getAll()` con DCL + TTL, update incrementali su save/delete, `cachedActiveCount()` (conteggio cache-only per la metrica).
**Domande:** *Come hai reso la cache thread-safe? Cos'è `volatile`? Perché double-checked locking? Come invalidi la cache? Cosa succede se due thread leggono mentre uno scrive?* (snapshot locale + CopyOnWriteArrayList).

### 4.8 Cloudinary / PhotoStorage
**Teoria:** storage esterno per file (immagini) + CDN + trasformazioni on-the-fly (resize `c_fit`, `f_auto`, `q_auto`).
**Dove:** `PhotoStorage` (interfaccia) + `CloudinaryService`. Invariante: **Firestore prima, Cloudinary dopo** (evita orfani su race condition). Cleanup foto orfane su update/delete.
**Domande:** *Perché non salvi le immagini nel DB? Come gestisci la coerenza tra DB e storage?*

### 4.9 Soft delete
**Teoria:** non cancellare fisicamente subito: marcare `deletedAt` → recuperabile (undo). Cancellazione fisica dopo.
**Dove:** `CanService.softDelete/restore/permanentDelete`; `getAll()` filtra i `deletedAt != null`.
**Domande:** *Soft vs hard delete, pro/contro?*

### 4.10 ETag / caching HTTP
**Teoria:** **ETag** = "impronta" della risorsa; il client rimanda `If-None-Match` → se invariata, **304 Not Modified** (niente ri-trasferimento). Risparmia banda.
**Dove:** `CanService.computeEtag` (hash XOR di id+updatedAt). Test in `SecurityHeadersTest`.
**Domande:** *Come funziona la cache HTTP? ETag vs Last-Modified? Cos'è un 304?*

### 4.11 Gestione errori
**Teoria:** gestione centralizzata delle eccezioni → risposte HTTP coerenti.
**Dove:** `GlobalExceptionHandler` (`@RestControllerAdvice`), eccezione custom `FirestoreQuotaExceededException` → 429.
**Domande:** *Come gestisci gli errori in un'API REST? Cos'è @ControllerAdvice?*

### 4.12 OpenAPI / Swagger
**Teoria:** documentazione interattiva auto-generata dell'API.
**Dove:** `OpenApiConfig` (SpringDoc), Swagger UI su `/swagger-ui.html`.

---

## 5. Frontend — PWA TypeScript modulare (Vite)

**Teoria & dove:**
- **Monolite → moduli TypeScript:** il vecchio `index.html` da ~4000 righe è stato estratto in **7 macro-moduli** TypeScript strict (`core.ts`, `ui.ts`, `tools.ts`, `photos.ts`, `share.ts`, `pwa.ts`, `types.ts`) bundlati con **Vite** (102KB JS + 50KB CSS).
- **TypeScript strict:** type safety con `strict: true`. Le interfacce (`Can`, `ActiveChips`, `FilterState`) in `types.ts`. Stato globale esportato come oggetto mutabile da `core.ts`.
- **Tooling:** ESLint (typescript-eslint strict) + Prettier. CI gate: lint + format:check + tsc --noEmit + vite build.
- **Stato condiviso tra moduli:** `state` object in `core.ts`, importato ovunque. Bridge cross-modulo: `(window as any).functionName()` per chiamate circolari, eliminabili gradualmente.
- **window exposure:** `main.ts` importa tutti i moduli e espone ~80 funzioni su `window` per gli handler `onclick` nell'HTML. Gradualmente sostituibili con `addEventListener`.
- **PWA:** `manifest.json` + **service worker** (`sw.js`). Strategie: **network-first** (HTML/JS), **cache-first** (immagini).
- **Auth lato client (refactoring):** access token **in memoria JS** (non più localStorage), refresh token come **HttpOnly cookie**. Al boot: tenta `/api/auth/refresh` dal cookie. Su 401: refresh silenzioso → retry → solo se fallisce mostra login.
- **Viste:** grid/list/wall; mappa mondiale SVG; calcolatore valore.
- **Sicurezza XSS:** helper `esc()` e `jsq()`.
- **Sviluppo locale:** `cd frontend && npm run dev` (Vite port 5173, proxy `/api` → backend 8080).
**Domande:** *Perché modulare un monolite JS? Come gestisci lo stato condiviso senza un framework? Cos'è Vite e perché lo hai scelto? Come esponi le funzioni per onclick? TypeScript strict: vantaggi e tradeoff?*

---

## 6. Testing (⭐ sanno tutti chiedere della piramide)

**Teoria:** **piramide dei test** — tanti **unit** (veloci, isolati), meno **integration**, pochi **E2E** (lenti, realistici).
**Dove:**
- **Unit/integration backend (JUnit + Mockito):** es. `CanServiceTest`, `AdminAuthServiceTest` (refresh con rotazione, logout), `RefreshTokenStoreTest` (store/revoke/revokeAll), `JwtUtilTest` (dual token types), `AuthControllerTest` (cookie assertions). `@WebMvcTest` vs `@SpringBootTest`.
- **E2E (Selenium WebDriver):** browser headless, flussi reali (admin/guest/responsive).
- **Frontend (Jest + jsdom):** carica l'`index.html` in jsdom ed esegue il codice di produzione.
- Totali: **82 unit/integration (backend) + 58 E2E + 89 Jest** = 229.
**Domande:** *Differenza unit vs integration vs E2E? Cos'è un mock/stub? Cos'è il test-double `InOrder`? Perché la piramide (e non tanti E2E)? Cos'è TDD?*

---

## 7. DevOps / Cloud-native

### Docker
**Teoria:** container = app + dipendenze in una "scatola" riproducibile. **Multi-stage build** = immagine piccola.
**Dove:** `Dockerfile` con **3 stage** (refactoring):
1. **Stage Node** (`node:22-alpine`): `npm ci && npm run build` → produce `dist/` con JS+CSS bundlati da Vite.
2. **Stage Maven** (`maven:3.9-eclipse-temurin-17-alpine`): copia `dist/` dentro `src/main/resources/static/` → `mvn package`.
3. **Stage JRE** (`eclipse-temurin:17-jre-alpine`): solo il JAR → immagine finale leggera.
**Domande:** *Container vs VM? Perché 3-stage? Come integri il build frontend nel Docker backend?*

### CI/CD
**Teoria:** **CI** = ad ogni push, build + test automatici. **CD** = rilascio automatico.
**Dove:** GitHub Actions (`.github/workflows/ci.yml`):
- **Backend job:** build frontend (npm ci + vite build), copia in static, `mvn test`.
- **Frontend job:** `npm run lint` (ESLint) + `npm run format:check` (Prettier) + `npm run build` (tsc --noEmit + vite build).
**Domande:** *Cos'è una pipeline CI/CD? Cosa fai girare in CI? Perché lint e format check in CI?*

### Observability (Actuator + Micrometer + Prometheus + Grafana)
**Teoria:** vedere lo stato interno in produzione. 3 pilastri: **metriche**, **log**, **tracing**. **Counter** (solo sale) vs **Gauge** (sale/scende). Prometheus *scrape* le metriche, Grafana le grafica.
**Dove:** `application.yml` (espone `/actuator/prometheus`), `MetricsConfig` (gauge custom `monstervault_cans_active` legato a `cachedActiveCount()`), `observability/` (docker-compose Prometheus+Grafana).
**Domande:** *Cos'è l'observability? Differenza counter/gauge? Cos'è uno scrape? Cosa monitoreresti di un'API?* (latenza p95, error rate, throughput, memoria).

### Kubernetes
**Teoria:** orchestratore di container: mantiene lo **stato desiderato**, auto-healing, scaling, service discovery. **Pod** (unità), **Deployment** (N copie + rollout), **Service** (rete stabile), **ConfigMap/Secret** (config fuori dall'immagine), **probe** liveness/readiness.
**Dove:** `k8s/` (Deployment con probe su `/actuator/health`, Service, ConfigMap, Secret). **Domande:** *Pod vs Deployment vs Service? Liveness vs readiness probe? Come fa K8s l'auto-healing? Cloud Run vs Kubernetes?*

### IaC (Terraform) + Cloud
**Teoria:** **Infrastructure as Code** = infrastruttura descritta in file (ripetibile, versionata). Terraform: `init` → `plan` → `apply`, con uno **state**. **Cloud Run** = container serverless (scala a zero).
**Dove:** `infra/` (Terraform per GCP Cloud Run + Artifact Registry). **Domande:** *Cos'è l'IaC e perché? Cos'è lo state di Terraform? Cloud Run vs K8s vs Render?*

### SEO / AEO (refactoring)
**Teoria:** **SEO** = ottimizzazione per motori di ricerca. **AEO** = Answer Engine Optimization (per LLM/agenti AI). Limitato: app quasi tutta dietro JWT → solo landing, mappa, link condivisi sono indicizzabili.
**Dove:**
- `robots.txt`: permette `/`, blocca `/api/` e `/actuator/`.
- `sitemap.xml`: URL statici (root, map.html).
- `llms.txt`: descrizione strutturata per LLM/agenti AI.
- **JSON-LD** `<script type="application/ld+json">` nell'HTML: schema WebApplication.
- **Meta tags:** `<meta name="description">`, canonical, OG, Twitter cards, preconnect.
- **`ShareController`** (`GET /share/{id}`): serve HTML con **OG meta dinamici** per ogni lattina (titolo=nome, immagine=foto p1), poi redirect alla SPA. Le preview social/chat mostrano nome+foto.
**Domande:** *Cos'è SEO per una SPA? Come gestisci OG meta dinamici senza SSR? Cos'è robots.txt/sitemap? Cosa indicizzi di un'app dietro auth?*

### Hosting / cold start
**Dove:** Render free (dorme dopo 15 min → "cold start"; tenuto caldo con UptimeRobot). **Domande:** *Cos'è un cold start? Come lo mitighi?*

---

## 8. Companion tool (eBay monitor) — Python

**Teoria & dove:** tool Python separato (`ebay-monitor/`): monitora le aste eBay via **Browse API** (OAuth2 client-credentials), filtra per **keyword** (ricerche salvate + esclusioni), notifica su **Telegram** (bot). SQLite per dedup.
**Storia da raccontare (ottima):** *volevo riconoscere le lattine dalle FOTO → ho provato **CLIP/DINOv2/OCR**, li ho **testati**, non distinguevano in modo affidabile le lattine → scelta pragmatica: ricerca keyword + filtri.* → dimostra sperimentazione, misurazione, giudizio.
**Domande:** *Cos'è OAuth2 client-credentials? Come integri un'API esterna? Perché hai scartato l'approccio AI sulle immagini?*

---

## 9. Concetti trasversali (ripasso veloce)

- **REST:** stateless, risorse, verbi, idempotenza.
- **HTTP:** status code, header, cache (ETag/304), HTTPS.
- **Auth:** JWT vs sessioni, OAuth2, BCrypt (salt + slow hash).
- **SQL vs NoSQL:** schema/relazioni vs flessibilità/scala.
- **Concorrenza:** thread-safety, `volatile`, lock, immutabilità (la cache di CanService è il tuo esempio).
- **OWASP base:** XSS, CSRF, injection, broken auth.
- **Big-O:** sapere il costo di liste/mappe/loop (per il coding).

---

## 10. Le tue probabili LACUNE + piano 5 giorni

**Lacune più probabili (aggiornate post-refactoring):**
1. **Concorrenza/thread-safety** spiegata a parole (la cache + RefreshTokenStore sono i tuoi assi).
2. **TypeScript strict:** sapere spiegare `strict: true`, generics, type narrowing, `as unknown as` pattern.
3. **Vite/bundler:** come funziona il dev server (ESM nativo), la build (Rollup), tree-shaking, code splitting.
4. **Refresh token security:** rotazione, XSS vs CSRF tradeoff, HttpOnly cookie, claim type, in-memory store vs DB.
5. **Algoritmi/Big-O** se il colloquio ha coding (LeetCode easy/medium).
6. **Observability/K8s/IaC** come *teoria* (ripassa counter/gauge, probe, IaC).

**Piano 5 giorni:**
- **G1 — Backend core:** rileggi `CanService` (cache, thread-safety) + flusso refresh token end-to-end (JwtUtil → AdminAuthService → AuthController → RefreshTokenStore → cookie → frontend retry).
- **G2 — REST/HTTP/Security:** verbi, status, idempotenza, access vs refresh token, HttpOnly cookie, rotazione, XSS/CSP, BCrypt. 5 LeetCode easy.
- **G3 — Testing + SOLID + TS:** piramide, mock, `@WebMvcTest` vs `@SpringBootTest`; ripeti i 5 SOLID; spiega il refactoring monolite→moduli TS (motivazione, come hai gestito le dipendenze circolari, il bridge `window as any`). 3 LeetCode medium.
- **G4 — DevOps + frontend tooling:** Docker 3-stage, CI con lint/format gate, Vite (ESM, proxy, build), observability, K8s, IaC. Avvia `cd frontend && npm run dev` e mostra l'hot reload.
- **G5 — Demo + mock interview:** prova la **demo 5 min** (mappa → calcolatore → GitHub → mostra la struttura modulare + refresh token) e racconta 4 storie STAR: il Vault end-to-end, l'esperimento CLIP fallito, il refactoring monolite→moduli TS, il refresh token con rotazione.

> 💡 Test del "lo so spiegare?": per ogni sezione, leggi solo le **Domande tipiche** e rispondi a voce. Se inciampi → è una lacuna → torna sul file reale citato.
