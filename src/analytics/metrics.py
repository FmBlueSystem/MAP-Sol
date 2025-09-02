"""
Library metrics and analytics calculations.
"""

import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import numpy as np


class LibraryMetrics:
    """Calculate library metrics and distributions."""
    
    def __init__(self, db_path: str):
        """
        Initialize metrics calculator.
        
        Args:
            db_path: Path to the database
        """
        self.db_path = Path(db_path)
    
    def summary(self) -> Dict:
        """
        Get summary statistics for the library.
        
        Returns:
            Dict with total tracks, AI coverage, loudness coverage, playlists, clusters
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # Total tracks
            total_tracks = conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
            
            # Tracks with AI analysis
            with_ai = conn.execute("""
                SELECT COUNT(DISTINCT t.id) 
                FROM tracks t
                INNER JOIN ai_analysis a ON t.id = a.track_id
            """).fetchone()[0]
            
            # Tracks with loudness analysis
            with_loudness = conn.execute("""
                SELECT COUNT(DISTINCT t.id)
                FROM tracks t
                INNER JOIN loudness_analysis l ON t.id = l.track_id
            """).fetchone()[0]
            
            # Tracks with HAMMS vectors (check if hamms_advanced exists)
            with_hamms = 0
            try:
                with_hamms = conn.execute("""
                    SELECT COUNT(DISTINCT t.id)
                    FROM tracks t
                    INNER JOIN hamms_advanced h ON t.id = h.track_id
                    WHERE h.vector_12d IS NOT NULL
                """).fetchone()[0]
            except sqlite3.OperationalError:
                # Table doesn't exist
                pass
            
            # Number of playlists
            num_playlists = conn.execute("SELECT COUNT(*) FROM playlists").fetchone()[0]
            
            # Number of clusters
            num_clusters = conn.execute("""
                SELECT COUNT(DISTINCT cluster_id) FROM track_clusters
            """).fetchone()[0]
            
            return {
                'total_tracks': total_tracks,
                'with_ai': with_ai,
                'with_loudness': with_loudness,
                'with_hamms': with_hamms,
                'num_playlists': num_playlists,
                'num_clusters': num_clusters,
                'percent_ai': (with_ai / total_tracks * 100) if total_tracks > 0 else 0,
                'percent_loudness': (with_loudness / total_tracks * 100) if total_tracks > 0 else 0,
                'percent_hamms': (with_hamms / total_tracks * 100) if total_tracks > 0 else 0
            }
        finally:
            conn.close()
    
    def distribution_bpm(self, bins: int = 10) -> Tuple[List[float], List[int]]:
        """
        Get BPM distribution as histogram.
        
        Args:
            bins: Number of histogram bins
            
        Returns:
            Tuple of (bin_edges, counts)
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # Get all valid BPMs (60-200 range)
            bpms = conn.execute("""
                SELECT bpm FROM tracks 
                WHERE bpm IS NOT NULL AND bpm >= 60 AND bpm <= 200
            """).fetchall()
            
            if not bpms:
                # Return empty histogram
                edges = np.linspace(60, 200, bins + 1).tolist()
                counts = [0] * bins
                return edges, counts
            
            # Extract values
            bpm_values = [row[0] for row in bpms]
            
            # Create histogram
            counts, edges = np.histogram(bpm_values, bins=bins, range=(60, 200))
            
            return edges.tolist(), counts.tolist()
        finally:
            conn.close()
    
    def distribution_camelot(self) -> Dict[str, int]:
        """
        Get Camelot key distribution.
        
        Returns:
            Dict mapping Camelot key to count
        """
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute("""
                SELECT camelot_key, COUNT(*) as cnt
                FROM tracks
                WHERE camelot_key IS NOT NULL
                GROUP BY camelot_key
                ORDER BY camelot_key
            """).fetchall()
            
            return {row[0]: row[1] for row in rows}
        finally:
            conn.close()
    
    def distribution_energy(self) -> Dict[int, int]:
        """
        Get energy level distribution (1-10).
        
        Returns:
            Dict mapping energy level to count
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # Initialize all levels with 0
            distribution = {i: 0 for i in range(1, 11)}
            
            rows = conn.execute("""
                SELECT energy_level, COUNT(*) as cnt
                FROM tracks
                WHERE energy_level IS NOT NULL AND energy_level >= 1 AND energy_level <= 10
                GROUP BY energy_level
            """).fetchall()
            
            for energy, count in rows:
                distribution[int(energy)] = count
            
            return distribution
        finally:
            conn.close()
    
    def distribution_genre(self, top_n: int = 10) -> List[Tuple[str, int]]:
        """
        Get top N genre distribution.
        
        Args:
            top_n: Number of top genres to return
            
        Returns:
            List of (genre, count) tuples
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # Try AI analysis first, fallback to tracks.genre
            rows = conn.execute("""
                SELECT genre, COUNT(*) as cnt
                FROM (
                    SELECT COALESCE(a.genre, t.genre) as genre
                    FROM tracks t
                    LEFT JOIN ai_analysis a ON t.id = a.track_id
                    WHERE COALESCE(a.genre, t.genre) IS NOT NULL
                )
                GROUP BY genre
                ORDER BY cnt DESC
                LIMIT ?
            """, (top_n,)).fetchall()
            
            return [(row[0], row[1]) for row in rows]
        finally:
            conn.close()
    
    def distribution_mood(self, top_n: int = 10) -> List[Tuple[str, int]]:
        """
        Get top N mood distribution.
        
        Args:
            top_n: Number of top moods to return
            
        Returns:
            List of (mood, count) tuples
        """
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute("""
                SELECT mood, COUNT(*) as cnt
                FROM ai_analysis
                WHERE mood IS NOT NULL
                GROUP BY mood
                ORDER BY cnt DESC
                LIMIT ?
            """, (top_n,)).fetchall()
            
            return [(row[0], row[1]) for row in rows]
        finally:
            conn.close()
    
    def cluster_sizes(self) -> Dict[int, int]:
        """
        Get cluster size distribution.
        
        Returns:
            Dict mapping cluster_id to size
        """
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute("""
                SELECT cluster_id, COUNT(*) as size
                FROM track_clusters
                GROUP BY cluster_id
                ORDER BY cluster_id
            """).fetchall()
            
            return {row[0]: row[1] for row in rows}
        finally:
            conn.close()