#!/usr/bin/env python3
"""
Setup and test OpenAI metadata enrichment for Music Analyzer Pro.
This configures the OpenAI integration and tests the enrichment pipeline.
"""

import os
import sys
from pathlib import Path
import sqlite3
import json

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from ai_analysis.metadata_enrichment_openai import MetadataEnrichmentOpenAI
from utils.logger import setup_logger

logger = setup_logger(__name__)


def check_openai_setup():
    """Check if OpenAI is properly configured."""
    print("\n=== OpenAI Enrichment Setup ===\n")
    
    # Check for OpenAI library
    try:
        import openai
        print("✅ OpenAI library installed")
    except ImportError:
        print("❌ OpenAI library not installed")
        print("   Install with: pip install openai")
        return False
    
    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        print(f"✅ OpenAI API key found (starts with: {api_key[:7]}...)")
    else:
        print("❌ OpenAI API key not found")
        print("   Set environment variable: export OPENAI_API_KEY='your-key-here'")
        return False
    
    # Test connection
    try:
        enricher = MetadataEnrichmentOpenAI()
        if enricher.enabled:
            print("✅ OpenAI client initialized successfully")
            return True
        else:
            print("❌ OpenAI client failed to initialize")
            return False
    except Exception as e:
        print(f"❌ Error initializing OpenAI: {e}")
        return False


def test_enrichment():
    """Test the enrichment with a sample track."""
    print("\n=== Testing Enrichment ===\n")
    
    # Sample track data
    track_data = {
        "title": "Test Track",
        "artist": "Test Artist",
        "album": "Test Album",
        "year": 2024,
        "duration": 210,
        "file_path": "/path/to/test.mp3"
    }
    
    # Sample HAMMS data
    hamms_data = {
        "bpm": 128,
        "key": "8A",
        "energy_level": 7
    }
    
    print(f"Testing with track: {track_data['title']} by {track_data['artist']}")
    print(f"HAMMS data: BPM={hamms_data['bpm']}, Key={hamms_data['key']}, Energy={hamms_data['energy_level']}/10")
    
    try:
        enricher = MetadataEnrichmentOpenAI()
        result = enricher.enrich_track(track_data, hamms_data)
        
        print("\n=== Enrichment Results ===\n")
        print(json.dumps(result, indent=2))
        
        if result.get("enrichment_metadata", {}).get("method") == "openai":
            print("\n✅ OpenAI enrichment successful!")
        else:
            print("\n⚠️ Fallback enrichment used (OpenAI not available)")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Enrichment failed: {e}")
        return False


def enrich_existing_tracks(limit=5):
    """Enrich existing tracks in the database."""
    print(f"\n=== Enriching Existing Tracks (limit={limit}) ===\n")
    
    db_path = Path.home() / ".music_player_qt" / "music_library.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    try:
        enricher = MetadataEnrichmentOpenAI()
        
        if not enricher.enabled:
            print("❌ OpenAI not enabled. Check your setup.")
            return
        
        # Enrich tracks
        count = enricher.batch_enrich(str(db_path), limit=limit)
        print(f"\n✅ Enriched {count} tracks successfully!")
        
        # Show sample results
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        results = cursor.execute("""
            SELECT t.title, t.artist, a.genre, a.subgenre, a.mood, a.tags
            FROM tracks t
            JOIN ai_analysis a ON t.id = a.track_id
            ORDER BY a.analysis_date DESC
            LIMIT 3
        """).fetchall()
        
        if results:
            print("\n=== Sample Enriched Tracks ===")
            for title, artist, genre, subgenre, mood, tags in results:
                print(f"\n📀 {title} - {artist}")
                print(f"   Genre: {genre} ({subgenre})")
                print(f"   Mood: {mood}")
                if tags:
                    tag_list = json.loads(tags)
                    print(f"   Tags: {', '.join(tag_list[:5])}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error enriching tracks: {e}")


def setup_config_file():
    """Create a configuration file template for OpenAI settings."""
    config_path = Path(__file__).parent / "config_openai.yaml"
    
    config_template = """# OpenAI Configuration for Music Analyzer Pro
# Copy this to config_openai.yaml and add your API key

openai:
  # Your OpenAI API key (get from https://platform.openai.com/api-keys)
  api_key: "sk-..."  # Replace with your actual key
  
  # Model to use (gpt-4, gpt-3.5-turbo, etc.)
  model: "gpt-4"
  
  # Enable/disable enrichment
  enabled: true
  
  # Maximum tracks to enrich per import session
  batch_limit: 10
  
  # Features to enable
  features:
    genre_classification: true
    mood_analysis: true
    lyrics_analysis: true
    context_extraction: true
    dj_mixing_notes: true
    quality_scoring: true

# Enrichment settings
enrichment:
  # Automatically enrich on import
  auto_enrich: true
  
  # Only enrich tracks with these characteristics
  filters:
    min_duration: 60  # seconds
    require_hamms: true  # Only enrich after HAMMS analysis
    
  # Cache settings
  cache:
    enabled: true
    ttl: 86400  # seconds (24 hours)
"""
    
    if not config_path.exists():
        config_path.write_text(config_template)
        print(f"\n✅ Created config template at: {config_path}")
        print("   Edit this file and add your OpenAI API key")
    else:
        print(f"\n⚠️ Config file already exists at: {config_path}")


def main():
    """Main setup and test routine."""
    print("=" * 50)
    print("  Music Analyzer Pro - OpenAI Enrichment Setup")
    print("=" * 50)
    
    # Check setup
    if not check_openai_setup():
        print("\n⚠️ Please complete the setup steps above and try again.")
        print("\nQuick setup:")
        print("1. pip install openai")
        print("2. export OPENAI_API_KEY='your-api-key'")
        print("3. python setup_openai_enrichment.py")
        return
    
    # Create config file
    setup_config_file()
    
    # Test enrichment
    print("\nWould you like to test the enrichment? (y/n): ", end="")
    if input().lower() == 'y':
        if test_enrichment():
            print("\nWould you like to enrich existing tracks? (y/n): ", end="")
            if input().lower() == 'y':
                print("How many tracks? (default 5): ", end="")
                limit_input = input().strip()
                limit = int(limit_input) if limit_input.isdigit() else 5
                enrich_existing_tracks(limit)
    
    print("\n✅ Setup complete!")
    print("\nNext steps:")
    print("1. Import new music - enrichment will happen automatically")
    print("2. View enriched metadata in the app")
    print("3. Use advanced search with genre, mood, and context filters")


if __name__ == "__main__":
    main()