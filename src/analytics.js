// MCP Analytics - Track usage patterns with Plausible
// Provides insights into tool usage, client distribution, and error patterns

import { IS_DEVELOPMENT } from './config.js';
import { getLogContext } from './log.js';
import packageJson from './package.js';

const PLAUSIBLE_DOMAIN = 'mcp.hello.coop';
const PLAUSIBLE_API = 'https://plausible.io/api/event';

// Check if analytics should be ignored (for development/testing)
const ANALYTICS_IGNORE = process.env.PLAUSIBLE_IGNORE === 'true' || 
                        process.env.MCP_ANALYTICS_IGNORE === 'true';

/**
 * Extract safe client information from headers (no sensitive data)
 * @param {Object} headers - Request headers
 * @returns {Object} - Client information
 */
function extractClientInfo(headers = {}) {
    const userAgent = headers['user-agent'] || '';
    const mcpVersion = headers['mcp-protocol-version'] || 'unknown';
    
    // Detect client type from User-Agent (safe to track)
    let clientType = 'unknown';
    if (userAgent.includes('Cursor')) clientType = 'cursor';
    else if (userAgent.includes('VSCode') || userAgent.includes('Visual Studio Code')) clientType = 'vscode';
    else if (userAgent.includes('Claude')) clientType = 'claude';
    else if (userAgent.includes('node')) clientType = 'node';
    else if (userAgent.includes('test')) clientType = 'test';
    
    // Extract client version if available (safe to track)
    let clientVersion = 'unknown';
    const versionMatch = userAgent.match(/(?:Cursor|VSCode|Claude)[\s\/]([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
    if (versionMatch) {
        clientVersion = versionMatch[1];
    }
    
    return {
        client_type: clientType,
        client_version: clientVersion,
        mcp_version: mcpVersion,
        // Don't include full user-agent as it may contain sensitive info
        has_user_agent: !!userAgent
    };
}

/**
 * Send event to Plausible Analytics
 * @param {string} eventName - Name of the event
 * @param {Object} properties - Custom properties for the event
 * @param {Object} context - Request context (optional)
 */
export async function trackMCPEvent(eventName, properties = {}, context = null) {
    if (ANALYTICS_IGNORE) {
        if (IS_DEVELOPMENT) {
            console.log(`🔇 Ignoring MCP Event: ${eventName}`, properties);
        }
        return;
    }

    // Get request context if available
    const logContext = context || getLogContext();
    const requestId = logContext?.rid || 'unknown';
    
    // Extract safe client info from context if available
    const clientInfo = context?.headers ? extractClientInfo(context.headers) : {};
    
    // Build Plausible-compatible event data
    const eventData = {
        domain: PLAUSIBLE_DOMAIN,
        name: eventName,
        url: `https://${PLAUSIBLE_DOMAIN}/mcp/${eventName}`, // More specific URL for each event type
        props: {
            ...properties,
            ...clientInfo,
            mcp_server_version: packageJson.version,
            node_version: process.version,
            request_id: requestId
        }
    };

    // Prepare headers for Plausible (following their recommendations)
    const headers = {
        'Content-Type': 'application/json'
    };

    // Use original User-Agent if available (Plausible needs this for proper tracking)
    if (context?.headers?.['user-agent']) {
        headers['User-Agent'] = context.headers['user-agent'];
    } else {
        headers['User-Agent'] = `HelloMCP/${packageJson.version}`;
    }

    // Add X-Forwarded-For if we have client IP info
    if (logContext?.clientIP && logContext.clientIP !== 'unknown') {
        headers['X-Forwarded-For'] = logContext.clientIP;
    }

    try {
        const response = await fetch(PLAUSIBLE_API, {
            method: 'POST',
            headers,
            body: JSON.stringify(eventData)
        });

        if (IS_DEVELOPMENT && !response.ok) {
            console.warn(`⚠️ Analytics event failed: ${eventName} (${response.status})`);
        }
    } catch (error) {
        // Fail silently in production, log in development
        if (IS_DEVELOPMENT) {
            console.error(`❌ Failed to track MCP event ${eventName}:`, error.message);
        }
    }
}

/**
 * Track MCP tool call
 * @param {string} toolName - Name of the tool called
 * @param {boolean} success - Whether the call was successful
 * @param {number} responseTimeMs - Response time in milliseconds
 * @param {Object} context - Request context
 */
export async function trackToolCall(toolName, success, responseTimeMs, context) {
    await trackMCPEvent('mcp_tool_call', {
        tool_name: toolName,
        success: success,
        response_time_ms: responseTimeMs,
        transport: context?.transport || 'unknown'
    }, context);
}

/**
 * Track MCP resource read
 * @param {string} resourceUri - URI of the resource
 * @param {string} contentType - Type of content returned
 * @param {Object} context - Request context
 */
export async function trackResourceRead(resourceUri, contentType, context) {
    await trackMCPEvent('mcp_resource_read', {
        resource_uri: resourceUri,
        content_type: contentType,
        transport: context?.transport || 'unknown'
    }, context);
}

/**
 * Track authentication flow events
 * @param {string} flowType - Type of auth flow (oauth_start, oauth_complete, token_refresh)
 * @param {boolean} success - Whether the flow was successful
 * @param {number} durationMs - Duration in milliseconds
 * @param {Object} context - Request context
 */
export async function trackAuthFlow(flowType, success, durationMs, context) {
    await trackMCPEvent('mcp_auth_flow', {
        flow_type: flowType,
        success: success,
        duration_ms: durationMs
    }, context);
}

/**
 * Track MCP errors
 * @param {string} errorType - Type of error (auth_failed, api_error, tool_error)
 * @param {string} toolName - Name of the tool (if applicable)
 * @param {number|string} errorCode - Error code
 * @param {Object} context - Request context
 */
export async function trackError(errorType, toolName, errorCode, context) {
    await trackMCPEvent('mcp_error', {
        error_type: errorType,
        tool_name: toolName || 'unknown',
        error_code: errorCode,
        transport: context?.transport || 'unknown'
    }, context);
}

/**
 * Track MCP server startup
 * @param {Object} mcpServer - MCP server instance to get transport from
 * @param {Object} config - Server configuration (optional)
 */
export async function trackServerStart(mcpServer, config = {}) {
    await trackMCPEvent('mcp_server_start', {
        transport: mcpServer.router.getTransportType(),
        environment: IS_DEVELOPMENT ? 'development' : 'production',
        mcp_server_version: packageJson.version,
        config_domain: config.HELLO_DOMAIN || 'hello.coop',
        ...config
    });
}

/**
 * Track MCP protocol handshake
 * @param {string} protocolVersion - MCP protocol version
 * @param {Object} capabilities - Client capabilities
 * @param {Object} context - Request context
 */
export async function trackProtocolHandshake(protocolVersion, capabilities, context) {
    await trackMCPEvent('mcp_handshake', {
        protocol_version: protocolVersion,
        client_capabilities: Object.keys(capabilities || {}).join(','),
        transport: context?.transport || 'unknown'
    }, context);
} 