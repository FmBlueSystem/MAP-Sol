#!/usr/bin/env python3
"""
Debug HAMMS data visibility in the metadata viewer
"""

import sqlite3
import json
from pathlib import Path

def debug_hamms_viewer():
    """Debug why HAMMS data might not be showing in viewer"""
    
    db_path = Path.home() / '.music_player_qt' / 'music_library.db'
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(str(db_path))
    
    print("\n" + "=" * 80)
    print("🔍 DEBUG: HAMMS VIEWER DATA LOADING")
    print("=" * 80)
    
    # Test the exact query used by metadata viewer
    print("\n1️⃣ Testing metadata viewer HAMMS query...")
    cursor = conn.execute("""
        SELECT h.file_id, t.title, t.artist, h.vector_12d,
               h.tempo_stability, h.harmonic_complexity, 
               h.dynamic_range, h.ml_confidence
        FROM hamms_advanced h
        INNER JOIN tracks t ON h.file_id = t.id
        WHERE h.vector_12d IS NOT NULL
    """)
    
    hamms_results = cursor.fetchall()
    print(f"   Query returned {len(hamms_results)} rows")
    
    if hamms_results:
        for i, row in enumerate(hamms_results):
            file_id, title, artist, vector_json, tempo_stab, harm_comp, dyn_range, ml_conf = row
            
            print(f"\n   Row {i+1}:")
            print(f"     • File ID: {file_id}")
            print(f"     • Title: {title}")
            print(f"     • Artist: {artist}")
            print(f"     • Vector JSON length: {len(vector_json) if vector_json else 0}")
            print(f"     • Tempo Stability: {tempo_stab}")
            print(f"     • Harmonic Complexity: {harm_comp}")
            print(f"     • Dynamic Range: {dyn_range}")
            print(f"     • ML Confidence: {ml_conf}")
            
            # Test vector parsing
            if vector_json:
                try:
                    vector = json.loads(vector_json)
                    print(f"     • Vector parsed: ✅ {len(vector)} dimensions")
                    print(f"     • Vector range: [{min(vector):.3f}, {max(vector):.3f}]")
                    
                    # Show first few dimensions
                    dimension_names = [
                        "BPM", "Key", "Energy", "Danceability", "Valence",
                        "Acousticness", "Instrumentalness", "Rhythmic"
                    ]
                    
                    print(f"     • First 8 dimensions:")
                    for j, (name, val) in enumerate(zip(dimension_names, vector[:8])):
                        print(f"       {j+1:2d}. {name:15} = {val:.3f}")
                        
                except Exception as e:
                    print(f"     • Vector parsing: ❌ Error: {e}")
            else:
                print(f"     • Vector: ❌ NULL")
    else:
        print("   ❌ No HAMMS data found!")
        
        # Check if tracks exist
        cursor = conn.execute("SELECT COUNT(*) FROM tracks")
        track_count = cursor.fetchone()[0]
        print(f"   Total tracks in database: {track_count}")
        
        # Check if hamms_advanced table exists
        cursor = conn.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='hamms_advanced'
        """)
        table_exists = cursor.fetchone()
        print(f"   hamms_advanced table exists: {'✅' if table_exists else '❌'}")
        
        if table_exists:
            # Check if there's any data in hamms_advanced
            cursor = conn.execute("SELECT COUNT(*) FROM hamms_advanced")
            hamms_count = cursor.fetchone()[0]
            print(f"   Records in hamms_advanced: {hamms_count}")
            
            if hamms_count > 0:
                # Check if vector_12d is populated
                cursor = conn.execute("SELECT COUNT(*) FROM hamms_advanced WHERE vector_12d IS NOT NULL")
                vector_count = cursor.fetchone()[0]
                print(f"   Records with vector_12d: {vector_count}")
    
    # Test MixedInKey query
    print("\n2️⃣ Testing MixedInKey query...")
    cursor = conn.execute("""
        SELECT t.title, t.artist, t.bpm, t.initial_key, t.energy_level
        FROM tracks t
        ORDER BY t.date_added DESC
    """)
    
    mixedinkey_results = cursor.fetchall()
    print(f"   Query returned {len(mixedinkey_results)} rows")
    
    mixedinkey_count = 0
    for row in mixedinkey_results:
        title, artist, bpm, key, energy = row
        
        # Check if this has MixedInKey data (Camelot key notation)
        if key and len(key) <= 3 and (key.endswith('A') or key.endswith('B')):
            mixedinkey_count += 1
            print(f"     • {artist} - {title}: {key}, {bpm} BPM, Energy {energy}")
    
    print(f"   MixedInKey tracks found: {mixedinkey_count}")
    
    # Test basic tracks query
    print("\n3️⃣ Testing tracks overview query...")
    cursor = conn.execute("""
        SELECT id, title, artist, album, bpm, initial_key, 
               energy_level, duration, file_path, date_added
        FROM tracks
        ORDER BY date_added DESC
    """)
    
    tracks_results = cursor.fetchall()
    print(f"   Query returned {len(tracks_results)} rows")
    
    for i, row in enumerate(tracks_results):
        track_id, title, artist, album, bpm, key, energy, duration, path, date_added = row
        print(f"     {i+1}. ID:{track_id} {artist} - {title} | {key} | {bpm} BPM | Energy {energy}")
    
    conn.close()
    
    print("\n" + "=" * 80)
    print("✅ DEBUG COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    debug_hamms_viewer()