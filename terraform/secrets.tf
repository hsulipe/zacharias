locals {
  database_url = "postgresql://${var.db_user}:${var.db_password}@${google_sql_database_instance.ged.private_ip_address}:5432/${var.db_name}"
  redis_url    = "redis://${google_redis_instance.ged.host}:${google_redis_instance.ged.port}"
}

# Helper to create a secret + its initial version in one block
locals {
  secrets = {
    database_url       = local.database_url
    redis_url          = local.redis_url
    jwt_secret         = var.jwt_secret
    jwt_refresh_secret = var.jwt_refresh_secret
    minio_access_key   = google_storage_hmac_key.ged.access_id
    minio_secret_key   = google_storage_hmac_key.ged.secret
    smtp_user          = var.smtp_user
    smtp_pass          = var.smtp_pass
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "${local.app_name}-${replace(each.key, "_", "-")}"

  labels     = local.labels
  depends_on = [google_project_service.apis]

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}
