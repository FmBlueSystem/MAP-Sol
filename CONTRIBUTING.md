# Contributing to Music Analyzer Pro

Thank you for your interest in contributing to Music Analyzer Pro! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept responsibility for mistakes

## Getting Started

### Prerequisites

- Python 3.8 or higher
- Git
- Virtual environment tool (venv, virtualenv, or conda)

### Setting Up Development Environment

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/music-analyzer-pro.git
   cd music-analyzer-pro
   ```

3. Create a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

4. Install development dependencies:
   ```bash
   make install-dev
   # Or manually:
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   pip install -e .
   ```

5. Install pre-commit hooks:
   ```bash
   make pre-commit
   # Or manually:
   pre-commit install
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# Or for bugfixes:
git checkout -b bugfix/issue-description
```

### 2. Make Your Changes

Follow the coding standards outlined in [CLAUDE.md](CLAUDE.md):
- Write clean, readable code
- Add type hints to all functions
- Include docstrings for public APIs
- Keep functions under 50 lines
- Keep files under 500 lines

### 3. Write Tests

All new features must include tests:
```bash
# Run tests
make test

# Run with coverage
make coverage

# Run specific test
pytest tests/unit/test_your_feature.py -v
```

Test requirements:
- Maintain minimum 80% code coverage
- Test both success and failure cases
- Use fixtures for common setup
- Mock external dependencies

### 4. Format and Lint Your Code

```bash
# Format code
make format

# Check linting
make lint

# Run type checking
make type-check

# Run all checks
make check-all
```

### 5. Commit Your Changes

Write clear commit messages following this format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks

Example:
```bash
git commit -m "feat(audio): add support for OPUS format

- Implemented OPUS decoder using soundfile
- Added tests for OPUS file handling
- Updated documentation

Closes #123"
```

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference to related issues
- Screenshots for UI changes
- Test results

## Project Structure

```
music-analyzer-pro/
├── src/                 # Source code
│   ├── core/           # Core business logic
│   ├── models/         # Data models
│   ├── ui/             # PyQt6 UI components
│   ├── audio/          # Audio processing
│   ├── ai_analysis/    # AI enrichment
│   └── utils/          # Utilities
├── tests/              # Test suite
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── fixtures/      # Test data
├── docs/              # Documentation
├── resources/         # Static assets
└── packaging/         # Build scripts
```

## Testing Guidelines

### Test Organization

- `tests/unit/`: Test individual components
- `tests/integration/`: Test component interactions
- `tests/performance/`: Performance benchmarks

### Writing Tests

```python
# Test naming convention
def test_component_condition_expected_result():
    """Test that component returns expected result under condition"""
    # Arrange
    component = Component()
    
    # Act
    result = component.method()
    
    # Assert
    assert result == expected
```

### Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=src --cov-report=html

# Specific markers
pytest -m unit
pytest -m "not slow"

# Specific file
pytest tests/unit/test_audio.py
```

## Documentation

### Code Documentation

- Add docstrings to all public functions/classes
- Use Google-style docstrings:

```python
def analyze_audio(file_path: str) -> Dict[str, Any]:
    """Analyze audio file and extract metadata.
    
    Args:
        file_path: Path to the audio file
        
    Returns:
        Dictionary containing audio metadata
        
    Raises:
        AudioProcessingError: If file cannot be processed
    """
```

### User Documentation

Update relevant documentation in:
- `README.md`: Project overview
- `CLAUDE.md`: Development guide
- `docs/`: Detailed documentation

## Code Review Process

1. **Self-Review**: Review your own code first
2. **Automated Checks**: Ensure CI passes
3. **Peer Review**: Address reviewer feedback
4. **Approval**: Get at least one approval
5. **Merge**: Maintainer merges the PR

## Release Process

1. Update version in `pyproject.toml`
2. Update `CHANGELOG.md`
3. Create release tag:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```
4. GitHub Actions builds and uploads artifacts

## Common Tasks

### Adding a New Audio Format

1. Update `SUPPORTED_FORMATS` in `src/audio/formats.py`
2. Implement decoder in `src/audio/decoders.py`
3. Add tests in `tests/unit/test_audio_formats.py`
4. Update documentation

### Adding UI Components

1. Create component in `src/ui/components/`
2. Follow existing component patterns
3. Add to main window if needed
4. Include screenshot in PR

### Adding AI Features

1. Update prompts in `prompts/`
2. Implement in `src/ai_analysis/`
3. Add configuration options
4. Document API usage

## Troubleshooting

### Common Issues

**Import errors**: Ensure virtual environment is activated
```bash
source venv/bin/activate
```

**Test failures**: Check dependencies are installed
```bash
pip install -r requirements-dev.txt
```

**Pre-commit failures**: Run formatting
```bash
make format
```

## Getting Help

- **Issues**: Check existing [GitHub Issues](https://github.com/yourusername/music-analyzer-pro/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/yourusername/music-analyzer-pro/discussions)
- **Documentation**: Read [CLAUDE.md](CLAUDE.md)

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md`
- Release notes
- Project documentation

Thank you for contributing to Music Analyzer Pro!