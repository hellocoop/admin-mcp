// Authentication manager for MCP server
// Handles JWT tokens, access tokens, and authentication callbacks

import { HELLO_ACCESS_TOKEN } from './config.js';

export class AuthManager {
  constructor() {
    this.accessToken = HELLO_ACCESS_TOKEN;
    this.jwtPayload = null; // Store validated JWT payload
    this.adminUser = null;
    this.authenticationCallback = null;
  }

  /**
   * Set access token
   * @param {string} token - Access token
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Get current access token
   * @returns {string|null} - Current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Set validated JWT payload for request context
   * @param {Object} payload - JWT payload
   */
  setJWTPayload(payload) {
    this.jwtPayload = payload;
    if (payload) {
      // Extract admin user info from JWT payload
      this.adminUser = {
        id: payload.sub,
        email: payload.email || 'unknown',
        name: payload.name || 'unknown',
        picture: payload.picture || null,
        scope: payload.scope || []
      };
    } else {
      this.adminUser = null;
    }
  }

  /**
   * Get current JWT payload
   * @returns {Object|null} - Current JWT payload
   */
  getJWTPayload() {
    return this.jwtPayload;
  }

  /**
   * Get current admin user info
   * @returns {Object|null} - Current admin user
   */
  getAdminUser() {
    return this.adminUser;
  }

  /**
   * Set authentication callback for lazy authentication
   * @param {Function} callback - Authentication callback function
   */
  setAuthenticationCallback(callback) {
    this.authenticationCallback = callback;
  }

  /**
   * Get authentication callback
   * @returns {Function|null} - Authentication callback
   */
  getAuthenticationCallback() {
    return this.authenticationCallback;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - True if user has access token
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Check if user has specific scope
   * @param {string} requiredScope - Required scope to check
   * @returns {boolean} - True if user has the required scope
   */
  hasScope(requiredScope) {
    if (!this.jwtPayload || !this.jwtPayload.scope) {
      return false;
    }
    
    const scopes = Array.isArray(this.jwtPayload.scope) 
      ? this.jwtPayload.scope 
      : [this.jwtPayload.scope];
      
    return scopes.includes(requiredScope);
  }

  /**
   * Clear all authentication data
   */
  clearAuth() {
    this.accessToken = null;
    this.jwtPayload = null;
    this.adminUser = null;
  }

  /**
   * Get authentication context for logging
   * @returns {Object} - Authentication context
   */
  getAuthContext() {
    return {
      hasToken: !!this.accessToken,
      userId: this.adminUser?.id || null,
      userEmail: this.adminUser?.email || null,
      scopes: this.jwtPayload?.scope || []
    };
  }
} 