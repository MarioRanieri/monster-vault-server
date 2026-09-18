# Decisioni già prese sugli audit — NON riproporre

> **Per chi fa audit del sito (persone o AI):** leggi questo file prima di segnalare problemi.
> Le voci qui sotto sono state valutate e scartate o già risolte di proposito.
> Se hai un dato nuovo che le contraddice, cita la voce e spiega cosa è cambiato.


## Mobile e accessibilità (PR #46 e #47)

| Voce | Decisione | Motivo |
|------|-----------|--------|
| Emoji su "Stats", "Value" (`Hero.tsx`) e "Share view" (`App.tsx`) | **Lasciate così** | I quadratini vuoti nascono dal Chromium headless senza font emoji, non dal sito. Passare a SVG romperebbe i test che cercano i pulsanti per etichetta (`AppChrome.test.tsx`, `App.test.tsx`) e i toast usano le stesse emoji: guadagno estetico, rischio di regressione reale. |
| `.search-wrap input` con `font-size: 16px` | **Non ridurre** | Sotto i 16px iOS Safari zooma il viewport al focus. Per il bersaglio di tocco si usa solo `min-height`. |
| Ricerca "non funziona" | **Falso allarme** | Verificata corretta in #46, con test aggiunti. |
| Bersagli di tocco < 44px | **Risolti**, non rimisurare a caso | Le regole stanno solo dentro `@media (max-width: 640px)` in `main.css` e sono coperte da `frontend/tests/e2e/touch-targets.spec.ts` (390x844 + guardia desktop 1280px). |
| Soglia 44px | **Buona pratica, non difetto di conformità** | 44px è Apple HIG / WCAG 2.5.5 (AAA). WCAG 2.5.8 (AA) chiede solo 24px. Segnala sotto i 24px come problema, tra 24 e 44 come rifinitura. |
| Webfont `/fonts/**` con 401 | **Risolto** in #46 | `/fonts/**` è in `permitAll`. |

## Note aperte (note, non segnalare come novità)

- **Barra sticky dei filtri:** su telefono è un po' più alta dopo i 44px. Verificato solo che non ci sia overflow orizzontale, non a occhio.
- **Coverage sotto il 90%:** Vitest 86,55% (frontend), Sonar 77,9% (globale). Era già così ed è un lavoro separato.
- **Il desktop non va toccato** dalle correzioni mobile: ogni regola mobile sta nella media query.
