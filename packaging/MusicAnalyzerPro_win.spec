# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Music Analyzer Pro (Windows)
"""

import os
import sys
from pathlib import Path

# Get project root directory
project_root = Path('../').resolve()

block_cipher = None

a = Analysis(
    ['..\\src\\main.py'],
    pathex=['..\\src'],
    binaries=[],
    datas=[
        # Resources (if exists)
        ('..\\resources', 'resources') if (project_root / 'resources').exists() else None,
        # Models (if exists)
        ('..\\src\\ai_analysis\\models', 'models') if (project_root / 'src/ai_analysis/models').exists() else None,
        # Config examples
        ('..\\config.yaml', '.') if (project_root / 'config.yaml').exists() else None,
        ('..\\config_ai.yaml', '.') if (project_root / 'config_ai.yaml').exists() else None,
        ('..\\config.example.yaml', '.') if (project_root / 'config.example.yaml').exists() else None,
        ('..\\config_ai.yaml.example', '.') if (project_root / 'config_ai.yaml.example').exists() else None,
    ],
    hiddenimports=[
        # PyQt6 modules
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        'PyQt6.QtMultimedia',
        'PyQt6.QtMultimediaWidgets',
        'PyQt6.sip',
        # Scientific computing
        'numpy',
        'scipy',
        'scipy.signal',
        'scipy.ndimage',
        # Audio processing
        'librosa',
        'librosa.core',
        'librosa.feature',
        'librosa.onset',
        'librosa.beat',
        'soundfile',
        'mutagen',
        'mutagen.mp3',
        'mutagen.mp4',
        'mutagen.flac',
        'mutagen.id3',
        # Visualization
        'pyqtgraph',
        # Database
        'sqlite3',
        # Standard library
        'json',
        'csv',
        'uuid',
        'base64',
        'tempfile',
        'wave',
        # Optional dependencies
        'yaml',
        'sklearn',
        'sklearn.cluster',
        'sklearn.preprocessing',
    ],
    hookspath=['.\\hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'tkinter',
        'test',
        'tests',
        'pytest',
        'pip',
        'setuptools',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Filter out None values from datas
a.datas = [d for d in a.datas if d is not None]

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher,
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MusicAnalyzerPro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='..\\resources\\icon.ico' if (project_root / 'resources/icon.ico').exists() else None,
    version_file=None,
)