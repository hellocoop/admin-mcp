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
export async function handleResourceRead(uri) {
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
    
    default:
      throw new Error(`Resource not found: ${uri}`);
  }
} 