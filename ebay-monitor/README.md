# Monster Energy — eBay Monitor 🥤📡

Radar che avvisa su **Telegram** quando spunta un **nuovo annuncio eBay** di una lattina
Monster che ti interessa, su **più mercati**, in tempo reale.

Vive in `ebay-monitor/` dentro il repo del sito, ma è un tool **separato**: il `Dockerfile`
copia solo `pom.xml`+`src/`, quindi **non** fa parte dell'app deployata su Render.

---

## Come funziona — due modalità

**A — ricerca per NOME (ATTIVA).** Per ogni voce in `SEARCH_QUERIES`, su ogni mercato in
`EBAY_MARKETPLACES`, cerca gli annunci *appena listati* e ti notifica i **nuovi** su
Telegram. Niente confronto foto: immediato e gratis, ma **più rumoroso** (scremi tu).

**B — verifica FOTO / VLM (SPENTA, idea nel cassetto).** Se `USE_VLM=True`, prima di
notificare un candidato confronta la sua **foto** con le tue lattine flaggate
(`watch=true` sul sito + `rare_cans/`) tramite un modello multimodale Anthropic, e
notifica **solo i match** → isola la variante esatta (es. *Assault old camo* vs *2023*).
Richiede una API key Anthropic (vedi sotto).

---

## Ricerca: SEMPRE "Monster Energy" + keyword (non frase esatta)

Ogni voce di `SEARCH_QUERIES` è `monster energy <keyword>`: eBay matcha tutte le parole nel
titolo, in qualsiasi ordine (NON la frase esatta). Così esce **solo Monster Energy** — non
Pokémon / Monster High / Jam / Truck.

⚠️ eBay **non** è un AND rigido: lascia passare qualche titolo con "monster" ma senza
"energy" (es. *"…Scooby Doo… Monster #160 2008"*). Per questo c'è un secondo paletto
**lato client**, `REQUIRE_WORDS = ["monster", "energy"]`: un annuncio è notificato **solo se
il titolo le contiene tutte**. Svuota la lista (`[]`) per disattivarlo.

- `monster energy khaos` → prende anche il lotto *"Monster Energy Trio Mixxd, M80, Khaos"*
- Per **restringere** aggiungi parole (`monster energy assault camo`).

## Ricerca generica

In `_KEYWORDS` c'è anche `""` (stringa vuota) → genera la ricerca **`monster energy`** secca:
pesca *tutto* il Monster Energy recente (lattine comuni + merch). Molto volume — toglila se
diventa troppo rumore.

## ⏱️ Solo annunci freschi

`MAX_LISTING_AGE_HOURS = 2.5` → eBay filtra lato server (`itemStartDate`) e manda **solo gli
annunci listati nelle ultime ~2,5 ore**. `POLL_INTERVAL_SECONDS` (default **2h**) **deve restare
< della finestra**: controlla ogni 2h guardando 2,5h indietro → ~30 min di margine (per il
ritardo di indicizzazione di eBay) e nessun buco. Alza la finestra per più copertura; `None` la toglie.

## Anti-rumore (`EXCLUDE_WORDS`)

Scarta i titoli che contengono certe parole (confronto **case-insensitive**: "SUPERCROSS" =
"Supercross" = "supercross"). Categorie bannate: altri brand *Monster*, carte (Pokémon/TCG),
**ricambi moto** (`clutch`/`bearing`/`caliper`/`fits kawasaki`/`dcor`/`graphic`…), **fumetti/anime/
cartoon** (`doujinshi`/`evangelion`/`disney`/`big into energy`), **modellini & motorsport**
(`nascar`/`diecast`/`1:24`/`panini`/`autografo`…), **abbigliamento** (anche IT: `felpa`/`maglietta`/
`canotta`/`hoodie`/`t-shirt`/cappelli) e **bundle/multipack** (`pack`/`case of`/`" x 500"`/
`lattine da 500`). ⚠️ `pack` e `lattine da 500` escludono anche i multipack di lattine; le singole passano.

## ⚠️ Budget chiamate eBay

```
chiamate/giorno ≈ n_query × n_mercati × (86400 / POLL_INTERVAL_SECONDS)
```
Default: **26 × 6 × 12 ≈ 1.870/giorno** (sotto il limite tipico ~5.000 della Browse API).
Mercati: **IT/DE/US/CA/GB/AU** (`EBAY_IT` mostra già le inserzioni internazionali che spediscono
in Italia; `EBAY_DE` aggiunge il grande mercato europeo). `POLL_INTERVAL_SECONDS` (default
**2h**) deve restare < della finestra. Se **aggiungi query o mercati** alza il polling o
togline, altrimenti sfori e le chiamate iniziano a fallire. Verifica il tuo limite eBay.

## ⚡ Velocità, timer e standby

- **Ricerca in parallelo** (`PARALLEL_SEARCH = True`, `PARALLEL_WORKERS = 8`): le richieste ai
  mercati partono insieme → un giro completo in **~40 s** invece di ~4 min. Metti
  `PARALLEL_SEARCH = False` per tornare al sequenziale (avanzamento mercato per mercato).
- **Timer**: durante l'attesa vedi un countdown `⏳ prossimo giro tra MM:SS`. È basato
  sull'orario di scadenza → se il PC si sospende, al risveglio riparte subito.
- **Anti-standby**: mentre gira, il monitor impedisce la **sospensione automatica** del PC
  (Windows). ⚠️ NON blocca la sospensione **manuale** (se premi *Sospendi* o chiudi il coperchio
  il PC dorme e il monitor si ferma fino al risveglio). Per un H24 vero → server.

## 🗑️ Comando /delete (Telegram)

Mentre il monitor gira, nella chat col bot puoi scrivere **`/delete`**: il bot cancella i
**propri** messaggi recenti (e rimuove anche il tuo `/delete`), poi conferma con
`🗑️ Cancellati N messaggi`. Compare anche nel menu ☰ del bot.

⚠️ Limiti di **Telegram**: un bot può eliminare **solo i propri** messaggi e **solo se
inviati da < 48 ore**, e solo **mentre il monitor è in esecuzione**. Scandaglia gli ultimi
`DELETE_SCAN_BACK` (300) messaggi a ritroso.

---

## Setup

```bat
copy config.example.py config.py    :: poi compila config.py (chiavi eBay + Telegram)
installa.bat                        :: pip install -r requirements.txt
avvia_monitor.bat                   :: avvia il monitoraggio continuo
```
Servono: keyset **Production** eBay (Client ID + Cert ID) e un bot Telegram (token + chat id).

## Uso

- **`avvia_monitor.bat`** — monitoraggio continuo. Al 1° avvio fa la **baseline** (segna gli
  annunci già online come "visti", senza notificarli) → poi notifica **solo i nuovi** a ogni giro.
- **`py ebay_monitor.py --send-now [N]`** — one-shot: manda **subito** gli annunci attuali
  (max N per ricerca, default 10). Utile per testare.
- **`test_subito.bat`** — doppio click: manda subito gli annunci dell'ultima ora (test rapido).
- ⚠️ **Gira sul tuo PC**: tienilo **acceso** (non premere *Sospendi*). Il monitor blocca lo
  standby automatico, ma non quello manuale. Per un 24/7 vero → server.

## Attivare la modalità B (VLM)

1. `pip install anthropic`
2. `config.ANTHROPIC_API_KEY = "..."` (console.anthropic.com)
3. `config.USE_VLM = True`

Userà le lattine `watch=true` sul sito + `rare_cans/` come riferimento foto. Costo indicativo
~$0.003 per annuncio verificato. La funzione `vlm_match()` in `ebay_monitor.py` è uno
**scheletro**: rifinisci la prompt/confronto al primo utilizzo reale.

---

## File

| File | Ruolo |
|------|-------|
| `ebay_monitor.py` | Logica: Browse API + loop + Telegram + scheletro VLM. Non modificare. |
| `config.py` | Impostazioni + **SEGRETI** (gitignored). L'unico da editare. |
| `config.example.py` | Template versionato (senza segreti). |
| `avvia_monitor.bat` · `test_subito.bat` · `installa.bat` · `requirements.txt` | Avvio continuo · test rapido · install · dipendenze (Windows). |
| `rare_cans/` | Foto di riferimento locali (per B / lattine mancanti) — vedi `rare_cans/README.txt`. |
| `clip_check.py` · `dino_check.py` · `ocr_check.py` | Esperimenti: CLIP/DINOv2/OCR **falliti** nel distinguere le lattine (tenuti come storia). |
| `seen_listings.db` | Stato runtime anti-duplicati (gitignored). |

## Note tecniche

- **eBay**: Browse API, OAuth client-credentials (token in cache). Indipendente dall'indirizzo
  dell'account → vede anche annunci "solo spedizione USA".
- **Niente CLIP**: il match per somiglianza non distingue le Monster (testato: CLIP e DINOv2
  ~96–100% falsi positivi, OCR ~56%). La **precisione** arriva dalla modalità B (VLM).
- **Console Windows**: gli emoji richiedono `chcp 65001` (già nella `.bat`) + stdout UTF-8
  (già nel codice).
