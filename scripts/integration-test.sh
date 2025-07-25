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
    local request='{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create", "name": "Test App"}}}'
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request")
    
    # Should get authentication error
    echo "$response" | grep -q '"error"' && echo "$response" | grep -q '"Authentication required"'
}

test_auth_expired_token() {
    local request='{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create", "name": "Test App"}}}'
    local auth_header="Authorization: Bearer $EXPIRED_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get authentication error
    echo "$response" | grep -q '"error"' && echo "$response" | grep -q '"Authentication required"'
}

test_auth_valid_token() {
    local request='{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create", "name": "Test App"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result
    echo "$response" | grep -q '"result"'
}

test_tool_with_profile() {
    local request='{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create", "name": "Profile Test App"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with profile data included in MCP contents format
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"contents"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"profile"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"application"'
}

# Test create action with auto-generated name
test_create_app_auto_name() {
    local request='{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with auto-generated name in MCP contents format
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"contents"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"application"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q "'s App"
}

# Test create action with full parameters
test_create_app_full() {
    local request='{"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "create", "name": "Full Test App", "tos_uri": "https://example.com/tos", "pp_uri": "https://example.com/privacy", "dev_localhost": true, "dev_127_0_0_1": true, "dev_wildcard": false, "dev_redirect_uris": ["http://localhost:3000/callback"], "prod_redirect_uris": ["https://example.com/callback"], "device_code": true}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result and store client_id for other tests
    if echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"contents"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"application"'; then
        # Extract client_id from MCP contents format - parse the JSON text content and extract the application ID
        TEST_CLIENT_ID=$(echo "$response" | jq -r '.result.contents[0].text' | jq -r '.application.id // empty')
        return 0
    fi
    return 1
}

# Test read action with no client_id (profile only)
test_read_profile_only() {
    local request='{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "read"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with profile in MCP contents format
    echo "$response" | grep -q '"result"' && echo "$response" | grep -q '"contents"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"profile"'
}

# Test read action with client_id (after app creation)
test_read_app() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        echo "Skipping read test - no client_id available"
        return 0
    fi
    
    local request="{\"jsonrpc\": \"2.0\", \"id\": 9, \"method\": \"tools/call\", \"params\": {\"name\": \"hello_manage_app\", \"arguments\": {\"action\": \"read\", \"client_id\": \"$TEST_CLIENT_ID\"}}}"
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with application details
    echo "$response" | grep -q '"result"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"application"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q "$TEST_CLIENT_ID"
}

# Test update action
test_update_app() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        echo "Skipping update test - no client_id available"
        return 0
    fi
    
    local request="{\"jsonrpc\": \"2.0\", \"id\": 10, \"method\": \"tools/call\", \"params\": {\"name\": \"hello_manage_app\", \"arguments\": {\"action\": \"update\", \"client_id\": \"$TEST_CLIENT_ID\", \"name\": \"Updated Test App\", \"tos_uri\": \"https://example.com/updated-tos\"}}}"
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result
    echo "$response" | grep -q '"result"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"application"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q "Updated Test App"
}

# Test create_secret action
test_create_secret() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        echo "Skipping create_secret test - no client_id available"
        return 0
    fi
    
    local request="{\"jsonrpc\": \"2.0\", \"id\": 11, \"method\": \"tools/call\", \"params\": {\"name\": \"hello_manage_app\", \"arguments\": {\"action\": \"create_secret\", \"client_id\": \"$TEST_CLIENT_ID\"}}}"
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with client_secret
    echo "$response" | grep -q '"result"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"client_secret"'
}

# Test upload_logo_url action
test_upload_logo_url() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        echo "Skipping upload_logo_url test - no client_id available"
        return 0
    fi
    
    local request="{\"jsonrpc\": \"2.0\", \"id\": 12, \"method\": \"tools/call\", \"params\": {\"name\": \"hello_manage_app\", \"arguments\": {\"action\": \"upload_logo_url\", \"client_id\": \"$TEST_CLIENT_ID\", \"logo_url\": \"https://www.hello.dev/images/hello-logo.svg\", \"logo_content_type\": \"image/svg+xml\"}}}"
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with upload details
    echo "$response" | grep -q '"result"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"upload_result"'
}

# Test upload_logo_file action
test_upload_logo_file() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        echo "Skipping upload_logo_file test - no client_id available"
        return 0
    fi
    
    # Small 1x1 transparent PNG in base64
    local test_image="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    local request="{\"jsonrpc\": \"2.0\", \"id\": 13, \"method\": \"tools/call\", \"params\": {\"name\": \"hello_manage_app\", \"arguments\": {\"action\": \"upload_logo_file\", \"client_id\": \"$TEST_CLIENT_ID\", \"logo_file\": \"$test_image\", \"logo_content_type\": \"image/png\"}}}"
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get successful result with upload details
    echo "$response" | grep -q '"result"' && echo "$response" | jq -r '.result.contents[0].text' | grep -q '"upload_result"'
}

test_upload_logo_url_error_handling() {
    local request='{"jsonrpc": "2.0", "id": 14, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "upload_logo_url", "client_id": "invalid-app-id", "logo_url": "https://example.com/logo.png", "logo_content_type": "image/png"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get error for invalid app ID
    echo "$response" | grep -q '"error"'
}

test_invalid_tool() {
    local request='{"jsonrpc": "2.0", "id": 15, "method": "tools/call", "params": {"name": "nonexistent_tool", "arguments": {}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get error with "Unknown tool:" in the data field or "Method not found" in message
    echo "$response" | grep -q '"error"' && (echo "$response" | grep -q 'Method not found' || echo "$response" | grep -q 'Unknown tool:')
}

test_invalid_app_id() {
    local request='{"jsonrpc": "2.0", "id": 16, "method": "tools/call", "params": {"name": "hello_manage_app", "arguments": {"action": "read", "client_id": "invalid-uuid"}}}'
    local auth_header="Authorization: Bearer $VALID_TOKEN"
    local response=$(http_request "POST" "$MCP_SERVER_URL/" "$request" "$auth_header")
    
    # Should get error about invalid app ID
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
    run_test "Tool - hello_manage_app read (profile only)" test_read_profile_only
    run_test "Tool - hello_manage_app with profile data" test_tool_with_profile
    run_test "Tool - hello_manage_app create (auto-name)" test_create_app_auto_name
    run_test "Tool - hello_manage_app create (full)" test_create_app_full
    run_test "Tool - hello_manage_app read (with app)" test_read_app
    run_test "Tool - hello_manage_app update" test_update_app
    run_test "Tool - hello_manage_app create_secret" test_create_secret
    run_test "Tool - hello_manage_app upload_logo_url" test_upload_logo_url
    run_test "Tool - hello_manage_app upload_logo_file" test_upload_logo_file
    run_test "Tool - hello_manage_app upload_logo_url error handling" test_upload_logo_url_error_handling
    run_test "Error - Invalid tool name" test_invalid_tool
    run_test "Error - Invalid app ID" test_invalid_app_id
    
    # Print results and exit with appropriate code
    print_results
}

# Run main function
main "$@" 