resource "google_sql_database_instance" "ged" {
  name             = "${local.app_name}-postgres"
  database_version = "POSTGRES_16"
  region           = var.region
  depends_on       = [google_service_networking_connection.private_services]

  deletion_protection = true

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_autoresize   = true
    disk_size         = 20

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.ged.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled = true
    }

    user_labels = local.labels
  }
}

resource "google_sql_database" "ged" {
  name     = var.db_name
  instance = google_sql_database_instance.ged.name
}

resource "google_sql_user" "ged" {
  name     = var.db_user
  instance = google_sql_database_instance.ged.name
  password = var.db_password
}
