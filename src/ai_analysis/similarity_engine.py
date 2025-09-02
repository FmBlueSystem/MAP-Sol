"""
Similarity engine combining HAMMS (harmonic/BPM/energy) with AI features (mood/genre).
"""

import sqlite3
from typing import List, Dict, Optional
import math


class SimilarityEngine:
    """Calculate track similarity using hybrid HAMMS + AI features."""
    
    def __init__(self, db_path: str | None = None):
        """
        Initialize the similarity engine.
        
        Args:
            db_path: Path to the database (or :memory: for testing)
        """
        self.db_path = db_path or ':memory:'
    
    def similar_to(self, track_id: int, top_k: int = 20) -> List[Dict]:
        """
        Find similar tracks to the given track.
        
        Args:
            track_id: Anchor track ID
            top_k: Number of similar tracks to return
            
        Returns:
            List of similar tracks sorted by distance (ascending, best first)
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        try:
            # Get anchor track features
            anchor = self._get_track_features(conn, track_id)
            if not anchor:
                return []
            
            # Get all candidate tracks (exclude anchor, require bpm and key)
            cursor = conn.execute('''
                SELECT 
                    t.id, t.file_path as filepath, t.title, t.artist,
                    t.bpm, t.camelot_key, t.energy_level,
                    a.mood, a.genre
                FROM tracks t
                LEFT JOIN ai_analysis a ON t.id = a.track_id
                WHERE t.id != ?
                AND t.bpm IS NOT NULL
                AND t.camelot_key IS NOT NULL
            ''', (track_id,))
            
            candidates = cursor.fetchall()
            
            # Calculate distances
            results = []
            for candidate in candidates:
                distance = self._calculate_distance(anchor, dict(candidate))
                
                results.append({
                    'id': candidate['id'],
                    'filepath': candidate['filepath'],
                    'title': candidate['title'] or 'Unknown',
                    'artist': candidate['artist'] or 'Unknown',
                    'bpm': candidate['bpm'],
                    'camelot_key': candidate['camelot_key'],
                    'energy_level': candidate['energy_level'] or 5,
                    'mood': candidate['mood'],
                    'genre': candidate['genre'],
                    'distance': distance
                })
            
            # Sort by distance and return top_k
            results.sort(key=lambda x: x['distance'])
            return results[:top_k]
            
        finally:
            conn.close()
    
    def _get_track_features(self, conn, track_id: int) -> Optional[Dict]:
        """Get features for a single track."""
        cursor = conn.execute('''
            SELECT 
                t.id, t.bpm, t.camelot_key, t.energy_level,
                a.mood, a.genre
            FROM tracks t
            LEFT JOIN ai_analysis a ON t.id = a.track_id
            WHERE t.id = ?
        ''', (track_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def _calculate_distance(self, anchor: Dict, candidate: Dict) -> float:
        """
        Calculate composite distance between two tracks.
        
        Distance formula:
        d = 0.45*key_dist + 0.25*bpm_dist + 0.15*energy_dist + 0.1*(1-mood_sim) + 0.05*(1-genre_sim)
        """
        # BPM distance (normalized)
        bpm1 = anchor.get('bpm', 120)
        bpm2 = candidate.get('bpm', 120)
        bpm_norm1 = max(0, min(1, (bpm1 - 60) / 140))
        bpm_norm2 = max(0, min(1, (bpm2 - 60) / 140))
        bpm_dist = abs(bpm_norm1 - bpm_norm2)
        
        # Key distance (Camelot wheel)
        key1 = anchor.get('camelot_key', '8A')
        key2 = candidate.get('camelot_key', '8A')
        key_dist = self._camelot_distance(key1, key2)
        
        # Energy distance (normalized)
        energy1 = anchor.get('energy_level', 5) / 10.0
        energy2 = candidate.get('energy_level', 5) / 10.0
        energy_dist = abs(energy1 - energy2)
        
        # Mood similarity (binary for now)
        mood1 = anchor.get('mood', '')
        mood2 = candidate.get('mood', '')
        mood_sim = 1.0 if mood1 and mood2 and mood1 == mood2 else 0.0
        
        # Genre similarity
        genre1 = (anchor.get('genre') or '').lower()
        genre2 = (candidate.get('genre') or '').lower()
        genre_sim = self._genre_similarity(genre1, genre2)
        
        # Composite distance
        distance = (
            0.45 * key_dist +
            0.25 * bpm_dist +
            0.15 * energy_dist +
            0.10 * (1 - mood_sim) +
            0.05 * (1 - genre_sim)
        )
        
        # Clamp to [0, 1]
        return max(0.0, min(1.0, distance))
    
    def _camelot_distance(self, key1: str, key2: str) -> float:
        """
        Calculate distance between two Camelot keys.
        
        Returns value between 0 (identical) and 1 (maximum distance).
        """
        if not key1 or not key2:
            return 0.5  # Unknown keys have moderate distance
        
        # Parse keys
        try:
            num1 = int(key1[:-1])
            mode1 = key1[-1]
            num2 = int(key2[:-1])
            mode2 = key2[-1]
        except (ValueError, IndexError):
            return 0.5
        
        # Same key
        if key1 == key2:
            return 0.0
        
        # Calculate minimum distance on wheel (mod 12)
        num_diff = abs(num1 - num2)
        wheel_dist = min(num_diff, 12 - num_diff)
        
        # Normalize wheel distance (max is 6)
        normalized_dist = wheel_dist / 6.0
        
        # Add penalty for different mode (A vs B)
        if mode1 != mode2:
            normalized_dist += 0.3
        
        # Clamp to [0, 1]
        return min(1.0, normalized_dist)
    
    def _genre_similarity(self, genre1: str, genre2: str) -> float:
        """
        Calculate genre similarity.
        
        Returns:
            1.0 if identical
            0.7 if one is substring of other
            0.0 if completely different
        """
        if not genre1 or not genre2:
            return 0.0
        
        if genre1 == genre2:
            return 1.0
        
        # Check substring match (e.g., "Tech House" vs "House")
        if genre1 in genre2 or genre2 in genre1:
            return 0.7
        
        return 0.0