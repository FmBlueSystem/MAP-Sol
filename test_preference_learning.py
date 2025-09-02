#!/usr/bin/env python3
"""
Test script for preference learning system.
Tests the complete flow of learning from edits and applying preferences.
"""

import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'src'))
sys.path.insert(0, str(Path(__file__).parent))

from database import MusicDatabase
from playlist_generation.playlist_generator import PlaylistGenerator
from playlist_generation.playlist_learner import PlaylistLearner


def test_preference_learning():
    """Test the preference learning system."""
    print("=" * 60)
    print("PREFERENCE LEARNING TEST")
    print("=" * 60)
    
    # Initialize components
    db = MusicDatabase()
    generator = PlaylistGenerator(db.db_path)
    learner = PlaylistLearner(db)
    
    # Ensure the preferences table exists with correct schema
    try:
        db.conn.execute('''
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preference_type TEXT NOT NULL,
                preference_data TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(preference_type)
            )
        ''')
        db.conn.commit()
        print("✓ Preferences table ready")
    except Exception as e:
        print(f"! Table creation issue: {e}")
    
    # Step 1: Generate initial playlist
    print("\n1. Generating initial playlist...")
    try:
        # Use hybrid type to test preference application
        initial_playlist = generator.generate(
            duration_minutes=30,
            playlist_type='hybrid',
            constraints={
                'bpm_range': (120, 130),
                'weights': {'harmonic': 0.6, 'ai': 0.4}
            }
        )
        
        if not initial_playlist:
            print("! No tracks found. Adding test data...")
            # Add some test tracks if database is empty
            _add_test_tracks(db)
            initial_playlist = generator.generate(
                duration_minutes=30,
                playlist_type='hybrid',
                constraints={
                    'bpm_range': (120, 130),
                    'weights': {'harmonic': 0.6, 'ai': 0.4}
                }
            )
        
        print(f"✓ Generated {len(initial_playlist)} tracks")
        
        # Show first few tracks
        for i, track in enumerate(initial_playlist[:3]):
            print(f"  {i+1}. {track.get('title', 'Unknown')} - "
                  f"BPM: {track.get('bpm', 0):.1f}, "
                  f"Key: {track.get('camelot_key', 'N/A')}")
    
    except Exception as e:
        print(f"✗ Generation failed: {e}")
        return
    
    # Step 2: Simulate user edits
    print("\n2. Simulating user edits...")
    edited_playlist = initial_playlist.copy()
    
    # Simulate edits: remove middle track, swap two tracks
    if len(edited_playlist) >= 4:
        # Remove a track (user didn't like the transition)
        removed_track = edited_playlist.pop(len(edited_playlist) // 2)
        print(f"  - Removed: {removed_track.get('title', 'Unknown')}")
        
        # Swap two tracks (user prefers different order)
        if len(edited_playlist) >= 3:
            edited_playlist[1], edited_playlist[2] = edited_playlist[2], edited_playlist[1]
            print(f"  - Swapped positions 2 and 3")
    
    # Step 3: Learn from edits
    print("\n3. Learning from edits...")
    try:
        deltas = learner.learn_from_edits(initial_playlist, edited_playlist)
        print(f"✓ Calculated preference deltas:")
        for key, value in deltas.items():
            if value != 0:
                print(f"  {key}: {value:+.3f}")
        
        # Update preferences
        if any(v != 0 for v in deltas.values()):
            success = learner.update_preferences(deltas)
            if success:
                print("✓ Preferences updated in database")
            else:
                print("! Failed to update preferences")
    
    except Exception as e:
        print(f"✗ Learning failed: {e}")
    
    # Step 4: Get current preferences
    print("\n4. Current user preferences:")
    try:
        prefs = learner.get_preferences()
        for key, value in prefs.items():
            print(f"  {key}: {value:.3f}")
    except Exception as e:
        print(f"✗ Failed to get preferences: {e}")
    
    # Step 5: Generate new playlist with learned preferences
    print("\n5. Generating new playlist with learned preferences...")
    try:
        # Apply preferences to generation
        new_playlist = generator.generate(
            duration_minutes=30,
            playlist_type='hybrid',
            constraints={
                'bpm_range': (120, 130),
                'weights': {'harmonic': 0.6, 'ai': 0.4}
            }
        )
        
        print(f"✓ Generated {len(new_playlist)} tracks with preferences applied")
        
        # Show first few tracks
        for i, track in enumerate(new_playlist[:3]):
            score = track.get('transition_score', 0)
            print(f"  {i+1}. {track.get('title', 'Unknown')} - "
                  f"Score: {score:.3f}")
    
    except Exception as e:
        print(f"✗ Generation with preferences failed: {e}")
    
    # Step 6: Test playback learning
    print("\n6. Testing playback learning...")
    try:
        # Simulate skip events
        skip_events = [
            {'position': 2, 'reason': 'user_skip'},  # Skipped track 3
            {'position': 4, 'reason': 'user_skip'}   # Skipped track 5
        ]
        
        playback_deltas = learner.learn_from_playback(new_playlist, skip_events)
        print(f"✓ Learned from skip patterns:")
        for key, value in playback_deltas.items():
            if value != 0:
                print(f"  {key}: {value:+.3f}")
    
    except Exception as e:
        print(f"✗ Playback learning failed: {e}")
    
    print("\n" + "=" * 60)
    print("PREFERENCE LEARNING TEST COMPLETE")
    print("=" * 60)


def _add_test_tracks(db):
    """Add test tracks to database if empty."""
    test_tracks = [
        {
            'filepath': '/test/track1.mp3',
            'title': 'Test Track 1',
            'artist': 'Test Artist',
            'duration': 240,
            'bpm': 125.0,
            'camelot_key': '8A',
            'energy_level': 7
        },
        {
            'filepath': '/test/track2.mp3',
            'title': 'Test Track 2',
            'artist': 'Test Artist',
            'duration': 230,
            'bpm': 124.0,
            'camelot_key': '8B',
            'energy_level': 6
        },
        {
            'filepath': '/test/track3.mp3',
            'title': 'Test Track 3',
            'artist': 'Test Artist',
            'duration': 250,
            'bpm': 126.0,
            'camelot_key': '9A',
            'energy_level': 8
        },
        {
            'filepath': '/test/track4.mp3',
            'title': 'Test Track 4',
            'artist': 'Test Artist',
            'duration': 235,
            'bpm': 128.0,
            'camelot_key': '3A',
            'energy_level': 7
        },
        {
            'filepath': '/test/track5.mp3',
            'title': 'Test Track 5',
            'artist': 'Test Artist',
            'duration': 245,
            'bpm': 122.0,
            'camelot_key': '3B',
            'energy_level': 5
        }
    ]
    
    for track in test_tracks:
        try:
            db.conn.execute('''
                INSERT OR IGNORE INTO tracks 
                (filepath, title, artist, duration, bpm, camelot_key, energy_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                track['filepath'],
                track['title'],
                track['artist'],
                track['duration'],
                track['bpm'],
                track['camelot_key'],
                track['energy_level']
            ))
        except Exception as e:
            print(f"  ! Failed to add test track: {e}")
    
    db.conn.commit()
    print(f"  Added {len(test_tracks)} test tracks")


if __name__ == "__main__":
    test_preference_learning()