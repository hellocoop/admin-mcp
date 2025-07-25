#!/bin/bash

# MCP Integration Test Suite with Mocha/Chai
# This script starts Docker services and runs the Mocha-based integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
MCP_SERVER_URL="http://localhost:3000"
MOCK_ADMIN_URL="http://localhost:3333"

echo -e "${BLUE}🚀 MCP Integration Test Suite (Mocha/Chai)${NC}"
echo "============================================"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up Docker services...${NC}"
    docker compose -f "$COMPOSE_FILE" down --remove-orphans > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Docker cleanup complete${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Start Docker services
echo -e "${BLUE}🐳 Starting Docker services...${NC}"
echo "   Starting mock-admin and mcp-server..."

if ! docker compose -f "$COMPOSE_FILE" up -d; then
    echo -e "${RED}❌ Failed to start Docker services${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker services started${NC}"

# Export environment variables for the tests
export NODE_ENV=test
export MCP_SERVER_URL="$MCP_SERVER_URL"
export MOCK_ADMIN_URL="$MOCK_ADMIN_URL"

# Wait a moment for services to initialize
echo -e "${YELLOW}⏳ Waiting for services to initialize (3 seconds)...${NC}"
sleep 3

# Run the Mocha tests
echo -e "${BLUE}🧪 Running Mocha integration tests...${NC}"
echo ""

# Run tests with proper error handling
if npm run test:integration:mocha; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}🎉 All integration tests passed!${NC}"
    echo -e "${GREEN}============================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}❌ Integration tests failed!${NC}"
    echo -e "${RED}============================================${NC}"
    exit 1
fi 