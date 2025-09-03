#!/usr/bin/env python3
"""
Script to upgrade the ai_analysis table with missing fields.
This adds comprehensive fields for complete AI analysis storage.
"""

import sqlite3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))
from utils.logger import setup_logger

logger = setup_logger(__name__)


def upgrade_ai_analysis_table():
    """Add missing columns to ai_analysis table."""
    
    db_path = Path.home() / ".music_player_qt" / "music_library.db"
    
    if not db_path.exists():
        logger.error(f"Database not found at: {db_path}")
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Get existing columns
        cursor.execute("PRAGMA table_info(ai_analysis)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        # Define new columns to add
        new_columns = [
            ("dj_notes", "TEXT", "DJ-specific mixing notes and recommendations"),
            ("cultural_context", "TEXT", "Cultural and geographic context (JSON)"),
            ("production_quality", "REAL", "Production quality score 0-10"),
            ("commercial_potential", "REAL", "Commercial potential score 0-10"),
            ("mixing_compatibility", "TEXT", "Compatibility matrix with other tracks (JSON)"),
            ("harmonic_profile", "TEXT", "Detailed harmonic analysis (JSON)"),
            ("vocal_characteristics", "TEXT", "Vocal analysis - gender, style, etc (JSON)"),
            ("instrumentation", "TEXT", "Main instruments detected (JSON)"),
            ("dynamic_range", "REAL", "Dynamic range in dB"),
            ("loudness_integrated", "REAL", "Integrated loudness in LUFS"),
            ("true_peak", "REAL", "True peak level in dBFS"),
            ("mastering_style", "TEXT", "Mastering characteristics"),
            ("remix_type", "TEXT", "Original, Remix, Radio Edit, Extended, etc"),
            ("confidence_scores", "TEXT", "Confidence scores for each analysis (JSON)"),
            ("audio_fingerprint", "TEXT", "Audio fingerprint for duplicate detection"),
            ("external_ids", "TEXT", "Spotify, MusicBrainz, Discogs IDs (JSON)"),
            ("popularity_score", "REAL", "Predicted popularity 0-100"),
            ("trend_analysis", "TEXT", "Trend and zeitgeist analysis (JSON)"),
            ("sample_detection", "TEXT", "Detected samples and references (JSON)"),
            ("cache_timestamp", "TIMESTAMP", "When cached for cost optimization")
        ]
        
        added_count = 0
        
        for column_name, column_type, description in new_columns:
            if column_name not in existing_columns:
                try:
                    # Add the column
                    alter_query = f"ALTER TABLE ai_analysis ADD COLUMN {column_name} {column_type}"
                    cursor.execute(alter_query)
                    logger.info(f"Added column: {column_name} ({column_type}) - {description}")
                    added_count += 1
                except sqlite3.OperationalError as e:
                    logger.warning(f"Could not add column {column_name}: {e}")
            else:
                logger.debug(f"Column {column_name} already exists")
        
        # Create additional indices for performance
        indices = [
            ("idx_ai_dj_notes", "dj_notes"),
            ("idx_ai_production_quality", "production_quality"),
            ("idx_ai_commercial_potential", "commercial_potential"),
            ("idx_ai_popularity", "popularity_score"),
            ("idx_ai_remix_type", "remix_type"),
            ("idx_ai_cache", "cache_timestamp")
        ]
        
        for index_name, column_name in indices:
            try:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON ai_analysis({column_name})")
                logger.info(f"Created index: {index_name}")
            except Exception as e:
                logger.warning(f"Could not create index {index_name}: {e}")
        
        # Create compound indices for common queries
        compound_indices = [
            ("idx_ai_genre_mood", "genre, mood"),
            ("idx_ai_quality_scores", "production_quality, commercial_potential"),
            ("idx_ai_mixing", "dj_notes, mixing_compatibility")
        ]
        
        for index_name, columns in compound_indices:
            try:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON ai_analysis({columns})")
                logger.info(f"Created compound index: {index_name}")
            except Exception as e:
                logger.warning(f"Could not create compound index {index_name}: {e}")
        
        conn.commit()
        
        # Show final structure
        cursor.execute("PRAGMA table_info(ai_analysis)")
        final_columns = cursor.fetchall()
        
        print("\n=== UPDATED AI_ANALYSIS TABLE STRUCTURE ===")
        print(f"Total columns: {len(final_columns)}")
        print("\nColumns:")
        for col in final_columns:
            print(f"  - {col[1]} ({col[2]})")
        
        print(f"\n✅ Successfully added {added_count} new columns")
        
        return True
        
    except Exception as e:
        logger.error(f"Error upgrading table: {e}")
        return False
    
    finally:
        conn.close()


def verify_upgrade():
    """Verify the upgrade was successful."""
    
    db_path = Path.home() / ".music_player_qt" / "music_library.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check column count
        cursor.execute("PRAGMA table_info(ai_analysis)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        required_fields = [
            'dj_notes', 'cultural_context', 'production_quality',
            'commercial_potential', 'mixing_compatibility', 'harmonic_profile'
        ]
        
        missing = [f for f in required_fields if f not in column_names]
        
        if missing:
            print(f"\n⚠️ Missing fields: {missing}")
            return False
        else:
            print("\n✅ All required fields are present")
            return True
            
    finally:
        conn.close()


def main():
    """Main upgrade routine."""
    print("=" * 60)
    print("  AI Analysis Table Upgrade Script")
    print("=" * 60)
    
    print("\nThis will add comprehensive AI analysis fields to the database.")
    print("The upgrade is non-destructive and preserves existing data.\n")
    
    print("Proceed with upgrade? (y/n): ", end="")
    if input().lower() != 'y':
        print("Upgrade cancelled.")
        return
    
    print("\nUpgrading database...")
    if upgrade_ai_analysis_table():
        print("\nVerifying upgrade...")
        if verify_upgrade():
            print("\n✅ Database upgrade completed successfully!")
            print("\nNew capabilities added:")
            print("- DJ mixing notes and recommendations")
            print("- Cultural context analysis")
            print("- Production quality scoring")
            print("- Commercial potential prediction")
            print("- Harmonic profiling")
            print("- Vocal characteristics analysis")
            print("- Audio fingerprinting")
            print("- External service IDs")
            print("- Trend analysis")
            print("- And more...")
        else:
            print("\n⚠️ Upgrade completed but verification failed")
    else:
        print("\n❌ Upgrade failed")


if __name__ == "__main__":
    main()