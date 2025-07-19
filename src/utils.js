// Utility functions for MCP server
// Contains validation helpers, image processing, and common utilities

// Supported mimetypes - must match Admin API fileExtensions
export const SUPPORTED_MIMETYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/apng',
  'image/svg+xml'
];

/**
 * Validate mimetype for logo uploads
 * @param {string} mimeType - The MIME type to validate
 * @returns {Object} - Validation result with valid boolean and error message
 */
export function validateMimeType(mimeType) {
  if (!mimeType) {
    return { valid: false, error: 'Missing mimetype' };
  }
  
  if (!SUPPORTED_MIMETYPES.includes(mimeType)) {
    return { 
      valid: false, 
      error: `Unsupported mimetype: ${mimeType}. Supported types: ${SUPPORTED_MIMETYPES.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Detect mimetype from base64 data or filename
 * @param {string} base64Data - Base64 encoded data (may include data URL prefix)
 * @param {string} filename - Optional filename to detect from extension
 * @returns {string|null} - Detected MIME type or null if not detected
 */
export function detectMimeType(base64Data, filename) {
  // Try to detect from data URL prefix first
  const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,/);
  if (dataUrlMatch) {
    return dataUrlMatch[1];
  }
  
  // Fall back to filename extension
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'apng': 'image/apng',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || null;
  }
  
  return null;
}

/**
 * Extract base64 data from data URL
 * @param {string} dataUrl - Data URL (data:image/png;base64,...)
 * @returns {string} - Pure base64 data without prefix
 */
export function extractBase64FromDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

/**
 * Create a data URL from base64 data and MIME type
 * @param {string} base64Data - Base64 encoded data
 * @param {string} mimeType - MIME type
 * @returns {string} - Complete data URL
 */
export function createDataUrl(base64Data, mimeType) {
  const cleanBase64 = extractBase64FromDataUrl(base64Data);
  return `data:${mimeType};base64,${cleanBase64}`;
}

/**
 * Validate required fields in an object
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object} - Validation result with valid boolean and missing fields
 */
export function validateRequiredFields(obj, requiredFields) {
  const missing = requiredFields.filter(field => 
    obj[field] === undefined || obj[field] === null || obj[field] === ''
  );
  
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed object or default value
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Format error response for MCP
 * @param {string} message - Error message
 * @param {number} code - Error code (default: -32603 Internal error)
 * @param {*} data - Optional error data
 * @returns {Object} - Formatted MCP error response
 */
export function formatMCPError(message, code = -32603, data = null) {
  const error = {
    code,
    message
  };
  
  if (data !== null) {
    error.data = data;
  }
  
  return { error };
}

/**
 * Create MCP content response
 * @param {*} data - Data to include in response
 * @returns {Object} - Formatted MCP content response
 */
export function createMCPContent(data) {
  const jsonString = JSON.stringify(data, null, 2);
  return {
    contents: [{
      type: 'text',
      text: jsonString
    }],
    content: [{
      type: 'text', 
      text: jsonString
    }]
  };
} 