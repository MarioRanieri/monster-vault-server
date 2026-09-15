# Monster Energy — eBay Monitor 🥤📡

Radar che avvisa su **Telegram** quando spunta un **nuovo annuncio eBay** di una lattina
Monster che ti interessa, su **più mercati**. Due parti separate, gratis, nessun PC da
tenere acceso:

- **Ricerca eBay**: gira **in cloud su GitHub Actions**, **ogni ora**, stato su
  **MongoDB Atlas**. Workflow: `.github/workflows/ebay-monitor.yml`.
- **Comandi Telegram** (`/add /list /market /delete`): gira su un **secondo Web Service
  Render**, separato dal sito principale — riceve un **webhook** da Telegram e risponde
  **istantaneamente**, niente attesa di un giro cron. Codice: `webhook_app.py`.

Vivono entrambi in `ebay-monitor/` dentro il repo del sito, ma sono tool **separati**: non
fanno parte dell'app Java deployata su Render (root directory diversa, deploy indipendente).

---

## Come funziona

**Ricerca eBay** (`ebay_monitor.py`, GitHub Actions, ogni ora): un giro solo ed esce.

1. **Connette MongoDB** (stato anti-duplicati). Se il DB è irraggiungibile, **salta il giro** e
   avvisa su Telegram (non processa nulla, per non rifare la baseline).
2. **Solo se** è passata ~1h dall'ultima ricerca (`SWEEP_INTERVAL_SECONDS`, timestamp su Mongo,
   gate di sicurezza — il cron è già orario): per ogni `SEARCH_QUERIES` × `EBAY_MARKETPLACES`
   cerca gli annunci **appena listati** e notifica i **nuovi** su Telegram.

**Comandi Telegram** (`webhook_app.py`, servizio Render separato, sempre in ascolto): Telegram
chiama l'endpoint `/telegram-webhook` **nell'istante** in cui arriva un comando — niente attesa
di un giro cron. Unico limite: come il sito, il servizio gratuito Render si addormenta se
inattivo, quindi il primissimo comando dopo una pausa lunga ha un cold-start di ~30-50s prima
della risposta (Telegram ritenta la consegna finché non risponde).

Ricerca **per NOME**: ogni query è `monster energy <keyword>` (eBay matcha tutte le parole in
qualsiasi ordine, non la frase esatta) → esce solo Monster Energy, non Pokémon / Monster High.
Niente confronto foto: il riconoscimento immagine (CLIP/DINOv2/OCR **e** VLM) è stato testato e
**non distingue le varianti di lattina** → rimosso. Il rumore lo scremi tu, curando la blacklist.

## ⏱️ Finestra temporale

`MAX_LISTING_AGE_HOURS = 2` → eBay manda solo gli annunci listati nelle ultime ~2h. La ricerca
gira ogni 1h, quindi c'è ~1h di margine per il drift naturale dei cron GitHub Actions (minuti,
non più le ore osservate col vecchio schedule `*/5 * * * *` — vedi lo spec di design). Gli
eventuali duplicati residui sono comunque filtrati dallo stato su Mongo.

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

Rispondono **istantaneamente** (webhook, vedi sopra) — eccetto il primissimo comando dopo una
pausa lunga, che ha un cold-start di ~30-50s (servizio Render gratuito). I comandi sono
idempotenti.

- **`/add parola`** — aggiunge `parola` alla blacklist dinamica (Mongo). Guardia: rifiuta vuoto,
  parole <2 caratteri e le parole obbligatorie (`monster`/`energy`, che accecherebbero il radar).
  Conferma in chat: *"✅ aggiunto 'camicia' (ora N parole dinamiche)"*.
- **`/list`** — stampa le parole aggiunte con `/add`. Per versionarle, incollale a mano in fondo a
  `blacklist.txt` (il sync file↔Mongo è **manuale**, per scelta).
- **`/market`** — gestisce i mercati eBay cercati, con stato dinamico su Mongo (default in
  `settings.EBAY_MARKETPLACES`, override su Mongo — stessa filosofia base+dinamico della blacklist):
  - **`/market`** (senza argomenti) — elenca i mercati attivi.
  - **`/market remove uk`** — disattiva un mercato (accetta sigla paese `uk`/`it`/`de`… o ID pieno
    `EBAY_GB`). Rifiuta la rimozione dell'ultimo mercato.
  - **`/market add fr`** — aggiunge un mercato tra quelli validi per la Browse API
    (vedi `settings.MARKET_ALIASES`). Riattivare un default rimosso: stesso comando.
- **`/delete`** — cancella i messaggi del bot (Telegram permette solo i **propri**, < 48h).

## ⚠️ Budget chiamate eBay

```
chiamate/giorno ≈ n_query × n_mercati × (24 / 1h) = 26 × 6 × 24 ≈ 3.744/giorno
```
Sotto il limite tipico (~5.000/giorno della Browse API, verificato 2026), ma più vicino al tetto
di prima (era ~1.870/giorno a sweep ogni 2h) — se aggiungi query o mercati, ricontrolla con più
margine di prima.

---

## Setup (una tantum)

**Ricerca eBay** (GitHub Actions) legge i segreti dalle **Secrets del repo**
(*Settings → Secrets and variables → Actions*). Servono 5 Secret:

| Secret | Cos'è |
|--------|-------|
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Keyset **Production** della Browse API eBay |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot Telegram (token da @BotFather + chat id) |
| `MONGODB_URI` | URI di MongoDB Atlas (stesso cluster del sito; il monitor usa collection dedicate `ebay_seen`/`ebay_blacklist`/`ebay_meta`, **non** tocca `cans`) |

Nessun altro setup lato GitHub: il workflow installa le dipendenze e parte da solo ogni ora.

**Comandi Telegram** (secondo Web Service Render, separato dal sito):

1. Crea un nuovo Web Service su Render, root directory `ebay-monitor/`, start command
   `gunicorn webhook_app:app --bind 0.0.0.0:$PORT --threads 4 --timeout 120`.
2. Env vars sul servizio: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONGODB_URI` (stessi valori
   dei Secret GitHub sopra — store separati, vanno copiati) + `TELEGRAM_WEBHOOK_SECRET` (nuovo,
   generato una tantum, es. `openssl rand -hex 32`).
3. Una volta deployato, registra il webhook su Telegram (una tantum):
   ```
   curl https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url=https://<nome-servizio>.onrender.com/telegram-webhook \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```

## Uso

- **Automatico**: la ricerca eBay scatta ogni ora via `schedule`. Al **primo giro** con Mongo
  vuoto fa la **baseline** (segna gli annunci già online come "visti", senza notificarli) → poi
  notifica solo i nuovi. I comandi Telegram rispondono da soli, istantaneamente, appena scrivi in
  chat (nessuna azione da fare su GitHub per quelli).
- **Test on-demand**: *Actions → eBay Monitor → Run workflow*. Spunta **`send_now`** per farti
  mandare subito gli annunci attuali (ignora i già-visti), altrimenti fa un giro normale.

## Test / sviluppo locale

```bash
py test_ebay_monitor.py     # logica sweep pura (blacklist, filtro titoli) — niente rete/Mongo
py test_bot_logic.py        # logica comandi pura (parsing, mercati, budget) — niente rete/Mongo
py test_webhook_app.py      # handler webhook (Flask test client) — Store e Telegram mockati
```
Per un giro reale in locale: crea `config.py` con i segreti (è gitignored) ed esporta le stesse
variabili d'ambiente prima di lanciare `py ebay_monitor.py --send-now 5`. Per il webhook in
locale: `py webhook_app.py` (dev server Flask su `:5000`).

---

## File

| File | Ruolo |
|------|-------|
| `ebay_monitor.py` | Sweep: Mongo + Browse API + filtri + notifica Telegram. GitHub Actions, ogni ora. |
| `webhook_app.py` | Comandi Telegram via webhook, istantanei. Servizio Render separato. |
| `bot_logic.py` | Condiviso da entrambi: `Store` (Mongo) + logica comandi/mercati pura. |
| `settings.py` | Config **non-segreta** versionata (query, mercati, finestra, cadenza sweep). |
| `blacklist.txt` | Blacklist di base (versionata). Le aggiunte `/add` vivono su Mongo. |
| `test_ebay_monitor.py` | Test della logica sweep pura + canary spazi blacklist. |
| `test_bot_logic.py` | Test della logica comandi/mercati pura. |
| `test_webhook_app.py` | Test dell'handler webhook (Flask test client, Mongo/Telegram mockati). |
| `requirements.txt` | Dipendenze (`requests`, `pymongo`, `flask`, `gunicorn`). |
| `config.py` | **Solo locale** (gitignored): segreti per i test manuali. |

## Note tecniche

- **eBay**: Browse API, OAuth client-credentials (token in cache). Indipendente dall'indirizzo
  dell'account → vede anche annunci "solo spedizione USA".
- **Stato su Mongo**: `ebay_seen` (anti-duplicati, `_id` = itemId) e `ebay_blacklist` (aggiunte
  `/add`, `_id` = parola). Upsert idempotenti: riprocessare un comando non crea doppioni.
- **Perché niente foto**: CLIP/DINOv2 ~96–100% falsi positivi, OCR ~56%, e il VLM non regge le
  varianti. La precisione arriva dalla curatela manuale della blacklist.
