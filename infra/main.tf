# Infrastruttura Monster Vault su GCP, come codice (IaC).
# Crea: API abilitate -> Artifact Registry (magazzino immagini) -> servizio Cloud Run (serverless).

# 1) Abilita le API GCP necessarie
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# 2) Artifact Registry = il "magazzino" delle immagini Docker su GCP
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "monster-vault"
  format        = "DOCKER"
  description   = "Immagini Docker di Monster Vault"
  depends_on    = [google_project_service.apis]
}

# 3) Cloud Run = container serverless. Scala da solo, anche a ZERO quando non ci sono richieste.
resource "google_cloud_run_v2_service" "app" {
  name     = "monster-vault"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 0 # a zero quando inattivo -> paghi ~nulla
      max_instance_count = 2
    }
    containers {
      image = var.image
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      # I SEGRETI (JWT, Cloudinary, e la connection string MongoDB SPRING_DATA_MONGODB_URI)
      # vanno via Secret Manager: vedi README -> "Secret"
      # (env { value_source { secret_key_ref { ... } } }).
    }
  }

  depends_on = [google_project_service.apis]
}

# 4) Rende il servizio invocabile pubblicamente (senza auth)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
