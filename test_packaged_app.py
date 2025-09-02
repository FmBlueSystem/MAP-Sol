#!/usr/bin/env python3
"""
Test script to verify packaged app functionality
"""
import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

def test_imports():
    """Test that all critical imports work"""
    print("Testing imports...")
    try:
        from utils.paths import resource_path, data_path, get_config_path, get_database_path
        print("✓ utils.paths imported")
        
        from database import MusicDatabase
        print("✓ database imported")
        
        import music_player
        print("✓ music_player imported")
        
        from app import MusicAnalyzerApp
        print("✓ app imported")
        
        from playlist_generation.playlist_wizard import PlaylistGeneratorDialog
        print("✓ playlist_wizard imported")
        
        from analytics.metrics import LibraryMetrics
        print("✓ analytics.metrics imported")
        
        from ui.analytics_dashboard import AnalyticsDashboardWidget
        print("✓ analytics_dashboard imported")
        
        from telemetry.telemetry import Telemetry
        print("✓ telemetry imported")
        
        return True
    except ImportError as e:
        print(f"✗ Import failed: {e}")
        return False

def test_paths():
    """Test path resolution in frozen and dev environments"""
    print("\nTesting path resolution...")
    from utils.paths import resource_path, data_path, get_config_path, get_database_path
    
    # Check if running frozen
    is_frozen = getattr(sys, 'frozen', False)
    print(f"Running frozen: {is_frozen}")
    
    if is_frozen:
        print(f"_MEIPASS: {getattr(sys, '_MEIPASS', 'Not found')}")
    
    # Test resource path
    res_path = resource_path('resources', 'icon.png')
    print(f"Resource path: {res_path}")
    print(f"  Exists: {res_path.exists()}")
    
    # Test data path
    data_dir = data_path()
    print(f"Data path: {data_dir}")
    print(f"  Exists: {data_dir.exists()}")
    
    # Test config path
    config = get_config_path()
    print(f"Config path: {config}")
    
    # Test database path
    db_path = get_database_path()
    print(f"Database path: {db_path}")
    
    return True

def test_telemetry():
    """Test telemetry initialization"""
    print("\nTesting telemetry...")
    from telemetry.telemetry import Telemetry
    
    # Create instance
    t = Telemetry()
    print(f"Telemetry enabled: {t._enabled}")
    print(f"Log path: {t.log_path}")
    
    # Try tracking an event (won't actually log if disabled)
    t.track('test_event', {'test': 'value'})
    print("✓ Telemetry test event tracked")
    
    return True

def test_database():
    """Test database initialization"""
    print("\nTesting database...")
    from database import MusicDatabase
    from utils.paths import get_database_path
    
    db_path = get_database_path('test_packaged.db')
    print(f"Test DB path: {db_path}")
    
    db = MusicDatabase(str(db_path))
    print("✓ Database initialized")
    
    # Clean up test database
    if db_path.exists():
        db_path.unlink()
        print("✓ Test database cleaned up")
    
    return True

def main():
    """Run all tests"""
    print("=" * 50)
    print("Music Analyzer Pro - Packaging Test")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_paths,
        test_telemetry,
        test_database
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    if all(results):
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())