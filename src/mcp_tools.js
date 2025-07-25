// MCP Tools for Hello Admin API
// Focused on new Hellō developers who want to easily create first app

import crypto from 'crypto';
import { validateMimeType, detectMimeType, extractBase64FromDataUrl, createMCPContent } from './utils.js';
import { sendPlausibleEvent } from './analytics.js';

/**
 * Flatten application object for response
 * @param {Object} app - Application object with nested properties
 * @returns {Object} - Application object with all properties flattened
 */
function flattenApp(app) {
  if (!app) return app;
  
  const flattened = { ...app };
  
  // Flatten web configuration
  if (app.web) {
    flattened.dev_localhost = app.web.dev?.localhost;
    flattened.dev_127_0_0_1 = app.web.dev?.["127.0.0.1"];
    flattened.dev_wildcard = app.web.dev?.wildcard_domain;
    flattened.dev_redirect_uris = app.web.dev?.redirect_uris;
    flattened.prod_redirect_uris = app.web.prod?.redirect_uris;
    
    // Remove the nested web object
    delete flattened.web;
  }
  
  // Add standard flattened fields
  flattened.device_code = app.device_code;
  flattened.created_by = app.createdBy;
  flattened.secrets = app.secrets || {};
  
  return flattened;
}

/**
 * Get tool definitions for MCP
 * @returns {Array} - Array of tool definitions
 */
export function getToolDefinitions() {
  return [
    {
      name: 'hello_manage_app',
      description: 'Manage Hellō applications - create, read, update, create secrets, and upload logos',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'read', 'update', 'create_secret', 'upload_logo_file', 'upload_logo_url'],
            description: 'Action to perform: create (new app), read (get app), update (modify app), create_secret (generate secret), upload_logo_file (upload logo from file), upload_logo_url (upload logo from URL)'
          },
          team_id: {
            type: 'string',
            description: 'ID of the team that owns the application (optional for all actions - uses default team if not specified)'
          },
          client_id: {
            type: 'string',
            description: 'ID of the OAuth client/application (optional for read - returns profile if omitted; required for: update, create_secret, upload_logo_file, upload_logo_url)'
          },
          name: {
            type: 'string',
            description: 'Name of the application (optional for: create, update - if not provided for create, will be generated from user name)'
          },
          tos_uri: {
            type: 'string',
            description: 'Terms of Service URI (optional for: create, update)'
          },
          pp_uri: {
            type: 'string',
            description: 'Privacy Policy URI (optional for: create, update)'
          },
          dev_localhost: {
            type: 'boolean',
            description: 'Allow localhost redirects in development environment (optional for: create, update)'
          },
          dev_127_0_0_1: {
            type: 'boolean',
            description: 'Allow 127.0.0.1 redirects in development environment (optional for: create, update)'
          },
          dev_wildcard: {
            type: 'boolean',
            description: 'Allow wildcard domain redirects in development environment (optional for: create, update)'
          },
          dev_redirect_uris: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of allowed redirect URIs for development environment (optional for: create, update)'
          },
          prod_redirect_uris: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of allowed redirect URIs for production environment (optional for: create, update)'
          },
          device_code: {
            type: 'boolean',
            description: 'Whether the application supports device code flow (optional for: create, update)'
          },
          logo_file: {
            type: 'string',
            description: 'Base64 encoded logo file content (required for: upload_logo_file)'
          },
          logo_url: {
            type: 'string',
            description: 'URL of the logo image to fetch and upload (required for: upload_logo_url)'
          },          
          logo_content_type: {
            type: 'string',
            description: 'MIME type of the logo file, e.g. "image/png" (required for: upload_logo_file and upload_logo_url)'
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark'],
            description: 'Logo theme - whether this is for light or dark mode (optional for: upload_logo_file, upload_logo_url, defaults to "light")'
          }
        },
        required: ['action'],
        allOf: [
          {
            if: {
              properties: { action: { const: 'create' } }
            },
            then: {
              required: ['action']
            }
          },
          {
            if: {
              properties: { action: { const: 'read' } }
            },
            then: {
              required: ['action']
            }
          },
          {
            if: {
              properties: { action: { const: 'update' } }
            },
            then: {
              required: ['action', 'client_id']
            }
          },
          {
            if: {
              properties: { action: { const: 'create_secret' } }
            },
            then: {
              required: ['action', 'client_id']
            }
          },
          {
            if: {
              properties: { action: { const: 'upload_logo_file' } }
            },
            then: {
              required: ['action', 'client_id', 'logo_file', 'logo_content_type']
            }
          },
          {
            if: {
              properties: { action: { const: 'upload_logo_url' } }
            },
            then: {
              required: ['action', 'client_id', 'logo_url', 'logo_content_type']
            }
          }
        ]
      }
    }
  ];
}

/**
 * Get or create default team for a user
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<string>} - Team ID
 */
async function getOrCreateDefaultTeam(apiClient, profile) {
  try {
    // Check if user has existing teams (using transformed structure)
    if (profile?.teams?.length > 0 && profile.teams[0].id) {
      return profile.teams[0].id;
    }
    
    // No teams exist, create a default one
    const userName = profile.user?.name || 'My';
    const defaultTeamName = `${userName} Team`;
    
    const newTeam = await apiClient.callAdminAPI('POST', '/api/v1/publishers', {
      name: defaultTeamName
    });
    
    return newTeam.profile.id;
  } catch (error) {
    throw new Error(`Failed to get or create default team: ${error.message}`);
  }
}

/**
 * Get user profile with team context
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<Object>} - Profile data with team terminology
 */
async function getProfileWithTeamContext(apiClient) {
  try {
    const response = await apiClient.callAdminAPI('GET', '/api/v1/profile');
    
    // Transform to MCP structure using real API response format
    return {
      user: response.profile, // Real API has profile at top level
      defaultTeam: response.currentPublisher?.profile ? {
        id: response.currentPublisher.profile.id,
        name: response.currentPublisher.profile.name,
        role: 'admin' // Assume admin role for current publisher
      } : null,
      teams: response.publishers?.map(pub => ({
        id: pub.id,
        name: pub.name,
        role: pub.role,
        applications: [] // Publishers don't include applications in list
      })) || [],
      // Applications are only available from currentPublisher
      applications: response.currentPublisher?.applications?.map(app => ({
        ...app,
        teamId: response.currentPublisher.profile.id,
        teamName: response.currentPublisher.profile.name
      })) || []
    };
  } catch (error) {
    // Return minimal profile on error
    return {
      user: null,
      defaultTeam: null,
      teams: [],
      applications: [],
      error: `Unable to fetch profile: ${error.message}`
    };
  }
}

/**
 * Handle the consolidated app management tool
 * @param {Object} args - Tool arguments
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<Object>} - Tool execution result with profile data
 */
async function handleManageApp(args, apiClient) {
  const { action, client_id, team_id, name, tos_uri, pp_uri, image_uri, dev_localhost, dev_127_0_0_1, dev_wildcard, dev_redirect_uris, prod_redirect_uris, device_code, logo_file, logo_content_type, logo_url, theme } = args;
  
  
  // Get current profile, team, and application data 
  const profile = await getProfileWithTeamContext(apiClient);

  // Handle read action separately - no need to create teams
  if (action === 'read') {
    sendPlausibleEvent('/tools/call/hello_manage_app/read');
    // If no client_id provided, return profile only
    if (!client_id) {
      return {
        profile,
        action_result: {
          action: 'read',
          success: true,
          message: 'Profile retrieved successfully'
        }
      };
    }
    
    // If client_id provided, look for it in current publisher's applications first
    let app = profile.applications.find(app => app.id === client_id);
    
    // If not found in current publisher, try to fetch directly via Admin API
    if (!app) {
      try {
        app = await apiClient.callAdminAPI('GET', `/api/v1/applications/${client_id}`);
        // Add team context if we found the app via direct lookup
        if (app) {
          app.teamId = app.publisher;
          // We don't have team name from direct lookup, so leave it undefined
        }
      } catch (error) {
        throw new Error(`Application with client_id ${client_id} not found`);
      }
    }
    
    return {
      profile,
      application: flattenApp(app),
      action_result: {
        action: 'read',
        success: true,
        message: 'Application retrieved successfully'
      }
    };
  }

  // For all other actions, get team ID (use provided or create default)
  const resolvedTeamId = team_id || await getOrCreateDefaultTeam(apiClient, profile);
  
  switch (action) {
    case 'create': {
      sendPlausibleEvent('/tools/call/hello_manage_app/create');
      // Generate name from existing profile if not provided
      let appName = name;
      if (!appName) {
        const userName = profile.user?.name || 'User';
        appName = `${userName}'s App`;
      }
      
      const appData = {
        name: appName,
          tos_uri: tos_uri || null,
          pp_uri: pp_uri || null,
          image_uri: image_uri || null,
          web: {
            dev: {
              localhost: dev_localhost !== undefined ? dev_localhost : true,
              "127.0.0.1": dev_127_0_0_1 !== undefined ? dev_127_0_0_1 : true,
              wildcard_domain: dev_wildcard !== undefined ? dev_wildcard : false,
              redirect_uris: dev_redirect_uris || []
            },
            prod: {
              redirect_uris: prod_redirect_uris || []
            }
          },
          device_code: device_code || false,
          createdBy: 'mcp'
        };
      
      const appResult = await apiClient.callAdminAPI('POST', `/api/v1/publishers/${resolvedTeamId}/applications`, appData);
      
              return {
          profile,
          application: flattenApp(appResult),
          action_result: {
            action: 'create',
            success: true,
            message: 'Application created successfully'
          }
        };
    }
    

    
    case 'update': {
      sendPlausibleEvent('/tools/call/hello_manage_app/update');
      if (!client_id) throw new Error('Client ID is required for update action');
      
      // Get current app data first
      const currentApp = await apiClient.callAdminAPI('GET', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`);
      
              // Build web object from flattened parameters if any are provided
        let webUpdate = {};
        if (dev_localhost !== undefined || dev_127_0_0_1 !== undefined || dev_wildcard !== undefined || dev_redirect_uris !== undefined || prod_redirect_uris !== undefined) {
          webUpdate = {
            web: {
              dev: {
                localhost: dev_localhost !== undefined ? dev_localhost : currentApp.web?.dev?.localhost || true,
                "127.0.0.1": dev_127_0_0_1 !== undefined ? dev_127_0_0_1 : currentApp.web?.dev?.["127.0.0.1"] || true,
                wildcard_domain: dev_wildcard !== undefined ? dev_wildcard : currentApp.web?.dev?.wildcard_domain || false,
                redirect_uris: dev_redirect_uris !== undefined ? dev_redirect_uris : currentApp.web?.dev?.redirect_uris || []
              },
              prod: {
                redirect_uris: prod_redirect_uris !== undefined ? prod_redirect_uris : currentApp.web?.prod?.redirect_uris || []
              }
            }
          };
        }

        const updateData = {
          ...currentApp,
          ...(name !== undefined && { name }),
          ...(tos_uri !== undefined && { tos_uri }),
          ...(pp_uri !== undefined && { pp_uri }),
          ...(image_uri !== undefined && { image_uri }),
          ...webUpdate,
          ...(device_code !== undefined && { device_code })
        };
      
              const appResult = await apiClient.callAdminAPI('PUT', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`, updateData);
      
              return {
          profile,
          application: flattenApp(appResult),
          action_result: {
            action: 'update',
            success: true,
            message: 'Application updated successfully'
          }
        };
    }
    
    case 'create_secret': {
      sendPlausibleEvent('/tools/call/hello_manage_app/create_secret');
      if (!client_id) throw new Error('Client ID is required for create_secret action');
      
      // Generate hash and salt automatically
      const salt = crypto.randomUUID();
      const secret = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(secret + salt).digest('hex');
      
      const secretData = { hash, salt };
      const secretResult = await apiClient.callAdminAPI('POST', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}/secrets`, secretData);
      
              return {
          profile,
          client_secret: secret, // Return the raw secret to the user
          action_result: {
            action: 'create_secret',
            success: true,
            message: 'Client secret created successfully'
          }
        };
    }
    
    case 'upload_logo_file': {
      sendPlausibleEvent('/tools/call/hello_manage_app/upload_logo_file');
      if (!client_id) throw new Error('Client ID is required for upload_logo_file action');
      if (!logo_file || !logo_content_type) {
        throw new Error('logo_file and logo_content_type are required for upload_logo_file action');
      }
      
      // Validate mime type
      const mimeValidation = validateMimeType(logo_content_type);
      if (!mimeValidation.valid) {
        throw new Error(mimeValidation.error);
      }
      
      // Generate filename from content type
      const extension = logo_content_type.split('/')[1] || 'png';
      const timestamp = Date.now();
      const logo_filename = `logo_${timestamp}.${extension}`;
      
      // Upload the logo using multipart form data
      const uploadResult = await uploadLogoBinary(resolvedTeamId, client_id, logo_file, logo_filename, logo_content_type, apiClient);
      
      // Determine which logo field to update based on theme
      const logoTheme = theme || 'light';
      
      // Get current application state
      const currentApp = await apiClient.callAdminAPI('GET', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`);
      
      // Update the application with the new logo URL in the appropriate field
      const updateData = {
        ...currentApp,
        [logoTheme === 'light' ? 'image_uri' : 'dark_image_uri']: uploadResult.image_uri
      };
      
            // Update the application
      const updatedApp = await apiClient.callAdminAPI('PUT', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`, updateData);
      
      return {
        profile,
        application: flattenApp(updatedApp),
        upload_result: {
          ...uploadResult,
          // Include generated filename in flattened response
          logo_filename: logo_filename
        },
          action_result: {
            action: 'upload_logo_file',
            success: true,
            message: `Logo uploaded successfully from file for ${logoTheme} theme`,
            logo_url: uploadResult.image_uri,
            theme: logoTheme
          }
        };
    }
    
    case 'upload_logo_url': {
      sendPlausibleEvent('/tools/call/hello_manage_app/upload_logo_url');
      if (!client_id) throw new Error('Client ID is required for upload_logo_url action');
      if (!logo_url || !logo_content_type) {
        throw new Error('logo_url and logo_content_type are required for upload_logo_url action');
      }
      
      // Validate mime type
      const mimeValidation = validateMimeType(logo_content_type);
      if (!mimeValidation.valid) {
        throw new Error(mimeValidation.error);
      }
      
      // Upload the logo using URL query parameter approach
      const path = `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}/logo?url=${encodeURIComponent(logo_url)}`;
      const uploadResult = await apiClient.callAdminAPI('POST', path, null);
      
      // Determine which logo field to update based on theme
      const logoTheme = theme || 'light';
      
      // Get current application state
      const currentApp = await apiClient.callAdminAPI('GET', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`);
      
      // Update the application with the new logo URL in the appropriate field
      const updateData = {
        ...currentApp,
        [logoTheme === 'light' ? 'image_uri' : 'dark_image_uri']: uploadResult.image_uri
      };
      
            // Update the application
      const updatedApp = await apiClient.callAdminAPI('PUT', `/api/v1/publishers/${resolvedTeamId}/applications/${client_id}`, updateData);
      
      return {
        profile,
        application: flattenApp(updatedApp),
        upload_result: uploadResult,
          action_result: {
            action: 'upload_logo_url',
            success: true,
            message: `Logo uploaded successfully from URL for ${logoTheme} theme`,
            logo_url: uploadResult.image_uri,
            theme: logoTheme
          }
        };
    }
    
    default: {
      throw new Error(`Unknown action: ${action}. Supported actions: create, read, update, create_secret, upload_logo_file, upload_logo_url`);
    }
  }
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
  let result;
  
  switch (toolName) {
    case 'hello_manage_app': {
      result = await handleManageApp(args, apiClient);
      break;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
  
  // Format all tool responses consistently for MCP
  return createMCPContent(result);
}

/**
 * Upload logo using binary data with multipart form
 * @param {string} publisherId - Publisher ID
 * @param {string} applicationId - Application ID  
 * @param {string} logoFile - Base64 encoded file content
 * @param {string} logoFilename - Original filename
 * @param {string} logoContentType - MIME type
 * @param {Object} apiClient - Admin API client instance
 * @returns {Promise<Object>} - Upload result
 */
async function uploadLogoBinary(publisherId, applicationId, logoFile, logoFilename, logoContentType, apiClient) {
  // Convert base64 to buffer
  const buffer = Buffer.from(logoFile, 'base64');
  
  // Create FormData
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  
  // Add the file with provided filename and content type
  formData.append('file', buffer, {
    filename: logoFilename,
    contentType: logoContentType
  });
  
  // Make the API call with form data
  const path = `/api/v1/publishers/${publisherId}/applications/${applicationId}/logo`;
  
  try {
    // Import HELLO_ADMIN config and get access token properly
    const { HELLO_ADMIN } = await import('./config.js');
    const accessToken = apiClient.authManager.getAccessToken();
    
    const response = await fetch(`${HELLO_ADMIN}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Logo upload failed: ${error.message}`);
  }
} 