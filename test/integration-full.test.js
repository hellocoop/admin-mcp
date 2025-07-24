#!/usr/bin/env node

// Full Integration Tests for MCP Server
// Tests complete MCP client flow with mock Admin server

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const MOCK_ADMIN_PORT = 3334;
const MOCK_ADMIN_URL = `http://localhost:${MOCK_ADMIN_PORT}`;

class IntegrationTestSuite {
  constructor() {
    this.mockAdminServer = null;
    this.mcpHttpServer = null;
    this.mcpServerUrl = null;
    this.validToken = null;
    this.expiredToken = null;
    this.testResults = [];
  }

  async setup() {
    console.log('🔧 Setting up integration test environment...');
    
    // Set environment variable BEFORE any imports
    process.env.HELLO_ADMIN = MOCK_ADMIN_URL;
    
    // Start mock admin server
    await this.startMockAdminServer();
    
    // Generate test tokens
    await this.generateTestTokens();
    
    // Start MCP HTTP server
    await this.startMCPHttpServer();
    
    // Verify config
    const { HELLO_ADMIN } = await import('../src/config.js');
    console.log(`🔧 Using Admin API URL: ${HELLO_ADMIN}`);
    console.log(`🔧 Using MCP Server URL: ${this.mcpServerUrl}`);
    
    console.log('✅ Test environment ready');
  }

  async startMockAdminServer() {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting mock admin server on port ${MOCK_ADMIN_PORT}...`);
      
      this.mockAdminServer = spawn('node', [
        path.join(__dirname, 'mock-admin-server.js')
      ], {
        env: { 
          ...process.env, 
          MOCK_ADMIN_PORT: MOCK_ADMIN_PORT.toString(),
          MOCK_ADMIN_HOST: 'localhost'
        },
        stdio: 'pipe'
      });

      let serverReady = false;
      
      this.mockAdminServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Mock Admin Server listening') && !serverReady) {
          serverReady = true;
          console.log('✅ Mock admin server started');
          resolve();
        }
      });

      this.mockAdminServer.stderr.on('data', (data) => {
        console.error('Mock server stderr:', data.toString());
      });

      this.mockAdminServer.on('error', reject);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Mock admin server failed to start within 10 seconds'));
        }
      }, 10000);
    });
  }

  async generateTestTokens() {
    console.log('🔑 Generating test tokens...');
    
    try {
      // Generate valid token
      const validTokenResponse = await fetch(`${MOCK_ADMIN_URL}/token/valid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub: 'user123', expiresIn: 3600 })
      });
      const validTokenData = await validTokenResponse.json();
      this.validToken = validTokenData.access_token;

      // Generate expired token
      const expiredTokenResponse = await fetch(`${MOCK_ADMIN_URL}/token/expired`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub: 'user123' })
      });
      const expiredTokenData = await expiredTokenResponse.json();
      this.expiredToken = expiredTokenData.access_token;

      console.log('✅ Test tokens generated');
    } catch (error) {
      throw new Error(`Failed to generate test tokens: ${error.message}`);
    }
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = performance.now();
    
    try {
      await testFn();
      const duration = Math.round(performance.now() - startTime);
      console.log(`  ✅ ${testName} (${duration}ms)`);
      this.testResults.push({ name: testName, status: 'PASS', duration });
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      console.error(`  ❌ ${testName} (${duration}ms): ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAIL', duration, error: error.message });
    }
  }

  // Test MCP protocol basics
  async testMCPProtocol() {
    await this.runTest('MCP Protocol - List Tools', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      if (!response.result || !Array.isArray(response.result.tools)) {
        throw new Error('Invalid tools list response');
      }

      if (response.result.tools.length === 0) {
        throw new Error('No tools returned');
      }

      // Verify expected tools are present
      const toolNames = response.result.tools.map(tool => tool.name);
      const expectedTools = ['hello_get_profile', 'hello_create_publisher', 'hello_manage_app'];
      
      for (const expectedTool of expectedTools) {
        if (!toolNames.includes(expectedTool)) {
          throw new Error(`Expected tool ${expectedTool} not found`);
        }
      }
    });

    await this.runTest('MCP Protocol - List Resources', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {}
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      if (!response.result || !Array.isArray(response.result.resources)) {
        throw new Error('Invalid resources list response');
      }
    });
  }

  // Test authentication flow
  async testAuthenticationFlow() {
    await this.runTest('Auth - Tool call without token (401)', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'hello_get_profile',
          arguments: {}
        }
      };

      // Don't set any token
      this.mcpServer.setAccessToken(null);

      const response = await this.mcpServer.handleRequest(request);
      
      if (!response.error) {
        throw new Error('Expected authentication error, but request succeeded');
      }

      // Should get authentication error
      if (!response.error.message.includes('Authentication')) {
        throw new Error(`Expected authentication error, got: ${response.error.message}`);
      }
    });

    await this.runTest('Auth - Tool call with expired token (401)', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'hello_get_profile',
          arguments: {}
        }
      };

      // Set expired token
      this.mcpServer.setAccessToken(this.expiredToken);

      const response = await this.mcpServer.handleRequest(request);
      
      if (!response.error) {
        throw new Error('Expected authentication error for expired token, but request succeeded');
      }

      // Should get authentication error
      if (!response.error.message.includes('Authentication')) {
        throw new Error(`Expected authentication error, got: ${response.error.message}`);
      }
    });

    await this.runTest('Auth - Tool call with valid token (success)', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'hello_get_profile',
          arguments: {}
        }
      };

      // Set valid token
      this.mcpServer.setAccessToken(this.validToken);

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Unexpected error with valid token: ${response.error.message}`);
      }

      if (!response.result) {
        throw new Error('Expected successful response with valid token');
      }

      // Should have content or contents field
      if (!response.result.content && !response.result.contents) {
        throw new Error('Expected content in successful response');
      }
    });
  }

  // Test all MCP tools
  async testMCPTools() {
    // Set valid token for all tool tests
    this.mcpServer.setAccessToken(this.validToken);

    await this.runTest('Tool - hello_get_profile', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'hello_get_profile',
          arguments: {}
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      // Verify response structure
      if (!response.result || (!response.result.content && !response.result.contents)) {
        throw new Error('Invalid tool response structure');
      }

      // Parse the JSON content to verify it contains expected data
      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      
      if (!textContent) {
        throw new Error('No text content in response');
      }

      const data = JSON.parse(textContent);
      if (!data.user || !data.publishers) {
        throw new Error('Expected user and publishers data in profile response');
      }
    });

    await this.runTest('Tool - hello_create_publisher', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'hello_create_publisher',
          arguments: {
            name: 'Test Publisher from MCP'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      // Verify new publisher was created
      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (!data.id || !data.name) {
        throw new Error('Invalid publisher creation response');
      }

      if (data.name !== 'Test Publisher from MCP') {
        throw new Error('Publisher name not set correctly');
      }
    });

    await this.runTest('Tool - hello_read_publisher', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'hello_read_publisher',
          arguments: {
            publisher_id: 'pub123'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (!data.id || !data.applications) {
        throw new Error('Invalid publisher read response');
      }

      if (data.id !== 'pub123') {
        throw new Error('Wrong publisher returned');
      }
    });

    await this.runTest('Tool - hello_manage_app create', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'hello_manage_app',
          arguments: {
            action: 'create',
            team_id: 'pub123',
            name: 'Test MCP App',
            dev_redirect_uris: ['http://localhost:8080/callback'],
            device_code: true
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (!data.id || !data.name || !data.web) {
        throw new Error('Invalid application creation response');
      }

      if (data.name !== 'Test MCP App') {
        throw new Error('Application name not set correctly');
      }

      if (!data.device_code) {
        throw new Error('Device code not set correctly');
      }

      if (!data.web.dev.redirect_uris.includes('http://localhost:8080/callback')) {
        throw new Error('Redirect URI not set correctly');
      }
    });

    await this.runTest('Tool - hello_manage_app read', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'hello_manage_app',
          arguments: {
            action: 'read',
            client_id: 'app123'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (!data.id || !data.publisher_id) {
        throw new Error('Invalid application read response');
      }

      if (data.id !== 'app123' || data.publisher_id !== 'pub123') {
        throw new Error('Wrong application returned');
      }
    });

    await this.runTest('Tool - hello_manage_app update', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'hello_manage_app',
          arguments: {
            action: 'update',
            client_id: 'app123',
            name: 'Updated Test Application',
            tos_uri: 'https://example.com/updated-tos'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (data.name !== 'Updated Test Application') {
        throw new Error('Application name not updated correctly');
      }

      if (data.tos_uri !== 'https://example.com/updated-tos') {
        throw new Error('TOS URI not updated correctly');
      }
    });

    await this.runTest('Tool - hello_create_secret', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'hello_create_secret',
          arguments: {
            publisher_id: 'pub123',
            application_id: 'app123',
            hash: 'test-hash-value',
            salt: 'test-salt-value'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (response.error) {
        throw new Error(`Tool error: ${response.error.message}`);
      }

      const content = response.result.content || response.result.contents;
      const textContent = Array.isArray(content) ? content[0]?.text : content[0]?.text;
      const data = JSON.parse(textContent);
      
      if (!data.message || !data.hash || !data.salt) {
        throw new Error('Invalid secret creation response');
      }

      if (data.hash !== 'test-hash-value' || data.salt !== 'test-salt-value') {
        throw new Error('Secret values not set correctly');
      }
    });
  }

  // Test error handling
  async testErrorHandling() {
    this.mcpServer.setAccessToken(this.validToken);

    await this.runTest('Error - Invalid tool name', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (!response.error) {
        throw new Error('Expected error for invalid tool name');
      }

      if (!response.error.message.includes('Unknown tool')) {
        throw new Error(`Expected "Unknown tool" error, got: ${response.error.message}`);
      }
    });

    await this.runTest('Error - Invalid publisher ID', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: {
          name: 'hello_read_publisher',
          arguments: {
            publisher_id: 'nonexistent-publisher'
          }
        }
      };

      const response = await this.mcpServer.handleRequest(request);
      
      if (!response.error) {
        throw new Error('Expected error for invalid publisher ID');
      }
    });
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    
    if (this.mockAdminServer) {
      this.mockAdminServer.kill('SIGTERM');
      console.log('✅ Mock admin server stopped');
    }
    
    // Reset environment
    delete process.env.HELLO_ADMIN;
  }

  async run() {
    try {
      console.log('🚀 Starting MCP Integration Tests');
      console.log('==================================================');

      await this.setup();

      // Run test suites
      await this.testMCPProtocol();
      await this.testAuthenticationFlow();
      await this.testMCPTools();
      await this.testErrorHandling();

      // Print results
      this.printResults();

    } catch (error) {
      console.error('\n💥 Test setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  printResults() {
    console.log('\n==================================================');
    console.log('📊 Test Results Summary');
    console.log('==================================================');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    console.log('\n🎯 Test Coverage:');
    console.log('  - ✅ MCP Protocol (tools/list, resources/list)');
    console.log('  - ✅ Authentication Flow (no token, expired token, valid token)');
    console.log('  - ✅ All MCP Tools (profile, publishers, applications, secrets)');
    console.log('  - ✅ Error Handling (invalid tools, invalid IDs)');
    console.log('  - ✅ Mock Admin Server Integration');

    if (failed === 0) {
      console.log('\n🎉 All integration tests passed! MCP server is working correctly with mock Admin API.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new IntegrationTestSuite();
  testSuite.run().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { IntegrationTestSuite }; 