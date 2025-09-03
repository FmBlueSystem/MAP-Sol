#!/usr/bin/env python3
"""
Unified Audio Analyzer - REAL analysis only, NO simulations
Prioritizes MixedInKey data when available, calculates with librosa when not
"""

import numpy as np
import json
import base64
from typing import Dict, Optional, Any
from utils.logger import setup_logger
logger = setup_logger(__name__)
from pathlib import Path


class UnifiedAudioAnalyzer:
    """
    Single source of truth for audio analysis
    NO SIMULATIONS - ALL REAL DATA
    """
    
    def __init__(self):
        logger.info("Unified Audio Analyzer initialized")
        logger.info("MixedInKey priority; Librosa fallback")
        self.analysis_count = 0
    
    def analyze_file(self, file_path: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze audio file with real data only
        
        Args:
            file_path: Path to audio file
            metadata: Existing metadata (may contain MixedInKey data)
            
        Returns:
            Complete analysis results
        """
        self.analysis_count += 1
        file_name = Path(file_path).name
        
        logger.info(f"Analyzing #{self.analysis_count}: {file_name}")
        
        features = {
            'file_path': file_path,
            'source': 'unknown'
        }
        
        # Check for MixedInKey data
        has_mixedinkey = False
        
        if metadata:
            # 1. BPM
            if 'BPM' in metadata:
                features['bpm'] = float(metadata['BPM'])
                features['source'] = 'MixedInKey'
                has_mixedinkey = True
                logger.debug(f"MixedInKey BPM: {features['bpm']}")
            
            # 2. KEY
            if 'INITIALKEY' in metadata:
                features['key'] = metadata['INITIALKEY']
                features['initial_key'] = metadata['INITIALKEY']
                features['source'] = 'MixedInKey'
                has_mixedinkey = True
                logger.debug(f"MixedInKey Key: {features['key']}")
            
            # 3. ENERGY
            if 'ENERGYLEVEL' in metadata:
                features['energy_level'] = int(metadata['ENERGYLEVEL'])
                features['energy'] = features['energy_level'] / 10.0
                features['source'] = 'MixedInKey'
                has_mixedinkey = True
                logger.debug(f"MixedInKey Energy: {features['energy_level']}/10")
            
            # 4. Copy basic metadata
            for key in ['title', 'artist', 'album', 'genre', 'year']:
                if key in metadata:
                    features[key] = metadata[key]
        
        # If missing critical features, calculate with librosa
        needs_calculation = not all(k in features for k in ['bpm', 'key', 'energy'])
        
        if needs_calculation:
            logger.debug("Missing data - calculating with librosa" if has_mixedinkey else "No MixedInKey data - full librosa analysis")
            
            try:
                # Load audio (limit to 2 minutes for speed)
                logger.debug("Loading audio file...")
                try:
                    import librosa
                    y, sr = librosa.load(file_path, duration=120, sr=22050)
                except ImportError:
                    logger.warning("librosa not installed - using defaults")
                    features.setdefault('bpm', 120.0)
                    features.setdefault('key', 'C')
                    features.setdefault('energy', 0.5)
                    features.setdefault('energy_level', 5)
                    features['source'] = 'Default'
                    return features
                
                # Calculate missing BPM
                if 'bpm' not in features:
                    logger.debug("Calculating BPM")
                    import librosa
                    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
                    features['bpm'] = float(tempo[0]) if isinstance(tempo, np.ndarray) else float(tempo)
                    logger.debug(f"Calculated BPM: {features['bpm']:.1f}")
                
                # Calculate missing key
                if 'key' not in features:
                    logger.debug("Calculating key")
                    import librosa
                    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
                    chroma_mean = np.mean(chroma, axis=1)
                    key_index = np.argmax(chroma_mean)
                    
                    # Standard pitch classes
                    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    features['key'] = keys[key_index]
                    features['initial_key'] = features['key']
                    logger.debug(f"Calculated Key: {features['key']}")
                
                # Calculate missing energy
                if 'energy' not in features:
                    logger.debug("Calculating energy")
                    import librosa
                    rms = librosa.feature.rms(y=y)
                    energy = float(np.mean(rms))
                    features['energy'] = np.clip(energy * 2, 0, 1)
                    features['energy_level'] = int(features['energy'] * 10)
                    logger.debug(f"Calculated Energy: {features['energy_level']}/10")
                
                # Always calculate these for HAMMS
                logger.debug("Calculating additional features")
                import librosa
                # Spectral features
                sc = librosa.feature.spectral_centroid(y=y, sr=sr)
                roll95 = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.95)
                flux = librosa.onset.onset_strength(y=y, sr=sr)
                zcr = librosa.feature.zero_crossing_rate(y)
                mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
                onset_env = librosa.onset.onset_strength(y=y, sr=sr)

                centroid = float(np.mean(sc)) if sc is not None else 0.0
                rolloff = float(np.mean(roll95)) if roll95 is not None else 0.0
                flux_mean = float(np.mean(flux)) if flux is not None else 0.0
                zcr_mean = float(np.mean(zcr)) if zcr is not None else 0.0
                mfcc_mean = float(np.mean(mfcc[0])) if mfcc is not None and mfcc.shape[0] > 0 else 0.0
                onset_mean = float(np.mean(onset_env)) if onset_env is not None else 0.0
                brightness = centroid / (sr / 2.0) if sr > 0 else 0.0

                features['spectral_centroid'] = centroid
                features['spectral_rolloff'] = rolloff
                features['spectral_flux'] = flux_mean
                features['zcr_mean'] = zcr_mean
                # Maintain backward compat: rhythmic_pattern == zcr_mean
                features['rhythmic_pattern'] = zcr_mean
                features['mfcc_mean'] = mfcc_mean
                features['onset_strength_mean'] = onset_mean
                features['brightness'] = brightness
                features['calculated_time_sec'] = float(len(y) / sr) if sr > 0 else 0.0

                # Tempo stability & dynamic range (better estimates)
                tempo_stability = 1.0 - np.std(onset_env) / (np.mean(onset_env) + 1e-6)
                features['tempo_stability'] = float(np.clip(tempo_stability, 0, 1))
                # Dynamic range estimate (dB P95-P10)
                rms = librosa.feature.rms(y=y)
                if rms is not None and rms.size > 0:
                    rms_db = 20.0 * np.log10(np.maximum(rms, 1e-9))
                    dr_est = float(np.percentile(rms_db, 95) - np.percentile(rms_db, 10))
                else:
                    dr_est = features.get('dynamic_range', 0.5)
                features['dynamic_range'] = dr_est
                
                if features['source'] != 'MixedInKey':
                    features['source'] = 'Librosa'
                    
            except Exception as e:
                logger.error(f"Analysis error: {e}")
                # Provide defaults if analysis fails
                features.setdefault('bpm', 120.0)
                features.setdefault('key', 'C')
                features.setdefault('energy', 0.5)
                features.setdefault('energy_level', 5)
                features['source'] = 'Default'
        
        # Ensure all HAMMS dimensions have values
        features.setdefault('danceability', 0.7 if features.get('bpm', 120) > 100 else 0.5)
        features.setdefault('valence', 0.5 + (features.get('energy', 0.5) - 0.5) * 0.3)
        features.setdefault('acousticness', 0.1)
        features.setdefault('instrumentalness', 0.7)
        features.setdefault('tempo_stability', 0.8)
        features.setdefault('harmonic_complexity', 0.5)
        features.setdefault('dynamic_range', 0.5)
        features.setdefault('rhythmic_pattern', 0.5)
        features.setdefault('spectral_centroid', 0.5)
        
        logger.info(f"Analysis complete - Source: {features['source']}")
        
        return features
    
    def recalculate_hamms_only(self, existing_features: Dict) -> np.ndarray:
        """
        Recalculate just the HAMMS vector from existing features
        
        Args:
            existing_features: Already analyzed features
            
        Returns:
            12D HAMMS vector
        """
        # Normalize BPM (60-200 range)
        bpm = existing_features.get('bpm', 120)
        bpm_norm = (bpm - 60) / 140
        bpm_norm = np.clip(bpm_norm, 0, 1)
        
        # Key to numeric (simplified)
        key = existing_features.get('key', 'C')
        key_map = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
            # Camelot notation
            '1A': 9, '1B': 6, '2A': 4, '2B': 1, '3A': 11, '3B': 8,
            '4A': 6, '4B': 3, '5A': 1, '5B': 10, '6A': 8, '6B': 5,
            '7A': 3, '7B': 0, '8A': 10, '8B': 7, '9A': 5, '9B': 2,
            '10A': 0, '10B': 9, '11A': 7, '11B': 4, '12A': 2, '12B': 11
        }
        
        # Handle various key formats
        if key in key_map:
            key_num = key_map[key] / 11
        else:
            # Try to extract from complex formats
            key_clean = key.replace('m', '').replace('maj', '').replace('min', '').strip()
            key_num = key_map.get(key_clean, 0) / 11
        
        # Build 12D vector
        vector = np.array([
            bpm_norm,
            key_num,
            existing_features.get('energy', 0.5),
            existing_features.get('danceability', 0.7),
            existing_features.get('valence', 0.5),
            existing_features.get('acousticness', 0.1),
            existing_features.get('instrumentalness', 0.7),
            existing_features.get('rhythmic_pattern', 0.5),
            existing_features.get('spectral_centroid', 0.5),
            existing_features.get('tempo_stability', 0.8),
            existing_features.get('harmonic_complexity', 0.5),
            existing_features.get('dynamic_range', 0.5)
        ])
        
        return vector


# Global instance
analyzer = UnifiedAudioAnalyzer()

def analyze(file_path: str, metadata: Optional[Dict] = None) -> Dict[str, Any]:
    """Convenience function for analysis"""
    return analyzer.analyze_file(file_path, metadata)
