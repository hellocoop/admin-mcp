#!/bin/bash

# Version Bump Script for Hello MCP Server
# Helps increment package version and optionally publish

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔢 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

show_help() {
    echo "Usage: $0 [VERSION_TYPE] [OPTIONS]"
    echo ""
    echo "Version Types:"
    echo "  patch          Increment patch version (1.0.0 -> 1.0.1)"
    echo "  minor          Increment minor version (1.0.0 -> 1.1.0)"
    echo "  major          Increment major version (1.0.0 -> 2.0.0)"
    echo "  [version]      Set specific version (e.g., 1.2.3)"
    echo ""
    echo "Options:"
    echo "  --publish      Publish to both npm and Docker Hub after version bump"
    echo "  --npm          Publish only to npm after version bump"
    echo "  --docker       Publish only to Docker Hub after version bump"
    echo "  --dry-run      Show what would happen without making changes"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 patch                    # Bump patch version"
    echo "  $0 minor --publish          # Bump minor version and publish to both"
    echo "  $0 1.2.3 --npm              # Set version to 1.2.3 and publish to npm"
    echo "  $0 patch --dry-run          # Show what patch bump would do"
    echo ""
}

# Parse arguments
VERSION_TYPE=""
PUBLISH_AFTER=false
PUBLISH_NPM=false
PUBLISH_DOCKER=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        patch|minor|major)
            VERSION_TYPE="$1"
            shift
            ;;
        --publish)
            PUBLISH_AFTER=true
            PUBLISH_NPM=true
            PUBLISH_DOCKER=true
            shift
            ;;
        --npm)
            PUBLISH_AFTER=true
            PUBLISH_NPM=true
            shift
            ;;
        --docker)
            PUBLISH_AFTER=true
            PUBLISH_DOCKER=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            # Check if it's a version number
            if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                VERSION_TYPE="$1"
                shift
            else
                print_error "Unknown option: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Validate arguments
if [[ -z "$VERSION_TYPE" ]]; then
    print_error "Must specify version type (patch, minor, major) or specific version"
    show_help
    exit 1
fi

# Validate we're in the correct directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the MCP project root."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: v${CURRENT_VERSION}"

# Calculate new version
if [[ "$VERSION_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION="$VERSION_TYPE"
    print_status "Setting version to: v${NEW_VERSION}"
else
    # Use npm version to calculate new version
    if [[ "$DRY_RUN" == true ]]; then
        # Calculate what the new version would be
        case "$VERSION_TYPE" in
            patch)
                NEW_VERSION=$(node -e "
                    const semver = require('semver');
                    const current = require('./package.json').version;
                    console.log(semver.inc(current, 'patch'));
                ")
                ;;
            minor)
                NEW_VERSION=$(node -e "
                    const semver = require('semver');
                    const current = require('./package.json').version;
                    console.log(semver.inc(current, 'minor'));
                ")
                ;;
            major)
                NEW_VERSION=$(node -e "
                    const semver = require('semver');
                    const current = require('./package.json').version;
                    console.log(semver.inc(current, 'major'));
                ")
                ;;
        esac
        print_status "Would bump ${VERSION_TYPE} version to: v${NEW_VERSION}"
    else
        print_status "Bumping ${VERSION_TYPE} version..."
        npm version "$VERSION_TYPE" --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        print_success "Version bumped to: v${NEW_VERSION}"
    fi
fi

# Check git status
if git status --porcelain | grep -q .; then
    print_warning "There are uncommitted changes in the repository"
fi

# Set specific version if provided
if [[ "$VERSION_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && [[ "$DRY_RUN" != true ]]; then
    print_status "Setting version to: v${NEW_VERSION}"
    npm version "$NEW_VERSION" --no-git-tag-version
    print_success "Version set to: v${NEW_VERSION}"
fi

# Commit version change
if [[ "$DRY_RUN" == true ]]; then
    print_status "DRY RUN: Would commit version change"
    if [[ "$PUBLISH_AFTER" == true ]]; then
        print_status "DRY RUN: Would then publish"
        PUBLISH_ARGS=""
        if [[ "$PUBLISH_NPM" == true && "$PUBLISH_DOCKER" == true ]]; then
            PUBLISH_ARGS="--all"
        elif [[ "$PUBLISH_NPM" == true ]]; then
            PUBLISH_ARGS="--npm"
        elif [[ "$PUBLISH_DOCKER" == true ]]; then
            PUBLISH_ARGS="--docker"
        fi
        print_status "DRY RUN: Would run: scripts/publish.sh ${PUBLISH_ARGS}"
    fi
    exit 0
fi

# Commit the version change
print_status "Committing version change..."
git add package.json package-lock.json 2>/dev/null || git add package.json
git commit -m "Bump version to v${NEW_VERSION}"

# Create git tag
print_status "Creating git tag v${NEW_VERSION}..."
git tag "v${NEW_VERSION}"

print_success "Version bump completed!"
print_status "Don't forget to push your changes and tags:"
echo "  git push origin main"
echo "  git push origin v${NEW_VERSION}"

# Publish if requested
if [[ "$PUBLISH_AFTER" == true ]]; then
    print_status "Publishing after version bump..."
    
    PUBLISH_ARGS=""
    if [[ "$PUBLISH_NPM" == true && "$PUBLISH_DOCKER" == true ]]; then
        PUBLISH_ARGS="--all"
    elif [[ "$PUBLISH_NPM" == true ]]; then
        PUBLISH_ARGS="--npm"
    elif [[ "$PUBLISH_DOCKER" == true ]]; then
        PUBLISH_ARGS="--docker"
    fi
    
    if ./scripts/publish.sh $PUBLISH_ARGS; then
        print_success "Publishing completed successfully!"
    else
        print_error "Publishing failed. You may need to publish manually."
        exit 1
    fi
fi 