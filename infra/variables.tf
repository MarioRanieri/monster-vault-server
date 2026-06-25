# Input del modulo: si valorizzano in terraform.tfvars (copia da terraform.tfvars.example).
variable "project_id" {
  description = "ID del progetto GCP (per Cloud Run + Artifact Registry)"
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
