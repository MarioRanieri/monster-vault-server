# Handoff: Monster Vault — Backend Spring Boot

> **Lingua:** Rispondere sempre in italiano.

**Updated:** 2026-07-10 (rev 48 — audit guest COMPLETO: +refactor filtri, render incrementale)  
**Branch:** main (lavoro su `feat/react-migration`, mergiato a `main`)  
**Repo:** https://github.com/MarioRanieri/monster-vault-server  
**Live URL:** https://monster-vault-server.onrender.com

> **2026-07-10 — Audit esperienza guest (prime 5 voci).** Analisi del sito live in modalità
> guest + `docs/AUDIT.md` (shortlist prioritizzata di 11 voci). Implementate le 5 a più alto
> impatto: **(#1)** i webfont non caricavano in produzione — la CSP (`font-src 'self'`) bloccava
> l'`@import` di Google Fonts, quindi Bebas Neue/DM Sans/Space Mono cadevano sui font di sistema;
> ora **self-hostati** (woff2 latin in `frontend/public/fonts`, `@font-face`), same-origin → CSP
> invariata, PWA offline-ready, e DM Sans variabile ripristina anche il peso 700. **(#2)** il sort
> di default apriva su un muro di placeholder perché ordinava per `photoAt` (0 su molti scatti
> vecchi); ora la presenza di foto (`p1`) è la chiave primaria → le lattine fotografate vengono
> prima, senza nascondere nulla (TDD). **(#3)** tagline di contesto sulla landing (chi + cosa fa il
> sito). **(#4)** l'accent "Full" (`#00b4ff` ripetuto in 6 punti) tokenizzato in `--full` (cyan più
> vivo). **(#7)** `--text3` schiarito verso WCAG AA. **(#5)** su mobile i filtri avanzati collassano
> dietro un toggle "Filters" (desktop invariato via `display:contents`). **(#8)** i guest non chiamano
> più `/auth/refresh` (hint `mv_auth` in localStorage) → niente 401 in console + meta PWA moderno.
> **(#11)** OG/Twitter/description/JSON-LD spostati nel sorgente `frontend/index.html` (prima solo
> nell'artefatto backend sovrascritto dal build → live senza OG). **Extra:** bug segnalato — badge
> "NO" promo su lattine con `promo="NO"` legacy, risolto con predicato condiviso `hasPromo()` (anche
> filtro/stats). **(#6)** i 14 `useState` dei filtri in `App.tsx` (duplicati in 5 punti) consolidati
> in un unico oggetto `filters` + helper `setFilter` + costante `NO_FILTERS` (nessun cambio di
> comportamento). **(#9)** render incrementale: griglia/lista/wall montano le prime 60 card e crescono
> di 60 allo scroll (IntersectionObserver via callback ref, rootMargin 600px), invece di ~1866 nodi
> al primo paint; il conteggio "X of Y" resta sul set filtrato completo (verificato: DOM 60 vs 1866).
> **Audit guest COMPLETO: tutte le 11 voci + bug promo.** Test frontend: **223**.

> **2026-07-09 — eBay monitor spostato in cloud (gratis).** Il radar `ebay-monitor/` non gira
> più sul PC: ora è su **GitHub Actions** (`.github/workflows/ebay-monitor.yml`, cron ogni 2h, un
> giro per esecuzione), con lo stato su **MongoDB Atlas** (collection dedicate `ebay_seen`/
> `ebay_blacklist`, non toccano `cans`), tutto **a costo zero**. Segreti nelle **GitHub Secrets**
> (`EBAY_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `MONGODB_URI`). Rimossi loop/countdown/
> anti-standby/SQLite; **cancellati** lo scheletro VLM e gli esperimenti CLIP/DINOv2/OCR (il
> riconoscimento immagine non distingue le varianti → la curatela manuale della blacklist È la
> strategia). Finestra allargata 2,5h→3,5h per i ritardi del cron. Comandi Telegram drenati una
> volta per giro: `/delete` + nuovi **`/add parola`** (blacklist dinamica su Mongo, con guardia) e
> **`/list`**. Blacklist di base estratta in `blacklist.txt` versionato (210 voci). Se Mongo è giù,
> il giro viene saltato con avviso. Test logica pura: `ebay-monitor/test_ebay_monitor.py` (15).
> ⚠️ La password dell'utente Atlas del monitor va **ruotata** (è stata condivisa in chiaro durante il setup).

> **2026-07-09 — Regression pass old-vs-new + sessioni persistenti (in produzione).** Audit
> completo del vecchio commit `4eff004` (app vanilla) contro la nuova app React: tutte le
> regressioni volute sono state ripristinate e deployate. Frontend: export/import **Excel**
> (SheetJS lazy, alias colonne del vecchio Sheet, id deterministici), **Stats modal interattiva**
> (click-to-filter, condition, Top-10 valore admin, timeline 12 mesi count/€), **zoom/pan lightbox**
> (wheel/dblclick/pinch/drag), **riordino foto** (drag&drop + tap-swap ⇄), **cache offline** con
> stale-while-revalidate + retry 5xx "Server warming up…", filtri persistenti, undo 10s sulla
> cancellazione, PWA ripristinata, badge condition colorati, crop pre-selezionato che si blocca al
> rilascio, anteprime slot intere, Promo select Yes/No, validazione Name+SKU, icone header + avatar
> admin (mobile a riga singola icon-only). Backend: **refresh token persistiti in MongoDB**
> (hash SHA-256, TTL index) → le sessioni sopravvivono ai cold start di Render, niente re-login a
> ogni reload. Decisioni: **watch eBay e rotate foto eliminati**, fallback immagini rotte e Scan
> Photos non ripristinati. Test frontend: **218** Vitest/RTL.

> **2026-07-08 — Frontend riscritto in React + gestione password.** I 7 moduli TS
> (`core/ui/tools/photos/share/pwa`) sostituiti da un'app **React 19 + Vite + TS strict** con stato
> **Zustand**, una componente per feature; test **Vitest + React Testing Library** (158) al posto
> della suite Jest legacy (gli smoke Playwright restano in CI). Look dark e feature invariati, build
> ancora embeddata nelle static (stesso origin). Aggiunta la **gestione password admin**: credenziale
> spostata in Mongo (`admin_credentials`, seedata dalla config, solo hash), `PUT /api/account/password`
> (autenticato, verifica la corrente, revoca le sessioni), `POST /api/account/recovery-code` (codice
> backup monouso, mostrato una volta), `POST /api/auth/recover` (reset col codice — rate-limited,
> monouso, mai consegnato a chi lo richiede). Login ridisegnato. Fix flusso foto Add/Edit (crop non
> più forzato all'upload, on-demand cliccando la foto). **SonarQube gate verde** (0 bug/vuln, coverage
> nuovo codice ≥80%, ~40 smell puliti). ⚠️ I PDF di studio (`OneDrive\…\teoria_Monster_vault`) sono
> aggiornati fino al PDF 26 (gestione password).

> **2026-06-25 — Migrazione DB: Firestore → MongoDB Atlas.** Il progetto GCP ha perso il
> billing account (Firestore rispondeva `PERMISSION_DENIED`). Persistenza spostata su MongoDB
> Atlas (M0 free) tramite `MongoCanRepository` dietro il port `CanRepository`: `CanService` e i
> controller **invariati**. Rimossi `firebase-admin`, `FirebaseConfig`, `FirestoreQuotaExceededException`.
> URI dalla env `SPRING_DATA_MONGODB_URI`. Dati ripristinati dal branch `backups`. I riferimenti a
> Firestore nei log datati più in basso sono **storici** (lasciati come registro).

---

## Summary

Monorepo: **`backend/`** Spring Boot 3.3 (Java 17), REST API stateless con JWT; **`frontend/`** app **React 19 + Vite + TypeScript strict** con stato **Zustand** (build embeddata nelle static del backend a build-time → stesso origin, no CORS). Auth con **access token (15 min, in memoria) + refresh token (7 gg, cookie HttpOnly, rotazione + revoca, hash persistiti in Mongo con TTL)**; gestione password admin (cambio + codice di recupero) con credenziale in Mongo. Deploy su Render con **Dockerfile 3-stage** (Node/Vite → Maven → JRE). SEO/AEO (robots/sitemap/llms.txt/JSON-LD/`/share/{id}`). Qualità: **SonarCloud gate verde** in CI. Test: **~105 unit/integrazione backend + 58 E2E Selenium (skip in CI senza Chrome) + 218 test frontend Vitest/RTL + smoke test Playwright (in CI)**.

---

## Work Completed

### Changes Made

- [x] **Refactoring strutturale (rev 41, 2026-06-20)** — 6 fasi, tutte committate e in produzione:
  - **Fase 1 — CHANGELOG**: aggiunto `CHANGELOG.md` (Keep a Changelog + SemVer).
  - **Fase 2 — Refresh token**: `JwtUtil` con due tipi di token (claim `type`, access 15 min / refresh 7 gg, scadenze configurabili); `RefreshTokenStore` (ConcurrentHashMap di hash SHA-256, rotazione + revoca); `AuthService.authenticate→AuthResponse`, `refresh` con rotazione, `logout`; `AuthController` setta cookie HttpOnly/Secure/SameSite=Strict, refresh legge+ruota il cookie, nuovo `/logout`; `JwtFilter` accetta solo access token. Frontend: token in memoria (non più localStorage), `apiCall` su 401 → refresh → retry, recupero sessione al boot dal cookie. Lombok 1.18.34→1.18.38.
  - **Fase 3 — Restructure**: split `backend/` + `frontend/`; Dockerfile e CI con i nuovi path; `.gitignore` aggiornato; frontend buildato e copiato in `static/` a build-time.
  - **Fase 4 — SEO/AEO**: `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD, meta description/canonical/preconnect; `ShareController` (`GET /share/{id}`) con OG meta dinamici per lattina.
  - **Fase 5 — Code quality backend**: constructor injection ovunque (rimosso `@Autowired` su campo), import inutilizzati rimossi.
  - **Fase 6 — Frontend modulare**: monolite `index.html` (~4000 righe) estratto in 7 moduli TS (`core/ui/tools/photos/share/pwa/types`) + Vite + ESLint + Prettier; entry `frontend/index.html`, asset in `public/`, CSS in `styles/main.css`; Dockerfile 3-stage; CI con lint/format/build.
  - **Fix di produzione post-refactor**: (a) `/assets/**` aggiunto alla whitelist di `SecurityConfig` (i bundle Vite davano 401 → sito bianco); (b) `main.ts` espone TUTTI gli export via `Object.assign(window, …)` (10 funzioni bridge mancanti rompevano render/frecce-foto/edit/upload/filtri); (c) `signOut` attende il logout prima del reload + scelta guest non viene più sovrascritta dal cookie; (d) rimosso il pulsante "reset zoom" confuso dalla mappa.
  - **Test E2E Playwright**: 4 smoke test (`frontend/tests/e2e/smoke.spec.ts`) contro il frontend buildato con API mockata; job CI dedicato che installa Chromium → **finalmente E2E che girano in CI** (i Selenium restano, skippati in CI senza Chrome).
  - ⚠️ **Ambiente locale**: usare **JDK 17** per Maven (JDK 25 rompe Lombok: `TypeTag::UNKNOWN`). I PDF di studio (`OneDrive\…\teoria_Monster_vault`) sono ora obsoleti — da rigenerare col nuovo stack.

- [x] **Cloud-native stack (Observability + Kubernetes + IaC) + guest UX/cleanup** (rev 40):
  - **📊 Observability**: Spring Boot Actuator + Micrometer/Prometheus → `/actuator/prometheus`; stack locale **Prometheus + Grafana** (`observability/` docker-compose); metrica business custom **`monstervault_cans_active`** (gauge legato a `CanService.cachedActiveCount()`, conteggio cache-only economico — nessuna query Firestore, nessuna eccezione). `application.yml` versionato (config NON-segreta) + whitelist endpoint actuator in `SecurityConfig`.
  - **☸️ Kubernetes** (`k8s/`): manifest per deploy locale su minikube — Deployment (probe su `/actuator/health`), Service (NodePort), ConfigMap, Secret (template; `secret.yaml` gitignored).
  - **🏗️ IaC / Terraform** (`infra/`): config GCP **Cloud Run + Artifact Registry** (opzione "a secco": `terraform init`/`validate`/`plan`; `apply` documentato per il deploy reale). Stato e `terraform.tfvars` gitignored. ⚠️ Terraform non installato in locale → config scritta con cura, da validare con `terraform validate` lato utente.
  - **🧹 Guest UX + cleanup CLIP**: timeline "Added over time" nascosta ai guest (`if (!isPublicMode)`, come il Top 10 valore); voce "€ range" rimossa dalla **guida guest** (il filtro era già nascosto ai guest); rimossi i riferimenti **"CLIP"** obsoleti (tooltip watch ×2, label edit, commento `Can.java`, riga README pubblico) — CLIP/DINOv2/OCR erano esperimenti **scartati**.
  - **Test**: +2 JVM (`CanServiceTest.cachedActiveCount` → **61** backend) e +3 Jest (→ **89**). **README pubblico** aggiornato: Architecture *system overview* + Technology Stack completa (Observability, Kubernetes, IaC, CI/CD, Testing, companion eBay).
- [x] **🐞 Fix critico: le lattine demo non finiscono più nella collezione** (rev 39):
  - Su mobile, dopo un deploy/cold start l'API è brevemente irraggiungibile → partiva il fallback demo via `applyServerData(MOCK_CANS,…)`, che però eseguiva `migrateStato` + **`batchSaveFS`**: le 2 mock con stato legacy (`MINOR DENTS`→`Minor Dents` = Mango Loco, `DAMAGED`→`Damaged` = Aussie Lemonade) venivano marcate "migrate" e **scritte su Firestore** → l'utente le ritrovava in collezione dopo ogni deploy e le cancellava a mano. Il fallback poteva anche **avvelenare la cache localStorage** con la demo (che poi ricompariva al boot).
  - Fix: nuova **`showDemo(rbtn)` solo-visualizzazione** (niente `saveCache`, niente `batchSaveFS`); i due punti di fallback (errore generico + quota 429) ora la usano al posto di `applyServerData(MOCK_CANS,…)`. **+1 test Jest → 86** (`showDemo` non scrive nulla: no cache, no POST). Verificato in preview: demo mostrata, cache non avvelenata, 0 richieste di scrittura. Commit `2dcce50` (insieme alla rev 38) — **CI verde 86/86 ✓, deploy v17 online ✓**.
- [x] **Calcolatore valore — rifiniture (richieste utente)** (rev 38):
  - **Filtri "solo possibili" (a cascata)**: ogni select offre solo i valori che, dati gli ALTRI filtri attivi, danno ancora risultati (es. con **Full** selezionato in Top/Tab spariscono i colori non presenti tra le full → niente combinazioni a zero lattine); le opzioni sì/no a zero risultati vengono **disabilitate**. `calcRefreshOptions()` ricalcola ad ogni `calcRun` (distinct sul sottoinsieme che esclude il proprio criterio + disable sulle tri-state); una selezione resa impossibile da un altro filtro viene resettata.
  - **Nuovo filtro Photo** (sì/no): in `calcMatch`, `foto` = almeno una tra p1..p4.
  - **UI tutta in inglese** (coerente col resto dell'app): bottone header "Value", titolo "Value Calculator", label e opzioni tradotte.
  - **Reset filters in verde**; **media rimossa** dal riepilogo (resta totale € + conteggio + "senza valore"). `calcTotals` calcola ancora avg internamente (usata dai test) ma non è mostrata.
  - `sw.js` `mv-v16→mv-v17`. **+2 test Jest → 85** (filtro foto, opzioni "solo possibili"). Verificato in preview: cascata (MAGENTA sparisce da Top dopo Full), tri-state disabilitate, Photo, reset verde, summary inglese senza media, 0 errori console.
- [x] **Nuova feature: Calcolatore valore (filtri combinabili + somma raggruppata)** (rev 37):
  - **Pannello dedicato a tutto schermo** (bottone "Valore" in header, **admin-only**) con **filtri guidati combinabili in AND**, aggiornati live: gusto/nome (sottostringa sul nome), paese (sottostringa su `lingua` → prende anche le multi-nazione), taglia, produttore, top/tab, condizione, **full** (note contiene FULL: sì/no), **promo** (campo `promo` truthy: sì/no), **SKU** (contiene / inizia per / esatto → es. "028"), **anno** (range, decodificato dallo SKU).
  - **Output**: **somma € totale + conteggio + media** (le lattine senza valore sono contate a parte, non falsano la somma) e **lista raggruppabile** per gusto-nome / paese / taglia / anno / produttore / tab / condizione, con **subtotale per gruppo** (gruppi ordinati per valore decrescente). Click su una riga → apre il details.
  - Logica in **funzioni pure testabili**: `calcMatch` / `calcFilter` / `calcTotals` / `calcGroups` / `calcGroupKey` / `calcVal`. Pannello inserito nella **catena tastiera a priorità** (Esc chiude, nessun leak). ⚠️ Il raggruppamento "per gusto" usa il **nome esatto** della lattina; una grouping per "linea/famiglia" (Ultra, Mad Dog…) richiede un dizionario gusti — da valutare se servisse più granularità. `sw.js` `mv-v15→mv-v16`. **+9 test Jest → 83**. Verificato in preview: logica (Mexico 35€, Khaos full 10€, SKU 028 contiene→0289+028 / esatto→028, gruppi ordinati, 1 senza valore), UI desktop + mobile (form a 2 colonne), 0 errori console.
- [x] **Fix foto / lightbox / mobile — sessione polish** (rev 36):
  - **🖼️ Foto "trasparenti" aprendo i details**: la `.lightbox` era `rgba(0,0,0,.95)` → il detail panel sotto traspariva (evidente con foto luminose). Ora `#000` pieno.
  - **🟥 Bordi colorati sulle card modificate**: lo sfondo LQIP (miniatura 20px blurrata `cover`) restava DIETRO la foto `contain` a caricamento finito → i bordi si tingevano del colore dominante (es. Raspberry ritagliata stretta → "edges" rossi; la Rojo no perché ha lo sfondo bianco). Ora `.card-img-lqip.lqip-loaded{background-image:none!important}` → bordi neutri per TUTTE le card.
  - **🔍 Foto croppata nei details**: `.detail-main-img` era `object-fit:cover` (ritaglio a quadrato, si vedeva solo una fetta) → ora `contain`, lattina intera.
  - **🌑 Lightbox scura**: l'`<img>` aveva `onerror="opacity=0.15"` senza ripristino → un singolo errore di load lasciava l'opacità incollata a 0.15 e tutte le foto successive scure. Fix: `onload="opacity=1"` + `setLbPhoto` azzera l'opacità e carica `cloudinaryThumb(url,1600,1600)` (CDN, più affidabile dell'originale grezzo).
  - **⌨️ Frecce lightbox che "filtravano" al details** (PC): il 2° handler keydown gestiva lightbox e details in `if` separati SENZA `return` → la freccia cambiava la foto E navigava la lattina sotto (con Esc ti ritrovavi su un'altra lattina). Riscritto a **priorità** (lightbox → modale → compare → details, ognuno con `return`): solo il livello più in alto consuma il tasto. Risolti anche 2 leak latenti (modale sopra il details: frecce non navigano, Esc chiude solo il modale).
  - **⚡ Apertura lightbox più veloce**: le thumb caricavano gli originali grezzi (4 foto a piena risoluzione) → ora `cloudinaryThumb(url,128,128)`.
  - **📱 Foto fuoribordo su mobile** (solo le ritagliate, più alte): `max-height:72vh` non teneva conto di thumbs+info+hint sotto → la colonna sforava l'area visibile (la barra del browser riduce il viewport). Ora `calc(100dvh - 210px)` (`dvh` = altezza visibile reale; fallback `vh`).
  - `sw.js` `mv-v9→mv-v15`. **+12 test Jest → 74** (`cloudinaryThumb`×3, viewer lightbox×4, guard CSS/markup×5). Verificato in preview (sfondo nero, `contain`, opacità ripristinata, tastiera a priorità su tutti gli edge case, fuoribordo a 390×640, 0 errori console). ⚠️ Render free tier era rimasto **indietro di alcuni deploy** (serviva ancora la v10): sbloccato manualmente col **Deploy Hook**; con la regola network-first (rev 35) ora basta UNA ricarica per vedere i deploy.
- [x] **Fix feedback utente rev 31: mappa 401, flusso "choose a flavour", editor foto, anno da SKU** (rev 32):
  - **🐞 Mappa irraggiungibile in produzione (ERR_INVALID_RESPONSE)**: `map.html`/`map-data.js` NON erano nella whitelist statica di `SecurityConfig` → `anyRequest().authenticated()` → 401. Fix: matcher `"/*.html", "/*.js"` (gli asset statici in root sono pubblici). ⚠️ Lezione: ogni NUOVO file statico in root prima richiedeva un matcher esplicito.
  - **🌍 Nuovo flusso mappa "Choose a flavour"** (richiesta utente): la mappa si apre VUOTA con la domanda e 5 chip — **OG, Assault, Rehab Lemon, Ripper, Khaos** (i gusti collezionati di tutti i paesi). Selezione → si accendono SOLO i paesi con quel gusto + **lista sotto (nome e SKU soltanto)** + contatore "N cans · M countries". Match LARGO sul NOME con confini di parola: *OG Mexico* sì, *Mad Dog* NO (`\bog\b`); "Rehab Lemon" = `\brehab\b` + prefisso `\blemon` (prende anche LEMONADE). `FLAVOURS` facilmente estendibile in `map.html`. Tooltip disattivo finché non scegli un gusto; `lightMap()` ora spegne il giro precedente.
  - **🎨 Top/Tab colorato anche nel form di edit**: l'`<input>` non può colorare il testo → aggiunta **anteprima live** sotto il campo (`updateTopPreview()`, si aggiorna mentre digiti; popolata in openEdit/openAdd). (Nel dettaglio/lista/compare era già attivo da rev 31.)
  - **🧱 Wall view**: `object-fit cover→contain` — lattina INTERA con i bordi ai lati come la grid classica (non più tagliata).
  - **✏️ EDITOR FOTO nel form di edit** (nuovo): matita su ogni slot → modal con canvas: **ruota ±90° e ritaglia** (drag col mouse o col dito, `touch-action:none`). Apply → `pendingFiles[slot]` = nuova foto JPEG → caricata dal normale flusso al Save (la vecchia viene ripulita dal backend via deleteOrphanPhotos). Foto Cloudinary ok (CORS anonymous); link esterni senza CORS → toast di errore. Niente endpoint nuovi.
  - **📅 Filtro anno DA SKU** (convenzione collezione, richiesta utente): `extractYearFromCan` ora decodifica lo SKU — 4 cifre `0610`→MM=06/anno 2010, 3 cifre `093`→MM=09/anno 2003; mese >12 o formato diverso → null (escluse quando il filtro è attivo). Prima cercava l'anno nel nome (non funzionava coi dati reali). **3 test Jest riscritti** (62 totali invariati).
  - `sw.js` `mv-v6→mv-v7`. Verifiche: Jest 62/62 ✓, backend BUILD SUCCESS ✓ (SecurityConfig), preview visuale: mappa vuota→chip→USA acceso+lista ✓, match OG/Mad-Dog/Lemonade verificati live ✓.
- [x] **Service worker: HTML/JS in NETWORK-FIRST** (rev 35):
  - Causa del "non vedo le modifiche dopo il deploy" (segnalato dall'utente): gli asset statici erano **cache-first** → il 1° load dopo un deploy serviva la versione VECCHIA (aggiornava in background), la nuova si vedeva solo al 2° load. Verificato via curl che il server serviva già la rev 33: era la PWA del dispositivo.
  - Ora navigazioni/`*.html`/`*.js` sono **network-first** (cache solo fallback offline) — col server sempre sveglio via UptimeRobot non c'è penalità. Immagini/svg restano cache-first. `mv-v10→mv-v11`. ⚠️ Quirk da ricordare: con `display:none` via CSS, ripristinare con `style.display=''` NON mostra l'elemento (vince la regola CSS) → usare `'block'`.
- [x] **Anti cold-start: keep-warm → UptimeRobot** (rev 34):
  - Il workflow `keep-warm.yml` è **SPENTO** (resta solo `workflow_dispatch` manuale): copriva solo 06-21 UTC, la cron di GitHub ritarda, e soprattutto ogni job (~2m30 sui run freddi) veniva fatturato arrotondato al minuto → ~96 run/giorno **sforavano i 2000 min/mese** della repo privata e i ping morivano a metà mese (→ cold start).
  - Sostituito da **UptimeRobot** (account dell'utente): ping HTTP a **`/manifest.json`** (statico, leggero: niente Firestore/bandwidth) ogni **5 min, 24/7** → il servizio Render non dorme mai (750 h istanza/mese coprono 720 h di un mese intero). Verificato: monitor Up, ~143 ms.
  - **Lightbox opaca al 100%**: era `rgba(0,0,0,.95)` da sempre — col 5% di trasparenza il detail panel sotto "trasapariva" (segnalato dall'utente, visibile con foto luminose). Ora `#000` pieno. `sw.js` `mv-v9→mv-v10`.
- [x] **Round 2 fix mappa + layout editor foto** (rev 33):
  - **🐞 Editor foto — layout esploso dopo Apply**: `#slot-1` era `height:auto` → l'anteprima della foto editata (alta risoluzione, `height:100%`) gonfiava lo slot e sfasciava la griglia (anche mobile). Ora `height:350px` fissa (3 thumb + gap) e main `object-fit:contain`.
  - **Mappa**: nomi paese COMPLETI ovunque via `isoName()` (dizionario → `Intl.DisplayNames` → codice); **rosso unificato in nero** per ora (`SHARED_CAN_ISO=[]`; il rosso d'ora in poi = "lattina esiste ma mi manca", da popolare con la lista utente, es. OG Indonesia); **lista: UN solo blocco 🏝️ Caribbean** (`listGroups()` sostituisce le 10 isole nella lista; sulla mappa restano accese); **pinch-zoom a 2 dita** solo sulla mappa (mobile); bandiere con `width/height` + fallback **emoji** se l'immagine non carica (mobile). `sw.js` `mv-v8→mv-v9`.
- [x] **Fix mappa (8 punti utente) + editor foto z-index + sicurezza static** (rev 32):
  - **🐞 Editor foto z-index**: `#photoedit-modal` ora `z-index:470` → si apre SOPRA il modal di edit (prima finiva SOTTO: l'utente doveva chiudere edit e perdeva la modifica). Apply → torna al modal edit aperto → Save.
  - **🔒 SecurityConfig**: whitelist static estesa a `/*.html` e `/*.js` (prima solo `/index.html` + glob immagini → `map.html`/`map-data.js` rischiavano 401). Risolve l'errore di apertura mappa. (Backend Java → richiede rebuild.)
  - **Mappa = flusso a flavour**: chip OG/Assault/Rehab Lemon/Ripper/Khaos → accende i paesi + lista; **ri-click sullo stesso = reset** (mappa vuota). Match largo con confini di parola (`\bog\b` → "OG Mexico" sì, "Mad Dog" no) + **GLOBAL_EXCLUDE `/zero ?sugar/`**.
  - **Lista raggruppata per nazione**: blocchi alfabetici con **bandiera** nel titolo, righe `nome · sku · size` ordinate **per SKU (=data)**; **niente promo** salvo nazioni **solo-promo** (segnate "promo only"); **nessun prezzo** in lista.
  - **Prezzo nascosto** nel pannello-paese: visibile solo col **toggle € in header** (admin), spento di default.
  - **Layout full-size** (PC): mappa+picker in un viewport (`fitFirstView()`=innerHeight−header); la lista scorre **sotto** dopo la scelta. **Mobile**: edges bloccati (`overflow-x:hidden`, `user-scalable=no`); lo zoom scorre **solo** la mappa (`#map-box` con scroll proprio), lista ferma.
  - **CARIBBEAN** → espande a tutte le isole caraibiche **tranne** Rep. Dominicana/Trinidad&Tobago/Giamaica (decisione utente) in `map-data.js MAP_EXPAND`. Isole troppo piccole per l'SVG segnalate nelle note.
  - **Paesi "shared" in ROSSO** (`SHARED_CAN_ISO`, es. Islanda→lattina UK): Monster c'è ma senza lattina propria.
  - **Popup "Info"**: legenda colori + spiegazione Caribbean + **lista paesi senza una mia lattina** (con bandiere, da rivedere insieme). `NO_MONSTER_ISO`/`SHARED_CAN_ISO` aggiornabili man mano.
  - 🐞 fix `#list-scroll` (regola CSS `display:none` → JS deve usare `display:'block'`, non `''`). `sw.js` `mv-v7→mv-v8`. Verificato in preview (lista, reset, popup, 0 errori); Jest 62/62.
- [x] **🌍 World Map + Wall view + Top 10 + filtro anno + fix tastiera mobile** (rev 31):
  - **Mappa interattiva in pagina dedicata `/map.html`** (bottone "Map" in header, visibile anche in guest): planisfero SVG locale (`world-map.svg`, Simple World Map © Al MacDonald/F. Lekschas, **CC BY-SA 3.0**, id=ISO2) — paesi **ACCESI** (verde Monster, glow) dove c'è ≥1 lattina, **SPENTI** gli altri (scelta utente: binario, niente gradiente). Le lattine **multi-nazione contano per TUTTE le nazioni** (separatori `-`, `/`, `->`, `→`; `BENELUX`→BE+NL+LU; `UTAH`→US; `POLKA`→PL ecc.). Tooltip con bandiera+conteggio (+€ solo se admin: presenza token in localStorage), **click su paese acceso → pannello laterale** con le lattine di quel paese (ordinate per valore). Zoom +/−/reset. Contatore "X countries lit". `NO_MONSTER_ISO=[]` predisposto per la futura lista utente dei paesi senza Monster (stile `.no-monster`). Note a piè di pagina per regioni non mappabili (EU, CARIBBEAN) e paesi troppo piccoli per l'SVG (es. Hong Kong). Fallback dati demo se l'API non risponde. Parser in **`map-data.js`** (testabile in Node): **validato su TUTTI i 98 valori reali** del campo lingua → 0 token sconosciuti, **79 paesi** accesi. 🐞 Fix verificato in preview: nei paesi multi-parte (USA/IT/JP…) l'id è su un `<g>` → CSS/eventi coprono `.lit` e i path interni.
  - **Wall view**: terza vista (bottone mosaico + tasto `g` che ora cicla grid→list→wall) = griglia di sole foto (`renderWall`, lattine senza foto escluse, paginazione load-more, click→detail). `renderActiveView()` unico smistamento viste (sostituisce 4 ternari duplicati).
  - **Top 10 most valuable** nel modal Stats (**solo admin**): `buildTopValue()` pura + `renderTopValueHTML()` (rank, thumb, nome, €; click → apre il detail).
  - **Filtro per anno** (📅 from–to, sempre visibile): `extractYearFromCan()` estrae 1980–2039 da nome/descrizione; lattine senza anno escluse quando il filtro è attivo; integrato in hasF/reset/Views (capture/apply).
  - **📱 Fix tastiera mobile**: il campo in editing (es. descrizione) ora viene **scrollato automaticamente in vista** quando si apre la tastiera (`focusin`+`scrollIntoView`) + viewport `interactive-widget=resizes-content`.
  - `sw.js` `mv-v5→mv-v6` (precache anche `/map.html`, `/map-data.js`, `/world-map.svg`). **+7 test Jest → 62** (anno×3, top10×2, wall×2). Verifica visuale in preview: mappa accesa/spenta ✓, pannello paese ✓, bottoni/filtri presenti ✓, 0 errori console.
- [x] **Review completa (4 agenti) + fix TUTTO: backend, frontend, monitor, docs** (rev 30):
  - **Feature — colore Top/Tab**: nuova `colorizeTop()` (mappa ~35 colori EN+IT): in "silver/orange" la parola dopo lo slash è resa col SUO colore (orange→arancione); applicata in lista, dettaglio e compare; output escapato; bianco/nero con text-shadow per leggibilità. **+5 test Jest**. `sw.js` `mv-v4→mv-v5`.
  - **🔒 Frontend XSS/hardening**: `setSelect()` e `applyFilterState()` non usano più `querySelector('option[value="'+v+'"]')` non escapato (→ loop sicuro sulle option); `esc()` aggiunto sugli `src` delle foto in dettaglio e compare.
  - **Frontend design**: logica filtri DEDUPLICATA (`canMatchesFilters()`+`readSelectVals()` = unica fonte per `populateFilters`/`filterCans`); `openDetail()` spezzata in 3 builder SRP (`buildDetailPhotosHTML/FieldsHTML/NavHTML`); cella foto compare estratta (`compareCellPhotoHTML`); stringhe IT residue → EN; locale `it-IT`→`en-US` (date cache-bar, € stats/card/lista). **+3 test Jest Views** (`captureFilterState`/`applyFilterState` roundtrip) → **55 Jest**.
  - **Backend (bug della review)**: `CanService` cache letta via **snapshot locale** ovunque (niente NPE se `persist()` azzera la cache da un altro thread); `deletePhoto` best-effort con log (foto orfane Cloudinary tracciate, invariante Firestore-first conservata); `batchSave` valida lista non vuota + id non blank (400); `from-url` valida `url` presente (400); `X-Confirm-Delete` case-insensitive; **constructor injection** in CanController/AuthController/JwtFilter; `computeEtag` → `CanService` **statico** (funzione pura: gira anche col bean mockato nei test); log su parse public_id Cloudinary fallito.
  - **Monitor (bug della review)**: **allarme "radar cieco"** — i fallimenti delle ricerche vengono contati (`_search_stats`) e se >50% in un giro arriva avviso su Telegram (prima: `except: pass` silenzioso per sempre); gestione **429** (pausa 30s + retry); `mark_seen` non esplode su prezzo malformato (niente rinotifiche infinite); listener `/delete`: drenaggio robusto (se fallisce si RIPROVA, mai rieseguire comandi vecchi); scheletro VLM: confronto con **tutte** le referenze + media-type dai magic bytes + max_tokens 50; `--hours` senza numero ora avvisa; **`requirements.txt` ridotto a `requests`** (deps orfane CLIP → `requirements-experiments.txt`).
  - **EXCLUDE_WORDS v3** (~200 voci, a categorie commentate): + modelli moto (kawasaki kx/klx, kx 85…450, yamaha yz, yzf, crf, rmz, husqvarna, ktm, motocross, enduro…), + ricambi (lever, washer, bolt, exhaust, sprocket, manubrio, forcella, radiator, snap-on, arai/agv/shoei…), + scale modellini 1:18/1:43, + goggle/gloves/boots/stivali; fix trappole substring: `hat`→`" hat"` (bannava "that"), `tee`→`" tee"` (bannava "steel"). Verificata su **36 titoli reali** dal log utente (tutti corretti; lattine flaggate salve, incl. OG Kawasaki).
  - **Docs**: Summary aggiornato (Jest 47→**55**; backend confermato A RUNTIME da Surefire: **117 totali, 2 skip** — il riconteggio "121" suggerito dalla review contava le annotazioni, non le esecuzioni), icona PNG (non SVG). Review eseguita da 4 agenti paralleli (backend/frontend/test-CI-docs/monitor); falsi positivi degli agenti verificati e scartati (la "race sul token" non esiste — il token è passato come argomento ai worker; il README del monitor esiste).
- [x] **eBay Monitor — ban ricambi moto, fumetti, modellini, abbigliamento IT, casse** (rev 29):
  - Su segnalazione utente (log con molto rumore), `EXCLUDE_WORDS` ampliato (case-insensitive, **mirato per NON toccare le lattine flaggate**: es. "OG Kawasaki" salvata usando `fits/for/per kawasaki` invece di "kawasaki" secco):
    - **Ricambi moto**: clutch, caliper, bearing, swingarm, kickstart, throttle, piston, frizione, thrust washer, gear lever, brake lever, helmet, casco, dcor, graphic, athena, koyo, o'neal, pit board, fits/for/per kawasaki, fits/for yamaha.
    - **Fumetti/anime/cartoon**: doujinshi, evangelion, neon genesis, disney, pixar, big into energy.
    - **Modellini & motorsport**: 1:24/1:32/1:64/1/24/1/32/1/64/1:6, diecast, slot car, matchbox, traxxas, quadcopter, drone, nascar, dragster, sprintcar, top fuel, panini, prizm, autograph/autografo, " signed".
    - **Abbigliamento (anche IT)**: felpa/felpe, maglietta/magliette, maglia, canotta, occhiali, jacket, giacca, jersey, softshell, pullover, sweatshirt, tank top, pants, tee.
    - **Casse di lattine comuni**: "lattine da 500/250/355/330" (le singole passano).
  - Verificato live sui titoli reali del log: tutto bannato; lattine vere (OG Kawasaki, OG Ricky Carmichael, Khaos, Assault Camo, Tour Water) passano. Categoria "gaming/casa" NON bannata (scelta utente).
- [x] **eBay Monitor — fix filtri (maiuscole), polling 2h, cappelli/multipack** (rev 28):
  - **🐞 Fix EXCLUDE case-insensitive** in `ebay_monitor.py` (era `w in title_l`, ora `w.lower() in title_l`): le parole bannate con maiuscole (es. "Supercross") ora matchano sempre. (REQUIRE era già case-insensitive.)
  - **Polling 57 min → 2h** (`POLL_INTERVAL_SECONDS=7200`) + **finestra 2h → 2,5h** (`MAX_LISTING_AGE_HOURS=2.5`, ~30 min di margine per l'indicizzazione eBay). Budget: 26×6×12 ≈ **1.872 call/giorno**.
  - `EXCLUDE_WORDS`: rimossi `cap` (beccava "small cap") e `12` (beccava "2012"); aggiunti cappelli (`hat`/`snapback`/`beanie`/`trucker`/`cappello`/`cappellino`) e multipack (`case of`, `" x 500"`, `" x 330"`, `" x 355"`, `" x 250"`, `" x 16oz"`, `" x 12oz"`).
  - ⚠️ Le modifiche a `config.py` si attivano al **riavvio** del monitor (config letta all'avvio).
- [x] **eBay Monitor — keyword riviste + finestra 2h** (rev 27):
  - **Keyword aggiornate** (tolto lo sweep anni 2002–2015): aggiunte `java, dragon, rehab, maxx, mixxd, m80, drink` + la ricerca **generica `monster energy`** (kw `""`); `gadgets`→`gadget`. Ora **26 ricerche** (`SEARCH_QUERIES = [f"monster energy {kw}".strip() for kw in _KEYWORDS]`).
  - **Finestra** `MAX_LISTING_AGE_HOURS` 1h → **2h** (polling 57 min resta < finestra). Budget: 26×6×~25 ≈ **3.940 call/giorno**.
  - `EXCLUDE_WORDS` += `labubu`/`pop mart` (falso positivo Pop Mart) + `game`, `pack`, `zip`, `hoodie`, `t-shirt`, `tshirt`, `camicia` (taglia merch/abbigliamento/bundle; ⚠️ `pack` esclude anche i multipack di lattine).
  - Verificato live: giro ultime 2h → **7 annunci unici** (prima 0): lattine comuni (Ultra Rosa, Java Monster) + merch.
- [x] **eBay Monitor — comando Telegram `/delete`** (rev 26):
  - Nuovo **listener Telegram** in un **thread daemon** (`telegram_command_listener`, long-polling `getUpdates`) avviato da `run()`: con **`/delete`** il bot cancella i **propri** messaggi recenti (`delete_bot_messages`, a ritroso fino a `DELETE_SCAN_BACK=300`) e conferma con `🗑️ Cancellati N`. `setMyCommands` mette /delete nel menu del bot.
  - ⚠️ Limiti **Telegram** (non aggirabili): elimina solo i messaggi del bot, solo se **< 48h**, e solo **mentre il monitor gira**. Ascolta **solo** la chat `TELEGRAM_CHAT_ID`; all'avvio **drena** gli update arretrati (non riesegue comandi vecchi). Testato live (setMyCommands/getUpdates/deleteMessage = ok).
- [x] **eBay Monitor — ricerca parallela (B) + timer + anti-standby + Germania** (rev 25):
  - **Opzione B = ricerca in PARALLELO** (`PARALLEL_SEARCH=True`, `PARALLEL_WORKERS=8`; nuove `fetch_all`/`gather_listings` con `ThreadPoolExecutor`): un giro completo da **~4 min a ~40s** (misurato). `PARALLEL_SEARCH=False` torna al sequenziale con avanzamento mercato per mercato.
  - **Timer/countdown** in `run()` (`_countdown`, basato sulla deadline → al risveglio dallo standby riparte subito): durante l'attesa mostra `⏳ prossimo giro tra MM:SS`.
  - **Anti-standby** (`_prevent_sleep` via Windows `SetThreadExecutionState`): impedisce la **sospensione automatica** del PC mentre il monitor gira (NON la sospensione manuale). Risolve il "passati 50 min e non ricontrolla".
  - **+Germania**: mercati ora **IT/DE/US/CA/GB/AU** (6); polling **57 min** (< finestra 1h) → 32×6×~25 ≈ **4.851 call/giorno** (verificato, sotto ~5.000).
- [x] **eBay Monitor — solo "Monster Energy" + annunci freschi + UX; sito: occhio in pausa** (rev 24):
  - **Ricerca corretta** (l'utente vedeva Pokémon/Monster High): `SEARCH_QUERIES` ora **`monster energy <kw>`** (18 keyword) + sweep **`monster energy 2002–2015`** = 32 query. Aggiunto **`REQUIRE_WORDS=["monster","energy"]`** = paletto LATO CLIENT in `process()` perché **eBay non fa un AND stretto** (lascia passare es. "…Scooby Doo… Monster #160 2008" senza "energy", verificato live) → notifica solo se il titolo le contiene **tutte**. `EXCLUDE_WORDS` += pokemon/yu-gi-oh/tcg/fuel pump.
  - **Solo annunci freschi**: `MAX_LISTING_AGE_HOURS=1` → filtro eBay server-side **`itemStartDate:[now-1h..]`** in `search_ebay`. **`POLL_INTERVAL_SECONDS=3000` (50 min)**, che deve restare **< della finestra** o si perdono annunci tra un giro e l'altro.
  - **Mercati 9→5: IT/US/CA/GB/AU** (1 solo mercato UE = IT, perché gli annunci europei spediscono in tutta la UE) → 32×5×~29 ≈ **4.600 call/giorno** (sotto ~5.000).
  - **UX/test**: **avanzamento in-place** in `iter_listings` (es. `IT [12/32] …`; ~1,3s/chiamata → **giro ~3,5 min**, 1° avvio con baseline ~7 min, poi 50 min di pausa); CLI **`--hours N`** per i test; nuovo **`test_subito.bat`** (doppio click). `ebay-monitor/README.md` riscritta.
  - **Sito**: la UI del flag **watch (occhio)** su card/dettaglio/edit è **NASCOSTA via CSS** (reversibile: basta cancellare il blocco in `index.html`) perché serve solo al confronto-foto (VLM, spento); le **38 flag restano salvate nel DB** (il checkbox in Edit resta nel DOM → non si azzerano). `sw.js` `mv-v3→mv-v4`. **CI verde** (Backend Maven + Frontend Jest: i 4 test watch passano).
- [x] **eBay Monitor LIVE — radar keyword (A) + ricerche/anni + docs** (rev 23):
  - **Chiavi eBay Production** ottenute (esenzione "Marketplace Account Deletion" → keyset abilitato) → **OAuth + Browse API verificati live**, multi-mercato. Secret solo in `config.py` (gitignored).
  - **Modalità A attiva**: `SEARCH_QUERIES` = 18 keyword (assault, khaos, ufc, billabong, tour water, dub, hydro, all star, muscle, sales sample, lot, gadgets, limited, shot, promo, heavy metal, full, rare) **+ sweep anni 2002–2015** = 32 query × 9 mercati ≈ **4.600 call/giorno**. **Match largo** (parole-ancora "monster X", non frase esatta → becca titoli parziali e lotti es. "Trio Mixxd, M80, Khaos"). `EXCLUDE_WORDS` minimo. Test `--send-now`: **15 annunci arrivati su Telegram**.
  - **Modalità B (VLM)** scaffold pronto ma **SPENTO** (`USE_VLM=False`) — idea nel cassetto, manca solo la **API key Anthropic** per la precisione foto-vs-foto. CLIP/DINOv2/OCR scartati (non distinguono le lattine; testato).
  - Nuova **`ebay-monitor/README.md`** completa + fix `backup.yml` (`checkout@v4→v5`, Node 20).
- [x] **eBay Monitor spostato nel repo + riscritto su Browse API** (rev 22):
  - **Spostato** da `C:\Users\HP\monster_monitor` (cartella separata) a **`ebay-monitor/`** dentro il repo, ordinato: `config.py` (segreti, **gitignored**) + `config.example.py` (template versionato) + `README.md` + `clip_check.py` (validazione soglia) + `rare_cans/` (foto gitignorate, solo README versionato) + `.gitignore`. Il `Dockerfile` copia solo `pom.xml`+`src/` → **zero impatto su build/deploy Render**.
  - **Browse API** (al posto della Finding legacy): OAuth client-credentials con token in cache; cerca su 14 marketplace × `SEARCH_QUERIES` (le ricerche salvate dell'utente) ordinando per *appena listati*; **nessun filtro spedizione/paese** → vede anche gli annunci "solo USA" indipendentemente dall'indirizzo dell'account; match CLIP su **tutte** le foto dell'annuncio (`additionalImages`) → becca i lotti con più lattine. `py_compile` OK.
- [x] **eBay Monitor — curazione via flag "watch" + rimozione email** (rev 21):
  - **Sito** (`monster-vault-server`): nuovo campo `Can.watch` (Boolean; auto-persiste via `.set(can)`/`toObject`, **nessuna** modifica al repository) + toggle **solo-admin** nel frontend: **occhio cliccabile** su ogni card (`toggleWatch()` ottimistico + rollback; fa PUT dell'oggetto completo → preserva `p*Id`) e **checkbox** nel modale edit. **🐞 Fix**: `buildCanData`/`readCanForm` ora includono `watch` — senza, ogni salvataggio da edit lo azzerava. **+4 test Jest → 47** (47/47); backend **117 invariata** (0 fail, 2 skip).
  - **Tool** (`monster_monitor`): rimosso TUTTO il codice **email/SMTP** (solo Telegram); referenze dal sito ora = lattine **`watch=true`** (non più la soglia 25€ — scelta dell'utente); `TELEGRAM_CHAT_ID` impostato; `rare_cans/` ora **ricorsivo** (una sottocartella per lattina = più foto) + `README.txt`.
  - **Deciso (Q&A utente)**: la keyword eBay è **obbligatoria** (l'API è una ricerca, niente "firehose" → image-only impossibile) → usare le **ricerche salvate** dell'utente come query multiple; CLIP matcha il **design** non la taglia (473ml↔XXL stesso disegno, soglia ~0.82); una foto-lotto con più lattine **diluisce** il match → usare **tutte** le foto annuncio (Browse `additionalImages`).
  - **Prossimo (bloccato sull'utente)**: Client ID + Secret eBay (Browse API, Production) + lista completa ricerche salvate → poi riscrittura `search_ebay` su **Browse API** + multi-query + multi-foto + taratura soglia.
- [x] **Tool companion: eBay Monitor (Python)** (rev 20) — progetto **SEPARATO** in `C:\Users\HP\monster_monitor` (NON nel repo): monitora eBay per lattine Monster rare appena listate e notifica via **Telegram**, riconoscendole dalla **foto** (CLIP) non dal titolo → becca anche annunci mal-etichettati a prezzo basso. Dettagli completi + stato + TODO nella sezione **"eBay Monitor (companion tool)"** in fondo. Il sito (rev 19) è stabile e invariato.
- [x] **Miniature: lattina intera (no crop)** (rev 19): le card ritagliavano la foto (Cloudinary `c_fill` + CSS `object-fit:cover`). Ora `cloudinaryThumb()` usa `c_fit` (ridimensiona senza tagliare) e `.card-img img`/`.card-img-lqip img` usano `object-fit:contain` → lattina intera visibile, con lo sfondo LQIP sfocato (`background-size:cover`) che riempie i bordi. Verificato live.
- [x] **Fix PWA installata + landing** (rev 18):
  - **🐞 Foto non visibili nell'app installata**: il service worker intercettava le richieste **cross-origin** (foto Cloudinary) e le re-fetchava → su iOS le response opaque cross-origin fallivano e le foto sparivano (nel browser invece OK). Ora `sw.js` **ignora il cross-origin** (Cloudinary/cdnjs/flagcdn vanno diretti in rete); `CACHE_VERSION` `mv-v1`→`mv-v2` (svuota la cache vecchia). Per vederlo sull'app già installata: riaprirla online (il SW si aggiorna) o disinstallare/reinstallare
  - **🐞 Face ID chiesto al caricamento (iOS)**: il blocco AUTH al boot apriva l'auth-overlay **dietro** la landing (z900 sotto z1000) → iOS rilevava il campo password e proponeva Face ID mentre era ancora visibile la landing. Ora il login **non si apre al boot**; il campo password nasce `type="text"` `autocomplete="off"` e diventa `password`/`current-password` solo tramite `openAuthOverlay()` (Admin access / Sign in). **Face ID scatta solo dopo "Admin access"**
  - **Landing semplificata**: rimossi "ENTER VAULT" e "WITH PHOTOS ONLY". Restano **GUEST ACCESS** + **ADMIN ACCESS**, entrambi bottoni ben visibili e proporzionati (prima "admin" era un link `color:#2a2a2a`, di fatto invisibile)
- [x] **Icona PWA → logo Monster** (rev 17): sostituito `icon.svg` con il logo fornito dall'utente. `icon.png` (215×235, originale) + `icon-512.png` (512×512 quadrata, claw centrato su nero, generata via Chrome headless → migliore per maskable/install). `manifest.json` (3 entry PNG: 215×235 any + 512×512 any/maskable) e `apple-touch-icon` → `/icon-512.png`; `icon.svg` rimosso. Verificato: PNG serviti `200 image/png`
- [x] **7 nuove funzionalità** (rev 16 — Opus 4.8) — tutte verificate live nel preview, 0 errori console:
  - **Keep-warm pinger** (`.github/workflows/keep-warm.yml`): cron `*/10 6-21 * * *` che fa `GET /api/cans` → tiene sveglio Render free tier, **elimina il cold-start senza costi** (alternativa gratuita all'upgrade). ~600-720 min Action/mese (repo privata, limite 2000 — intervallo/finestra regolabili nel file)
  - **#2 Preset filtri "Views"**: salva/applica/elimina combinazioni di filtri (search+dropdown+chip+range+sort) in localStorage; menu `★ Views` nella barra info. Funzioni pure `captureFilterState()`/`applyFilterState()`, nomi escapati con `jsq()`
  - **#5 Zoom/pan lightbox**: pinch a 2 dita, drag-to-pan, doppio-tap/doppio-click (toggle 2.5×), wheel desktop; swipe foto disabilitato quando ingrandito (`lbZoom.scale>1.05`); reset al cambio foto/chiusura
  - **#6 Trend valore**: timeline con **secondo toggle Count ⇄ € Value** (somma `valore` per periodo). `buildTimelineData`/`buildYearlyData` ora restituiscono `{k,n,v}`
  - **#8 QR code link pubblico**: lib `qrcode-generator` da cdnjs (CSP `script-src` già consente cdnjs), **SVG inline** nel modale Share, si rigenera col nome
  - **#9 Scorciatoie tastiera**: `/` cerca · `g` griglia/lista · `n` nuova (admin) · `?` guida; disattive mentre scrivi (input/textarea/select) o con overlay aperti
  - **#10 Bottone "Install app"**: cattura `beforeinstallprompt`, mostra il bottone nella cloud-bar; si nasconde dopo `appinstalled`
  - **+2 test Jest** (somma valore / toggle metrica) → **43 test frontend**
- [x] **Polish finale: focus-trap, social card, timeline interattiva, CI** (rev 15 — Opus 4.8):
  - **#26 Focus-trap + Esc**: nuovo modulo (Tab/Shift+Tab ciclico nell'overlay, focus all'apertura, ripristino alla chiusura via MutationObserver) sui 9 modali/panel + Esc esteso ai `.modal-backdrop`. Provato live (last→first, first→last, Esc). ⚠️ I modali sono `position:fixed` → `offsetParent` è null: la visibilità si testa con la classe `.open`, NON con offsetParent
  - **#27 Immagine social 1200×630**: nuovo `static/social-preview.png` (card brandizzata generata via Chrome headless screenshot di un HTML 1200×630) + `og:image`/`twitter:image` aggiornati + `og:image:width/height` → anteprime social corrette (prima puntavano all'SVG, ignorato dai crawler social)
  - **#16 Timeline interattiva**: toggle **12 months ⇄ By year** (nuova funzione pura `buildYearlyData`, `renderTimelineChart` per-modalità, `setTimelineMode`) + hover-highlight sulle barre (`.tl-bar:hover`). +3 test Jest → **41 test frontend**
  - **CI → Node 24**: `actions/checkout@v4→v5`, `setup-java@v4→v5`, `setup-node@v4→v5` (Node test `20→22`) — risolve il warning di deprecazione Node 20
- [x] **Check cross-device + fix mobile/iOS** (rev 14 — Opus 4.8) — verifica funzionale su PC/mobile via preview (375px iPhone + desktop), tutte le schermate OK, 0 errori console:
  - **🍏 Zoom iOS sui form**: gli input di testo (`.auth-input`, search, `.field input/textarea`, `.vrange-input`, `.share-url-input`) erano <16px → iOS Safari zoomava il viewport al focus. Aggiunta regola `font-size:16px` **solo in `@media(max-width:640px)`** (desktop invariato). Verificato: mobile 16px, desktop 13px
  - **🍏 Status bar PWA iOS**: `apple-mobile-web-app-status-bar-style` da `black-translucent` → `black` — con translucent il contenuto finiva **sotto** la status bar nella PWA installata; ora c'è spazio dedicato (tema già scuro `#0a0a0a`)
  - **Polish**: 4 toast residui IT→EN ("Link/Testo/View link copiato ✓" → "copied ✓")
  - **Non-bug confermati**: `body.public-mode #edit-modal{display:none!important}` è una guardia guest corretta (un ospite non apre il modale edit nemmeno forzando `openEdit`); card-overlay su `:hover` è solo zucchero desktop (su touch il tap apre comunque il detail, Edit è nel pannello); drag&drop foto è PC-only ma il tap apre il file picker (`accept="image/*"` → camera/galleria)
- [x] **Review & hardening del frontend** (rev 13 — Opus 4.8) — esaminato il sito anche a runtime (preview + mock data):
  - **🔒 XSS hardening**: nuovo helper `jsq()` (escape per stringhe JS dentro attributi inline) applicato a TUTTI gli id/valori passati a `onclick` (`openDetail`/`openEdit`/`openLightbox`/`toggleCompare`/`statsFilter`/nav prev-next); `esc()` aggiunto su `data-id`/`data-can-id` e sulle option di `populateFilters`. Prima un id con apice (importabile da Excel) poteva eseguire codice nelle collezioni condivise read-only. **+5 test Jest** + verifica live (id ostile reso inerte: `openDetail('x\x27)…')`, nessun breakout)
  - **Polish UI**: uniformate le stringhe residue IT→EN ("Aggiorna"→"Refresh", "Importa Excel"→"Import Excel", placeholder, toast, cache bar); meta `og:url` corretto (era la vecchia GitHub Pages) e `og:image`/`twitter:image` ora puntano a `/icon.svg` (anteprime social non più rotte)
  - **Migrazione `stato` efficiente**: da N `PUT` paralleli ad ogni load a **una sola `POST /batch`** (meno carico/quota Firestore); toast "X migrated" mostrato solo a persistenza riuscita (era ottimistico anche sui fallimenti)
  - **Accessibilità**: `aria-label` su search/tema/chiusure modali; `role="dialog"` + `aria-modal="true"` su tutti i 9 contenitori modali/panel; empty-state filtri con azione "Reset filters" diretta
  - **Jest: 38 test** (era 33). Verifica runtime: 8 card OK, click→detail OK, 0 errori console
- [x] **Hardening, SOLID stats & build fix** (rev 12 — Opus 4.8):
  - **PWA — icona locale**: nuovo `static/icon.svg` (lattina Monster, tema scuro, "M" verde) servito dal backend; `manifest.json` non punta più ai PNG Cloudinary esterni ma a `/icon.svg` (`sizes:"any"`, purpose `any`+`maskable`); aggiunto `<link rel="apple-touch-icon" href="/icon.svg">` → **PWA installabile senza dipendenze esterne**
  - **Stats SOLID + grafico timeline** (`index.html`): estratte 4 funzioni pure a livello modulo — `statsFreq()` (SRP, rimpiazza la `freq()` locale), `buildStatsData()` (aggregazione summary), `buildTimelineData()` (cans/mese, ultimi 12 mesi da `updatedAt`), `renderTimeline()` (SVG bar chart). `openStatsModal()` ora **orchestra soltanto** (OCP: timeline e tooltip aggiunti senza modificare `renderSection`). Donut con `<title>` per tooltip nativo on-hover.
  - **+10 test Jest** per le funzioni pure stats (`statsFreq`/`buildStatsData`/`buildTimelineData`/`renderTimeline`) → **33 test frontend** totali (era 23)
  - **🔒 Security — rate limiter bounded**: `LoginRateLimitInterceptor` usa ora una mappa **LRU** (LinkedHashMap access-order, cap `MAX_TRACKED_IPS=10_000`, `synchronizedMap`) invece di `ConcurrentHashMap` illimitata → previene **memory-exhaustion DoS** via rotazione IP / header `X-Forwarded-For`
  - **🔒 Security — JWT key deterministica**: `JwtUtil.getKey()` usa `secret.getBytes(StandardCharsets.UTF_8)` (prima: charset di default piattaforma) → **stessa chiave HMAC tra Windows (Cp1252) e Linux/Render (UTF-8)**, token verificabili cross-ambiente
  - **🔧 Fix `mvnw.cmd`**: era **LF-only** (cmd.exe non interpreta `@echo`/blocchi → output `()` spurio) + riga corrotta `__ MVNW_CMD__` (spazio nel nome var) + mancava `-Dmaven.multiModuleProjectDirectory`. Ora: `@echo off` in testa, convertito a **CRLF**, property passata. Nuovo `.gitattributes` blinda `*.cmd`→CRLF / `mvnw`→LF. **Il wrapper Windows ora funziona da PowerShell.**
  - **Security review**: verificati JwtFilter/JwtUtil/SecurityConfig/CanService/CloudinaryService — architettura DIP/SRP confermata, nessun path-traversal (slot `int`, id vincolato da Firestore), SSRF `from-url` accettabile (admin-only, fetch lato Cloudinary). Scartati a ragion veduta: cambiare `X-Forwarded-For[0]` (rischio rottura rate-limit su Render), `@Valid` su `update()` (romperebbe gli update con id solo via path), rimozione `'unsafe-inline'` CSP (richiede rifattorizzare il single-file con nonce)

- [x] Backend Spring Boot: model, controller, service, security (MVC)
- [x] Autenticazione JWT stateless (sostituisce Google Auth Firebase)
- [x] Upload foto server-side su Cloudinary (file e da URL)
- [x] Accesso Firestore via Firebase Admin SDK
- [x] Cache in-memoria in `CanService` (double-checked locking, thread-safe)
- [x] Frontend migrato: rimossi SDK Firebase, tutte le chiamate usano REST API
- [x] Show/hide password, admin avatar SVG, auto-detect JWT scaduto
- [x] Retry automatico (3×, 2s) in `loadFromServer` per cold start
- [x] Dockerfile multi-stage per deploy su Render
- [x] **Repository pattern**: `CanRepository` interface + `FirestoreCanRepository` (SOLID DIP)
- [x] **PhotoStorage interface**: `CloudinaryService implements PhotoStorage` (SOLID DIP)
- [x] **TokenValidator / TokenGenerator interfaces**: `JwtUtil implements` entrambe (SOLID DIP)
- [x] **AuthService interface** + `AdminAuthService`: logica auth estratta da `AuthController` (SOLID SRP+DIP)
- [x] `GlobalExceptionHandler`: gestione centralizzata errori 400/500 (SOLID SRP)
- [x] `@Valid` + `@NotBlank(id)` su `Can` + `batchSave` atomico con `WriteBatch` (ACID)
- [x] Invalidazione cache su errore repo (ACID Consistency)
- [x] `deleteAll` richiede header `X-Confirm-Delete: all` (protezione accidentale)
- [x] **34 test** backend (unit + integration) — tutti verdi
- [x] **Bug fix**: `batchDeleteAllFS()` aggiunge header `X-Confirm-Delete: all` mancante
- [x] **Bug fix**: `shareCanLink()` usava `can.paese`/`can.full` inesistenti → corretti in `can.lingua`/`can.note`
- [x] **Bug fix**: rimosso codice morto `syncFromGoogleSheets()` / `parseCSV()` / `GSHEET_CSV_URL` (−109 righe)
- [x] **Bug fix**: `clearAll()` non aggiornava la cache localStorage dopo la cancellazione
- [x] **SOLID frontend** — 5 refactoring applicati a `index.html`:
  - `loadFromServer` → `loadFromCache()` + `fetchWithRetry()` + `applyServerData()` (SRP)
  - `saveFilters()` / `restoreFilters()` → data-driven via array `filterKeys`/`filterFields` (OCP)
  - `statsFilter()` → lookup `filterFields.indexOf()` invece di catena if/else (OCP)
  - `applyFilters()` → `filterCans()` pura (dati) + `applyFilters()` (UI) (SRP)
  - `saveCan()` → `readCanForm()` + `buildCanData()` + `updateCanInCache()` + `refreshAfterSave()` (SRP)
- [x] **Fix XSS**: `esc(e.message)` in error display di `loadFromServer`
- [x] **19 test Jest** frontend (jsdom) — tutti verdi
- [x] **Newman collection** (14 test API) in `src/test/api/`
- [x] **Guida admin** riscritta: compatta, solo in inglese, sezioni Managing/Photos/Import-Export
- [x] **Guida guest**: bottone Guide visibile anche in guest mode, contenuto differenziato (Browse/Compare/Conditions)
- [x] **Sort "RECENTLY ADDED"**: visibile in admin e guest mode, hidden solo VALUE ↓/↑ per admin
- [x] **Sort "RECENTLY PHOTOGRAPHED"**: `Can.java` aggiunto campo `photoAt` (Long, timestamp); `FirestoreCanRepository.save()`/`batchSave()` impostano `photoAt=now` se almeno uno slot foto (p1-p4) è presente; ordinamento `added-desc` usa `photoAt` desc (fallback `updatedAt`) → lattina fotografata più di recente in cima, senza foto in fondo; label select rinominata RECENTLY ADDED → RECENTLY PHOTOGRAPHED
- [x] **Fix compare foto**: `object-fit: contain` — immagine intera visibile nel panel compare, niente zoom/crop
- [x] **Fix login mobile / Face ID**: form login wrappato in `<form autocomplete="on" onsubmit>` con `<button type="submit">` — iOS Safari / Face ID ora associa correttamente l'autofill al submit; rimosso `onkeydown` ridondante; overlay scrollabile su mobile (`overflow-y:auto`) per evitare che la tastiera copra il bottone Sign in
- [x] **Login retry su cold start**: `signIn()` riprova 3× con 3s di intervallo se il server risponde 5xx (invece di mostrare subito "Invalid username or password"); dopo 5s senza risposta appare messaggio "Server warming up (free tier cold start)…" dentro la auth card
- [x] **Cold start message nel grid**: `fetchWithRetry` aggiorna il testo del grid a "Server warming up… Free tier cold start · usually 30–50s" al primo retry, visibile dopo il login
- [x] **Mock data fallback**: `MOCK_CANS` (8 lattine) caricato automaticamente se server non raggiungibile (preview/offline)
- [x] **Cache bar**: `updateCacheBar()` chiamata in `applyLoaded()` — mostra "Aggiornato DD/MM HH:MM" in admin mode
- [x] **Bug fix**: `uploadCloudFromUrl` catch era silenzioso — aggiunto toast "Photo N: URL upload failed — saved as external link"
- [x] **Guest Compare**: campo Est. Value nascosto in modalità pubblica (`.filter` sul fields array)
- [x] **Compare panel colors**: etichette tutte verdi, nomi lattine in rosso — statico, nessuna logica dinamica
- [x] **Compare mobile**: max 2 lattine su schermi ≤640px, scroll verticale
- [x] **DRY `CanService`**: `persist()` helper elimina 3 try-catch identici
- [x] **Default view**: "Recently Added + With Photo" al primo accesso (impostato in `restoreFilters()`)
- [x] **Header**: nome admin "RedMghost" invece di "Admin"
- [x] **Firestore quota (429)**: `FirestoreQuotaExceededException` + handler 429 in `GlobalExceptionHandler` + graceful fallback frontend (cache → mock → messaggio errore)
- [x] **#16 Fix drag & drop foto esistenti**: `editCan` ora popola anche `pendingURLs[n]` e `pendingFiles[n]` — le foto già salvate sono draggabili
- [x] **#13 Ricerca full-text**: `filterCans` e `populateFilters` cercano anche in `c.note` (prima solo nome/SKU/descrizione); placeholder aggiornato
- [x] **#14 Stats modal migliorata**: 4 summary tiles in cima (Total/Promo/With Photo%/Full), barra progress "Photo coverage", statsFilter gestisce promo e full
- [x] **#7 Lombok 1.18.34**: compatibile con JDK 21+ — elimina il workaround `JAVA_HOME` esplicito per i test
- [x] **#4 Rate limiting login**: `LoginRateLimitInterceptor` (Bucket4j, 10 req/min per IP) + `WebConfig` registra su `/api/auth/login`; controlla `X-Forwarded-For` per Render
- [x] **#9 OpenAPI/Swagger**: `springdoc-openapi-starter-webmvc-ui 2.6.0` → `/swagger-ui.html`; `OpenApiConfig` configura JWT Bearer "Authorize" button; URL swagger permessi in SecurityConfig
- [x] **#12 PWA**: `manifest.json` aggiornato (start_url `/`, theme_color verde), `sw.js` creato (cache-first assets, network-first API), registrazione SW in `index.html`
- [x] **#6 Firestore pagination**: `getAll()` usa `startAfter()` con pagine da 500 doc — resiliente a timeout di rete su collection grandi
- [x] **GitHub Actions CI**: `.github/workflows/ci.yml` — 117 test Java (JDK 17/Maven) + 38 Jest (Node 20) a ogni push/PR su main; caching Maven + npm
- [x] **Backup Firestore automatico**: `.github/workflows/backup.yml` — ogni domenica alle 3:00 UTC scarica `GET /api/cans` (3 retry per cold start) e pusha il JSON datato sul branch `backups`
- [x] **Cache TTL 12h**: `CanService` invalida la cache dopo 12 ore (`cacheLoadedAt` volatile + `cacheAge()` helper); `save/batchSave/delete/deleteAll` aggiornano `cacheLoadedAt`; cache "esterna" (set via reflection nei test) trattata come fresca (age=0)
- [x] **Swipe prev/next detail panel**: touch listeners su `#detail-panel` — swipe orizzontale dominante (|dx|≥50, |dy|<|dx|) chiama `detailNav(±1)`; ignora scroll verticale
- [x] **Bug fix opening mutually exclusive**: input opening da `checkbox` a `radio name="e-opening"` — una sola selezione; `loadNoteCheckboxes`/`getNoteFromCheckboxes` aggiornati
- [x] **Bug fix Minor Dents/Damaged in edit**: option values `"Minor Dents"` e `"Damaged"` allineati ai canonici di `STATO_NORMALIZE` — il select si popola correttamente nel modal edit
- [x] **Auto-delete foto Cloudinary**: `PhotoStorage.delete()` eliminazione automatica — premi ✕ su uno slot, sostituisci foto, o elimini lattina → vecchia foto rimossa da Cloudinary; `deleteAll()` deliberatamente escluso (1800+ chiamate API → timeout)
- [x] **SOLID refactor** (rev 8):
  - **SRP**: tutta la logica foto spostata da `CanController` a `CanService` (`update()`, `delete()` con cleanup, `uploadPhoto()`, `uploadPhotoFromUrl()`, helper `setPhoto()`/`deleteOrphanPhotos()`) — il controller ora contiene solo routing HTTP
  - **OCP**: `PhotoStorage.delete()` e `deleteFolder()` come `default` no-op — future implementazioni non obbligate a fare override
  - **DIP**: `CanService` dipende da `PhotoStorage` (interfaccia); `CanController` non dipende più da `PhotoStorage`
- [x] **7 miglioramenti** (rev 10):
  1. **`content-visibility: auto`** su `.card` — CSS-only virtual scroll; il browser skippa rendering delle card fuori viewport (`contain-intrinsic-size: 0 260px`)
  2. **CSP + security headers** — `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/geo/mic/payment off)
  3. **ETag su `GET /api/cans`** — hash XOR di (id + updatedAt); `304 Not Modified` se la collezione non è cambiata → risparmia banda e quota Firestore
  4. **LQIP** — `cloudinaryLqip()` genera thumbnail 20px blurrata (`w_20,e_blur:200`); card-img-lqip con CSS blur/scale fade-in; `imgErrCard()` aggiornato per `.card-img-lqip`
  5. **JWT silent refresh** — `POST /api/auth/refresh` (backend); frontend controlla ogni 5 min, rinnovo silenzioso se < 30 min alla scadenza, toast warning se < 5 min
  6. **Soft delete + undo toast** — `DELETE /{id}` → soft delete (`deletedAt`); `DELETE /{id}/permanent` → definitivo + Cloudinary; `PUT /{id}/restore` → ripristino; toast "Can deleted — Undo" con progress bar 10s; timeout → permanentDelete
  7. **`toastUndo(msg, onUndo, ms)`** — helper riusabile con pulsante Undo e barra di progresso CSS (`@keyframes toast-shrink`)
- [x] **AuthService.refresh()** + `AdminAuthService` con `TokenValidator` — prerequisito per JWT refresh
- [x] **`Can.deletedAt`** — soft delete timestamp, `getAll()` filtra `deletedAt == null`, `getById()` include soft-deleted
- [x] **Suite test Selenium E2E** (rev 11 — stabilizzata):
  - `SecurityHeadersTest` (10 test MockMvc) — ETag deterministico/mutabile, 304 con ETag corrispondente, CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy: **tutti verdi**
  - `AdminFlowE2ETest` (25 test) — login, grid, view switch, detail panel, edit modal (radio/Minor Dents), soft-delete + undo toast, JWT refresh: **tutti verdi**
  - `GuestFlowE2ETest` (14 test) — no admin buttons, search, compare, URL filters: **tutti verdi**
  - `ResponsiveE2ETest` (19 test) — mobile 2col, tablet 3col, LQIP, content-visibility, auth overlay mobile: **17 verdi + 2 skippati** (viewport-dipendenti, Chrome/Windows clampra a ~480px)
  - **Base class `E2EBaseTest`**: `@SpringBootTest(RANDOM_PORT)` + `@MockBean` FirebaseApp/Firestore/CanRepository/PhotoStorage/AuthService; JWT iniettato via localStorage; `assumeTrue(chromeAvailable)` skippa se Chrome assente; WebDriverManager auto-download ChromeDriver

- [x] **Fix 3 Cloudinary** (rev 9):
  - **Race condition risolta**: `save()` Firestore avviene SEMPRE prima di `delete()` Cloudinary — se il DB fallisce, le foto non vengono mai cancellate; coerenza garantita in ogni scenario
  - **`deleteAll` riabilitata** via `PhotoStorage.deleteFolder()`: usa Admin API `deleteResourcesByPrefix("monster-vault/")` con paginazione `next_cursor` — 1-3 chiamate invece di N×`destroy()`; best-effort (se Cloudinary fallisce il DB è già pulito, warning loggato)
  - **`publicId` nel modello**: `Can.java` aggiunge campi `p1Id`-`p4Id` (Cloudinary public_id) — nuove foto usano delete diretto senza parsing URL; cans vecchi (p1Id null) fallback su parsing URL (backward compat)
  - **`CloudinaryService.delete()` smart**: accetta sia URL HTTPS che public_id diretto tramite `resolvePublicId()`
- [x] **Frontend foto rotte** (rev 9):
  - `imgErrCard(el)`: card grid — nasconde img rotta, mostra placeholder SVG
  - `imgErrMain(el)`: detail panel — sostituisce main img con "Photo not available"
  - `onerror` su tutti i thumbnail (detail, lightbox) — spariscono silenziosamente
  - Bottone admin **"Scan Photos"** (`btn-clean`): testa tutte le URL in parallelo (thumbnail 10×10), mostra `confirm()` con conteggio URL rotte, rimuove dal DB via PUT e aggiorna la UI

---

## Architecture

```
CanController ──→ CanService ──→ CanRepository (interface)
                      │                └──→ FirestoreCanRepository (paginato)
                      └──→ PhotoStorage (interface)
                                  └──→ CloudinaryService

AuthController ──→ AuthService (interface)
                         └──→ AdminAuthService ──→ TokenGenerator (interface)
                                                └──→ PasswordEncoder

JwtFilter ──→ TokenValidator (interface)
                    └──→ JwtUtil implements TokenValidator, TokenGenerator

LoginRateLimitInterceptor ──→ WebConfig (registrato su /api/auth/login)
OpenApiConfig ──→ Swagger UI a /swagger-ui.html (JWT Bearer)
```

- **Stateless**: ogni richiesta porta JWT in `Authorization: Bearer <token>`
- **Security**: GET `/api/cans/**` pubblici; tutto il resto richiede JWT valido
- **Swagger**: pubblico per caricare la UI, ma le chiamate protette richiedono JWT (pulsante "Authorize")
- **Cache**: `volatile List<Can>` in `CanService` — si popola al primo `getAll()`, aggiornata in-place da `save()`/`delete()`, invalidata (null) su errore repo, svuotata (empty list) da `deleteAll()`
- **Frontend**: `API = ''` — stesso origin, nessun CORS
- **PWA**: manifest + service worker → installabile come app, cache-first per assets, offline-friendly

---

## Files

### Source (`src/main/java/com/monstervault/`)

| File | Ruolo |
|------|-------|
| `model/Can.java` | Lombok @Data + `@NotBlank` su `id` + `photoAt` (Long) + `p1Id`-`p4Id` (Cloudinary public_id per delete diretto) |
| `config/SecurityConfig.java` | Spring Security stateless, allowlist GET pubblici + Swagger |
| `config/WebConfig.java` | **NEW** — registra `LoginRateLimitInterceptor` su `/api/auth/login` |
| `config/OpenApiConfig.java` | **NEW** — OpenAPI bean con JWT Bearer security scheme |
| `security/TokenValidator.java` | Interface: `isValid`, `getUsername` |
| `security/TokenGenerator.java` | Interface: `generate` |
| `security/JwtUtil.java` | `@Component implements TokenValidator, TokenGenerator` |
| `security/JwtFilter.java` | Filtro HTTP; dipende da `TokenValidator` |
| `security/LoginRateLimitInterceptor.java` | **NEW** — Bucket4j 10 req/min per IP su login |
| `repository/CanRepository.java` | Interface CRUD — port di persistenza (SOLID DIP) |
| `repository/MongoCanRepository.java` | Adapter MongoDB (Spring Data `MongoTemplate`) del port `CanRepository` |
| `service/AuthService.java` | Interface: `Optional<String> authenticate(user, pass)` |
| `service/AdminAuthService.java` | `@Service implements AuthService`; ha `@Value` credenziali, BCrypt, TokenGenerator |
| `service/CanService.java` | Cache thread-safe + orchestrazione foto: `update()` con cleanup Cloudinary, `delete()` con cleanup, `uploadPhoto/FromUrl()`, helper privati `setPhoto/deleteOrphanPhotos` |
| `service/PhotoStorage.java` | Interface: `upload`, `uploadFromUrl`, `delete(urlOrPublicId)` (default no-op), `deleteFolder()` (default no-op, usa Admin API) |
| `service/CloudinaryService.java` | `@Service implements PhotoStorage`; `delete()` accetta URL o public_id diretto (`resolvePublicId()`); `deleteFolder()` usa `deleteResourcesByPrefix` con paginazione |
| `controller/AuthController.java` | POST `/api/auth/login` — dipende solo da `AuthService` |
| `controller/CanController.java` | **Solo routing HTTP** — dipende solo da `CanService` (nessuna logica foto diretta) |
| `controller/GlobalExceptionHandler.java` | `@RestControllerAdvice`: 400 validation, 404 risorsa statica, 500 generic |

### Static (`src/main/resources/static/`)

| File | Ruolo |
|------|-------|
| `index.html` | Frontend SPA completo; stats con funzioni pure `statsFreq`/`buildStatsData`/`buildTimelineData`/`renderTimeline` (rev 12); helper XSS `jsq()` + `esc()` su tutti i sink inline (rev 13) |
| `manifest.json` | PWA manifest (start_url `/`, theme verde, icona `/icon.svg`) |
| `icon.png` / `icon-512.png` | Icona PWA — logo Monster (rev 17): originale 215×235 + 512×512 quadrata per install/maskable |
| `sw.js` | Service worker: cache-first assets, network-first API |

### Config root

| File | Ruolo |
|------|-------|
| `.gitattributes` | **NEW** (rev 12) — `*.cmd`/`*.bat`→CRLF, `*.sh`/`mvnw`→LF: impedisce la corruzione dei line-ending degli script |
| `mvnw.cmd` | Wrapper Maven Windows — riparato in rev 12 (`@echo off` + CRLF + `-Dmaven.multiModuleProjectDirectory`) |

### Tests (`src/test/java/com/monstervault/`)

| File | Test | Cosa verifica |
|------|------|---------------|
| `service/CanServiceTest.java` | 19 | Cache, save/update/softDelete/restore/permanentDelete, InOrder Firestore-before-Cloudinary, publicId, deleteFolder, Cloudinary failure resilience |
| `service/AdminAuthServiceTest.java` | 7 | authenticate, refresh (valid/invalid/null token), short-circuit |
| `security/JwtUtilTest.java` | 4 | Generazione, validazione, username, token invalido |
| `controller/AuthControllerTest.java` | 3 | Login OK/wrong-password/wrong-username |
| `controller/CanControllerTest.java` | 16 | CRUD, soft-delete, permanentDelete, restore, @Valid, deleteAll header |
| `controller/SecurityHeadersTest.java` | 10 | ETag deterministico/mutabile/304, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

**Totale unit+integration: 59 test, 0 failures**

**E2E Selenium** (`src/test/java/com/monstervault/e2e/`):
| File | Test | Stato |
|------|------|-------|
| `E2EBaseTest.java` | — | Base class astratta |
| `AdminFlowE2ETest.java` | 25 | ✅ tutti verdi |
| `GuestFlowE2ETest.java` | 14 | ✅ tutti verdi |
| `ResponsiveE2ETest.java` | 19 | ✅ 17 verdi + 2 skipped (viewport Chrome/Windows) |

**Frontend Jest** (`frontend-tests/frontend.test.js`, jsdom — carica l'`index.html` reale): **38 test, 0 failures**. Coprono `esc`/`jsq` (XSS), `apiCall`/header JWT, `batchDeleteAllFS`, `shareCanLink`, `clearAll`, `renderComparePanel`, e le funzioni pure stats (`statsFreq`/`buildStatsData`/`buildTimelineData`/`renderTimeline`). Eseguire: `cd frontend-tests && npm test`.

---

## Technical Details

### Dependencies (`pom.xml`)

```xml
spring-boot-starter-parent 3.3.0
spring-boot-starter-web
spring-boot-starter-security
spring-boot-starter-validation
spring-boot-starter-data-mongodb               ← persistenza (ex firebase-admin)
jjwt-api / jjwt-impl / jjwt-jackson 0.12.3
cloudinary-http44 1.38.0
lombok 1.18.34                                  ← #7 (era 1.18.32, incompatibile con JDK21+)
bucket4j-core 8.10.1                            ← #4 rate limiting login
springdoc-openapi-starter-webmvc-ui 2.6.0       ← #9 Swagger UI
spring-boot-starter-test
mockito-core
selenium-java 4.21.0                            ← E2E test con browser headless
webdrivermanager 5.8.0                          ← auto-download ChromeDriver
```

### Configuration (`application.properties` — locale, NON pushato)

```properties
server.port=8080
spring.data.mongodb.uri=mongodb://localhost:27017/monstervault
app.admin.username=RedMghost
app.admin.password=<bcrypt hash>
app.jwt.secret=<secret ≥32 char>
app.jwt.expiration=86400000
cloudinary.cloud-name=dufmjcv8s
cloudinary.api-key=<key>
cloudinary.api-secret=<secret>
```

Env vars su Render (stesse, formato `UPPER_SNAKE_CASE`):  
`SPRING_DATA_MONGODB_URI` (connection string Atlas con user:password), `APP_ADMIN_USERNAME`, `APP_ADMIN_PASSWORD`, `APP_JWT_SECRET`, `APP_JWT_EXPIRATION`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Come eseguire i test

> ✅ **`mvnw.cmd` ora funziona da PowerShell** (riparato in rev 12: era LF-only + mancava
> `-Dmaven.multiModuleProjectDirectory`). Basta impostare `JAVA_HOME` su JDK 17.

**JDK disponibili su questa macchina:**
- JDK 25 (default di sistema — `$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"`)
- **JDK 17** (Adoptium, raccomandato — `C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot`)

**Comando consigliato da PowerShell** (usa il wrapper riparato):

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
.\mvnw.cmd test
```

**Alternativa** — binario Maven diretto (sempre valido, utile se il wrapper venisse di nuovo toccato):

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
& "C:\Users\HP\.m2\wrapper\dists\apache-maven-3.9.6-bin\3311e1d4\apache-maven-3.9.6\bin\mvn.cmd" `
  -f "C:\Users\HP\Documents\monster-vault-server\pom.xml" test
```

**Output atteso (tutti i test inclusi E2E, ultima riga prima di BUILD SUCCESS):**

```
Tests run: 117, Failures: 0, Errors: 0, Skipped: 2
```
(2 skipped = `mobile_authOverlayScrollable` + `mobile_authOverlayAlignTop` per Chrome/Windows viewport clamp)

**Solo unit+integration (escludi E2E):**
```
Tests run: 59, Failures: 0, Errors: 0, Skipped: 0
```

**Note:**
- I WARNING su `jansi` / `sun.misc.Unsafe` / `restricted method` sono normali — ignorarli
- JDK 25 causa `ExceptionInInitializerError: TypeTag::UNKNOWN` durante la compilazione → usare JDK 17
- Non usare `2>&1` in PowerShell su comandi nativi: trasforma stderr in `NativeCommandError` e fa sembrare il comando fallito anche se ha successo
- Per salvare l'output su file: `... test *> C:\Temp\out.txt` (operatore `*>` cattura sia stdout che stderr in PS)

---

## Gotchas

- **`mvnw.cmd`** — riparato in rev 12 (era LF-only + corrotto). Se in futuro un editor lo risalvasse in LF si ri-romperebbe: `.gitattributes` (`*.cmd text eol=crlf`) lo previene a livello git. Da PowerShell: `$env:JAVA_HOME=...JDK17; .\mvnw.cmd test`.
- **JDK 25 non compila** — errore `TypeTag::UNKNOWN`. Impostare `$env:JAVA_HOME` a JDK 17 prima di eseguire Maven (percorso in "Come eseguire i test").
- **`2>&1` in PowerShell su exe nativi** — trasforma stderr in `NativeCommandError` rendendo il risultato illeggibile; usare `*>` per redirigere stdout+stderr.
- **Quota Firestore free tier**: 50.000 letture/giorno. Con 1813 doc bastano ~27 `GET /api/cans` senza cache. La cache server risolve in produzione; in locale (ogni riavvio = cold cache) fare attenzione.
- **Cold start Render**: container spento dopo 15 min inattività → 30-50s al primo accesso. Il frontend fa retry 3× con 2s.
- **`application.properties` e `firebase-service-account.json`**: devono esistere in locale, mai pushati (in `.gitignore`).
- **`@WebMvcTest` + Security**: richiede `@Import({SecurityConfig.class, JwtUtil.class})` altrimenti tutti i test tornano 401/403.
- **Swagger in produzione**: la UI è pubblica (necessario per fare login e ottenere il token), ma tutte le chiamate protette richiedono JWT. Se si vuole restringere l'accesso alla docs, spostare `/swagger-ui/**` e `/v3/api-docs/**` da `permitAll()` ad `authenticated()` in `SecurityConfig`.
- **PWA icons**: dalla rev 12 il `manifest.json` usa l'icona **locale** `/icon.svg` (SVG `sizes:"any"`, servita dal backend) — niente più dipendenza da PNG su Cloudinary. PWA installabile out-of-the-box. Per cambiare l'icona basta editare `static/icon.svg`.
- **Rate limiting in-memory**: i bucket di `LoginRateLimitInterceptor` si azzerano al riavvio del container. Su Render free tier il container si addormenta frequentemente, quindi il limite è meno stringente in pratica. Dalla rev 12 la mappa IP→bucket è **LRU bounded** (`MAX_TRACKED_IPS=10_000`) per evitare crescita illimitata (memory DoS) da rotazione IP/`X-Forwarded-For`. Sufficiente per bloccare bot veloci.

---

## Current State

### Working

- **Suite E2E Selenium completa**: 58 test (25 Admin + 14 Guest + 17 Responsive + 2 skipped su Chrome/Windows), 0 failures
- Tutti gli endpoint CRUD, auth, upload foto, soft-delete/restore/permanentDelete
- Frontend: login JWT, collezione, add/edit/soft-delete + undo toast 10s, import Excel, foto
- Soft delete: `deletedAt` timestamp; undo toast con progress bar; `permanentDelete` dopo 10s
- JWT silent refresh: rinnovo automatico se < 30 min alla scadenza (ogni 5 min)
- LQIP: thumbnail 20px blurrata → fade-in full image (Cloudinary transform `w_20,e_blur:200`)
- `content-visibility: auto` su `.card` → CSS virtual scroll (browser skippa card fuori viewport)
- CSP + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy
- **XSS hardening frontend (rev 13)**: id/valori escapati con `jsq()` in tutti gli handler inline (`onclick`) + `esc()` su `data-id`/option — nessun breakout possibile nelle collezioni condivise read-only
- **Accessibilità (rev 13)**: `role="dialog"`+`aria-modal` sui 9 modali/panel; `aria-label` su search/tema/chiusure; empty-state filtri con "Reset filters"
- **Rate limiter LRU bounded** (rev 12) + **JWT key UTF-8** (rev 12)
- ETag su `GET /api/cans` → `304 Not Modified` se nulla cambia
- Migrazione condition `stato` legacy: **una sola `POST /batch`** per load (rev 13, non più N `PUT`)
- Scan Photos: testa URL foto in parallelo, rimuove URL rotti da DB via PUT
- onerror su tutte le img can: `imgErrCard`, `imgErrMain`, onerror su thumbnail detail/lightbox
- **117 test backend (59 unit/integ + 58 E2E) + 38 test Jest frontend — tutti verdi (CI inclusa)**
- Mobile: 2-col grid, detail/edit full-width, Face ID form, auth overlay scrollabile
- Tablet: 3-col grid, tutti i bottoni admin visibili
- Guest mode: no admin buttons, search/compare/filter funzionanti

### Known Issues — E2E test Selenium (✅ stabilizzati in rev 11)

**Stato**: tutti i test E2E passano (58/58, con 2 skippati volutamente).

**Fix applicati in rev 11:**
1. `E2EBaseTest.dismissLandingOverlay()` — aggiunto helper che chiama `closeLanding(false)` via JS e attende `display:none` sull'overlay (z-index:1000 bloccava tutti i click)
2. `E2EBaseTest.openAsAdmin/Guest()` — `dismissLandingOverlay()` chiamato dopo la navigazione iniziale
3. `E2EBaseTest.resizeTo()` — rimossa la compensazione `innerWidth` (errata su headless Chrome/Windows) → `setSize(width, height)` diretto
4. `E2EBaseTest.openAsGuest()` — aggiunto `wait.until(visibilityOfElementLocated(".card"))` dopo il dismiss filtro
5. `E2EBaseTest` timeout: 10s → 15s
6. `E2EBaseTest.waitForElementPresent()` — aggiunto helper con `presenceOfElementLocated` (usato per LQIP div height:0)
7. `AdminFlowE2ETest.loginFlow_correctCredentials_showsAdminUI` — hide landing direttamente (`style.display='none'`) senza chiamare `closeLanding(false)` (che farebbe `continueAsGuest()` e nasconderebbe l'auth overlay)
8. `AdminFlowE2ETest.detailPanel_closeButton_closesPanel` — `#detail-close-btn` → `#detail-back`
9. `AdminFlowE2ETest.editModal_openingRadiosMutuallyExclusive` — `radio.click()` → `js("arguments[0].click()", radio)` (radio fuori viewport nel modal)
10. `AdminFlowE2ETest.search_clearFilter_restoresAllCards` — `si.clear()+Keys.BACK_SPACE` → JS `el.value=''; dispatchEvent(new Event('input'))` (Selenium clear() non scatena l'evento input)
11. `AdminFlowE2ETest.softDelete_showsUndoToast` — aggiunto `waitForElement(".toast-undo-btn")` prima dell'`isDisplayed()` check (timing issue)
12. `ResponsiveE2ETest.lqip_cardWithPhoto_*` — `waitForElement` → `waitForElementPresent`
13. `ResponsiveE2ETest.mobile_authOverlayScrollable/AlignTop` — aggiunto `assumeTrue(matchMedia("max-width:480px").matches)`: Chrome/Windows clampra il viewport a ~480px (la soglia della breakpoint); i test vengono skippati invece di fallire
14. `ResponsiveE2ETest.mobile_cardWidthFitsScreen` — range `150-200px` → `130-260px` (a 480px clampato: card ~223px, entrambi i valori corrispondono al layout mobile 2-colonne)
15. `ResponsiveE2ETest.mobile_authOverlayScrollable/AlignTop` — aggiunto `localStorage.clear()` + refresh per garantire overlay visibile senza JWT

**Nota sui 2 test skippati:**
`mobile_authOverlayScrollable` e `mobile_authOverlayAlignTop` verificano i valori CSS della media query `@media(max-width:480px)`. Chrome headless su Windows non raggiunge viewport < ~480px (OS clamp). I test usano `assumeTrue(matchMedia.matches)` e vengono skippati su questa piattaforma ma passano su Linux/Mac CI dove Chrome può raggiungere 375px.

**Come eseguire solo i test E2E:**
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
& "C:\Users\HP\.m2\wrapper\dists\apache-maven-3.9.6-bin\3311e1d4\apache-maven-3.9.6\bin\mvn.cmd" `
  -f "C:\Users\HP\Documents\monster-vault-server\pom.xml" test `
  -Dtest="AdminFlowE2ETest,GuestFlowE2ETest,ResponsiveE2ETest" -DfailIfNoTests=false
```

**Come escludere i test E2E (solo unit):**
```powershell
& "...\mvn.cmd" -f "...\pom.xml" test -Dexcludes="**/e2e/**"
```

### Cloudinary — nota organizzazione cartelle

Le foto vengono caricate nella cartella `monster-vault/` su Cloudinary. Le foto esistenti precedenti all'adozione del prefisso si trovano nella root di Cloudinary ma funzionano correttamente — non è necessario spostarle (cambiare public_id romperebbe gli URL in Firestore).

---

## Next Steps

### Immediato (prossima sessione)
1. ~~**Fix test E2E Selenium**~~ ✅ (rev 11 — 58/58 test passano, 2 skippati su Chrome/Windows per viewport clamp OS)

### Infrastruttura
2. ~~**Dominio personalizzato / upgrade Render $7**~~ — ❌ **deciso: non procedere** (no spesa); cold start 30-50s accettato
3. ~~**Rendere privata la vecchia repo `monster-vault`**~~ ✅ fatto
4. ~~**GitHub Actions CI**~~ ✅ (117 test Java + 41 Jest a ogni push/PR su main; rev 15: action su Node 24)

### Backend / Architettura
5. ~~**Rate limiting sul login**~~ ✅ (Bucket4j)
6. ~~**Cache TTL + ETag**~~ ✅ (12h TTL + `304 Not Modified`)
7. ~~**Paginazione Firestore**~~ ✅ (`startAfter()` + 500 doc/pagina)
8. ~~**Upgrade Lombok → 1.18.34+**~~ ✅
9. ~~**Soft delete**~~ ✅ (`deletedAt` + restore + permanentDelete + undo toast)
10. ~~**OpenAPI/Swagger**~~ ✅
11. **Architettura multi-utente** (Cloudinary per-user) — 💤 parcheggiata volutamente (idea nel cassetto)

### UI / UX
12. ~~**Lightbox con navigazione prev/next**~~ ✅
13. ~~**PWA installabile**~~ ✅ (rev 12: icona locale `/icon.svg`, nessuna dipendenza esterna)
14. ~~**Ricerca full-text**~~ ✅
15. ~~**Statistiche migliorate**~~ ✅
16. ~~**Statistiche con grafici avanzati**~~ ✅ (rev 15): timeline interattiva con toggle **12 mesi ⇄ per anno** + hover-highlight + tooltip nativi su donut/barre
17. ~~**Drag & drop foto**~~ ✅
18. ~~**LQIP progressive images**~~ ✅
19. ~~**content-visibility: auto**~~ ✅
20. ~~**JWT silent refresh**~~ ✅
21. ~~**CSP + security headers**~~ ✅

### Sicurezza & Accessibilità (rev 13)
22. ~~**XSS escaping frontend**~~ ✅ — helper `jsq()` su tutti gli handler inline + `esc()` su `data-id`/option
23. ~~**Stringhe IT→EN + meta OG/Twitter**~~ ✅ — anteprime social non più rotte
24. ~~**Migrazione `stato` via `/batch`**~~ ✅ — era N `PUT` per load
25. ~~**ARIA base**~~ ✅ — `role="dialog"`/`aria-modal` sui 9 modali + `aria-label` sui controlli icona
26. ~~**Focus-trap + Esc uniforme nei modali**~~ ✅ (rev 15) — Tab/Shift+Tab ciclico, focus on-open/restore, Esc su tutti gli overlay
27. ~~**Immagine anteprima social 1200×630**~~ ✅ (rev 15) — `social-preview.png` brandizzato + `og:image:width/height`

### Batch funzionalità (rev 16) — scelte dall'utente
28. ~~**Keep-warm pinger**~~ ✅ — GitHub Action cron toglie il cold-start gratis
29. ~~**Preset filtri "Views"**~~ ✅ · 30. ~~**Zoom/pan lightbox**~~ ✅ · 31. ~~**Trend valore (Count/€)**~~ ✅
32. ~~**QR link pubblico**~~ ✅ · 33. ~~**Scorciatoie tastiera**~~ ✅ · 34. ~~**Bottone Install app**~~ ✅

### Idee valutate ma NON scelte dall'utente (in archivio)
- Quantità copie + stato owned/wishlist/**for-trade** (collezione pubblica come strumento di trading)
- Tracciamento **serie/set** ("8/12 della serie 2024")
- **Scan barcode/SKU** con fotocamera (richiede riattivare `camera=()` nella Permissions-Policy)
- **Nudge qualità dati** ("X senza foto/valore", cliccabili per filtrare)

---

## eBay Monitor (companion tool) — progetto separato

> **Cartella:** `ebay-monitor/` **dentro il repo** (spostata in rev 22). Non fa parte dell'app: il `Dockerfile` copia solo `pom.xml`+`src/`, quindi non finisce nel deploy. `config.py` (segreti) è **gitignored**; il template versionato è `config.example.py`. Vedi `ebay-monitor/README.md`.

**Scopo:** monitora eBay per **lattine Monster rare appena messe in vendita** e manda una notifica **Telegram**. Oggi cerca **per nome** ("monster energy" + keyword, modalità A); la verifica per **foto** (VLM, modalità B) è pronta ma **spenta** — sarà lei a isolare la variante esatta quando arriverà la API key Anthropic.

**Ambiente (già pronto su questa macchina):**
- **Python 3.12.10** installato via winget → `C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe`. Nei `.bat` si usa il launcher **`py`** (NON `python`, che è lo stub Store).
- Dipendenze installate e verificate (import OK): `requests`, `Pillow`, `numpy`, **`sentence-transformers 5.5.1`** (porta `torch` — CLIP).

**File** (`ebay-monitor/`): `ebay_monitor.py` (logica), `config.py` (impostazioni+segreti, **gitignored**), `config.example.py` (template), `README.md`, `clip_check.py` (validazione soglia), `avvia_monitor.bat`/`test_subito.bat`/`installa.bat`, `requirements.txt` (solo `requests`) + `requirements-experiments.txt` (deps pesanti dei soli esperimenti CLIP/DINO/OCR), `rare_cans/` (referenze locali, foto gitignorate), `seen_listings.db` (runtime, gitignored).

**Come funziona:**
- **eBay Browse API** (OAuth) su **6 marketplace** (IT,DE,US,CA,GB,AU — `EBAY_DE` = grande mercato europeo; `EBAY_IT` mostra già le inserzioni internazionali spedibili in IT; riducibili/espandibili in config, occhio al budget). Ordine *appena listati*, **nessun filtro spedizione** → vede anche annunci "solo spedizione USA"; **filtro temporale `itemStartDate` → solo annunci recenti** (`MAX_LISTING_AGE_HOURS=2.5`, ultime ~2,5h; polling 2h). Le ricerche girano in **PARALLELO** (`PARALLEL_SEARCH`, ThreadPoolExecutor ×8 → giro ~40s). ⚠️ **NO Messico/NZ/Giappone**.
- `SEARCH_QUERIES` (**26**): **sempre "monster energy" + keyword** (parole obbligatorie, non frase esatta), inclusa la ricerca **generica `monster energy`** (kw `""`). Doppio filtro sul titolo: `REQUIRE_WORDS=["monster","energy"]` (le deve contenere tutte — eBay non è un AND stretto) + `EXCLUDE_WORDS` (case-insensitive: altri brand Monster + carte/giochi + ricambi moto + Pop Mart/Labubu + abbigliamento/cappelli + multipack). Modalità A = notifica per nome (rumorosa, triage utente); modalità B (VLM, spenta) = verifica foto per la precisione.
- **Referenze (per la modalità B/VLM, oggi spenta) — dal sito:** `GET .../api/cans` → solo le lattine con **`watch=true`** (flaggate a mano dall'admin; la UI dell'occhio è ora **nascosta** ma le flag restano nel DB) + immagini in `rare_cans/` (oggi **vuota**, solo README). CLIP/DINOv2/OCR **scartati** (non distinguono le lattine, testato) → la precisione arriverà dal **VLM** (`vlm_match()`, scheletro).
- **Solo annunci NUOVI e freschi:** filtro `itemStartDate` (ultime ~2,5h) lato eBay + al 1° avvio `establish_baseline()` segna gli annunci già online come "visti" **senza notificare**; da lì in poi avvisa **solo i nuovi** (DB sqlite `seen_listings.db`). Avanzamento in-place + **timer countdown** (`_countdown`) in attesa; **`_prevent_sleep`** impedisce lo standby automatico del PC mentre gira (non la sospensione manuale).
- **Notifiche: Telegram** (`send_telegram` via Bot API `sendPhoto`/`sendMessage`). `NOTIFY_VIA="telegram"` (accetta lista separata da virgola). WhatsApp è stato **rimosso** (CallMeBot inaffidabile, scartato dall'utente).
- **Comando `/delete`**: `telegram_command_listener` (thread daemon, long-polling `getUpdates`) cancella i messaggi del bot a ritroso (`delete_bot_messages`, `DELETE_SCAN_BACK`). Limiti Telegram: solo msg del bot, < 48h, e solo mentre il monitor gira.

**Stato attuale (rev 30):** ✅ **eBay LIVE** — keyset Production (App ID `MarioRan-ChatBot-PRD-9996645fc-8714e611`; secret solo in `config.py` gitignored), OAuth+Browse verificati. ✅ **Modalità A attiva e tarata**: query **"monster energy <kw>"** (**26**, inclusa la generica "monster energy") × **6 mercati (IT/DE/US/CA/GB/AU)** ≈ 1.872 call/giorno; ricerche in **PARALLELO** (giro ~40s); **`REQUIRE_WORDS`** impone "Monster Energy" lato client (niente Pokémon) + **`EXCLUDE_WORDS` v3** (~200 voci a categorie, case-insensitive, trick spazio iniziale `" hat"`/`" tee"`); **`MAX_LISTING_AGE_HOURS=2.5`** (ultime ~2,5h); **polling 2h** + **timer countdown** + **anti-standby automatico** + comando Telegram **`/delete`**; **allarme "radar cieco"** (fallimenti >50% → avviso Telegram) + retry su **429**; `--hours`/`test_subito.bat`. ✅ `ebay-monitor/README.md` aggiornata. 🙈 **Sito: occhio (watch) NASCOSTO via CSS** (reversibile) finché il VLM è spento; le **38 flag** restano salvate nel DB. ⏳ **Modalità B (VLM)** scaffold pronto ma **spento** (`USE_VLM=False`): manca solo la **API key Anthropic** — ora confronta TUTTE le referenze (media-type auto, max_tokens 50); resta da rifinire la prompt al primo uso.

**⚠️ TODO (riprendere da qui):**
1. 🔮 **Modalità B (VLM)** — quando arriva la **API key Anthropic**: `pip install anthropic`, `ANTHROPIC_API_KEY`, `USE_VLM=True`; rifinire `vlm_match()` (prompt + confronto con TUTTE le referenze). È la versione "sniper" che isola le varianti esatte (old camo 473 vs 2023, first-release, ecc.) — il vero bisogno dell'utente (collezione di varianti finissime).
2. **Tarare ricerche/budget**: l'utente edita `SEARCH_QUERIES`/`EBAY_MARKETPLACES`; budget = n_query × n_mercati × cicli/giorno < ~5.000 (ora 6 mercati × 26 × 12 ≈ 1.872). ⚠️ `POLL_INTERVAL_SECONDS` deve restare **< di `MAX_LISTING_AGE_HOURS`** (ora 2h < 2,5h). ✅ Ricerca in **parallelo** già attiva (`PARALLEL_SEARCH`, giro ~40s).
3. **24/7**: il monitor gira sul PC dell'utente (si ferma in standby) → valutare hosting su server.

**Idea futura (non fatta):** ritaglio per-lattina nei lotti (object detection).

---

## Resources

- Render dashboard: https://dashboard.render.com
- GitHub repo: https://github.com/MarioRanieri/monster-vault-server
- Firestore console: https://console.firebase.google.com/project/monster-vault-3fd2a
- Cloudinary console: https://cloudinary.com/console
- Swagger UI (live): https://monster-vault-server.onrender.com/swagger-ui.html
