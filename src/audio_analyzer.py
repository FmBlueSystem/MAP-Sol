#!/usr/bin/env python3
"""
Audio Analyzer Module
Extracts advanced audio features for HAMMS v3.0 analysis
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
import json
import random
from pathlib import Path


class AudioAnalyzer:
    """
    Audio feature extraction for HAMMS analysis
    Simulates audio analysis without requiring heavy dependencies
    """
    
    # Genre characteristics for simulation
    GENRE_PROFILES = {
        'House': {
            'bpm_range': (120, 130),
            'energy_range': (0.6, 0.8),
            'danceability': 0.85,
            'valence': 0.7,
            'acousticness': 0.1,
            'instrumentalness': 0.8,
            'keys': ['Am', 'C', 'Em', 'G', 'Dm', 'F']
        },
        'Techno': {
            'bpm_range': (125, 135),
            'energy_range': (0.7, 0.9),
            'danceability': 0.9,
            'valence': 0.5,
            'acousticness': 0.05,
            'instrumentalness': 0.9,
            'keys': ['Am', 'Dm', 'Em', 'Cm']
        },
        'Deep House': {
            'bpm_range': (118, 125),
            'energy_range': (0.5, 0.7),
            'danceability': 0.75,
            'valence': 0.6,
            'acousticness': 0.15,
            'instrumentalness': 0.7,
            'keys': ['F#m', 'Bm', 'Am', 'Em', 'C#m']
        },
        'Progressive House': {
            'bpm_range': (122, 130),
            'energy_range': (0.6, 0.85),
            'danceability': 0.8,
            'valence': 0.65,
            'acousticness': 0.1,
            'instrumentalness': 0.75,
            'keys': ['Am', 'Em', 'C', 'G', 'Dm']
        },
        'Trance': {
            'bpm_range': (130, 140),
            'energy_range': (0.7, 0.95),
            'danceability': 0.85,
            'valence': 0.8,
            'acousticness': 0.08,
            'instrumentalness': 0.85,
            'keys': ['Am', 'Em', 'F#m', 'C#m']
        },
        'Drum & Bass': {
            'bpm_range': (170, 180),
            'energy_range': (0.8, 0.95),
            'danceability': 0.8,
            'valence': 0.6,
            'acousticness': 0.05,
            'instrumentalness': 0.7,
            'keys': ['Em', 'Am', 'F#m', 'Bm']
        },
        'Hip Hop': {
            'bpm_range': (80, 100),
            'energy_range': (0.5, 0.7),
            'danceability': 0.7,
            'valence': 0.5,
            'acousticness': 0.2,
            'instrumentalness': 0.3,
            'keys': ['Cm', 'Gm', 'Dm', 'Am']
        },
        'Ambient': {
            'bpm_range': (60, 90),
            'energy_range': (0.2, 0.4),
            'danceability': 0.2,
            'valence': 0.4,
            'acousticness': 0.6,
            'instrumentalness': 0.9,
            'keys': ['C', 'G', 'D', 'A', 'E']
        },
        'Electronic': {
            'bpm_range': (110, 140),
            'energy_range': (0.5, 0.8),
            'danceability': 0.7,
            'valence': 0.6,
            'acousticness': 0.1,
            'instrumentalness': 0.7,
            'keys': ['Am', 'Em', 'Dm', 'C', 'G']
        }
    }
    
    def __init__(self):
        """Initialize audio analyzer"""
        self.sample_rate = 44100
        self.frame_size = 2048
        
    def analyze_file(self, file_path: str, metadata: Dict = None) -> Dict:
        """
        Analyze audio file and extract features
        
        Args:
            file_path: Path to audio file
            metadata: Existing metadata from file
            
        Returns:
            Dictionary with audio features
        """
        # Get genre from metadata or detect
        genre = self._detect_genre(metadata) if metadata else 'Electronic'
        profile = self.GENRE_PROFILES.get(genre, self.GENRE_PROFILES['Electronic'])
        
        # Generate features based on genre profile
        features = {
            'file_path': file_path,
            'bpm': self._generate_bpm(profile, metadata),
            'key': self._generate_key(profile, metadata),
            'energy': self._generate_energy(profile),
            'energy_level': int(self._generate_energy(profile) * 10),
            'danceability': profile['danceability'] + random.uniform(-0.1, 0.1),
            'valence': profile['valence'] + random.uniform(-0.1, 0.1),
            'acousticness': profile['acousticness'] + random.uniform(-0.05, 0.05),
            'instrumentalness': profile['instrumentalness'] + random.uniform(-0.1, 0.1),
            'tempo_stability': 0.85 + random.uniform(-0.1, 0.1),
            'genre': genre
        }
        
        # Ensure all values are in valid range
        for key in ['energy', 'danceability', 'valence', 'acousticness', 
                   'instrumentalness', 'tempo_stability']:
            features[key] = np.clip(features[key], 0, 1)
        
        # Add advanced features
        features.update(self._calculate_advanced_features(features))
        
        return features
    
    def _detect_genre(self, metadata: Dict) -> str:
        """Detect genre from metadata or filename"""
        if metadata and metadata.get('genre'):
            genre_str = metadata['genre'].lower()
            
            # Map common genre tags to our profiles
            genre_mapping = {
                'house': 'House',
                'deep house': 'Deep House',
                'progressive': 'Progressive House',
                'techno': 'Techno',
                'trance': 'Trance',
                'drum & bass': 'Drum & Bass',
                'dnb': 'Drum & Bass',
                'hip hop': 'Hip Hop',
                'hip-hop': 'Hip Hop',
                'rap': 'Hip Hop',
                'ambient': 'Ambient',
                'electronic': 'Electronic',
                'electro': 'Electronic',
                'edm': 'Electronic'
            }
            
            for key, value in genre_mapping.items():
                if key in genre_str:
                    return value
        
        # Default based on metadata hints
        if metadata:
            # Try to guess from BPM if available
            if 'bpm' in metadata and metadata['bpm']:
                bpm = float(metadata['bpm'])
                if bpm < 100:
                    return 'Hip Hop'
                elif bpm < 120:
                    return 'Electronic'
                elif bpm < 128:
                    return 'Deep House'
                elif bpm < 135:
                    return 'House'
                elif bpm < 145:
                    return 'Trance'
                elif bpm > 160:
                    return 'Drum & Bass'
        
        return 'Electronic'
    
    def _generate_bpm(self, profile: Dict, metadata: Dict = None) -> float:
        """Generate BPM based on genre profile"""
        if metadata and metadata.get('bpm'):
            return float(metadata['bpm'])
        
        bpm_min, bpm_max = profile['bpm_range']
        return round(random.uniform(bpm_min, bpm_max), 2)
    
    def _generate_key(self, profile: Dict, metadata: Dict = None) -> str:
        """Generate key based on genre profile"""
        if metadata and metadata.get('initial_key'):
            return metadata['initial_key']
        if metadata and metadata.get('key'):
            return metadata['key']
        
        return random.choice(profile['keys'])
    
    def _generate_energy(self, profile: Dict) -> float:
        """Generate energy level based on genre profile"""
        energy_min, energy_max = profile['energy_range']
        return round(random.uniform(energy_min, energy_max), 3)
    
    def _calculate_advanced_features(self, features: Dict) -> Dict:
        """Calculate advanced audio features"""
        advanced = {}
        
        # Energy curve (simulated)
        num_points = 16  # Energy measurements across track
        base_energy = features['energy']
        
        # Create energy progression
        energy_curve = []
        current_energy = base_energy * 0.7  # Start lower
        
        for i in range(num_points):
            # Simulate energy changes
            if i < 4:  # Intro
                current_energy += 0.05
            elif i < 12:  # Main section
                current_energy = base_energy + random.uniform(-0.1, 0.1)
            else:  # Outro
                current_energy -= 0.05
            
            energy_curve.append(np.clip(current_energy, 0, 1))
        
        advanced['energy_curve'] = energy_curve
        
        # Calculate transition points (best points to mix)
        transition_points = []
        
        # Intro mix point (around 32 bars)
        intro_point = int(32 * 4 * (60000 / features['bpm']))  # ms
        transition_points.append({
            'position_ms': intro_point,
            'type': 'intro',
            'energy': energy_curve[1]
        })
        
        # Main mix point (around 64 bars)
        main_point = int(64 * 4 * (60000 / features['bpm']))  # ms
        transition_points.append({
            'position_ms': main_point,
            'type': 'main',
            'energy': energy_curve[8]
        })
        
        # Outro mix point (around -32 bars from end)
        outro_point = int(-32 * 4 * (60000 / features['bpm']))  # ms (negative = from end)
        transition_points.append({
            'position_ms': outro_point,
            'type': 'outro',
            'energy': energy_curve[-2]
        })
        
        advanced['transition_points'] = transition_points
        
        # Cue points (simulated)
        cue_points = []
        
        # Hot cues at key points
        for i, point in enumerate(transition_points):
            cue_points.append({
                'index': i,
                'position_ms': point['position_ms'],
                'label': f"Cue {i+1}",
                'color': ['#FF0000', '#00FF00', '#0000FF'][i % 3]
            })
        
        advanced['cue_points'] = cue_points
        
        # Rhythmic pattern fingerprint
        advanced['rhythmic_pattern'] = self._generate_rhythmic_pattern(features['genre'])
        
        # Spectral features
        advanced['spectral_features'] = {
            'centroid': random.uniform(1000, 4000),  # Hz
            'rolloff': random.uniform(5000, 15000),  # Hz
            'flux': random.uniform(0.1, 0.5),
            'brightness': random.uniform(0.3, 0.8)
        }
        
        # Dynamic range
        advanced['dynamic_range'] = self._calculate_dynamic_range(features['genre'])
        
        # Harmonic complexity
        advanced['harmonic_complexity'] = self._calculate_harmonic_complexity(features['key'])
        
        return advanced
    
    def _generate_rhythmic_pattern(self, genre: str) -> str:
        """Generate rhythmic pattern fingerprint"""
        patterns = {
            'House': 'x-x-x-x-|x-x-x-x-',  # 4/4 kick
            'Techno': 'x-x-x-x-|x-x-x-x-',  # 4/4 kick
            'Deep House': 'x---x---|x---x---',  # Syncopated
            'Drum & Bass': 'x--x--x-|--x--x--',  # Broken beat
            'Hip Hop': 'x---x---|x---x---',  # Boom bap
            'Trance': 'x-x-x-x-|x-x-x-x-',  # 4/4 kick
            'Ambient': '--------|--------',  # Minimal
            'Electronic': 'x-x-x-x-|x-x-x-x-'  # Standard
        }
        
        base_pattern = patterns.get(genre, 'x-x-x-x-|x-x-x-x-')
        
        # Add some variation
        pattern_list = list(base_pattern)
        for i in range(len(pattern_list)):
            if pattern_list[i] == '-' and random.random() < 0.1:
                pattern_list[i] = 'o'  # Add occasional off-beat
        
        return ''.join(pattern_list)
    
    def _calculate_dynamic_range(self, genre: str) -> float:
        """Calculate dynamic range based on genre"""
        # Electronic music typically has less dynamic range
        dr_values = {
            'House': 0.3,
            'Techno': 0.25,
            'Deep House': 0.35,
            'Progressive House': 0.4,
            'Trance': 0.35,
            'Drum & Bass': 0.4,
            'Hip Hop': 0.5,
            'Ambient': 0.7,
            'Electronic': 0.35
        }
        
        base_dr = dr_values.get(genre, 0.4)
        return np.clip(base_dr + random.uniform(-0.1, 0.1), 0, 1)
    
    def _calculate_harmonic_complexity(self, key: str) -> float:
        """Calculate harmonic complexity based on key"""
        # Minor keys slightly more complex
        is_minor = 'm' in key.lower()
        base_complexity = 0.6 if is_minor else 0.4
        
        # Add variation
        return np.clip(base_complexity + random.uniform(-0.1, 0.1), 0, 1)
    
    def extract_bpm_from_filename(self, filename: str) -> Optional[float]:
        """
        Try to extract BPM from filename
        Common patterns: "128bpm", "128 BPM", "[128]", etc.
        """
        import re
        
        patterns = [
            r'(\d{2,3})\s*bpm',
            r'(\d{2,3})\s*BPM',
            r'\[(\d{2,3})\]',
            r'\((\d{2,3})\)',
            r'_(\d{2,3})_'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                bpm = float(match.group(1))
                if 60 <= bpm <= 200:  # Valid BPM range
                    return bpm
        
        return None
    
    def extract_key_from_filename(self, filename: str) -> Optional[str]:
        """
        Try to extract key from filename
        Common patterns: "Am", "C#m", "5A", "11B" (Camelot)
        """
        import re
        
        # Standard key notation
        key_pattern = r'\b([A-G][#b]?m?)\b'
        match = re.search(key_pattern, filename)
        if match:
            return match.group(1)
        
        # Camelot notation
        camelot_pattern = r'\b(\d{1,2}[AB])\b'
        match = re.search(camelot_pattern, filename)
        if match:
            # Convert Camelot to standard key
            camelot_to_key = {
                '1A': 'Abm', '1B': 'B',
                '2A': 'Ebm', '2B': 'Gb',
                '3A': 'Bbm', '3B': 'Db',
                '4A': 'Fm', '4B': 'Ab',
                '5A': 'Cm', '5B': 'Eb',
                '6A': 'Gm', '6B': 'Bb',
                '7A': 'Dm', '7B': 'F',
                '8A': 'Am', '8B': 'C',
                '9A': 'Em', '9B': 'G',
                '10A': 'Bm', '10B': 'D',
                '11A': 'F#m', '11B': 'A',
                '12A': 'C#m', '12B': 'E'
            }
            camelot = match.group(1)
            return camelot_to_key.get(camelot)
        
        return None
    
    def simulate_waveform(self, duration: float, energy_curve: List[float]) -> np.ndarray:
        """
        Generate simulated waveform data for visualization
        
        Args:
            duration: Track duration in seconds
            energy_curve: Energy levels across track
            
        Returns:
            Numpy array of waveform samples
        """
        sample_rate = 100  # Low sample rate for visualization
        num_samples = int(duration * sample_rate)
        
        # Interpolate energy curve to match duration
        curve_indices = np.linspace(0, len(energy_curve) - 1, num_samples)
        interpolated_energy = np.interp(curve_indices, 
                                       range(len(energy_curve)), 
                                       energy_curve)
        
        # Generate waveform with varying amplitude
        waveform = []
        for energy in interpolated_energy:
            # Add some randomness for realistic look
            sample = energy * (0.8 + 0.4 * random.random())
            waveform.append(sample)
        
        return np.array(waveform)
    
    def detect_silence(self, waveform: np.ndarray, threshold: float = 0.01) -> List[Tuple[int, int]]:
        """
        Detect silence regions in waveform
        
        Returns:
            List of (start, end) sample indices for silence regions
        """
        silence_regions = []
        in_silence = False
        start = 0
        
        for i, sample in enumerate(waveform):
            if abs(sample) < threshold:
                if not in_silence:
                    in_silence = True
                    start = i
            else:
                if in_silence:
                    in_silence = False
                    if i - start > 10:  # Minimum silence length
                        silence_regions.append((start, i))
        
        return silence_regions