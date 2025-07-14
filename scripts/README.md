# MCP Publishing Scripts

This directory contains scripts for managing releases and publishing the Hellō MCP Server to npm and Docker Hub.

## Quick Start

```bash
# Bump patch version and publish to both npm and Docker Hub
npm run release:patch

# Or do it step by step
npm run version:patch    # Bump version
npm run publish          # Publish to both npm and Docker Hub
```

## Scripts Overview

### Publishing Scripts

#### `publish.sh`
Comprehensive publishing script that handles both npm and Docker Hub publishing with safety checks.

**Usage:**
```bash
scripts/publish.sh [OPTIONS]

# Or via npm scripts:
npm run publish              # Publish to both npm and Docker Hub
npm run publish:npm          # Publish only to npm
npm run publish:docker       # Publish only to Docker Hub
npm run publish:dry-run      # Show what would be published
npm run publish:check-npm    # Check npm credentials and permissions
```

**Options:**
- `--npm` - Publish to npm registry
- `--docker` - Publish to Docker Hub
- `--all` - Publish to both npm and Docker Hub
- `--check-npm` - Check npm credentials and permissions only
- `--dry-run` - Show what would be published without actually publishing
- `--force` - Force publish even if version already exists (dangerous)
- `--help` - Show help message

**Safety Features:**
- ✅ Checks if version already exists before publishing
- ✅ Validates authentication and permissions for both npm and Docker Hub
- ✅ Verifies npm organization access and package permissions
- ✅ Runs tests before npm publish
- ✅ Checks git status and branch
- ✅ Multi-architecture Docker builds (ARM64 + AMD64)
- ✅ Comprehensive error handling and colored output

#### `version-bump.sh`
Version management script that increments package version and optionally publishes.

**Usage:**
```bash
scripts/version-bump.sh [VERSION_TYPE] [OPTIONS]

# Or via npm scripts:
npm run version:patch        # Bump patch version (1.0.0 -> 1.0.1)
npm run version:minor        # Bump minor version (1.0.0 -> 1.1.0) 
npm run version:major        # Bump major version (1.0.0 -> 2.0.0)

npm run release:patch        # Bump patch version and publish
npm run release:minor        # Bump minor version and publish
npm run release:major        # Bump major version and publish
```

**Version Types:**
- `patch` - Increment patch version (1.0.0 -> 1.0.1)
- `minor` - Increment minor version (1.0.0 -> 1.1.0)
- `major` - Increment major version (1.0.0 -> 2.0.0)
- `1.2.3` - Set specific version

**Options:**
- `--publish` - Publish to both npm and Docker Hub after version bump
- `--npm` - Publish only to npm after version bump
- `--docker` - Publish only to Docker Hub after version bump
- `--dry-run` - Show what would happen without making changes
- `--help` - Show help message

**What it does:**
1. ✅ Bumps version in package.json
2. ✅ Updates package-lock.json
3. ✅ Commits version change to git
4. ✅ Creates git tag (v1.2.3)
5. ✅ Optionally publishes to npm/Docker Hub

### Legacy Scripts

#### `docker-publish.sh`
Original Docker-only publishing script. Use `publish.sh --docker` instead for better integration.

#### `docker-build-local.sh`
Builds Docker image locally for testing.

## Publishing Workflow

### For Regular Development

1. **Check credentials** before starting (recommended):
   ```bash
   npm run publish:check-npm
   ```
2. **Make your changes** and commit them
3. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```
4. **Bump version and publish** in one step:
   ```bash
   npm run release:patch    # For bug fixes
   npm run release:minor    # For new features
   npm run release:major    # For breaking changes
   ```
5. **Push changes** to GitHub:
   ```bash
   git push origin main
   git push origin v1.2.3   # Push the tag
   ```

### For Manual Control

1. **Check credentials** first:
   ```bash
   npm run publish:check-npm
   ```
2. **Bump version** without publishing:
   ```bash
   npm run version:patch
   ```
3. **Test the build** with dry run:
   ```bash
   npm run publish:dry-run
   ```
4. **Publish** when ready:
   ```bash
   npm run publish
   ```

### For Specific Targets

```bash
# Check npm credentials and permissions
npm run publish:check-npm

# Publish only to npm (faster for code-only changes)
npm run publish:npm

# Publish only to Docker Hub (for Docker-specific changes)
npm run publish:docker

# Test what would be published
npm run publish:dry-run
```

## Prerequisites

### For npm Publishing
1. **npm account** with access to `@hellocoop` organization
2. **Login to npm:**
   ```bash
   npm login
   ```
3. **Verify access:**
   ```bash
   npm whoami
   ```

### For Docker Hub Publishing
1. **Docker Hub account** with access to `hellocoop` organization
2. **Login to Docker Hub:**
   ```bash
   docker login
   ```
3. **Docker buildx** for multi-architecture builds:
   ```bash
   docker buildx version
   ```

## Version Strategy

We follow [Semantic Versioning (SemVer)](https://semver.org/):

- **PATCH** (1.0.0 -> 1.0.1): Bug fixes, security updates
- **MINOR** (1.0.0 -> 1.1.0): New features, backwards compatible
- **MAJOR** (1.0.0 -> 2.0.0): Breaking changes

## Troubleshooting

### "Version already exists" Error
```bash
# Check current version
npm view @hellocoop/mcp version

# Bump version first
npm run version:patch
```

### Docker Build Fails
```bash
# Check Docker is running
docker info

# Check buildx
docker buildx ls

# Test local build
npm run docker:build-local
```

### npm Authentication Issues
```bash
# Quick credential check (recommended first step)
npm run publish:check-npm

# Check login status
npm whoami

# Login if needed
npm login

# Check organization access
npm org ls hellocoop

# Check package-specific access
npm view @hellocoop/mcp
```

### Git Issues
```bash
# Check git status
git status

# Commit changes first
git add .
git commit -m "Your changes"

# Then try version bump again
npm run version:patch
```

## Examples

### Complete Release Process
```bash
# 1. Make changes and commit
git add .
git commit -m "Add new feature"

# 2. Bump version and publish
npm run release:minor

# 3. Push to GitHub
git push origin main
git push origin v1.1.0
```

### Testing Before Release
```bash
# 1. Test version bump
scripts/version-bump.sh patch --dry-run

# 2. Test publishing
npm run publish:dry-run

# 3. If everything looks good
npm run release:patch
```

### Emergency Hotfix
```bash
# 1. Fix the issue
git add .
git commit -m "Fix critical bug"

# 2. Patch release
npm run release:patch

# 3. Push immediately
git push origin main
git push origin v1.0.1
```

## Script Configuration

All scripts use these configurations:

- **npm package**: `@hellocoop/mcp`
- **Docker image**: `hellocoop/mcp`
- **Supported platforms**: linux/amd64, linux/arm64
- **Docker tags**: `latest`, `v{version}`

## Security Notes

- ✅ Scripts validate authentication before publishing
- ✅ Version existence is checked to prevent overwrites
- ✅ Git status is validated before version bumps
- ✅ Tests are run before npm publishing
- ⚠️ Use `--force` flag carefully - it can overwrite existing versions
- ⚠️ Ensure you're on the correct branch before publishing

## Getting Help

```bash
# Show help for any script
scripts/publish.sh --help
scripts/version-bump.sh --help

# Test scripts with dry run
npm run publish:dry-run
scripts/version-bump.sh patch --dry-run
``` 