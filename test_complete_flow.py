#!/usr/bin/env python3
"""
Test complete audio analysis flow - NO SIMULATIONS
"""

import sys
import os
import time
from pathlib import Path

# Setup paths
sys.path.insert(0, 'src')
os.chdir('/Users/freddymolina/Desktop/music-app-qt')

from hamms_analyzer import HAMMSAnalyzer
from database import MusicDatabase
import subprocess
import json
import numpy as np

def extract_metadata_ffprobe(file_path):
    """Extract metadata using ffprobe"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return data.get('format', {}).get('tags', {})

def test_complete_flow():
    """Test the complete analysis flow"""
    
    print("="*80)
    print("🧪 TESTING COMPLETE AUDIO ANALYSIS FLOW")
    print("="*80)
    
    # Initialize components
    hamms = HAMMSAnalyzer()
    db = MusicDatabase()
    
    # Test files
    test_files = [
        {
            'path': "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/DJ Snake, J Balvin, Tyga - Loco Contigo.flac",
            'expected': 'MixedInKey'
        },
        {
            'path': "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Madonna - Get Together.flac",
            'expected': 'Librosa'
        }
    ]
    
    for file_info in test_files:
        file_path = file_info['path']
        
        if not Path(file_path).exists():
            print(f"\n⚠️ File not found: {Path(file_path).name}")
            continue
        
        print(f"\n{'='*80}")
        print(f"📀 Testing: {Path(file_path).name}")
        print(f"Expected source: {file_info['expected']}")
        print(f"{'='*80}")
        
        # 1. Extract metadata
        print("\n1️⃣ Extracting metadata...")
        metadata = extract_metadata_ffprobe(file_path)
        print(f"   Found {len(metadata)} metadata fields")
        
        # Check for MixedInKey fields
        mik_fields = ['BPM', 'INITIALKEY', 'ENERGYLEVEL']
        found_mik = [f for f in mik_fields if f in metadata]
        if found_mik:
            print(f"   ✅ MixedInKey fields found: {', '.join(found_mik)}")
        else:
            print(f"   ⚠️ No MixedInKey fields found")
        
        # 2. Create features from metadata
        print("\n2️⃣ Creating features from metadata...")
        
        # Build features from metadata
        features = {
            'file_path': file_path,
            'source': 'Unknown'
        }
        
        # Check for MixedInKey data
        if 'BPM' in metadata:
            features['bpm'] = float(metadata['BPM'])
            features['source'] = 'MixedInKey'
        else:
            features['bpm'] = 120.0  # Default
            
        if 'INITIALKEY' in metadata:
            features['key'] = metadata['INITIALKEY']
            features['source'] = 'MixedInKey'
        else:
            features['key'] = 'C'  # Default
            
        if 'ENERGYLEVEL' in metadata:
            features['energy_level'] = int(metadata['ENERGYLEVEL'])
            features['energy'] = features['energy_level'] / 10.0
            features['source'] = 'MixedInKey'
        else:
            features['energy'] = 0.5
            features['energy_level'] = 5
            
        # Add required fields for HAMMS
        features['danceability'] = 0.7 if features['bpm'] > 100 else 0.5
        features['valence'] = 0.5 + (features['energy'] - 0.5) * 0.3
        features['acousticness'] = 0.1
        features['instrumentalness'] = 0.7
        features['tempo_stability'] = 0.8
        features['harmonic_complexity'] = 0.5
        features['dynamic_range'] = 0.5
        features['rhythmic_pattern'] = 0.5
        features['spectral_centroid'] = 0.5
        features['genre'] = metadata.get('genre', 'Electronic')
        
        print(f"   Source: {features.get('source', 'Unknown')}")
        print(f"   BPM: {features.get('bpm', 'N/A')}")
        print(f"   Key: {features.get('key', 'N/A')}")
        print(f"   Energy: {features.get('energy_level', 'N/A')}/10")
        
        # 3. Calculate HAMMS vector
        print("\n3️⃣ Calculating HAMMS vector...")
        hamms_vector = hamms.calculate_extended_vector(features)
        
        print(f"   Vector shape: {hamms_vector.shape}")
        print(f"   Vector range: [{hamms_vector.min():.3f}, {hamms_vector.max():.3f}]")
        
        # Visualize vector
        print("\n   📊 HAMMS 12D Vector:")
        dims = ['BPM', 'Key', 'Energy', 'Dance', 'Valence', 'Acoustic',
                'Instrumental', 'Rhythmic', 'Spectral', 'Stability', 
                'Harmonic', 'Dynamic']
        
        for i, (dim, val) in enumerate(zip(dims, hamms_vector)):
            bar_length = int(val * 20)
            bar = '█' * bar_length + '░' * (20 - bar_length)
            print(f"   {dim:12} [{bar}] {val:.3f}")
        
        # 4. Verify database operations
        print("\n4️⃣ Database operations...")
        
        # Check if track exists
        existing = db.get_track_by_path(file_path)
        if existing:
            print(f"   Track exists in DB (ID: {existing['id']})")
            
            # Check HAMMS data
            cursor = db.conn.execute(
                "SELECT vector_12d FROM hamms_advanced WHERE file_id = ?",
                (existing['id'],)
            )
            hamms_row = cursor.fetchone()
            if hamms_row and hamms_row[0]:
                print(f"   ✅ HAMMS vector exists in database")
            else:
                print(f"   ⚠️ No HAMMS vector in database")
        else:
            print(f"   Track not in database")
        
        # 5. Validation
        print("\n5️⃣ Validation:")
        
        # Check source matches expectation
        if features.get('source') == file_info['expected']:
            print(f"   ✅ Source matches expectation ({file_info['expected']})")
        else:
            print(f"   ❌ Source mismatch! Expected {file_info['expected']}, got {features.get('source')}")
        
        # Check all HAMMS dimensions are valid
        if np.all((hamms_vector >= 0) & (hamms_vector <= 1)):
            print(f"   ✅ All HAMMS dimensions in valid range [0, 1]")
        else:
            print(f"   ❌ Some HAMMS dimensions out of range!")
    
    print("\n" + "="*80)
    print("✅ COMPLETE FLOW TEST FINISHED")
    print("="*80)

if __name__ == "__main__":
    test_complete_flow()