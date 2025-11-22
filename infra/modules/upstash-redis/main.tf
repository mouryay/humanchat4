terraform {
  required_providers {
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.0"
    }
  }
}

variable "cluster_name" { type = string }
variable "region" { type = string }

resource "upstash_redis_database" "this" {
  database_name = var.cluster_name
  region        = var.region
}

output "redis_url" {
  value      = upstash_redis_database.this.endpoint
  sensitive = true
}
