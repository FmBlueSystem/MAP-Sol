#!/usr/bin/env python3
"""
Show ALL metadata in the database - comprehensive view
"""

import sqlite3
import json
from pathlib import Path
from tabulate import tabulate
import numpy as np

def show_all_metadata():
    """Display all metadata from the database"""
    
    db_path = Path.home() / '.music_player_qt' / 'music_library.db'
    
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(str(db_path))
    
    print("\n" + "=" * 80)
    print("📊 COMPLETE METADATA ANALYSIS - ALL REAL DATA")
    print("=" * 80)
    
    # 1. TRACK OVERVIEW
    print("\n📋 TRACK OVERVIEW:")
    print("-" * 80)
    
    cursor = conn.execute("""
        SELECT id, title, artist, bpm, initial_key, energy_level
        FROM tracks
        ORDER BY date_added DESC
    """)
    
    tracks = cursor.fetchall()
    
    if tracks:
        headers = ["ID", "Title", "Artist", "BPM", "Key", "Energy"]
        
        # Process tracks to identify source
        enhanced_tracks = []
        for track in tracks:
            track_list = list(track)
            # Determine source based on key notation
            if track[4] and (track[4].endswith('A') or track[4].endswith('B')):
                track_list.append("✅ MixedInKey")
            else:
                track_list.append("🤖 AI/Librosa")
            enhanced_tracks.append(track_list)
        
        headers.append("Source")
        print(tabulate(enhanced_tracks, headers=headers, tablefmt="grid"))
    else:
        print("No tracks found")
    
    # 2. MIXEDINKEY DATA
    print("\n🎹 MIXEDINKEY DATA (Professional DJ Analysis):")
    print("-" * 80)
    
    mixedinkey_tracks = []
    for track in tracks:
        # Check if has Camelot key (indicates MixedInKey)
        if track[4] and (track[4].endswith('A') or track[4].endswith('B')):
            mixedinkey_tracks.append([
                f"{track[2]} - {track[1]}",  # Artist - Title
                track[3],  # BPM
                track[4],  # Key (Camelot)
                f"{track[5]}/10" if track[5] else "N/A"  # Energy
            ])
    
    if mixedinkey_tracks:
        headers = ["Track", "BPM", "Camelot Key", "Energy"]
        print(tabulate(mixedinkey_tracks, headers=headers, tablefmt="grid"))
    else:
        print("No MixedInKey data found")
    
    # 3. HAMMS VECTORS
    print("\n🧬 HAMMS 12D VECTORS (Harmonic Mixing Analysis):")
    print("-" * 80)
    
    cursor = conn.execute("""
        SELECT t.title, t.artist, h.vector_12d
        FROM hamms_advanced h
        JOIN tracks t ON h.file_id = t.id
        WHERE h.vector_12d IS NOT NULL
    """)
    
    hamms_data = cursor.fetchall()
    
    if hamms_data:
        for title, artist, vector_json in hamms_data:
            print(f"\n📀 {artist} - {title}")
            
            if vector_json:
                vector = json.loads(vector_json)
                
                # Dimension names
                dims = [
                    "BPM", "Key", "Energy", "Dance",
                    "Valence", "Acoustic", "Instrumental", "Rhythmic",
                    "Spectral", "Tempo Stab", "Harmonic", "Dynamic"
                ]
                
                # Create visualization
                for i, (dim, val) in enumerate(zip(dims, vector[:12])):
                    bar_length = int(val * 20)
                    bar = '█' * bar_length + '░' * (20 - bar_length)
                    
                    # Color indicator
                    if val > 0.7:
                        indicator = "🟢"  # High
                    elif val > 0.4:
                        indicator = "🟡"  # Medium
                    else:
                        indicator = "🔴"  # Low
                    
                    print(f"  {indicator} {dim:12} [{bar}] {val:.3f}")
    else:
        print("No HAMMS vectors found")
    
    # 4. AUDIO FEATURES
    print("\n🎵 CALCULATED AUDIO FEATURES:")
    print("-" * 80)
    
    cursor = conn.execute("""
        SELECT t.title, h.tempo_stability, h.harmonic_complexity, h.dynamic_range
        FROM tracks t
        LEFT JOIN hamms_advanced h ON t.id = h.file_id
        WHERE h.tempo_stability IS NOT NULL
    """)
    
    features = cursor.fetchall()
    
    if features:
        headers = ["Track", "Tempo Stability", "Harmonic Complex", "Dynamic Range"]
        print(tabulate(features, headers=headers, tablefmt="grid", floatfmt=".3f"))
    else:
        print("No calculated features found")
    
    # 5. SUMMARY
    print("\n📈 DATABASE SUMMARY:")
    print("-" * 80)
    
    # Count statistics
    total_tracks = len(tracks)
    mixedinkey_count = len(mixedinkey_tracks)
    hamms_count = len(hamms_data)
    
    print(f"  • Total tracks: {total_tracks}")
    print(f"  • Tracks with MixedInKey data: {mixedinkey_count}")
    print(f"  • Tracks with AI analysis: {total_tracks - mixedinkey_count}")
    print(f"  • HAMMS vectors calculated: {hamms_count}")
    print(f"  • Analysis completion: {hamms_count}/{total_tracks} ({100*hamms_count/total_tracks if total_tracks else 0:.1f}%)")
    
    # Data sources breakdown
    print("\n🔍 DATA SOURCES:")
    print(f"  • MixedInKey (Professional): {mixedinkey_count} tracks")
    print(f"  • AI/Librosa (Calculated): {total_tracks - mixedinkey_count} tracks")
    
    conn.close()
    
    print("\n" + "=" * 80)
    print("✅ ALL METADATA DISPLAYED - NO SIMULATIONS")
    print("=" * 80)

if __name__ == "__main__":
    show_all_metadata()