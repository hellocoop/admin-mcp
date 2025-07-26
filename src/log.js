// MCP server structured logging module
import { AsyncLocalStorage } from 'async_hooks'
import jwt from 'jsonwebtoken'
import identifier from '@hellocoop/identifier'
import { LOG_LEVEL, IS_DEVELOPMENT } from './config.js'

const asyncLocalStorage = new AsyncLocalStorage()

// Extract token identifier from JWT (fallback for when payload not available)
export const extractTokenIdentifier = (token) => {
  try {
    const decoded = jwt.decode(token, { complete: true })
    return {
      jti: decoded.payload.jti || 'unknown',
      sub: decoded.payload.sub || 'unknown',
      aud: decoded.payload.aud || 'unknown',
      iss: decoded.payload.iss || 'unknown'
    }
  } catch (error) {
    return { jti: 'invalid', sub: 'invalid', aud: 'invalid', iss: 'invalid' }
  }
}

// Extract enhanced token info from JWT payload
export const extractTokenInfoFromPayload = (payload) => {
  if (!payload) {
    return { jti: 'none', sub: 'none', aud: 'none', iss: 'none', scope: 'none', exp: 'none' }
  }
  
  return {
    jti: payload.jti || 'unknown',
    sub: payload.sub || 'unknown',
    aud: payload.aud || 'unknown',
    iss: payload.iss || 'unknown',
    scope: Array.isArray(payload.scope) ? payload.scope.join(',') : (payload.scope || 'unknown'),
    exp: payload.exp || 'unknown',
    email: payload.email || 'unknown',
    name: payload.name || 'unknown'
  }
}

// Get client IP address
export const getClientIP = (request) => {
  return request.headers['x-forwarded-for'] || 
         request.headers['x-real-ip'] || 
         request.connection?.remoteAddress || 
         request.socket?.remoteAddress ||
         request.ip ||
         'unknown'
}

// Create structured logger with context
export const createLogger = (context, fastifyLogger) => {
  const logWithContext = (level, data, message) => {
    const logEntry = {
      rid: context.rid,
      clientIP: context.clientIP,
      tokenInfo: context.tokenInfo,
      ...data
    }
    
    // Use Fastify logger for proper structured logging
    if (fastifyLogger) {
      fastifyLogger[level](logEntry, message)
    } else {
      // Fallback to console.log if no logger available
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...logEntry
      }))
    }
  }
  
  return {
    info: (data, message) => logWithContext('info', data, message),
    warn: (data, message) => logWithContext('warn', data, message),
    error: (data, message) => logWithContext('error', data, message),
    debug: (data, message) => logWithContext('debug', data, message),
    trace: (data, message) => logWithContext('trace', data, message)
  }
}

// Get current log context
export const getLogContext = () => {
  return asyncLocalStorage.getStore() || {}
}

// Global app reference for logging (similar to Wallet)
let app = null

// Pre-handler hook for setting up logging context (similar to Wallet's sessionPreHandler)
export const loggingPreHandler = (request, reply, done) => {
  const rid = identifier.req()
  request.hrStartTime = process.hrtime()
  
  // Set response headers
  reply.header('Cache-Control', 'no-store')
  reply.header('Pragma', 'no-cache')
  reply.header('x-hello-request-id', rid)
  
  // Extract token info - prioritize validated payload over re-parsing
  let tokenInfo = null
  if (request.jwtPayload) {
    // Use validated JWT payload if available (preferred)
    tokenInfo = extractTokenInfoFromPayload(request.jwtPayload)
  } else if (request.headers.authorization) {
    // Fallback to parsing token from header
    const bearerMatch = request.headers.authorization.match(/^bearer\s+(.+)$/i)
    if (bearerMatch) {
      const token = bearerMatch[1].trim()
      tokenInfo = extractTokenIdentifier(token)
    }
  }
  
  const clientIP = getClientIP(request)
  
  const logContext = { 
    rid, 
    clientIP,
    tokenInfo: tokenInfo || { jti: 'none', sub: 'none', aud: 'none', iss: 'none', scope: 'none', exp: 'none' }
  }
  
  asyncLocalStorage.run(logContext, () => {
    // Create a request-specific logger using child logger pattern like Wallet
    request.log = app 
      ? app.log.child(logContext)
      : createLogger(logContext) // fallback for tests
    
    done()
  })
}

// Separate function for logging requests (similar to Wallet's logRequest)
export const logRequest = (request, reply, done) => {
  const path = request.routerPath || request.url?.split('?')[0] || 'unknown'

    // Skip health check logging unless in debug mode
  if (path === '/health' && LOG_LEVEL !== 'debug') {
    done()
    return
  }

  request.log.info({
    event: 'http_request',
    method: request.method,
    path: path,
    query: request.query,
    body: request.method === 'POST' ? request.body : undefined, // Only log body for POST requests
    userAgent: request.headers['user-agent'],
    contentType: request.headers['content-type'],
    hasAuth: !!request.headers.authorization,
    hasValidatedJWT: !!request.jwtPayload,
    allHeaders: {
      ...request.headers,
      authorization: request.headers.authorization ? '[REDACTED]' : undefined
    }
  }, `HTTP ${request.method} ${path}`)
  
  done()
}

// Separate function for logging responses (similar to Wallet's logResponse)
export const logResponse = (request, reply, payload, done) => {
  const path = request.routerPath || request.url?.split('?')[0] || 'unknown'
      // Skip health check logging unless in debug mode
  if (path === '/health' && LOG_LEVEL !== 'debug') {
    done()
    return
  }

  let duration_ms = 'unknown'
  if (request.hrStartTime) {
    const diff = process.hrtime(request.hrStartTime)
    duration_ms = Math.round(diff[0] * 1000 + diff[1] / 1e6)
  }
  
  const data = {
    event: 'http_response',
    statusCode: reply.statusCode,
    duration_ms,
    contentLength: reply.getHeader('content-length') || 0,
    allResponseHeaders: reply.getHeaders()
  }
  
  const message = `HTTP response ${reply.statusCode} (${duration_ms}ms)`
  
  if (reply.statusCode < 400) {
    request.log.info(data, message)
  } else if (reply.statusCode < 500) {
    request.log.warn(data, message)
  } else {
    request.log.error(data, message)
  }
  
  done(null, payload)
}

// Fastify plugin for structured logging
export const setupLogging = (fastify) => {
  // Set global app reference like Wallet
  app = fastify
  
  // Add hooks in the same order as Wallet
  fastify.addHook('preHandler', loggingPreHandler)  // Set up context first
  fastify.addHook('preHandler', logRequest)         // Then log the request
  fastify.addHook('preSerialization', logResponse)  // Log response before serialization
}

// Create a logger instance with current context (for use outside request handlers)
export const createContextLogger = () => {
  const context = getLogContext()
  if (!context.rid) {
    // No context available, create a basic logger
    return createLogger({
      rid: 'no-context',
      clientIP: 'unknown',
      tokenInfo: { jti: 'none', sub: 'none', aud: 'none', iss: 'none', scope: 'none', exp: 'none' }
    })
  }
  return app ? app.log.child(context) : createLogger(context)
}

// API logging helpers
export const apiLogInfo = ({ event, startTime, message, extra = {} }) => {
  const context = getLogContext()
  const duration_ms = startTime ? Math.round(performance.now() - startTime) : undefined
  
  if (context && context.logger) {
    // Use context logger if available
    context.logger.info({
      event,
      duration_ms,
      ...extra
    }, message)
  } else {
    // Fallback to console.log
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      event,
      duration_ms,
      ...extra
    }))
  }
}

export const apiLogError = ({ event, startTime, message, extra = {} }) => {
  const context = getLogContext()
  const duration_ms = startTime ? Math.round(performance.now() - startTime) : undefined
  
  if (context && context.logger) {
    // Use context logger if available
    context.logger.error({
      event,
      duration_ms,
      ...extra
    }, message)
  } else {
    // Fallback to console.log
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      event,
      duration_ms,
      ...extra
    }))
  }
} 

// Fastify logging configuration (similar to Wallet server)
export const logOptions = {
  disableRequestLogging: true, // Disable automatic request logging
  logger: {
    level: LOG_LEVEL,
    base: null, // Removes `pid` and `hostname`
    formatters: {
      level(label) {
        return { level: label }; // Converts numeric levels to readable text
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`, // ISO 8601 timestamp
    transport: IS_DEVELOPMENT ? {
      target: 'pino-pretty',
      options: {
        colorize: true, // Color logs in development
        translateTime: 'HH:MM:ss.l', // Just the time
        ignore: 'pid,hostname', // Remove from output
        levelFirst: true,
        singleLine: false,
      },
    } : undefined, // No transport in production, just structured JSON
  },
  trustProxy: true // For proper IP detection behind proxies
}; 