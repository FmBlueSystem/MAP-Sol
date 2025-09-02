"""
PyInstaller hook for librosa.

This hook ensures that librosa's data files and dependencies are properly included.
"""

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Collect all librosa submodules
hiddenimports = collect_submodules('librosa')

# Collect data files (example audio files, etc.)
datas = collect_data_files('librosa')