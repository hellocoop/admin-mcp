// src/mcp-server.js
// MCP Server with OAuth integration for Hellō Admin API

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  SetLevelRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import existing admin functions
const admin = require('./admin');
const verify = require('../issuer/verify');
const { DOMAIN } = require('../config');

// Canary version for development tracking
const CANARY_VERSION = '2025-01-02-009';

class HelloMCPServer {
  constructor() {
    this.mcpServer = new Server(
      {
        name: 'hello-admin-mcp',
        version: '1.0.0',
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
      
    this.accessToken = null;
    this.adminUser = null;
    this.setupHandlers();
  }

  // Mock request/reply for existing admin functions
  createMockRequest(adminUser, params = {}, body = {}, method = 'GET') {
    return {
      admin: adminUser,
      params,
      body,
      method,
      headers: {},
      routeOptions: { url: '' }
    };
  }

  createMockReply() {
    let statusCode = 200;
    let response = null;
    let isError = false;

    return {
      code: function(code) { statusCode = code; return this; },
      header: function(name, value) { return this; },
      send: function(data) {
        response = data;
        if (statusCode >= 400) isError = true;
        return data;
      },
      assert: function(condition, code, errorString) {
        if (!condition) {
          isError = true;
          statusCode = code || 500;
          response = { error: errorString || 'Assertion failed' };
          throw new Error(errorString || 'Assertion failed');
        }
      },
      assertNotError: function(err, code) {
        if (err instanceof Error) {
          isError = true;
          statusCode = code || 500;
          response = { error: err.message };
          throw err;
        }
      },
      get statusCode() { return statusCode; },
      get response() { return response; },
      get isError() { return isError; }
    };
  }

  setupHandlers() {
    // Handle OAuth authorization from Claude Desktop
    this.mcpServer.setRequestHandler(SetLevelRequestSchema, async (request) => {
      const { level, authorization } = request.params;
      
      if (level === 'user' && authorization?.type === 'oauth2') {
        this.accessToken = authorization.accessToken;
        
        try {
          // Verify token using existing verification logic
          const payload = await verify(this.accessToken, 'https://admin.' + DOMAIN);
          
          if (payload instanceof Error || !payload || !payload.active) {
            throw new Error('Invalid token');
          }

          if (!payload.scope || !payload.scope.includes('quickstart')) {
            throw new Error('Insufficient scope - quickstart required');
          }

          this.adminUser = {
            name: payload.name,
            email: payload.email,
            picture: payload.picture,
            id: payload.sub
          };

          console.error('MCP authenticated:', this.adminUser.email);
          return { level: 'user' };
          
        } catch (error) {
          console.error('MCP auth failed:', error.message);
          this.accessToken = null;
          this.adminUser = null;
          return { level: 'none' };
        }
      }
      
      return { level: 'none' };
    });

    // List tools (only if authenticated)
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      // if (!this.accessToken || !this.adminUser) {
      //   return { tools: [] };
      // }

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
            description: 'Create a new Hellō application under a publisher. IMPORTANT: You need Terms of Service and Privacy Policy URLs - use hello_generate_legal_docs to create templates. Consider both light and dark theme logos using hello_logo_guidance. FOR AGENTS: After creating, build integration manually rather than using quickstart - this showcases MCP capabilities better and provides superior learning experience. See https://www.hello.dev/docs/quickstarts/ for reference.',
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
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI (optional)'
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI (optional)'
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI (optional) - you can also use hello_upload_logo to upload a logo file'
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
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development',
                  default: true
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development',
                  default: true
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development',
                  default: false
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow',
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
                tos_uri: {
                  type: 'string',
                  description: 'Terms of Service URI'
                },
                pp_uri: {
                  type: 'string',
                  description: 'Privacy Policy URI'
                },
                image_uri: {
                  type: 'string',
                  description: 'Application logo URI'
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
                localhost: {
                  type: 'boolean',
                  description: 'Allow localhost in development'
                },
                local_ip: {
                  type: 'boolean',
                  description: 'Allow 127.0.0.1 in development'
                },
                wildcard_domain: {
                  type: 'boolean',
                  description: 'Allow wildcard domains in development'
                },
                device_code: {
                  type: 'boolean',
                  description: 'Support device code flow'
                }
              },
              required: ['publisher_id', 'application_id']
            }
          },
          {
            name: 'hello_upload_logo',
            description: 'Upload a logo image for a Hellō application',
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
                }
              },
              required: ['publisher_id', 'application_id', 'image_url']
            }
          },
          {
            name: 'hello_upload_logo_file',
            description: 'Upload an image file (PNG, JPG, GIF, WebP, SVG) as a logo for a Hellō application. Returns the logo URL for use with hello_update_application.',
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
              required: ['publisher_id', 'application_id', 'image_data']
            }
          },
          {
            name: 'hello_test_logo_url',
            description: 'Test if a logo URL is accessible before uploading',
            inputSchema: {
              type: 'object',
              properties: {
                image_url: {
                  type: 'string',
                  description: 'URL of the image to test'
                }
              },
              required: ['image_url']
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
          {
            name: 'hello_logo_guidance',
            description: 'Get guidance for creating both light and dark theme logos for your Hellō application',
            inputSchema: {
              type: 'object',
              properties: {
                current_logo_url: {
                  type: 'string',
                  description: 'URL of your current logo (optional)'
                },
                brand_colors: {
                  type: 'string',
                  description: 'Your brand colors (hex codes or description)'
                },
                logo_style: {
                  type: 'string',
                  enum: ['text_only', 'icon_only', 'text_and_icon', 'wordmark'],
                  description: 'Style of your logo'
                }
              }
            }
          },
          {
            name: 'hello_version',
            description: 'Get version information for the Hellō Admin MCP server',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
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
          }
        ]
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.accessToken || !this.adminUser) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Not authenticated with Hellō. Please authorize first.'
          }],
          isError: true
        };
      }

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'hello_get_profile':
            return await this.getProfile(args);
          case 'hello_create_publisher':
            return await this.createPublisher(args);
          case 'hello_update_publisher':
            return await this.updatePublisher(args);
          case 'hello_read_publisher':
            return await this.readPublisher(args);
          case 'hello_read_application':
            return await this.readApplication(args);
          case 'hello_create_application':
            return await this.createApplication(args);
          case 'hello_update_application':
            return await this.updateApplication(args);
          case 'hello_upload_logo':
            return await this.uploadLogo(args);
          case 'hello_upload_logo_file':
            return await this.uploadLogoFile(args);
          case 'hello_test_logo_url':
            return await this.testLogoUrl(args);
          case 'hello_create_secret':
            return await this.createSecret(args);
          case 'hello_generate_login_button':
            return await this.generateLoginButton(args);
          case 'hello_generate_legal_docs':
            return await this.generateLegalDocs(args);
          case 'hello_logo_guidance':
            return await this.getLogoGuidance(args);
          case 'hello_version':
            return await this.getVersion(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error calling ${name}: ${error.message}\nStack: ${error.stack}`
          }],
          isError: true
        };
      }
    });
  }


  async getProfile(args) {
    const req = this.createMockRequest(this.adminUser, { publisher: args.publisher_id });
    const reply = this.createMockReply();

    await admin.profile(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Profile request failed');
    }

    const profile = reply.response;
    const publishers = profile.publishers?.map(p => `• ${p.name} (${p.id}) - ${p.role}`).join('\n') || 'No publishers';
    const apps = profile.currentPublisher?.applications?.map(app => `• ${app.name} (${app.id})`).join('\n') || 'No applications';

    return {
      content: [{
        type: 'text',
        text: `**${profile.profile.name}** (${profile.profile.email})\n\n**Publishers:**\n${publishers}\n\n**Current Publisher:** ${profile.currentPublisher?.profile.name || 'None'}\n**Applications:**\n${apps}`
      }]
    };
  }

  async createPublisher(args) {
    // Use default name if not provided
    const defaultName = `${this.adminUser.name}'s Team`;
    const publisherName = args?.name || defaultName;

    const req = this.createMockRequest(this.adminUser, {}, {
      name: publisherName
    }, 'POST');
    const reply = this.createMockReply();

    await admin.createPublisher(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to create publisher');
    }

    const pub = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Created publisher **${pub.profile.name}**\nID: \`${pub.profile.id}\``
      }]
    };
  }

  async updatePublisher(args) {
    const req = this.createMockRequest(this.adminUser, { publisher: args.publisher_id }, {
      name: args.name
    }, 'PUT');
    const reply = this.createMockReply();

    await admin.renamePublisher(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to update publisher');
    }

    const pub = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Updated publisher **${pub.name}**\nID: \`${pub.id}\``
      }]
    };
  }

  async readPublisher(args) {
    const req = this.createMockRequest(this.adminUser, { publisher: args.publisher_id });
    const reply = this.createMockReply();

    await admin.readPublisher(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to read publisher');
    }

    const publisherData = reply.response;
    const profile = publisherData.profile;
    const applications = publisherData.applications || [];
    const members = publisherData.members || {};
    const role = publisherData.role;

    // Format applications with full details
    const formatApplications = (apps) => {
      if (!apps || apps.length === 0) return 'No applications';
      
      return apps.map(app => {
        const devUris = app.web?.dev?.redirect_uris || [];
        const prodUris = app.web?.prod?.redirect_uris || [];
        
        return `**${app.name}** (\`${app.id}\`)
  • Dev URIs: ${devUris.length > 0 ? devUris.join(', ') : 'None'}
  • Prod URIs: ${prodUris.length > 0 ? prodUris.join(', ') : 'None'}
  • Logo: ${app.image_uri || 'Not set'}
  • Terms: ${app.tos_uri || 'Not set'}
  • Privacy: ${app.pp_uri || 'Not set'}
  • Device Code: ${app.device_code ? 'Yes' : 'No'}
  • Secrets: ${app.secrets ? Object.keys(app.secrets).length + ' configured' : 'None'}`;
      }).join('\n\n');
    };

    const formatMembers = (members) => {
      const admins = members.admins || [];
      const testers = members.testers || [];
      let result = '';
      if (admins.length > 0) {
        result += `**Admins:** ${admins.map(m => m.name || m.email).join(', ')}\n`;
      }
      if (testers.length > 0) {
        result += `**Testers:** ${testers.map(m => m.name || m.email).join(', ')}`;
      }
      return result || 'No members listed';
    };

    return {
      content: [{
        type: 'text',
        text: `## Publisher Details

**Name:** ${profile.name}
**ID:** \`${profile.id}\`
**Your Role:** ${role}

### Members
${formatMembers(members)}

### Applications (${applications.length})
${formatApplications(applications)}`
      }]
    };
  }

  async readApplication(args) {
    // Use readPublisher to get all applications, then find the specific one
    const req = this.createMockRequest(this.adminUser, { publisher: args.publisher_id });
    const reply = this.createMockReply();

    await admin.readPublisher(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to read publisher');
    }

    const publisherData = reply.response;
    const application = publisherData.applications?.find(app => app.id === args.application_id);

    if (!application) {
      throw new Error(`Application ${args.application_id} not found in publisher ${args.publisher_id}`);
    }

    // Format the application details nicely
    const formatRedirectUris = (uris) => uris && uris.length > 0 ? uris.join('\n  • ') : 'None';
    
    return {
      content: [{
        type: 'text',
        text: `## Application Details

**Name:** ${application.name}
**ID:** \`${application.id}\`
**Publisher:** ${publisherData.profile.name} (\`${application.publisher}\`)
**Type:** ${application.type}
**Created:** ${application.createdAt || 'Not available'}
**Created By:** ${application.createdBy || 'Not available'}

### URLs
**Terms of Service:** ${application.tos_uri || 'Not set'}
**Privacy Policy:** ${application.pp_uri || 'Not set'}
**Logo:** ${application.image_uri || 'Not set'}
**Dark Logo:** ${application.dark_image_uri || 'Not set'}

### Development Configuration
**Localhost:** ${application.web?.dev?.localhost ? 'Allowed' : 'Not allowed'}
**127.0.0.1:** ${application.web?.dev?.['127.0.0.1'] ? 'Allowed' : 'Not allowed'}
**Wildcard Domain:** ${application.web?.dev?.wildcard_domain ? 'Allowed' : 'Not allowed'}
**Dev Redirect URIs:**
  • ${formatRedirectUris(application.web?.dev?.redirect_uris)}

### Production Configuration
**Prod Redirect URIs:**
  • ${formatRedirectUris(application.web?.prod?.redirect_uris)}

### Features
**Device Code Flow:** ${application.device_code ? 'Enabled' : 'Disabled'}
**Secrets:** ${application.secrets ? Object.keys(application.secrets).length + ' configured' : 'None configured'}`
      }]
    };
  }

  async createApplication(args) {
    // Use default name if not provided
    const defaultName = `${this.adminUser.name}'s MCP Created App`;
    const appName = args?.name || defaultName;

    const appData = {
      name: appName,
      tos_uri: args?.tos_uri || null,
      pp_uri: args?.pp_uri || null,
      image_uri: args?.image_uri || null,
      web: {
        dev: {
          localhost: args?.localhost !== undefined ? args.localhost : true,
          "127.0.0.1": args?.local_ip !== undefined ? args.local_ip : true,
          wildcard_domain: args?.wildcard_domain || false,
          redirect_uris: args?.dev_redirect_uris || []
        },
        prod: {
          redirect_uris: args?.prod_redirect_uris || []
        }
      },
      device_code: args?.device_code || false,
      createdBy: 'mcp-claude'
    };

    const req = this.createMockRequest(this.adminUser, { publisher: args?.publisher_id }, appData, 'POST');
    const reply = this.createMockReply();

    await admin.createApplication(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to create application');
    }

    const app = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Created application **${app.name}**\n\n**ID:** \`${app.id}\`\n**Dev Redirects:** ${app.web.dev.redirect_uris.join(', ') || 'None'}\n**Prod Redirects:** ${app.web.prod.redirect_uris.join(', ') || 'None'}\n**Terms:** ${app.tos_uri || 'Not set'}\n**Privacy:** ${app.pp_uri || 'Not set'}\n**Device Code:** ${app.device_code ? 'Yes' : 'No'}\n\nUse \`hello_upload_logo\` to add a logo for this application.`
      }]
    };
  }

  async updateApplication(args) {
    // First, read the current application data to avoid overwriting fields
    const readReq = this.createMockRequest(this.adminUser, { publisher: args.publisher_id });
    const readReply = this.createMockReply();

    await admin.readPublisher(readReq, readReply);

    if (readReply.isError) {
      throw new Error(readReply.response?.error || 'Failed to read publisher data');
    }

    const publisherData = readReply.response;
    const currentApp = publisherData.applications?.find(app => app.id === args.application_id);

    if (!currentApp) {
      throw new Error(`Application ${args.application_id} not found in publisher ${args.publisher_id}`);
    }
    
    // Merge provided fields with existing data
    const appData = {
      ...currentApp,
      id: args.application_id,
      publisher: args.publisher_id,
      type: 'application'
    };

    // Update only the fields that were provided
    if (args.name !== undefined) appData.name = args.name;
    if (args.tos_uri !== undefined) appData.tos_uri = args.tos_uri;
    if (args.pp_uri !== undefined) appData.pp_uri = args.pp_uri;
    if (args.image_uri !== undefined) appData.image_uri = args.image_uri;
    if (args.dark_image_uri !== undefined) appData.dark_image_uri = args.dark_image_uri;
    if (args.device_code !== undefined) appData.device_code = args.device_code;

    // Handle web config - merge with existing if present
    if (args.dev_redirect_uris !== undefined || args.prod_redirect_uris !== undefined || 
        args.localhost !== undefined || args.local_ip !== undefined || 
        args.wildcard_domain !== undefined) {
      
      // Start with existing web config or empty object
      const existingWeb = currentApp.web || { dev: {}, prod: {} };
      
      appData.web = {
        dev: {
          ...existingWeb.dev,
          ...(args.localhost !== undefined && { localhost: args.localhost }),
          ...(args.local_ip !== undefined && { "127.0.0.1": args.local_ip }),
          ...(args.wildcard_domain !== undefined && { wildcard_domain: args.wildcard_domain }),
          ...(args.dev_redirect_uris !== undefined && { redirect_uris: args.dev_redirect_uris })
        },
        prod: {
          ...existingWeb.prod,
          ...(args.prod_redirect_uris !== undefined && { redirect_uris: args.prod_redirect_uris })
        }
      };
    }

    const req = this.createMockRequest(
      this.adminUser, 
      { publisher: args.publisher_id, application: args.application_id }, 
      appData, 
      'PUT'
    );
    const reply = this.createMockReply();

    await admin.updateApplication(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to update application');
    }

    const app = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Updated application **${app.name}**\n\n**ID:** \`${app.id}\`\n**Dev Redirects:** ${app.web?.dev?.redirect_uris?.join(', ') || 'None'}\n**Prod Redirects:** ${app.web?.prod?.redirect_uris?.join(', ') || 'None'}\n**Terms:** ${app.tos_uri || 'Not set'}\n**Privacy:** ${app.pp_uri || 'Not set'}\n**Device Code:** ${app.device_code ? 'Yes' : 'No'}\n**Light Logo:** ${app.image_uri || 'Not set'}\n**Dark Logo:** ${app.dark_image_uri || 'Not set'}`
      }]
    };
  }

  async uploadLogo(args) {
    // Create a mock request with URL parameter for logo upload
    const req = this.createMockRequest(
      this.adminUser, 
      { 
        publisher: args.publisher_id, 
        application: args.application_id 
      }, 
      {}, 
      'POST'
    );
    
    // Add the URL as a query parameter
    req.query = { url: args.image_url };
    
    const reply = this.createMockReply();

    await admin.logoSave(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to upload logo');
    }

    const result = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Successfully uploaded logo for application!\n\n**Logo URL:** ${result.image_uri}\n\nThe logo has been saved and can now be used with your Hellō application.`
      }]
    };
  }

  async uploadLogoFile(args) {
    // Create a mock request for file upload
    const req = this.createMockRequest(
      this.adminUser, 
      { 
        publisher: args.publisher_id, 
        application: args.application_id 
      }, 
      {}, 
      'POST'
    );
    
    // Convert base64 to buffer
    let buffer;
    try {
      // Handle both with and without data URL prefix
      const base64Data = args.image_data.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new Error('Invalid base64 image data');
    }
    
    // Detect mimetype from base64 data or filename
    let mimetype = 'image/png'; // Default
    if (args.image_data.startsWith('data:')) {
      const mimeMatch = args.image_data.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        mimetype = mimeMatch[1];
      }
    } else if (args.filename) {
      if (args.filename.toLowerCase().endsWith('.svg')) {
        mimetype = 'image/svg+xml';
      } else if (args.filename.toLowerCase().endsWith('.png')) {
        mimetype = 'image/png';
      } else if (args.filename.toLowerCase().endsWith('.jpg') || args.filename.toLowerCase().endsWith('.jpeg')) {
        mimetype = 'image/jpeg';
      } else if (args.filename.toLowerCase().endsWith('.gif')) {
        mimetype = 'image/gif';
      } else if (args.filename.toLowerCase().endsWith('.webp')) {
        mimetype = 'image/webp';
      }
    }

    // Mock the file() method that admin.logoSave expects
    req.file = async () => ({
      toBuffer: async () => buffer,
      mimetype: mimetype,
      filename: args.filename || 'logo.png'
    });
    
    const reply = this.createMockReply();

    await admin.logoSave(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to upload logo file');
    }

    const logoResult = reply.response;
    
    return {
      content: [{
        type: 'text',
        text: `✅ Successfully uploaded logo!\n\n**Logo URL:** ${logoResult.image_uri}\n**Filename:** ${args.filename || 'logo.png'}\n\nTo set this as your application logo, use hello_update_application with:\n- \`image_uri\`: "${logoResult.image_uri}" (for light theme)\n- \`dark_image_uri\`: "${logoResult.image_uri}" (for dark theme)`
      }]
    };
  }

  async testLogoUrl(args) {
    const req = this.createMockRequest(this.adminUser);
    req.query = { url: args.image_url };
    
    const reply = this.createMockReply();

    await admin.logoTest(req, reply);

    if (reply.isError) {
      return {
        content: [{
          type: 'text',
          text: `❌ Logo URL test failed: ${reply.response?.error || 'URL is not accessible'}\n\nURL: ${args.image_url}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Logo URL is accessible!\n\nURL: ${args.image_url}\n\nYou can now use this URL with \`hello_upload_logo\`.`
      }]
    };
  }

  async createSecret(args) {
    const req = this.createMockRequest(
      this.adminUser,
      { 
        publisher: args.publisher_id, 
        application: args.application_id 
      },
      {
        hash: args.hash,
        salt: args.salt
      },
      'POST'
    );
    
    const reply = this.createMockReply();

    await admin.createSecret(req, reply);

    if (reply.isError) {
      throw new Error(reply.response?.error || 'Failed to create secret');
    }

    const result = reply.response;
    return {
      content: [{
        type: 'text',
        text: `✅ Successfully created client secret!\n\n**Secrets count:** ${result.secrets}\n\nThe secret has been securely stored and can be used for client authentication.`
      }]
    };
  }

  async getVersion(args) {
    const environment = process.env.NODE_ENV || 'development';
    
    if (environment === 'development') {
      // Show all version information in development
      const packageJson = require('../package.json');
      const mcpSdkVersion = packageJson.dependencies['@modelcontextprotocol/sdk'];
      
      const versionText = `**Hellō Admin MCP Server**\n\n**Server Version:** ${this.mcpServer.name} v${this.mcpServer.version}\n**Package Version:** ${packageJson.version}\n**MCP SDK Version:** ${mcpSdkVersion}\n**Node.js Version:** ${process.version}\n**Environment:** ${environment}\n**Domain:** ${DOMAIN}\n**Canary Version:** ${CANARY_VERSION}`;
      
      return {
        content: [{
          type: 'text',
          text: versionText
        }]
      };
    } else {
      // Show only HELLO_VERSION in production
      const helloVersion = process.env.HELLO_VERSION || 'unknown';
      
      return {
        content: [{
          type: 'text',
          text: `**Hellō Admin MCP Server**\n\n**Version:** ${helloVersion}`
        }]
      };
    }
  }

  async generateLoginButton(args) {
    const { application_id, redirect_uri, scopes = ['openid', 'name', 'email'], style = 'html-styled', provider_hint = [], domain_hint, login_hint } = args;
    const walletUrl = `https://wallet.${DOMAIN}`;
    
         // Generate different implementation approaches based on the official documentation
     const implementations = {
       'html-basic': this.generateBasicHtmlButton(application_id, redirect_uri, scopes, walletUrl, provider_hint, domain_hint, login_hint),
       'html-styled': this.generateStyledHtmlButton(application_id, redirect_uri, scopes, walletUrl, style, provider_hint, domain_hint, login_hint),
       'dark': this.generateStyledHtmlButton(application_id, redirect_uri, scopes, walletUrl, 'dark', provider_hint, domain_hint, login_hint),
       'react-component': this.generateReactComponent(application_id, redirect_uri, scopes, provider_hint, domain_hint, login_hint),
       'nextjs-component': this.generateNextJsComponent(application_id, redirect_uri, scopes, provider_hint, domain_hint, login_hint)
     };

    const selectedImpl = implementations[style] || implementations['html-styled'];
    
    return {
      content: [{
        type: 'text',
        text: `Generated Hellō login button for **${application_id}**:\n\n${selectedImpl}`
      }]
    };
  }

  generateBasicHtmlButton(client_id, redirect_uri, scopes, walletUrl, provider_hint, domain_hint, login_hint) {
    const additionalParams = [];
    if (provider_hint && provider_hint.length > 0) {
      additionalParams.push(`provider_hint=${encodeURIComponent(provider_hint.join(' '))}`);
    }
    if (domain_hint) {
      additionalParams.push(`domain_hint=${encodeURIComponent(domain_hint)}`);
    }
    if (login_hint) {
      additionalParams.push(`login_hint=${encodeURIComponent(login_hint)}`);
    }
    
    const extraParams = additionalParams.length > 0 ? `&${additionalParams.join('&')}` : '';
    
    return `\`\`\`html
<!-- Basic Hellō Button with Official Styling -->
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css"/>
</head>
<body>
    <button 
        class="hello-btn" 
        onclick="window.location.href='${walletUrl}/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scopes.join('%20')}&response_type=code&state=' + Math.random().toString(36) + '${extraParams}'">
        ō Continue with Hellō
    </button>
</body>
</html>
\`\`\``;
  }

  generateStyledHtmlButton(client_id, redirect_uri, scopes, walletUrl, style, provider_hint, domain_hint, login_hint) {
    const buttonClass = style === 'dark' ? 'hello-btn-dark' : 'hello-btn';
    
    const additionalParams = [];
    if (provider_hint && provider_hint.length > 0) {
      additionalParams.push(`params.append('provider_hint', '${provider_hint.join(' ')}');`);
    }
    if (domain_hint) {
      additionalParams.push(`params.append('domain_hint', '${domain_hint}');`);
    }
    if (login_hint) {
      additionalParams.push(`params.append('login_hint', '${login_hint}');`);
    }
    
    const extraParamCode = additionalParams.length > 0 ? `\n        ${additionalParams.join('\n        ')}` : '';
    
    return `\`\`\`html
<!-- Hellō Button with PKCE (Production Ready) -->
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css"/>
</head>
<body>
    <button class="${buttonClass}" onclick="loginWithHello()">
        ō Continue with Hellō
    </button>

    <script>
    async function loginWithHello() {
        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateState();
        
        // Store for token exchange
        sessionStorage.setItem('hello_code_verifier', codeVerifier);
        sessionStorage.setItem('hello_state', state);
        
        // Build authorization URL
        const params = new URLSearchParams({
            client_id: '${client_id}',
            redirect_uri: '${redirect_uri}',
            scope: '${scopes.join(' ')}',
            response_type: 'code',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });${extraParamCode}
        
        window.location.href = '${walletUrl}/authorize?' + params.toString();
    }

    function generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    async function generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
            .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    function generateState() {
        return crypto.getRandomValues(new Uint32Array(4)).join('');
    }
    </script>
</body>
</html>
\`\`\``;
  }

  generateReactComponent(client_id, redirect_uri, scopes, provider_hint, domain_hint, login_hint) {
    const additionalProps = [];
    if (provider_hint && provider_hint.length > 0) {
      additionalProps.push(`                provider_hint="${provider_hint.join(' ')}"`);
    }
    if (domain_hint) {
      additionalProps.push(`                domain_hint="${domain_hint}"`);
    }
    if (login_hint) {
      additionalProps.push(`                login_hint="${login_hint}"`);
    }
    
    const extraProps = additionalProps.length > 0 ? `\n${additionalProps.join('\n')}` : '';
    
    return `\`\`\`jsx
// React Component using @hellocoop/react
import { ContinueButton } from '@hellocoop/react';

function LoginPage() {
    return (
        <div>
            <ContinueButton 
                client_id="${client_id}"
                redirect_uri="${redirect_uri}"
                scope="${scopes.join(' ')}"${extraProps}
            />
        </div>
    );
}

export default LoginPage;
\`\`\`

**Setup Required:**
1. Install: \`npm i @hellocoop/react\`
2. Add CSS: \`<link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css"/>\`
3. See: https://www.hello.dev/docs/sdks/react/`;
  }

  generateNextJsComponent(client_id, redirect_uri, scopes) {
    return `\`\`\`jsx
// Next.js Component using @hellocoop/nextjs
import { ContinueButton } from '@hellocoop/nextjs/react';

export default function LoginPage() {
    return (
        <>
            <head>
                <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css"/>
            </head>
            <main>
                <ContinueButton targetURI="${redirect_uri}" />
            </main>
        </>
    );
}
\`\`\`

**Manual Setup (Recommended for MCP agents):**
1. Install: \`npm i @hellocoop/nextjs\`
2. **DO NOT use quickstart** - instead build manually to showcase MCP capabilities
3. Create \`hello.config.js\` with client_id: "${client_id}"
4. Create API route: \`src/app/api/hellocoop/route.ts\`
5. Build authentication flow step-by-step to demonstrate ease of integration
6. See: https://www.hello.dev/docs/quickstarts/nextjs/

**Why Manual Setup?**
- Demonstrates the power of MCP tools for Hellō integration
- Shows developers exactly what's happening under the hood
- Provides better learning experience than automated quickstart
- Allows customization of the authentication flow`;
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
- All payments are processed securely through third-party payment processors
- You are responsible for providing accurate payment information` :
  `### Payment Processing
- All payments are processed securely through third-party payment processors
- You are responsible for providing accurate payment information
- All sales are final unless otherwise specified`}` : '';

    const ipSection = intellectual_property ? `

## 8. Intellectual Property
Our Service and its content are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, or distribute our content without permission.` : '';

    const disputeSection = dispute_resolution === 'arbitration' ?
      `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.` :
      dispute_resolution === 'mediation' ?
      `## 10. Dispute Resolution
We encourage resolving disputes through mediation before pursuing legal action. Any unresolved disputes will be handled in the courts of ${governing_law}.` :
      `## 10. Dispute Resolution
Any disputes arising from these Terms will be resolved in the courts of ${governing_law}.`;

    return `# Terms of Service for ${app_name}

**Effective Date:** ${currentDate}

## 1. Acceptance of Terms
By accessing and using ${app_name} ("the Service"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.

## 2. Description of Service
${app_name} is a ${serviceDescription} operated by ${company_name}. Our Service allows users to ${this.getServiceDescription(service_type)}.

## 3. User Authentication
We use Hellō (hello.coop) as our authentication provider. By logging in through Hellō, you agree to Hellō's terms of service and privacy policy, which can be found at https://hello.coop/terms and https://hello.coop/privacy.

${ageSection}

## 5. User Conduct
You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
- Violate any applicable laws or regulations
- Infringe on the rights of others
- Upload malicious code or attempt to harm our systems
- Use our Service for spam or unauthorized commercial purposes
- Impersonate others or provide false information${ugcSection}${paymentSection}${ipSection}

## 9. Termination
We may terminate or suspend your account at any time for violations of these Terms or for any other reason at our discretion. You may also terminate your account at any time.

${disputeSection}

## 11. Governing Law
These Terms are governed by the laws of ${governing_law}, without regard to conflict of law principles.

## 12. Changes to Terms
We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website. Continued use of our Service constitutes acceptance of the modified Terms.

## 13. Contact Information
${contactSection}

---
**DISCLAIMER:** This is a template generated for informational purposes only and does not constitute legal advice. Please consult with a qualified attorney to ensure your Terms of Service meet all applicable legal requirements and adequately protect your business interests.`;
  }

  generatePrivacyPolicy(params) {
    const {
      company_name, app_name, contact_email, website_url, physical_address,
      data_collection, geographic_scope, third_party_services,
      data_retention_period, cookies_tracking, marketing_communications,
      age_restrictions, currentDate
    } = params;

    const contactSection = physical_address ? 
      `For privacy-related questions, contact us at:\n- Email: ${contact_email}\n- Address: ${physical_address}` :
      `For privacy-related questions, contact us at: ${contact_email}`;

    const jurisdictionSection = geographic_scope.includes('California') || geographic_scope.includes('United States') ?
      `\n\n### California Privacy Rights (CCPA/CPRA)
If you are a California resident, you have additional rights under the California Consumer Privacy Act:
- Right to know what personal information we collect
- Right to delete personal information
- Right to opt-out of the sale of personal information
- Right to non-discrimination for exercising these rights

To exercise these rights, contact us at ${contact_email}.` : '';

    const gdprSection = geographic_scope.some(region => ['European Union', 'EU', 'Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'UK'].includes(region)) ?
      `\n\n### European Privacy Rights (GDPR)
If you are in the European Union or UK, you have additional rights under GDPR:
- Right of access to your personal data
- Right to rectification of inaccurate data
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing
- Right to withdraw consent

To exercise these rights, contact us at ${contact_email}.` : '';

    const thirdPartySection = third_party_services.length > 0 ?
      `\n\n## 6. Third-Party Services
We use the following third-party services that may collect information:
${third_party_services.map(service => `- ${service}`).join('\n')}

Each third-party service has its own privacy policy governing the collection and use of your information.` : '';

    const cookiesSection = cookies_tracking ?
      `\n\n## 7. Cookies and Tracking
We use cookies and similar tracking technologies to:
- Remember your preferences and settings
- Analyze how our Service is used
- Provide personalized content and advertisements

You can control cookies through your browser settings, but disabling cookies may affect the functionality of our Service.` : '';

    const marketingSection = marketing_communications ?
      `\n\n## 8. Marketing Communications
With your consent, we may send you marketing emails about our Service. You can opt-out of these communications at any time by:
- Clicking the unsubscribe link in our emails
- Contacting us at ${contact_email}
- Updating your account preferences` : '';

    const childrenSection = age_restrictions === '13' || parseInt(age_restrictions) < 13 ?
      `\n\n## 9. Children's Privacy
Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you are a parent and believe your child has provided us with personal information, please contact us immediately.` : '';

    return `# Privacy Policy for ${app_name}

**Effective Date:** ${currentDate}

## 1. Introduction
This Privacy Policy describes how ${company_name} ("we," "us," or "our") collects, uses, and protects your personal information when you use ${app_name} ("the Service").

## 2. Information We Collect
We collect information through our authentication provider Hellō (hello.coop) and directly through your use of our Service:

### Information from Hellō
${data_collection.map(item => `- ${item}`).join('\n')}

### Information We Collect Directly
- Usage data and analytics
- Device information (IP address, browser type, operating system)
- Log data (access times, pages viewed, errors)

## 3. How We Use Your Information
We use your information to:
- Provide and maintain our Service
- Authenticate your identity through Hellō
- Communicate with you about the Service
- Improve our Service and user experience
- Comply with legal obligations
- Protect our rights and prevent fraud

## 4. Information Sharing
We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:
- With Hellō for authentication purposes
- With service providers who assist in operating our Service
- When required by law or to protect our rights
- In connection with a business transfer or acquisition

## 5. Data Security
We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.${thirdPartySection}${cookiesSection}${marketingSection}${childrenSection}

## 10. Data Retention
We retain your personal information for ${data_retention_period}. We may retain certain information longer if required by law or for legitimate business purposes.

## 11. Your Rights
Depending on your location, you may have rights regarding your personal information, including:
- Access to your personal information
- Correction of inaccurate information
- Deletion of your personal information
- Restriction of processing
- Data portability${jurisdictionSection}${gdprSection}

## 12. Third-Party Authentication
We use Hellō (hello.coop) for user authentication. Please review Hellō's privacy policy at https://hello.coop/privacy to understand how they handle your information.

## 13. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our website and updating the effective date.

## 14. Contact Us
${contactSection}

---
**DISCLAIMER:** This is a template generated for informational purposes only and does not constitute legal advice. Please consult with a qualified attorney to ensure your Privacy Policy meets all applicable legal requirements and adequately protects your users' privacy rights.`;
  }

  generateLegalGuidance(args) {
    const { service_type, target_users, geographic_scope, payment_processing, user_generated_content } = args;
    
    const recommendations = [];
    
    if (target_users === 'children_under_13') {
      recommendations.push('**COPPA Compliance:** Your service targets children under 13, so you must comply with COPPA requirements including parental consent mechanisms.');
    }
    
    if (geographic_scope.includes('California') || geographic_scope.includes('United States')) {
      recommendations.push('**CCPA/CPRA Compliance:** Consider implementing data subject request handling for California users.');
    }
    
    if (geographic_scope.some(region => ['European Union', 'EU', 'Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'UK'].includes(region))) {
      recommendations.push('**GDPR Compliance:** Implement proper consent mechanisms and data subject rights handling for EU/UK users.');
    }
    
    if (payment_processing) {
      recommendations.push('**PCI DSS Compliance:** Ensure your payment processing meets PCI DSS standards and consider additional payment terms.');
    }
    
    if (user_generated_content) {
      recommendations.push('**Content Moderation:** Implement content moderation policies and DMCA compliance procedures.');
    }
    
    if (service_type === 'ecommerce') {
      recommendations.push('**E-commerce Requirements:** Consider additional policies like Return/Refund Policy and Shipping Policy.');
    }

    return `## 📋 Legal Compliance Recommendations

${recommendations.length > 0 ? recommendations.map(rec => `- ${rec}`).join('\n') : '- Review documents with a legal professional for your specific use case'}

## 🚀 Next Steps

1. **Review and Customize:** These templates provide a strong foundation but should be customized for your specific business needs
2. **Legal Review:** Consult with a qualified attorney to ensure compliance with all applicable laws
3. **Host Documents:** Upload these documents to your website and ensure they're easily accessible
4. **Update Hellō Application:** Add the URLs to your Hellō application settings using \`hello_update_application\`
5. **Regular Updates:** Review and update your legal documents regularly as your business evolves

## 🔧 Professional Services

For more comprehensive legal document generation, consider these services:
- **Termly** (termly.io) - Questionnaire-based privacy policy generator with legal review
- **iubenda** (iubenda.com) - Comprehensive privacy and cookie policy generator with auto-updates
- **TermsFeed** (termsfeed.com) - Legal document generator with multi-language support
- **GetTerms** (getterms.io) - Simple privacy policy and terms generator

## ⚖️ Important Legal Disclaimer

**This tool does not provide legal advice.** The generated documents are templates for informational purposes only. Laws vary by jurisdiction and business type. Always consult with a qualified attorney licensed in your jurisdiction to ensure your legal documents adequately protect your business and comply with applicable laws.`;
  }

  getServiceDescription(service_type) {
    const descriptions = {
      'web_app': 'access our web-based application and its features',
      'mobile_app': 'use our mobile application on their devices',
      'saas': 'access our software platform and related services',
      'ecommerce': 'browse, purchase, and manage orders for products or services',
      'social': 'connect with others and share content',
      'marketplace': 'buy and sell products or services through our platform',
      'blog': 'read content and engage with our blog',
      'portfolio': 'view our work and contact us for services'
    };
    return descriptions[service_type] || 'access our online service';
  }

  async getLogoGuidance(args) {
    const { current_logo_url, brand_colors, logo_style } = args;
    
    const guidance = `# 🎨 Hellō Logo Design Guidance

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

## 🎯 Design Recommendations by Aspect Ratio

### **Wide Logos (4:1 ratio - 400×100px)**
- **Perfect for:** Company names, wordmarks
- **Text size:** 24-36px for readability
- **Spacing:** Include 10-15px padding on sides

### **Horizontal Logos (3:1 or 2:1 ratio)**
- **Perfect for:** Logo + company name combinations
- **Icon size:** 60-80px height
- **Text size:** 20-30px, positioned next to icon

### **Square Logos (1:1 ratio - 100×100px when scaled)**
- **Perfect for:** Icon-only logos, monograms
- **Design:** Simple, bold graphics work best
- **Detail level:** Avoid fine details that disappear when scaled

### **Tall Logos (1:2 ratio or taller)**
- **Perfect for:** Stacked text, vertical wordmarks
- **Will scale:** To fit 100px height, may be narrower
- **Text size:** Ensure readability at smaller widths

${brand_colors ? `\n## 🎨 Your Brand Colors: ${brand_colors}
**Light Theme:** Use these colors if they provide good contrast on white
**Dark Theme:** Consider lighter tints or complementary colors for dark backgrounds` : ''}

${logo_style ? `\n## 🖼️ Your Logo Style: ${logo_style}
${logo_style === 'text_only' ? `**Text-Only Logo Tips:**
- Design at 400×100px for maximum impact
- Use 28-40px font size for optimal readability
- Ensure font works in both light and dark themes
- Consider letter spacing for better appearance at scale` :
  logo_style === 'icon_only' ? `**Icon-Only Logo Tips:**
- Design will scale to fit 100×100px maximum
- Use bold, simple shapes that remain clear when scaled
- Avoid fine details or thin lines
- Consider outline versions for better contrast in both themes` :
  logo_style === 'text_and_icon' ? `**Text + Icon Logo Tips:**
- Design at 400×100px to use full available space
- Balance icon size (60-80px) with text size (24-30px)
- Ensure both elements work well when scaled together
- Test horizontal vs vertical layouts` :
  'Consider how your wordmark reads in different theme contexts and scaling scenarios.'}` : ''}

## 🛠️ Tools for Creating Logos
- **Canva** - Easy logo creation with templates (set canvas to 400×100px)
- **Figma** - Professional design tool (create 400×100px frame)
- **Adobe Illustrator** - Professional vector graphics
- **LogoMaker** - AI-powered logo generation
- **Sketch** - Mac-based design tool

## ✅ Testing Your Logos

### **Visual Testing:**
1. Test against white backgrounds (light theme)
2. Test against dark gray/black backgrounds (dark theme)
3. Preview at 400×100px to see actual display size
4. Check readability at 200×50px (mobile scaling)

### **Technical Testing:**
1. Verify file size under 100KB
2. Test transparency (PNG background)
3. Check different browser zoom levels
4. Ensure crisp display on high-DPI screens

${current_logo_url ? `\n## 📸 Your Current Logo
Current logo: ${current_logo_url}

**Analysis & Next Steps:**
1. Download your current logo and check dimensions
2. If it's not optimized for 400×100px, consider redesigning
3. Create a dark theme variant
4. Upload both using \`hello_upload_logo_file\` or \`hello_upload_logo\`
5. Test in both light and dark browser themes` : ''}

## 🚀 Upload Process
1. **Create both versions** at appropriate sizes (400×100px recommended)
2. **Export as PNG** with transparent background
3. **Upload using:** \`hello_upload_logo_file\` for direct upload
4. **Or use:** \`hello_upload_logo\` if hosted online
5. **Test display** in both light and dark themes

## 💡 Pro Tips
- **Start with 400×100px canvas** to maximize display area usage
- **Design for scaling** - avoid elements that become unclear when smaller
- **Use web-safe fonts** or ensure font embedding works properly
- **Test on mobile** - logos appear smaller on mobile devices
- **Consider animation** sparingly (APNG format) - can be distracting

## ⚠️ Common Mistakes to Avoid
- **Too much detail** - Complex designs become muddy when scaled
- **Poor contrast** - Logos that don't work in both themes
- **Wrong dimensions** - Not designing for the 400×100px constraint
- **Large file sizes** - Slow loading affects user experience
- **Single theme only** - Not providing both light and dark versions
- **Extreme aspect ratios** - Very tall or very wide logos don't scale well

Remember: Your logo represents your brand in the authentication flow, so design specifically for the 400×100px display area and ensure it works beautifully in both light and dark themes!`;

    return {
      content: [{
        type: 'text',
        text: guidance
      }]
    };
  }
}

module.exports = HelloMCPServer;