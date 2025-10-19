# AWS Configuration
aws_region   = "us-east-1"
environment  = "production"
project_name = "jamf-mcp-server"

# ECS Configuration
task_cpu      = "512"
task_memory   = "1024"
desired_count = 2
min_capacity  = 2
max_capacity  = 10

# SSL Certificate (we'll add this after creating the certificate)
certificate_arn = ""

# Application Configuration
oauth_provider     = "auth0"
oauth_redirect_uri = "https://chatgpt.com/auth/callback"
jamf_read_only     = false
log_level          = "info"

# These will be stored in AWS Secrets Manager
# Jamf credentials - REPLACE WITH YOUR ACTUAL VALUES
jamf_url           = "https://your-instance.jamfcloud.com"
jamf_client_id     = "your-jamf-client-id"
jamf_client_secret = "your-jamf-client-secret"

# Auth0 Configuration - REPLACE WITH YOUR ACTUAL VALUES
auth0_domain       = "your-auth0-domain.auth0.com"
auth0_client_id    = "your-auth0-client-id"
auth0_client_secret = "your-auth0-client-secret"
auth0_audience      = "https://jamf-mcp-api"
required_scopes     = "read:jamf write:jamf"