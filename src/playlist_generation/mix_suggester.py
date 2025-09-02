"""
Harmonic mix suggester for finding compatible tracks.
"""

import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
from playlist_generation.harmonic_engine import HarmonicEngine


class HarmonicMixSuggester:
    """Suggest harmonically compatible tracks for mixing."""
    
    def __init__(self, db_path: str = None):
        """Initialize the mix suggester with database connection."""
        self.harmonic_engine = HarmonicEngine()
        
        # Determine database path
        if db_path is None:
            try:
                db_dir = Path.home() / '.music_player_qt'
                self.db_path = str(db_dir / 'music_library.db')
            except Exception:
                db_dir = Path.cwd() / '.music_player_qt'
                self.db_path = str(db_dir / 'music_library.db')
        else:
            self.db_path = db_path
    
    def suggest_next_tracks(self, current_track: dict, limit: int = 20) -> List[Dict]:
        """
        Suggest next tracks compatible with the current track.
        
        Args:
            current_track: Dict with at least id, bpm, camelot_key, energy_level
            limit: Maximum number of suggestions to return
            
        Returns:
            List of track dicts with scores, sorted by score descending
        """
        # Get current track features
        current_id = current_track.get('id')
        current_bpm = float(current_track.get('bpm', 120))
        current_key = current_track.get('camelot_key')
        current_energy = float(current_track.get('energy_level', 5)) / 10.0
        
        if not current_key or not current_bpm:
            return []
        
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        try:
            # Get all candidate tracks except current
            query = """
                SELECT id, file_path, title, artist, bpm, camelot_key, energy_level
                FROM tracks
                WHERE id != ? AND camelot_key IS NOT NULL AND bpm IS NOT NULL
            """
            
            cursor = conn.execute(query, (current_id,) if current_id else (-1,))
            candidates = []
            
            for row in cursor.fetchall():
                track = {
                    'id': row['id'],
                    'filepath': row['file_path'],
                    'title': row['title'],
                    'artist': row['artist'],
                    'bpm': float(row['bpm']),
                    'camelot_key': row['camelot_key'],
                    'energy_level': int(row['energy_level']) if row['energy_level'] else 5
                }
                
                # Calculate score
                score = self._calculate_score(
                    current_bpm, current_key, current_energy,
                    track['bpm'], track['camelot_key'], track['energy_level'] / 10.0
                )
                
                track['score'] = score
                candidates.append(track)
            
            # Sort by score descending and limit
            candidates.sort(key=lambda x: x['score'], reverse=True)
            return candidates[:limit]
            
        finally:
            conn.close()
    
    def _calculate_score(self, from_bpm: float, from_key: str, from_energy: float,
                        to_bpm: float, to_key: str, to_energy: float) -> float:
        """
        Calculate compatibility score between two tracks.
        
        Uses weighted combination:
        - Harmonic compatibility: 50%
        - BPM compatibility: 30%
        - Energy compatibility: 20%
        """
        score = 0.0
        
        # Harmonic score (50%)
        harmonic_score = self.harmonic_engine.compatibility_score(from_key, to_key)
        score += harmonic_score * 0.5
        
        # BPM score (30%)
        if self.harmonic_engine.bpm_compatible(from_bpm, to_bpm, 'flexible'):
            bpm_delta = abs(to_bpm - from_bpm)
            bpm_score = max(0.0, 1 - (bpm_delta / from_bpm) / 0.06)
            score += bpm_score * 0.3
        
        # Energy score (20%)
        energy_delta = abs(to_energy - from_energy)
        energy_score = 1 - energy_delta
        score += energy_score * 0.2
        
        return score