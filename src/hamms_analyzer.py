#!/usr/bin/env python3
"""
HAMMS v3.0 - Harmonic Audio Metadata Management System
Advanced 12-dimensional music analysis for DJ compatibility and mixing
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
import json
from pathlib import Path
from datetime import datetime
import sqlite3
from collections import OrderedDict
from utils.logger import setup_logger
logger = setup_logger(__name__)
import hashlib


class HAMMSAnalyzer:
    """HAMMS v3.0 12-dimensional vector analysis system"""
    
    # Dimension weights for similarity calculation
    DIMENSION_WEIGHTS = {
        'bpm': 1.3,
        'key': 1.4,
        'energy': 1.2,
        'danceability': 0.9,
        'valence': 0.8,
        'acousticness': 0.6,
        'instrumentalness': 0.5,
        'rhythmic_pattern': 1.1,
        'spectral_centroid': 0.7,
        'tempo_stability': 0.9,
        'harmonic_complexity': 0.8,
        'dynamic_range': 0.6
    }
    
    # Camelot Wheel mapping
    CAMELOT_WHEEL = {
        'C': '8B', 'Am': '8A',
        'G': '9B', 'Em': '9A',
        'D': '10B', 'Bm': '10A',
        'A': '11B', 'F#m': '11A',
        'E': '12B', 'C#m': '12A',
        'B': '1B', 'G#m': '1A',
        'Gb': '2B', 'Ebm': '2A',
        'Db': '3B', 'Bbm': '3A',
        'Ab': '4B', 'Fm': '4A',
        'Eb': '5B', 'Cm': '5A',
        'Bb': '6B', 'Gm': '6A',
        'F': '7B', 'Dm': '7A'
    }
    
    # Reverse Camelot mapping
    CAMELOT_TO_KEY = {v: k for k, v in CAMELOT_WHEEL.items()}
    
    def __init__(self, db_path=None):
        """Initialize HAMMS analyzer with database connection"""
        # Prefer explicit path; else HOME; fallback to CWD in sandbox/tests
        if db_path is None:
            try:
                db_dir = Path.home() / '.music_player_qt'
                db_dir.mkdir(parents=True, exist_ok=True)
                db_path = db_dir / 'music_library.db'
            except Exception:
                db_dir = Path.cwd() / '.music_player_qt'
                db_dir.mkdir(parents=True, exist_ok=True)
                db_path = db_dir / 'music_library.db'

        self.db_path = db_path
        try:
            self.conn = sqlite3.connect(str(self.db_path))
            self.conn.row_factory = sqlite3.Row
            try:
                self.conn.execute('PRAGMA foreign_keys=ON')
            except Exception:
                pass
            self._init_hamms_tables()
        except Exception as e:
            # Fallback to in-memory DB for restricted environments/tests
            logger.warning(f"Falling back to in-memory HAMMS DB due to: {e}")
            self.db_path = ':memory:'
            self.conn = sqlite3.connect(':memory:')
            self.conn.row_factory = sqlite3.Row
            try:
                self.conn.execute('PRAGMA foreign_keys=ON')
            except Exception:
                pass
            self._init_hamms_tables()
        # Simple in-memory LRU caches
        self._vector_cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._compat_cache: OrderedDict[str, Dict] = OrderedDict()
        self._max_vector_cache = 2048
        self._max_compat_cache = 8192
    
    def _init_hamms_tables(self):
        """Create HAMMS v3.0 database tables"""
        # HAMMS advanced analysis table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS hamms_advanced (
                file_id INTEGER PRIMARY KEY,
                vector_12d TEXT,
                vector_pca TEXT,
                rhythmic_pattern TEXT,
                spectral_features TEXT,
                tempo_stability REAL,
                harmonic_complexity REAL,
                dynamic_range REAL,
                energy_curve TEXT,
                transition_points TEXT,
                genre_cluster INTEGER,
                ml_confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES tracks(id) ON DELETE CASCADE
            )
        ''')
        
        # Mix compatibility table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS mix_compatibility (
                track1_id INTEGER,
                track2_id INTEGER,
                compatibility_score REAL,
                harmonic_distance INTEGER,
                bpm_compatibility REAL,
                energy_compatibility REAL,
                optimal_transition TEXT,
                transition_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (track1_id, track2_id)
            )
        ''')
        
        # Genre clusters table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS genre_clusters (
                cluster_id INTEGER PRIMARY KEY,
                cluster_name TEXT,
                centroid_vector TEXT,
                member_count INTEGER,
                avg_bpm REAL,
                dominant_keys TEXT,
                energy_profile TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Add indices for performance
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_hamms_file_id ON hamms_advanced(file_id)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_mix_track1 ON mix_compatibility(track1_id)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_mix_track2 ON mix_compatibility(track2_id)')
        self.conn.execute('CREATE INDEX IF NOT EXISTS idx_mix_score ON mix_compatibility(compatibility_score)')
        
        self.conn.commit()
    
    def calculate_extended_vector(self, track_data: Dict) -> np.ndarray:
        """
        Calculate 12-dimensional HAMMS vector for a track
        
        Args:
            track_data: Dictionary with track metadata
            
        Returns:
            12-dimensional numpy array
        """
        # Cache key based on stable feature signature
        sig = self._vector_signature(track_data)
        cached = self._vector_cache_get(sig)
        if cached is not None:
            return cached.copy()

        # Core dimensions (7 original)
        bpm = track_data.get('bpm', 120)
        key = track_data.get('key', 'C')
        energy = track_data.get('energy', 0.5)
        danceability = track_data.get('danceability', 0.5)
        valence = track_data.get('valence', 0.5)
        acousticness = track_data.get('acousticness', 0.3)
        instrumentalness = track_data.get('instrumentalness', 0.5)
        
        # Extended dimensions (5 new)
        genre = track_data.get('genre', 'Electronic')
        
        # Normalize BPM (60-200 range)
        norm_bpm = np.clip((bpm - 60) / 140, 0, 1)
        
        # Convert key to numeric position on Camelot Wheel
        norm_key = self.camelot_to_numeric(key)
        
        # Normalize energy
        norm_energy = energy if energy <= 1.0 else energy / 10
        
        # Calculate extended features
        rhythmic_pattern = self.calculate_rhythmic_pattern(genre, bpm)
        spectral_centroid = self.calculate_spectral_centroid(genre, energy)
        tempo_stability = track_data.get('tempo_stability', 0.7)
        harmonic_complexity = self.calculate_harmonic_complexity(key)
        dynamic_range = self.calculate_dynamic_range(genre)
        
        # Create 12-dimensional vector
        vector = np.array([
            norm_bpm,
            norm_key,
            norm_energy,
            danceability,
            valence,
            acousticness,
            instrumentalness,
            rhythmic_pattern,
            spectral_centroid,
            tempo_stability,
            harmonic_complexity,
            dynamic_range
        ])
        
        # Store in cache
        self._vector_cache_set(sig, vector)
        return vector
    
    def camelot_to_numeric(self, key: str) -> float:
        """Convert key (standard or Camelot) to numeric position [0,1]."""
        camelot_key = self._to_camelot(key)
        try:
            number = int(camelot_key[:-1])
            letter = camelot_key[-1].upper()
            position = (number - 1) / 11
            if letter == 'A':
                position -= 0.042  # Minor offset for minor keys
            return float(np.clip(position, 0, 1))
        except Exception:
            return 0.5

    def _is_camelot(self, key: str) -> bool:
        if not isinstance(key, str):
            return False
        k = key.strip().upper()
        if len(k) < 2:
            return False
        num = k[:-1]
        let = k[-1]
        return num.isdigit() and 1 <= int(num) <= 12 and let in ('A', 'B')

    def _to_camelot(self, key: str) -> str:
        """Return Camelot code for a given key or pass through if already Camelot."""
        if not key:
            return '8B'
        k = str(key).strip()
        if self._is_camelot(k):
            return k.upper()
        # Map standard key -> Camelot
        return self.CAMELOT_WHEEL.get(k, '8B')
    
    def calculate_rhythmic_pattern(self, genre: str, bpm: float) -> float:
        """Calculate rhythmic pattern complexity based on genre and BPM"""
        # Genre-based complexity patterns
        genre_patterns = {
            'House': 0.6,
            'Techno': 0.7,
            'Drum & Bass': 0.9,
            'Hip Hop': 0.8,
            'Dubstep': 0.85,
            'Trance': 0.65,
            'Progressive': 0.75,
            'Deep House': 0.55,
            'Tech House': 0.7,
            'Breaks': 0.85
        }
        
        base_complexity = genre_patterns.get(genre, 0.5)
        
        # Adjust based on BPM
        if bpm < 100:
            bpm_factor = 0.9
        elif bpm < 128:
            bpm_factor = 1.0
        elif bpm < 140:
            bpm_factor = 1.1
        else:
            bpm_factor = 1.2
        
        return np.clip(base_complexity * bpm_factor, 0, 1)
    
    def calculate_spectral_centroid(self, genre: str, energy: float) -> float:
        """Calculate spectral centroid (brightness) based on genre and energy"""
        # Genre-based brightness
        genre_brightness = {
            'House': 0.6,
            'Techno': 0.5,
            'Drum & Bass': 0.8,
            'Trance': 0.7,
            'Ambient': 0.3,
            'Deep House': 0.4,
            'Progressive': 0.65
        }
        
        base_brightness = genre_brightness.get(genre, 0.5)
        
        # Combine with energy level
        return np.clip((base_brightness + energy) / 2, 0, 1)
    
    def calculate_harmonic_complexity(self, key: str) -> float:
        """Calculate harmonic complexity based on key"""
        # Major keys have slightly lower complexity
        is_major = key in ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']
        base_complexity = 0.4 if is_major else 0.6
        
        # Keys with more sharps/flats are slightly more complex
        sharp_flat_count = {
            'C': 0, 'Am': 0,
            'G': 1, 'Em': 1,
            'D': 2, 'Bm': 2,
            'A': 3, 'F#m': 3,
            'E': 4, 'C#m': 4,
            'B': 5, 'G#m': 5,
            'Gb': 6, 'Ebm': 6,
            'Db': 5, 'Bbm': 5,
            'Ab': 4, 'Fm': 4,
            'Eb': 3, 'Cm': 3,
            'Bb': 2, 'Gm': 2,
            'F': 1, 'Dm': 1
        }
        
        complexity_adjustment = sharp_flat_count.get(key, 0) * 0.05
        
        return np.clip(base_complexity + complexity_adjustment, 0, 1)
    
    def calculate_dynamic_range(self, genre: str) -> float:
        """Calculate dynamic range based on genre"""
        # Genre-based dynamic range (higher = more dynamic)
        genre_dynamics = {
            'Classical': 0.9,
            'Jazz': 0.8,
            'Acoustic': 0.75,
            'Rock': 0.6,
            'Electronic': 0.4,
            'House': 0.35,
            'Techno': 0.3,
            'Drum & Bass': 0.45,
            'Ambient': 0.7
        }
        
        return genre_dynamics.get(genre, 0.5)
    
    def calculate_similarity(self, vector1: np.ndarray, vector2: np.ndarray) -> Dict:
        """
        Calculate similarity between two HAMMS vectors
        
        Returns:
            Dictionary with overall and detailed similarity scores
        """
        # Apply dimension weights
        weights = np.array(list(self.DIMENSION_WEIGHTS.values()))
        weighted_v1 = vector1 * weights
        weighted_v2 = vector2 * weights
        
        # Euclidean distance
        euclidean_dist = np.linalg.norm(weighted_v1 - weighted_v2)
        max_distance = np.linalg.norm(weights)  # Maximum possible distance
        euclidean_sim = 1 - (euclidean_dist / max_distance)
        
        # Cosine similarity
        dot_product = np.dot(weighted_v1, weighted_v2)
        norm_v1 = np.linalg.norm(weighted_v1)
        norm_v2 = np.linalg.norm(weighted_v2)
        
        if norm_v1 > 0 and norm_v2 > 0:
            cosine_sim = dot_product / (norm_v1 * norm_v2)
        else:
            cosine_sim = 0
        
        # Calculate per-dimension similarities
        dimension_sims = {}
        dimension_names = list(self.DIMENSION_WEIGHTS.keys())
        for i, dim in enumerate(dimension_names):
            dim_diff = abs(vector1[i] - vector2[i])
            dimension_sims[dim] = 1 - dim_diff
        
        # Overall similarity (weighted average)
        overall_similarity = euclidean_sim * 0.6 + cosine_sim * 0.4
        
        return {
            'overall': overall_similarity,
            'euclidean': euclidean_sim,
            'cosine': cosine_sim,
            'dimensions': dimension_sims
        }
    
    def calculate_mix_compatibility(self, track1_data: Dict, track2_data: Dict) -> Dict:
        """
        Calculate detailed mix compatibility between two tracks
        
        Returns:
            Dictionary with compatibility scores and recommendations
        """
        # Extract key data
        bpm1 = track1_data.get('bpm', track1_data.get('tempo', 120))
        bpm2 = track2_data.get('bpm', track2_data.get('tempo', 120))
        key1 = track1_data.get('key') or track1_data.get('initial_key') or 'C'
        key2 = track2_data.get('key') or track2_data.get('initial_key') or 'C'
        # Prefer normalized [0,1] energy; fallback to energy_level (1-10)
        e1 = track1_data.get('energy', None)
        if e1 is None and track1_data.get('energy_level') is not None:
            try:
                e1 = float(track1_data.get('energy_level')) / 10.0
            except Exception:
                e1 = 0.5
        energy1 = e1 if e1 is not None else 0.5

        e2 = track2_data.get('energy', None)
        if e2 is None and track2_data.get('energy_level') is not None:
            try:
                e2 = float(track2_data.get('energy_level')) / 10.0
            except Exception:
                e2 = 0.5
        energy2 = e2 if e2 is not None else 0.5
        
        # Use cache to accelerate repeated checks
        comp_sig = self._compat_signature(track1_data, track2_data)
        c = self._compat_cache_get(comp_sig)
        if c is not None:
            return c.copy()

        # BPM compatibility (±8% tolerance)
        bpm_ratio = min(bpm1, bpm2) / max(bpm1, bpm2) if max(bpm1, bpm2) > 0 else 0
        bpm_compatible = bpm_ratio > 0.92
        bpm_score = bpm_ratio if bpm_compatible else bpm_ratio * 0.5
        
        # Harmonic compatibility (Camelot Wheel)
        harmonic_distance = self.calculate_harmonic_distance(key1, key2)
        harmonic_compatible = harmonic_distance <= 1
        harmonic_score = max(0, 1 - (harmonic_distance * 0.25))
        
        # Energy compatibility
        energy_diff = abs(energy1 - energy2)
        energy_compatible = energy_diff <= 0.3
        energy_score = max(0, 1 - energy_diff)
        
        # Calculate overall compatibility
        compatibility_score = (
            bpm_score * 0.4 +
            harmonic_score * 0.4 +
            energy_score * 0.2
        )
        
        # Determine transition type
        if bpm_compatible and harmonic_compatible:
            transition_type = 'blend'
            optimal_transition = 'outro_to_intro'
        elif harmonic_compatible:
            transition_type = 'harmonic_mix'
            optimal_transition = 'phrase_match'
        elif bpm_compatible:
            transition_type = 'tempo_match'
            optimal_transition = 'beatmatch_32'
        else:
            transition_type = 'creative'
            optimal_transition = 'effect_transition'
        
        # Rating
        if compatibility_score >= 0.9:
            rating = '🔥 Perfect Mix'
        elif compatibility_score >= 0.75:
            rating = '✨ Great Mix'
        elif compatibility_score >= 0.6:
            rating = '👍 Good Mix'
        elif compatibility_score >= 0.4:
            rating = '⚡ Challenging Mix'
        else:
            rating = '⚠️ Difficult Mix'
        
        result = {
            'compatibility_score': compatibility_score,
            'bpm_compatible': bpm_compatible,
            'bpm_score': bpm_score,
            'harmonic_compatible': harmonic_compatible,
            'harmonic_distance': harmonic_distance,
            'harmonic_score': harmonic_score,
            'energy_compatible': energy_compatible,
            'energy_score': energy_score,
            'transition_type': transition_type,
            'optimal_transition': optimal_transition,
            'rating': rating
        }
        self._compat_cache_set(comp_sig, result)
        return result

    # -------------------------
    # Cache helpers
    # -------------------------
    def _vector_signature(self, td: Dict) -> str:
        """Build a stable signature string for vector cache."""
        # Prefer an explicit identity first
        ident = td.get('id') or td.get('file_id') or td.get('file_path') or td.get('title')
        keys = (
            td.get('bpm', 120),
            td.get('key') or td.get('initial_key') or 'C',
            td.get('energy') if td.get('energy') is not None else (float(td.get('energy_level', 5)) / 10.0),
            td.get('danceability', 0.5),
            td.get('valence', 0.5),
            td.get('acousticness', 0.3),
            td.get('instrumentalness', 0.5),
            td.get('tempo_stability', 0.7),
            td.get('genre', 'Electronic'),
        )
        return f"{ident}|" + ",".join(map(lambda x: f"{x}", keys))

    def _compat_signature(self, a: Dict, b: Dict) -> str:
        """Signature for compatibility cache (order-independent)."""
        def k(td):
            ident = td.get('id') or td.get('file_id') or td.get('file_path') or td.get('title')
            bpm = td.get('bpm', td.get('tempo', 120))
            key = td.get('key') or td.get('initial_key') or 'C'
            energy = td.get('energy') if td.get('energy') is not None else (float(td.get('energy_level', 5)) / 10.0)
            return f"{ident}|{bpm}|{key}|{energy}"
        k1, k2 = k(a), k(b)
        return "::".join(sorted([k1, k2]))

    def _vector_cache_get(self, sig: str):
        v = self._vector_cache.get(sig)
        if v is not None:
            # refresh LRU
            self._vector_cache.move_to_end(sig)
        return v

    def _vector_cache_set(self, sig: str, vec: np.ndarray):
        self._vector_cache[sig] = vec.copy()
        self._vector_cache.move_to_end(sig)
        if len(self._vector_cache) > self._max_vector_cache:
            self._vector_cache.popitem(last=False)

    def _compat_cache_get(self, sig: str):
        c = self._compat_cache.get(sig)
        if c is not None:
            self._compat_cache.move_to_end(sig)
        return c

    def _compat_cache_set(self, sig: str, val: Dict):
        self._compat_cache[sig] = val.copy()
        self._compat_cache.move_to_end(sig)
        if len(self._compat_cache) > self._max_compat_cache:
            self._compat_cache.popitem(last=False)

    # -------------------------
    # Public cache controls
    # -------------------------
    def clear_cache(self):
        """Clear all in-memory caches."""
        self._vector_cache.clear()
        self._compat_cache.clear()

    def invalidate_track(self, identifier):
        """Invalidate cached entries related to a track.
        Accepts track id (int), file path (str) or dict with id/file_path.
        """
        if isinstance(identifier, dict):
            ident = identifier.get('id') or identifier.get('file_id') or identifier.get('file_path')
        else:
            ident = identifier
        if ident is None:
            return
        ident = str(ident)

        # Remove vector cache entries whose signature starts with ident|
        for k in list(self._vector_cache.keys()):
            if k.startswith(f"{ident}|"):
                self._vector_cache.pop(k, None)

        # Remove compatibility cache entries containing ident token
        token = f"{ident}|"
        for k in list(self._compat_cache.keys()):
            if token in k:
                self._compat_cache.pop(k, None)
    
    def calculate_harmonic_distance(self, key1: str, key2: str) -> int:
        """
        Calculate harmonic distance on Camelot Wheel
        
        Returns:
            Distance between keys (0 = same, 1 = adjacent, etc.)
        """
        camelot1 = self._to_camelot(key1)
        camelot2 = self._to_camelot(key2)
        
        if camelot1 == camelot2:
            return 0
        
        # Extract numbers and letters
        num1 = int(camelot1[:-1])
        letter1 = camelot1[-1]
        num2 = int(camelot2[:-1])
        letter2 = camelot2[-1]
        
        # Check if keys are adjacent
        if letter1 == letter2:
            # Same letter, check number adjacency
            num_diff = min(abs(num1 - num2), 12 - abs(num1 - num2))
            return num_diff
        else:
            # Different letters
            if num1 == num2:
                return 1  # Same number, different letter
            else:
                # Calculate minimum distance
                num_diff = min(abs(num1 - num2), 12 - abs(num1 - num2))
                return num_diff + 1
    
    def find_compatible_tracks(self, track_id: int, limit: int = 10) -> List[Dict]:
        """
        Find tracks compatible for mixing with given track
        
        Returns:
            List of compatible tracks sorted by compatibility score
        """
        # Get track data
        cursor = self.conn.execute(
            'SELECT * FROM tracks WHERE id = ?',
            (track_id,)
        )
        track = cursor.fetchone()
        
        if not track:
            return []
        
        track_data = dict(track)
        
        # Get all other tracks
        cursor = self.conn.execute(
            'SELECT * FROM tracks WHERE id != ?',
            (track_id,)
        )
        other_tracks = cursor.fetchall()
        
        # Calculate compatibility for each track
        compatible_tracks = []
        for other in other_tracks:
            other_data = dict(other)
            compatibility = self.calculate_mix_compatibility(track_data, other_data)
            
            if compatibility['compatibility_score'] > 0.5:
                compatible_tracks.append({
                    'track_id': other['id'],
                    'title': other['title'],
                    'artist': other['artist'],
                    'bpm': other.get('bpm', 120),
                    'key': other.get('initial_key', 'C'),
                    **compatibility
                })
        
        # Sort by compatibility score
        compatible_tracks.sort(key=lambda x: x['compatibility_score'], reverse=True)
        
        return compatible_tracks[:limit]
    
    def create_dj_set(self, duration_minutes: int, energy_curve: str = 'ascending') -> List[Dict]:
        """
        Create optimized DJ set with specified energy curve
        
        Args:
            duration_minutes: Target duration in minutes
            energy_curve: 'ascending', 'descending', 'peak', 'wave'
            
        Returns:
            List of tracks in optimal order
        """
        # Get all tracks with energy data
        cursor = self.conn.execute('''
            SELECT t.*, h.vector_12d 
            FROM tracks t 
            LEFT JOIN hamms_advanced h ON t.id = h.file_id
            WHERE t.duration IS NOT NULL
        ''')
        tracks = [dict(row) for row in cursor.fetchall()]
        
        if not tracks:
            return []
        
        # Define energy curves
        if energy_curve == 'ascending':
            # Start low, build up: ▁▂▃▄▅▆▇█
            energy_targets = np.linspace(0.3, 0.9, 10)
        elif energy_curve == 'descending':
            # Start high, wind down: █▇▆▅▄▃▂▁
            energy_targets = np.linspace(0.9, 0.3, 10)
        elif energy_curve == 'peak':
            # Build to peak, then down: ▁▃▅▇█▇▅▃▁
            energy_targets = np.concatenate([
                np.linspace(0.3, 0.9, 5),
                np.linspace(0.9, 0.3, 5)
            ])
        else:  # wave
            # Multiple peaks: ▁▅█▅▁▅█▅▁
            energy_targets = np.array([0.3, 0.6, 0.9, 0.6, 0.3, 0.6, 0.9, 0.6, 0.3])
        
        # Build set
        dj_set = []
        total_duration = 0
        target_duration = duration_minutes * 60
        used_tracks = set()
        
        # Determine number of tracks needed
        avg_track_duration = np.mean([t.get('duration', 300) for t in tracks])
        num_tracks = int(target_duration / avg_track_duration)
        
        # Resample energy targets to match number of tracks
        energy_targets = np.interp(
            np.linspace(0, len(energy_targets) - 1, num_tracks),
            np.arange(len(energy_targets)),
            energy_targets
        )
        
        # Select tracks matching energy curve
        for i, target_energy in enumerate(energy_targets):
            if total_duration >= target_duration:
                break
            
            # Find best matching track for this energy level
            best_track = None
            best_score = -1
            
            for track in tracks:
                if track['id'] in used_tracks:
                    continue
                
                track_energy = track.get('energy_level', 5) / 10
                energy_diff = abs(track_energy - target_energy)
                
                # Consider harmonic compatibility with previous track
                if dj_set:
                    prev_track = dj_set[-1]
                    compatibility = self.calculate_mix_compatibility(prev_track, track)
                    score = compatibility['compatibility_score'] * 0.7 + (1 - energy_diff) * 0.3
                else:
                    score = 1 - energy_diff
                
                if score > best_score:
                    best_score = score
                    best_track = track
            
            if best_track:
                dj_set.append(best_track)
                used_tracks.add(best_track['id'])
                total_duration += best_track.get('duration', 300)
        
        return dj_set
    
    def save_hamms_analysis(self, track_id: int, vector: np.ndarray, metadata: Dict):
        """Save HAMMS analysis to database"""
        try:
            # Prepare data
            vector_json = json.dumps(vector.tolist())
            energy_curve = json.dumps(metadata.get('energy_curve', []))
            transition_points = json.dumps(metadata.get('transition_points', []))
            
            # Insert or update
            with self.conn:
                self.conn.execute('''
                INSERT OR REPLACE INTO hamms_advanced (
                    file_id, vector_12d, tempo_stability, 
                    harmonic_complexity, dynamic_range,
                    energy_curve, transition_points,
                    genre_cluster, ml_confidence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                track_id,
                vector_json,
                metadata.get('tempo_stability', 0.7),
                metadata.get('harmonic_complexity', 0.5),
                metadata.get('dynamic_range', 0.5),
                energy_curve,
                transition_points,
                metadata.get('genre_cluster', 0),
                metadata.get('ml_confidence', 0.8)
                ))
            return True
            
        except Exception as e:
            logger.error(f"Error saving HAMMS analysis: {e}")
            return False
    
    def save_mix_compatibility(self, track1_id: int, track2_id: int, compatibility: Dict):
        """Save mix compatibility to database"""
        try:
            with self.conn:
                self.conn.execute('''
                INSERT OR REPLACE INTO mix_compatibility (
                    track1_id, track2_id, compatibility_score,
                    harmonic_distance, bpm_compatibility,
                    energy_compatibility, optimal_transition,
                    transition_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                track1_id,
                track2_id,
                compatibility['compatibility_score'],
                compatibility['harmonic_distance'],
                compatibility['bpm_score'],
                compatibility['energy_score'],
                compatibility['optimal_transition'],
                compatibility['transition_type']
                ))
            return True
            
        except Exception as e:
            logger.error(f"Error saving mix compatibility: {e}")
            return False

    def get_hamms_data(self, track_id: int) -> Optional[Dict]:
        """Fetch HAMMS analysis row for a given track id.

        Returns a dict with keys: vector_12d (list[float]), tempo_stability, harmonic_complexity,
        dynamic_range, energy_curve (list), transition_points (list), genre_cluster, ml_confidence.
        Returns None if not found or on error.
        """
        try:
            cursor = self.conn.execute(
                'SELECT vector_12d, tempo_stability, harmonic_complexity, dynamic_range, energy_curve, transition_points, genre_cluster, ml_confidence FROM hamms_advanced WHERE file_id = ?',
                (track_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            # Parse JSON fields
            def _parse_json(val):
                try:
                    return json.loads(val) if isinstance(val, (str, bytes)) else val
                except Exception:
                    return []
            return {
                'vector_12d': _parse_json(row['vector_12d']) if 'vector_12d' in row.keys() else _parse_json(row[0]),
                'tempo_stability': row['tempo_stability'] if 'tempo_stability' in row.keys() else row[1],
                'harmonic_complexity': row['harmonic_complexity'] if 'harmonic_complexity' in row.keys() else row[2],
                'dynamic_range': row['dynamic_range'] if 'dynamic_range' in row.keys() else row[3],
                'energy_curve': _parse_json(row['energy_curve']) if 'energy_curve' in row.keys() else _parse_json(row[4]),
                'transition_points': _parse_json(row['transition_points']) if 'transition_points' in row.keys() else _parse_json(row[5]),
                'genre_cluster': row['genre_cluster'] if 'genre_cluster' in row.keys() else row[6],
                'ml_confidence': row['ml_confidence'] if 'ml_confidence' in row.keys() else row[7],
            }
        except Exception as e:
            logger.error(f"Error fetching HAMMS data for {track_id}: {e}")
            return None
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
