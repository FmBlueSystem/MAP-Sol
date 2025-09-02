#!/usr/bin/env python3
"""
Test metadata viewer directly to find HAMMS display issue
"""

import sys
import os
from pathlib import Path

# Setup paths
sys.path.insert(0, 'src')
os.chdir('/Users/freddymolina/Desktop/music-app-qt')

from PyQt6.QtWidgets import QApplication
from metadata_viewer import MetadataViewer

def test_metadata_viewer_direct():
    """Test metadata viewer directly"""
    
    print("=" * 80)
    print("🧪 TESTING METADATA VIEWER DIRECTLY")
    print("=" * 80)
    
    # Create Qt application
    app = QApplication([])
    
    try:
        # Create metadata viewer
        viewer = MetadataViewer()
        
        # Load data (this should trigger our debug output)
        viewer.load_data()
        
        # Check HAMMS table
        hamms_row_count = viewer.hamms_table.rowCount()
        hamms_col_count = viewer.hamms_table.columnCount()
        
        print(f"\n📊 HAMMS Table Status:")
        print(f"   Rows: {hamms_row_count}")
        print(f"   Columns: {hamms_col_count}")
        
        if hamms_row_count > 0:
            print(f"\n🔍 HAMMS Table Content:")
            for row in range(min(hamms_row_count, 3)):  # Show first 3 rows
                print(f"   Row {row}:")
                for col in range(min(hamms_col_count, 5)):  # Show first 5 columns
                    item = viewer.hamms_table.item(row, col)
                    value = item.text() if item else "None"
                    print(f"      Col {col}: {value}")
        
        # Check if HAMMS vectors are stored
        print(f"\n🧬 Stored HAMMS vectors: {len(viewer.hamms_vectors)}")
        for key, vector in list(viewer.hamms_vectors.items())[:2]:  # Show first 2
            print(f"   Vector {key}: {len(vector)} dimensions, range [{min(vector):.3f}, {max(vector):.3f}]")
        
        print("\n✅ Direct test completed - check debug output above")
        
    except Exception as e:
        print(f"❌ Error in direct test: {e}")
        import traceback
        traceback.print_exc()
    
    # Don't show the window, just test the data loading
    app.quit()

if __name__ == "__main__":
    test_metadata_viewer_direct()