#!/bin/bash

# GitHub Setup Script for Music Analyzer Pro
# This script helps configure GitHub integration safely

set -e

echo "========================================="
echo "GitHub Configuration Setup"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}This script will help you configure GitHub safely${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from template"
fi

# Function to validate GitHub token
validate_github_token() {
    local token=$1
    
    # Test the token
    response=$(curl -s -H "Authorization: token $token" https://api.github.com/user)
    
    if echo "$response" | grep -q "login"; then
        username=$(echo "$response" | grep -oP '"login":\s*"\K[^"]+')
        echo -e "${GREEN}✓ Token valid for user: $username${NC}"
        return 0
    else
        echo "❌ Invalid token"
        return 1
    fi
}

# Prompt for GitHub token
echo "Please create a new GitHub token at:"
echo "https://github.com/settings/tokens/new"
echo ""
echo "Required permissions:"
echo "  - repo (full control)"
echo "  - workflow (optional, for CI/CD)"
echo ""

read -p "Enter your NEW GitHub token: " github_token

# Validate token
if validate_github_token "$github_token"; then
    # Update .env file
    sed -i.bak "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$github_token/" .env
    echo -e "${GREEN}✓ GitHub token configured successfully${NC}"
    
    # Configure git
    echo ""
    echo "Configuring git..."
    git config --global credential.helper store
    
    # Test GitHub connection
    echo "Testing GitHub connection..."
    if git ls-remote https://github.com/FmBlueSystem/SolII.git &>/dev/null; then
        echo -e "${GREEN}✓ Successfully connected to GitHub${NC}"
    else
        echo -e "${YELLOW}⚠ Could not connect to repository. Check permissions.${NC}"
    fi
else
    echo "Token validation failed. Please check your token and try again."
    exit 1
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Your GitHub integration is now configured."
echo "Token is stored in .env (this file is git-ignored)"
echo ""
echo "Next steps:"
echo "1. Initialize repository: git init (if needed)"
echo "2. Add remote: git remote add origin https://github.com/yourusername/repo.git"
echo "3. Push code: git push -u origin main"