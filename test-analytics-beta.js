#!/usr/bin/env node

// Test script for MCP Analytics on Beta Server
// Tests sending events to Plausible with different channels and client types

const PLAUSIBLE_DOMAIN = 'mcp.hello.coop';
const PLAUSIBLE_API = 'https://plausible.io/api/event';

/**
 * Send test event to Plausible
 */
async function sendTestEvent(eventName, props = {}) {
    const eventData = {
        domain: PLAUSIBLE_DOMAIN,
        name: eventName,
        url: `https://${PLAUSIBLE_DOMAIN}/mcp/${eventName}`,
        props: {
            ...props,
            test: true,
            timestamp: new Date().toISOString()
        }
    };

    console.log(`🧪 Sending test event: ${eventName}`);
    console.log('📊 Event data:', JSON.stringify(eventData, null, 2));

    try {
        const response = await fetch(PLAUSIBLE_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'HelloMCP-Test/1.1.1'
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            console.log(`✅ Successfully sent ${eventName} event`);
        } else {
            console.log(`❌ Failed to send ${eventName} event:`, response.status, response.statusText);
        }
    } catch (error) {
        console.log(`❌ Error sending ${eventName} event:`, error.message);
    }
}

/**
 * Run analytics tests
 */
async function runAnalyticsTests() {
    console.log('🚀 Testing MCP Analytics for Beta Server');
    console.log('📍 Domain:', PLAUSIBLE_DOMAIN);
    console.log('🌐 API:', PLAUSIBLE_API);
    console.log('');

    // Test different client types and channels
    const testScenarios = [
        {
            eventName: 'tool_call',
            props: {
                tool_name: 'hello_get_profile',
                success: true,
                response_time_ms: 245,
                client_type: 'cursor',
                client_version: '0.42.3',
                channel: 'beta',
                transport: 'http',
                mcp_server_version: '1.1.1'
            }
        },
        {
            eventName: 'tool_call',
            props: {
                tool_name: 'hello_create_publisher',
                success: true,
                response_time_ms: 1200,
                client_type: 'vscode',
                client_version: '1.95.0',
                channel: 'docs',
                transport: 'http',
                mcp_server_version: '1.1.1'
            }
        },
        {
            eventName: 'resource_read',
            props: {
                resource_uri: 'legal://terms-template',
                mime_type: 'text/markdown',
                client_type: 'claude',
                channel: 'direct',
                transport: 'http',
                mcp_server_version: '1.1.1'
            }
        },
        {
            eventName: 'server_start',
            props: {
                transport: 'http',
                port: '3000',
                host: 'mcp.hello-beta.net',
                channel: 'beta',
                mcp_server_version: '1.1.1'
            }
        }
    ];

    for (const scenario of testScenarios) {
        await sendTestEvent(scenario.eventName, scenario.props);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('🎯 Test completed! Check Plausible dashboard:');
    console.log(`📈 https://plausible.io/${PLAUSIBLE_DOMAIN}`);
    console.log('');
    console.log('📊 Expected custom properties to see:');
    console.log('- client_type (cursor, vscode, claude)');
    console.log('- channel (beta, docs, direct)');
    console.log('- transport (http, stdio)');
    console.log('- tool_name, response_time_ms, success');
    console.log('- mcp_server_version, client_version');
}

// Run the tests
runAnalyticsTests().catch(console.error); 