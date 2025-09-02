"""
Batch processor for similarity calculations across music library.
"""

import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
from ai_analysis.similarity_engine import SimilarityEngine
from database import MusicDatabase


class SimilarityBatch:
    """Process similarity calculations for multiple tracks in parallel."""
    
    def __init__(self, db_path: str, top_k: int = 20, max_parallel: int = 2):
        """
        Initialize the batch processor.
        
        Args:
            db_path: Path to the database
            top_k: Number of similar tracks to store per track
            max_parallel: Maximum number of parallel processing threads
        """
        self.db_path = db_path
        self.top_k = top_k
        self.max_parallel = max_parallel
    
    def process_all(self, limit: Optional[int] = None) -> int:
        """
        Process similarity for all tracks in the library.
        
        Args:
            limit: Maximum number of tracks to process (None = all)
            
        Returns:
            Number of tracks processed
        """
        # Get all track IDs
        track_ids = self._get_track_ids(limit)
        
        if not track_ids:
            return 0
        
        processed_count = 0
        engine = SimilarityEngine(self.db_path)
        
        # Process in parallel using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=self.max_parallel) as executor:
            # Submit similarity calculation tasks
            futures = {}
            for track_id in track_ids:
                future = executor.submit(
                    self._process_track,
                    engine,
                    track_id
                )
                futures[future] = track_id
            
            # Collect results
            for future in as_completed(futures):
                track_id = futures[future]
                try:
                    success = future.result()
                    if success:
                        processed_count += 1
                        print(f"Processed similarity for track {track_id}")
                except Exception as e:
                    print(f"Failed to process track {track_id}: {e}")
        
        return processed_count
    
    def _get_track_ids(self, limit: Optional[int] = None) -> list:
        """
        Get list of track IDs to process.
        
        Args:
            limit: Maximum number of tracks to return
            
        Returns:
            List of track IDs
        """
        track_ids = []
        
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Query for tracks with BPM and key (required for similarity)
            query = '''
                SELECT id
                FROM tracks
                WHERE bpm IS NOT NULL
                AND camelot_key IS NOT NULL
            '''
            
            if limit:
                query += f' LIMIT {limit}'
            
            cursor = conn.execute(query)
            track_ids = [row[0] for row in cursor.fetchall()]
            
            conn.close()
            
        except Exception as e:
            print(f"Error getting track IDs: {e}")
        
        return track_ids
    
    def _process_track(self, engine: SimilarityEngine, track_id: int) -> bool:
        """
        Process similarity for a single track and store results.
        
        Args:
            engine: SimilarityEngine instance
            track_id: Track ID to process
            
        Returns:
            True if successful
        """
        try:
            # Find similar tracks
            similar = engine.similar_to(track_id, top_k=self.top_k)
            
            if similar:
                # Save to database
                db = MusicDatabase(self.db_path)
                saved = db.save_similar_tracks(track_id, similar)
                db.close()
                
                return saved > 0
            
            return False
            
        except Exception as e:
            print(f"Error processing track {track_id}: {e}")
            return False
    
    def get_progress_stats(self) -> dict:
        """
        Get statistics about similarity processing progress.
        
        Returns:
            Dict with total tracks, processed tracks, and percentage
        """
        try:
            conn = sqlite3.connect(self.db_path)
            
            # Total tracks with required features
            total_query = '''
                SELECT COUNT(*)
                FROM tracks
                WHERE bpm IS NOT NULL
                AND camelot_key IS NOT NULL
            '''
            total = conn.execute(total_query).fetchone()[0]
            
            # Tracks with similarity data
            processed = conn.execute('''
                SELECT COUNT(DISTINCT track_id)
                FROM similar_tracks
            ''').fetchone()[0]
            
            conn.close()
            
            percentage = (processed / total * 100) if total > 0 else 0
            
            return {
                'total': total,
                'processed': processed,
                'remaining': total - processed,
                'percentage': percentage
            }
            
        except Exception as e:
            print(f"Error getting progress stats: {e}")
            return {
                'total': 0,
                'processed': 0,
                'remaining': 0,
                'percentage': 0
            }