"""
Pytest configuration and shared fixtures for Music Analyzer Pro tests
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import Mock

import pytest
from PyQt6.QtWidgets import QApplication

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.fixture(scope="session")
def qapp():
    """Create QApplication instance for Qt tests"""
    app = QApplication.instance()
    if app is None:
        app = QApplication([])
    yield app
    app.quit()


@pytest.fixture
def temp_db():
    """Create temporary database for testing"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    yield db_path
    try:
        os.unlink(db_path)
    except FileNotFoundError:
        pass


@pytest.fixture
def mock_audio_file():
    """Create mock audio file for testing"""
    mock_file = Mock()
    mock_file.path = "/test/audio.mp3"
    mock_file.metadata = {
        'title': 'Test Song',
        'artist': 'Test Artist',
        'album': 'Test Album',
        'duration': 180.0,
        'bpm': 128,
        'key': 'C',
    }
    return mock_file


@pytest.fixture
def sample_config():
    """Sample configuration for testing"""
    return {
        'analysis': {
            'max_concurrent': 2,
            'timeout_seconds': 30,
        },
        'database': {
            'path': ':memory:',
            'busy_timeout_ms': 3000,
        },
        'ui': {
            'grid_page_size': 40,
            'toasts_enabled': True,
            'toast_timeout_ms': 2500,
        },
        'ai': {
            'enabled': False,
            'model': 'gpt-4',
            'max_tokens': 500,
        }
    }


@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response"""
    return {
        'choices': [{
            'message': {
                'content': '{"genre": "Electronic", "mood": "Energetic", "energy": 8}'
            }
        }]
    }


# Markers
def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "slow: Slow tests")
    config.addinivalue_line("markers", "gui: GUI tests requiring QApplication")