// MCP Resources for Hello Admin API
// Contains all resource definitions and handlers

import { 
  generateLogoGuidanceResource, 
  generateLoginButtonGuidanceResource, 
  generateSupportedLogoFormatsResource 
} from './content_generators.js';

/**
 * Get all resource definitions for MCP
 * @returns {Array} - Array of resource definitions
 */
export function getResourceDefinitions() {
  return [
    {
      uri: 'https://www.hello.dev/markdown/docs/docs.md',
      name: 'Hellō Documentation Overview',
      description: 'Complete documentation overview for integrating Hellō authentication into your application',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/getting-started.md',
      name: 'Hellō Getting Started',
      description: 'Getting started guide for Hellō authentication integration',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/quickstarts.md',
      name: 'Hellō Quickstarts',
      description: 'Quick setup guides for Express, Fastify, Next.js, WordPress and other frameworks',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/quickstarts/express.md',
      name: 'Hellō Express Quickstart',
      description: 'Quick setup guide for Express.js applications',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/quickstarts/fastify.md',
      name: 'Hellō Fastify Quickstart',
      description: 'Quick setup guide for Fastify applications',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/quickstarts/nextjs.md',
      name: 'Hellō Next.js Quickstart',
      description: 'Quick setup guide for Next.js applications',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/buttons.md',
      name: 'Hellō Buttons',
      description: 'How to implement and customize Hellō login buttons in your application',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/scopes.md',
      name: 'Hellō Scopes',
      description: 'Available scopes and claims you can request from users',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/apis/wallet.md',
      name: 'Hellō Wallet API',
      description: 'Wallet API reference including authorization parameters, provider_hint, domain_hint, and response handling',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/apis/admin.md',
      name: 'Hellō Admin API',
      description: 'Admin API reference for managing applications and publishers',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/mcp.md',
      name: 'Hellō MCP Server',
      description: 'Model Context Protocol server documentation for Hellō integration',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/sdks.md',
      name: 'Hellō SDKs',
      description: 'Software Development Kits for various frameworks and platforms',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/sdks/react.md',
      name: 'Hellō React SDK',
      description: 'React SDK for Hellō authentication integration',
      mimeType: 'text/markdown'
    },
    {
      uri: 'https://www.hello.dev/markdown/docs/docs/sdks/nextjs.md',
      name: 'Hellō Next.js SDK',
      description: 'Next.js SDK for Hellō authentication integration',
      mimeType: 'text/markdown'
    },
    {
      uri: 'hello://logo-guidance',
      name: 'Hellō Logo Design Guidance',
      description: 'Comprehensive guide for creating both light and dark theme logos for your Hellō application, including scaling, file requirements, and implementation tips',
      mimeType: 'text/markdown'
    },
    {
      uri: 'hello://supported-logo-formats',
      name: 'Supported Logo Formats',
      description: 'List of supported image formats and mimetypes for logo uploads',
      mimeType: 'application/json'
    },
    {
      uri: 'hello://login-button-guidance',
      name: 'Hellō Login Button Implementation Guide',
      description: 'Complete guide for implementing Hellō login buttons including code examples, customization options, provider hints, and best practices',
      mimeType: 'text/markdown'
    }
  ];
}

/**
 * Handle resource reading
 * @param {string} uri - Resource URI to read
 * @returns {Promise<Object>} - Resource content
 */
export async function handleResourceRead(uri, adminApiClient) {
  // Handle internal resources
  switch (uri) {
    case 'hello://logo-guidance': {
      const logoGuidance = generateLogoGuidanceResource();
      return {
        contents: [{
          uri: uri,
          mimeType: 'text/markdown',
          text: logoGuidance
        }]
      };
    }
    
    case 'hello://supported-logo-formats': {
      const formatsData = generateSupportedLogoFormatsResource();
      return {
        contents: [{
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify(formatsData, null, 2)
        }]
      };
    }
    
    case 'hello://login-button-guidance': {
      const loginButtonGuidance = generateLoginButtonGuidanceResource();
      return {
        contents: [{
          uri: uri,
          mimeType: 'text/markdown',
          text: loginButtonGuidance
        }]
      };
    }
    

  }

  // Handle external markdown resources from hello.dev
  if (uri.startsWith('https://www.hello.dev/markdown/')) {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return {
        contents: [{
          uri: uri,
          mimeType: 'text/markdown',
          text: text
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch resource ${uri}: ${error.message}`);
    }
  }

  throw new Error(`Resource not found: ${uri}`);
} 