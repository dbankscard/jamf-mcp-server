# Build stage
FROM node:20-alpine AS builder

# Add security updates
RUN apk update && apk upgrade

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with security audit
RUN npm ci && npm audit fix --audit-level=moderate || true

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Add security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create log directory
RUN mkdir -p /var/log/jamf-mcp-server && \
    chown nodejs:nodejs /var/log/jamf-mcp-server

# Copy package files
COPY package*.json ./

# Install production dependencies only and run security audit
RUN npm ci --production && \
    npm audit fix --audit-level=moderate || true && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy environment template (for reference)
COPY --chown=nodejs:nodejs .env.chatgpt .env.example

# Set secure permissions
RUN chmod -R 550 /app/dist && \
    chmod 440 /app/.env.example

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Security: Drop all capabilities
USER nodejs

# Environment variables
ENV NODE_ENV=production \
    LOG_DIR=/var/log/jamf-mcp-server

# Expose port (non-privileged)
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the HTTP server
CMD ["node", "dist/server/http-server.js"]