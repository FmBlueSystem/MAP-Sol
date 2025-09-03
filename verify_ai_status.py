#!/usr/bin/env python3
"""
Quick verification of AI system status and configuration.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def check_status():
    print("\n" + "="*60)
    print("   🔍 AI SYSTEM STATUS CHECK")
    print("="*60)
    
    # 1. Check OpenAI API Key
    api_key = os.getenv('OPENAI_API_KEY')
    if api_key:
        print(f"\n✅ OpenAI API Key: Configured (sk-proj-...{api_key[-8:]})")
    else:
        print("\n❌ OpenAI API Key: Not found in environment")
    
    # 2. Check Chromaprint
    import subprocess
    try:
        result = subprocess.run(['fpcalc', '-v'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Chromaprint: Installed (fpcalc available)")
        else:
            print("❌ Chromaprint: Not working properly")
    except FileNotFoundError:
        print("❌ Chromaprint: Not installed (brew install chromaprint)")
    
    # 3. Check Librosa
    try:
        import librosa
        print(f"✅ Librosa: Installed (version {librosa.__version__})")
    except ImportError:
        print("❌ Librosa: Not installed")
    
    # 4. Check Cache Database
    cache_db = Path.home() / ".music_player_qt" / "cache" / "openai_cache.db"
    if cache_db.exists():
        import sqlite3
        conn = sqlite3.connect(str(cache_db))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cache")
        count = cursor.fetchone()[0]
        cursor.execute("SELECT SUM(hit_count * cost_estimate) FROM cache WHERE hit_count > 0")
        saved = cursor.fetchone()[0] or 0
        conn.close()
        print(f"✅ Cache Database: Active ({count} entries, ${saved:.2f} saved)")
    else:
        print("✅ Cache Database: Will be created on first use")
    
    # 5. Check Music Database
    db_path = Path.home() / ".music_player_qt" / "music_library.db"
    if db_path.exists():
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check ai_analysis table
        cursor.execute("PRAGMA table_info(ai_analysis)")
        columns = cursor.fetchall()
        ai_fields = len(columns)
        
        # Check for new fields
        column_names = [col[1] for col in columns]
        new_fields = ['dj_notes', 'cultural_context', 'production_quality', 
                      'vocal_characteristics', 'instrumentation', 'audio_fingerprint']
        has_new = all(f in column_names for f in new_fields)
        
        if has_new:
            print(f"✅ Database Schema: Updated ({ai_fields} fields in ai_analysis)")
        else:
            print(f"⚠️  Database Schema: Needs upgrade (run scripts/upgrade_ai_table.py)")
        
        conn.close()
    else:
        print("ℹ️  Database: Not yet created (will be created on first run)")
    
    # 6. Test OpenAI Connection
    if api_key:
        print("\n🔄 Testing OpenAI connection...")
        try:
            from ai_analysis.metadata_enrichment_openai import MetadataEnrichmentOpenAI
            enricher = MetadataEnrichmentOpenAI()
            if enricher.enabled:
                print(f"✅ OpenAI: Connected (Model: {enricher.model})")
                
                # Check cache stats
                stats = enricher.cache.get_stats()
                if stats['total_entries'] > 0:
                    print(f"   Cache: {stats['total_entries']} entries, "
                          f"{stats['total_hits']} hits, ${stats['total_cost_saved']:.2f} saved")
            else:
                print("❌ OpenAI: Not enabled (check configuration)")
        except Exception as e:
            print(f"❌ OpenAI: Error - {e}")
    
    print("\n" + "="*60)
    print("\n📋 SUMMARY:")
    
    # Overall readiness
    essential_ok = api_key is not None
    if essential_ok:
        print("✅ AI enrichment system is READY")
        print("   - OpenAI will enrich metadata on import")
        print("   - Cache will optimize API costs")
    else:
        print("⚠️  AI enrichment needs configuration")
        print("   - Set OPENAI_API_KEY in .env file")
    
    print("\n💡 Optional enhancements:")
    print("   - Install chromaprint for audio fingerprinting")
    print("   - Install librosa for vocal/instrument analysis")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    check_status()