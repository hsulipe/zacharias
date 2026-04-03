locals {
  image_base   = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.ged.repository_id}"
  vpc_connector = google_vpc_access_connector.ged.id

  # Shared non-sensitive env vars for API + worker
  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "MINIO_ENDPOINT", value = "storage.googleapis.com" },
    { name = "MINIO_PORT", value = "443" },
    { name = "MINIO_USE_SSL", value = "true" },
    { name = "MINIO_BUCKET", value = google_storage_bucket.documents.name },
    { name = "MINIO_PUBLIC_URL", value = "https://storage.googleapis.com" },
    { name = "CORS_ORIGIN", value = var.cors_origin },
    { name = "MAX_FILE_SIZE_MB", value = tostring(var.max_file_size_mb) },
    { name = "SMTP_HOST", value = var.smtp_host },
    { name = "SMTP_PORT", value = tostring(var.smtp_port) },
    { name = "SMTP_FROM", value = var.smtp_from },
  ]

  # Secret env vars for API + worker
  secret_env = [
    { name = "DATABASE_URL", secret = "database_url" },
    { name = "REDIS_URL", secret = "redis_url" },
    { name = "JWT_SECRET", secret = "jwt_secret" },
    { name = "JWT_REFRESH_SECRET", secret = "jwt_refresh_secret" },
    { name = "MINIO_ACCESS_KEY", secret = "minio_access_key" },
    { name = "MINIO_SECRET_KEY", secret = "minio_secret_key" },
    { name = "SMTP_USER", secret = "smtp_user" },
    { name = "SMTP_PASS", secret = "smtp_pass" },
  ]
}

# ── API ───────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.app_name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.labels

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    vpc_access {
      connector = local.vpc_connector
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      ports {
        container_port = 3000
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value.secret].secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get { path = "/health" }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get { path = "/health" }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_version.app,
    google_vpc_access_connector.ged,
    google_service_account.cloudrun,
  ]
}

# Allow unauthenticated access to the API (JWT handles auth at the app level)
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── OCR Worker ────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "worker" {
  name     = "${local.app_name}-worker"
  location = var.region
  # Not publicly accessible — it only listens to Redis queue
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  labels   = local.labels

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }

    vpc_access {
      connector = local.vpc_connector
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/worker:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        # Keep CPU allocated so the worker can process jobs continuously
        cpu_idle = false
      }

      ports {
        # Health check endpoint served by worker-entrypoint.sh
        container_port = 8080
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value.secret].secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get { path = "/health" }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_version.app,
    google_vpc_access_connector.ged,
    google_service_account.cloudrun,
  ]
}

# ── Frontend ──────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "frontend" {
  name     = "${local.app_name}-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.labels

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    vpc_access {
      connector = local.vpc_connector
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${local.image_base}/frontend:latest"

      resources {
        limits = {
          cpu    = "0.5"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "BACKEND_URL"
        value = google_cloud_run_v2_service.api.uri
      }
    }
  }

  depends_on = [google_cloud_run_v2_service.api]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
