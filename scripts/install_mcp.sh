#!/bin/bash

# MCP Server Installation Script for Music Analyzer Pro
# This script installs all recommended MCP servers

set -e  # Exit on error

echo "==========================================="
echo "Music Analyzer Pro - MCP Server Setup"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check prerequisites
echo "Checking prerequisites..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_status "Python 3 found: $PYTHON_VERSION"
else
    print_error "Python 3 not found. Please install Python 3.8 or higher."
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 14 or higher."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found. Please install npm."
    exit 1
fi

echo ""
echo "Installing Python-based MCP servers..."
echo "--------------------------------------"

# Install SQLite MCP Server
echo "Installing SQLite MCP Server..."
pip install --upgrade mcp-server-sqlite
if [ $? -eq 0 ]; then
    print_status "SQLite MCP Server installed successfully"
else
    print_warning "SQLite MCP Server installation failed"
fi

# Install pydantic-ai for Python execution
echo "Installing pydantic-ai (Python execution server)..."
pip install --upgrade pydantic-ai
if [ $? -eq 0 ]; then
    print_status "pydantic-ai installed successfully"
else
    print_warning "pydantic-ai installation failed"
fi

echo ""
echo "Installing Node.js-based MCP servers..."
echo "---------------------------------------"

# Create directory for global npm packages if it doesn't exist
if [ ! -d "$HOME/.npm-global" ]; then
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"
    export PATH="$HOME/.npm-global/bin:$PATH"
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
    print_status "Configured npm global directory"
fi

# Install Filesystem MCP Server
echo "Installing Filesystem MCP Server..."
npm install -g @modelcontextprotocol/server-filesystem
if [ $? -eq 0 ]; then
    print_status "Filesystem MCP Server installed successfully"
else
    print_warning "Filesystem MCP Server installation failed"
fi

# Install GitHub MCP Server
echo "Installing GitHub MCP Server..."
npm install -g @modelcontextprotocol/server-github
if [ $? -eq 0 ]; then
    print_status "GitHub MCP Server installed successfully"
else
    print_warning "GitHub MCP Server installation failed"
fi

# Install Memory MCP Server
echo "Installing Memory MCP Server..."
npm install -g @modelcontextprotocol/server-memory
if [ $? -eq 0 ]; then
    print_status "Memory MCP Server installed successfully"
else
    print_warning "Memory MCP Server installation failed"
fi

# Install Fetch MCP Server
echo "Installing Fetch MCP Server..."
npm install -g @modelcontextprotocol/server-fetch
if [ $? -eq 0 ]; then
    print_status "Fetch MCP Server installed successfully"
else
    print_warning "Fetch MCP Server installation failed"
fi

echo ""
echo "Creating MCP requirements file..."
echo "---------------------------------"

# Create requirements-mcp.txt
cat > requirements-mcp.txt << EOF
# MCP Server Requirements for Music Analyzer Pro
mcp-server-sqlite>=0.1.0
pydantic-ai>=0.1.0
EOF

print_status "Created requirements-mcp.txt"

echo ""
echo "Verifying installations..."
echo "--------------------------"

# Verify Python packages
echo "Python packages:"
pip list | grep -E "mcp-server-sqlite|pydantic-ai" || print_warning "Some Python packages may not be installed"

# Verify Node packages
echo ""
echo "Node.js packages:"
npm list -g --depth=0 | grep -E "@modelcontextprotocol" || print_warning "Some Node packages may not be installed"

echo ""
echo "==========================================="
echo "Installation Summary"
echo "==========================================="
echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure Claude Desktop with the MCP servers"
echo "2. Copy the configuration from MCP_SETUP.md"
echo "3. Restart Claude Desktop"
echo ""
echo "Configuration file location:"
echo "  macOS/Linux: ~/.config/claude/claude_desktop_config.json"
echo "  Windows: %APPDATA%\\claude\\claude_desktop_config.json"
echo ""
echo "For detailed setup instructions, see MCP_SETUP.md"
echo ""

# Ask if user wants to create config file
read -p "Would you like to create the Claude Desktop configuration now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./scripts/configure_claude_desktop.sh
fi