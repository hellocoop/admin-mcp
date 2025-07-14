#!/usr/bin/env node

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HelloMCPServer } from './mcp-server.js';
import { createWellKnownHandlers } from './oauth-endpoints.js';

class MCPHttpServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || process.env.HOST || '0.0.0.0';
    this.app = express();
    this.server = null;
    this.mcpServer = new HelloMCPServer();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS middleware - matching Admin server approach
    this.app.use((req, res, next) => {
      const requestedHeaders = req.headers['access-control-request-headers'];
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', requestedHeaders || 'Authorization, Content-Type, mcp-protocol-version');
      res.header('Access-Control-Max-Age', '86400');
      
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      next();
    });

    // JSON parsing middleware
    this.app.use(express.json());
  }

  setupRoutes() {
    // OAuth well-known endpoints
    const endpoints = createWellKnownHandlers();
    this.app.get('/.well-known/oauth-authorization-server', endpoints.authServer);
    this.app.get('/.well-known/oauth-protected-resource', endpoints.protectedResource);

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // MCP endpoints - both / and /mcp
    const mcpPostHandler = async (req, res) => {
      try {
        // Extract and set authorization if present
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i);
          if (bearerMatch) {
            const token = bearerMatch[1].trim();
            this.mcpServer.setAccessToken(token);
          }
        } else {
          this.mcpServer.setAccessToken(null);
        }

        const request = req.body;
        const response = await this.mcpServer.handleRequest(request);
        
        // Check if the response contains HTTP status and headers from admin API
        if (response && response.result && response.result.content && response.result.content[0] && response.result.content[0].text) {
          try {
            const contentData = JSON.parse(response.result.content[0].text);
            if (contentData._httpStatus === 401 || contentData._httpStatus === 400) {
              // Set WWW-Authenticate header for authentication errors (matching Admin server format)
              const domain = process.env.HELLO_DOMAIN || 'hello.coop';
              res.header('WWW-Authenticate', `Bearer realm="Hello MCP Server", error="invalid_request", error_description="Valid bearer token required", scope="mcp", resource_metadata="https://mcp.${domain}/.well-known/oauth-protected-resource"`);
              res.status(401);
            }
          } catch (parseError) {
            // If parsing fails, continue with normal response
          }
        }
        
        res.json(response);
      } catch (error) {
        console.error('MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: req.body?.id || null
        });
      }
    };

    const mcpGetHandler = (req, res) => {
      res.redirect('https://www.hello.dev/docs/mcp/');
    };

    // Register both GET and POST handlers
    this.app.get('/', mcpGetHandler);
    this.app.post('/', mcpPostHandler);
    this.app.get('/mcp', mcpGetHandler);
    this.app.post('/mcp', mcpPostHandler);
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Hello MCP Server running on http://${this.host}:${this.port}`);
          console.log(`📡 MCP endpoints: POST / or POST /mcp`);
          console.log(`🔗 Docs redirect: GET / or GET /mcp -> https://www.hello.dev/docs/mcp/`);
          console.log(`🔍 OAuth metadata: GET /.well-known/oauth-authorization-server`);
          console.log(`🛡️  Protected resource: GET /.well-known/oauth-protected-resource`);
          console.log(`❤️  Health check: GET /health`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (global.mcpHttpServer) {
    await global.mcpHttpServer.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (global.mcpHttpServer) {
    await global.mcpHttpServer.stop();
  }
  process.exit(0);
});

// Start server if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const server = new MCPHttpServer();
  global.mcpHttpServer = server;
  
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { MCPHttpServer }; 