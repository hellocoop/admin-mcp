#!/bin/bash

# Comprehensive Publish Script for Hello MCP Server
# Publishes to both npm and Docker Hub with version checking and safety features

set -e  # Exit on any error

# Configuration
DOCKER_USERNAME="hellocoop"
IMAGE_NAME="mcp"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
NPM_PACKAGE_NAME="@hellocoop/mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}📦 $1${NC}"
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

print_npm() {
    echo -e "${PURPLE}📚 $1${NC}"
}

print_docker() {
    echo -e "${BLUE}🐳 $1${NC}"
}

# Parse command line arguments
PUBLISH_NPM=false
PUBLISH_DOCKER=false
DRY_RUN=false
FORCE=false
CHECK_NPM_ONLY=false

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --npm              Publish to npm registry"
    echo "  --docker           Publish to Docker Hub"
    echo "  --all              Publish to both npm and Docker Hub"
    echo "  --check-npm        Check npm credentials and permissions only"
    echo "  --dry-run          Show what would be published without actually publishing"
    echo "  --force            Force publish even if version already exists (dangerous)"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --npm                    # Publish only to npm"
    echo "  $0 --docker                 # Publish only to Docker Hub"
    echo "  $0 --all                    # Publish to both npm and Docker Hub"
    echo "  $0 --all --dry-run          # Show what would be published"
    echo "  $0 --check-npm              # Verify npm credentials without publishing"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --npm)
            PUBLISH_NPM=true
            shift
            ;;
        --docker)
            PUBLISH_DOCKER=true
            shift
            ;;
        --all)
            PUBLISH_NPM=true
            PUBLISH_DOCKER=true
            shift
            ;;
        --check-npm)
            CHECK_NPM_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate arguments
if [[ "$CHECK_NPM_ONLY" == false && "$PUBLISH_NPM" == false && "$PUBLISH_DOCKER" == false ]]; then
    print_error "Must specify at least one publishing target (--npm, --docker, --all, or --check-npm)"
    show_help
    exit 1
fi

# Function to check npm credentials and permissions
check_npm_credentials() {
    print_npm "Checking npm credentials..."
    
    # Check if logged in
    if ! npm whoami >/dev/null 2>&1; then
        print_error "Not logged into npm. Please run 'npm login' first."
        return 1
    fi
    
    NPM_USER=$(npm whoami)
    print_npm "Logged in as: ${NPM_USER}"
    
    # Check organization access
    print_npm "Verifying access to @hellocoop organization..."
    if ! npm access list packages @hellocoop >/dev/null 2>&1; then
        print_error "You don't have access to the @hellocoop organization."
        print_status "Please ensure:"
        echo "  1. You are a member of the @hellocoop organization on npm"
        echo "  2. You have publish permissions for @hellocoop packages"
        echo "  3. Try running: npm org ls hellocoop"
        return 1
    fi
    
    # Check specific package access
    print_npm "Verifying access to ${NPM_PACKAGE_NAME}..."
    if ! npm view "${NPM_PACKAGE_NAME}" >/dev/null 2>&1; then
        print_warning "Package ${NPM_PACKAGE_NAME} not found on npm (this might be the first publish)"
    else
        if ! npm view "${NPM_PACKAGE_NAME}" maintainers >/dev/null 2>&1; then
            print_error "Cannot access package information for ${NPM_PACKAGE_NAME}"
            print_status "This might indicate insufficient permissions."
            return 1
        fi
    fi
    
    print_success "npm credentials verified successfully!"
    return 0
}

# Function to check if npm version exists
check_npm_version() {
    print_npm "Checking if v${VERSION} exists on npm..."
    if npm view "${NPM_PACKAGE_NAME}@${VERSION}" version >/dev/null 2>&1; then
        return 0  # Version exists
    else
        return 1  # Version doesn't exist
    fi
}

# Function to check if Docker version exists
check_docker_version() {
    print_docker "Checking if v${VERSION} exists on Docker Hub..."
    if curl -s "https://registry.hub.docker.com/v2/repositories/${FULL_IMAGE_NAME}/tags/v${VERSION}/" | grep -q '"name"'; then
        return 0  # Version exists
    else
        return 1  # Version doesn't exist
    fi
}

# Handle check-npm-only mode
if [[ "$CHECK_NPM_ONLY" == true ]]; then
    print_status "Checking npm credentials only..."
    if check_npm_credentials; then
        print_success "npm credentials check passed!"
        exit 0
    else
        print_error "npm credentials check failed!"
        exit 1
    fi
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
print_status "Hello MCP Server v${VERSION}"

if [[ "$DRY_RUN" == true ]]; then
    print_warning "DRY RUN MODE - No actual publishing will occur"
fi

# Function to publish to npm
publish_npm() {
    print_npm "Publishing to npm registry..."
    
    # Check if already published
    if check_npm_version; then
        if [[ "$FORCE" == true ]]; then
            print_warning "Version v${VERSION} already exists on npm, but --force specified"
        else
            print_warning "Version v${VERSION} already exists on npm"
            print_status "Skipping npm publish. Bump version to publish a new release."
            return 0
        fi
    else
        print_success "Version v${VERSION} not found on npm. Proceeding with publish..."
    fi
    
    # Check npm credentials and permissions
    if ! check_npm_credentials; then
        return 1
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        print_npm "DRY RUN: Would run 'npm publish --access public'"
        return 0
    fi
    
    # Run tests before publishing
    print_npm "Running tests before publish..."
    npm test
    
    # Publish to npm
    print_npm "Publishing ${NPM_PACKAGE_NAME}@${VERSION} to npm..."
    npm publish --access public
    
    print_success "Successfully published to npm!"
    print_status "Package available at: https://www.npmjs.com/package/${NPM_PACKAGE_NAME}"
}

# Function to publish to Docker Hub
publish_docker() {
    print_docker "Publishing to Docker Hub..."
    
    # Check if already published
    if check_docker_version; then
        if [[ "$FORCE" == true ]]; then
            print_warning "Version v${VERSION} already exists on Docker Hub, but --force specified"
        else
            print_warning "Version v${VERSION} already exists on Docker Hub"
            print_status "Skipping Docker publish. Bump version to publish a new release."
            return 0
        fi
    else
        print_success "Version v${VERSION} not found on Docker Hub. Proceeding with publish..."
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        return 1
    fi
    
    # Test Docker Hub authentication
    if ! docker pull hello-world >/dev/null 2>&1; then
        print_warning "Unable to pull from Docker Hub. Please check your Docker login."
        print_status "To authenticate, run: docker login"
        return 1
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        print_docker "DRY RUN: Would build and push Docker image"
        print_docker "Tags that would be created:"
        echo "  - ${FULL_IMAGE_NAME}:latest"
        echo "  - ${FULL_IMAGE_NAME}:v${VERSION}"
        return 0
    fi
    
    # Create builder instance if it doesn't exist
    print_docker "Setting up Docker buildx..."
    docker buildx create --name multiarch-builder --use --bootstrap 2>/dev/null || docker buildx use multiarch-builder
    
    # Build and push multi-architecture image
    print_docker "Building and pushing multi-architecture image..."
    print_docker "Platforms: linux/amd64, linux/arm64"
    print_docker "Tags: latest, v${VERSION}"
    
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "${FULL_IMAGE_NAME}:latest" \
        --tag "${FULL_IMAGE_NAME}:v${VERSION}" \
        --push \
        .
    
    print_success "Successfully published to Docker Hub!"
    print_status "Available tags:"
    echo "  - ${FULL_IMAGE_NAME}:latest"
    echo "  - ${FULL_IMAGE_NAME}:v${VERSION}"
    
    print_docker "Image can be run with:"
    echo "  docker run -p 3000:3000 ${FULL_IMAGE_NAME}:latest"
}

# Main execution
print_status "Starting publish process..."

# Validate we're in the correct directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the MCP project root."
    exit 1
fi

# Validate package.json has correct name
ACTUAL_NAME=$(node -p "require('./package.json').name")
if [[ "$ACTUAL_NAME" != "$NPM_PACKAGE_NAME" ]]; then
    print_error "Package name mismatch. Expected '${NPM_PACKAGE_NAME}', got '${ACTUAL_NAME}'"
    exit 1
fi

# Check git status (warn if there are uncommitted changes)
if git status --porcelain | grep -q .; then
    print_warning "There are uncommitted changes in the repository"
    if [[ "$FORCE" != true ]]; then
        print_error "Please commit all changes before publishing, or use --force to override"
        exit 1
    fi
fi

# Check if we're on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    print_warning "Not on main/master branch (currently on: ${CURRENT_BRANCH})"
    if [[ "$FORCE" != true ]]; then
        print_error "Please switch to main/master branch before publishing, or use --force to override"
        exit 1
    fi
fi

# Execute publishing based on flags
PUBLISH_SUCCESS=true

if [[ "$PUBLISH_NPM" == true ]]; then
    if ! publish_npm; then
        PUBLISH_SUCCESS=false
    fi
fi

if [[ "$PUBLISH_DOCKER" == true ]]; then
    if ! publish_docker; then
        PUBLISH_SUCCESS=false
    fi
fi

# Final status
if [[ "$PUBLISH_SUCCESS" == true ]]; then
    print_success "All publishing operations completed successfully!"
    
    if [[ "$DRY_RUN" != true ]]; then
        print_status "Version v${VERSION} is now available:"
        if [[ "$PUBLISH_NPM" == true ]]; then
            echo "  📚 npm: https://www.npmjs.com/package/${NPM_PACKAGE_NAME}"
        fi
        if [[ "$PUBLISH_DOCKER" == true ]]; then
            echo "  🐳 Docker Hub: https://hub.docker.com/r/${FULL_IMAGE_NAME}"
        fi
    fi
else
    print_error "Some publishing operations failed. Please check the output above."
    exit 1
fi 