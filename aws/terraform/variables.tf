variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "jamf-mcp-server"
}

# Networking
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnets" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "public_subnets" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

# ECS Configuration
variable "task_cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = string
  default     = "512"
}

variable "task_memory" {
  description = "Memory for the task in MB (512, 1024, 2048, 4096, 8192, 16384, 30720)"
  type        = string
  default     = "1024"
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto-scaling"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto-scaling"
  type        = number
  default     = 80
}

# SSL/TLS
variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# Application Configuration
variable "oauth_provider" {
  description = "OAuth provider (auth0, okta)"
  type        = string
  default     = "auth0"
}

variable "oauth_redirect_uri" {
  description = "OAuth redirect URI"
  type        = string
  default     = "https://chatgpt.com/auth/callback"
}

variable "jamf_read_only" {
  description = "Enable read-only mode for Jamf operations"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "rate_limit_window" {
  description = "Rate limit window in milliseconds"
  type        = number
  default     = 900000
}

variable "rate_limit_max" {
  description = "Maximum requests per rate limit window"
  type        = number
  default     = 100
}

variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["https://chat.openai.com", "https://chatgpt.com"]
}

# Secrets Configuration
variable "jamf_url" {
  description = "Jamf Pro instance URL"
  type        = string
  sensitive   = true
}

variable "jamf_client_id" {
  description = "Jamf API client ID"
  type        = string
  sensitive   = true
}

variable "jamf_client_secret" {
  description = "Jamf API client secret"
  type        = string
  sensitive   = true
}

variable "auth0_domain" {
  description = "Auth0 domain"
  type        = string
  sensitive   = true
}

variable "auth0_client_id" {
  description = "Auth0 client ID"
  type        = string
  sensitive   = true
}

variable "auth0_client_secret" {
  description = "Auth0 client secret"
  type        = string
  sensitive   = true
}

variable "auth0_audience" {
  description = "Auth0 audience"
  type        = string
  sensitive   = true
}

variable "required_scopes" {
  description = "Required OAuth scopes"
  type        = string
  default     = "read:jamf write:jamf"
}

# Debugging
variable "enable_execute_command" {
  description = "Enable ECS Execute Command for debugging"
  type        = bool
  default     = false
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}