terraform {
  required_version = ">= 1.7.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.13"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_token
}

provider "cloudflare" {
  api_token = var.cloudflare_token
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

resource "google_compute_network" "main" {
  name                    = "${var.project_name}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = "10.100.0.0/28"
  region        = var.gcp_region
  network       = google_compute_network.main.id
}

resource "google_vpc_access_connector" "cloud_run" {
  name   = "${var.project_name}-connector"
  region = var.gcp_region

  subnet {
    name = google_compute_subnetwork.main.name
  }
}

module "frontend" {
  source        = "./modules/frontend"
  project_name  = var.project_name
  domain        = var.primary_domain
  vercel_team   = var.vercel_team
  git_repo_slug = var.git_repo_slug
  env_variables = var.frontend_env
}

module "api_service" {
  source        = "./modules/cloud-run-service"
  project_id    = var.gcp_project_id
  region        = var.gcp_region
  service_name  = "humanchat-api"
  image         = var.api_image
  env_variables = merge(var.backend_env, { REDIS_URL = local.redis_url })
  min_instances = 1
  max_instances = 3
  vpc_connector = google_vpc_access_connector.cloud_run.name
  vpc_connector_egress = "all-traffic"
  cloud_sql_instances  = var.api_cloud_sql_instances
}

module "ws_service" {
  source        = "./modules/cloud-run-service"
  project_id    = var.gcp_project_id
  region        = var.gcp_region
  service_name  = "humanchat-ws"
  image         = var.ws_image
  env_variables = merge(var.ws_env, { REDIS_URL = local.redis_url })
  min_instances = 0
  max_instances = 5
  vpc_connector = google_vpc_access_connector.cloud_run.name
  vpc_connector_egress = "all-traffic"
}

module "redis" {
  source     = "./modules/memorystore-redis"
  name       = "${var.project_name}-redis"
  project_id = var.gcp_project_id
  region     = var.gcp_region
  network    = google_compute_network.main.id
}

locals {
  redis_url = "redis://${module.redis.host}:${module.redis.port}"
}

module "dns" {
  source          = "./modules/cloudflare-dns"
  zone_id         = var.cloudflare_zone_id
  primary_domain  = var.primary_domain
  api_domain      = var.api_domain
  ws_domain       = var.ws_domain
  frontend_target = "cname.vercel-dns.com"
  api_target      = module.api_service.hostname
  ws_target       = module.ws_service.hostname
}
