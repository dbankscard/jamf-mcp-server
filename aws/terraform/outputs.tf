output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.jamf_mcp.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnets
}

output "deployment_instructions" {
  description = "Instructions for completing the deployment"
  value       = <<-EOT
    Deployment Instructions:
    
    1. Build and push Docker image:
       aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.jamf_mcp.repository_url}
       docker build -t ${var.project_name} .
       docker tag ${var.project_name}:latest ${aws_ecr_repository.jamf_mcp.repository_url}:latest
       docker push ${aws_ecr_repository.jamf_mcp.repository_url}:latest
    
    2. Update ECS service:
       aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.main.name} --force-new-deployment
    
    3. View logs:
       aws logs tail ${aws_cloudwatch_log_group.ecs.name} --follow
    
    4. Access the application:
       ${var.certificate_arn != "" ? "https" : "http"}://${aws_lb.main.dns_name}
    
    5. Configure ChatGPT:
       - Server URL: ${var.certificate_arn != "" ? "https" : "http"}://${aws_lb.main.dns_name}/mcp
       - OAuth Auth URL: ${var.certificate_arn != "" ? "https" : "http"}://${aws_lb.main.dns_name}/auth/authorize
       - OAuth Token URL: ${var.certificate_arn != "" ? "https" : "http"}://${aws_lb.main.dns_name}/auth/callback
  EOT
}