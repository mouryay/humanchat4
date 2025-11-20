terraform {
  required_version = ">= 1.7.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.13"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 0.11"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 0.3"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "vercel" {
  token = var.vercel_token
}

provider "supabase" {
  access_token = var.supabase_token
}

provider "cloudflare" {
  api_token = var.cloudflare_token
}

provider "upstash" {
  email = var.upstash_email
  api_key = var.upstash_api_key
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

module "frontend" {
  source        = "./modules/frontend"
  project_name  = var.project_name
  domain        = var.primary_domain
  vercel_team   = var.vercel_team
  env_variables = var.frontend_env
}

module "api_service" {
  source        = "./modules/cloud-run-service"
  project_id    = var.gcp_project_id
  region        = var.gcp_region
  service_name  = "humanchat-api"
  image         = var.api_image
  env_variables = var.backend_env
  min_instances = 1
  max_instances = 3
}

module "ws_service" {
  source        = "./modules/cloud-run-service"
  project_id    = var.gcp_project_id
  region        = var.gcp_region
  service_name  = "humanchat-ws"
  image         = var.ws_image
  env_variables = var.ws_env
  min_instances = 0
  max_instances = 5
}

module "database" {
  source        = "./modules/supabase"
  project_name  = "${var.project_name}-db"
  region        = var.db_region
  enable_replicas = true
}

module "redis" {
  source      = "./modules/upstash-redis"
  cluster_name = "${var.project_name}-redis"
  region       = var.redis_region
  multiregion  = true
}

module "dns" {
  source          = "./modules/cloudflare-dns"
  zone_id         = var.cloudflare_zone_id
  primary_domain  = var.primary_domain
  api_domain      = var.api_domain
  ws_domain       = var.ws_domain
  frontend_target = module.frontend.hosted_domain
  api_target      = module.api_service.hostname
  ws_target       = module.ws_service.hostname
}
