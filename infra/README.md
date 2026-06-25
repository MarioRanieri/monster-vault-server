# 🏗️ Infrastructure as Code — Terraform + GCP Cloud Run

Infrastruttura di Monster Vault descritta **come codice** con Terraform: invece di cliccare nella
console GCP, definiamo lo stato voluto in file `.tf` e Terraform lo crea/aggiorna/distrugge.

```
docker build → push su Artifact Registry → terraform apply → app online su *.run.app
```

| File | Cosa |
|---|---|
| `versions.tf` | Versione Terraform + provider `google` |
| `variables.tf` | Input (project_id, region, image…) |
| `main.tf` | API GCP, **Artifact Registry**, servizio **Cloud Run**, IAM pubblico |
| `outputs.tf` | URL del servizio + path del registry |
| `terraform.tfvars.example` | Template dei valori → copia in `terraform.tfvars` (gitignored) |

## ✅ Validazione "a secco" (zero costi, niente account)
Non crea nulla: controlla solo che il config sia corretto.
```bash
cd infra
terraform init        # scarica il provider google (serve solo internet)
terraform validate    # ✅ config valido?  (nessuna credenziale, nessuna risorsa creata)
terraform fmt -check   # formattazione
```

## ▶️ Deploy reale (quando vorrai — richiede account GCP con billing)
```bash
gcloud auth application-default login        # autenticazione
cp terraform.tfvars.example terraform.tfvars # poi metti i tuoi valori

terraform plan        # anteprima: cosa creerà (non tocca nulla)

# Costruisci e pusha l'immagine nel registry creato da Terraform:
gcloud auth configure-docker europe-west1-docker.pkg.dev
docker build -t europe-west1-docker.pkg.dev/PROJECT/monster-vault/app:latest .
docker push   europe-west1-docker.pkg.dev/PROJECT/monster-vault/app:latest

terraform apply       # crea davvero → stampa l'URL *.run.app
terraform destroy     # smonta tutto (per non lasciare risorse attive)
```

## 🔐 Segreti (NON nelle env in chiaro)
JWT secret, Cloudinary e la connection string MongoDB (`SPRING_DATA_MONGODB_URI`) vanno in **Secret Manager**, referenziati così nel
container di `main.tf`:
```hcl
env {
  name = "APP_JWT_SECRET"
  value_source {
    secret_key_ref {
      secret  = "app-jwt-secret"   # nome del secret in Secret Manager
      version = "latest"
    }
  }
}
```

## 💸 Costi
**Cloud Run** scala **a zero** quando inattivo e ha un free tier generoso (~2M richieste/mese):
per un progetto come questo è in pratica **~€0**. I nuovi account GCP hanno **$300 di credito**.
Serve però abilitare il billing (carta). La validazione "a secco" qui sopra è invece **gratis**.

> 💡 **Cloud Run vs Kubernetes** (vedi `k8s/`): due modi di far girare lo stesso container.
> Cloud Run = serverless gestito da Google. Kubernetes/GKE = orchestrazione che gestisci tu.
