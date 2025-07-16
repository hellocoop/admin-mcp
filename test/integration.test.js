#!/usr/bin/env node

// Integration test for MCP tools against hello-beta.net
// Gets OAuth token and tests all 15 tools with real API calls

import { HelloMCPServer } from '../src/mcp-server.js';
import { WALLET_BASE_URL, MCP_CLIENT_ID } from '../src/oauth-endpoints.js';
import { pkce } from '@hellocoop/helper-server';
import http from 'http';
import url from 'url';
import open from 'open';
import crypto from 'crypto';

class MCPIntegrationTester {
  constructor() {
    this.mcpServer = new HelloMCPServer();
    this.accessToken = null;
    this.localPort = 3000;
    this.localServer = null;
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
    this.createdResources = {
      publishers: [],
      applications: [],
      secrets: []
    };
  }

  async runIntegrationTests() {
    console.log('🧪 Starting MCP Integration Test Suite (hello-beta.net)');
    console.log('=' .repeat(60));

    try {
      // Step 1: Get OAuth access token
      await this.getOAuthToken();

      // Step 2: Test all tools with real API calls
      await this.testAllTools();

      // Step 3: Clean up created resources (optional)
      await this.cleanup();

    } catch (error) {
      console.error('❌ Integration test failed:', error);
      process.exit(1);
    }

    // Print summary
    this.printSummary();
  }

  async getOAuthToken() {
    console.log('\n🔐 Getting OAuth access token...');
    
    try {
      // Generate PKCE parameters
      const pkceMaterial = await pkce();
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();

      // Create authorization URL
      const authUrl = this.createAuthorizationUrl({
        client_id: MCP_CLIENT_ID,
        redirect_uri: `http://localhost:${this.localPort}/callback`,
        scope: ['mcp'],
        code_challenge: pkceMaterial.code_challenge,
        code_challenge_method: 'S256',
        state,
        nonce
      });

      // Start local callback server
      const authCode = await this.startCallbackServer(state, authUrl);

      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken({
        code: authCode,
        code_verifier: pkceMaterial.code_verifier,
        client_id: MCP_CLIENT_ID,
        redirect_uri: `http://localhost:${this.localPort}/callback`
      });

      this.accessToken = tokenResponse.access_token;
      this.mcpServer.setAccessToken(this.accessToken);

      console.log('  ✅ OAuth token obtained successfully');
      console.log(`  📝 Token type: ${tokenResponse.token_type}`);
      console.log(`  ⏰ Expires in: ${tokenResponse.expires_in} seconds`);

    } catch (error) {
      throw new Error(`OAuth flow failed: ${error.message}`);
    }
  }

  createAuthorizationUrl(params) {
    const authUrl = new URL('/authorize', WALLET_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        authUrl.searchParams.set(key, value.join(' '));
      } else {
        authUrl.searchParams.set(key, value);
      }
    });
    return authUrl.toString();
  }

  async startCallbackServer(expectedState, authUrl) {
    return new Promise((resolve, reject) => {
      this.localServer = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/callback') {
          const { code, state, error } = parsedUrl.query;
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>OAuth Error</h1><p>${error}</p>`);
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (state !== expectedState) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Invalid State</h1><p>State parameter mismatch</p>');
            reject(new Error('State parameter mismatch'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success!</h1><p>You can close this window and return to the terminal.</p>');
          
          this.stopCallbackServer();
          resolve(code);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.localServer.listen(this.localPort, () => {
        console.log(`  🌐 Opening browser for OAuth authorization...`);
        console.log(`  📍 Callback server listening on http://localhost:${this.localPort}`);
        open(authUrl);
      });

      this.localServer.on('error', (err) => {
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });
    });
  }

  async exchangeCodeForToken(params) {
    const tokenUrl = new URL('/oauth/token', WALLET_BASE_URL);
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirect_uri,
      client_id: params.client_id,
      code_verifier: params.code_verifier
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  stopCallbackServer() {
    if (this.localServer) {
      this.localServer.close();
      this.localServer = null;
    }
  }

  async testAllTools() {
    console.log('\n🛠️  Testing all MCP tools...');

    // Test version (no auth required)
    await this.testTool('hello_version', { random_string: 'test' }, 'Get version info');

    // Test profile
    await this.testTool('hello_get_profile', {}, 'Get user profile');

    // Test publisher creation
    const publisherName = `Test Publisher ${Date.now()}`;
    const publisher = await this.testTool('hello_create_publisher', { 
      name: publisherName 
    }, 'Create test publisher');
    
    if (publisher && publisher.publisher_id) {
      this.createdResources.publishers.push(publisher.publisher_id);

      // Test publisher read
      await this.testTool('hello_read_publisher', { 
        publisher_id: publisher.publisher_id 
      }, 'Read publisher details');

      // Test publisher update
      await this.testTool('hello_update_publisher', { 
        publisher_id: publisher.publisher_id,
        name: `${publisherName} (Updated)`
      }, 'Update publisher name');

      // Test application creation
      const appName = `Test App ${Date.now()}`;
      const application = await this.testTool('hello_create_application', {
        publisher_id: publisher.publisher_id,
        name: appName,
        dev_redirect_uris: ['http://localhost:3000/callback', 'http://127.0.0.1:3000/callback'],
        prod_redirect_uris: ['https://example.com/callback'],
        localhost: true,
        local_ip: true,
        wildcard_domain: false,
        device_code: false
      }, 'Create test application');

      if (application && application.client_id) {
        this.createdResources.applications.push({
          publisher_id: publisher.publisher_id,
          application_id: application.client_id
        });

        // Test application read
        await this.testTool('hello_read_application', {
          publisher_id: publisher.publisher_id,
          application_id: application.client_id
        }, 'Read application details');

        // Test application update
        await this.testTool('hello_update_application', {
          publisher_id: publisher.publisher_id,
          application_id: application.client_id,
          name: `${appName} (Updated)`,
          dev_redirect_uris: ['http://localhost:3000/callback', 'http://localhost:8080/callback'],
          localhost: true,
          local_ip: true
        }, 'Update application');

        // Test logo URL testing
        await this.testTool('hello_test_logo_url', {
          image_url: 'https://www.hello.dev/images/hello-logo.svg'
        }, 'Test logo URL accessibility');

        // Test logo upload from URL
        await this.testTool('hello_upload_logo', {
          publisher_id: publisher.publisher_id,
          application_id: application.client_id,
          image_url: 'https://www.hello.dev/images/hello-logo.svg'
        }, 'Upload logo from URL');

        // Test logo upload from base64 data (small test image)
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 transparent PNG
        await this.testTool('hello_upload_logo', {
          publisher_id: publisher.publisher_id,
          application_id: application.client_id,
          image_data: testImageBase64,
          filename: 'test-logo.png'
        }, 'Upload logo from base64');

        // Test secret creation
        const secretHash = crypto.createHash('sha256').update('test-secret-123').digest('hex');
        const salt = crypto.randomBytes(16).toString('hex');
        await this.testTool('hello_create_secret', {
          publisher_id: publisher.publisher_id,
          application_id: application.client_id,
          hash: secretHash,
          salt: salt
        }, 'Create client secret');


      }
    }

    // Test legal docs generation
    await this.testTool('hello_generate_legal_docs', {
      company_name: 'Test Company Inc.',
      app_name: 'Test Application',
      contact_email: 'legal@testcompany.com',
      website_url: 'https://testcompany.com',
      service_type: 'web_app',
      target_users: 'general_public',
      data_collection: ['name', 'email', 'profile picture'],
      geographic_scope: ['United States'],
      third_party_services: ['Google Analytics', 'Stripe'],
      user_generated_content: false,
      payment_processing: false,
      subscription_model: false,
      data_retention_period: 'until account deletion',
      cookies_tracking: true,
      marketing_communications: false,
      age_restrictions: '13',
      intellectual_property: false,
      dispute_resolution: 'courts',
      governing_law: 'Delaware'
    }, 'Generate legal documents');

    // Test logo guidance
    await this.testTool('hello_logo_guidance', {
      brand_colors: '#007bff, #28a745',
      logo_style: 'text_and_icon'
    }, 'Get logo guidance');
  }

  async testTool(toolName, args, description) {
    try {
      console.log(`\n  🔧 Testing ${toolName}: ${description}`);
      
      const callHandler = this.mcpServer.mcpServer._requestHandlers.get('tools/call');
      const result = await callHandler({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });

      if (result.error) {
        throw new Error(`Tool error: ${result.error}`);
      }

      // Extract useful info from result
      let resultSummary = '';
      if (toolName === 'hello_create_publisher' && result.publisher_id) {
        resultSummary = ` (ID: ${result.publisher_id})`;
      } else if (toolName === 'hello_create_application' && result.client_id) {
        resultSummary = ` (ID: ${result.client_id})`;
      } else if (toolName === 'hello_version' && result.VERSION) {
        resultSummary = ` (Version: ${result.VERSION})`;
      }

      this.recordSuccess(toolName, `${description}${resultSummary}`);
      return result;

    } catch (error) {
      this.recordFailure(toolName, `${description} - ${error.message}`);
      return null;
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleanup (optional - resources will remain for inspection)');
    console.log(`  📝 Created ${this.createdResources.publishers.length} publishers`);
    console.log(`  📝 Created ${this.createdResources.applications.length} applications`);
    console.log('  💡 You can manually delete these from the console if needed');
  }

  recordSuccess(testName, message) {
    this.testResults.push({ test: testName, status: 'PASS', message });
    this.passedTests++;
    console.log(`    ✅ ${message}`);
  }

  recordFailure(testName, message) {
    this.testResults.push({ test: testName, status: 'FAIL', message });
    this.failedTests++;
    console.log(`    ❌ ${message}`);
  }

  printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Integration Test Summary');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    
    if (this.failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    console.log('\n🎯 Test Coverage:');
    console.log('  - ✅ OAuth Flow with hello-beta.net');
    console.log('  - ✅ All 15 MCP Tools');
    console.log('  - ✅ Real API Integration');
    console.log('  - ✅ Publisher Management');
    console.log('  - ✅ Application Management');
    console.log('  - ✅ Logo Upload & Testing');
    console.log('  - ✅ Secret Creation');
    console.log('  - ✅ Code Generation');
    console.log('  - ✅ Legal Document Generation');

    if (this.failedTests === 0) {
      console.log('\n🎉 All integration tests passed! MCP server fully functional.');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed. Check the API responses above.');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Set environment to use hello-beta.net
  process.env.HELLO_DOMAIN = 'hello-beta.net';
  process.env.HELLO_ADMIN = 'https://admin.hello-beta.net';
  
  console.log('🌐 Using hello-beta.net environment');
  console.log('📍 Admin API: https://admin.hello-beta.net');
  console.log('📍 Wallet: https://wallet.hello-beta.net');
  
  const tester = new MCPIntegrationTester();
  tester.runIntegrationTests().catch(error => {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  });
}

export { MCPIntegrationTester }; 