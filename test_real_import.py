#!/usr/bin/env python3
"""
Test real import by programmatically adding a file
"""

import sys
import os
import time
from pathlib import Path

# Set up path
sys.path.insert(0, 'src')
os.chdir('/Users/freddymolina/Desktop/music-app-qt')

# Now import after path is set
from PyQt6.QtWidgets import QApplication
from music_player import MusicPlayerWindow

def test_import():
    """Test import with a real file"""
    app = QApplication(sys.argv)
    window = MusicPlayerWindow()
    
    # File to test
    test_file = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/DJ Snake, J Balvin, Tyga - Loco Contigo.flac"
    
    if Path(test_file).exists():
        print("\n" + "="*70)
        print("TESTING REAL IMPORT WITH IMPROVED MESSAGES")
        print("="*70)
        print(f"File: {Path(test_file).name}")
        print("Watch the console for detailed import progress...")
        print("="*70 + "\n")
        
        # Add file directly
        window.add_file_to_library(test_file)
        
        print("\n" + "="*70)
        print("IMPORT TEST COMPLETE")
        print("Check above for the 5-step import process")
        print("="*70)
    else:
        print(f"Test file not found: {test_file}")

if __name__ == "__main__":
    test_import()