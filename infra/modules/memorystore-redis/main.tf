variable "name" { type = string }
variable "project_id" { type = string }
variable "region" { type = string }
variable "network" { type = string }
variable "memory_size_gb" {
  type    = number
  default = 1
}
variable "tier" {
  type    = string
  default = "BASIC"
}
variable "transit_encryption_mode" {
  type    = string
  default = "SERVER_AUTHENTICATION"
}
variable "redis_version" {
  type    = string
  default = "REDIS_7_0"
}

resource "google_redis_instance" "this" {
  name                   = var.name
  project                = var.project_id
  region                 = var.region
  tier                   = var.tier
  memory_size_gb         = var.memory_size_gb
  transit_encryption_mode = var.transit_encryption_mode
  authorized_network     = var.network
  redis_version          = var.redis_version
}

output "host" {
  value = google_redis_instance.this.host
}

output "port" {
  value = google_redis_instance.this.port
}
