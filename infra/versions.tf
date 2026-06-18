# Versioni richieste + provider. 'init' scarica il provider google; 'validate' controlla
# la correttezza del config SENZA credenziali e SENZA creare nulla (opzione "a secco").
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
