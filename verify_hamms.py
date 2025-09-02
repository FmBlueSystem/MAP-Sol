#!/usr/bin/env python3
"""
Verify HAMMS calculation and database storage
"""

import sqlite3
import json
from pathlib import Path
import numpy as np

def verify_hamms():
    """Verify HAMMS vectors in database"""
    
    db_path = Path.home() / '.music_player_qt' / 'music_library.db'
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(str(db_path))
    
    print("\n" + "=" * 80)
    print("🧬 HAMMS VECTOR VERIFICATION")
    print("=" * 80)
    
    # Get all tracks with HAMMS vectors
    cursor = conn.execute("""
        SELECT t.id, t.title, t.artist, t.bpm, t.initial_key, t.energy_level, h.vector_12d
        FROM tracks t
        LEFT JOIN hamms_advanced h ON t.id = h.file_id
        ORDER BY t.id
    """)
    
    tracks = cursor.fetchall()
    
    print(f"\n📊 Found {len(tracks)} tracks in database\n")
    
    for track_id, title, artist, bpm, key, energy, vector_json in tracks:
        print(f"\n{'='*60}")
        print(f"Track ID: {track_id}")
        print(f"Title: {title or 'Unknown'}")
        print(f"Artist: {artist or 'Unknown'}")
        print(f"BPM: {bpm or 'N/A'}")
        print(f"Key: {key or 'N/A'}")
        print(f"Energy: {energy or 'N/A'}/10")
        
        # Check for MixedInKey data
        if key and (key.endswith('A') or key.endswith('B')):
            print("Source: ✅ MixedInKey")
        else:
            print("Source: 🤖 Calculated")
        
        # Check HAMMS vector
        if vector_json:
            vector = np.array(json.loads(vector_json))
            print(f"\n🧬 HAMMS Vector: ✅ Present")
            print(f"   Shape: {vector.shape}")
            print(f"   Range: [{vector.min():.3f}, {vector.max():.3f}]")
            
            # Validate dimensions
            if len(vector) >= 12:
                dims = ['BPM', 'Key', 'Energy', 'Dance', 'Valence', 'Acoustic',
                        'Instrumental', 'Rhythmic', 'Spectral', 'Stability', 
                        'Harmonic', 'Dynamic']
                
                print("\n   Dimensions:")
                for i, (dim, val) in enumerate(zip(dims, vector[:12])):
                    bar_length = int(val * 20)
                    bar = '█' * bar_length + '░' * (20 - bar_length)
                    print(f"   {dim:12} [{bar}] {val:.3f}")
                
                # Check validity
                if np.all((vector >= 0) & (vector <= 1)):
                    print("\n   ✅ All dimensions valid [0,1]")
                else:
                    invalid = np.where((vector < 0) | (vector > 1))[0]
                    print(f"\n   ❌ Invalid dimensions at indices: {invalid}")
            else:
                print(f"   ❌ Vector too short: {len(vector)} dimensions")
        else:
            print("\n🧬 HAMMS Vector: ❌ Missing")
    
    # Summary statistics
    cursor = conn.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(h.vector_12d) as with_hamms,
            COUNT(CASE WHEN t.initial_key LIKE '%A' OR t.initial_key LIKE '%B' THEN 1 END) as mixedinkey
        FROM tracks t
        LEFT JOIN hamms_advanced h ON t.id = h.file_id
    """)
    
    total, with_hamms, mixedinkey = cursor.fetchone()
    
    print("\n" + "=" * 80)
    print("📈 SUMMARY:")
    print(f"   Total tracks: {total}")
    print(f"   With HAMMS vectors: {with_hamms} ({100*with_hamms/total if total else 0:.1f}%)")
    print(f"   MixedInKey data: {mixedinkey} tracks")
    print(f"   Calculated data: {total - mixedinkey} tracks")
    print("=" * 80)
    
    conn.close()

if __name__ == "__main__":
    verify_hamms()