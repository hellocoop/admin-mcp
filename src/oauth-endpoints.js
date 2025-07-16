// OAuth endpoints and well-known metadata
// Static configuration with environment variable overrides


export const domain = process.env.HELLO_DOMAIN || 'hello.coop';

// MCP Client Configuration
export const MCP_CLIENT_ID = process.env.MCP_CLIENT_ID || 'hello_mcp_client';

// Base URL constants
export const ADMIN_BASE_URL = process.env.HELLO_ADMIN || `https://admin.${domain}`;
export const MCP_BASE_URL = process.env.HELLO_MCP || `https://mcp.${domain}`;
export const WALLET_BASE_URL = process.env.HELLO_WALLET || `https://wallet.${domain}`;
export const ISSUER_BASE_URL = process.env.HELLO_ISSUER || `https://issuer.${domain}`;

// OAuth Authorization Server Metadata (RFC 8414)
export const OAUTH_AUTH_SERVER_METADATA = {
  issuer: MCP_BASE_URL,
  authorization_endpoint: `${WALLET_BASE_URL}/authorize`,
  token_endpoint: `${WALLET_BASE_URL}/oauth/token`,
  registration_endpoint: `${ADMIN_BASE_URL}/register/mcp`,
  jwks_uri: `${ISSUER_BASE_URL}/.well-known/jwks`,
  scopes_supported: ['mcp'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};

// OAuth Protected Resource Metadata (RFC 8707)
export const OAUTH_PROTECTED_RESOURCE_METADATA = {
  resource: `${MCP_BASE_URL}/`,
  authorization_servers: [MCP_BASE_URL],
  scopes_supported: ['mcp'],
  bearer_methods_supported: ['header'],
};

// Fastify route handlers
export function createWellKnownHandlers() {
  return {
    authServer: async (request, reply) => {
      // OAuth server request logged through structured logging
      
      return reply.send(OAUTH_AUTH_SERVER_METADATA);
    },

    protectedResource: async (request, reply) => {
      // Protected resource request logged through structured logging
      
      return reply.send(OAUTH_PROTECTED_RESOURCE_METADATA);
    }
  };
}

 