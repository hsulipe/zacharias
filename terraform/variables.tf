variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (e.g. southamerica-east1, us-central1)"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment label"
  type        = string
  default     = "production"
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ged_db"
}

variable "db_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "ged_user"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "db_tier" {
  description = "Cloud SQL machine type"
  type        = string
  default     = "db-g1-small"
}

# ── Secrets ───────────────────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT access token secret (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret (min 32 chars)"
  type        = string
  sensitive   = true
}

# ── App config ────────────────────────────────────────────────────────────────

variable "cors_origin" {
  description = "Allowed CORS origin — the public frontend URL (e.g. https://ged.example.com)"
  type        = string
}

variable "max_file_size_mb" {
  description = "Max file upload size in MB"
  type        = number
  default     = 50
}

# ── SMTP (optional) ───────────────────────────────────────────────────────────

variable "smtp_host" {
  description = "SMTP host (leave empty to disable email alerts)"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP port"
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_pass" {
  description = "SMTP password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  description = "SMTP from address"
  type        = string
  default     = "noreply@ged.local"
}

# ── GitHub Workload Identity ───────────────────────────────────────────────────

variable "github_org" {
  description = "GitHub organisation or username (e.g. my-org)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (e.g. Zacharias)"
  type        = string
}
