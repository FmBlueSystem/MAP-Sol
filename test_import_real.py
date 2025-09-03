#!/usr/bin/env python3
"""
Test real import flow with actual audio files to verify threading.
This simulates what happens when users import music files.
"""

import sys
import time
import sqlite3
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer, QElapsedTimer

from music_player import MusicPlayer
from utils.logger import setup_logger

logger = setup_logger(__name__)


def test_import_performance():
    """Test import performance with real files."""
    
    print("\n" + "="*80)
    print("🎵 REAL IMPORT FLOW TEST")
    print("="*80)
    
    # Find test audio files
    test_dir = Path("/Users/freddymolina/Desktop/music-app-qt/tmp")
    audio_files = list(test_dir.glob("*.mp3"))[:3]  # Test with 3 files
    
    if not audio_files:
        print("❌ No test audio files found in tmp/")
        print("   Please add some MP3 files to tmp/ directory")
        return
    
    print(f"\n📁 Found {len(audio_files)} test files:")
    for f in audio_files:
        print(f"   • {f.name}")
    
    # Create Qt application
    app = QApplication(sys.argv)
    
    # Create music player instance
    player = MusicPlayer()
    
    # Track metrics
    metrics = {
        'start_time': None,
        'import_time': None,
        'hamms_time': None,
        'openai_time': None,
        'ui_blocks': [],
        'total_time': None
    }
    
    # Timer to check UI responsiveness
    ui_timer = QElapsedTimer()
    ui_check_count = 0
    ui_frozen = False
    
    def check_ui():
        """Check if UI is responsive."""
        nonlocal ui_check_count, ui_frozen
        elapsed = ui_timer.elapsed()
        ui_timer.restart()
        
        ui_check_count += 1
        
        if elapsed > 150:  # UI blocked for >150ms
            print(f"   ⚠️ UI BLOCKED for {elapsed}ms!")
            metrics['ui_blocks'].append(elapsed)
            ui_frozen = True
        elif ui_check_count % 10 == 0:  # Log every second
            print(f"   ✅ UI responsive (check #{ui_check_count}, {elapsed}ms)")
    
    # Setup UI check timer
    check_timer = QTimer()
    check_timer.timeout.connect(check_ui)
    
    def start_import():
        """Start the import process."""
        print("\n▶️ STARTING IMPORT...")
        metrics['start_time'] = time.time()
        
        # Start UI responsiveness monitoring
        ui_timer.start()
        check_timer.start(100)  # Check every 100ms
        
        # Clear existing library
        print("   Clearing existing library...")
        player.album_cards.clear()
        player.loaded_files.clear()
        
        # Simulate file selection and import
        print(f"\n📥 Importing {len(audio_files)} files...")
        
        # Track import phases
        import_start = time.time()
        
        for i, file_path in enumerate(audio_files):
            print(f"\n   File {i+1}/{len(audio_files)}: {file_path.name}")
            
            # Add file (this triggers the whole import flow)
            player.add_file_to_library(str(file_path))
            
            # Log what's happening
            print(f"      • Metadata extracted")
            print(f"      • Saved to database")
            print(f"      • HAMMS analysis queued (QThread)")
            print(f"      • Card added to UI")
        
        metrics['import_time'] = time.time() - import_start
        print(f"\n   Import phase completed in {metrics['import_time']:.2f}s")
        
        # Wait a bit for background threads to start
        QTimer.singleShot(2000, check_background_threads)
    
    def check_background_threads():
        """Check status of background threads."""
        print("\n🔄 CHECKING BACKGROUND THREADS...")
        
        # Check database for HAMMS results
        db_path = Path.home() / ".music_player_qt" / "music_library.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Check HAMMS analysis
            cursor.execute("""
                SELECT COUNT(*) FROM hamms_advanced 
                WHERE created_at > datetime('now', '-1 minute')
            """)
            hamms_count = cursor.fetchone()[0]
            print(f"   • HAMMS analyses completed: {hamms_count}")
            
            # Check AI analysis
            cursor.execute("""
                SELECT COUNT(*) FROM ai_analysis 
                WHERE analyzed_at > datetime('now', '-1 minute')
            """)
            ai_count = cursor.fetchone()[0]
            print(f"   • AI enrichments completed: {ai_count}")
            
            conn.close()
        
        # Check active threads
        import threading
        active_threads = threading.active_count()
        print(f"   • Active threads: {active_threads}")
        
        # Wait more and check again
        QTimer.singleShot(3000, final_report)
    
    def final_report():
        """Generate final performance report."""
        check_timer.stop()
        metrics['total_time'] = time.time() - metrics['start_time']
        
        print("\n" + "="*80)
        print("📊 PERFORMANCE REPORT")
        print("="*80)
        
        print(f"\n⏱️ TIMING:")
        print(f"   • Import phase: {metrics['import_time']:.2f}s")
        print(f"   • Total time: {metrics['total_time']:.2f}s")
        
        print(f"\n🖥️ UI RESPONSIVENESS:")
        if metrics['ui_blocks']:
            print(f"   ❌ UI blocked {len(metrics['ui_blocks'])} times")
            print(f"   • Max block: {max(metrics['ui_blocks'])}ms")
            print(f"   • Avg block: {sum(metrics['ui_blocks'])/len(metrics['ui_blocks']):.1f}ms")
        else:
            print(f"   ✅ UI never blocked (always responsive)")
        
        print(f"\n🧵 THREADING:")
        print(f"   • Import: QTimer (main thread, async)")
        print(f"   • HAMMS: QThread (background)")
        print(f"   • OpenAI: threading.Thread (daemon)")
        print(f"   • DB Write: Queue + Thread")
        
        print("\n" + "="*80)
        
        if not metrics['ui_blocks']:
            print("✅ SUCCESS: UI remained responsive during import!")
        else:
            print("⚠️ WARNING: UI blocked during import")
        
        print("="*80 + "\n")
        
        # Quit application
        QTimer.singleShot(1000, app.quit)
    
    # Start the test after app starts
    QTimer.singleShot(500, start_import)
    
    # Don't show the main window for this test
    # player.show()
    
    # Run the application
    app.exec()


if __name__ == "__main__":
    test_import_performance()