#!/usr/bin/env python3
"""
Test the metadata viewer to see all real data
"""

import sys
import os
os.chdir('/Users/freddymolina/Desktop/music-app-qt')
sys.path.insert(0, 'src')

from PyQt6.QtWidgets import QApplication
from metadata_viewer import MetadataViewer

def main():
    print("=" * 70)
    print("📊 METADATA VIEWER TEST")
    print("=" * 70)
    print("Opening viewer with all real metadata from database...")
    print("This shows:")
    print("  • Track Overview - All tracks with source (MixedInKey vs AI)")
    print("  • MixedInKey Data - Professional DJ metadata")
    print("  • HAMMS Analysis - 12D vectors for mixing")
    print("  • Audio Features - Calculated features")
    print("  • Raw Metadata - All fields from files")
    print("=" * 70)
    
    app = QApplication(sys.argv)
    
    # Create and show viewer
    viewer = MetadataViewer()
    viewer.show()
    
    # Print summary
    tracks_count = viewer.tracks_table.rowCount()
    mixedinkey_count = viewer.mixedinkey_table.rowCount()
    hamms_count = viewer.hamms_table.rowCount()
    
    print(f"\n📈 Data Summary:")
    print(f"  • Total tracks: {tracks_count}")
    print(f"  • Tracks with MixedInKey: {mixedinkey_count}")
    print(f"  • HAMMS vectors calculated: {hamms_count}")
    print("\n✅ Viewer opened successfully!")
    print("Check the different tabs to see all metadata")
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()