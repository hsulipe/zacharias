terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment after creating the state bucket:
  #   gsutil mb -p YOUR_PROJECT_ID gs://tf-state-YOUR_PROJECT_ID
  #   gsutil versioning set on gs://tf-state-YOUR_PROJECT_ID
  # backend "gcs" {
  #   bucket = "tf-state-YOUR_PROJECT_ID"
  #   prefix = "ged"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  app_name = "ged"
  labels = {
    app         = local.app_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}
