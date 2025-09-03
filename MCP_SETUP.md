# MCP (Model Context Protocol) Setup for Music Analyzer Pro

## Overview
This guide provides instructions for setting up MCP servers to enhance development and functionality of Music Analyzer Pro.

## Prerequisites

- Claude Desktop application installed
- Node.js and npm (for JavaScript-based MCP servers)
- Python 3.8+ (for Python-based MCP servers)
- Git for version control
- GitHub personal access token (for GitHub MCP server)

## MCP Server Installation

### 1. SQLite MCP Server (Essential)

This server provides advanced database operations for your music library.

```bash
# Install via pip
pip install mcp-server-sqlite

# Or add to requirements-mcp.txt
echo "mcp-server-sqlite>=0.1.0" >> requirements-mcp.txt
```

**Features:**
- Query music metadata efficiently
- Analyze playback statistics
- Manage playlists and user preferences
- Generate reports on library composition

### 2. Filesystem MCP Server (Essential)

Provides secure file operations with proper access controls.

```bash
# Install via npm
npm install -g @modelcontextprotocol/server-filesystem

# Or use npx directly (no installation needed)
npx @modelcontextprotocol/server-filesystem
```

**Features:**
- Secure audio file management
- Batch import/export operations
- Directory organization
- File metadata extraction

### 3. GitHub MCP Server (Recommended)

Integrates with your Git repository for version control.

```bash
# Install via npm
npm install -g @modelcontextprotocol/server-github

# Or use npx directly
npx @modelcontextprotocol/server-github
```

**Features:**
- Repository management
- Issue tracking
- Pull request automation
- Release management

### 4. Memory MCP Server (Advanced)

Provides persistent memory for user preferences and patterns.

```bash
# Install via npm
npm install -g @modelcontextprotocol/server-memory

# Or use npx directly
npx @modelcontextprotocol/server-memory
```

**Features:**
- Learn user music preferences
- Store analysis patterns
- Remember application state
- Personalized recommendations

### 5. Python Code Execution Server (Development)

Execute Python code in a controlled environment.

```bash
# Install via pip
pip install pydantic-ai

# The MCP server comes with pydantic-ai
```

**Features:**
- Test audio processing algorithms
- Debug metadata extraction
- Validate analysis functions
- Run performance tests

## Claude Desktop Configuration

### Location of Config File

**macOS/Linux:**
```bash
~/.config/claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\claude\claude_desktop_config.json
```

### Complete Configuration

Create or edit the configuration file:

```json
{
  "mcpServers": {
    "sqlite-music": {
      "command": "python",
      "args": [
        "-m",
        "mcp_server_sqlite",
        "--db-path",
        "/Users/freddymolina/Desktop/New MAP/music_library.db"
      ],
      "description": "Music library database operations"
    },
    "filesystem-music": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/freddymolina/Desktop/New MAP"
      ],
      "description": "Music project file management"
    },
    "filesystem-audio": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/freddymolina/Music"
      ],
      "description": "Audio files directory access"
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "description": "GitHub repository management"
    },
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ],
      "description": "User preferences and patterns"
    },
    "python-runner": {
      "command": "python",
      "args": [
        "-m",
        "pydantic_ai.mcp"
      ],
      "description": "Python code execution for testing"
    }
  }
}
```

### Environment Variables Setup

Create a `.env` file for sensitive data:

```bash
# .env file in your home directory
GITHUB_TOKEN=ghp_your_github_token_here
OPENAI_API_KEY=sk-your_openai_key_here
```

## Verification Steps

### 1. Test SQLite Server

After configuration, restart Claude Desktop and verify:

```sql
-- In Claude, you should be able to run:
SELECT COUNT(*) FROM audio_tracks;
SELECT artist, title, bpm, key FROM audio_tracks LIMIT 10;
```

### 2. Test Filesystem Server

```bash
# In Claude, test file operations:
# List project files
ls /Users/freddymolina/Desktop/New MAP/src/

# Read a file
cat /Users/freddymolina/Desktop/New MAP/README.md
```

### 3. Test GitHub Server

```bash
# In Claude, test GitHub operations:
# List repository issues
gh issue list

# View repository info
gh repo view
```

## Usage Examples

### Example 1: Analyze Music Library Composition

With SQLite MCP server, Claude can directly query your database:

```sql
-- Genre distribution
SELECT genre, COUNT(*) as count 
FROM audio_tracks 
WHERE genre IS NOT NULL 
GROUP BY genre 
ORDER BY count DESC;

-- BPM analysis
SELECT 
  CASE 
    WHEN bpm < 100 THEN 'Slow (< 100)'
    WHEN bpm < 120 THEN 'Moderate (100-120)'
    WHEN bpm < 140 THEN 'Fast (120-140)'
    ELSE 'Very Fast (140+)'
  END as tempo_range,
  COUNT(*) as track_count
FROM audio_tracks
WHERE bpm IS NOT NULL
GROUP BY tempo_range;
```

### Example 2: Batch Import Audio Files

With Filesystem MCP server, manage audio imports:

```python
# Claude can help you import files with proper organization
import os
from pathlib import Path

# Scan for audio files
audio_dir = Path("/Users/freddymolina/Music")
audio_files = list(audio_dir.glob("**/*.mp3"))

# Organize by artist
for file in audio_files:
    # Extract metadata and organize
    pass
```

### Example 3: Create GitHub Release

With GitHub MCP server:

```bash
# Create a new release
gh release create v1.1.0 \
  --title "Music Analyzer Pro v1.1.0" \
  --notes "Added MCP integration for enhanced functionality" \
  --draft
```

## Security Best Practices

1. **Filesystem Access:**
   - Only grant access to necessary directories
   - Use read-only access when possible
   - Avoid granting access to system directories

2. **Database Access:**
   - Use read-only connections for queries
   - Backup database before write operations
   - Implement query limits

3. **GitHub Token:**
   - Use fine-grained personal access tokens
   - Limit scope to necessary permissions
   - Rotate tokens regularly

4. **Python Execution:**
   - Use only in development environment
   - Implement timeout limits
   - Sandbox execution environment

## Troubleshooting

### Common Issues

1. **MCP Server Not Found:**
   ```bash
   # Check if server is installed
   which mcp-server-sqlite
   npm list -g @modelcontextprotocol/server-filesystem
   ```

2. **Permission Denied:**
   ```bash
   # Check file permissions
   ls -la ~/.config/claude/
   chmod 644 ~/.config/claude/claude_desktop_config.json
   ```

3. **Database Connection Failed:**
   ```bash
   # Verify database path
   ls -la /Users/freddymolina/Desktop/New\ MAP/music_library.db
   
   # Check database integrity
   sqlite3 music_library.db "PRAGMA integrity_check;"
   ```

4. **GitHub Authentication Failed:**
   ```bash
   # Test GitHub token
   export GITHUB_TOKEN=your_token
   gh auth status
   ```

## Advanced Configuration

### Custom MCP Server for Audio Processing

Create a custom MCP server for specialized audio operations:

```python
# audio_mcp_server.py
from mcp import Server, Tool

class AudioMCPServer(Server):
    @Tool()
    async def analyze_bpm(self, file_path: str) -> float:
        """Analyze BPM of audio file"""
        # Implementation here
        pass
    
    @Tool()
    async def extract_key(self, file_path: str) -> str:
        """Extract musical key from audio file"""
        # Implementation here
        pass
```

### Integration with Music Analyzer Pro

Add MCP support to your application:

```python
# src/mcp_integration.py
class MCPIntegration:
    """Integrate MCP servers with Music Analyzer Pro"""
    
    def __init__(self):
        self.sqlite_server = self.connect_sqlite()
        self.fs_server = self.connect_filesystem()
    
    def query_library(self, sql: str):
        """Execute SQL query via MCP"""
        return self.sqlite_server.execute(sql)
    
    def import_audio_batch(self, directory: str):
        """Import audio files via MCP"""
        files = self.fs_server.list_files(directory)
        # Process files
```

## Performance Optimization

### 1. Connection Pooling
```json
{
  "mcpServers": {
    "sqlite-music": {
      "command": "python",
      "args": ["-m", "mcp_server_sqlite", "--pool-size", "5"],
      "persistent": true
    }
  }
}
```

### 2. Caching Strategy
```json
{
  "mcpServers": {
    "filesystem-music": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "--cache-ttl", "3600"],
      "persistent": true
    }
  }
}
```

## Monitoring and Logging

### Enable Debug Logging
```json
{
  "mcpServers": {
    "sqlite-music": {
      "command": "python",
      "args": ["-m", "mcp_server_sqlite", "--log-level", "DEBUG"],
      "env": {
        "MCP_LOG_FILE": "/tmp/mcp-sqlite.log"
      }
    }
  }
}
```

### Monitor Server Health
```bash
# Check server status
ps aux | grep mcp-server

# View logs
tail -f /tmp/mcp-*.log
```

## Next Steps

1. **Install Essential Servers:** Start with SQLite and Filesystem
2. **Configure Claude Desktop:** Update configuration file
3. **Test Basic Operations:** Verify servers are working
4. **Integrate with Project:** Use MCP in your development workflow
5. **Customize as Needed:** Create custom servers for specific needs

## Resources

- [MCP Documentation](https://github.com/anthropics/mcp)
- [Official MCP Servers](https://github.com/modelcontextprotocol)
- [Music Analyzer Pro Wiki](https://github.com/yourusername/music-analyzer-pro/wiki)
- [Claude Desktop Guide](https://claude.ai/docs/desktop)

---

Last Updated: 2025-09-03
Version: 1.0.0