output "frontend_url" {
  description = "Public URL for the frontend"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "api_url" {
  description = "Public URL for the backend API"
  value       = google_cloud_run_v2_service.api.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.ged.repository_id}"
}

output "wif_provider" {
  description = "Workload Identity Provider resource name — set as WIF_PROVIDER GitHub secret"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_sa_email" {
  description = "Deployer service account email — set as GCP_SA_EMAIL GitHub secret"
  value       = google_service_account.deployer.email
}

output "db_instance_connection_name" {
  description = "Cloud SQL instance connection name (useful for manual operations)"
  value       = google_sql_database_instance.ged.connection_name
}

output "gcs_bucket" {
  description = "GCS bucket name for documents"
  value       = google_storage_bucket.documents.name
}
