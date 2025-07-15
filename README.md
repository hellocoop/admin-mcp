# @hellocoop/mcp

Model Context Protocol (MCP) server for creating and managing [Hellō](https://hello.dev) applications.

## Quick Install

📖 **[Full Documentation & Installation Guide](https://hello.dev/docs/mcp)**

### Quick Configuration

Copy one of these configurations into your MCP client settings:

**Stdio Transport (Local):**
```json
{
  "hello-admin-stdio": {
    "command": "npx",
    "args": ["@hellocoop/mcp"]
  }
}
```

**streamableHTTP Transport (Remote):**
```json
{
  "hello-admin-http": {
    "url": "https://mcp.hello.coop/",
    "type": "http"
  }
}
```

## Usage

This MCP server lets you create and manage your Hellō applications directly from your AI assistant instead of using the [Hellō Console](https://console.hello.coop).

**📖 For detailed usage instructions, examples, and troubleshooting, visit: [hello.dev/docs/mcp](https://hello.dev/docs/mcp)**

## Features

- **Application Management**: Create, read, and update Hellō applications
- **Publisher Management**: Create and manage publishers (teams/organizations)
- **OAuth Integration**: Secure authentication via browser-based OAuth flow
- **Legal Document Generation**: Create Terms of Service and Privacy Policy templates
- **Logo Management**: Upload and manage application logos
- **Multiple Transports**: Both stdio and HTTP MCP transports supported
- **Environment Flexibility**: Configurable domains and admin servers

## Available Tools

- `hello_get_profile` - Get your developer profile and publishers
- `hello_create_publisher` - Create a new publisher (team/organization)
- `hello_read_publisher` - Read detailed publisher information
- `hello_create_application` - Create a new Hellō application
- `hello_read_application` - Read detailed application information
- `hello_update_application` - Update application settings
- `hello_upload_logo` - Upload application logos
- `hello_create_secret` - Create client secrets for applications
- `hello_generate_login_button` - Generate HTML/JavaScript login buttons
- `hello_generate_legal_docs` - Generate Terms of Service and Privacy Policy templates

## Available Resources

- **Hellō Documentation** - Complete integration documentation
- **Hellō Quickstarts** - Framework-specific setup guides
- **Hellō Buttons** - Login button implementation guide
- **Hellō Scopes** - Available scopes and claims reference
- **Hellō Wallet API** - Wallet API reference documentation
- **Hellō Logo Design Guidance** - Comprehensive guide for creating theme-appropriate logos

## Environment Variables

- `HELLO_DOMAIN`: Override the default domain (defaults to `hello.coop`)
- `HELLO_ADMIN`: Override the admin server URL (defaults to `https://admin.hello.coop`)

## Development

### Local Development

For local development and testing:

```sh
# Clone the repository
git clone https://github.com/hellocoop/packages-js
cd packages-js/mcp

# Install dependencies
npm install

# Run in stdio mode
npm start

# Run HTTP server mode
npm run start:http
```

### Getting Access Tokens for Testing

The `get-token` script performs OAuth flow and outputs token data as JSON:

```sh
# Get complete token response
npm run get-token

# Extract just the access token
npm run get-token | jq -r '.access_token'

# Use in shell commands
TOKEN=$(npm run get-token 2>/dev/null | jq -r '.access_token')
curl -H "Authorization: Bearer $TOKEN" https://admin.hello.coop/api/v1/profile

# Save to file for reuse
npm run get-token > token.json
```

### Testing

Run the comprehensive test suite:

```sh
# Run all automated tests
npm test

# Run interactive OAuth test
npm run test:oauth-interactive
```

### Docker Development

Build and test locally:

```sh
# Build local Docker image
npm run docker:build-local

# Run locally built image
docker run -p 3000:3000 hellocoop/mcp:local
```

### Publishing

For maintainers publishing to Docker Hub:

```sh
npm run docker:publish
```
