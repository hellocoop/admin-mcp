// MCP Server for @hellocoop/mcp (refactored with modular architecture)
// Uses MCPRouter and feature modules for clean separation of concerns

import { MCPRouter } from './mcp_router.js';

/**
 * HelloMCPServer - Main MCP server class
 * Now uses modular architecture with MCPRouter
 */
export class HelloMCPServer {
  constructor(transport = 'unknown') {
    // Use the new modular router with transport type
    this.router = new MCPRouter(transport);
  }

  /**
   * Handle MCP requests (delegates to router)
   * @param {Object} request - MCP request
   * @returns {Promise<Object>} - MCP response
   */
  async handleRequest(request) {
    return await this.router.handleRequest(request);
  }

  /**
   * Get the underlying MCP server instance
   * @returns {Server} - MCP server instance
   */
  getMCPServer() {
    return this.router.getMCPServer();
  }

  /**
   * Set access token (for compatibility with existing code)
   * @param {string} token - Access token
   */
  setAccessToken(token) {
    this.router.setAccessToken(token);
  }

  /**
   * Set JWT payload (for compatibility with existing code)
   * @param {Object} payload - JWT payload
   */
  setJWTPayload(payload) {
    this.router.setJWTPayload(payload);
  }

  /**
   * Set authentication callback (for compatibility with existing code)
   * @param {Function} callback - Authentication callback
   */
  setAuthenticationCallback(callback) {
    this.router.setAuthenticationCallback(callback);
  }

  /**
   * Get authentication manager
   * @returns {AuthManager} - Authentication manager instance
   */
  getAuthManager() {
    return this.router.getAuthManager();
  }

  /**
   * Get API client
   * @returns {AdminAPIClient} - Admin API client instance
   */
  getAPIClient() {
    return this.router.getAPIClient();
  }

  // Legacy compatibility methods for existing code
  
  /**
   * @deprecated Use router.getAuthManager().getAccessToken() instead
   */
  get accessToken() {
    return this.router.getAuthManager().getAccessToken();
  }

  /**
   * @deprecated Use router.getAuthManager().setAccessToken() instead
   */
  set accessToken(token) {
    this.router.getAuthManager().setAccessToken(token);
  }

  /**
   * @deprecated Use router.getAuthManager().getJWTPayload() instead
   */
  get jwtPayload() {
    return this.router.getAuthManager().getJWTPayload();
  }

  /**
   * @deprecated Use router.getAuthManager().getAdminUser() instead
   */
  get adminUser() {
    return this.router.getAuthManager().getAdminUser();
  }

  /**
   * @deprecated Use router.getAuthManager().getAuthenticationCallback() instead
   */
  get authenticationCallback() {
    return this.router.getAuthManager().getAuthenticationCallback();
  }

  /**
   * @deprecated Use router.getMCPServer() instead
   */
  get mcpServer() {
    return this.router.getMCPServer();
  }
} 