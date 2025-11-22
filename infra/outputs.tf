output "frontend_domain" {
  value = module.frontend.hosted_domain
}

output "api_hostname" {
  value = module.api_service.hostname
}

output "ws_hostname" {
  value = module.ws_service.hostname
}

output "redis_url" {
  value     = format("redis://%s:%s", module.redis.host, module.redis.port)
  sensitive = true
}
