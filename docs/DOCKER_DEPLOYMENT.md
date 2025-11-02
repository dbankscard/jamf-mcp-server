# Docker Deployment Guide

## Quick Start

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f jamf-mcp-server

# Stop services
docker-compose down
```

## Building the Image

### Using Docker Compose (Recommended)

```bash
# Build the image
docker-compose build

# Build and start services
docker-compose up --build -d
```

### Using Build Script

```bash
# Basic build
./scripts/docker-build.sh

# Build with version tag
VERSION=1.0.0 ./scripts/docker-build.sh

# Build multi-platform image
BUILD_MULTIPLATFORM=true ./scripts/docker-build.sh

# Build and push to registry
DOCKER_REGISTRY=myregistry.com PUSH_TO_REGISTRY=true ./scripts/docker-build.sh
```

### Manual Docker Build

```bash
# Build the image
docker build -t jamf-mcp-server:latest .

# Run the container
docker run -d \
  --name jamf-mcp-server \
  -p 3000:3000 \
  --env-file .env \
  jamf-mcp-server:latest
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Required
JAMF_URL=https://your-instance.jamfcloud.com
JAMF_CLIENT_ID=your-client-id
JAMF_CLIENT_SECRET=your-client-secret

# Optional
JAMF_USERNAME=your-username
JAMF_PASSWORD=your-password
JAMF_READ_ONLY=false
JAMF_ALLOW_INSECURE=false

# Server
PORT=3000
LOG_LEVEL=info
NODE_ENV=production
```

### Docker Compose Profiles

The docker-compose.yml includes optional services:

```bash
# Run with Nginx reverse proxy
docker-compose --profile with-nginx up -d

# Run with Redis cache
docker-compose --profile with-redis up -d

# Run with both
docker-compose --profile with-nginx --profile with-redis up -d
```

## HTTPS with Nginx

To enable HTTPS with the Nginx reverse proxy:

1. Generate SSL certificates:
```bash
mkdir -p nginx/ssl
cd nginx/ssl

# Self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem

# Or copy your production certificates
cp /path/to/your/cert.pem .
cp /path/to/your/key.pem .
```

2. Start with Nginx profile:
```bash
docker-compose --profile with-nginx up -d
```

3. Access via HTTPS:
```
https://localhost
```

## Production Deployment

### 1. Security Checklist

- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS (use Nginx profile or external load balancer)
- [ ] Set JAMF_ALLOW_INSECURE=false
- [ ] Use secrets management for credentials
- [ ] Enable rate limiting
- [ ] Configure firewall rules

### 2. Resource Limits

Add resource limits to docker-compose.yml:

```yaml
services:
  jamf-mcp-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 3. Monitoring

#### Health Checks

The container includes built-in health checks:

```bash
# Check health status
docker-compose ps

# Manual health check
curl http://localhost:3000/health
```

#### Logs

```bash
# View logs
docker-compose logs -f jamf-mcp-server

# Save logs to file
docker-compose logs jamf-mcp-server > jamf-mcp-server.log
```

#### Metrics

Enable connection pool metrics:

```env
HTTP_ENABLE_METRICS=true
```

### 4. Backup and Recovery

```bash
# Backup configuration
docker-compose config > docker-compose.backup.yml

# Export environment
docker-compose exec jamf-mcp-server env > env.backup
```

## Kubernetes Deployment

For Kubernetes deployment, use the provided Helm chart (coming soon) or create manifests:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jamf-mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: jamf-mcp-server
  template:
    metadata:
      labels:
        app: jamf-mcp-server
    spec:
      containers:
      - name: jamf-mcp-server
        image: jamf-mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: JAMF_URL
          valueFrom:
            secretKeyRef:
              name: jamf-credentials
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
```

## Troubleshooting

### Container won't start

1. Check logs:
```bash
docker-compose logs jamf-mcp-server
```

2. Verify environment variables:
```bash
docker-compose config
```

3. Check port availability:
```bash
lsof -i :3000
```

### Connection issues

1. Verify network:
```bash
docker network ls
docker network inspect jamf-mcp-server_jamf-mcp-network
```

2. Test from inside container:
```bash
docker-compose exec jamf-mcp-server wget -O- http://localhost:3000/health
```

### Performance issues

1. Check resource usage:
```bash
docker stats jamf-mcp-server
```

2. Review connection pool metrics:
```bash
# Enable metrics
HTTP_ENABLE_METRICS=true docker-compose up -d

# Check logs for metrics
docker-compose logs jamf-mcp-server | grep "Connection pool metrics"
```