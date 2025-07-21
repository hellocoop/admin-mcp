// Centralized configuration for MCP Server
// All environment variables should be referenced here

// Basic environment settings
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || 3000;
export const HOST = process.env.HOST || '0.0.0.0';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Hello.coop domain configuration
export const HELLO_DOMAIN = process.env.HELLO_DOMAIN || 'hello.coop';

// Service URLs - Internal (Docker network) vs External
export const HELLO_ADMIN = process.env.HELLO_ADMIN || `https://admin.${HELLO_DOMAIN}`;
export const HELLO_ISSUER = process.env.HELLO_ISSUER || `https://issuer.${HELLO_DOMAIN}`;
export const HELLO_AUDIENCE = process.env.HELLO_AUDIENCE || `https://admin.${HELLO_DOMAIN}`;

// External service URLs (for OAuth metadata and public endpoints)
export const ADMIN_BASE_URL = `https://admin.${HELLO_DOMAIN}`;
export const MCP_BASE_URL = `https://mcp.${HELLO_DOMAIN}`;
export const WALLET_BASE_URL = `https://wallet.${HELLO_DOMAIN}`;
export const ISSUER_BASE_URL = `https://issuer.${HELLO_DOMAIN}`;

// OAuth client configuration
// MCP_STDIO_CLIENT_ID: Used by stdio transport for local OAuth flows
export const MCP_STDIO_CLIENT_ID = process.env.MCP_STDIO_CLIENT_ID || 'hello_mcp_stdio_client';
// MCP_HTTP_CLIENT_ID: Used by HTTP transport (obtained via DCR in Admin server)
export const MCP_HTTP_CLIENT_ID = process.env.MCP_HTTP_CLIENT_ID || 'hello_mcp_http_client';
export const HELLO_ACCESS_TOKEN = process.env.HELLO_ACCESS_TOKEN || null;

// Development flags
export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

// Package information
export const VERSION = process.env.npm_package_version || '1.0.0';
export const NAME = process.env.npm_package_name || '@hellocoop/mcp';
export const DESCRIPTION = process.env.npm_package_description || 'Model Context Protocol (MCP) for Hellō Admin API.';

// Configuration object for logging
export const CONFIG = {
  NODE_ENV,
  HOST,
  PORT,
  HELLO_DOMAIN,
  HELLO_ISSUER,
  HELLO_AUDIENCE,
  HELLO_ADMIN,
  VERSION,
  NAME,
  DESCRIPTION
}; 