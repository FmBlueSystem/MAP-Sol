#!/usr/bin/env python3
"""
Enhanced Audio Analysis with Essentia and Librosa
Provides comprehensive audio feature extraction for Music Analyzer Pro
"""

import sys
import json
import os
import warnings
import numpy as np
from pathlib import Path

# Suppress warnings
warnings.filterwarnings('ignore')

try:
    import essentia
    import essentia.standard as es
    import librosa
    import soundfile as sf
except ImportError as e:
    print(f"ERROR: Missing required library: {e}", file=sys.stderr)
    sys.exit(1)

class AudioAnalyzer:
    def __init__(self):
        """Initialize the audio analyzer with Essentia algorithms"""
        self.sample_rate = 44100
        self.frame_size = 2048
        self.hop_size = 1024
        
    def load_audio(self, filepath):
        """Load audio file and convert to mono if needed"""
        try:
            # Try with librosa first
            y, sr = librosa.load(filepath, sr=self.sample_rate, mono=True)
            return y, sr
        except Exception as e:
            # Fallback to soundfile
            try:
                y, sr = sf.read(filepath)
                if len(y.shape) > 1:
                    y = np.mean(y, axis=1)  # Convert to mono
                if sr != self.sample_rate:
                    y = librosa.resample(y, orig_sr=sr, target_sr=self.sample_rate)
                return y, self.sample_rate
            except Exception as e2:
                raise Exception(f"Could not load audio file: {e2}")
    
    def analyze_rhythm(self, audio):
        """Analyze rhythm features including tempo and beat positions"""
        try:
            # Tempo and beat tracking
            tempo, beats = librosa.beat.beat_track(y=audio, sr=self.sample_rate)
            
            # Onset detection
            onset_env = librosa.onset.onset_strength(y=audio, sr=self.sample_rate)
            
            # Tempo stability
            dtempo = librosa.feature.tempo(
                onset_envelope=onset_env,
                sr=self.sample_rate,
                aggregate=None
            )
            tempo_stability = 1.0 - (np.std(dtempo) / np.mean(dtempo)) if len(dtempo) > 0 else 1.0
            
            return {
                'bpm': float(tempo),
                'tempo_stability': float(np.clip(tempo_stability, 0, 1)),
                'beat_count': len(beats),
                'onset_rate': float(np.mean(onset_env))
            }
        except Exception as e:
            print(f"PROGRESS: {{\"stage\": \"rhythm_error\", \"error\": \"{str(e)}\"}}")
            return {
                'bpm': 120.0,
                'tempo_stability': 0.5,
                'beat_count': 0,
                'onset_rate': 0.0
            }
    
    def analyze_spectral(self, audio):
        """Analyze spectral features"""
        try:
            # Spectral features using librosa
            spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=self.sample_rate)
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=self.sample_rate)
            spectral_contrast = librosa.feature.spectral_contrast(y=audio, sr=self.sample_rate)
            
            # Zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(audio)
            
            # Spectral bandwidth
            spectral_bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=self.sample_rate)
            
            return {
                'spectral_centroid': float(np.mean(spectral_centroids)),
                'spectral_rolloff': float(np.mean(spectral_rolloff)),
                'spectral_contrast': float(np.mean(spectral_contrast)),
                'spectral_bandwidth': float(np.mean(spectral_bandwidth)),
                'zero_crossing_rate': float(np.mean(zcr))
            }
        except Exception as e:
            print(f"PROGRESS: {{\"stage\": \"spectral_error\", \"error\": \"{str(e)}\"}}")
            return {
                'spectral_centroid': 0.0,
                'spectral_rolloff': 0.0,
                'spectral_contrast': 0.0,
                'spectral_bandwidth': 0.0,
                'zero_crossing_rate': 0.0
            }
    
    def analyze_energy(self, audio):
        """Analyze energy and loudness features"""
        try:
            # RMS energy
            rms = librosa.feature.rms(y=audio)
            
            # Dynamic range
            db = librosa.amplitude_to_db(np.abs(audio))
            dynamic_range = float(np.max(db) - np.min(db))
            
            # Energy entropy
            energy = np.square(audio)
            energy_entropy = -np.sum(energy * np.log2(energy + 1e-10))
            
            # Loudness using Essentia
            loudness = es.Loudness()(audio)
            
            return {
                'rms_energy': float(np.mean(rms)),
                'loudness': float(loudness),
                'dynamic_range': dynamic_range,
                'energy_entropy': float(energy_entropy)
            }
        except Exception as e:
            print(f"PROGRESS: {{\"stage\": \"energy_error\", \"error\": \"{str(e)}\"}}")
            return {
                'rms_energy': 0.0,
                'loudness': -20.0,
                'dynamic_range': 20.0,
                'energy_entropy': 0.0
            }
    
    def analyze_timbre(self, audio):
        """Analyze timbre features using MFCCs and other descriptors"""
        try:
            # MFCCs
            mfccs = librosa.feature.mfcc(y=audio, sr=self.sample_rate, n_mfcc=13)
            
            # Chroma features
            chroma = librosa.feature.chroma_stft(y=audio, sr=self.sample_rate)
            
            # Tonnetz (tonal centroid features)
            tonnetz = librosa.feature.tonnetz(y=audio, sr=self.sample_rate)
            
            return {
                'mfcc_mean': [float(np.mean(mfcc)) for mfcc in mfccs],
                'chroma_mean': float(np.mean(chroma)),
                'chroma_std': float(np.std(chroma)),
                'tonnetz_mean': float(np.mean(tonnetz))
            }
        except Exception as e:
            print(f"PROGRESS: {{\"stage\": \"timbre_error\", \"error\": \"{str(e)}\"}}")
            return {
                'mfcc_mean': [0.0] * 13,
                'chroma_mean': 0.0,
                'chroma_std': 0.0,
                'tonnetz_mean': 0.0
            }
    
    def calculate_high_level_features(self, features):
        """Calculate high-level features for HAMMS compatibility"""
        try:
            # Danceability (based on tempo stability, beat strength, and energy)
            danceability = np.mean([
                features['rhythm']['tempo_stability'],
                min(features['rhythm']['onset_rate'] * 2, 1.0),
                features['energy']['rms_energy'] * 2
            ])
            
            # Valence (musical positivity based on spectral and tonal features)
            valence = np.mean([
                min(features['spectral']['spectral_centroid'] / 4000, 1.0),
                features['timbre']['chroma_mean'] * 2,
                1.0 - (features['spectral']['spectral_contrast'] / 100)
            ])
            
            # Acousticness (inverse of spectral complexity)
            acousticness = 1.0 - min(features['spectral']['zero_crossing_rate'] * 2, 1.0)
            
            # Instrumentalness (based on spectral regularity)
            instrumentalness = min(features['spectral']['spectral_bandwidth'] / 5000, 1.0)
            
            # Speechiness (based on zero crossing rate and spectral features)
            speechiness = min(features['spectral']['zero_crossing_rate'] * 1.5, 1.0)
            
            # Liveness (based on dynamic range and energy variation)
            liveness = min(features['energy']['dynamic_range'] / 60, 1.0)
            
            return {
                'danceability': float(np.clip(danceability, 0, 1)),
                'valence': float(np.clip(valence, 0, 1)),
                'acousticness': float(np.clip(acousticness, 0, 1)),
                'instrumentalness': float(np.clip(instrumentalness, 0, 1)),
                'speechiness': float(np.clip(speechiness, 0, 1)),
                'liveness': float(np.clip(liveness, 0, 1)),
                'loudness': features['energy']['loudness']
            }
        except Exception as e:
            print(f"PROGRESS: {{\"stage\": \"high_level_error\", \"error\": \"{str(e)}\"}}")
            return {
                'danceability': 0.5,
                'valence': 0.5,
                'acousticness': 0.5,
                'instrumentalness': 0.5,
                'speechiness': 0.0,
                'liveness': 0.0,
                'loudness': -20.0
            }
    
    def analyze_file(self, filepath):
        """Complete analysis of an audio file"""
        print(f"PROGRESS: {{\"stage\": \"loading\", \"file\": \"{filepath}\"}}")
        
        # Load audio
        audio, sr = self.load_audio(filepath)
        
        print(f"PROGRESS: {{\"stage\": \"analyzing\", \"duration\": {len(audio)/sr}}}")
        
        # Analyze different aspects
        features = {
            'rhythm': self.analyze_rhythm(audio),
            'spectral': self.analyze_spectral(audio),
            'energy': self.analyze_energy(audio),
            'timbre': self.analyze_timbre(audio)
        }
        
        print(f"PROGRESS: {{\"stage\": \"calculating_high_level\"}}")
        
        # Calculate high-level features
        high_level = self.calculate_high_level_features(features)
        
        # Combine all results
        result = {
            **high_level,
            'bpm': features['rhythm']['bpm'],
            'tempo_stability': features['rhythm']['tempo_stability'],
            'spectral_centroid': features['spectral']['spectral_centroid'],
            'duration': len(audio) / sr
        }
        
        return result

def main():
    if len(sys.argv) < 3:
        print("Usage: analyze_audio_enhanced.py <audio_file> <file_id>", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    file_id = sys.argv[2]
    
    if not os.path.exists(audio_file):
        print(f"ERROR: File not found: {audio_file}", file=sys.stderr)
        sys.exit(1)
    
    try:
        analyzer = AudioAnalyzer()
        results = analyzer.analyze_file(audio_file)
        
        # Add file_id to results
        results['file_id'] = file_id
        results['analyzed_with'] = 'essentia_librosa'
        
        # Output results in parseable format
        print(f"RESULT:{json.dumps(results)}")
        
    except Exception as e:
        print(f"ERROR: Analysis failed: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()