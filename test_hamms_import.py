#!/usr/bin/env python3
"""
Test script to verify HAMMS v3.0 analysis during import
"""

import sys
from pathlib import Path
import numpy as np

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from database import MusicDatabase
from hamms_analyzer import HAMMSAnalyzer
from audio_analyzer import AudioAnalyzer

def test_import_with_hamms():
    """Test file import with HAMMS analysis"""
    print("=" * 80)
    print("TESTING HAMMS v3.0 IMPORT PROCESS")
    print("=" * 80)
    
    # Sample audio file metadata (simulating a real import)
    test_file = {
        'file_path': '/test/music/sample.mp3',
        'title': 'Test Track - Deep House',
        'artist': 'Test Artist',
        'album': 'Test Album',
        'genre': 'Deep House',
        'year': 2024,
        'duration': 240.5,
        'bitrate': 320000,
        'sample_rate': 44100,
        'bpm': 124,
        'key': 'Am',
        'energy': 0.75
    }
    
    # Initialize components
    db = MusicDatabase()
    hamms = HAMMSAnalyzer()
    audio = AudioAnalyzer()
    
    print("\n1. EXTRACTING AUDIO FEATURES")
    print("-" * 40)
    # Analyze audio features (simulated)
    audio_features = audio.analyze_file(test_file['file_path'], test_file)
    print(f"✓ BPM: {audio_features['bpm']:.1f}")
    print(f"✓ Key: {audio_features['key']}")
    print(f"✓ Energy: {audio_features['energy']:.2f}")
    print(f"✓ Danceability: {audio_features['danceability']:.2f}")
    print(f"✓ Valence: {audio_features['valence']:.2f}")
    print(f"✓ Acousticness: {audio_features['acousticness']:.2f}")
    print(f"✓ Instrumentalness: {audio_features['instrumentalness']:.2f}")
    print(f"✓ Tempo Stability: {audio_features['tempo_stability']:.2f}")
    print(f"✓ Harmonic Complexity: {audio_features['harmonic_complexity']:.2f}")
    print(f"✓ Dynamic Range: {audio_features['dynamic_range']:.2f}")
    
    print("\n2. CALCULATING HAMMS v3.0 12D VECTOR")
    print("-" * 40)
    # Calculate HAMMS vector
    hamms_vector = hamms.calculate_extended_vector(audio_features)
    
    # Display the 12 dimensions with their names and weights
    dimension_info = [
        ('BPM', 1.3),
        ('KEY', 1.4),
        ('ENERGY', 1.2),
        ('DANCEABILITY', 0.9),
        ('VALENCE', 0.8),
        ('ACOUSTICNESS', 0.6),
        ('INSTRUMENTALNESS', 0.5),
        ('RHYTHMIC_PATTERN', 1.1),
        ('SPECTRAL_CENTROID', 0.7),
        ('TEMPO_STABILITY', 0.9),
        ('HARMONIC_COMPLEXITY', 0.8),
        ('DYNAMIC_RANGE', 0.6)
    ]
    
    print(f"Vector Shape: {hamms_vector.shape}")
    print(f"Vector Type: {type(hamms_vector)}")
    print("\nDimension Values (Normalized 0-1):")
    for i, ((name, weight), value) in enumerate(zip(dimension_info, hamms_vector)):
        weighted_value = value * weight
        print(f"  {i+1:2}. {name:20} = {value:.4f} (weight: {weight}, weighted: {weighted_value:.4f})")
    
    print("\n3. SAVING TO DATABASE")
    print("-" * 40)
    # Add track to database
    track_data = {**test_file, **audio_features}
    track_id = db.add_track(track_data)
    print(f"✓ Track saved with ID: {track_id}")
    
    # Save HAMMS analysis
    hamms_metadata = {
        'tempo_stability': audio_features['tempo_stability'],
        'harmonic_complexity': audio_features['harmonic_complexity'],
        'dynamic_range': audio_features['dynamic_range'],
        'energy_curve': audio_features.get('energy_curve', []),
        'transition_points': audio_features.get('transition_points', []),
        'genre_cluster': 0,
        'ml_confidence': 0.85
    }
    hamms.save_hamms_analysis(track_id, hamms_vector, hamms_metadata)
    print(f"✓ HAMMS analysis saved to database")
    
    print("\n4. VERIFYING DATABASE STORAGE")
    print("-" * 40)
    # Retrieve and verify
    tracks = db.get_all_tracks()
    if tracks:
        track = tracks[-1]  # Get the last added track
        print(f"✓ Track in DB: {track['title']} by {track['artist']}")
        print(f"  - BPM: {track.get('bpm', 'N/A')}")
        print(f"  - Key: {track.get('initial_key', 'N/A')}")
        print(f"  - Energy: {track.get('energy_level', 'N/A')}")
    
    # Check HAMMS data
    hamms_data = hamms.get_hamms_data(track_id)
    if hamms_data:
        print(f"✓ HAMMS data retrieved:")
        print(f"  - Vector stored: {hamms_data.get('vector_12d', 'N/A')[:50]}...")
        print(f"  - Tempo stability: {hamms_data.get('tempo_stability', 'N/A')}")
        print(f"  - ML confidence: {hamms_data.get('ml_confidence', 'N/A')}")
    
    print("\n5. TESTING COMPATIBILITY CALCULATION")
    print("-" * 40)
    # Create a second test track
    test_file2 = test_file.copy()
    test_file2['title'] = 'Test Track 2 - Techno'
    test_file2['file_path'] = '/test/music/sample2.mp3'
    test_file2['bpm'] = 128
    test_file2['key'] = 'C'
    test_file2['energy'] = 0.85
    
    audio_features2 = audio.analyze_file(test_file2['file_path'], test_file2)
    
    # Calculate compatibility
    compatibility = hamms.calculate_mix_compatibility(audio_features, audio_features2)
    print(f"Compatibility Analysis:")
    print(f"  - Overall Score: {compatibility['compatibility_score']:.2%}")
    print(f"  - BPM Compatible: {compatibility['bpm_compatible']}")
    print(f"  - Harmonic Distance: {compatibility['harmonic_distance']}")
    print(f"  - Energy Compatible: {compatibility['energy_compatible']}")
    print(f"  - Transition Type: {compatibility['transition_type']}")
    print(f"  - Rating: {compatibility['rating']}")
    
    print("\n" + "=" * 80)
    print("✅ HAMMS v3.0 IMPORT TEST COMPLETE!")
    print("=" * 80)
    
    # Cleanup
    db.close()
    hamms.close()
    
    return True


if __name__ == "__main__":
    success = test_import_with_hamms()
    sys.exit(0 if success else 1)