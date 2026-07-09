# Monster Energy — eBay Monitor 🥤📡

Radar che avvisa su **Telegram** quando spunta un **nuovo annuncio eBay** di una lattina
Monster che ti interessa, su **più mercati**. Gira **in cloud, gratis** su GitHub Actions,
con lo stato su **MongoDB Atlas** — nessun PC da tenere acceso. Il workflow parte **ogni 5 min**
(per eseguire in fretta i comandi Telegram), ma la **ricerca eBay** è limitata a **~ogni 2h**.

Vive in `ebay-monitor/` dentro il repo del sito, ma è un tool **separato**: non fa parte
dell'app Java deployata su Render. Il suo workflow è `.github/workflows/ebay-monitor.yml`.

---

## Come funziona

Ogni 5 min il workflow lancia `ebay_monitor.py`, che fa **un giro solo** ed esce:

1. **Connette MongoDB** (stato anti-duplicati + blacklist dinamica). Se il DB è irraggiungibile,
   **salta il giro** e avvisa su Telegram (non processa nulla, per non rifare la baseline).
2. **Drena i comandi Telegram** (`/add`, `/list`, `/delete`) — **a ogni giro** (ogni ~5 min),
   così i comandi rispondono in fretta.
3. **Solo se** sono passate ~2h dall'ultima ricerca (`SWEEP_INTERVAL_SECONDS`, timestamp su Mongo):
   per ogni `SEARCH_QUERIES` × `EBAY_MARKETPLACES` cerca gli annunci **appena listati** e notifica i
   **nuovi** su Telegram. Altrimenti il giro fa solo il punto 2 ed esce (niente chiamate eBay).

Perché così: i comandi devono rispondere in fretta (5 min), ma la ricerca eBay va tenuta a ~2h per
non sforare il budget chiamate. Il repo è **pubblico** → i minuti GitHub Actions sono gratis, quindi
girare ogni 5 min non costa nulla.

Ricerca **per NOME**: ogni query è `monster energy <keyword>` (eBay matcha tutte le parole in
qualsiasi ordine, non la frase esatta) → esce solo Monster Energy, non Pokémon / Monster High.
Niente confronto foto: il riconoscimento immagine (CLIP/DINOv2/OCR **e** VLM) è stato testato e
**non distingue le varianti di lattina** → rimosso. Il rumore lo scremi tu, curando la blacklist.

## ⏱️ Finestra temporale

`MAX_LISTING_AGE_HOURS = 3.5` → eBay manda solo gli annunci listati nelle ultime ~3,5h. La ricerca
gira ~ogni 2h, quindi c'è ~1,5h di margine: serve perché **i cron di GitHub Actions non partono
all'orario esatto** (slittano di minuti, a volte saltano un giro). Il margine assorbe i ritardi;
gli eventuali duplicati sono già filtrati dallo stato su Mongo.

## Anti-rumore: la blacklist

Un annuncio è scartato se il titolo contiene una parola/frase della blacklist (case-insensitive).
La blacklist è **base statica + aggiunte dinamiche**, unite a runtime:

- **`blacklist.txt`** (versionato): la lista curata di base (~210 voci: altri brand *Monster*,
  carte, ricambi moto, abbigliamento, modellini, bundle…). Una voce per riga, `#` per i commenti.
  ⚠️ Gli spazi iniziali/finali sono **significativi** (`" hat"` evita di matchare dentro "that";
  `"atv "` idem) — non strapparli: `test_ebay_monitor.py` fa da canary.
- **Collection `ebay_blacklist`** su Mongo: le parole aggiunte al volo con `/add` dalla chat.

Le parole obbligatorie sono `REQUIRE_WORDS = ["monster", "energy"]`: un annuncio passa solo se le
contiene entrambe (eBay non fa un AND stretto).

## 🤖 Comandi Telegram

Vengono eseguiti al **giro successivo** (~5–15 min: i cron di GitHub slittano, non c'è un processo
sempre acceso). Un **messaggio fissato** in cima alla chat lo ricorda; è protetto dal `/delete` e si
rigenera da solo se sparisce. I comandi sono idempotenti.

- **`/add parola`** — aggiunge `parola` alla blacklist dinamica (Mongo). Guardia: rifiuta vuoto,
  parole <2 caratteri e le parole obbligatorie (`monster`/`energy`, che accecherebbero il radar).
  Conferma in chat: *"✅ aggiunto 'camicia' (ora N parole dinamiche)"*.
- **`/list`** — stampa le parole aggiunte con `/add`. Per versionarle, incollale a mano in fondo a
  `blacklist.txt` (il sync file↔Mongo è **manuale**, per scelta).
- **`/delete`** — cancella i messaggi del bot (Telegram permette solo i **propri**, < 48h).

## ⚠️ Budget chiamate eBay

```
chiamate/giorno ≈ n_query × n_mercati × (24 / 2h) = 26 × 6 × 12 ≈ 1.870/giorno
```
Sotto il limite tipico (~5.000/giorno della Browse API). Se aggiungi query o mercati, ricontrolla.

---

## Setup (una tantum)

Il monitor gira su GitHub Actions e legge i segreti dalle **Secrets del repo**
(*Settings → Secrets and variables → Actions*). Servono 5 Secret:

| Secret | Cos'è |
|--------|-------|
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Keyset **Production** della Browse API eBay |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot Telegram (token da @BotFather + chat id) |
| `MONGODB_URI` | URI di MongoDB Atlas (stesso cluster del sito; il monitor usa collection dedicate `ebay_seen`/`ebay_blacklist`/`ebay_meta`, **non** tocca `cans`) |

Nessun altro setup: il workflow installa le dipendenze e parte da solo ogni 5 min.

## Uso

- **Automatico**: ogni 5 min via `schedule` (drain comandi); la ricerca eBay scatta ~ogni 2h. Al
  **primo giro** con Mongo vuoto fa la **baseline** (segna gli annunci già online come "visti", senza
  notificarli) → poi notifica solo i nuovi.
- **Test on-demand**: *Actions → eBay Monitor → Run workflow*. Spunta **`send_now`** per farti
  mandare subito gli annunci attuali (ignora i già-visti), altrimenti fa un giro normale.

## Test / sviluppo locale

```bash
py test_ebay_monitor.py     # logica pura (blacklist, filtri, comandi) — niente rete/Mongo
```
Per un giro reale in locale: crea `config.py` con i 5 segreti (è gitignored) ed esporta le stesse
variabili d'ambiente prima di lanciare `py ebay_monitor.py --send-now 5`.

---

## File

| File | Ruolo |
|------|-------|
| `ebay_monitor.py` | Logica: Mongo + Browse API + filtri + Telegram + comandi. |
| `settings.py` | Config **non-segreta** versionata (query, mercati, finestra). |
| `blacklist.txt` | Blacklist di base (versionata). Le aggiunte `/add` vivono su Mongo. |
| `test_ebay_monitor.py` | Test della logica pura + canary spazi blacklist. |
| `requirements.txt` | Dipendenze (`requests`, `pymongo`). |
| `config.py` | **Solo locale** (gitignored): segreti per i test manuali. |

## Note tecniche

- **eBay**: Browse API, OAuth client-credentials (token in cache). Indipendente dall'indirizzo
  dell'account → vede anche annunci "solo spedizione USA".
- **Stato su Mongo**: `ebay_seen` (anti-duplicati, `_id` = itemId) e `ebay_blacklist` (aggiunte
  `/add`, `_id` = parola). Upsert idempotenti: riprocessare un comando non crea doppioni.
- **Perché niente foto**: CLIP/DINOv2 ~96–100% falsi positivi, OCR ~56%, e il VLM non regge le
  varianti. La precisione arriva dalla curatela manuale della blacklist.
