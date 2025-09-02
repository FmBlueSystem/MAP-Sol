"""
Batch processor for loudness analysis of music library.
"""

import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
import sqlite3


class LoudnessBatchProcessor:
    """Process multiple audio files for loudness analysis in parallel."""
    
    def __init__(self, db_path: str, target_lufs: float = -18.0, max_parallel: int = 2):
        """
        Initialize the batch processor.
        
        Args:
            db_path: Path to the database
            target_lufs: Target loudness level for normalization
            max_parallel: Maximum number of parallel analysis threads
        """
        self.db_path = db_path
        self.target_lufs = target_lufs
        self.max_parallel = max_parallel
    
    def process_missing(self, limit: Optional[int] = None) -> int:
        """
        Process tracks that don't have loudness analysis yet.
        
        Args:
            limit: Maximum number of tracks to process (None = all)
            
        Returns:
            Number of tracks processed
        """
        # Import here to avoid circular dependency
        from audio.loudness_analyzer import LoudnessAnalyzer
        from database import MusicDatabase
        
        # Get tracks without loudness analysis
        tracks_to_process = self._get_unprocessed_tracks(limit)
        
        if not tracks_to_process:
            return 0
        
        processed_count = 0
        analyzer = LoudnessAnalyzer()
        
        # Process in parallel using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=self.max_parallel) as executor:
            # Submit analysis tasks
            futures = {}
            for track_id, filepath in tracks_to_process:
                if filepath and os.path.exists(filepath):
                    future = executor.submit(
                        self._analyze_track,
                        analyzer,
                        track_id,
                        filepath
                    )
                    futures[future] = (track_id, filepath)
            
            # Collect results
            for future in as_completed(futures):
                track_id, filepath = futures[future]
                try:
                    success = future.result()
                    if success:
                        processed_count += 1
                        print(f"Analyzed track {track_id}: {Path(filepath).name}")
                except Exception as e:
                    print(f"Failed to analyze track {track_id}: {e}")
        
        return processed_count
    
    def _get_unprocessed_tracks(self, limit: Optional[int] = None) -> list:
        """
        Get list of tracks without loudness analysis.
        
        Args:
            limit: Maximum number of tracks to return
            
        Returns:
            List of (track_id, filepath) tuples
        """
        tracks = []
        
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Query for tracks without loudness analysis
            query = '''
                SELECT t.id, t.file_path
                FROM tracks t
                LEFT JOIN loudness_analysis l ON t.id = l.track_id
                WHERE l.track_id IS NULL
                AND t.file_path IS NOT NULL
            '''
            
            if limit:
                query += f' LIMIT {limit}'
            
            cursor = conn.execute(query)
            tracks = cursor.fetchall()
            
            conn.close()
            
        except Exception as e:
            print(f"Error getting unprocessed tracks: {e}")
        
        return tracks
    
    def _analyze_track(self, analyzer, track_id: int, filepath: str) -> bool:
        """
        Analyze a single track and store results.
        
        Args:
            analyzer: LoudnessAnalyzer instance
            track_id: Track ID in database
            filepath: Path to audio file
            
        Returns:
            True if successful
        """
        try:
            # Import here to avoid circular dependency
            from database import MusicDatabase
            
            # Analyze and store
            db = MusicDatabase(self.db_path)
            metrics = analyzer.analyze_and_store(db, track_id, filepath)
            db.close()
            
            return metrics is not None
            
        except Exception as e:
            print(f"Error analyzing track {track_id}: {e}")
            return False
    
    def get_progress_stats(self) -> dict:
        """
        Get statistics about loudness analysis progress.
        
        Returns:
            Dict with total tracks, analyzed tracks, and percentage
        """
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Total tracks
            total = conn.execute('SELECT COUNT(*) FROM tracks').fetchone()[0]
            
            # Analyzed tracks
            analyzed = conn.execute('SELECT COUNT(*) FROM loudness_analysis').fetchone()[0]
            
            conn.close()
            
            percentage = (analyzed / total * 100) if total > 0 else 0
            
            return {
                'total': total,
                'analyzed': analyzed,
                'remaining': total - analyzed,
                'percentage': percentage
            }
            
        except Exception as e:
            print(f"Error getting progress stats: {e}")
            return {
                'total': 0,
                'analyzed': 0,
                'remaining': 0,
                'percentage': 0
            }