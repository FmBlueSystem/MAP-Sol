"""
Path utilities for handling resources in both development and frozen (PyInstaller) environments.
"""

import sys
import os
from pathlib import Path


def resource_path(*rel_path_parts) -> Path:
    """
    Get absolute path to resource, works for development and PyInstaller frozen apps.
    
    In development, resources are relative to the project root.
    In frozen apps, resources are in the sys._MEIPASS temporary directory.
    
    Args:
        *rel_path_parts: Path components relative to resources directory
        
    Returns:
        Path object pointing to the resource
        
    Example:
        icon_path = resource_path('resources', 'icon.png')
        model_path = resource_path('models', 'genre_model.pkl')
    """
    # Check if we're running in a PyInstaller bundle
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        # Running in a PyInstaller bundle
        base_path = Path(sys._MEIPASS)
    else:
        # Running in development mode
        # Go up from src/utils to project root
        base_path = Path(__file__).parent.parent.parent
    
    # Build the full path
    full_path = base_path
    for part in rel_path_parts:
        full_path = full_path / part
    
    return full_path


def data_path(*rel_path_parts) -> Path:
    """
    Get path to user data directory (for writable files).
    
    This is for files that need to be written at runtime (databases, logs, config).
    These go in the user's home directory, not in the app bundle.
    
    Args:
        *rel_path_parts: Path components relative to data directory
        
    Returns:
        Path object pointing to the data location
    """
    # Use user's home directory for writable data
    if sys.platform == "win32":
        # Windows: %APPDATA%/MusicAnalyzerPro
        base_path = Path(os.environ.get('APPDATA', Path.home())) / 'MusicAnalyzerPro'
    elif sys.platform == "darwin":
        # macOS: ~/Library/Application Support/MusicAnalyzerPro
        base_path = Path.home() / 'Library' / 'Application Support' / 'MusicAnalyzerPro'
    else:
        # Linux and others: ~/.music_analyzer_pro
        base_path = Path.home() / '.music_analyzer_pro'
    
    # Ensure the directory exists
    base_path.mkdir(parents=True, exist_ok=True)
    
    # Build the full path
    full_path = base_path
    for part in rel_path_parts:
        full_path = full_path / part
    
    return full_path


def get_config_path(filename: str = 'config.yaml') -> Path:
    """
    Get the path to a configuration file.
    
    In development: project root
    In frozen app: user data directory
    
    Args:
        filename: Name of the config file
        
    Returns:
        Path to the config file
    """
    if getattr(sys, 'frozen', False):
        # In frozen app, configs go in user data directory
        return data_path(filename)
    else:
        # In development, use project root
        return Path(__file__).parent.parent.parent / filename


def get_database_path(filename: str = 'music_library.db') -> Path:
    """
    Get the path to the database file.
    
    Always in user data directory (needs to be writable).
    
    Args:
        filename: Name of the database file
        
    Returns:
        Path to the database file
    """
    return data_path(filename)


def is_frozen() -> bool:
    """
    Check if the application is running as a frozen executable (PyInstaller).
    
    Returns:
        True if running as frozen executable, False if in development
    """
    return getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')


def is_ci_environment() -> bool:
    """
    Check if running in a CI/CD environment.
    
    Checks for common CI environment variables.
    
    Returns:
        True if running in CI, False otherwise
    """
    ci_env_vars = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'JENKINS', 'TRAVIS']
    return any(os.environ.get(var, '').lower() in ('true', '1') for var in ci_env_vars)