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
}); 