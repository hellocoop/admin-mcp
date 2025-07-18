// JWT validation module for MCP server
// Validates JWT tokens without signature verification
// Checks scope, issuer, audience, and expiration

import jwt from 'jsonwebtoken'
import { HELLO_DOMAIN, HELLO_ISSUER, HELLO_AUDIENCE } from './config.js';

const DOMAIN = HELLO_DOMAIN;

// Expected values for JWT validation
const EXPECTED_ISSUER = HELLO_ISSUER;
const EXPECTED_AUDIENCE = HELLO_AUDIENCE;
const REQUIRED_SCOPE = 'mcp'

/**
 * Validates a JWT token without signature verification
 * @param {string} token - The JWT token to validate
 * @returns {Object} - Validation result with success/error details
 */
export const validateJWT = (token) => {
  try {
    // Decode token without verification
    const decoded = jwt.decode(token, { complete: true })
    
    if (!decoded || !decoded.payload) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token is malformed or cannot be decoded'
      }
    }

    const { header, payload } = decoded
    
    // Basic header validation
    if (!header || header.typ !== 'JWT') {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token type must be JWT'
      }
    }

    // Issuer validation
    if (!payload?.iss || payload.iss !== EXPECTED_ISSUER) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: `Invalid issuer. Expected: ${EXPECTED_ISSUER}, Got: ${payload.iss || 'none'}`
      }
    }

    // Audience validation
    if (!payload?.aud || payload.aud !== EXPECTED_AUDIENCE) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: `Invalid audience. Expected: ${EXPECTED_AUDIENCE}, Got: ${payload.aud || 'none'}`
      }
    }

    // Expiration validation
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token missing expiration time'
      }
    }

    if (payload.exp <= now) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token has expired'
      }
    }

    // Scope validation
    if (!payload.scope || !Array.isArray(payload.scope)) {
      return {
        valid: false,
        error: 'insufficient_scope',
        error_description: 'Token missing scope'
      }
    }

    if (!payload.scope.includes(REQUIRED_SCOPE)) {
      return {
        valid: false,
        error: 'insufficient_scope',
        error_description: `Token missing required scope: ${REQUIRED_SCOPE}`
      }
    }

    // Basic required claims validation
    if (!payload.sub) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token missing subject (sub) claim'
      }
    }

    if (!payload.jti) {
      return {
        valid: false,
        error: 'invalid_token',
        error_description: 'Token missing JWT ID (jti) claim'
      }
    }

    // All validations passed
    return {
      valid: true,
      payload: payload,
      tokenInfo: {
        jti: payload.jti,
        sub: payload.sub,
        aud: payload.aud,
        iss: payload.iss,
        scope: payload.scope,
        exp: payload.exp,
        iat: payload.iat
      }
    }

  } catch (error) {
    return {
      valid: false,
      error: 'invalid_token',
      error_description: `Token validation error: ${error.message}`
    }
  }
}

/**
 * Creates a properly formatted WWW-Authenticate header
 * @param {Object} validationResult - Result from validateJWT
 * @returns {string} - Formatted WWW-Authenticate header value
 */
export const createWWWAuthenticateHeader = (validationResult) => {
  const realm = 'Hello MCP Server'
  const resourceMetadata = `https://mcp.${DOMAIN}/.well-known/oauth-protected-resource`
  
  let headerParts = [
    `realm="${realm}"`,
    `error="${validationResult.error}"`,
    `error_description="${validationResult.error_description}"`,
    `scope=mcp`, // MCP servers must access for `mcp` scope, but access_token has `quickstart` scope
    `resource_metadata="${resourceMetadata}"`
  ]
  
  return `Bearer ${headerParts.join(', ')}`
}

/**
 * Creates a standardized authentication error response
 * @param {Object} validationResult - Result from validateJWT
 * @param {string} requestId - Request ID for JSON-RPC response
 * @returns {Object} - Standardized error response
 */
export const createAuthErrorResponse = (validationResult, requestId = null) => {
  const statusCode = validationResult.error === 'insufficient_scope' ? 403 : 401
  const wwwAuthenticate = createWWWAuthenticateHeader(validationResult)
  
  return {
    httpStatus: statusCode,
    wwwAuthenticate: wwwAuthenticate,
    jsonRpcResponse: {
      jsonrpc: '2.0',
      error: {
        code: validationResult.error === 'insufficient_scope' ? -32003 : -32001,
        message: validationResult.error === 'insufficient_scope' ? 'Insufficient scope' : 'Authentication required',
        data: {
          error: validationResult.error,
          error_description: validationResult.error_description
        }
      },
      id: requestId
    }
  }
}

/**
 * Fastify plugin to validate JWT tokens
 * @param {Object} fastify - Fastify instance
 */
export const jwtValidationPlugin = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip validation for non-MCP endpoints
    if (request.routerPath !== '/' && request.routerPath !== '/mcp' && 
        request.url !== '/' && request.url !== '/mcp') {
      return
    }

    // Skip validation for GET requests (documentation redirects)
    if (request.method === 'GET') {
      return
    }

    // Extract Bearer token
    const authHeader = request.headers.authorization
    if (!authHeader) {
      const wwwAuthenticate = createWWWAuthenticateHeader({
        error: 'invalid_request',
        error_description: 'Authorization header required'
      })
      
      reply.code(401)
      reply.header('WWW-Authenticate', wwwAuthenticate)
      return reply.send({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            error: 'invalid_request',
            error_description: 'Authorization header required'
          }
        },
        id: request.body?.id || null
      })
    }

    const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i)
    if (!bearerMatch) {
      const wwwAuthenticate = createWWWAuthenticateHeader({
        error: 'invalid_request',
        error_description: 'Bearer token required'
      })
      
      reply.code(401)
      reply.header('WWW-Authenticate', wwwAuthenticate)
      return reply.send({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            error: 'invalid_request',
            error_description: 'Bearer token required'
          }
        },
        id: request.body?.id || null
      })
    }

    const token = bearerMatch[1].trim()
    const validationResult = validateJWT(token)

    if (!validationResult.valid) {
      const errorResponse = createAuthErrorResponse(validationResult, request.body?.id)
      reply.code(errorResponse.httpStatus)
      reply.header('WWW-Authenticate', errorResponse.wwwAuthenticate)
      return reply.send(errorResponse.jsonRpcResponse)
    }

    // Add validated payload to request for logging and access
    request.jwtPayload = validationResult.payload
    request.tokenInfo = validationResult.tokenInfo
  })
}

/**
 * Legacy Express middleware for backward compatibility
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const jwtValidationMiddleware = (req, res, next) => {
  console.warn('jwtValidationMiddleware is deprecated, use jwtValidationPlugin for Fastify instead')
  
  // Skip validation for non-MCP endpoints
  if (req.path !== '/' && req.path !== '/mcp') {
    return next()
  }

  // Skip validation for GET requests (documentation redirects)
  if (req.method === 'GET') {
    return next()
  }

  // Extract Bearer token
  const authHeader = req.headers.authorization
  if (!authHeader) {
    const wwwAuthenticate = createWWWAuthenticateHeader({
      error: 'invalid_request',
      error_description: 'Authorization header required'
    })
    
    res.status(401)
    res.header('WWW-Authenticate', wwwAuthenticate)
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
        data: {
          error: 'invalid_request',
          error_description: 'Authorization header required'
        }
      },
      id: req.body?.id || null
    })
  }

  const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i)
  if (!bearerMatch) {
    const wwwAuthenticate = createWWWAuthenticateHeader({
      error: 'invalid_request',
      error_description: 'Bearer token required'
    })
    
    res.status(401)
    res.header('WWW-Authenticate', wwwAuthenticate)
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
        data: {
          error: 'invalid_request',
          error_description: 'Bearer token required'
        }
      },
      id: req.body?.id || null
    })
  }

  const token = bearerMatch[1].trim()
  const validationResult = validateJWT(token)

  if (!validationResult.valid) {
    const errorResponse = createAuthErrorResponse(validationResult, req.body?.id)
    res.status(errorResponse.httpStatus)
    res.header('WWW-Authenticate', errorResponse.wwwAuthenticate)
    return res.json(errorResponse.jsonRpcResponse)
  }

  // Add validated payload to request for logging and access
  req.jwtPayload = validationResult.payload
  req.tokenInfo = validationResult.tokenInfo
  
  next()
} 