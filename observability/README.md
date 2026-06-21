# 📊 Observability — Prometheus + Grafana

Stack locale per **monitorare** Monster Vault: l'app espone le metriche (Spring Boot Actuator +
Micrometer su `/actuator/prometheus`), **Prometheus** le raccoglie nel tempo, **Grafana** le disegna.

```
App Spring (/actuator/prometheus)  ──scrape ogni 5s──▶  Prometheus  ──query──▶  Grafana (dashboard)
```

> 🔒 **`/actuator/prometheus` è protetto da password** (HTTP Basic). `/actuator/health` e
> `/actuator/info` restano pubblici. Credenziali via env: `METRICS_USER` (default `metrics`) e
> `METRICS_PASSWORD`. In locale il `prometheus.yml` usa `metrics` / `dev`, quindi avvia l'app con
> `METRICS_PASSWORD=dev`. In produzione (Render) imposta le stesse env e mettile nel job `-prod`.

## Avvio (3 passi)

1. **Avvia l'app** (in un terminale, dalla root del progetto):
   ```bash
   METRICS_PASSWORD=dev ./mvnw spring-boot:run    # gira su http://localhost:8080
   ```
2. **Avvia lo stack** (in un altro terminale):
   ```bash
   cd observability
   docker compose up -d
   ```
3. Apri:
   - **Grafana** → http://localhost:3001  (login: `admin` / `admin`)
   - **Prometheus** → http://localhost:9090  (in *Status → Targets* il job `monster-vault-local` dev'essere **UP**)

Stop: `docker compose down`

## Dashboard pronta in 30 secondi
In Grafana: **Dashboards → New → Import → ID `4701` → Load → seleziona il datasource Prometheus**.
È la dashboard ufficiale **JVM (Micrometer)**: memoria, CPU, thread, GC, richieste HTTP — tutto pronto.

## Qualche query PromQL (per costruire pannelli tuoi)
| Cosa vuoi vedere | Query |
|---|---|
| Richieste al secondo | `rate(http_server_requests_seconds_count[1m])` |
| Latenza media per endpoint | `rate(http_server_requests_seconds_sum[1m]) / rate(http_server_requests_seconds_count[1m])` |
| Errori 5xx al secondo | `rate(http_server_requests_seconds_count{status=~"5.."}[1m])` |
| Memoria heap usata | `jvm_memory_used_bytes{area="heap"}` |
| CPU del processo | `process_cpu_usage` |

> 💡 `rate(...[1m])` = "quanto è cresciuto il contatore al secondo, mediato sull'ultimo minuto".
> I contatori salgono e basta; `rate()` li trasforma in "al secondo", che è ciò che vuoi nei grafici.

## Monitorare la PRODUZIONE
1. Su Render → **Environment** aggiungi `METRICS_PASSWORD` (e opzionalmente `METRICS_USER`).
2. In `prometheus.yml` decommenta il job `monster-vault-prod` e incolla la stessa password nel
   blocco `basic_auth`. Riavvia: `docker compose restart prometheus`.

L'app è già esposta su HTTPS; ora lo scrape passa autenticato.
