#!/bin/bash
#
# Docker build and deployment script
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="jamf-mcp-server"
REGISTRY="${DOCKER_REGISTRY:-}"
VERSION="${VERSION:-$(git describe --tags --always --dirty)}"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

echo -e "${GREEN}Building Jamf MCP Server Docker image...${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"

# Build arguments
BUILD_ARGS=(
    --build-arg "VERSION=${VERSION}"
    --build-arg "BUILD_DATE=${BUILD_DATE}"
    --label "version=${VERSION}"
    --label "build-date=${BUILD_DATE}"
)

# Build multi-platform if requested
if [ "$BUILD_MULTIPLATFORM" = "true" ]; then
    echo -e "${YELLOW}Building multi-platform image (linux/amd64,linux/arm64)${NC}"
    BUILD_ARGS+=(--platform "linux/amd64,linux/arm64")
fi

# Build the image
echo -e "${GREEN}Building Docker image...${NC}"
docker build "${BUILD_ARGS[@]}" -t "${IMAGE_NAME}:${VERSION}" -t "${IMAGE_NAME}:latest" .

# Tag with registry if specified
if [ -n "$REGISTRY" ]; then
    echo -e "${GREEN}Tagging image for registry: ${REGISTRY}${NC}"
    docker tag "${IMAGE_NAME}:${VERSION}" "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    docker tag "${IMAGE_NAME}:latest" "${REGISTRY}/${IMAGE_NAME}:latest"
    
    # Push if requested
    if [ "$PUSH_TO_REGISTRY" = "true" ]; then
        echo -e "${GREEN}Pushing to registry...${NC}"
        docker push "${REGISTRY}/${IMAGE_NAME}:${VERSION}"
        docker push "${REGISTRY}/${IMAGE_NAME}:latest"
    fi
fi

# Run security scan if trivy is installed
if command -v trivy &> /dev/null; then
    echo -e "${GREEN}Running security scan...${NC}"
    trivy image --severity CRITICAL,HIGH "${IMAGE_NAME}:${VERSION}"
fi

# Save image to file if requested
if [ "$SAVE_IMAGE" = "true" ]; then
    echo -e "${GREEN}Saving image to file...${NC}"
    docker save "${IMAGE_NAME}:${VERSION}" | gzip > "jamf-mcp-server-${VERSION}.tar.gz"
    echo -e "${GREEN}Image saved to: jamf-mcp-server-${VERSION}.tar.gz${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo -e "Image: ${YELLOW}${IMAGE_NAME}:${VERSION}${NC}"
echo -e "Size: $(docker images --format 'table {{.Size}}' "${IMAGE_NAME}:${VERSION}" | tail -1)"

# Display next steps
echo -e "\n${GREEN}Next steps:${NC}"
echo -e "1. Test locally: ${YELLOW}docker-compose up${NC}"
echo -e "2. Push to registry: ${YELLOW}PUSH_TO_REGISTRY=true ./scripts/docker-build.sh${NC}"
echo -e "3. Deploy to production: ${YELLOW}docker-compose -f docker-compose.yml up -d${NC}"