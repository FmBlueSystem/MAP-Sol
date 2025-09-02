#!/usr/bin/env python3
"""
Audio Analyzer that PRIORITIZES MixedInKey metadata
Only calculates if MixedInKey data is not present
"""

import numpy as np
import base64
import json
from typing import Dict, Optional


class MixedInKeyAwareAnalyzer:
    """
    Analyzer that checks for MixedInKey data FIRST
    Only performs analysis if professional data is missing
    """
    
    def __init__(self):
        print("Initializing MixedInKey-aware analyzer")
        print("✅ Will use existing MixedInKey data when available")
        print("📊 Will only calculate missing data")
    
    def analyze_file(self, file_path: str, metadata: Dict = None) -> Dict:
        """
        Extract features, prioritizing MixedInKey data
        
        Args:
            file_path: Path to audio file
            metadata: Existing metadata including MixedInKey fields
            
        Returns:
            Dictionary with audio features (MixedInKey or calculated)
        """
        features = {'file_path': file_path}
        
        # Check for MixedInKey data in metadata
        has_mixedinkey = False
        
        if metadata:
            # 1. BPM - Check for MixedInKey BPM
            if metadata.get('BPM'):
                features['bpm'] = float(metadata['BPM'])
                has_mixedinkey = True
                print(f"  ✅ Using MixedInKey BPM: {features['bpm']}")
            elif metadata.get('bpm'):
                features['bpm'] = float(metadata['bpm'])
                has_mixedinkey = True
                print(f"  ✅ Using existing BPM: {features['bpm']}")
            
            # 2. KEY - Check for MixedInKey key
            if metadata.get('INITIALKEY'):
                features['key'] = metadata['INITIALKEY']
                has_mixedinkey = True
                print(f"  ✅ Using MixedInKey Key: {features['key']}")
            elif metadata.get('initial_key'):
                features['key'] = metadata['initial_key']
                has_mixedinkey = True
                print(f"  ✅ Using existing Key: {features['key']}")
            elif metadata.get('KEY'):
                # Decode from base64 if needed
                key_data = metadata['KEY']
                if 'eyJ' in key_data:  # Base64 JSON
                    try:
                        decoded = base64.b64decode(key_data)
                        key_json = json.loads(decoded)
                        features['key'] = key_json.get('key', 'Unknown')
                        has_mixedinkey = True
                        print(f"  ✅ Using decoded MixedInKey Key: {features['key']}")
                    except:
                        pass
            
            # 3. ENERGY - Check for MixedInKey energy
            if metadata.get('ENERGYLEVEL'):
                features['energy_level'] = int(metadata['ENERGYLEVEL'])
                features['energy'] = features['energy_level'] / 10.0
                has_mixedinkey = True
                print(f"  ✅ Using MixedInKey Energy: {features['energy_level']}")
            elif metadata.get('ENERGY'):
                # Decode from base64 if needed
                energy_data = metadata['ENERGY']
                if 'eyJ' in energy_data:  # Base64 JSON
                    try:
                        decoded = base64.b64decode(energy_data)
                        energy_json = json.loads(decoded)
                        features['energy_level'] = energy_json.get('energyLevel', 5)
                        features['energy'] = features['energy_level'] / 10.0
                        has_mixedinkey = True
                        print(f"  ✅ Using decoded MixedInKey Energy: {features['energy_level']}")
                    except:
                        pass
            
            # 4. BEATGRID - Check for MixedInKey beat grid
            if metadata.get('BEATGRID'):
                beatgrid_data = metadata['BEATGRID']
                if 'eyJ' in beatgrid_data:  # Base64 JSON
                    try:
                        decoded = base64.b64decode(beatgrid_data)
                        beatgrid_json = json.loads(decoded)
                        if beatgrid_json.get('source') == 'mixedinkey':
                            features['tempo_stability'] = 0.95  # MixedInKey is very accurate
                            features['has_beatgrid'] = True
                            has_mixedinkey = True
                            print(f"  ✅ Using MixedInKey BeatGrid")
                    except:
                        pass
            
            # 5. CUEPOINTS - Check for MixedInKey cue points
            if metadata.get('CUEPOINTS'):
                cuepoints_data = metadata['CUEPOINTS']
                if 'eyJ' in cuepoints_data:  # Base64 JSON
                    try:
                        decoded = base64.b64decode(cuepoints_data)
                        cuepoints_json = json.loads(decoded)
                        if cuepoints_json.get('source') == 'mixedinkey':
                            features['cue_points'] = cuepoints_json.get('cues', [])
                            features['has_cuepoints'] = True
                            has_mixedinkey = True
                            print(f"  ✅ Using MixedInKey CuePoints: {len(features['cue_points'])} points")
                    except:
                        pass
            
            # 6. Copy other metadata
            for key in ['title', 'artist', 'album', 'genre', 'year', 'duration']:
                if metadata.get(key):
                    features[key] = metadata[key]
        
        # If we have MixedInKey data, fill in reasonable defaults for missing HAMMS dimensions
        if has_mixedinkey:
            print("\n  🎯 MixedInKey data detected - using professional analysis")
            
            # Fill in missing dimensions with reasonable defaults based on what we have
            if 'bpm' in features and 'danceability' not in features:
                # Estimate danceability from BPM
                bpm = features['bpm']
                if 120 <= bpm <= 130:
                    features['danceability'] = 0.85  # House/Dance optimal
                elif 85 <= bpm <= 100:
                    features['danceability'] = 0.7   # Hip-hop range
                elif 170 <= bpm <= 180:
                    features['danceability'] = 0.8   # D&B range
                else:
                    features['danceability'] = 0.6
            
            # Default values for other dimensions (since MixedInKey doesn't provide them)
            features['valence'] = features.get('valence', 0.6)
            features['acousticness'] = features.get('acousticness', 0.1)
            features['instrumentalness'] = features.get('instrumentalness', 0.7)
            features['tempo_stability'] = features.get('tempo_stability', 0.9)
            features['harmonic_complexity'] = features.get('harmonic_complexity', 0.5)
            features['dynamic_range'] = features.get('dynamic_range', 0.5)
            features['rhythmic_pattern'] = features.get('rhythmic_pattern', 0.6)
            features['spectral_centroid'] = features.get('spectral_centroid', 0.5)
            
        else:
            # NO MixedInKey data - fall back to librosa analysis
            print("\n  ⚠️ No MixedInKey data found - performing AI analysis")
            print("  This will take 10-30 seconds...")
            
            try:
                import librosa
                # Load and analyze with librosa
                y, sr = librosa.load(file_path, duration=120)
                
                # Calculate missing BPM
                if 'bpm' not in features:
                    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                    features['bpm'] = float(tempo)
                    print(f"  Calculated BPM: {features['bpm']:.1f}")
                
                # Calculate missing key
                if 'key' not in features:
                    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
                    chroma_mean = np.mean(chroma, axis=1)
                    key_index = np.argmax(chroma_mean)
                    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    features['key'] = keys[key_index]
                    print(f"  Calculated Key: {features['key']}")
                
                # Calculate missing energy
                if 'energy' not in features:
                    rms = librosa.feature.rms(y=y)
                    features['energy'] = float(np.mean(rms)) * 2
                    features['energy'] = np.clip(features['energy'], 0, 1)
                    features['energy_level'] = int(features['energy'] * 10)
                    print(f"  Calculated Energy: {features['energy']:.2f}")
                
                # Calculate other features
                features['danceability'] = 0.7
                features['valence'] = 0.5
                features['acousticness'] = 0.2
                features['instrumentalness'] = 0.6
                features['tempo_stability'] = 0.8
                features['harmonic_complexity'] = 0.5
                features['dynamic_range'] = 0.5
                features['rhythmic_pattern'] = 0.5
                features['spectral_centroid'] = 0.5
                
            except Exception as e:
                print(f"  ❌ Analysis failed: {e}")
                # Fallback defaults
                features['bpm'] = features.get('bpm', 120.0)
                features['key'] = features.get('key', 'Am')
                features['energy'] = features.get('energy', 0.5)
                features['energy_level'] = features.get('energy_level', 5)
                features['danceability'] = 0.7
                features['valence'] = 0.5
                features['acousticness'] = 0.2
                features['instrumentalness'] = 0.6
                features['tempo_stability'] = 0.8
                features['harmonic_complexity'] = 0.5
                features['dynamic_range'] = 0.5
                features['rhythmic_pattern'] = 0.5
                features['spectral_centroid'] = 0.5
        
        return features
