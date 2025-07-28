# @hellocoop/admin-mcp (BETA)

Model Context Protocol (MCP) server for creating and managing [Hellō](https://hello.dev) applications.

> **🚧 BETA Status**: This MCP server is currently in beta. We're actively seeking feedback and welcome contributions! Please report issues, suggest improvements, or submit pull requests to help us improve the developer experience.

## Quick Install

📖 **[Full Documentation & Installation Guide](https://hello.dev/docs/mcp)**

### Quick Configuration

Copy one of these configurations into your MCP client settings:

**NPM Package (Latest):**
```json
{
  "hello-admin-stdio": {
    "command": "npx",
            "args": ["-y", "@hellocoop/admin-mcp@latest"],
    "type": "stdio"
  }
}
```

**HTTP Transport (Remote):**
```json
{
  "hello-admin-http": {
          "url": "https://admin-mcp.hello.coop/",
    "type": "http"
  }
}
```

📖 **[See Local Development Setup](#local-development)** for running from source 

## Usage

This MCP server provides a **single powerful tool** (`hello_manage_app`) that lets you create and manage your Hellō applications directly from your AI assistant. Unlike traditional APIs, **every operation automatically includes your complete developer context** - profile, teams, and applications - making it perfect for AI assistants.

**📖 For detailed usage instructions, examples, and troubleshooting, visit: [hello.dev/docs/mcp](https://hello.dev/docs/mcp)**

## Features

- **🏢 Context-Aware Operations**: Every tool call automatically includes your current developer profile, teams, and applications for seamless context
- **📱 Unified Application Management**: Single powerful tool for all app operations (create, read, update, secrets, logos)
- **🔐 Secure OAuth Integration**: Browser-based authentication with JWT token validation
- **🌐 Multi-Transport Support**: Works with both stdio (local) and HTTP (remote) MCP transports
- **📊 Built-in Analytics**: Usage tracking and performance monitoring for optimization
- **🎨 Logo Management**: Upload logos with automatic light/dark theme support
- **⚙️ Environment Flexibility**: Configurable domains and admin servers

## Available Tools

**🎯 Core Tool:**
- `hello_manage_app` - **The main tool for all application management**
  - **Actions**: `create`, `read`, `update`, `create_secret`, `update_logo_from_data`, `update_logo_from_url`
  - **Always includes**: Your current profile, teams, and applications in every response
  - **Auto-context**: Automatically uses your default team if none specified
  - **Smart defaults**: Generates app names from your profile if not provided

## Key Benefits

**🔄 Always In Context**: Unlike traditional APIs, every tool response includes your complete developer context:
- Your user profile (name, email, picture)
- All your teams/organizations with roles
- All your applications with team associations
- Current team and application state

This means you never lose context between operations - perfect for AI assistants that need to understand your complete development environment.

## Tool Actions & Response Structure

### `hello_manage_app` Actions:

**📝 `create`** - Create new applications
- Auto-generates team if none exists
- Creates smart default names from your profile
- Returns: `{ profile, application, action_result }`

**👁️ `read`** - Read application details  
- Without `client_id`: Returns your complete profile context
- With `client_id`: Returns profile + specific application
- Returns: `{ profile, application?, action_result }`

**✏️ `update`** - Update application settings
- Modify any application property
- Returns: `{ profile, application, action_result }`

**🔑 `create_secret`** - Generate client secrets
- Creates secure OAuth client secrets
- Returns: `{ profile, application, client_secret, action_result }`

**🎨 `update_logo_from_data`** - Upload logo from base64 data
- Supports light/dark themes
- Auto-updates application with logo URL
- Returns: `{ profile, application, update_result, action_result }`

**🔗 `update_logo_from_url`** - Upload logo from URL
- Fetches and uploads from provided URL
- Supports light/dark themes  
- Returns: `{ profile, application, update_result, action_result }`

**Every response includes your complete profile context**, making it perfect for AI assistants that need to maintain awareness of your development environment.

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

## Contributing & Development

**We want your feedback!** This MCP server is in beta and we're actively improving it based on real-world usage.

### How to Contribute

- **🐛 Report Issues**: [GitHub Issues](https://github.com/hellocoop/packages-js/issues) - Found a bug or have a feature request?
- **🔧 Submit Pull Requests**: [GitHub PRs](https://github.com/hellocoop/packages-js/pulls) - Help us improve the server
- **💬 Join the Discussion**: [Discord](https://discord.gg/hellocoop) - Share feedback and get help

### Local Development

For local development and testing:

```sh
# Clone the repository
git clone https://github.com/hellocoop/admin-mcp
cd admin-mcp

# Install dependencies
npm install
```

The configure your AI client to run the local version 

**Local Development (Node.js):**
```json
{
  "hello-admin-local": {
    "command": "node",
            "args": ["path/to/HelloCoop/admin-mcp/src/stdio.js"],
    "type": "stdio"
  }
}
```

### Testing

Run the comprehensive test suite:

```sh
# Run all automated tests
npm test

```
