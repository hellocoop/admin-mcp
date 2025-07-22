// Admin API client for MCP server
// Handles HTTP communication with Hello Admin API

import { HELLO_ADMIN } from './config.js';
import { apiLogInfo, apiLogError, getLogContext } from './log.js';
import { createMCPContent } from './utils.js';

export class AdminAPIClient {
  constructor(authManager) {
    this.authManager = authManager;
  }

  /**
   * Make a REST call to the Admin API using built-in fetch
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} path - API path
   * @param {Object} data - Request data for POST/PUT
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - API response data
   */
  async callAdminAPI(method, path, data, options = {}) {
    const { requiresAuth = true, isRetry = false } = options;
    const startTime = performance.now();
    
    // Trigger authentication if we need auth but don't have a token
    if (requiresAuth && !this.authManager.getAccessToken() && this.authManager.getAuthenticationCallback()) {
      try {
        const token = await this.authManager.getAuthenticationCallback()();
        this.authManager.setAccessToken(token);
      } catch (error) {
        apiLogError({
          event: 'admin_api_auth_failed',
          startTime,
          message: `Authentication failed: ${error.message}`,
          extra: { method, path, error: error.message }
        });
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }

    const url = HELLO_ADMIN + path;
    const headers = {
      ...(requiresAuth && this.authManager.getAccessToken() && { 
        Authorization: `Bearer ${this.authManager.getAccessToken()}` 
      })
    };
    
    // Only add Content-Type header if we have data to send
    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions = {
      method: method.toUpperCase(),
      headers
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    // Enhanced logging with JWT payload information
    const logExtra = {
      url,
      method: method.toUpperCase(),
      path,
      hasAuth: !!this.authManager.getAccessToken(),
      hasData: !!data
    };

    // Add user context if available
    const jwtPayload = this.authManager.getJWTPayload();
    if (jwtPayload) {
      logExtra.user = {
        sub: jwtPayload.sub,
        jti: jwtPayload.jti,
        scope: jwtPayload.scope
      };
    }

    apiLogInfo({
      event: 'admin_api_call',
      startTime,
      message: `Admin API ${method.toUpperCase()} ${path}`,
      extra: logExtra
    });

    // Debug level logging for request parameters
    const context = getLogContext();
    if (context && context.logger) {
      context.logger.debug({
        event: 'admin_api_call_debug',
        method: method.toUpperCase(),
        path,
        url,
        requestData: data,
        headers: Object.keys(headers),
        hasAuth: !!this.authManager.getAccessToken()
      }, `Admin API ${method.toUpperCase()} ${path} - Request Details`);
    }

    try {
      const response = await fetch(url, requestOptions);
      const responseData = await response.json();
      
      // Handle token expiration (401 Unauthorized)
      if (response.status === 401 && requiresAuth && !isRetry && this.authManager.getAuthenticationCallback()) {
        this.authManager.setAccessToken(null); // Clear expired token
        
        try {
          // Trigger new OAuth flow
          const newToken = await this.authManager.getAuthenticationCallback()();
          this.authManager.setAccessToken(newToken);
          
          // Retry the original request with new token
          return await this.callAdminAPI(method, path, data, { requiresAuth, isRetry: true });
        } catch (authError) {
          apiLogError({
            event: 'admin_api_reauth_failed',
            startTime,
            message: `Re-authentication failed: ${authError.message}`,
            extra: { method, path, error: authError.message }
          });
          throw new Error(`Re-authentication failed: ${authError.message}`);
        }
      }
      
      // Handle HTTP error responses
      if (!response.ok) {
        if (response.status === 401) {
          // Authentication errors - return special object for handling
          const wwwAuthHeader = response.headers.get('WWW-Authenticate');
          apiLogError({
            event: 'admin_api_auth_error',
            startTime,
            message: `Admin API authentication error: ${response.status}`,
            extra: { method, path, status: response.status, wwwAuthHeader }
          });
          return {
            _httpStatus: response.status,
            _httpHeaders: wwwAuthHeader ? { 'WWW-Authenticate': wwwAuthHeader } : {},
            error: responseData.error || 'invalid_token'
          };
        } else if (response.status === 404) {
          // Not found errors - throw as regular errors
          apiLogError({
            event: 'admin_api_not_found',
            startTime,
            message: `Admin API not found: ${response.status}`,
            extra: { method, path, status: response.status }
          });
          throw new Error(`Resource not found: ${path}`);
        } else {
          // Other HTTP errors
          apiLogError({
            event: 'admin_api_error',
            startTime,
            message: `Admin API error: ${response.status}`,
            extra: { method, path, status: response.status }
          });
          throw new Error(`API request failed with status ${response.status}: ${responseData.message || responseData.error || 'Unknown error'}`);
        }
      }
      
      // Log successful response
      apiLogInfo({
        event: 'admin_api_response',
        startTime,
        message: `Admin API response ${response.status}`,
        extra: { 
          method, 
          path, 
          status: response.status,
          duration_ms: performance.now() - startTime
        }
      });

      // Debug level logging for response data
      if (context && context.logger) {
        context.logger.debug({
          event: 'admin_api_response_debug',
          method: method.toUpperCase(),
          path,
          status: response.status,
          responseData: responseData,
          duration_ms: performance.now() - startTime
        }, `Admin API ${method.toUpperCase()} ${path} - Response Details`);
      }
      
      return responseData;
    } catch (error) {
      apiLogError({
        event: 'admin_api_error',
        startTime,
        message: `Admin API error: ${error.message}`,
        extra: { method, path, error: error.message }
      });
      throw error;
    }
  }

  /**
   * Wrapper for callAdminAPI that returns MCP-formatted contents
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} data - Request data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - MCP-formatted response
   */
  async callAdminAPIForMCP(method, path, data, options = {}) {
    const result = await this.callAdminAPI(method, path, data, options);
    
    // Check if the result contains HTTP status information (authentication errors)
    if (result && typeof result === 'object' && result._httpStatus) {
      // This is an authentication error from the Admin API
      const error = new Error('Authentication error');
      error.httpStatus = result._httpStatus;
      error.httpHeaders = result._httpHeaders || {};
      error.errorData = {
        error: result.error || 'authentication_failed',
        error_description: result.error_description || 'Authentication failed'
      };
      throw error;
    }
    
    return createMCPContent(result);
  }

  /**
   * Upload logo to Admin API
   * @param {string} publisherId - Publisher ID
   * @param {string} applicationId - Application ID
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} mimeType - Image MIME type
   * @returns {Promise<Object>} - Upload response with logo URL
   */
  async uploadLogo(publisherId, applicationId, base64Data, mimeType) {
    // Create FormData for file upload
    const formData = new FormData();
    
    // Convert base64 to blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    
    // Add file to form data
    formData.append('logo', blob, 'logo.png');
    
    const url = `${HELLO_ADMIN}/api/v1/publishers/${publisherId}/applications/${applicationId}/logo`;
    const headers = {
      Authorization: `Bearer ${this.authManager.getAccessToken()}`
      // Don't set Content-Type for FormData - let browser set it with boundary
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Logo upload failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  }
} 