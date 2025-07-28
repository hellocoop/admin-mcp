// MCP Router - Main router that handles MCP protocol routing
// Delegates to feature modules (tools, resources, prompts)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { AuthManager } from './auth_manager.js';
import { AdminAPIClient } from './api_client.js';
import { getToolDefinitions, handleToolCall } from './mcp_tools.js';
import { getResourceDefinitions, handleResourceRead } from './mcp_resources.js';
import { getPromptDefinitions, handlePromptCall } from './mcp_prompts.js';
import { setSessionClientInfo } from './analytics.js';
import packageJson from './package.js';

export class MCPRouter {
  constructor(transport = 'unknown') {
    // Initialize core components
    this.authManager = new AuthManager();
    this.apiClient = new AdminAPIClient(this.authManager);
    this.transport = transport; // Store transport type
    
    // Initialize MCP server
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
    
    // Setup request handlers
    this.setupHandlers();
  }

  /**
   * Get the transport type for this router instance
   * @returns {string} - Transport type (stdio, http, or unknown)
   */
  getTransportType() {
    return this.transport;
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    // List tools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getToolDefinitions()
      };
    });

    // List resources handler
    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: getResourceDefinitions()
      };
    });

    // Read resource handler
    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        const result = await handleResourceRead(uri, this.apiClient);
        
        // Track successful resource read
        const context = {
          transport: this.getTransportType(),
          headers: request.headers || {},
          requestId: request.id || 'unknown',
          serverHost: request._serverContext?.serverHost || ''
        };
        
        return result;
      } catch (error) {
        // Track failed resource read (optional - could be noisy)
        throw error;
      }
    });

    // Tool call handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = performance.now();
      const { name, arguments: args } = request.params;
      
      try {
        const result = await handleToolCall(name, args, this.apiClient, this.authManager);
        
        // Track successful tool call
        const responseTime = Math.round(performance.now() - startTime);
        const context = {
          transport: this.getTransportType(),
          headers: request.headers || {},
          requestId: request.id || 'unknown',
          serverHost: request._serverContext?.serverHost || ''
        };
        
        return result;
      } catch (error) {
        // Track failed tool call
        const responseTime = Math.round(performance.now() - startTime);
        const context = {
          transport: this.getTransportType(),
          headers: request.headers || {},
          requestId: request.id || 'unknown',
          serverHost: request._serverContext?.serverHost || '',
          error: error.message
        };

        // Handle different error types appropriately for MCP clients
        if (error.httpStatus && error.httpHeaders) {
          // Authentication errors from Admin API - re-throw to be handled by transport layer
          throw error;
        }
        
        if (error.message && error.message.includes('Unknown tool:')) {
          // Unknown tool - throw as-is so transport can convert to "Method not found"
          throw error;
        }
        
        if (error.message && error.message.includes('Authentication')) {
          // Authentication errors - preserve the message
          throw error;
        }
        
        if (error.code && error.data) {
          // Custom JSON-RPC errors - preserve the code and data
          throw error;
        }
        
        // For other errors, provide a more descriptive message
        const errorMessage = error.message || 'Unknown error occurred';
        throw new Error(`Tool '${name}' failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Handle JSON-RPC requests
   * @param {Object} request - JSON-RPC request
   * @returns {Promise<Object>} - JSON-RPC response
   */
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
          // Capture client information for analytics
          const clientInfo = request.params?.clientInfo;
          const protocolVersion = request.params?.protocolVersion;
          const transport = this.getTransportType();
          setSessionClientInfo(clientInfo, protocolVersion, transport);
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
            const callResult = await callHandler({ method: 'tools/call', params: params || {} });
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
          const readHandler = this.mcpServer._requestHandlers.get('resources/read');
          if (readHandler) {
            const readResult = await readHandler({ method: 'resources/read', params: params || {} });
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
            result: {}
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
      console.log('🚨 MCP Router caught error:', error.message);
      console.log('🚨 Error code:', error.code);
      console.log('🚨 Error data:', error.data);
      console.log('🚨 Full error:', error);
      
      // Check if error has custom JSON-RPC properties
      const errorCode = error.code || -32000;
      const errorMessage = error.code === -32602 ? 'Invalid params' :
                          error.code === -32601 ? 'Method not found' :
                          error.code === -32001 ? 'Authentication required' :
                          'Internal error';
      const errorData = error.data || error.message;
      
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: errorCode,
          message: errorMessage,
          data: errorData
        }
      };
    }
  }

  /**
   * Get the underlying MCP server instance
   * @returns {Server} - MCP server instance
   */
  getMCPServer() {
    return this.mcpServer;
  }

  /**
   * Get the authentication manager
   * @returns {AuthManager} - Authentication manager instance
   */
  getAuthManager() {
    return this.authManager;
  }

  /**
   * Get the API client
   * @returns {AdminAPIClient} - Admin API client instance
   */
  getAPIClient() {
    return this.apiClient;
  }

  /**
   * Set access token (for compatibility with existing code)
   * @param {string} token - Access token
   */
  setAccessToken(token) {
    this.authManager.setAccessToken(token);
  }

  /**
   * Set JWT payload (for compatibility with existing code)
   * @param {Object} payload - JWT payload
   */
  setJWTPayload(payload) {
    this.authManager.setJWTPayload(payload);
  }

  /**
   * Set authentication callback (for compatibility with existing code)
   * @param {Function} callback - Authentication callback
   */
  setAuthenticationCallback(callback) {
    this.authManager.setAuthenticationCallback(callback);
  }
} 