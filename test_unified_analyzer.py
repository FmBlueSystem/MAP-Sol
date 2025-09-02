#!/usr/bin/env python3
"""
Test unified analyzer with real files
"""

import sys
import os
import time
from pathlib import Path

# Setup paths
sys.path.insert(0, 'src')
os.chdir('/Users/freddymolina/Desktop/music-app-qt')

from audio_analyzer_unified import UnifiedAudioAnalyzer
from hamms_analyzer import HAMMSAnalyzer
from database import MusicDatabase
import subprocess
import json

def extract_metadata_ffprobe(file_path):
    """Extract metadata using ffprobe"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return data.get('format', {}).get('tags', {})

def test_unified_analyzer():
    """Test the unified analyzer without librosa dependency"""
    
    print("="*80)
    print("🧪 TESTING UNIFIED AUDIO ANALYZER")
    print("="*80)
    
    # Initialize components
    analyzer = UnifiedAudioAnalyzer()
    hamms = HAMMSAnalyzer()
    db = MusicDatabase()
    
    # Test files
    test_files = [
        "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/DJ Snake, J Balvin, Tyga - Loco Contigo.flac",
        "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Madonna - Get Together.flac"
    ]
    
    for file_path in test_files:
        if not Path(file_path).exists():
            print(f"\n⚠️ File not found: {Path(file_path).name}")
            continue
        
        print(f"\n{'='*80}")
        print(f"📀 Analyzing: {Path(file_path).name}")
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
            for field in found_mik:
                print(f"      • {field}: {metadata[field]}")
        else:
            print(f"   ⚠️ No MixedInKey fields found")
        
        # 2. Analyze with unified analyzer
        print("\n2️⃣ Analyzing with UnifiedAudioAnalyzer...")
        
        # Mock the librosa import to avoid dependency
        import types
        
        # Create mock librosa module
        mock_librosa = types.ModuleType('librosa')
        sys.modules['librosa'] = mock_librosa
        
        # Add minimal mock functions
        def mock_load(*args, **kwargs):
            print("   [Mock] Would load audio file with librosa")
            import numpy as np
            return np.zeros(44100), 22050  # Return empty audio
        
        class MockBeat:
            @staticmethod
            def beat_track(*args, **kwargs):
                print("   [Mock] Would calculate BPM with librosa")
                import numpy as np
                return np.array([120.0]), None
        
        class MockFeature:
            @staticmethod
            def chroma_cqt(*args, **kwargs):
                print("   [Mock] Would calculate chroma with librosa")
                import numpy as np
                return np.random.rand(12, 100)
            
            @staticmethod
            def rms(*args, **kwargs):
                print("   [Mock] Would calculate RMS with librosa")
                import numpy as np
                return np.array([[0.5]])
            
            @staticmethod
            def spectral_centroid(*args, **kwargs):
                print("   [Mock] Would calculate spectral centroid with librosa")
                import numpy as np
                return np.array([[1000]])
            
            @staticmethod
            def zero_crossing_rate(*args, **kwargs):
                print("   [Mock] Would calculate ZCR with librosa")
                import numpy as np
                return np.array([[0.1]])
        
        class MockOnset:
            @staticmethod
            def onset_strength(*args, **kwargs):
                print("   [Mock] Would calculate onset strength with librosa")
                import numpy as np
                return np.random.rand(100)
        
        mock_librosa.load = mock_load
        mock_librosa.beat = MockBeat()
        mock_librosa.feature = MockFeature()
        mock_librosa.onset = MockOnset()
        
        # Now analyze
        start_time = time.time()
        try:
            features = analyzer.analyze_file(file_path, metadata)
            elapsed = time.time() - start_time
            
            print(f"\n   ⏱️ Analysis time: {elapsed:.2f} seconds")
            print(f"   📊 Results:")
            print(f"      • Source: {features.get('source', 'Unknown')}")
            print(f"      • BPM: {features.get('bpm', 'N/A')}")
            print(f"      • Key: {features.get('key', 'N/A')}")
            print(f"      • Energy: {features.get('energy_level', 'N/A')}/10")
            
            # Validate source
            if found_mik and features.get('source') == 'MixedInKey':
                print(f"   ✅ Correctly using MixedInKey data (instant)")
            elif not found_mik and features.get('source') in ['Librosa', 'Default']:
                print(f"   ✅ Correctly using calculated data")
            else:
                print(f"   ❌ Source mismatch!")
            
            # 3. Calculate HAMMS
            print("\n3️⃣ Calculating HAMMS vector...")
            hamms_vector = hamms.calculate_extended_vector(features)
            
            print(f"   Vector shape: {hamms_vector.shape}")
            print(f"   Vector range: [{hamms_vector.min():.3f}, {hamms_vector.max():.3f}]")
            
            # Check validity
            import numpy as np
            if np.all((hamms_vector >= 0) & (hamms_vector <= 1)):
                print(f"   ✅ All dimensions in valid range [0, 1]")
            else:
                print(f"   ❌ Some dimensions out of range!")
                
            # 4. Save to database
            print("\n4️⃣ Database operations...")
            
            # Check if track exists
            existing = db.get_track_by_path(file_path)
            if existing:
                print(f"   Track exists (ID: {existing['id']})")
                # Update features
                db.update_track_features(existing['id'], features)
                # Save HAMMS
                hamms.save_hamms_analysis(existing['id'], hamms_vector, features)
                print(f"   ✅ Updated features and HAMMS")
            else:
                # Add new track
                track_id = db.add_track({
                    'file_path': file_path,
                    'title': Path(file_path).stem,
                    **features
                })
                if track_id:
                    # Save HAMMS
                    hamms.save_hamms_analysis(track_id, hamms_vector, features)
                    print(f"   ✅ Added new track (ID: {track_id}) with HAMMS")
                else:
                    print(f"   ❌ Failed to add track")
                    
        except Exception as e:
            print(f"\n   ❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*80)
    print("✅ TEST COMPLETED")
    print("="*80)
    
    # Clean up mock
    if 'librosa' in sys.modules:
        del sys.modules['librosa']

if __name__ == "__main__":
    test_unified_analyzer()
