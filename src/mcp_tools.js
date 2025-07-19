// MCP Tools for Hello Admin API
// Contains all tool definitions, schemas, and handlers

import { generateLegalDocs } from './content_generators.js';
import { validateMimeType, detectMimeType, extractBase64FromDataUrl } from './utils.js';

/**
 * Get all tool definitions for MCP
 * @returns {Array} - Array of tool definitions
 */
export function getToolDefinitions() {
  return [
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
            description: 'Allow wildcard domains in development'
          }
        },
        required: ['publisher_id']
      }
    },
    {
      name: 'hello_update_application',
      description: 'Update configuration for an existing Hellō application. Can modify redirect URIs, settings, and other application properties.',
      inputSchema: {
        type: 'object',
        properties: {
          publisher_id: {
            type: 'string',
            description: 'ID of the publisher that owns the application'
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
          dark_image_uri: {
            type: 'string',
            description: 'Dark theme logo URI'
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
      name: 'hello_update_logo',
      description: 'Update a logo for a Hellō application. Can upload from URL or direct image data. Updates the application with the new logo URL and returns the full application state.',
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
            description: 'URL of the image to upload (the image will be downloaded and uploaded to Hellō). Supported formats: PNG, JPG/JPEG, GIF, WebP, APNG, SVG'
          },
          image_data: {
            type: 'string',
            description: 'Base64 encoded image data. Supported formats: PNG, JPG/JPEG, GIF, WebP, APNG, SVG',
            supportedMimeTypes: [
              'image/png',
              'image/jpeg',
              'image/gif', 
              'image/webp',
              'image/apng',
              'image/svg+xml'
            ]
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark'],
            description: 'Theme for the logo - light theme logo (dark elements) or dark theme logo (light elements)',
            default: 'light'
          }
        },
        required: ['publisher_id', 'application_id'],
        oneOf: [
          { required: ['image_url'] },
          { required: ['image_data'] }
        ]
      }
    },
    {
      name: 'hello_create_secret',
      description: 'Create a new client secret for a Hellō application (for server-side authentication)',
      inputSchema: {
        type: 'object',
        properties: {
          publisher_id: {
            type: 'string',
            description: 'ID of the publisher that owns the application'
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
    }
  ];
}

/**
 * Handle tool execution
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Tool arguments
 * @param {Object} apiClient - Admin API client instance
 * @param {Object} authManager - Authentication manager instance
 * @returns {Promise<Object>} - Tool execution result
 */
export async function handleToolCall(toolName, args, apiClient, authManager) {
  switch (toolName) {
    case 'hello_get_profile': {
      // GET /api/v1/profile or /api/v1/profile/:publisher
      let path = '/api/v1/profile';
      if (args.publisher_id) path += `/${args.publisher_id}`;
      return await apiClient.callAdminAPIForMCP('get', path);
    }

    case 'hello_create_publisher': {
      // POST /api/v1/publishers
      return await apiClient.callAdminAPIForMCP('post', '/api/v1/publishers', { name: args.name });
    }

    case 'hello_update_publisher': {
      // PUT /api/v1/publishers/:publisher
      return await apiClient.callAdminAPIForMCP('put', `/api/v1/publishers/${args.publisher_id}`, { name: args.name });
    }

    case 'hello_read_publisher': {
      // GET /api/v1/publishers/:publisher
      return await apiClient.callAdminAPIForMCP('get', `/api/v1/publishers/${args.publisher_id}`);
    }

    case 'hello_read_application': {
      // GET /api/v1/publishers/:publisher/applications/:application
      return await apiClient.callAdminAPIForMCP('get', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`);
    }

    case 'hello_create_application': {
      // POST /api/v1/publishers/:publisher/applications
      // Transform MCP parameters to Admin API format
      const adminUser = authManager.getAdminUser();
      const applicationData = {
        name: args.name || `${adminUser?.name || 'User'}'s MCP Created App`,
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
      
      return await apiClient.callAdminAPIForMCP('post', `/api/v1/publishers/${args.publisher_id}/applications`, applicationData);
    }

    case 'hello_update_application': {
      // PUT /api/v1/publishers/:publisher/applications/:application
      // First get current application state
      const currentApp = await apiClient.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`);
      
      // Transform MCP parameters to Admin API format, preserving existing values
      const updateData = {
        ...currentApp,
        ...(args.name && { name: args.name }),
        ...(args.tos_uri !== undefined && { tos_uri: args.tos_uri }),
        ...(args.pp_uri !== undefined && { pp_uri: args.pp_uri }),
        ...(args.image_uri !== undefined && { image_uri: args.image_uri }),
        ...(args.dark_image_uri !== undefined && { dark_image_uri: args.dark_image_uri }),
        ...(args.device_code !== undefined && { device_code: args.device_code })
      };

      // Handle web configuration updates
      if (args.dev_redirect_uris !== undefined || args.prod_redirect_uris !== undefined ||
          args.localhost !== undefined || args.local_ip !== undefined || args.wildcard_domain !== undefined) {
        updateData.web = {
          dev: {
            localhost: args.localhost !== undefined ? args.localhost : (currentApp.web?.dev?.localhost ?? true),
            "127.0.0.1": args.local_ip !== undefined ? args.local_ip : (currentApp.web?.dev?.["127.0.0.1"] ?? true),
            wildcard_domain: args.wildcard_domain !== undefined ? args.wildcard_domain : (currentApp.web?.dev?.wildcard_domain ?? false),
            redirect_uris: args.dev_redirect_uris !== undefined ? args.dev_redirect_uris : (currentApp.web?.dev?.redirect_uris || [])
          },
          prod: {
            redirect_uris: args.prod_redirect_uris !== undefined ? args.prod_redirect_uris : (currentApp.web?.prod?.redirect_uris || [])
          }
        };
      }
      
      return await apiClient.callAdminAPIForMCP('put', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`, updateData);
    }

    case 'hello_update_logo': {
      return await handleLogoUpdate(args, apiClient);
    }

    case 'hello_create_secret': {
      // POST /api/v1/publishers/:publisher/applications/:application/secrets
      return await apiClient.callAdminAPIForMCP('post', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}/secrets`, {
        hash: args.hash,
        salt: args.salt
      });
    }

    case 'hello_generate_legal_docs': {
      return await generateLegalDocs(args);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Handle logo update with validation and processing
 * @param {Object} args - Logo update arguments
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<Object>} - Logo update result
 */
async function handleLogoUpdate(args, apiClient) {
  // Step 1: Get current application state
  const currentApp = await apiClient.callAdminAPI('get', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`);
  
  // Step 2: Upload the logo and get the URL
  let logoUrl;
  if (args.image_url) {
    // Use URL query parameter approach (simpler and matches what works)
    const path = `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}/logo?url=${encodeURIComponent(args.image_url)}`;
    const uploadResult = await apiClient.callAdminAPI('post', path, null);
    logoUrl = uploadResult.image_uri;
  } else if (args.image_data) {
    // Validate mimetype before uploading
    const detectedMimeType = detectMimeType(args.image_data);
    if (!detectedMimeType) {
      throw new Error('Could not determine image format. Please ensure the image data includes a data URL prefix (e.g., data:image/png;base64,...)');
    }
    
    const mimeValidation = validateMimeType(detectedMimeType);
    if (!mimeValidation.valid) {
      throw new Error(mimeValidation.error);
    }
    
    // Use multipart form data for binary upload
    const uploadResult = await uploadLogoBinary(args.publisher_id, args.application_id, args.image_data, apiClient);
    logoUrl = uploadResult.image_uri;
  } else {
    throw new Error('Either image_url or image_data must be provided');
  }
  
  // Step 3: Update the application with the new logo URL
  const theme = args.theme || 'light';
  const updateData = {
    ...currentApp,
    // Update the appropriate logo field based on theme
    [theme === 'light' ? 'image_uri' : 'dark_image_uri']: logoUrl
  };
  
  // Step 4: Call the application update API
  const updatedApp = await apiClient.callAdminAPI('put', `/api/v1/publishers/${args.publisher_id}/applications/${args.application_id}`, updateData);
  
  // Step 5: Return the full application state
  return {
    contents: [{
      type: 'text',
      text: JSON.stringify(updatedApp, null, 2)
    }],
    content: [{
      type: 'text',
      text: JSON.stringify(updatedApp, null, 2)
    }]
  };
}

/**
 * Upload binary logo data
 * @param {string} publisherId - Publisher ID
 * @param {string} applicationId - Application ID
 * @param {string} base64ImageData - Base64 encoded image data
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<Object>} - Upload result
 */
async function uploadLogoBinary(publisherId, applicationId, base64ImageData, apiClient) {
  try {
    // Detect mimetype from data URL prefix
    const detectedMimeType = detectMimeType(base64ImageData);
    if (!detectedMimeType) {
      throw new Error('Could not determine image format from data');
    }
    
    // Remove data URL prefix if present
    const base64Data = extractBase64FromDataUrl(base64ImageData);
    
    // Use the API client's uploadLogo method
    return await apiClient.uploadLogo(publisherId, applicationId, base64Data, detectedMimeType);
    
  } catch (error) {
    console.error('❌ Binary logo upload failed:', error);
    throw error;
  }
} 