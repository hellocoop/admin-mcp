#!/usr/bin/env node

import Fastify from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HelloMCPServer } from './mcp-server.js';
import { createWellKnownHandlers } from './oauth-endpoints.js';
import { setupLogging, logOptions } from './log.js';
import { jwtValidationPlugin } from './jwt-validation.js';
import packageJson from './package.js';
import { PORT, HOST, CONFIG } from './config.js';

/**
 * Validates authentication for MCP requests
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object|null} - Returns null if authentication is valid, or sends error response and returns truthy value if invalid
 */
async function validateAuthentication(request, reply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return reply.code(401)
      .header('WWW-Authenticate', 'Bearer')
      .send({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            error: 'invalid_request',
            error_description: 'Authorization header required'
          }
        },
        id: request.body?.id || null
      });
  }

  const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return reply.code(401)
      .header('WWW-Authenticate', 'Bearer')
      .send({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            error: 'invalid_request',
            error_description: 'Bearer token required'
          }
        },
        id: request.body?.id || null
      });
  }

  const token = bearerMatch[1].trim();
  
  // Validate JWT token
  const { validateJWT, createWWWAuthenticateHeader } = await import('./jwt-validation.js');
  const validationResult = validateJWT(token);
  
  if (!validationResult.valid) {
    const statusCode = validationResult.error === 'insufficient_scope' ? 403 : 401;
    const wwwAuthenticateHeader = createWWWAuthenticateHeader(validationResult);
    
    return reply.code(statusCode)
      .header('WWW-Authenticate', wwwAuthenticateHeader)
      .send({
        jsonrpc: '2.0',
        error: {
          code: validationResult.error === 'insufficient_scope' ? -32003 : -32001,
          message: validationResult.error === 'insufficient_scope' ? 'Insufficient scope' : 'Authentication required',
          data: {
            error: validationResult.error,
            error_description: validationResult.error_description
          }
        },
        id: request.body?.id || null
      });
  }

  // Return the validated token and payload for use by the caller
  return {
    token: token,
    payload: validationResult.payload
  };
}

class MCPHttpServer {
  constructor(options = {}) {
    this.port = options.port || PORT;
    this.host = options.host || HOST;
    
    this.fastify = Fastify(logOptions);
    this.mcpServer = new HelloMCPServer('http');
    // MCP handlers are now automatically set up in the constructor
  }
  
  async init() {
    await this.setupPlugins();
    this.setupRoutes();
  }

  async setupPlugins() {
    // Setup structured logging
    setupLogging(this.fastify);
    
    // Setup JWT validation
    await this.fastify.register(jwtValidationPlugin);
    
    // CORS
    this.fastify.addHook('preHandler', async (request, reply) => {
      const origin = request.headers.origin || '*';
      const requestedHeaders = request.headers['access-control-request-headers'];
      
      // Always set CORS headers
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', requestedHeaders || 'Authorization, Content-Type, Accept, Origin, X-Requested-With, mcp-protocol-version');
      reply.header('Access-Control-Max-Age', '86400');
      reply.header('Access-Control-Allow-Credentials', 'false');
    });
      
    // Handle OPTIONS requests
    this.fastify.options('*', async (request, reply) => {
      reply.code(204);
      return '';
    });
    
    // JSON parsing error handler
    this.fastify.setErrorHandler(async (error, request, reply) => {
      if (error.statusCode === 400 && error.message.includes('JSON')) {
        return reply.code(400).send({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error - Invalid JSON'
          },
          id: null
        });
      }
      
      request.log.error({
        event: 'fastify_error',
        error: {
          message: error.message,
          stack: error.stack,
          statusCode: error.statusCode
        }
      }, 'Fastify error');
      
      reply.code(error.statusCode || 500).send({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        },
        id: null
      });
    });
  }

  setupRoutes() {
    // OAuth well-known endpoints
    const endpoints = createWellKnownHandlers();
    this.fastify.get('/.well-known/oauth-authorization-server', endpoints.authServer);
    this.fastify.get('/.well-known/oauth-protected-resource', endpoints.protectedResource);

    // Health check
    this.fastify.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Version endpoint
    this.fastify.get('/version', async (request, reply) => {
      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description
      };
    });

    // Standardized health endpoint
    this.fastify.get('/api/health/:caller', async (request, reply) => {
      return {
        status: 'healthy',
        service: 'admin-mcp',
        version: packageJson.version,
        commit: process.env.GIT_COMMIT ?? 'unknown',
        node: process.versions.node,
        arch: process.arch,
        uptime: process.uptime(),
        caller: request.params.caller,
      };
    });

    // MCP POST handler
    const mcpPostHandler = async (request, reply) => {
      try {
        // Validate JSON-RPC request structure
        const { jsonrpc, id, method, params } = request.body;
        
        if (jsonrpc !== '2.0') {
          return reply.code(400).send({
            jsonrpc: '2.0',
            id: id || null,
            error: {
              code: -32600,
              message: 'Invalid Request - jsonrpc must be "2.0"'
            }
          });
        }

        // Check authentication for tools/call requests
        if (method === 'tools/call') {
          const authResult = await validateAuthentication(request, reply);
          if (reply.sent) {
            // Authentication failed and response was already sent
            return;
          }
          
          // Set validated token and payload for MCP server
          this.mcpServer.setAccessToken(authResult.token);
          if (authResult.payload) {
            this.mcpServer.setJWTPayload(authResult.payload);
          }
        } else {
          // For non-tools/call requests, still try to extract token if present
          const authHeader = request.headers.authorization;
          if (authHeader) {
            const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i);
            if (bearerMatch) {
              const token = bearerMatch[1].trim();
              this.mcpServer.setAccessToken(token);
            }
          }

          // Pass validated JWT payload to MCP server for enhanced logging
          if (request.jwtPayload) {
            this.mcpServer.setJWTPayload(request.jwtPayload);
          }
        }

        const mcpRequest = request.body;
        // Add server context for analytics
        mcpRequest._serverContext = {
          serverHost: request.headers.host || 'unknown',
          headers: request.headers
        };
        const response = await this.mcpServer.handleRequest(mcpRequest);
        
        // Log the response for debugging
        const logData = {
          event: 'mcp_response',
          method: method,
          responseType: response.error ? 'error' : 'success',
          responseSize: JSON.stringify(response).length,
          hasResult: !!response.result,
          hasError: !!response.error,
        };

        // Add error details if present
        if (response.error) {
          logData.errorCode = response.error.code;
          logData.errorMessage = response.error.message;
          logData.errorData = response.error.data;
        }

        // Add result summary for successful responses
        if (response.result) {
          if (method === 'tools/list') {
            logData.toolCount = response.result.tools?.length || 0;
            logData.toolNames = response.result.tools?.map(t => t.name) || [];
          } else if (method === 'resources/list') {
            logData.resourceCount = response.result.resources?.length || 0;
          } else if (method === 'tools/call') {
            logData.toolName = request.body?.params?.name;
            logData.toolAction = request.body?.params?.arguments?.action;
          }
        }

        request.log.info(logData, 'MCP response generated');
        
        // Also log the full response content for debugging as a parsed object
        request.log.info({
          event: 'mcp_response_content',
          responseContent: response
        }, '📋 MCP Response Content');
        
        return response;
      } catch (error) {
        request.log.error({
          event: 'mcp_request_error',
          error: {
            message: error.message,
            stack: error.stack
          }
        }, 'MCP request error');
        
        // Check if this is an authentication error from the Admin API
        if (error.httpStatus && error.httpHeaders) {
          const statusCode = error.httpStatus;
          const headers = error.httpHeaders;
          
          // Set WWW-Authenticate header if present
          if (headers['WWW-Authenticate']) {
            reply.header('WWW-Authenticate', headers['WWW-Authenticate']);
          }
          
          return reply.code(statusCode).send({
            jsonrpc: '2.0',
            error: {
              code: statusCode === 403 ? -32003 : -32001,
              message: statusCode === 403 ? 'Insufficient scope' : 'Authentication required',
              data: error.errorData || {
                error: 'authentication_failed',
                error_description: 'Authentication failed'
              }
            },
            id: request.body?.id || null
          });
        }
        
        // Check if error has custom JSON-RPC properties
        let errorCode = error.code || -32603; // Use custom code or default to Internal error
        let errorMessage = 'Internal error';
        let errorData = error.data || error.message;
        
        // Determine appropriate error message based on code or error type
        if (error.code === -32602) {
          errorMessage = 'Invalid params';
        } else if (error.code === -32601) {
          errorMessage = 'Method not found';
        } else if (error.code === -32001) {
          errorMessage = 'Authentication required';
        } else if (error.message.includes('Authentication')) {
          errorCode = -32001;
          errorMessage = 'Authentication required';
        } else if (error.message.includes('Unknown tool:')) {
          errorCode = -32601;
          errorMessage = 'Method not found';
        } else if (error.message.includes('not found') || error.message.includes('Method not found')) {
          errorCode = -32601;
          errorMessage = 'Method not found';
        } else if (error.message.includes('Invalid') || error.message.includes('failed:')) {
          errorCode = -32602;
          errorMessage = 'Invalid params';
        }
        
        return reply.code(500).send({
          jsonrpc: '2.0',
          error: {
            code: errorCode,
            message: errorMessage,
            data: errorData
          },
          id: request.body?.id || null
        });
      }
    };

    const mcpGetHandler = async (request, reply) => {
      return reply.code(405)
        .header('Allow', 'POST')
        .send({
          error: 'Method Not Allowed',
          message: 'This MCP server does not support SSE streaming on GET requests'
        });
    };

    // Register both GET and POST handlers
    this.fastify.get('/', mcpGetHandler);
    this.fastify.post('/', mcpPostHandler);
  }

  async start() {
    try {
      await this.init(); // Initialize plugins and routes
      
      // Structured startup logging
      const startInfo = {
        event: 'server-start',
        config: {
          ...CONFIG,
          HOST: this.host,
          PORT: this.port.toString()
        }
      };
      
      this.fastify.log.info(startInfo, 'mcp server starting');
      
      await this.fastify.listen({ port: this.port, host: this.host });
      
      this.fastify.log.info({
        event: 'server-listening',
        address: `http://${this.host}:${this.port}`
      }, `MCP Server listening on http://${this.host}:${this.port}`);
    } catch (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  }

  async stop() {
    try {
      await this.fastify.close();
      this.fastify.log.info({ event: 'server-stopped' }, 'MCP Server stopped');
    } catch (err) {
      console.error('Error stopping server:', err);
    }
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Create server instance
  const server = new MCPHttpServer();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch(console.error);
}

export { MCPHttpServer };