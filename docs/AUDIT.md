# Audit — Monster Vault (focus: esperienza guest)

> Shortlist ad alto segnale. Perimetro: sito React + esperienza **guest**; backend solo dove tocca il sito; monitor eBay fuori. Asse visivo = raffinare **dentro** l'identità esistente (dark-first, accent lime, font attuali). Verificato dal vivo su `monster-vault-server.onrender.com` (screenshot guest: landing, griglia, dettaglio, mobile) + lettura codice.
>
> Priorità = impatto sul guest ÷ sforzo. **P0** fai subito, **P1** alto valore, **P2** rifinitura.

## Riepilogo

| # | Voce | Asse | Impatto guest | Sforzo | Prio |
|---|------|------|---------------|--------|------|
| 1 | I font progettati **non caricano in prod** (CSP blocca Google Fonts) | Visivo+Codice | Altissimo | M | **P0** |
| 2 | Griglia guest dominata da card senza foto (1510/1866) | Logico+Visivo | Alto | S–M | **P1** |
| 3 | Etichette criptiche: "RedMghost's Collection", nessun "cos'è" | Contesto | Alto | S | **P1** |
| 4 | Accent blu fuori palette (`#00b4ff`) accanto al lime | Visivo | Medio | S | **P1** |
| 5 | Mobile: la filter-bar mangia tutta la prima schermata | Visivo+Logico | Medio-alto | M | **P1** |
| 6 | Stato filtri sparso in App.tsx (~30 useState, +14 filtri ×5 punti) | Codice | Nullo per il guest, alto per te | M | **P2** |
| 7 | Contrasto testo insufficiente (`--text3 #555` su nero → ~2.6:1) | Visivo (a11y) | Medio | S | **P2** |
| 8 | Rumore in console: 401 `refresh` da guest + meta PWA deprecato | Codice+Contesto | Basso (percezione qualità) | S | **P2** |
| 9 | Griglia renderizza tutte le ~1866 card in DOM | Codice (perf) | Basso-medio | M–L | **P2** |
| 10 | Landing: prima impressione migliorabile (claw sfocato, gerarchia) | Visivo | Medio | S–M | **P2** |
| 11 | SEO/OG/social + `llms.txt` da verificare e rifinire | Contesto | Medio (scoperta esterna) | S | **P2** |

---

## P0

### 1. I font progettati non caricano in produzione (CSP)
**Cosa:** `main.css` importa Bebas Neue / DM Sans / Space Mono via `@import url('https://fonts.googleapis.com/...')`, ma la CSP del backend (`SecurityConfig.java`) è `style-src 'self' 'unsafe-inline'; font-src 'self'`. Il browser **blocca** sia il CSS di Google sia i file font. In prod tutta la tipografia cade sui font di sistema.
**Perché conta (guest):** il wordmark "MONSTER VAULT", l'hero "1866 cans", i titoli — tutto ciò che dà carattere — è renderizzato in sans-serif generico. È la regressione visiva più grossa del sito, e colpisce il primo colpo d'occhio del guest. (Console: `Loading the stylesheet ... violates ... style-src`.)
**Fix consigliato:** **self-host** i 3 font (woff2 in `frontend/public/fonts/`, `@font-face` con `src: url('/fonts/...')`). La CSP attuale (`font-src 'self'`) li accetta già senza allentarla, sparisce la dipendenza da terzi, la PWA funziona **offline** e il caricamento è più veloce (niente round-trip a Google, niente `@import` render-blocking). *Da evitare* l'alternativa "allargo la CSP a googleapis/gstatic": indebolisce la sicurezza, aggiunge dipendenza esterna e rompe l'offline.
**Sforzo:** M. **Prio:** P0.

---

## P1

### 2. La griglia guest di default è dominata da card senza foto
**Cosa:** 1510 lattine su 1866 non hanno foto. Il placeholder è `<div className="card-img-placeholder"><span>—</span></div>` — un trattino su fondo scuro. Senza filtri attivi il guest vede una griglia in gran parte vuota.
**Perché conta:** è la schermata su cui il guest decide se il sito "vale". Muri di trattini fanno sembrare la collezione incompleta invece che ricca di 1866 pezzi.
**Fix consigliato (due leve, combinabili):**
- **Ordinamento di default sensato al guest:** mostrare prima le lattine fotografate (l'admin può avere un default diverso). Leva a basso rischio.
- **Placeholder brandizzato:** al posto di "—", una silhouette lattina/claw monocroma tenue + nome/paese ben leggibili, così anche la card senza foto comunica qualcosa.
**Sforzo:** S–M. **Prio:** P1. *(Da decidere con te: cambiare il default o solo il placeholder — vedi Domande aperte.)*

### 3. Etichette criptiche e nessun "cos'è questo"
**Cosa:** l'hero guest recita "RedMghost's Collection"; la landing spiega solo "Monster Energy archive · The Collection". Chi arriva da fuori non sa chi è RedMghost né perché guardare 1866 lattine.
**Perché conta:** è esattamente l'asse "contesto/auto-esplicazione". Una riga di copy trasforma un catalogo anonimo in una storia ("una delle più grandi collezioni Monster d'Italia/Europa, 99 paesi, ...").
**Fix consigliato:** microcopy in hero/landing (1–2 frasi, chi + scala + cosa rende speciale la raccolta); rendere "RedMghost" un'identità dichiarata anziché un handle criptico. Nessun nuovo componente.
**Sforzo:** S. **Prio:** P1.

### 4. Accent blu fuori palette
**Cosa:** l'identità è lime `#a8ff00`, ma "Full" nell'hero usa `#00b4ff` (inline in `Hero.tsx`) e il valore "TOP/TAB" nel dettaglio è blu. Due accent che competono.
**Perché conta:** coerenza cromatica = percezione di cura. Dentro il vincolo "raffina l'identità", ricondurre gli accent a un sistema (lime primario + al più un secondario intenzionale, non un blu casuale).
**Fix consigliato:** spostare il colore in una variabile CSS e decidere se "Full" merita un accent dedicato o va sul lime/neutro. Rimuovere lo stile inline.
**Sforzo:** S. **Prio:** P1.

### 5. Mobile: la filter-bar occupa tutta la prima schermata
**Cosa:** su 390px, header + hero + stats + filter-bar (search, 4 select, 5 chip, 2 range, sort, view-switch) riempiono l'intero primo viewport: il guest deve scrollare parecchio prima di vedere una lattina.
**Perché conta:** il guest prioritario spesso arriva da mobile; i filtri sono un potere che il guest raramente usa al primo impatto, ma paga il costo verticale.
**Fix consigliato:** su mobile, collassare i filtri avanzati dietro un bottone "Filtri" (search + eventualmente 1 chip sempre visibili), così le lattine salgono sopra la piega.
**Sforzo:** M. **Prio:** P1.

---

## P2

### 6. Stato dei filtri sparso in `App.tsx`
**Cosa:** `App.tsx` ha ~30 `useState`; i ~14 stati-filtro sono ripetuti in 5 punti (dichiarazione, `applyShareFilters`, `resetFilters`, `currentFilters`, effetto di restore). Aggiungere un filtro = toccare 5 posti.
**Perché conta:** zero impatto sul guest, ma è il principale attrito di manutenzione lato tuo. Un singolo oggetto `filters` (o `useReducer`) elimina la duplicazione e le occasioni di disallineamento.
**Fix consigliato:** consolidare i filtri in un unico stato/reducer. Copertura test già presente sul filtraggio → refactor sicuro. (TDD: partire dai test esistenti.)
**Sforzo:** M. **Prio:** P2.

### 7. Contrasto testo insufficiente
**Cosa:** `--text3: #555` su `--bg: #0a0a0a` ≈ 2.6:1, sotto il minimo WCAG AA (4.5:1). Usato per timestamp "Updated", sottotesti.
**Perché conta:** leggibilità + accessibilità (asse a11y del guest). Fix minimo, schiarire `--text3`.
**Sforzo:** S. **Prio:** P2.

### 8. Rumore in console
**Cosa:** (a) da guest, `GET /api/auth/refresh` risponde **401** ed è loggato come errore in console — è atteso (nessun refresh token) ma sembra un bug a chi apre i devtools. (b) `<meta name="apple-mobile-web-app-capable">` deprecato: aggiungere `<meta name="mobile-web-app-capable">`.
**Perché conta:** percezione di qualità/rifinitura; un guest tecnico (recruiter) apre i devtools.
**Fix consigliato:** trattare il 401 del refresh come stato normale (niente `console.error`); aggiornare il meta PWA in `index.html`.
**Sforzo:** S. **Prio:** P2.

### 9. La griglia monta tutte le ~1866 card
**Cosa:** `CanGrid` mappa l'intero array visibile → ~1866 nodi card in DOM (immagini lazy, ma il DOM resta pesante).
**Perché conta:** su mobile datati incide su scroll e memoria. Non urgente perché le immagini sono lazy.
**Fix consigliato:** valutare virtualizzazione (o paginazione/"load more") **solo se** si misura un problema reale — non anticiparlo.
**Sforzo:** M–L. **Prio:** P2.

### 10. Landing — prima impressione
**Cosa:** claw di sfondo molto sfocato/scuro, gerarchia tipografica che dipende dal font mancante (→ risolto in gran parte dal punto 1). Da rivalutare **dopo** aver rimesso i font.
**Fix consigliato:** rivedere spaziature/gerarchia una volta caricati i font veri; eventuale rifinitura del trattamento claw/wordmark.
**Sforzo:** S–M. **Prio:** P2 (dipende da #1).

### 11. SEO / OG / social / llms.txt
**Cosa:** il README dichiara robots/sitemap/llms.txt/JSON-LD/OG su `/share/{id}`. Da verificare che i tag OG/Twitter producano un'anteprima ricca quando si condivide un link (title, descrizione, immagine lattina) e che il copy sia allineato al punto 3.
**Perché conta:** è "contesto/presentabilità esterna": una preview social curata è marketing gratuito del portfolio.
**Fix consigliato:** verificare/rifinire i meta OG e la descrizione; allineare al nuovo copy identitario.
**Sforzo:** S. **Prio:** P2.

---

## Domande aperte (da decidere prima di implementare)

- **#2 — default guest:** cambiamo l'ordinamento/filtro di default per mostrare prima le lattine con foto, o teniamo il default e miglioriamo solo il placeholder? (Il primo ha più impatto ma "nasconde" la scala reale della collezione.)
- **#3 — identità "RedMghost":** quanto vuoi esporti? (nome reale + storia, oppure solo l'handle con una riga di contesto.)
- **#4 — accent "Full":** merita un colore dedicato (e quale, dentro l'identità), o lo riportiamo a lime/neutro?

## Ordine di attacco consigliato

1. **#1 font** (sblocca #10 e metà dell'impatto visivo).
2. **#3 copy** + **#4 accent** + **#7 contrasto** (tutti S, alto rapporto valore/sforzo, zero rischio).
3. **#2 griglia guest** + **#5 filtri mobile** (il grosso dell'esperienza guest).
4. **#8 console** (rifinitura rapida).
5. **#6 refactor filtri** quando tocchi comunque i filtri per #2/#5.
6. **#9 / #11** solo se/quando servono.
