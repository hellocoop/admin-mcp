// mcp-api.js - MCP server routes and setup
// Factored out from server.js for better testability

const HelloMCP = require('./mcp-server')
const mcpOAuth = require('./mcp-oauth')
const verify = require('../issuer/verify')
const { DOMAIN } = require('../config')

// Create MCP server instance
const helloMCP = new HelloMCP()

// MCP routes plugin
async function mcpApi(fastify, options) {
    // OAuth endpoints
    fastify
        .get('/.well-known/oauth-authorization-server', mcpOAuth.wellKnownOAuthServer)
        .get('/.well-known/oauth-protected-resource', mcpOAuth.wellKnownProtectedResource)

    // MCP protocol endpoint - handle JSON-RPC directly
    fastify.post('/mcp', async (request, reply) => {
        try {
            // Validate JSON-RPC request
            const { jsonrpc, id, method, params } = request.body
            
            if (jsonrpc !== '2.0') {
                return reply.code(400).send({
                    jsonrpc: '2.0',
                    id: id || null,
                    error: {
                        code: -32600,
                        message: 'Invalid Request - jsonrpc must be "2.0"'
                    }
                })
            }

            // Extract Authorization header and set authentication on MCP server instance
            // This allows the MCP server's internal auth checks to work with HTTP requests
            const authHeader = request.headers.authorization
            if (authHeader) {
                // RFC 6750 compliant parsing: case insensitive "Bearer" with flexible whitespace
                const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i)
                if (bearerMatch) {
                    const token = bearerMatch[1].trim()
                    
                    try {
                        // Verify token using existing verification logic
                        const payload = await verify(token, 'https://admin.' + DOMAIN)
                        
                        if (!(payload instanceof Error) && payload && payload.active) {
                            // Set authentication on the MCP server instance
                            helloMCP.accessToken = token
                            helloMCP.adminUser = {
                                name: payload.name,
                                email: payload.email,
                                picture: payload.picture,
                                id: payload.sub
                            }
                            console.error('MCP HTTP authenticated:', helloMCP.adminUser.email)
                        } else {
                            // Clear any existing authentication if token is invalid
                            helloMCP.accessToken = null
                            helloMCP.adminUser = null
                        }
                    } catch (error) {
                        console.error('MCP HTTP auth failed:', error.message)
                        // Clear authentication on error
                        helloMCP.accessToken = null
                        helloMCP.adminUser = null
                    }
                } else {
                    // Not a Bearer token, clear any existing authentication
                    helloMCP.accessToken = null
                    helloMCP.adminUser = null
                }
            } else {
                // No auth header, clear any existing authentication
                helloMCP.accessToken = null
                helloMCP.adminUser = null
            }

            // Handle the request through the MCP server
            const mcpRequest = {
                jsonrpc: '2.0',
                id,
                method,
                params: params || {}
            }

            let response

            try {
                // Handle different MCP methods directly
                switch (method) {
                    case 'initialize':
                        response = {
                            jsonrpc: '2.0',
                            id,
                            result: {
                                protocolVersion: '2024-11-05',
                                capabilities: {
                                    tools: {},
                                    resources: {},
                                    logging: {}
                                },
                                serverInfo: {
                                    name: 'hello-admin-mcp',
                                    version: '1.0.0'
                                }
                            }
                        }
                        break

                    case 'initialized':
                        response = {
                            jsonrpc: '2.0',
                            id,
                            result: {}
                        }
                        break

                    case 'tools/list':
                        // Get tools from the MCP server using the string key
                        console.log('Available handlers:', Array.from(helloMCP.mcpServer._requestHandlers.keys()))
                        const toolsHandler = helloMCP.mcpServer._requestHandlers.get('tools/list')
                        console.log('Found tools handler:', !!toolsHandler)
                        
                        if (toolsHandler) {
                            const toolsResult = await toolsHandler({
                                jsonrpc: '2.0',
                                id,
                                method: 'tools/list',
                                params: params || {}
                            })
                            console.log('Tools result:', toolsResult)
                            
                            response = {
                                jsonrpc: '2.0',
                                id,
                                result: toolsResult
                            }
                        } else {
                            console.log('No tools handler found, returning empty array')
                            response = {
                                jsonrpc: '2.0',
                                id,
                                result: { tools: [] }
                            }
                        }
                        break

                    case 'resources/list':
                        // Get resources from the MCP server (no authentication required)
                        const resourcesHandler = helloMCP.mcpServer._requestHandlers.get('resources/list')
                        
                        if (resourcesHandler) {
                            const resourcesResult = await resourcesHandler({
                                jsonrpc: '2.0',
                                id,
                                method: 'resources/list',
                                params: params || {}
                            })
                            
                            response = {
                                jsonrpc: '2.0',
                                id,
                                result: resourcesResult
                            }
                        } else {
                            response = {
                                jsonrpc: '2.0',
                                id,
                                result: { resources: [] }
                            }
                        }
                        break

                    case 'ping':
                        // Simple ping/pong for connectivity testing (no authentication required)
                        response = {
                            jsonrpc: '2.0',
                            id,
                            result: { 
                                pong: true,
                                timestamp: new Date().toISOString(),
                                server: 'hello-admin-mcp',
                                version: '1.0.0'
                            }
                        }
                        break

                    case 'tools/call':
                        // Check authentication for tool calls (RFC 6750 compliance)
                        if (!helloMCP.accessToken || !helloMCP.adminUser) {
                            // Return 401 Unauthorized with proper WWW-Authenticate header
                            reply.code(401)
                            reply.header('WWW-Authenticate', `Bearer realm="Hello MCP Server", error="invalid_token", error_description="Valid bearer token required", scope="mcp", resource_metadata="https://mcp.${DOMAIN}/.well-known/oauth-protected-resource"`)
                            return reply.send({
                                jsonrpc: '2.0',
                                id,
                                error: {
                                    code: -32000, // Server error (authentication failure)
                                    message: 'Authentication required',
                                    data: 'Valid bearer token required for tool calls'
                                }
                            })
                        }
                        
                        // Handle tool calls using string key
                        const callHandler = helloMCP.mcpServer._requestHandlers.get('tools/call')
                        if (callHandler) {
                            const callResult = await callHandler({
                                jsonrpc: '2.0',
                                id,
                                method: 'tools/call',
                                params: params || {}
                            })
                            
                            response = {
                                jsonrpc: '2.0',
                                id,
                                result: callResult
                            }
                        } else {
                            response = {
                                jsonrpc: '2.0',
                                id,
                                error: {
                                    code: -32601,
                                    message: 'Method not found',
                                    data: 'Tool call handler not registered'
                                }
                            }
                        }
                        break

                    case 'logging/setLevel':
                        // Handle logging level changes
                        const levelResult = await helloMCP.mcpServer._requestHandlers.get('logging/setLevel')?.({
                            jsonrpc: '2.0',
                            id,
                            method: 'logging/setLevel',
                            params: params || {}
                        })
                        
                        response = {
                            jsonrpc: '2.0',
                            id,
                            result: levelResult?.result || {}
                        }
                        break

                    default:
                        response = {
                            jsonrpc: '2.0',
                            id,
                            error: {
                                code: -32601,
                                message: 'Method not found',
                                data: `Unknown method: ${method}`
                            }
                        }
                }

            } catch (error) {
                console.error('MCP Server Error:', error)
                response = {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error.message
                    }
                }
            }

            // Send the response
            return reply.send(response)

        } catch (error) {
            console.error('MCP Endpoint Error:', error)
            return reply.code(500).send({
                jsonrpc: '2.0',
                id: request.body?.id || null,
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: error.message
                }
            })
        }
    })
}

module.exports = mcpApi 