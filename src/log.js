// MCP server structured logging module
import { AsyncLocalStorage } from 'async_hooks'
import jwt from 'jsonwebtoken'
import identifier from '@hellocoop/identifier'

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

// Fastify plugin for structured logging
export const setupLogging = async (fastify) => {
  // Pre-handler hook for request logging
  fastify.addHook('onRequest', async (request, reply) => {
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
      tokenInfo: tokenInfo || { jti: 'none', sub: 'none', aud: 'none', iss: 'none', scope: 'none', exp: 'none' },
      logger: createLogger({ rid, clientIP, tokenInfo: tokenInfo || { jti: 'none', sub: 'none', aud: 'none', iss: 'none', scope: 'none', exp: 'none' } }, fastify.log)
    }
    
    // Run the request in the logging context
    await new Promise((resolve) => {
      asyncLocalStorage.run(logContext, () => {
        request.log = createLogger(logContext, fastify.log)
        
        // Log request with enhanced token information
        const path = request.routerPath || request.url?.split('?')[0] || 'unknown'
        request.log.info({
          event: 'http_request',
          method: request.method,
          path: path,
          query: request.query,
          body: request.method === 'POST' ? request.body : undefined, // Only log body for POST requests
          userAgent: request.headers['user-agent'],
          contentType: request.headers['content-type'],
          hasAuth: !!request.headers.authorization,
          hasValidatedJWT: !!request.jwtPayload
        }, `HTTP ${request.method} ${path}`)
        
        resolve()
      })
    })
  })
  
  // Post-response hook for response logging
  fastify.addHook('onResponse', async (request, reply) => {
    const logContext = getLogContext()
    if (!logContext.rid) return // Skip if no context
    
    asyncLocalStorage.run(logContext, () => {
      let duration_ms = 'unknown'
      if (request.hrStartTime) {
        const diff = process.hrtime(request.hrStartTime)
        duration_ms = Math.round(diff[0] * 1000 + diff[1] / 1e6)
      }
      
      const data = {
        event: 'http_response',
        statusCode: reply.statusCode,
        duration_ms,
        contentLength: reply.getHeader('content-length') || 0
      }
      
      const message = `HTTP response ${reply.statusCode} (${duration_ms}ms)`
      
      if (reply.statusCode < 400) {
        request.log.info(data, message)
      } else if (reply.statusCode < 500) {
        request.log.warn(data, message)
      } else {
        request.log.error(data, message)
      }
    })
  })
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
  return createLogger(context)
}

// Export for backward compatibility
export const loggingMiddleware = (req, res, next) => {
  console.warn('loggingMiddleware is deprecated, use setupLogging Fastify plugin instead')
  next()
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