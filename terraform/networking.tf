# ── VPC ───────────────────────────────────────────────────────────────────────

resource "google_compute_network" "ged" {
  name                    = "${local.app_name}-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "ged" {
  name          = "${local.app_name}-subnet"
  network       = google_compute_network.ged.id
  region        = var.region
  ip_cidr_range = "10.0.0.0/24"
}

# ── Private Services Access (for Cloud SQL private IP) ────────────────────────

resource "google_compute_global_address" "private_services" {
  name          = "${local.app_name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.ged.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.ged.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
  depends_on              = [google_project_service.apis]
}

# ── Serverless VPC Connector (Cloud Run → private network) ───────────────────

resource "google_vpc_access_connector" "ged" {
  name          = "${local.app_name}-connector"
  region        = var.region
  network       = google_compute_network.ged.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 3
  machine_type  = "e2-micro"
  depends_on    = [google_project_service.apis]
}
