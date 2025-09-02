"""
PyInstaller hook for soundfile.

This hook ensures that soundfile's native libraries are properly included.
"""

from PyInstaller.utils.hooks import collect_dynamic_libs

# Collect the native libraries that soundfile needs
binaries = collect_dynamic_libs('soundfile')