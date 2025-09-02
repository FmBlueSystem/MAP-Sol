#!/usr/bin/env python3
"""
Test script for HAMMS v3.0 implementation
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from hamms_analyzer import HAMMSAnalyzer
from audio_analyzer import AudioAnalyzer
from genre_clustering import GenreClusterer
import numpy as np


def test_hamms_analysis():
    """Test HAMMS v3.0 analysis"""
    print("=" * 60)
    print("HAMMS v3.0 Implementation Test")
    print("=" * 60)
    
    # Initialize analyzers
    hamms = HAMMSAnalyzer()
    audio = AudioAnalyzer()
    
    # Test track data
    test_tracks = [
        {
            'title': 'Deep House Track',
            'artist': 'DJ Test',
            'genre': 'Deep House',
            'bpm': 122,
            'key': 'Am',
            'energy': 0.6
        },
        {
            'title': 'Techno Banger',
            'artist': 'Producer X',
            'genre': 'Techno',
            'bpm': 130,
            'key': 'Dm',
            'energy': 0.8
        },
        {
            'title': 'Progressive Journey',
            'artist': 'Artist Y',
            'genre': 'Progressive House',
            'bpm': 126,
            'key': 'C',
            'energy': 0.7
        }
    ]
    
    print("\n1. Testing Audio Feature Extraction:")
    print("-" * 40)
    
    for track in test_tracks:
        features = audio.analyze_file("test.mp3", track)
        print(f"\n{track['title']}:")
        print(f"  BPM: {features['bpm']:.1f}")
        print(f"  Key: {features['key']}")
        print(f"  Energy: {features['energy']:.2f}")
        print(f"  Danceability: {features['danceability']:.2f}")
        print(f"  Tempo Stability: {features['tempo_stability']:.2f}")
    
    print("\n2. Testing HAMMS 12D Vector Calculation:")
    print("-" * 40)
    
    vectors = []
    for track in test_tracks:
        features = audio.analyze_file("test.mp3", track)
        vector = hamms.calculate_extended_vector(features)
        vectors.append(vector)
        print(f"\n{track['title']} Vector (12D):")
        print(f"  Shape: {vector.shape}")
        print(f"  Values: [{', '.join([f'{v:.3f}' for v in vector[:6]])}...]")
    
    print("\n3. Testing Mix Compatibility:")
    print("-" * 40)
    
    # Test compatibility between tracks
    for i in range(len(test_tracks)):
        for j in range(i + 1, len(test_tracks)):
            track1 = test_tracks[i]
            track2 = test_tracks[j]
            
            # Get full features
            features1 = audio.analyze_file("test1.mp3", track1)
            features2 = audio.analyze_file("test2.mp3", track2)
            
            # Calculate compatibility
            compatibility = hamms.calculate_mix_compatibility(features1, features2)
            
            print(f"\n{track1['title']} → {track2['title']}:")
            print(f"  Compatibility Score: {compatibility['compatibility_score']:.2%}")
            print(f"  BPM Compatible: {compatibility['bpm_compatible']}")
            print(f"  Harmonic Distance: {compatibility['harmonic_distance']}")
            print(f"  Transition Type: {compatibility['transition_type']}")
            print(f"  Rating: {compatibility['rating']}")
    
    print("\n4. Testing Camelot Wheel Navigation:")
    print("-" * 40)
    
    test_keys = ['C', 'Am', 'G', 'Em', 'F', 'Dm']
    for i in range(len(test_keys)):
        for j in range(i + 1, len(test_keys)):
            distance = hamms.calculate_harmonic_distance(test_keys[i], test_keys[j])
            camelot1 = hamms.CAMELOT_WHEEL.get(test_keys[i], '?')
            camelot2 = hamms.CAMELOT_WHEEL.get(test_keys[j], '?')
            print(f"{test_keys[i]} ({camelot1}) → {test_keys[j]} ({camelot2}): Distance = {distance}")
    
    print("\n5. Testing DJ Set Creation:")
    print("-" * 40)
    
    energy_curves = ['ascending', 'descending', 'peak', 'wave']
    
    for curve in energy_curves:
        print(f"\nEnergy Curve: {curve}")
        dj_set = hamms.create_dj_set(duration_minutes=60, energy_curve=curve)
        
        if dj_set:
            print(f"  Created set with {len(dj_set)} tracks")
        else:
            print("  No tracks available for set creation")
    
    print("\n6. Testing Vector Similarity:")
    print("-" * 40)
    
    if len(vectors) >= 2:
        similarity = hamms.calculate_similarity(vectors[0], vectors[1])
        print(f"\nSimilarity between first two tracks:")
        print(f"  Overall: {similarity['overall']:.2%}")
        print(f"  Euclidean: {similarity['euclidean']:.2%}")
        print(f"  Cosine: {similarity['cosine']:.2%}")
        print("\n  Dimension similarities:")
        for dim, sim in list(similarity['dimensions'].items())[:5]:
            print(f"    {dim}: {sim:.2%}")
    
    print("\n" + "=" * 60)
    print("HAMMS v3.0 Test Complete!")
    print("=" * 60)
    
    # Test genre clustering if we have enough data
    print("\n7. Testing Genre Clustering:")
    print("-" * 40)
    
    clusterer = GenreClusterer(n_clusters=3)
    result = clusterer.cluster_tracks()
    
    if result['success']:
        print(f"  Clustered {result['n_tracks']} tracks into {result['n_clusters']} genres")
        print(f"  Cluster names: {result.get('cluster_names', {})}")
        print(f"  Cluster sizes: {result.get('cluster_sizes', {})}")
    else:
        print(f"  Clustering not performed: {result.get('message', 'Unknown error')}")
    
    return True


if __name__ == "__main__":
    success = test_hamms_analysis()
    sys.exit(0 if success else 1)