#!/usr/bin/env python3
"""
Test script for preferences dialog.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from PyQt6.QtWidgets import QApplication
from ui.preferences_dialog import PreferencesDialog
from utils.config import get_config, get_ai_config
import json


def test_preferences_dialog():
    """Test preferences dialog and config persistence."""
    app = QApplication(sys.argv)
    
    print("Testing Preferences Dialog...")
    print("=" * 50)
    
    # Show current configuration
    print("\n1. Current General Config:")
    general_config = get_config()
    print(f"   Theme: {general_config.get('ui', {}).get('theme', 'dark')}")
    print(f"   Grid Size: {general_config.get('ui', {}).get('grid_page_size', 100)}")
    print(f"   Serato Path: {general_config.get('serato', {}).get('root_path', 'Not set')}")
    print(f"   Loudness Norm: {general_config.get('playback', {}).get('loudness_normalization', True)}")
    
    print("\n2. Current AI Config:")
    ai_config = get_ai_config()
    print(f"   AI Enabled: {ai_config.get('ai_analysis', {}).get('enabled', True)}")
    print(f"   Max Parallel: {ai_config.get('ai_analysis', {}).get('max_parallel', 2)}")
    print(f"   Default Playlist Type: {ai_config.get('playlist_generation', {}).get('default_type', 'harmonic_journey')}")
    print(f"   HAMMS Weight: {ai_config.get('playlist_generation', {}).get('hamms_weight', 0.6) * 100:.0f}%")
    
    # Create and show dialog
    print("\n3. Opening Preferences Dialog...")
    print("   - Try changing some settings")
    print("   - Click Save to persist them")
    print("   - Or click Cancel to keep current settings")
    
    dialog = PreferencesDialog()
    result = dialog.exec()
    
    if result == dialog.DialogCode.Accepted:
        print("\n4. Settings Saved! New configuration:")
        
        # Reload configs to see changes
        general_config = get_config()
        ai_config = get_ai_config()
        
        print("\n   General Config:")
        print(f"   Theme: {general_config.get('ui', {}).get('theme', 'dark')}")
        print(f"   Grid Size: {general_config.get('ui', {}).get('grid_page_size', 100)}")
        print(f"   Serato Path: {general_config.get('serato', {}).get('root_path', 'Not set')}")
        print(f"   Loudness Norm: {general_config.get('playback', {}).get('loudness_normalization', True)}")
        print(f"   Target LUFS: {general_config.get('playback', {}).get('target_lufs', -18.0)}")
        
        print("\n   AI Config:")
        print(f"   AI Enabled: {ai_config.get('ai_analysis', {}).get('enabled', True)}")
        print(f"   Max Parallel: {ai_config.get('ai_analysis', {}).get('max_parallel', 2)}")
        print(f"   Lyrics Enabled: {ai_config.get('lyrics_analysis', {}).get('enabled', False)}")
        print(f"   Default Playlist Type: {ai_config.get('playlist_generation', {}).get('default_type', 'harmonic_journey')}")
        print(f"   Default Duration: {ai_config.get('playlist_generation', {}).get('default_duration', 60)} min")
        print(f"   HAMMS Weight: {ai_config.get('playlist_generation', {}).get('hamms_weight', 0.6) * 100:.0f}%")
        
        # Check if config files exist
        config_path = Path.cwd() / 'config.yaml'
        ai_config_path = Path.cwd() / 'config_ai.yaml'
        
        print(f"\n5. Config File Status:")
        print(f"   config.yaml exists: {config_path.exists()}")
        print(f"   config_ai.yaml exists: {ai_config_path.exists()}")
        
        print("\n✅ Preferences dialog test successful!")
    else:
        print("\n4. Cancelled - no changes made")
    
    return 0


if __name__ == "__main__":
    sys.exit(test_preferences_dialog())