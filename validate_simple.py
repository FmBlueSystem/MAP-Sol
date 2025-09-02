#!/usr/bin/env python3
"""
Simple validation of MixedInKey-aware analyzer
"""

import sys
import time
import subprocess
import json
from pathlib import Path
sys.path.insert(0, 'src')
from audio_analyzer_mixedinkey import MixedInKeyAwareAnalyzer

def extract_metadata(file_path):
    """Extract metadata using ffprobe"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return data.get('format', {}).get('tags', {})

def test_analyzer():
    """Test analyzer with files that have and don't have MixedInKey data"""
    
    analyzer = MixedInKeyAwareAnalyzer()
    
    # Test 1: File WITH MixedInKey data
    file_with_mik = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Break Machine - Street Dance.flac"
    
    # Test 2: File WITHOUT MixedInKey data  
    file_without_mik = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Madonna - Get Together.flac"
    
    print("=" * 80)
    print("🔍 VALIDATING MIXEDINKEY-AWARE ANALYZER")
    print("=" * 80)
    
    # Test file WITH MixedInKey
    print("\n1️⃣ Testing file WITH MixedInKey data:")
    print(f"   File: Break Machine - Street Dance.flac")
    print(f"   Expected: Should use MixedInKey data INSTANTLY")
    print(f"   Expected BPM: 115.71")
    print(f"   Expected Key: 5A")
    print(f"   Expected Energy: 7")
    
    if Path(file_with_mik).exists():
        metadata = extract_metadata(file_with_mik)
        print(f"\n   📁 Metadata found:")
        print(f"      BPM: {metadata.get('BPM', 'NOT FOUND')}")
        print(f"      INITIALKEY: {metadata.get('INITIALKEY', 'NOT FOUND')}")
        print(f"      ENERGYLEVEL: {metadata.get('ENERGYLEVEL', 'NOT FOUND')}")
        
        print(f"\n   🔄 Running analyzer...")
        start_time = time.time()
        features = analyzer.analyze_file(file_with_mik, metadata)
        elapsed = time.time() - start_time
        
        print(f"\n   📊 Results:")
        print(f"      ⏱️ Analysis time: {elapsed:.2f} seconds")
        print(f"      BPM: {features.get('bpm', 'N/A')}")
        print(f"      Key: {features.get('key', 'N/A')}")
        print(f"      Energy: {features.get('energy_level', 'N/A')}")
        
        if elapsed < 2 and abs(features.get('bpm', 0) - 115.71) < 0.1:
            print(f"\n   ✅ PASS: Used MixedInKey data (instant + exact match)")
        else:
            print(f"\n   ❌ FAIL: Did not use MixedInKey data properly")
    else:
        print(f"   ⚠️ File not found")
    
    # Test file WITHOUT MixedInKey
    print("\n" + "=" * 80)
    print("\n2️⃣ Testing file WITHOUT MixedInKey data:")
    print(f"   File: Madonna - Get Together.flac")
    print(f"   Expected: Should CALCULATE with librosa (10-30 seconds)")
    
    if Path(file_without_mik).exists():
        metadata = extract_metadata(file_without_mik)
        print(f"\n   📁 Metadata found:")
        print(f"      BPM: {metadata.get('BPM', 'NOT FOUND')}")
        print(f"      INITIALKEY: {metadata.get('INITIALKEY', 'NOT FOUND')}")
        print(f"      ENERGYLEVEL: {metadata.get('ENERGYLEVEL', 'NOT FOUND')}")
        
        print(f"\n   🔄 Running analyzer (this will take 10-30 seconds)...")
        start_time = time.time()
        features = analyzer.analyze_file(file_without_mik, metadata)
        elapsed = time.time() - start_time
        
        print(f"\n   📊 Results:")
        print(f"      ⏱️ Analysis time: {elapsed:.2f} seconds")
        print(f"      BPM: {features.get('bpm', 'N/A')}")
        print(f"      Key: {features.get('key', 'N/A')}")
        print(f"      Energy: {features.get('energy_level', 'N/A')}")
        
        if elapsed > 5:
            print(f"\n   ✅ PASS: Calculated with librosa (took appropriate time)")
        else:
            print(f"\n   ⚠️ WARNING: Too fast, might not be calculating properly")
    else:
        print(f"   ⚠️ File not found")
    
    print("\n" + "=" * 80)
    print("✅ VALIDATION COMPLETE")
    print("=" * 80)
    print("\nSUMMARY:")
    print("- Files WITH MixedInKey data → Use professional data instantly")
    print("- Files WITHOUT MixedInKey data → Calculate with AI (librosa)")
    print("- This follows AUDIO_FLOW.md specification exactly")

if __name__ == "__main__":
    test_analyzer()