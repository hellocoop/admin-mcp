#!/usr/bin/env node

import Fastify from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HelloMCPServer } from './mcp-server.js';
import { createWellKnownHandlers } from './oauth-endpoints.js';
import { setupLogging, logOptions } from './log.js';
import { jwtValidationPlugin } from './jwt-validation.js';
import packageJson from './package.js';

class MCPHttpServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || '0.0.0.0';
    
    this.fastify = Fastify(logOptions);
    this.mcpServer = new HelloMCPServer();
    this.mcpServer.setupHandlers(); // Initialize MCP handlers
  }
  
  async init() {
    await this.setupPlugins();
    this.setupRoutes();
  }

  async setupPlugins() {
    // Setup structured logging
    setupLogging(this.fastify);
    // await this.fastify.register(setupLogging);
    
    // Setup JWT validation
    await this.fastify.register(jwtValidationPlugin);
    
    // CORS plugin
    await this.fastify.register(async (fastify) => {
      // Set CORS headers on all responses
      fastify.addHook('onRequest', async (request, reply) => {
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
      fastify.options('*', async (request, reply) => {
        reply.code(204);
        return '';
      });
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

        // JWT validation plugin has already validated the token
        // Extract token from validated payload for MCP server
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

        const mcpRequest = request.body;
        const response = await this.mcpServer.handleRequest(mcpRequest);
        
        return response;
      } catch (error) {
        request.log.error({
          event: 'mcp_request_error',
          error: {
            message: error.message,
            stack: error.stack
          }
        }, 'MCP request error');
        
        // Determine appropriate error code based on error type
        let errorCode = -32603; // Internal error (default)
        let errorMessage = 'Internal error';
        
        if (error.message.includes('Authentication')) {
          errorCode = -32001;
          errorMessage = 'Authentication required';
        } else if (error.message.includes('not found')) {
          errorCode = -32601;
          errorMessage = 'Method not found';
        } else if (error.message.includes('Invalid')) {
          errorCode = -32602;
          errorMessage = 'Invalid params';
        }
        
        return reply.code(500).send({
          jsonrpc: '2.0',
          error: {
            code: errorCode,
            message: errorMessage,
            data: error.message
          },
          id: request.body?.id || null
        });
      }
    };

    const mcpGetHandler = async (request, reply) => {
      return reply.redirect('https://www.hello.dev/docs/mcp/');
    };

    // Register both GET and POST handlers
    this.fastify.get('/', mcpGetHandler);
    this.fastify.post('/', mcpPostHandler);
    this.fastify.get('/mcp', mcpGetHandler);
    this.fastify.post('/mcp', mcpPostHandler);
  }

  async start() {
    try {
      await this.init(); // Initialize plugins and routes
      
      // Structured startup logging
      const startInfo = {
        event: 'server-start',
        config: {
          HOST: this.host,
          PORT: this.port.toString(),
          NODE_ENV: process.env.NODE_ENV || 'development',
          HELLO_DOMAIN: process.env.HELLO_DOMAIN || 'hello.coop',
          HELLO_ISSUER: process.env.HELLO_ISSUER || `https://issuer.${process.env.HELLO_DOMAIN || 'hello.coop'}`,
          HELLO_AUDIENCE: process.env.HELLO_AUDIENCE || `https://mcp.${process.env.HELLO_DOMAIN || 'hello.coop'}`,
          HELLO_ADMIN: process.env.HELLO_ADMIN || 'http://admin:8000',
          VERSION: packageJson.version,
          NAME: packageJson.name,
          DESCRIPTION: packageJson.description
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