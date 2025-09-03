#!/bin/bash

# Claude Desktop Configuration Script for Music Analyzer Pro
# This script creates or updates the Claude Desktop configuration

set -e  # Exit on error

echo "==========================================="
echo "Claude Desktop MCP Configuration"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Determine OS and config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/.config/claude"
    OS_NAME="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="$HOME/.config/claude"
    OS_NAME="Linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    CONFIG_DIR="$APPDATA/claude"
    OS_NAME="Windows"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

print_info "Detected OS: $OS_NAME"
print_info "Config location: $CONFIG_FILE"
echo ""

# Create config directory if it doesn't exist
if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    print_status "Created config directory: $CONFIG_DIR"
fi

# Get project path
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
print_info "Project directory: $PROJECT_DIR"

# Get user's music directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    MUSIC_DIR="$HOME/Music"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    MUSIC_DIR="$HOME/Music"
else
    MUSIC_DIR="$USERPROFILE/Music"
fi

# Ask for custom paths
echo ""
read -p "Enter path to your music library (default: $MUSIC_DIR): " CUSTOM_MUSIC_DIR
MUSIC_DIR=${CUSTOM_MUSIC_DIR:-$MUSIC_DIR}

echo ""
read -p "Enter your GitHub token (optional, press Enter to skip): " GITHUB_TOKEN

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    print_warning "Configuration file already exists!"
    read -p "Do you want to backup the existing configuration? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_FILE="$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CONFIG_FILE" "$BACKUP_FILE"
        print_status "Backup created: $BACKUP_FILE"
    fi
fi

# Create the configuration
echo ""
echo "Creating MCP configuration..."

cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "sqlite-music": {
      "command": "python3",
      "args": [
        "-m",
        "mcp_server_sqlite",
        "--db-path",
        "$PROJECT_DIR/music_library.db"
      ],
      "description": "Music library database operations",
      "persistent": true
    },
    "filesystem-project": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "$PROJECT_DIR"
      ],
      "description": "Music Analyzer Pro project files",
      "persistent": true
    },
    "filesystem-music": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "$MUSIC_DIR"
      ],
      "description": "Music library directory",
      "persistent": true
    },
EOF

# Add GitHub server if token provided
if [ ! -z "$GITHUB_TOKEN" ]; then
    cat >> "$CONFIG_FILE" << EOF
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      },
      "description": "GitHub repository management",
      "persistent": true
    },
EOF
fi

# Complete the configuration
cat >> "$CONFIG_FILE" << EOF
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "description": "User preferences and patterns",
      "persistent": true
    },
    "python-runner": {
      "command": "python3",
      "args": [
        "-m",
        "pydantic_ai.mcp"
      ],
      "description": "Python code execution for testing"
    },
    "fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch"
      ],
      "description": "Web content fetching for metadata enrichment"
    }
  }
}
EOF

print_status "Configuration created successfully!"

# Validate JSON
if command -v python3 &> /dev/null; then
    python3 -m json.tool "$CONFIG_FILE" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status "Configuration is valid JSON"
    else
        print_error "Configuration has JSON syntax errors"
        exit 1
    fi
fi

# Create environment file if GitHub token was provided
if [ ! -z "$GITHUB_TOKEN" ]; then
    ENV_FILE="$HOME/.music_analyzer_env"
    echo "GITHUB_TOKEN=$GITHUB_TOKEN" > "$ENV_FILE"
    echo "PROJECT_DIR=$PROJECT_DIR" >> "$ENV_FILE"
    echo "MUSIC_DIR=$MUSIC_DIR" >> "$ENV_FILE"
    print_status "Created environment file: $ENV_FILE"
    
    # Add to shell profile
    if [[ "$SHELL" == *"zsh"* ]]; then
        PROFILE_FILE="$HOME/.zshrc"
    else
        PROFILE_FILE="$HOME/.bashrc"
    fi
    
    if ! grep -q "music_analyzer_env" "$PROFILE_FILE" 2>/dev/null; then
        echo "" >> "$PROFILE_FILE"
        echo "# Music Analyzer Pro MCP Environment" >> "$PROFILE_FILE"
        echo "[ -f $ENV_FILE ] && source $ENV_FILE" >> "$PROFILE_FILE"
        print_status "Added environment to shell profile"
    fi
fi

echo ""
echo "==========================================="
echo "Configuration Summary"
echo "==========================================="
echo ""
echo "✅ Claude Desktop configuration created!"
echo ""
echo "Configuration details:"
echo "  - Project directory: $PROJECT_DIR"
echo "  - Music directory: $MUSIC_DIR"
echo "  - Database: $PROJECT_DIR/music_library.db"
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "  - GitHub integration: Enabled"
fi
echo ""
echo "MCP Servers configured:"
echo "  1. SQLite (music library database)"
echo "  2. Filesystem (project files)"
echo "  3. Filesystem (music directory)"
echo "  4. Memory (user preferences)"
echo "  5. Python Runner (code execution)"
echo "  6. Fetch (web content)"
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "  7. GitHub (repository management)"
fi
echo ""
print_warning "IMPORTANT: Restart Claude Desktop for changes to take effect!"
echo ""
echo "To verify the configuration works:"
echo "1. Restart Claude Desktop"
echo "2. Ask Claude to list your project files"
echo "3. Ask Claude to query your music database"
echo ""
print_info "For troubleshooting, check MCP_SETUP.md"
echo ""