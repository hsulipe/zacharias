resource "google_artifact_registry_repository" "ged" {
  location      = var.region
  repository_id = local.app_name
  description   = "GED Docker images"
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}
