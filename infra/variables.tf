# Input del modulo: si valorizzano in terraform.tfvars (copia da terraform.tfvars.example).
variable "project_id" {
  description = "ID del progetto GCP (lo stesso di Firestore)"
  type        = string
}

variable "region" {
  description = "Regione GCP (es. europe-west1)"
  type        = string
  default     = "europe-west1"
}

variable "image" {
  description = "Immagine Docker completa su Artifact Registry (es. REGION-docker.pkg.dev/PROJECT/monster-vault/app:latest)"
  type        = string
}

variable "firestore_collection" {
  description = "Nome della collezione Firestore"
  type        = string
  default     = "cans"
}
