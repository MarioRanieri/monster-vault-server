# ☸️ Kubernetes (deploy locale)

Manifest per far girare Monster Vault su **Kubernetes** in locale (minikube/kind). L'app è già
containerizzata (vedi `Dockerfile`): qui descriviamo lo **stato desiderato** e K8s lo mantiene.

| File | Cos'è |
|---|---|
| `deployment.yaml` | **Deployment**: N copie (pod) dell'app, auto-restart, probe di salute |
| `service.yaml` | **Service**: indirizzo di rete stabile + load balancing verso i pod sani |
| `configmap.yaml` | **ConfigMap**: configurazione NON segreta (env) |
| `secret.example.yaml` | Template del **Secret** (segreti) → copia in `secret.yaml` (gitignored) |

## Avvio (minikube)

```bash
# 1. Avvia il cluster locale
minikube start

# 2. Costruisci l'immagine e caricala nel cluster (così non serve un registry)
docker build -t monster-vault:local .
minikube image load monster-vault:local

# 3. Configura i segreti: copia il template e mettici i valori veri
cp k8s/secret.example.yaml k8s/secret.yaml     # poi EDITA k8s/secret.yaml
#    (e controlla i valori in k8s/configmap.yaml)

# 4. Applica i manifest (= "porta il cluster a questo stato")
kubectl apply -f k8s/configmap.yaml -f k8s/secret.yaml -f k8s/deployment.yaml -f k8s/service.yaml

# 5. Apri l'app (minikube apre il browser sul Service)
minikube service monster-vault
```

## Comandi utili (da sapere a colloquio)
```bash
kubectl get pods                       # stato dei pod (Running? Ready 1/1?)
kubectl logs -f deploy/monster-vault   # log in tempo reale
kubectl describe pod <nome-pod>        # eventi/errori (utile se il pod non parte)
kubectl rollout restart deploy/monster-vault   # riavvio controllato
kubectl scale deploy/monster-vault --replicas=3 # scala a 3 copie → K8s le crea e bilancia
kubectl delete -f k8s/                 # rimuove tutto
```

## Concetti chiave
- **Pod** = la più piccola unità eseguibile (1+ container). Il Deployment li crea/sostituisce.
- **Deployment** = stato desiderato + auto-healing + rollout/rollback.
- **Service** = rete stabile davanti a pod effimeri (gli IP dei pod cambiano).
- **ConfigMap / Secret** = config e segreti FUORI dall'immagine (stessa immagine in dev/prod, cambia solo la config).
- **Probe** = K8s interroga `/actuator/health` (l'endpoint dell'observability!): se *readiness* fallisce smette di mandargli traffico; se *liveness* fallisce **riavvia** il pod.

> 💡 È un deploy **didattico in locale** (minikube). In produzione il sito gira su Render;
> questi manifest dimostrano la conoscenza di Kubernetes end-to-end.
