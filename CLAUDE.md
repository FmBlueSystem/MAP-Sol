# Music Analyzer Pro - Claude Development Guide

## Project Overview
Music Analyzer Pro is a modern music application built with PyQt6, featuring professional audio analysis, HAMMS compatibility analysis, MixedInKey integration, and AI-powered metadata enrichment.

## Core Development Philosophy

### Principles
- **KISS (Keep It Simple, Stupid)**: Simplicity over unnecessary complexity
- **YAGNI (You Aren't Gonna Need It)**: Only implement what's needed now
- **DRY (Don't Repeat Yourself)**: Single source of truth for all functionality
- **Separation of Concerns**: Clear boundaries between modules
- **Single Responsibility**: Each class/function has one clear purpose

### Design Patterns
- **Dependency Inversion**: Depend on abstractions, not concrete implementations
- **Open/Closed Principle**: Open for extension, closed for modification
- **Repository Pattern**: Database operations through dedicated classes
- **Observer Pattern**: Event-driven UI updates
- **Singleton Pattern**: Single database writer thread

## Project Structure

```
music-analyzer-pro/
├── src/
│   ├── core/               # Core business logic
│   ├── models/             # Data models and schemas
│   ├── ui/                 # PyQt6 UI components
│   ├── audio/              # Audio processing modules
│   ├── ai_analysis/        # AI enrichment system
│   ├── analytics/          # Usage analytics
│   ├── playlist_generation/# Smart playlist creation
│   ├── search/             # Search functionality
│   ├── telemetry/          # Performance monitoring
│   └── utils/              # Utility functions
├── tests/                  # Test suite
├── resources/              # Static assets
├── packaging/              # Build and distribution
├── prompts/               # AI system prompts
└── scripts/               # Utility scripts
```

## Development Environment

### Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt
pip install -r requirements-ia.txt
```

### Key Commands
```bash
# Run main application
python src/music_player.py

# Run tests
pytest tests/ -v

# Check code quality
ruff check src/
black src/ --check
mypy src/

# Build standalone app
cd packaging && python build.py
```

## Coding Standards

### Python Style Guide
- Follow PEP 8 with 120 character line limit
- Use type hints for all function signatures
- Docstrings for all public methods (Google style)
- F-strings for string formatting

### Naming Conventions
- Classes: PascalCase (e.g., `AudioAnalyzer`)
- Functions/Variables: snake_case (e.g., `analyze_audio`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_THREADS`)
- Private methods: prefix with underscore (e.g., `_internal_method`)

### File Organization
- Maximum 500 lines per file
- Maximum 50 lines per function
- Group imports: standard library, third-party, local
- One class per file for major components

## Testing Strategy

### Test Organization
```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests
├── performance/    # Performance benchmarks
└── fixtures/       # Test data and mocks
```

### Testing Requirements
- Minimum 80% code coverage
- All new features must include tests
- Test both success and failure cases
- Use pytest fixtures for common setup
- Mock external dependencies (API calls, file I/O)

### Test Patterns
```python
# Test naming: test_<what>_<condition>_<expected>
def test_audio_analyzer_valid_mp3_returns_metadata():
    pass

def test_hamms_analyzer_missing_bpm_raises_error():
    pass
```

## Database Management

### Schema Rules
- Use SQLite with single-writer pattern
- All tables must have primary key
- Foreign keys for relationships
- Indexes on frequently queried columns
- BLOB storage for artwork

### Naming Standards
- Tables: plural, snake_case (e.g., `audio_tracks`)
- Columns: snake_case (e.g., `created_at`)
- Indexes: idx_<table>_<columns> (e.g., `idx_tracks_bpm_key`)

## Error Handling

### Exception Hierarchy
```python
class MusicAnalyzerError(Exception):
    """Base exception for all app errors"""

class AudioProcessingError(MusicAnalyzerError):
    """Audio processing failures"""

class DatabaseError(MusicAnalyzerError):
    """Database operation failures"""

class AIEnrichmentError(MusicAnalyzerError):
    """AI enrichment failures"""
```

### Logging Strategy
- Use structured logging with levels
- Log errors with full context
- Performance metrics for slow operations
- User actions for analytics

## Configuration Management

### Config Files
- `config.yaml`: Main application config
- `config_ai.yaml`: AI enrichment settings
- `config_openai.yaml`: OpenAI API settings

### Environment Variables
```bash
# Override config values
ANALYSIS_MAX_CONCURRENT=4
DB_BUSY_TIMEOUT_MS=5000
UI_GRID_PAGE_SIZE=50
OPENAI_API_KEY=<your-key>
```

## AI Integration

### OpenAI GPT-4 Integration
- Metadata enrichment for tracks
- Genre classification
- Mood analysis
- Contextual recommendations

### Prompt Engineering
- Structured prompts in `prompts/` directory
- Version control for prompt changes
- A/B testing for prompt effectiveness

## Performance Optimization

### Threading Model
- Single database writer thread
- Worker pool for audio analysis
- Priority queue for user actions
- Lazy loading for UI components

### Memory Management
- Stream large audio files
- Cache frequently accessed data
- Release resources after use
- Profile memory usage regularly

## Security Best Practices

### API Keys
- Never commit API keys
- Use environment variables
- Rotate keys regularly
- Implement rate limiting

### User Data
- Sanitize all inputs
- Validate file types
- Limit file sizes
- Secure temporary files

## Git Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Emergency fixes

### Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: feat, fix, docs, style, refactor, test, chore

## Continuous Integration

### GitHub Actions
- Run tests on all PRs
- Code quality checks
- Security scanning
- Automated releases

### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/psf/black
    hooks:
      - id: black
  - repo: https://github.com/charliermarsh/ruff-pre-commit
    hooks:
      - id: ruff
```

## Documentation

### Code Documentation
- Docstrings for all public APIs
- Type hints for clarity
- Comments for complex logic
- README for each module

### User Documentation
- Installation guide
- Feature documentation
- API reference
- Troubleshooting guide

## Debugging Tools

### Development Mode
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# PyQt6 debugging
from PyQt6.QtCore import Qt
app.setAttribute(Qt.ApplicationAttribute.AA_EnableHighDpiScaling)
```

### Performance Profiling
```python
# Use cProfile for bottlenecks
import cProfile
cProfile.run('analyze_audio(file_path)')

# Memory profiling
from memory_profiler import profile
@profile
def memory_intensive_function():
    pass
```

## Deployment

### Packaging with PyInstaller
```bash
cd packaging
python build.py --platform macos
python build.py --platform windows
python build.py --platform linux
```

### Distribution
- GitHub Releases for versioned builds
- Homebrew formula for macOS
- Windows installer with NSIS
- AppImage for Linux

## Task Completion Workflow

1. **Understand Requirements**
   - Review user story/issue
   - Clarify ambiguities
   - Define acceptance criteria

2. **Plan Implementation**
   - Break down into subtasks
   - Identify dependencies
   - Estimate complexity

3. **Write Tests First (TDD)**
   - Write failing tests
   - Implement minimal code
   - Refactor for quality

4. **Code Implementation**
   - Follow coding standards
   - Handle edge cases
   - Add logging/metrics

5. **Quality Assurance**
   - Run test suite
   - Check code coverage
   - Performance testing
   - Security review

6. **Documentation**
   - Update API docs
   - Add usage examples
   - Update changelog

7. **Code Review**
   - Self-review first
   - Address feedback
   - Ensure CI passes

## Common Commands Reference

```bash
# Development
python src/music_player.py          # Run main app
python src/app.py                   # Run analyzer UI
pytest tests/ -v                    # Run all tests
pytest tests/ -k "hamms"           # Run specific tests

# Code Quality
ruff check src/                    # Lint code
black src/                         # Format code
mypy src/                          # Type checking

# Database
sqlite3 music_library.db           # Open database
.schema                            # Show schema
.tables                           # List tables

# AI Testing
python test_ai_complete.py         # Test AI system
python verify_ai_status.py         # Verify AI setup

# Build & Package
cd packaging && python build.py    # Build standalone app
./validate_app.sh                  # Validate build
```

## Troubleshooting Guide

### Common Issues

1. **Database Locked Error**
   - Single writer thread ensures no conflicts
   - Check `DB_BUSY_TIMEOUT_MS` setting
   - Verify no external DB connections

2. **Audio Analysis Failures**
   - Check file format compatibility
   - Verify librosa/soundfile installation
   - Check file permissions

3. **AI Enrichment Not Working**
   - Verify API key in environment
   - Check rate limits
   - Review error logs

4. **UI Performance Issues**
   - Enable lazy loading
   - Reduce grid page size
   - Profile rendering bottlenecks

## Contact & Support

- **Repository**: [GitHub Project]
- **Issues**: Report bugs via GitHub Issues
- **Documentation**: See `/docs` folder
- **Team**: Music App Development Team

---

Last Updated: 2025-09-03
Version: 1.0.0