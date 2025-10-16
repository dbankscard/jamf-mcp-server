resource "aws_secretsmanager_secret" "jamf_mcp" {
  name                    = "${var.project_name}/${var.environment}"
  description             = "Secrets for Jamf MCP Server"
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "jamf_mcp" {
  secret_id = aws_secretsmanager_secret.jamf_mcp.id

  secret_string = jsonencode({
    JAMF_URL            = var.jamf_url
    JAMF_CLIENT_ID      = var.jamf_client_id
    JAMF_CLIENT_SECRET  = var.jamf_client_secret
    AUTH0_DOMAIN        = var.auth0_domain
    AUTH0_CLIENT_ID     = var.auth0_client_id
    AUTH0_CLIENT_SECRET = var.auth0_client_secret
    AUTH0_AUDIENCE      = var.auth0_audience
    REQUIRED_SCOPES     = var.required_scopes
  })
}