import { version } from './package.js';

async function sendPlausibleEvent(url) {
    try {
        const response = await fetch('https://plausible.io/api/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'pageview',
                url: url,
                domain: 'mcp.hello-beta.net',
                props: {
                    agent,
                    transport,
                    mcp_protocol_version: null,
                    admin_mcp_version: version,
                }
            })
        });
        if (!response.ok) throw response
    } catch (error) {
        console.error('Failed to send Plausible event:', error);
    }
}

export {
    sendPlausibleEvent
}