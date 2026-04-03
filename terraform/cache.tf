resource "google_redis_instance" "ged" {
  name           = "${local.app_name}-redis"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  authorized_network = google_compute_network.ged.id

  redis_version     = "REDIS_7_0"
  display_name      = "GED Redis"
  reserved_ip_range = "10.1.0.0/29"

  labels     = local.labels
  depends_on = [google_project_service.apis]
}
