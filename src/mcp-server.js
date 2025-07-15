// MCP Server for @hellocoop/mcp (refactored for REST API calls)
// Requires Node.js 18+ for built-in fetch
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ADMIN_BASE_URL } from './oauth-endpoints.js';
import packageJson from './package.js';
// FormData is now native in Node.js 22+

export class HelloMCPServer {
  constructor() {
    this.mcpServer = new Server(
      {
        name: 'hello-admin-mcp',
        version: packageJson.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          authorization: {},
          logging: {}
        }
      }
    );
    this.accessToken = process.env.HELLO_ACCESS_TOKEN || null;
    this.adminUser = null;
    this.authenticationCallback = null;
    console.log('🚀 MCP Server initialized with token from env:', this.accessToken ? `${this.accessToken.substring(0, 20)}...` : 'null');
    this.setupHandlers();
  }

  setAccessToken(token) {
    console.log('🔑 Setting access token:', token ? `${token.substring(0, 20)}...` : 'null');
    this.accessToken = token;
  }

  setAuthenticationCallback(callback) {
    this.authenticationCallback = callback;
  }

  async handleRequest(request) {
    // Handle MCP JSON-RPC requests
    const { jsonrpc, id, method, params } = request;

    if (jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request - jsonrpc must be "2.0"'
        }
      };
    }

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                resources: {},
                logging: {}
              },
              serverInfo: {
                name: 'hello-admin-mcp',
                version: packageJson.version
              }
            }
          };

        case 'initialized':
          return {
            jsonrpc: '2.0',
            id,
            result: {}
          };

        case 'tools/list':
          const toolsHandler = this.mcpServer._requestHandlers.get('tools/list');
          if (toolsHandler) {
            const toolsResult = await toolsHandler({ method: 'tools/list', params: params || {} });
            return {
              jsonrpc: '2.0',
              id,
              result: toolsResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              result: { tools: [] }
            };
          }

        case 'tools/call':
          const callHandler = this.mcpServer._requestHandlers.get('tools/call');
          if (callHandler) {
            const callResult = await callHandler({ 
              method: 'tools/call', 
              params: { name: params.name, arguments: params.arguments || {} }
            });
            return {
              jsonrpc: '2.0',
              id,
              result: callResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
          }

        case 'resources/list':
          const resourcesHandler = this.mcpServer._requestHandlers.get('resources/list');
          if (resourcesHandler) {
            const resourcesResult = await resourcesHandler({ method: 'resources/list', params: params || {} });
            return {
              jsonrpc: '2.0',
              id,
              result: resourcesResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              result: { resources: [] }
            };
          }

        case 'resources/read':
          const readResourceHandler = this.mcpServer._requestHandlers.get('resources/read');
          if (readResourceHandler) {
            const readResult = await readResourceHandler({ method: 'resources/read', params: params || {} });
            return {
              jsonrpc: '2.0',
              id,
              result: readResult
            };
          } else {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
          }

        case 'ping':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              pong: true,
              timestamp: new Date().toISOString(),
              server: 'hello-admin-mcp',
              version: packageJson.version
            }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: 'Internal error',
          data: error.message
        }
      };
    }
  }

  // REST call to admin API using built-in fetch
  async callAdminAPI(method, path, data, options = {}) {
    const { requiresAuth = true, isRetry = false } = options;
    
    console.log('🌐 Calling Admin API:', method, path);
    console.log('🔑 Current access token:', this.accessToken ? `${this.accessToken.substring(0, 20)}...` : 'null');
    
    // Trigger authentication if we need auth but don't have a token
    if (requiresAuth && !this.accessToken && this.authenticationCallback) {
      try {
        this.accessToken = await this.authenticationCallback();
      } catch (error) {
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }

    const url = ADMIN_BASE_URL + path;
    console.log('🎯 Admin API URL:', url);
    const headers = {
      ...(requiresAuth && this.accessToken && { Authorization: `Bearer ${this.accessToken}` })
    };
    
    // Only add Content-Type header if we have data to send
    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }
    
    console.log('📋 Request headers:', headers);

    const requestOptions = {
      method: method.toUpperCase(),
      headers
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

        try {
      const response = await fetch(url, requestOptions);
      const responseData = await response.json();
      
      // Handle token expiration (401 Unauthorized)
      if (response.status === 401 && requiresAuth && !isRetry && this.authenticationCallback) {
        this.accessToken = null; // Clear expired token
        
        try {
          // Trigger new OAuth flow
          this.accessToken = await this.authenticationCallback();
          
          // Retry the original request with new token
          return await this.callAdminAPI(method, path, data, { requiresAuth, isRetry: true });
        } catch (authError) {
          throw new Error(`Re-authentication failed: ${authError.message}`);
        }
      }
      
      // For authentication errors, return an object with HTTP status and headers
      if (response.status === 401) {
        const wwwAuthHeader = response.headers.get('WWW-Authenticate');
        return {
          _httpStatus: response.status,
          _httpHeaders: wwwAuthHeader ? { 'WWW-Authenticate': wwwAuthHeader } : {},
          error: responseData.error || 'invalid_token'
        };
      }
      
      // For bad requests (400), throw an error with the response details
      if (response.status === 400) {
        throw new Error(`Bad request: ${responseData.error || responseData.error_description || 'Invalid request parameters'}`);
      }
      
      // For other errors, throw with status and message
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseData.error || responseData.message || 'Unknown error'}`);
      }
      
      return responseData;
    } catch (err) {
      throw new Error(`API call failed: ${err.message}`);
    }
  }

  setupHandlers() {
    // ListTools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'hello_get_profile',
            description: 'Get your Hellō developer profile and publishers',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'Optional specific publisher ID'
                }
              }
            }
          },
          {
            name: 'hello_create_publisher',
            description: 'Create a new Hellō publisher (team/organization)',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the publisher/team (defaults to "[Your Name]\'s Team")'
                }
              }
            }
          },
          {
            name: 'hello_update_publisher',
            description: 'Update/rename a Hellō publisher',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to update'
                },
                name: {
                  type: 'string',
                  description: 'New name for the publisher'
                }
              },
              required: ['publisher_id', 'name']
            }
          },
          {
            name: 'hello_read_publisher',
            description: 'Read detailed information about a specific Hellō publisher including all applications with full configuration',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to read'
                }
              },
              required: ['publisher_id']
            }
          },
          {
            name: 'hello_read_application',
            description: 'Read detailed information about a specific Hellō application including redirect URIs',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher that owns the application'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application to read'
                }
              },
              required: ['publisher_id', 'application_id']
            }
          },
          {
            name: 'hello_create_application',
            description: 'Create a new Hellō application under a publisher.',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher to create the app under'
                },
                name: {
                  type: 'string',
                  description: 'Application name (defaults to "[Your Name]\'s MCP Created App")'
                },
                dev_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Development redirect URIs',
                  default: []
                },
                prod_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Production redirect URIs',
                  default: []
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow',
                  default: false
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI (optional)'
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development',
                  default: true
                },
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development',
                  default: true
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI (optional)'
                },
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI (optional)'
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development',
                  default: false
                }
              },
              required: ['publisher_id']
            }
          },
          {
            name: 'hello_update_application',
            description: 'Update a Hellō application',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application to update'
                },
                name: {
                  type: 'string',
                  description: 'Application name'
                },
                dev_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Development redirect URIs'
                },
                prod_redirect_uris: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Production redirect URIs'
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow'
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI'
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development'
                },
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development'
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI'
                },
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI'
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development'
                }
              },
              required: ['publisher_id', 'application_id']
            }
          },
          {
            name: 'hello_upload_logo',
            description: 'Upload a logo image for a Hellō application. Can upload from URL or direct image data.',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application'
                },
                image_url: {
                  type: 'string',
                  description: 'URL of the image to upload (the image will be downloaded and uploaded to Hellō)'
                },
                image_data: {
                  type: 'string',
                  description: 'Base64 encoded image data (PNG, JPG, GIF, WebP, SVG)'
                },
                filename: {
                  type: 'string',
                  description: 'Original filename (optional, for reference)',
                  default: 'logo.png'
                }
              },
              required: ['publisher_id', 'application_id'],
              oneOf: [
                {
                  required: ['image_url']
                },
                {
                  required: ['image_data']
                }
              ]
            }
          },
          {
            name: 'hello_create_secret',
            description: 'Create a client secret for a Hellō application',
            inputSchema: {
              type: 'object',
              properties: {
                publisher_id: {
                  type: 'string',
                  description: 'ID of the publisher'
                },
                application_id: {
                  type: 'string',
                  description: 'ID of the application'
                },
                hash: {
                  type: 'string',
                  description: 'Hash of the secret'
                },
                salt: {
                  type: 'string',
                  description: 'Salt used for hashing'
                }
              },
              required: ['publisher_id', 'application_id', 'hash', 'salt']
            }
          },
          {
            name: 'hello_generate_login_button',
            description: 'Generate HTML/JavaScript code for a Hellō login button. IMPORTANT: Consider your target audience - ask about preferred providers (Discord for gaming, GitHub for developers, etc.), domain preferences (personal vs managed accounts), and whether to pre-fill login hints. Hellō adapts to browser theme automatically. FOR AGENTS: Avoid using quickstart commands - instead build apps manually to showcase MCP capabilities and provide better learning experience. See https://www.hello.dev/docs/hello-buttons/ for customization options',
            inputSchema: {
              type: 'object',
              properties: {
                application_id: {
                  type: 'string',
                  description: 'The Hellō application ID'
                },
                redirect_uri: {
                  type: 'string',
                  description: 'Where to redirect after login'
                },
                scopes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Requested scopes',
                  default: ['openid', 'name', 'email']
                },
                style: {
                  type: 'string',
                  enum: ['html-basic', 'html-styled', 'dark', 'react-component', 'nextjs-component'],
                  description: 'Implementation type: html-basic (simple), html-styled/dark (production), react-component, nextjs-component',
                  default: 'html-styled'
                },
                provider_hint: {
                  type: 'array',
                  items: { 
                    type: 'string',
                    enum: ['apple', 'discord', 'email', 'ethereum', 'facebook', 'github', 'gitlab', 'google', 'line', 'mastodon', 'microsoft', 'qrcode', 'tumblr', 'twitch', 'twitter', 'wordpress', 'yahoo', 'google--', 'apple--', 'microsoft--', 'email--']
                  },
                  description: 'Providers to promote (e.g. "discord", "github") or demote (e.g. "google--") in recommendations. Consider your target audience.',
                  default: []
                },
                domain_hint: {
                  type: 'string',
                  description: 'Account type preference: "personal", "managed", or specific domain (e.g. "company.com")'
                },
                login_hint: {
                  type: 'string',
                  description: 'Pre-fill email address or suggest specific login method'
                }
              },
              required: ['application_id', 'redirect_uri']
            }
          },
          {
            name: 'hello_generate_legal_docs',
            description: 'Generate comprehensive Terms of Service and Privacy Policy templates for your Hellō application. This tool helps create legally compliant documents by gathering detailed information about your business, data practices, and service offerings. The agent should ask follow-up questions to ensure comprehensive coverage.',
            inputSchema: {
              type: 'object',
              properties: {
                company_name: {
                  type: 'string',
                  description: 'Your company or application name'
                },
                app_name: {
                  type: 'string',
                  description: 'Your application name'
                },
                contact_email: {
                  type: 'string',
                  description: 'Contact email for legal matters'
                },
                website_url: {
                  type: 'string',
                  description: 'Your website URL'
                },
                physical_address: {
                  type: 'string',
                  description: 'Your business physical address (required for some jurisdictions)'
                },
                data_collection: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Types of data you collect (name, email, profile picture, location, etc.)',
                  default: ['name', 'email', 'profile picture']
                },
                service_type: {
                  type: 'string',
                  enum: ['web_app', 'mobile_app', 'saas', 'ecommerce', 'social', 'marketplace', 'blog', 'portfolio', 'other'],
                  description: 'Type of service you provide'
                },
                target_users: {
                  type: 'string',
                  enum: ['general_public', 'businesses', 'children_under_13', 'teens_13_18', 'professionals', 'specific_industry'],
                  description: 'Primary target audience'
                },
                geographic_scope: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Countries/regions where you operate (affects legal requirements)',
                  default: ['United States']
                },
                third_party_services: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Third-party services you use (Google Analytics, payment processors, etc.)'
                },
                user_generated_content: {
                  type: 'boolean',
                  description: 'Do users create or upload content?',
                  default: false
                },
                payment_processing: {
                  type: 'boolean',
                  description: 'Do you process payments or handle financial transactions?',
                  default: false
                },
                subscription_model: {
                  type: 'boolean',
                  description: 'Do you offer subscriptions or recurring billing?',
                  default: false
                },
                data_retention_period: {
                  type: 'string',
                  description: 'How long do you retain user data? (e.g., "2 years", "until account deletion")',
                  default: 'until account deletion'
                },
                cookies_tracking: {
                  type: 'boolean',
                  description: 'Do you use cookies or tracking technologies?',
                  default: true
                },
                marketing_communications: {
                  type: 'boolean',
                  description: 'Do you send marketing emails or communications?',
                  default: false
                },
                age_restrictions: {
                  type: 'string',
                  description: 'Minimum age requirement for your service',
                  default: '13'
                },
                intellectual_property: {
                  type: 'boolean',
                  description: 'Do you have specific intellectual property that needs protection?',
                  default: false
                },
                dispute_resolution: {
                  type: 'string',
                  enum: ['courts', 'arbitration', 'mediation'],
                  description: 'Preferred method for resolving disputes',
                  default: 'courts'
                },
                governing_law: {
                  type: 'string',
                  description: 'Which state/country laws should govern (e.g., "California", "Delaware")',
                  default: 'Delaware'
                }
              },
              required: ['company_name', 'app_name', 'contact_email', 'website_url', 'service_type']
            }
          },

        ]
      };
    });

    // List resources (documentation and guides)
    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'https://www.hello.dev/docs/',
            name: 'Hellō Documentation',
            description: 'Complete documentation for integrating Hellō authentication into your application',
            mimeType: 'text/html'
          },
          {
            uri: 'https://www.hello.dev/docs/quickstarts/',
            name: 'Hellō Quickstarts',
            description: 'Quick setup guides for Express, Fastify, Next.js, WordPress and other frameworks',
            mimeType: 'text/html'
          },
          {
            uri: 'https://www.hello.dev/docs/hello-buttons/',
            name: 'Hellō Buttons',
            description: 'How to implement and customize Hellō login buttons in your application',
            mimeType: 'text/html'
          },
          {
            uri: 'https://www.hello.dev/docs/hello-scopes/',
            name: 'Hellō Scopes',
            description: 'Available scopes and claims you can request from users',
            mimeType: 'text/html'
          },
          {
            uri: 'https://www.hello.dev/docs/apis/wallet/',
            name: 'Hellō Wallet API',
            description: 'Wallet API reference including authorization parameters, provider_hint, domain_hint, and response handling',
            mimeType: 'text/html'
          },
          {
            uri: 'hello://logo-guidance',
            name: 'Hellō Logo Design Guidance',
            description: 'Comprehensive guide for creating both light and dark theme logos for your Hellō application, including scaling, file requirements, and implementation tips',
            mimeType: 'text/markdown'
          }
        ]
      };
    });

    // Read resource handler
    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === 'hello://logo-guidance') {
        const logoGuidance = this.generateLogoGuidanceResource();
        return {
          contents: [{
            uri: uri,
            mimeType: 'text/markdown',
            text: logoGuidance
          }]
        };
      }
      
      throw new Error(`Resource not found: ${uri}`);
    });

    // Tool call handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'hello_get_profile': {
            // GET /api/v1/profile or /api/v1/profile/:publisher
            let path = '/api/v1/profile';
            if (args.publisher_id) path += `/${args.publisher_id}`;
            const result = await this.callAdminAPI('get', path);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          }
          case 'hello_create_publisher': {
            // POST /api/v1/publishers
            return await this.callAdminAPI('post', '/api/v1/publishers', { name: args.name });
          }
          case 'hello_update_publisher': {
            // PUT /api/v1/publishers/:publisher
            return await this.callAdminAPI('put', `/api/v1/publishers/${args.publisher_id}`, { name: args.name });
          }
          case 'hello_read_publisher': {
            // GET /api/v1/publishers/:publisher
            return await this.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}`);
          }
          case 'hello_read_application': {
            // GET /api/v1/publishers/:publisher/applications/:application
            return await this.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`);
          }
          case 'hello_create_application': {
            // POST /api/v1/publishers/:publisher/applications
            // Transform MCP parameters to Admin API format
            const applicationData = {
              name: args.name || `${this.adminUser?.name || 'User'}'s MCP Created App`,
              tos_uri: args.tos_uri || null,
              pp_uri: args.pp_uri || null,
              image_uri: args.image_uri || null,
              web: {
                dev: {
                  localhost: args.localhost !== undefined ? args.localhost : true,
                  "127.0.0.1": args.local_ip !== undefined ? args.local_ip : true,
                  wildcard_domain: args.wildcard_domain !== undefined ? args.wildcard_domain : false,
                  redirect_uris: args.dev_redirect_uris || []
                },
                prod: {
                  redirect_uris: args.prod_redirect_uris || []
                }
              },
              device_code: args.device_code !== undefined ? args.device_code : false,
              createdBy: 'mcp'
            };
            
            return await this.callAdminAPI('post', `/api/v1/publishers/${args.publisher_id}/applications`, applicationData);
          }
          case 'hello_update_application': {
            // PUT /api/v1/publishers/:publisher/applications/:application
            // Transform MCP parameters to Admin API format
            const updateData = {
              name: args.name,
              tos_uri: args.tos_uri,
              pp_uri: args.pp_uri,
              image_uri: args.image_uri,
              device_code: args.device_code
            };
            
            // Only include web config if any web-related parameters are provided
            if (args.dev_redirect_uris || args.prod_redirect_uris || 
                args.localhost !== undefined || args.local_ip !== undefined || 
                args.wildcard_domain !== undefined) {
              updateData.web = {
                dev: {
                  localhost: args.localhost,
                  "127.0.0.1": args.local_ip,
                  wildcard_domain: args.wildcard_domain,
                  redirect_uris: args.dev_redirect_uris
                },
                prod: {
                  redirect_uris: args.prod_redirect_uris
                }
              };
            }
            
            // Remove undefined values
            Object.keys(updateData).forEach(key => {
              if (updateData[key] === undefined) {
                delete updateData[key];
              }
            });
            
            return await this.callAdminAPI('put', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`, updateData);
          }
          case 'hello_upload_logo': {
            if (args.image_url) {
              // Use URL query parameter approach (simpler and matches what works)
              const path = `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}/logo?url=${encodeURIComponent(args.image_url)}`;
              return await this.callAdminAPI('post', path, null);
            } else if (args.image_data) {
              // Use multipart form data for binary upload
              return await this.uploadLogoBinary(args.publisher_id, args.application_id, args.image_data, args.filename || 'logo.png');
            } else {
              throw new Error('Either image_url or image_data must be provided');
            }
          }
          case 'hello_create_secret': {
            // POST /api/v1/publishers/:publisher/applications/:application/secrets
            return await this.callAdminAPI('post', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}/secrets`, {
              hash: args.hash,
              salt: args.salt
            });
          }
          case 'hello_generate_login_button': {
            // POST /api/v1/generate-login-button
            return await this.callAdminAPI('post', '/api/v1/generate-login-button', args);
          }
          case 'hello_generate_legal_docs': {
            return await this.generateLegalDocs(args);
          }


          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        // Token error handling
        if (err.response && err.response.status === 401) {
          return {
            error: 'invalid_token',
            error_description: 'Access token is invalid or expired',
            'WWW-Authenticate': 'Bearer error="invalid_token"'
          };
        }
        if (err.response && err.response.status === 403) {
          return {
            error: 'insufficient_scope',
            error_description: 'Insufficient scope for this operation',
            'WWW-Authenticate': 'Bearer error="insufficient_scope"'
          };
        }
        return { error: err.message };
      }
    });
  }



  generateLogoGuidanceResource() {
    return `# 🎨 Hellō Logo Design Guidance

## 📐 Display Area & Scaling

### **Maximum Display Area: 400px × 100px**
- Your logo will be **scaled to fit** within this area
- **Width priority:** Logo won't exceed 400px wide
- **Height priority:** Logo won't exceed 100px tall
- **Proportional scaling:** Aspect ratio is preserved

### **Scaling Examples:**
- **400×100px logo:** Displays at full size (perfect fit)
- **800×200px logo:** Scales down to 400×100px (50% scale)
- **200×200px logo:** Scales down to 100×100px (maintains square shape)
- **400×50px logo:** Displays at 400×50px (shorter but full width)

## 📄 File Requirements
- **Supported Formats:** .png, .gif, .jpg/.jpeg, .webp, .apng
- **Recommended Format:** PNG (for transparency support)
- **File Size:** Keep under 100KB for fast loading
- **Background:** Transparent PNG preferred for versatility

## 🌓 Theme Support - CRITICAL!

### **Why Both Light and Dark Logos Matter**
Hellō automatically adapts to users' browser theme preferences (light/dark mode). Having both versions ensures your brand looks great in all contexts.

### **Light Theme Logo**
- Use dark text/elements on transparent background
- Ensure good contrast against white/light backgrounds
- Consider your primary brand colors

### **Dark Theme Logo**  
- Use light text/elements on transparent background
- Ensure good contrast against dark backgrounds
- May use accent colors that pop on dark backgrounds

## 🎯 Design Recommendations by Logo Style

### **Text-Only Logos (Wordmarks)**
- **Ideal dimensions:** 300-400px × 60-80px
- **Font weight:** Medium to Bold for readability at small sizes
- **Letter spacing:** Slightly increased for better legibility
- **Consider:** How your text looks in both light and dark themes

### **Icon-Only Logos**
- **Ideal dimensions:** 80-100px × 80-100px (square preferred)
- **Detail level:** Simple, recognizable at 32px size
- **Contrast:** Strong silhouette that works in monochrome
- **Consider:** Whether icon is meaningful without company name

### **Icon + Text Combination**
- **Layout options:** Horizontal (icon left, text right) or vertical (icon top, text bottom)
- **Proportions:** Icon should be 60-80% of text height
- **Spacing:** 10-20px between icon and text
- **Hierarchy:** Ensure both elements are legible and balanced

### **Stylized Wordmarks**
- **Typography:** Custom lettering or heavily modified fonts
- **Consistency:** Maintain style across light and dark versions
- **Simplification:** Avoid thin strokes that disappear at small sizes
- **Scalability:** Test readability from 50px to 400px width

## 📋 Implementation Checklist

- [ ] Create light theme version (dark elements on transparent background)
- [ ] Create dark theme version (light elements on transparent background)
- [ ] Test both versions against their target backgrounds
- [ ] Ensure logos scale well from 50px to 400px width
- [ ] Optimize file sizes (aim for under 100KB each)
- [ ] Upload using \`hello_upload_logo\` or \`hello_upload_logo_file\`

## 🛠️ Tools Available

- \`hello_upload_logo\` - Upload logo from URL
- \`hello_upload_logo_file\` - Upload logo file directly
- \`hello_update_application\` - Update your app with new logo URLs

## 🎨 Brand Color Considerations

### Light Theme Recommendations:
- Use your brand colors as primary elements
- Ensure sufficient contrast (4.5:1 ratio minimum)
- Consider darker shades for better readability

### Dark Theme Recommendations:
- Use lighter tints of your brand colors
- Consider accent colors that complement your brand
- Test against dark backgrounds (#121212, #1e1e1e)

Need help with implementation? Check out our [logo documentation](https://www.hello.dev/docs/hello-buttons/#logos) for more details!`;
  }



  async generateLegalDocs(args) {
    const {
      company_name,
      app_name,
      contact_email,
      website_url,
      physical_address,
      data_collection = ['name', 'email', 'profile picture'],
      service_type,
      target_users,
      geographic_scope = ['United States'],
      third_party_services = [],
      user_generated_content = false,
      payment_processing = false,
      subscription_model = false,
      data_retention_period = 'until account deletion',
      cookies_tracking = true,
      marketing_communications = false,
      age_restrictions = '13',
      intellectual_property = false,
      dispute_resolution = 'courts',
      governing_law = 'Delaware'
    } = args;
    
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Generate comprehensive Terms of Service
    const termsOfService = this.generateTermsOfService({
      company_name, app_name, contact_email, website_url, physical_address,
      service_type, target_users, user_generated_content, payment_processing,
      subscription_model, age_restrictions, intellectual_property,
      dispute_resolution, governing_law, currentDate
    });
    
    // Generate comprehensive Privacy Policy
    const privacyPolicy = this.generatePrivacyPolicy({
      company_name, app_name, contact_email, website_url, physical_address,
      data_collection, geographic_scope, third_party_services,
      data_retention_period, cookies_tracking, marketing_communications,
      age_restrictions, currentDate
    });

    // Generate guidance for next steps
    const guidance = this.generateLegalGuidance(args);

    return {
      content: [{
        type: 'text',
        text: `Generated comprehensive legal documents for **${app_name}**:\n\n## Terms of Service\n\n\`\`\`markdown\n${termsOfService}\n\`\`\`\n\n## Privacy Policy\n\n\`\`\`markdown\n${privacyPolicy}\n\`\`\`\n\n${guidance}`
      }]
    };
  }

  generateTermsOfService(params) {
    const {
      company_name, app_name, contact_email, website_url, physical_address,
      service_type, target_users, user_generated_content, payment_processing,
      subscription_model, age_restrictions, intellectual_property,
      dispute_resolution, governing_law, currentDate
    } = params;

    const serviceDescription = {
      'web_app': 'web application',
      'mobile_app': 'mobile application', 
      'saas': 'software-as-a-service platform',
      'ecommerce': 'e-commerce platform',
      'social': 'social networking service',
      'marketplace': 'online marketplace',
      'blog': 'blog or content platform',
      'portfolio': 'portfolio website'
    }[service_type] || 'online service';

    const contactSection = physical_address ? 
      `For questions about these Terms, contact us at:\n- Email: ${contact_email}\n- Address: ${physical_address}` :
      `For questions about these Terms, contact us at: ${contact_email}`;

    const ageSection = target_users === 'children_under_13' ? 
      `## 4. Age Requirements and Parental Consent\nOur Service is designed for children under 13 with parental consent. We comply with COPPA requirements. Parents must provide verifiable consent before children can use our Service.` :
      age_restrictions !== '13' ? 
      `## 4. Age Requirements\nYou must be at least ${age_restrictions} years old to use our Service. By using our Service, you represent that you meet this age requirement.` :
      `## 4. Age Requirements\nYou must be at least 13 years old to use our Service. By using our Service, you represent that you are at least 13 years old.`;

    const ugcSection = user_generated_content ? `

## 6. User-Generated Content
By posting content to our Service, you grant us a non-exclusive, royalty-free license to use, display, and distribute your content. You are responsible for ensuring your content does not violate any laws or third-party rights.

### Content Guidelines
- Content must be lawful and not infringe on others' rights
- We reserve the right to remove content that violates these guidelines
- You retain ownership of your content` : '';

    const paymentSection = payment_processing ? `

## 7. Payment Terms
${subscription_model ? 
  `### Subscription Billing
- Subscriptions are billed in advance on a recurring basis
- You may cancel your subscription at any time
- Refunds are provided according to our refund policy

### Payment Processing
- We use third-party payment processors
- You agree to provide accurate payment information
- You are responsible for all charges incurred` :
  `### Payment Processing
- We use secure third-party payment processors
- All transactions are processed securely
- You are responsible for all charges incurred`}` : '';

    const ipSection = intellectual_property ? `

## 8. Intellectual Property
Our Service and its content are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute our content without permission.` : '';

    const disputeSection = dispute_resolution === 'arbitration' ?
      `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved through binding arbitration rather than in court. You waive your right to participate in class action lawsuits.` :
      dispute_resolution === 'mediation' ?
      `## 10. Dispute Resolution
We encourage resolving disputes through mediation before pursuing legal action. If mediation fails, disputes will be resolved in the courts of ${governing_law}.` :
      `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved in the courts of ${governing_law}. You consent to the jurisdiction of these courts.`;

    return `# Terms of Service

**Effective Date:** ${currentDate}

## 1. Introduction
Welcome to ${app_name}, a ${serviceDescription} operated by ${company_name}. By using our Service, you agree to these Terms of Service ("Terms").

## 2. Description of Service
${app_name} provides ${this.getServiceDescription(service_type)}. We reserve the right to modify or discontinue our Service at any time.

## 3. User Accounts
- You are responsible for maintaining the security of your account
- You must provide accurate and complete information
- You are responsible for all activities under your account

${ageSection}

## 5. Acceptable Use
You agree not to:
- Use our Service for illegal purposes
- Attempt to gain unauthorized access to our systems
- Interfere with the proper functioning of our Service
- Violate any applicable laws or regulations

${ugcSection}

${paymentSection}

${ipSection}

## 9. Limitation of Liability
Our Service is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of our Service.

${disputeSection}

## 11. Changes to Terms
We may update these Terms at any time. Continued use of our Service after changes constitutes acceptance of the new Terms.

## 12. Contact Information
${contactSection}

## 13. Governing Law
These Terms are governed by the laws of ${governing_law}.`;
  }

  generatePrivacyPolicy(params) {
    const {
      company_name, app_name, contact_email, website_url, physical_address,
      data_collection, geographic_scope, third_party_services,
      data_retention_period, cookies_tracking, marketing_communications,
      age_restrictions, currentDate
    } = params;

    const contactSection = physical_address ? 
      `For questions about this Privacy Policy, contact us at:\n- Email: ${contact_email}\n- Address: ${physical_address}` :
      `For questions about this Privacy Policy, contact us at: ${contact_email}`;

    const dataCollectionList = data_collection.map(item => `- ${item}`).join('\n');
    
    const thirdPartySection = third_party_services.length > 0 ? `

## 4. Third-Party Services
We use the following third-party services that may collect information:

${third_party_services.map(service => `- ${service}`).join('\n')}

Please review the privacy policies of these services to understand how they handle your data.` : '';

    const cookiesSection = cookies_tracking ? `

## 5. Cookies and Tracking
We use cookies and similar technologies to:
- Remember your preferences
- Analyze how you use our Service
- Improve our Service performance

You can control cookies through your browser settings, but some features may not work properly if cookies are disabled.` : '';

    const marketingSection = marketing_communications ? `

## 6. Marketing Communications
With your consent, we may send you:
- Product updates and announcements
- Promotional offers and newsletters
- Service-related communications

You can opt out of marketing communications at any time by following the unsubscribe instructions in our emails.` : '';

    const childrenSection = age_restrictions === '13' ? `

## 7. Children's Privacy
Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.` : 
    age_restrictions !== '13' ? `

## 7. Children's Privacy
Our Service is not intended for children under ${age_restrictions}. We do not knowingly collect personal information from children under ${age_restrictions}.` : '';

    const internationalSection = geographic_scope.length > 1 || !geographic_scope.includes('United States') ? `

## 8. International Data Transfers
We operate in: ${geographic_scope.join(', ')}

If you are located outside these regions, your information may be transferred to and processed in these countries. By using our Service, you consent to such transfers.` : '';

    return `# Privacy Policy

**Effective Date:** ${currentDate}

## 1. Introduction
${company_name} ("we," "our," or "us") operates ${app_name} (the "Service"). This Privacy Policy explains how we collect, use, and protect your personal information.

## 2. Information We Collect
We collect the following types of information:

${dataCollectionList}

### How We Collect Information
- **Directly from you:** When you create an account, contact us, or use our features
- **Automatically:** Through cookies, log files, and analytics tools
- **From third parties:** Through social media logins and integrated services

## 3. How We Use Your Information
We use your information to:
- Provide and improve our Service
- Communicate with you about your account
- Comply with legal obligations
- Protect against fraud and abuse

${thirdPartySection}

${cookiesSection}

${marketingSection}

${childrenSection}

${internationalSection}

## 9. Data Retention
We retain your personal information for ${data_retention_period}. You may request deletion of your account and associated data at any time.

## 10. Your Rights
Depending on your location, you may have the right to:
- Access your personal information
- Correct inaccurate information
- Delete your personal information
- Object to processing
- Data portability

## 11. Security
We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

## 12. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on our website.

## 13. Contact Us
${contactSection}

For more information about our privacy practices, please visit: ${website_url}`;
  }

  getServiceDescription(serviceType) {
    switch (serviceType) {
      case 'web_app':
        return 'a web-based application that allows users to access our features through their browser';
      case 'mobile_app':
        return 'a mobile application available for download on mobile devices';
      case 'saas':
        return 'a cloud-based software solution accessible via subscription';
      case 'ecommerce':
        return 'an online platform for buying and selling products or services';
      case 'social':
        return 'a social networking platform for connecting and sharing with others';
      case 'marketplace':
        return 'an online marketplace connecting buyers and sellers';
      case 'blog':
        return 'a content platform for publishing and sharing articles and media';
      case 'portfolio':
        return 'a portfolio website for showcasing work and professional information';
      default:
        return 'an online service platform';
    }
  }

  generateLegalGuidance(args) {
    return `

## 📋 Next Steps

### 1. Review and Customize
- **Legal Review:** Have these documents reviewed by a qualified attorney
- **Customize:** Modify language to match your specific business practices
- **Industry-Specific:** Add any industry-specific requirements or disclaimers

### 2. Implementation
- **Host Documents:** Upload these documents to your website
- **Link from App:** Add links to Terms and Privacy Policy in your application
- **Update Hellō App:** Use the URLs in your Hellō application configuration

### 3. Compliance Considerations
${args.geographic_scope?.includes('European Union') || args.geographic_scope?.includes('EU') ? '- **GDPR Compliance:** Consider additional GDPR requirements for EU users\n' : ''}${args.geographic_scope?.includes('California') ? '- **CCPA Compliance:** Review California Consumer Privacy Act requirements\n' : ''}${args.target_users === 'children_under_13' ? '- **COPPA Compliance:** Ensure full compliance with Children\'s Online Privacy Protection Act\n' : ''}${args.payment_processing ? '- **PCI DSS:** If handling payment data directly, ensure PCI DSS compliance\n' : ''}

### 4. Regular Updates
- **Annual Review:** Review and update these documents annually
- **Business Changes:** Update when your business practices change
- **Legal Changes:** Stay informed about relevant legal developments

### 5. Hellō Integration
After hosting these documents, update your Hellō application:

\`\`\`javascript
// Use hello_update_application with your URLs
{
  "tos_uri": "https://${args.website_url}/terms-of-service",
  "pp_uri": "https://${args.website_url}/privacy-policy"
}
\`\`\`

⚠️  **Important:** These are template documents. Always consult with a qualified attorney to ensure compliance with applicable laws and regulations for your specific situation.`;
  }

  async uploadLogoBinary(publisherId, applicationId, base64ImageData, filename) {
    try {
      // Remove data URL prefix if present
      const base64Data = base64ImageData.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Detect mime type from filename or default to PNG
      let mimeType = 'image/png';
      if (filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const mimeTypes = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        mimeType = mimeTypes[ext] || 'image/png';
      }
      
      // Create FormData for multipart upload using native APIs
      const formData = new FormData();
      
      // Create a Blob from the buffer (Node.js 22+ has native Blob support)
      const blob = new Blob([buffer], { type: mimeType });
      
      formData.append('file', blob, filename);
      
      const domain = process.env.HELLO_DOMAIN || 'hello.coop';
      const adminUrl = `https://admin.${domain}/api/v1/publishers/${publisherId}/applications/${applicationId}/logo`;
      
      console.log('🔑 Current access token:', this.accessToken ? `${this.accessToken.substring(0, 20)}...` : 'null');
      console.log('🎯 Admin API URL:', adminUrl);
      
      const response = await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          // Don't set Content-Type - let fetch set it automatically for FormData
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Admin API error: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Binary logo uploaded successfully:', result.image_uri);
      return result;
      
    } catch (error) {
      console.error('❌ Binary logo upload failed:', error);
      throw error;
    }
  }
} 