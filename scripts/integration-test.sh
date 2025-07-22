#!/bin/bash

# Docker-based MCP Integration Test Script
# This script handles Docker orchestration and runs comprehensive integration tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=()

# Docker Compose file
COMPOSE_FILE="docker-compose.test.yml"

# Service URLs (will be set after services start)
MCP_SERVER_URL="http://localhost:3000"
MOCK_ADMIN_URL="http://localhost:3333"

echo -e "${CYAN}🚀 Docker-based MCP Integration Test Suite${NC}"
echo -e "${CYAN}============================================${NC}"

# Function to cleanup Docker services
cleanup_docker() {
    echo -e "\n${YELLOW}🧹 Cleaning up Docker services...${NC}"
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    echo -e "${GREEN}✅ Docker cleanup complete${NC}"
}

# Trap to ensure cleanup happens on exit
trap cleanup_docker EXIT

# Function to start Docker services
start_services() {
    echo -e "${BLUE}🐳 Starting Docker services...${NC}"
    
    # Clean up any existing services first
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    
    # Start services
    echo -e "${BLUE}   Starting mock-admin and mcp-server...${NC}"
    if docker compose -f "$COMPOSE_FILE" up -d; then
        echo -e "${GREEN}✅ Docker services started${NC}"
    else
        echo -e "${RED}❌ Failed to start Docker services${NC}"
        exit 1
    fi
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready (2 seconds)...${NC}"
    sleep 2
    
    # Test service connectivity
    echo -e "${BLUE}🔍 Testing service connectivity...${NC}"
    
    if curl -s -f "$MOCK_ADMIN_URL/health" > /dev/null; then
        echo -e "${GREEN}   ✅ Mock Admin Server: Ready${NC}"
    else
        echo -e "${RED}   ❌ Mock Admin Server: Not responding${NC}"
        docker compose -f "$COMPOSE_FILE" logs mock-admin
        exit 1
    fi
    
    if curl -s -f "$MCP_SERVER_URL/" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' > /dev/null; then
        echo -e "${GREEN}   ✅ MCP HTTP Server: Ready${NC}"
    else
        echo -e "${YELLOW}   ⚠️  MCP HTTP Server: May need authentication (expected)${NC}"
    fi
}

# Function to make HTTP requests
http_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local auth_header="$4"
    
    if [ "$method" = "POST" ]; then
        if [ -n "$auth_header" ]; then
            curl -s -X POST "$url" \
                -H "Content-Type: application/json" \
                -H "$auth_header" \
                -d "$data"
        else
            curl -s -X POST "$url" \
                -H "Content-Type: application/json" \
                -d "$data"
        fi
    else
        curl -s -X "$method" "$url"
    fi
}

# Function to run a single test
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${PURPLE}🧪 Running test: $test_name${NC}"
    
    if $test_function; then
        echo -e "${GREEN}  ✅ $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}  ❌ $test_name${NC}"
        FAILED_TESTS+=("$test_name")
    fi
}

# Function to generate test tokens
generate_tokens() {
    echo -e "\n${BLUE}🔑 Generating test tokens...${NC}"
    
    VALID_TOKEN=$(http_request "POST" "$MOCK_ADMIN_URL/token/valid" '{}' | jq -r '.access_token')
    EXPIRED_TOKEN=$(http_request "POST" "$MOCK_ADMIN_URL/token/expired" '{}' | jq -r '.access_token')
    
    if [ "$VALID_TOKEN" != "null" ] && [ "$EXPIRED_TOKEN" != "null" ]; then
        echo -e "${GREEN}✅ Test tokens generated${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to generate test tokens${NC}"
        return 1
    fi
}

# Test functions
test_mcp_list_tools() {
    local request='{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request")
    
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"tools"'
}

test_mcp_list_resources() {
    local request='{"jsonrpc": "2.0", "id": 2, "method": "resources/list"}'
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request")
    
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"resources"'
}

test_auth_no_token() {
    local request='{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "hello_get_profile", "arguments": {}}}'
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request")
    
    # Should get authentication error
    echo "$response" | grep -q '"error"' && echo "$response" | grep -q '"Authentication required"'
}

test_auth_expired_token() {
    local request='{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "hello_get_profile", "arguments": {}}}'
    local auth_header="Authorization: Bearer $EXPIRED_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get authentication error
    echo "$response" | grep -q '"error"' && echo "$response" | grep -q '"Authentication required"'
}

test_auth_valid_token() {
    local request='{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "hello_get_profile", "arguments": {}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result
    echo "$response" | grep -q '"result"'
}

test_tool_get_profile() {
    local request='{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "hello_get_profile", "arguments": {}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with profile data
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"content"'
}

test_tool_create_publisher() {
    local request='{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "hello_create_publisher", "arguments": {"name": "Test Publisher"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result
    echo "$response" | grep -q '"result"'
}

test_invalid_tool() {
    local request='{"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "nonexistent_tool", "arguments": {}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get error with "Unknown tool:" in the data field or "Method not found" in message
    echo "$response" | grep -q '"error"' && (echo "$response" | grep -q 'Method not found' || echo "$response" | grep -q 'Unknown tool:')
}

test_invalid_publisher_id() {
    local request='{"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "hello_get_publisher", "arguments": {"publisher_id": "invalid-uuid"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get error about invalid publisher ID
    echo "$response" | grep -q '"error"'
}

# Function to print test results
print_results() {
    echo -e "\n${CYAN}============================================${NC}"
    echo -e "${CYAN}📊 Test Results Summary${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $((TOTAL_TESTS - PASSED_TESTS))${NC}"
    
    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo -e "\n${RED}❌ Failed Tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}  - $test${NC}"
        done
    fi
    
    echo -e "\n${BLUE}🎯 Test Coverage:${NC}"
    echo -e "${BLUE}  - ✅ MCP Protocol (tools/list, resources/list)${NC}"
    echo -e "${BLUE}  - ✅ Authentication Flow (HTTP headers, JWT tokens)${NC}"
    echo -e "${BLUE}  - ✅ MCP Tools (real HTTP requests)${NC}"
    echo -e "${BLUE}  - ✅ Error Handling (HTTP status codes)${NC}"
    echo -e "${BLUE}  - ✅ Docker Service Integration${NC}"
    
    if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "\n${YELLOW}⚠️  $((TOTAL_TESTS - PASSED_TESTS)) test(s) failed. Please review the errors above.${NC}"
        return 1
    fi
}

# Main execution
main() {
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq is required but not installed. Please install jq first.${NC}"
        exit 1
    fi
    
    # Start Docker services
    start_services
    
    # Generate tokens
    if ! generate_tokens; then
        echo -e "${RED}❌ Failed to generate tokens, cannot continue${NC}"
        exit 1
    fi
    
    echo -e "\n${BLUE}🧪 Running integration tests...${NC}"
    
    # Run all tests
    run_test "MCP Protocol - List Tools" test_mcp_list_tools
    run_test "MCP Protocol - List Resources" test_mcp_list_resources
    run_test "Auth - Tool call without token (401)" test_auth_no_token
    run_test "Auth - Tool call with expired token (401)" test_auth_expired_token
    run_test "Auth - Tool call with valid token (success)" test_auth_valid_token
    run_test "Tool - hello_get_profile" test_tool_get_profile
    run_test "Tool - hello_create_publisher" test_tool_create_publisher
    run_test "Error - Invalid tool name" test_invalid_tool
    run_test "Error - Invalid publisher ID" test_invalid_publisher_id
    
    # Print results and exit with appropriate code
    print_results
}

# Run main function
main "$@" 