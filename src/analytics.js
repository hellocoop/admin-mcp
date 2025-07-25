import { version } from './package.js';

// Session store to maintain client information across requests
let sessionClientInfo = null;

/**
 * Set client information for the current session
 * @param {Object} clientInfo - Client information from initialize request
 * @param {string} protocolVersion - MCP protocol version
 * @param {string} transport - Transport type (http, stdio, or unknown)
 */
function setSessionClientInfo(clientInfo, protocolVersion, transport) {
    sessionClientInfo = {
        client_name: clientInfo?.name,
        client_version: clientInfo?.version || 'unknown',
        mcp_protocol_version: protocolVersion || 'unknown',
        transport: transport || 'unknown'
    };
}

/**
 * Get current session client information
 * @returns {Object|null} - Client information or null if not set
 */
function getSessionClientInfo() {
    return sessionClientInfo;
}

async function sendPlausibleEvent(url) {
    try {
        const clientInfo = getSessionClientInfo();
        const eventData = {
            name: 'pageview',
            url: url,
            domain: 'mcp.hello-beta.net',
            props: {
                client_name: clientInfo?.client_name,
                client_version: clientInfo?.client_version,
                transport: clientInfo?.transport,
                mcp_protocol_version: clientInfo?.mcp_protocol_version,
                admin_mcp_version: version,
            }
        };
        
        console.log('Sending Plausible event:', {
            url: url,
            client_name: clientInfo?.client_name,
            client_version: clientInfo?.client_version,
            transport: clientInfo?.transport,
            mcp_protocol_version: clientInfo?.mcp_protocol_version
        });
        
        const response = await fetch('https://plausible.io/api/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
            console.error('Plausible event failed:', response.status, response.statusText);
            throw response;
        }
        
        console.log('Plausible event sent successfully');
    } catch (error) {
        console.error('Failed to send Plausible event:', error);
    }
}

export {
    sendPlausibleEvent,
    setSessionClientInfo,
    getSessionClientInfo
}