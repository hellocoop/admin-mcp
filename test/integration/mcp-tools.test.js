import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Integration Tests', function() {
  const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
  const MOCK_ADMIN_URL = process.env.MOCK_ADMIN_URL || 'http://localhost:3333';

  let validToken;
  let expiredToken;
  let testClientId; // Will be set when we create a test app

  // Helper function to make JSON-RPC requests
  async function makeJSONRPCRequest(method, params = {}, token = null) {
    const payload = {
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method,
      params
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    return {
      status: response.status,
      headers: response.headers,
      data: await response.json()
    };
  }

  // Helper function to call MCP tools
  async function callTool(toolName, args = {}, token = null) {
    return makeJSONRPCRequest('tools/call', {
      name: toolName,
      arguments: args
    }, token);
  }

  // Helper function to parse MCP tool result content
  function parseMCPContent(response) {
    if (!response.data || !response.data.result || !response.data.result.contents) {
      throw new Error('Invalid MCP response structure');
    }

    const content = response.data.result.contents[0];
    if (!content || content.type !== 'text') {
      throw new Error('Expected text content in MCP response');
    }

    return JSON.parse(content.text);
  }

  // Helper function to get tokens from mock admin server
  async function getToken(endpoint) {
    const response = await fetch(`${MOCK_ADMIN_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (!response.ok) {
      throw new Error(`Failed to get token from ${endpoint}: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  before(async function() {
    this.timeout(30000);
    console.log('🔑 Getting test tokens...');
    
    try {
      validToken = await getToken('/token/valid');
      expiredToken = await getToken('/token/expired');
      
      expect(validToken).to.be.a('string').and.not.be.empty;
      expect(expiredToken).to.be.a('string').and.not.be.empty;
      
      console.log('✅ Test tokens obtained');
    } catch (error) {
      throw new Error(`Failed to setup test tokens: ${error.message}`);
    }
  });

  describe('MCP Protocol', function() {
    it('should list available tools', async function() {
      const response = await makeJSONRPCRequest('tools/list');
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('jsonrpc', '2.0');
      expect(response.data).to.have.property('result');
      expect(response.data.result).to.have.property('tools');
      expect(response.data.result.tools).to.be.an('array');
      expect(response.data.result.tools).to.have.length.at.least(1);
      
      // Check that hello_manage_app tool exists
      const tool = response.data.result.tools.find(t => t.name === 'hello_manage_app');
      expect(tool).to.exist;
      expect(tool).to.have.property('description');
      expect(tool).to.have.property('inputSchema');
    });

    it('should list available resources', async function() {
      const response = await makeJSONRPCRequest('resources/list');
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('jsonrpc', '2.0');
      expect(response.data).to.have.property('result');
      expect(response.data.result).to.have.property('resources');
      expect(response.data.result.resources).to.be.an('array');
      expect(response.data.result.resources).to.have.length.at.least(1);
    });
  });

  describe('Authentication', function() {
    it('should reject tool calls without token', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'create',
        name: 'Test App'
      });
      
      expect(response.status).to.equal(401);
      
      // Validate WWW-Authenticate header for missing token
      expect(response.headers.get('www-authenticate')).to.equal('Bearer');
      
      // Validate JSON-RPC error response
      expect(response.data).to.have.property('error');
      expect(response.data.error).to.have.property('code', -32001);
      expect(response.data.error).to.have.property('message', 'Authentication required');
      expect(response.data.error).to.have.property('data');
      expect(response.data.error.data).to.have.property('error', 'invalid_request');
      expect(response.data.error.data).to.have.property('error_description', 'Authorization header required');
    });

    it('should reject tool calls with expired token', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'create',
        name: 'Test App'
      }, expiredToken);
      
      expect(response.status).to.equal(401);
      
      // Validate WWW-Authenticate header for expired token
      const wwwAuth = response.headers.get('www-authenticate');
      expect(wwwAuth).to.include('Bearer realm="Hello MCP Server"');
      expect(wwwAuth).to.include('error="invalid_token"');
      expect(wwwAuth).to.include('error_description="Token has expired"');
      expect(wwwAuth).to.include('scope=mcp');
      expect(wwwAuth).to.include('resource_metadata="https://admin-mcp.hello.coop/.well-known/oauth-protected-resource"');
      
      // Validate JSON-RPC error response
      expect(response.data).to.have.property('error');
      expect(response.data.error).to.have.property('code', -32001);
      expect(response.data.error).to.have.property('message', 'Authentication required');
      expect(response.data.error).to.have.property('data');
      expect(response.data.error.data).to.have.property('error', 'invalid_token');
      expect(response.data.error.data).to.have.property('error_description', 'Token has expired');
    });

    it('should return correct OAuth 2.0 scope and resource metadata', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'read'
      }, expiredToken);
      
      expect(response.status).to.equal(401);
      
      // Get the full WWW-Authenticate header for detailed validation
      const wwwAuth = response.headers.get('www-authenticate');
      
      // Validate exact OAuth 2.0 scope
      expect(wwwAuth).to.match(/scope=mcp(?:,|\s|$)/);
      
      // Validate exact resource metadata URL
      expect(wwwAuth).to.match(/resource_metadata="https:\/\/admin-mcp\.hello\.coop\/\.well-known\/oauth-protected-resource"/);
      
      // Log the full header for documentation purposes
      console.log('📋 Full WWW-Authenticate header:', wwwAuth);
    });

    it('should accept tool calls with valid token', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'read'
      }, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('result');
      expect(response.data).to.not.have.property('error');
      
      const content = parseMCPContent(response);
      expect(content).to.have.property('profile');
    });
  });

  describe('hello_manage_app Tool', function() {
    describe('read action', function() {
      it('should return profile when no client_id provided', async function() {
        const response = await callTool('hello_manage_app', {
          action: 'read'
        }, validToken);
        
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('result');
        
        const content = parseMCPContent(response);
        expect(content).to.have.property('profile');
        expect(content.profile).to.have.property('user');
        expect(content.profile.user).to.have.property('id');
        expect(content.profile.user).to.have.property('name');
        expect(content.profile).to.have.property('applications');
        expect(content.profile.applications).to.be.an('array');
      });

      it('should return applications for specific team when team_id provided', async function() {
        // First get the profile to see available teams
        const profileResponse = await callTool('hello_manage_app', {
          action: 'read'
        }, validToken);
        
        expect(profileResponse.status).to.equal(200);
        const profileContent = parseMCPContent(profileResponse);
        
        // Should have default team applications
        expect(profileContent.profile.applications).to.be.an('array');
        expect(profileContent.profile.teams).to.be.an('array');
        expect(profileContent.profile.teams.length).to.be.at.least(1);
        
        // Now test reading a specific team's applications
        const teamId = profileContent.profile.teams[0].id;
        const teamResponse = await callTool('hello_manage_app', {
          action: 'read',
          team_id: teamId
        }, validToken);
        
        expect(teamResponse.status).to.equal(200);
        const teamContent = parseMCPContent(teamResponse);
        
        // Should return applications for the specific team
        expect(teamContent.profile.applications).to.be.an('array');
        expect(teamContent.profile.teams).to.be.an('array');
        expect(teamContent.profile.teams.length).to.equal(1); // Only the requested team
        expect(teamContent.profile.teams[0].id).to.equal(teamId);
        
        console.log(`📋 Applications found for team ${teamId}:`);
        teamContent.profile.applications.forEach(app => {
          console.log(`   - ${app.name} (ID: ${app.id})`);
        });
      });

      it('should return profile and app when client_id provided', async function() {
        // First create a test app if we don't have one
        if (!testClientId) {
          const createResponse = await callTool('hello_manage_app', {
            action: 'create',
            name: 'Test App for Read',
            tos_uri: 'https://example.com/tos',
            pp_uri: 'https://example.com/privacy'
          }, validToken);
          
          expect(createResponse.status).to.equal(200);
          const createContent = parseMCPContent(createResponse);
          testClientId = createContent.application.id;
        }
        
        const response = await callTool('hello_manage_app', {
          action: 'read',
          client_id: testClientId
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        expect(content).to.have.property('profile');
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('id', testClientId);
      });
    });

    describe('create action', function() {
      it('should create app with auto-generated name', async function() {
        const response = await callTool('hello_manage_app', {
          action: 'create'
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        expect(content).to.have.property('profile');
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('id');
        expect(content.application).to.have.property('name');
        expect(content.application.name).to.include('App');
        expect(content).to.have.property('action_result');
        expect(content.action_result).to.have.property('success', true);
      });

      it('should create app with specified parameters', async function() {
        const appName = 'Full Test App';
        const response = await callTool('hello_manage_app', {
          action: 'create',
          name: appName,
          tos_uri: 'https://example.com/tos',
          pp_uri: 'https://example.com/privacy',
          dev_localhost: true,
          dev_127_0_0_1: true,
          dev_wildcard: false,
          dev_redirect_uris: ['http://localhost:3000/callback'],
          prod_redirect_uris: ['https://example.com/callback'],
          device_code: true
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('name', appName);
        expect(content.application).to.have.property('tos_uri', 'https://example.com/tos');
        expect(content.application).to.have.property('pp_uri', 'https://example.com/privacy');
        expect(content.application).to.have.property('device_code', true);
        
        // Store this client_id for other tests if we don't have one yet
        if (!testClientId) {
          testClientId = content.application.id;
        }
      });
    });

    describe('update action', function() {
      it('should update existing application', async function() {
        // Ensure we have a test app
        if (!testClientId) {
          const createResponse = await callTool('hello_manage_app', {
            action: 'create',
            name: 'App to Update',
            tos_uri: 'https://example.com/tos',
            pp_uri: 'https://example.com/privacy'
          }, validToken);
          
          const createContent = parseMCPContent(createResponse);
          testClientId = createContent.application.id;
        }
        
        const response = await callTool('hello_manage_app', {
          action: 'update',
          client_id: testClientId,
          name: 'Updated Test App',
          tos_uri: 'https://example.com/updated-tos'
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('name', 'Updated Test App');
        expect(content.application).to.have.property('tos_uri', 'https://example.com/updated-tos');
      });

      it('should validate redirect URIs and prevent production URI deletion', async function() {
        // Create a test app with initial production redirect URIs
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'Redirect URI Test App',
          prod_redirect_uris: [
            'https://example.com/callback',
            'https://app.example.com/auth',
            'vscode://hellocoop.auth/callback'
          ],
          dev_redirect_uris: [
            'http://localhost:3000/callback',
            'https://dev.example.com/callback'
          ]
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        const appId = createContent.application.id;
        
        // Verify initial URIs were set correctly (using flattened properties)
        expect(createContent.application.prod_redirect_uris).to.deep.include.members([
          'https://example.com/callback',
          'https://app.example.com/auth',
          'vscode://hellocoop.auth/callback'
        ]);
        expect(createContent.application.dev_redirect_uris).to.deep.include.members([
          'http://localhost:3000/callback',
          'https://dev.example.com/callback'
        ]);
        
        // Update with new production URIs - should create superset (not replace)
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: appId,
          prod_redirect_uris: [
            'https://newapp.example.com/callback',  // New valid HTTPS URI
            'myapp://auth/callback'                 // New valid custom scheme
          ],
          dev_redirect_uris: [
            'http://localhost:4000/callback'        // Replace dev URIs (allowed)
          ]
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // Production URIs should be a superset (old + new)
        const prodUris = updateContent.application.prod_redirect_uris;
        expect(prodUris).to.include('https://example.com/callback');           // Original
        expect(prodUris).to.include('https://app.example.com/auth');           // Original  
        expect(prodUris).to.include('vscode://hellocoop.auth/callback');       // Original
        expect(prodUris).to.include('https://newapp.example.com/callback');    // New
        expect(prodUris).to.include('myapp://auth/callback');                  // New
        expect(prodUris).to.have.length(5);
        
        // Development URIs should be replaced (not merged)
        const devUris = updateContent.application.dev_redirect_uris;
        expect(devUris).to.deep.equal(['http://localhost:4000/callback']);
      });

      it('should reject invalid production redirect URIs', async function() {
        // Create a test app
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'Invalid URI Test App',
          prod_redirect_uris: ['https://valid.example.com/callback']
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        const appId = createContent.application.id;
        
        // Try to update with invalid production URIs
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: appId,
          prod_redirect_uris: [
            'http://insecure.example.com/callback',     // Invalid: HTTP in production
            'ftp://files.example.com/callback',         // Invalid: unsupported scheme
            'https://newvalid.example.com/callback',    // Valid: HTTPS
            'customapp://auth/callback'                 // Valid: custom scheme
          ]
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // Should only keep valid URIs (original + valid new ones)
        const prodUris = updateContent.application.prod_redirect_uris;
        expect(prodUris).to.include('https://valid.example.com/callback');     // Original
        expect(prodUris).to.include('https://newvalid.example.com/callback');  // Valid new
        expect(prodUris).to.include('customapp://auth/callback');              // Valid custom scheme
        expect(prodUris).to.not.include('http://insecure.example.com/callback'); // Invalid HTTP
        expect(prodUris).to.not.include('ftp://files.example.com/callback');   // Invalid scheme
      });

      it('should allow HTTP and other schemes in development', async function() {
        // Create a test app
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'Dev URI Test App',
          dev_redirect_uris: [
            'http://localhost:3000/callback',
            'https://dev.example.com/callback'
          ]
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        const appId = createContent.application.id;
        
        // Update with various development URIs (should allow more flexibility)
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: appId,
          dev_redirect_uris: [
            'http://localhost:4000/callback',          // HTTP is OK in dev
            'https://staging.example.com/callback',    // HTTPS is OK
            'devapp://test/callback',                  // Custom schemes OK
            'http://192.168.1.100:3000/callback'      // Local IP OK in dev
          ]
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // All URIs should be accepted in development
        const devUris = updateContent.application.dev_redirect_uris;
        expect(devUris).to.include('http://localhost:4000/callback');
        expect(devUris).to.include('https://staging.example.com/callback');
        expect(devUris).to.include('devapp://test/callback');
        expect(devUris).to.include('http://192.168.1.100:3000/callback');
      });

      it('should reject completely invalid URLs', async function() {
        // Create a test app
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'Invalid URL Test App',
          prod_redirect_uris: ['https://valid.example.com/callback']
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        const appId = createContent.application.id;
        
        // Try to update with completely invalid URLs
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: appId,
          prod_redirect_uris: [
            'not-a-url-at-all',                     // Invalid: not a URL
            'http://insecure.example.com/callback', // Invalid: HTTP in production
            'https://valid.example.com/new',        // Valid: should be added
            'just-text-no-protocol',                // Invalid: no protocol
            '',                                     // Invalid: empty string
            'https://another-valid.com/callback',   // Valid: should be added
            'customscheme://valid/path'             // Valid: custom scheme should be allowed
          ],
          dev_redirect_uris: [
            'not-a-dev-url',                        // Invalid: should be filtered
            'http://localhost:3000/callback',       // Valid: should be added
            'just plain text',                      // Invalid: not a URL at all
            'https://dev.example.com/callback',     // Valid: should be added
            'anycustom://anything/goes'             // Valid: custom schemes allowed
          ]
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // Production URIs should only contain valid ones (original + valid new)
        const prodUris = updateContent.application.prod_redirect_uris;
        expect(prodUris).to.include('https://valid.example.com/callback');    // Original
        expect(prodUris).to.include('https://valid.example.com/new');         // Valid new
        expect(prodUris).to.include('https://another-valid.com/callback');    // Valid new
        expect(prodUris).to.include('customscheme://valid/path');             // Valid custom scheme
        expect(prodUris).to.not.include('not-a-url-at-all');                 // Invalid
        expect(prodUris).to.not.include('http://insecure.example.com/callback'); // Invalid HTTP
        expect(prodUris).to.not.include('just-text-no-protocol');            // Invalid
        expect(prodUris).to.not.include('');                                 // Invalid
        expect(prodUris).to.have.length(4); // Only the 4 valid ones
        
        // Development URIs should only contain valid ones
        const devUris = updateContent.application.dev_redirect_uris;
        expect(devUris).to.include('http://localhost:3000/callback');         // Valid
        expect(devUris).to.include('https://dev.example.com/callback');       // Valid
        expect(devUris).to.include('anycustom://anything/goes');              // Valid custom scheme
        expect(devUris).to.not.include('not-a-dev-url');                     // Invalid
        expect(devUris).to.not.include('just plain text');                   // Invalid
        expect(devUris).to.have.length(3); // Only the 3 valid ones
      });

      it('should include warning messages for rejected URLs', async function() {
        // Create a test app
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'Warning Test App',
          prod_redirect_uris: [
            'https://valid.example.com/callback',
            'not-a-url',                             // Invalid: will be rejected
            'http://insecure.example.com/callback'   // Invalid: HTTP in production
          ],
          dev_redirect_uris: [
            'http://localhost:3000/callback',
            'invalid-dev-url'                        // Invalid: will be rejected
          ]
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        
        // Should have warnings about rejected URIs
        expect(createContent.action_result).to.have.property('warnings');
        expect(createContent.action_result.warnings).to.be.an('array');
        expect(createContent.action_result.warnings.length).to.equal(2); // One for dev, one for prod
        
        // Check warning messages contain rejected URIs
        const warningText = createContent.action_result.warnings.join(' ');
        expect(warningText).to.include('not-a-url');
        expect(warningText).to.include('http://insecure.example.com/callback');
        expect(warningText).to.include('invalid-dev-url');
        expect(warningText).to.include('invalid development redirect URI(s) rejected');
        expect(warningText).to.include('invalid production redirect URI(s) rejected');
        
        // Valid URIs should still be set
        expect(createContent.application.prod_redirect_uris).to.include('https://valid.example.com/callback');
        expect(createContent.application.dev_redirect_uris).to.include('http://localhost:3000/callback');
        
        console.log('📋 Create warnings:', createContent.action_result.warnings);
        
        // Now test update with more invalid URIs
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: createContent.application.id,
          prod_redirect_uris: [
            'https://new-valid.example.com/callback',
            'ftp://invalid.example.com/callback',    // Invalid: FTP scheme
            'javascript:alert(1)'                    // Invalid: JavaScript scheme
          ]
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // Should have warnings about rejected URIs in update
        expect(updateContent.action_result).to.have.property('warnings');
        expect(updateContent.action_result.warnings).to.be.an('array');
        expect(updateContent.action_result.warnings.length).to.equal(1); // Only prod URIs were updated
        
        const updateWarningText = updateContent.action_result.warnings[0];
        expect(updateWarningText).to.include('ftp://invalid.example.com/callback');
        expect(updateWarningText).to.include('javascript:alert(1)');
        expect(updateWarningText).to.include('2 invalid production redirect URI(s) rejected');
        
        // Should have superset of valid URIs (original + new valid)
        const finalProdUris = updateContent.application.prod_redirect_uris;
        expect(finalProdUris).to.include('https://valid.example.com/callback');      // Original
        expect(finalProdUris).to.include('https://new-valid.example.com/callback');  // New valid
        expect(finalProdUris).to.not.include('ftp://invalid.example.com/callback'); // Rejected
        expect(finalProdUris).to.not.include('javascript:alert(1)');                // Rejected
        
        console.log('📋 Update warnings:', updateContent.action_result.warnings);
      });

      it('should not include warnings when all URLs are valid', async function() {
        // Create a test app with all valid URIs
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'No Warning Test App',
          prod_redirect_uris: [
            'https://valid.example.com/callback',
            'customapp://auth/callback'
          ],
          dev_redirect_uris: [
            'http://localhost:3000/callback',
            'https://dev.example.com/callback'
          ]
        }, validToken);
        
        expect(createResponse.status).to.equal(200);
        const createContent = parseMCPContent(createResponse);
        
        // Should NOT have warnings when all URIs are valid
        expect(createContent.action_result).to.not.have.property('warnings');
        
        // Update with more valid URIs
        const updateResponse = await callTool('hello_manage_app', {
          action: 'update',
          client_id: createContent.application.id,
          prod_redirect_uris: ['https://another-valid.example.com/callback']
        }, validToken);
        
        expect(updateResponse.status).to.equal(200);
        const updateContent = parseMCPContent(updateResponse);
        
        // Should NOT have warnings when all URIs are valid
        expect(updateContent.action_result).to.not.have.property('warnings');
      });
    });

    describe('create_secret action', function() {
      it('should create client secret', async function() {
        // Ensure we have a test app
        if (!testClientId) {
          const createResponse = await callTool('hello_manage_app', {
            action: 'create',
            name: 'App for Secret',
            tos_uri: 'https://example.com/tos',
            pp_uri: 'https://example.com/privacy'
          }, validToken);
          
          const createContent = parseMCPContent(createResponse);
          testClientId = createContent.application.id;
        }
        
        const response = await callTool('hello_manage_app', {
          action: 'create_secret',
          client_id: testClientId
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        expect(content).to.have.property('client_secret');
        expect(content.client_secret).to.be.a('string').and.not.be.empty;
      });
    });

    describe('update_logo_from_url action', function() {
      it('should update logo from URL', async function() {
        // Ensure we have a test app
        if (!testClientId) {
          const createResponse = await callTool('hello_manage_app', {
            action: 'create',
            name: 'App for Logo URL',
            tos_uri: 'https://example.com/tos',
            pp_uri: 'https://example.com/privacy'
          }, validToken);
          
          const createContent = parseMCPContent(createResponse);
          testClientId = createContent.application.id;
        }
        
        const response = await callTool('hello_manage_app', {
          action: 'update_logo_from_url',
          client_id: testClientId,
          logo_url: 'http://mock-admin:3333/test-assets/playground-logo.png'
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        // Validate upload_result structure
        expect(content).to.have.property('upload_result');
        expect(content.upload_result).to.have.property('image_uri');
        expect(content.upload_result).to.have.property('message', 'Logo uploaded successfully');
        
        // Validate the mock server returned the expected URL format
        expect(content.upload_result.image_uri).to.match(/^https:\/\/mock-cdn\.hello\.coop\/logos\/.*\.png$/);
        
        // Validate action_result
        expect(content).to.have.property('action_result');
        expect(content.action_result).to.have.property('success', true);
        expect(content.action_result).to.have.property('action', 'update_logo_from_url');
        expect(content.action_result).to.have.property('logo_url');
        expect(content.action_result.logo_url).to.equal(content.upload_result.image_uri);
        
        // Validate the application was updated with the new logo URL
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('image_uri', content.upload_result.image_uri);
        
        // NEW: Validate that the mock admin received the correct data from URL
        const mockAdminResponse = await fetch(`${MOCK_ADMIN_URL}/test-data/uploaded-logo/${testClientId}`);
        expect(mockAdminResponse.ok, 'Mock admin should have stored the uploaded data from URL').to.be.true;
        
        const mockAdminData = await mockAdminResponse.json();
        expect(mockAdminData).to.have.property('uploadedData');
        
        const uploadedData = mockAdminData.uploadedData;
        expect(uploadedData).to.have.property('data');
        expect(uploadedData).to.have.property('mimetype', 'image/png');
        expect(uploadedData).to.have.property('size');
        expect(uploadedData.size).to.be.greaterThan(0);
        
        // Compare with the playground logo file that should have been fetched
        const logoPath = path.join(__dirname, '..', 'playground-logo.png');
        const expectedLogoBuffer = fs.readFileSync(logoPath);
        const expectedLogoBase64 = expectedLogoBuffer.toString('base64');
        
        expect(uploadedData.data).to.equal(expectedLogoBase64, 'Uploaded data from URL should match the playground logo file');
        
        console.log(`✅ URL Data validation passed: Expected ${expectedLogoBase64.length} chars, received ${uploadedData.data.length} chars`);
        console.log(`   File size: ${uploadedData.size} bytes, MIME type: ${uploadedData.mimetype}`);
      });

      it('should handle error for invalid app ID', async function() {
        const response = await callTool('hello_manage_app', {
          action: 'update_logo_from_url',
          client_id: 'invalid-app-id',
          logo_url: 'https://example.com/logo.png',
          logo_content_type: 'image/png'
        }, validToken);
        
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('error');
      });
    });

    describe('update_logo_from_data action', function() {
              it('should update logo from data', async function() {
        // Ensure we have a test app
        if (!testClientId) {
          const createResponse = await callTool('hello_manage_app', {
            action: 'create',
            name: 'App for Logo File',
            tos_uri: 'https://example.com/tos',
            pp_uri: 'https://example.com/privacy'
          }, validToken);
          
          const createContent = parseMCPContent(createResponse);
          testClientId = createContent.application.id;
        }
        
        // Read the playground logo file and convert to base64
        const logoPath = path.join(__dirname, '..', 'playground-logo.png');
        const logoBuffer = fs.readFileSync(logoPath);
        const testImage = logoBuffer.toString('base64');
        
        const response = await callTool('hello_manage_app', {
          action: 'update_logo_from_data',
          client_id: testClientId,
          logo_data: testImage,
          logo_content_type: 'image/png'
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        // Validate upload_result structure
        expect(content).to.have.property('upload_result');
        expect(content.upload_result).to.have.property('image_uri');
        expect(content.upload_result).to.have.property('message', 'Logo uploaded successfully');
        expect(content.upload_result).to.have.property('logo_filename');
        
        // The mock admin server returns a simple success response
        // In production, the admin server doesn't need to validate file content
        
        // Validate the mock server returned the expected URL format
        expect(content.upload_result.image_uri).to.match(/^https:\/\/mock-cdn\.hello\.coop\/logos\/.*\.png$/);
        
        // Validate action_result
        expect(content).to.have.property('action_result');
        expect(content.action_result).to.have.property('success', true);
        expect(content.action_result).to.have.property('action', 'update_logo_from_data');
        expect(content.action_result).to.have.property('logo_url');
        expect(content.action_result.logo_url).to.equal(content.upload_result.image_uri);
        
        // Validate the application was updated with the new logo URL
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('image_uri', content.upload_result.image_uri);
        
        // Validate the filename was generated correctly
        expect(content.upload_result.logo_filename).to.match(/^logo_\d+\.png$/);
        
        // NEW: Validate that the mock admin received the correct data
        const mockAdminResponse = await fetch(`${MOCK_ADMIN_URL}/test-data/uploaded-logo/${testClientId}`);
        expect(mockAdminResponse.ok, 'Mock admin should have stored the uploaded data').to.be.true;
        
        const mockAdminData = await mockAdminResponse.json();
        expect(mockAdminData).to.have.property('uploadedData');
        
        const uploadedData = mockAdminData.uploadedData;
        expect(uploadedData).to.have.property('data');
        expect(uploadedData).to.have.property('mimetype', 'image/png');
        expect(uploadedData).to.have.property('size');
        expect(uploadedData.size).to.be.greaterThan(0);
        
        // Compare the uploaded data with the original test image
        expect(uploadedData.data).to.equal(testImage, 'Uploaded data should match the original test image');
        
        console.log(`✅ Data validation passed: Sent ${testImage.length} chars, received ${uploadedData.data.length} chars`);
        console.log(`   File size: ${uploadedData.size} bytes, MIME type: ${uploadedData.mimetype}`);
      });

      it('should upload SVG logo from file data', async function() {
        // Create a separate test app for SVG testing to avoid conflicts
        const createResponse = await callTool('hello_manage_app', {
          action: 'create',
          name: 'App for SVG Logo',
          tos_uri: 'https://example.com/tos',
          pp_uri: 'https://example.com/privacy'
        }, validToken);
        
        const createContent = parseMCPContent(createResponse);
        const svgTestClientId = createContent.application.id;
        
        // Read the test SVG file and convert to base64
        const svgPath = path.join(__dirname, '..', 'test_logo.svg');
        const svgBuffer = fs.readFileSync(svgPath);
        const testSvgImage = svgBuffer.toString('base64');
        
        const response = await callTool('hello_manage_app', {
          action: 'update_logo_from_data',
          client_id: svgTestClientId,
          logo_data: testSvgImage,
          logo_content_type: 'image/svg+xml',
          theme: 'dark'
        }, validToken);
        
        expect(response.status).to.equal(200);
        const content = parseMCPContent(response);
        
        // Validate upload_result structure
        expect(content).to.have.property('upload_result');
        expect(content.upload_result).to.have.property('image_uri');
        expect(content.upload_result).to.have.property('message', 'Logo uploaded successfully');
        expect(content.upload_result).to.have.property('logo_filename');
        
        // The mock admin server returns a simple success response
        // In production, the admin server doesn't need to validate file content
        
        // Validate the mock server returned the expected URL format
        expect(content.upload_result.image_uri).to.match(/^https:\/\/mock-cdn\.hello\.coop\/logos\/.*\.png$/);
        
        // Validate action_result
        expect(content).to.have.property('action_result');
        expect(content.action_result).to.have.property('success', true);
        expect(content.action_result).to.have.property('action', 'update_logo_from_data');
        expect(content.action_result).to.have.property('message').that.includes('Logo updated successfully');
        expect(content.action_result).to.have.property('logo_url', content.upload_result.image_uri);
        
        // Validate application was updated with dark theme logo
        expect(content).to.have.property('application');
        expect(content.application).to.have.property('dark_image_uri');
        expect(content.application.dark_image_uri).to.equal(content.upload_result.image_uri);
        
        // Validate action_result includes theme information
        expect(content.action_result).to.have.property('theme', 'dark');
        
        // Validate the filename was generated correctly for SVG
        expect(content.upload_result.logo_filename).to.match(/^logo_\d+\.svg$/);
        
        // NEW: Validate that the mock admin received the correct SVG data
        const mockAdminResponse = await fetch(`${MOCK_ADMIN_URL}/test-data/uploaded-logo/${svgTestClientId}`);
        expect(mockAdminResponse.ok, 'Mock admin should have stored the uploaded SVG data').to.be.true;
        
        const mockAdminData = await mockAdminResponse.json();
        expect(mockAdminData).to.have.property('uploadedData');
        
        const uploadedData = mockAdminData.uploadedData;
        expect(uploadedData).to.have.property('data');
        expect(uploadedData).to.have.property('mimetype', 'image/svg+xml');
        expect(uploadedData).to.have.property('size');
        expect(uploadedData.size).to.be.greaterThan(0);
        
        // Compare the uploaded SVG data with the original test image
        expect(uploadedData.data).to.equal(testSvgImage, 'Uploaded SVG data should match the original test image');
        
        console.log(`✅ SVG Data validation passed: Sent ${testSvgImage.length} chars, received ${uploadedData.data.length} chars`);
        console.log(`   File size: ${uploadedData.size} bytes, MIME type: ${uploadedData.mimetype}`);
      });
    });
  });

  describe('Error Handling', function() {
    it('should handle invalid tool name', async function() {
      const response = await callTool('nonexistent_tool', {}, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('error');
      expect(response.data.error.message).to.match(/(Method not found|Unknown tool|Internal error)/);
    });

    it('should handle invalid app ID', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'read',
        client_id: 'invalid-uuid'
      }, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('error');
    });
  });

  describe('OAuth .well-known Endpoints', function() {
    it('should return OAuth Authorization Server metadata', async function() {
      const response = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-authorization-server`);
      
      expect(response.status).to.equal(200);
      expect(response.headers.get('content-type')).to.include('application/json');
      
      const metadata = await response.json();
      
      // Validate required OAuth Authorization Server metadata fields (RFC 8414)
      expect(metadata).to.have.property('issuer', 'https://admin-mcp.hello.coop');
      expect(metadata).to.have.property('authorization_endpoint', 'https://wallet.hello.coop/authorize');
      expect(metadata).to.have.property('token_endpoint', 'https://wallet.hello.coop/oauth/token');
      expect(metadata).to.have.property('registration_endpoint', 'https://admin.hello.coop/register/mcp');
      expect(metadata).to.have.property('jwks_uri', 'https://issuer.hello.coop/.well-known/jwks');
      
      // Validate supported capabilities
      expect(metadata).to.have.property('scopes_supported');
      expect(metadata.scopes_supported).to.be.an('array').that.includes('mcp');
      
      expect(metadata).to.have.property('response_types_supported');
      expect(metadata.response_types_supported).to.be.an('array').that.includes('code');
      
      expect(metadata).to.have.property('grant_types_supported');
      expect(metadata.grant_types_supported).to.be.an('array').that.includes('authorization_code');
      
      expect(metadata).to.have.property('code_challenge_methods_supported');
      expect(metadata.code_challenge_methods_supported).to.be.an('array').that.includes('S256');
      
      expect(metadata).to.have.property('token_endpoint_auth_methods_supported');
      expect(metadata.token_endpoint_auth_methods_supported).to.be.an('array').that.includes('none');
    });

    it('should return OAuth Protected Resource metadata', async function() {
      const response = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-protected-resource`);
      
      expect(response.status).to.equal(200);
      expect(response.headers.get('content-type')).to.include('application/json');
      
      const metadata = await response.json();
      
      // Validate required OAuth Protected Resource metadata fields (RFC 8707)
      expect(metadata).to.have.property('resource', 'https://admin-mcp.hello.coop/');
      
      expect(metadata).to.have.property('authorization_servers');
      expect(metadata.authorization_servers).to.be.an('array').that.includes('https://admin-mcp.hello.coop');
      
      expect(metadata).to.have.property('scopes_supported');
      expect(metadata.scopes_supported).to.be.an('array').that.includes('mcp');
      
      expect(metadata).to.have.property('bearer_methods_supported');
      expect(metadata.bearer_methods_supported).to.be.an('array').that.includes('header');
    });

    it('should have consistent scope between auth server and protected resource', async function() {
      // Get both metadata documents
      const [authServerResponse, protectedResourceResponse] = await Promise.all([
        fetch(`${MCP_SERVER_URL}/.well-known/oauth-authorization-server`),
        fetch(`${MCP_SERVER_URL}/.well-known/oauth-protected-resource`)
      ]);
      
      const authServerMetadata = await authServerResponse.json();
      const protectedResourceMetadata = await protectedResourceResponse.json();
      
      // Validate that both endpoints support the same scopes
      expect(authServerMetadata.scopes_supported).to.deep.equal(protectedResourceMetadata.scopes_supported);
      expect(authServerMetadata.scopes_supported).to.include('mcp');
    });

    it('should have consistent issuer between auth server and WWW-Authenticate header', async function() {
      // Get auth server metadata
      const authServerResponse = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-authorization-server`);
      const authServerMetadata = await authServerResponse.json();
      
      // Make an unauthorized request to get WWW-Authenticate header
      const unauthorizedResponse = await callTool('hello_manage_app', {
        action: 'read'
      }, expiredToken);
      
      const wwwAuth = unauthorizedResponse.headers.get('www-authenticate');
      
      // Extract resource_metadata URL from WWW-Authenticate header
      const resourceMetadataMatch = wwwAuth.match(/resource_metadata="([^"]+)"/);
      expect(resourceMetadataMatch).to.not.be.null;
      
      const resourceMetadataUrl = resourceMetadataMatch[1];
      expect(resourceMetadataUrl).to.equal('https://admin-mcp.hello.coop/.well-known/oauth-protected-resource');
      
      // Validate that the issuer in auth server metadata matches the base URL
      expect(authServerMetadata.issuer).to.equal('https://admin-mcp.hello.coop');
    });
  });

  describe('Improved Error Handling', function() {
    it('should return proper JSON-RPC error for invalid action', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'upload_logo_file', // Wrong action name (VS Code sends this)
        client_id: 'test_client'
      }, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('error');
      expect(response.data.error).to.have.property('code', -32602); // Invalid params
      expect(response.data.error).to.have.property('message', 'Invalid params');
      expect(response.data.error).to.have.property('data');
      
      const errorData = response.data.error.data;
      expect(errorData).to.have.property('received_action', 'upload_logo_file');
      expect(errorData).to.have.property('supported_actions');
      expect(errorData.supported_actions).to.be.an('array').that.includes('update_logo_from_data');
      expect(errorData).to.have.property('message').that.includes('not supported');
    });

    it('should return proper JSON-RPC error for invalid client_id', async function() {
      const response = await callTool('hello_manage_app', {
        action: 'update_logo_from_data',
        client_id: 'invalid_client_id_that_does_not_exist',
        logo_data: 'dGVzdA==',
        logo_content_type: 'image/png'
      }, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('error');
      
      // For now, let's just check that we get an error response
      // We'll adjust the specific expectations based on what we see
      if (response.data.error.code === -32602) {
        // New improved error handling
        expect(response.data.error).to.have.property('message', 'Invalid params');
        const errorData = response.data.error.data;
        expect(errorData).to.have.property('error_type', 'invalid_client_id');
        expect(errorData).to.have.property('client_id', 'invalid_client_id_that_does_not_exist');
        expect(errorData).to.have.property('message').that.includes('was not found');
      } else {
        // Legacy error handling - just verify it's a meaningful error about the application
        expect(response.data.error.code).to.be.oneOf([-32000, -32602]);
        expect(response.data.error.data).to.be.a('string');
        // Should mention application not found or invalid client
        expect(response.data.error.data).to.satisfy((data) => 
          data.includes('Application not found') || 
          data.includes('invalid_client_id_that_does_not_exist') ||
          data.includes('Resource not found')
        );
      }
    });

    it('should validate action before checking client_id', async function() {
      // Test that action validation happens first, even with invalid client_id
      const response = await callTool('hello_manage_app', {
        action: 'invalid_action_name',
        client_id: 'invalid_client_id_that_does_not_exist'
      }, validToken);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('error');
      expect(response.data.error).to.have.property('code', -32602);
      expect(response.data.error.data).to.have.property('received_action', 'invalid_action_name');
      // Should get action error, not client_id error
      expect(response.data.error.data.message).to.include('not supported');
    });
  });
}); 