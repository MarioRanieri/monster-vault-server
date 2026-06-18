# Output mostrati dopo 'terraform apply' (o con 'terraform output').
output "service_url" {
  description = "URL pubblico del servizio Cloud Run"
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry" {
  description = "Path Artifact Registry dove pushare l'immagine Docker"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/monster-vault"
}
