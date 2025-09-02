#!/usr/bin/env python3
"""
Real Audio Analyzer Module with Librosa
Performs ACTUAL audio analysis for HAMMS v3.0
"""

import numpy as np
import librosa
import librosa.feature
from typing import Dict, List, Tuple, Optional
import warnings
from utils.logger import setup_logger
logger = setup_logger(__name__)
warnings.filterwarnings('ignore')


class RealAudioAnalyzer:
    """
    Real audio feature extraction using librosa
    """
    
    # Camelot Wheel for key detection
    CAMELOT_KEYS = {
        0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 
        4: 'E', 5: 'F', 6: 'F#', 7: 'G',
        8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
    }
    
    def __init__(self):
        """Initialize analyzer"""
        logger.info("Initializing Real Audio Analyzer with librosa")
    
    def analyze_file(self, file_path: str, metadata: Dict = None) -> Dict:
        """
        REAL audio analysis using librosa
        
        Args:
            file_path: Path to audio file
            metadata: Existing metadata from file
            
        Returns:
            Dictionary with REAL audio features
        """
        logger.info(f"Starting real audio analysis for: {file_path}")
        logger.info("This may take 10-30 seconds depending on file size")
        
        try:
            # Load audio file (this takes time!)
            logger.debug("Loading audio file...")
            y, sr = librosa.load(file_path, duration=120)  # Analyze first 2 minutes
            logger.debug(f"Loaded: {len(y)/sr:.1f} seconds @ {sr}Hz")
            
            # 1. BPM Detection (computationally intensive)
            logger.debug("Detecting BPM")
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo)
            logger.debug(f"BPM: {bpm:.1f}")
            
            # 2. Key Detection using Chroma
            logger.debug("Detecting key")
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            key_index = np.argmax(chroma_mean)
            key = self.CAMELOT_KEYS[key_index]
            
            # Determine major/minor from chroma variance
            chroma_var = np.var(chroma, axis=1)
            is_minor = np.mean(chroma_var) > 0.09
            if is_minor:
                key = key + 'm'
            logger.debug(f"Key: {key}")
            
            # 3. Energy (RMS)
            logger.debug("Calculating energy")
            rms = librosa.feature.rms(y=y)
            energy = float(np.mean(rms))
            energy_normalized = np.clip(energy * 2, 0, 1)  # Normalize
            logger.debug(f"Energy: {energy_normalized:.2f}")
            
            # 4. Spectral Features
            logger.debug("Extracting spectral features")
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
            spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
            
            spectral_centroid_norm = np.mean(spectral_centroid) / sr
            spectral_brightness = np.clip(spectral_centroid_norm * 4, 0, 1)
            logger.debug(f"Spectral brightness: {spectral_brightness:.2f}")
            
            # 5. Zero Crossing Rate (for percussiveness)
            logger.debug("Analyzing rhythm complexity")
            zcr = librosa.feature.zero_crossing_rate(y)
            percussiveness = np.clip(np.mean(zcr) * 50, 0, 1)
            logger.debug(f"Rhythmic complexity: {percussiveness:.2f}")
            
            # 6. Tempo Stability
            logger.debug("Checking tempo stability")
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo_stability = 1.0 - (np.std(onset_env) / (np.mean(onset_env) + 1e-6))
            tempo_stability = np.clip(tempo_stability, 0, 1)
            logger.debug(f"Tempo stability: {tempo_stability:.2f}")
            
            # 7. Harmonic/Percussive Separation
            logger.debug("Separating harmonic/percussive")
            y_harmonic, y_percussive = librosa.effects.hpss(y)
            harmonic_ratio = np.sum(np.abs(y_harmonic)) / (np.sum(np.abs(y)) + 1e-6)
            logger.debug(f"Harmonic ratio: {harmonic_ratio:.2f}")
            
            # 8. Dynamic Range
            logger.debug("Calculating dynamic range")
            db = librosa.amplitude_to_db(np.abs(librosa.stft(y)))
            dynamic_range = (np.percentile(db, 95) - np.percentile(db, 5)) / 80
            dynamic_range = np.clip(dynamic_range, 0, 1)
            logger.debug(f"Dynamic range: {dynamic_range:.2f}")
            
            # 9. Danceability (combination of tempo, energy, and beat strength)
            beat_strength = np.mean(librosa.onset.onset_strength(y=y, sr=sr))
            danceability = np.clip(
                (tempo/140) * 0.3 +  # Tempo component
                energy_normalized * 0.3 +  # Energy component
                beat_strength/10 * 0.4,  # Beat component
                0, 1
            )
            logger.debug(f"Danceability: {danceability:.2f}")
            
            # 10. Valence (positivity - based on key and brightness)
            major_keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
            is_major = any(k in key for k in major_keys) and 'm' not in key
            valence = np.clip(
                (0.7 if is_major else 0.3) + 
                spectral_brightness * 0.3,
                0, 1
            )
            logger.debug(f"Valence: {valence:.2f}")
            
            # 11. Acousticness (inverse of spectral flux)
            spectral_flux = np.mean(np.diff(spectral_centroid))
            acousticness = np.clip(1.0 - abs(spectral_flux) / 1000, 0, 1)
            logger.debug(f"Acousticness: {acousticness:.2f}")
            
            # 12. Instrumentalness (based on spectral flatness)
            spectral_flatness = librosa.feature.spectral_flatness(y=y)
            instrumentalness = np.clip(np.mean(spectral_flatness) * 2, 0, 1)
            logger.debug(f"Instrumentalness: {instrumentalness:.2f}")
            
            logger.info("Real audio analysis complete")
            
            # Return all features
            features = {
                'file_path': file_path,
                'bpm': bpm,
                'key': key,
                'energy': energy_normalized,
                'energy_level': int(energy_normalized * 10),
                'danceability': float(danceability),
                'valence': float(valence),
                'acousticness': float(acousticness),
                'instrumentalness': float(instrumentalness),
                'tempo_stability': float(tempo_stability),
                'harmonic_complexity': float(harmonic_ratio),
                'dynamic_range': float(dynamic_range),
                'rhythmic_pattern': float(percussiveness),
                'spectral_centroid': float(spectral_brightness),
                'duration': len(y) / sr,
                'sample_rate': sr
            }
            
            # Merge with existing metadata
            if metadata:
                features.update({k: v for k, v in metadata.items() if v is not None})
            
            return features
            
        except Exception as e:
            logger.error(f"Error analyzing audio: {e}")
            # Fallback to metadata if analysis fails
            return self._fallback_features(file_path, metadata)
    
    def _fallback_features(self, file_path: str, metadata: Dict = None) -> Dict:
        """Fallback when real analysis fails"""
        print("  Using fallback features from metadata...")
        
        features = {
            'file_path': file_path,
            'bpm': 120.0,
            'key': 'Am',
            'energy': 0.5,
            'energy_level': 5,
            'danceability': 0.7,
            'valence': 0.5,
            'acousticness': 0.2,
            'instrumentalness': 0.5,
            'tempo_stability': 0.8,
            'harmonic_complexity': 0.5,
            'dynamic_range': 0.5,
            'rhythmic_pattern': 0.5,
            'spectral_centroid': 0.5
        }
        
        if metadata:
            if metadata.get('bpm'):
                features['bpm'] = float(metadata['bpm'])
            if metadata.get('key'):
                features['key'] = metadata['key']
            features.update({k: v for k, v in metadata.items() if v is not None})
        
        return features
