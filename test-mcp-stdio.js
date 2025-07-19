#!/usr/bin/env node

import { spawn } from 'child_process';
import readline from 'readline';

class MCPClient {
    constructor() {
        this.requestId = 1;
        this.process = null;
        this.rl = null;
    }

    async start() {
        console.log('🚀 Starting MCP server: npx @hellocoop/mcp@latest');
        
        // Launch the MCP server
        this.process = spawn('npx', ['@hellocoop/mcp@latest'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                HELLO_DOMAIN: 'hello-beta.net',
                OAUTH_CALLBACK_PORT: '3001'
            }
        });

        // Set up readline for stdout
        this.rl = readline.createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity
        });

        // Handle stderr
        this.process.stderr.on('data', (data) => {
            console.log('📝 MCP Server stderr:', data.toString());
        });

        // Handle process exit
        this.process.on('exit', (code) => {
            console.log(`🏁 MCP Server exited with code ${code}`);
        });

        // Wait a moment for the server to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ MCP server started, beginning tests...\n');
    }

    async sendRequest(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            id: this.requestId++,
            method: method,
            params: params
        };

        console.log(`📤 Sending request: ${method}`);
        console.log('Request JSON:', JSON.stringify(request, null, 2));

        // Send the request
        this.process.stdin.write(JSON.stringify(request) + '\n');

        // Wait for response
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for response to ${method}`));
            }, 30000); // 30 second timeout

            const onLine = (line) => {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line);
                        if (response.id === request.id) {
                            clearTimeout(timeout);
                            this.rl.off('line', onLine);
                            resolve(response);
                        }
                    } catch (e) {
                        // Ignore non-JSON lines
                    }
                }
            };

            this.rl.on('line', onLine);
        });
    }

    async testToolsList() {
        console.log('🔧 Testing tools/list...');
        try {
            const response = await this.sendRequest('tools/list');
            console.log('📥 Response:');
            console.log(JSON.stringify(response, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
            return response;
        } catch (error) {
            console.error('❌ Error in tools/list:', error.message);
            return null;
        }
    }

    async testGetProfile() {
        console.log('👤 Testing hello_get_profile...');
        try {
            const response = await this.sendRequest('tools/call', {
                name: 'hello_get_profile',
                arguments: {}
            });
            console.log('📥 Response:');
            console.log(JSON.stringify(response, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
            return response;
        } catch (error) {
            console.error('❌ Error in hello_get_profile:', error.message);
            return null;
        }
    }

    async testInitialize() {
        console.log('🔄 Testing initialize...');
        try {
            const response = await this.sendRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: 'mcp-test-client',
                    version: '1.0.0'
                }
            });
            console.log('📥 Response:');
            console.log(JSON.stringify(response, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
            return response;
        } catch (error) {
            console.error('❌ Error in initialize:', error.message);
            return null;
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up...');
        if (this.rl) {
            this.rl.close();
        }
        if (this.process) {
            this.process.kill('SIGTERM');
        }
    }
}

async function main() {
    const client = new MCPClient();
    
    try {
        await client.start();
        
        // Test sequence
        await client.testInitialize();
        await client.testToolsList();
        await client.testGetProfile();
        
        console.log('✅ All tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await client.cleanup();
        process.exit(0);
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    process.exit(0);
});

main().catch(console.error); 