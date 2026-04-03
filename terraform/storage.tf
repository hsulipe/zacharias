# ── GCS Bucket for document storage ──────────────────────────────────────────

resource "google_storage_bucket" "documents" {
  name          = "${local.app_name}-documents-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = local.labels
}

# ── Service account for GCS HMAC (MinIO SDK S3 interop) ──────────────────────

resource "google_service_account" "gcs_hmac" {
  account_id   = "${local.app_name}-gcs-hmac"
  display_name = "GED GCS HMAC (MinIO S3 interop)"
}

resource "google_storage_bucket_iam_member" "gcs_hmac_admin" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.gcs_hmac.email}"
}

# HMAC key — enables MinIO SDK to talk to GCS via the S3 XML API
resource "google_storage_hmac_key" "ged" {
  service_account_email = google_service_account.gcs_hmac.email
  depends_on            = [google_storage_bucket_iam_member.gcs_hmac_admin]
}
