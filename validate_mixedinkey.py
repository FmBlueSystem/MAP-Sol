#!/usr/bin/env python3
"""
Validate MixedInKey-aware analyzer
Tests both files WITH and WITHOUT MixedInKey data
"""

import sys
import time
from pathlib import Path
sys.path.insert(0, 'src')
from audio_analyzer_mixedinkey import MixedInKeyAwareAnalyzer
from music_player import extract_audio_metadata

def test_analyzer():
    """Test analyzer with files that have and don't have MixedInKey data"""
    
    analyzer = MixedInKeyAwareAnalyzer()
    
    # Test 1: File WITH MixedInKey data
    file_with_mik = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Break Machine - Street Dance.flac"
    
    # Test 2: File WITHOUT MixedInKey data  
    file_without_mik = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Madonna - Get Together.flac"
    
    print("=" * 80)
    print("VALIDATING MIXEDINKEY-AWARE ANALYZER")
    print("=" * 80)
    
    # Test file WITH MixedInKey
    print("\n1️⃣ Testing file WITH MixedInKey data:")
    print(f"   File: Break Machine - Street Dance.flac")
    print(f"   Expected: Should use MixedInKey data INSTANTLY")
    print(f"   Expected BPM: 115.71")
    print(f"   Expected Key: 5A")
    print(f"   Expected Energy: 7")
    
    if Path(file_with_mik).exists():
        metadata = extract_audio_metadata(file_with_mik)
        print(f"\n   Extracted metadata keys: {list(metadata.keys())}")
        print(f"   BPM in metadata: {metadata.get('BPM', 'NOT FOUND')}")
        print(f"   INITIALKEY in metadata: {metadata.get('INITIALKEY', 'NOT FOUND')}")
        print(f"   ENERGYLEVEL in metadata: {metadata.get('ENERGYLEVEL', 'NOT FOUND')}")
        
        start_time = time.time()
        features = analyzer.analyze_file(file_with_mik, metadata)
        elapsed = time.time() - start_time
        
        print(f"\n   ⏱️ Analysis time: {elapsed:.2f} seconds")
        print(f"   📊 Result BPM: {features.get('bpm', 'N/A')}")
        print(f"   🎵 Result Key: {features.get('key', 'N/A')}")
        print(f"   ⚡ Result Energy: {features.get('energy_level', 'N/A')}")
        
        if elapsed < 2:
            print(f"   ✅ PASS: Used MixedInKey data (instant analysis)")
        else:
            print(f"   ❌ FAIL: Too slow, likely calculated instead of using MixedInKey")
    else:
        print(f"   ⚠️ File not found")
    
    # Test file WITHOUT MixedInKey
    print("\n" + "=" * 80)
    print("\n2️⃣ Testing file WITHOUT MixedInKey data:")
    print(f"   File: Madonna - Get Together.flac")
    print(f"   Expected: Should CALCULATE with librosa (10-30 seconds)")
    
    if Path(file_without_mik).exists():
        metadata = extract_audio_metadata(file_without_mik)
        print(f"\n   Extracted metadata keys: {list(metadata.keys())}")
        print(f"   BPM in metadata: {metadata.get('BPM', 'NOT FOUND')}")
        print(f"   INITIALKEY in metadata: {metadata.get('INITIALKEY', 'NOT FOUND')}")
        print(f"   ENERGYLEVEL in metadata: {metadata.get('ENERGYLEVEL', 'NOT FOUND')}")
        
        start_time = time.time()
        features = analyzer.analyze_file(file_without_mik, metadata)
        elapsed = time.time() - start_time
        
        print(f"\n   ⏱️ Analysis time: {elapsed:.2f} seconds")
        print(f"   📊 Result BPM: {features.get('bpm', 'N/A')}")
        print(f"   🎵 Result Key: {features.get('key', 'N/A')}")
        print(f"   ⚡ Result Energy: {features.get('energy_level', 'N/A')}")
        
        if elapsed > 5:
            print(f"   ✅ PASS: Calculated with librosa (took time)")
        else:
            print(f"   ⚠️ WARNING: Analysis was fast, might be using cached or default values")
    else:
        print(f"   ⚠️ File not found")
    
    print("\n" + "=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_analyzer()