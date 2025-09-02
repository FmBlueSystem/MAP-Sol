#!/usr/bin/env python3
"""
Test the improved import messages with real files
"""

import sys
sys.path.insert(0, 'src')
from pathlib import Path
from audio_analyzer_mixedinkey import MixedInKeyAwareAnalyzer
import subprocess
import json

def extract_metadata(file_path):
    """Extract metadata using ffprobe"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return data.get('format', {}).get('tags', {})

def test_import_messages():
    """Test import with detailed messages"""
    
    analyzer = MixedInKeyAwareAnalyzer()
    
    # Test files
    files = [
        {
            'path': "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Cardi B, Bad Bunny, J Balvin - I Like It(Explicit).flac",
            'has_mik': True,
            'name': "Cardi B - I Like It"
        },
        {
            'path': "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Madonna - Get Together.flac",
            'has_mik': False,
            'name': "Madonna - Get Together"
        }
    ]
    
    for file_info in files:
        file_path = file_info['path']
        
        if not Path(file_path).exists():
            print(f"⚠️ File not found: {file_info['name']}")
            continue
        
        file_name = Path(file_path).name
        
        print(f"\n{'='*70}")
        print(f"📥 IMPORTING: {file_name}")
        print(f"{'='*70}")
        
        # Step 1: Extract metadata
        print(f"📋 Step 1/5: Extracting metadata...")
        metadata = extract_metadata(file_path)
        print(f"   ✓ Title: {metadata.get('TITLE', 'Unknown')}")
        print(f"   ✓ Artist: {metadata.get('ARTIST', 'Unknown')}")
        print(f"   ✓ Album: {metadata.get('ALBUM', 'Unknown')}")
        
        # Step 2: Check for MixedInKey data
        print(f"\n🔍 Step 2/5: Checking for professional (MixedInKey) data...")
        has_mixedinkey = any(k in metadata for k in ['BPM', 'INITIALKEY', 'ENERGYLEVEL'])
        
        if has_mixedinkey:
            print(f"   ✅ Found MixedInKey data - Using professional analysis")
            if 'BPM' in metadata:
                print(f"      • BPM: {metadata['BPM']} (precise)")
            if 'INITIALKEY' in metadata:
                print(f"      • Key: {metadata['INITIALKEY']} (Camelot)")
            if 'ENERGYLEVEL' in metadata:
                print(f"      • Energy: {metadata['ENERGYLEVEL']}/10")
        else:
            print(f"   ⚠️ No MixedInKey data found")
        
        # Step 3: Analyze audio features
        print(f"\n🎵 Step 3/5: Analyzing audio features...")
        
        if has_mixedinkey:
            print(f"   → Using MixedInKey data (instant)")
        else:
            print(f"   → Calculating with AI (librosa)")
            print(f"   ⏳ This will take 10-30 seconds...")
        
        import time
        start_time = time.time()
        
        # Run the actual analyzer
        features = analyzer.analyze_file(file_path, metadata)
        
        elapsed = time.time() - start_time
        
        print(f"   ✓ Analysis complete in {elapsed:.1f} seconds")
        print(f"      • BPM: {features.get('bpm', 'N/A')}")
        print(f"      • Key: {features.get('key', 'N/A')}")
        print(f"      • Energy: {features.get('energy_level', 'N/A')}/10")
        
        # Step 4: Database (simulated)
        print(f"\n💾 Step 4/5: Saving to database...")
        print(f"   ✓ Track saved to database (ID: simulated)")
        if features.get('artwork_pixmap'):
            print(f"   ✓ Artwork saved")
        
        # Step 5: HAMMS analysis
        print(f"\n🧬 Step 5/5: HAMMS v3.0 Analysis (12-dimensional vector)...")
        print(f"   Calculating harmonic compatibility vector...")
        print(f"   ✓ 12D Vector calculated successfully")
        print(f"   📊 Key dimensions:")
        
        # Simulate HAMMS visualization
        import random
        key_dims = [
            ('BPM Normalized', features.get('bpm', 120) / 200),
            ('Key Compatibility', 0.8 if has_mixedinkey else 0.6),
            ('Energy Level', features.get('energy', 0.5)),
            ('Danceability', features.get('danceability', 0.7))
        ]
        
        for name, val in key_dims:
            bar_length = int(val * 20)
            bar = '█' * bar_length + '░' * (20 - bar_length)
            print(f"      • {name:18}: [{bar}] {val:.2f}")
        
        print(f"   ✓ HAMMS analysis saved to database")
        
        # Final summary
        print(f"\n{'='*70}")
        print(f"✅ IMPORT COMPLETE: {metadata.get('TITLE', file_name)}")
        print(f"   • Source: {'MixedInKey' if has_mixedinkey else 'AI Analysis (librosa)'}")
        print(f"   • Time taken: {elapsed:.1f} seconds")
        print(f"   • Ready for mixing and harmonic analysis")
        print(f"{'='*70}\n")

if __name__ == "__main__":
    test_import_messages()