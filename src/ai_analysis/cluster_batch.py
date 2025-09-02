"""
Batch processor for library clustering.
"""

from typing import Dict, Optional
from ai_analysis.cluster_engine import ClusterEngine
from database import MusicDatabase


class ClusterBatch:
    """Batch processor for track clustering."""
    
    def __init__(self, db_path: str, n_clusters: int = 12):
        """
        Initialize the batch processor.
        
        Args:
            db_path: Path to the database
            n_clusters: Number of clusters to create
        """
        self.db_path = db_path
        self.n_clusters = n_clusters
    
    def process_all(self) -> Dict:
        """
        Process all tracks and assign to clusters.
        
        Returns:
            Dict with clustering statistics
        """
        try:
            # Create cluster engine
            engine = ClusterEngine(self.db_path, n_clusters=self.n_clusters)
            
            # Fit and get assignments
            assignments = engine.fit_and_assign()
            
            if not assignments:
                return {
                    'success': False,
                    'error': 'No valid tracks for clustering',
                    'n_clusters': 0,
                    'total_tracks': 0
                }
            
            # Convert to list of tuples for database
            assignment_tuples = []
            for cluster_id, track_ids in assignments.items():
                for track_id in track_ids:
                    # Confidence is 1.0 for all (could be enhanced with distance to centroid)
                    assignment_tuples.append((track_id, cluster_id, 1.0))
            
            # Save to database
            db = MusicDatabase(self.db_path)
            saved = db.save_track_clusters(assignment_tuples)
            db.close()
            
            # Get statistics
            stats = engine.get_cluster_stats(assignments)
            stats['success'] = True
            stats['saved'] = saved
            
            return stats
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'n_clusters': 0,
                'total_tracks': 0
            }
    
    def get_progress_stats(self) -> Dict:
        """
        Get clustering coverage statistics.
        
        Returns:
            Dict with clustering stats
        """
        try:
            db = MusicDatabase(self.db_path)
            
            # Total tracks with required features
            total_query = '''
                SELECT COUNT(*)
                FROM tracks
                WHERE bpm IS NOT NULL
                AND camelot_key IS NOT NULL
            '''
            total = db.conn.execute(total_query).fetchone()[0]
            
            # Tracks with cluster assignments
            clustered = db.conn.execute('''
                SELECT COUNT(*)
                FROM track_clusters
            ''').fetchone()[0]
            
            # Get cluster list
            clusters = db.list_clusters()
            
            db.close()
            
            percentage = (clustered / total * 100) if total > 0 else 0
            
            return {
                'total': total,
                'clustered': clustered,
                'remaining': total - clustered,
                'percentage': percentage,
                'n_clusters': len(clusters),
                'clusters': clusters
            }
            
        except Exception as e:
            print(f"Error getting progress stats: {e}")
            return {
                'total': 0,
                'clustered': 0,
                'remaining': 0,
                'percentage': 0,
                'n_clusters': 0,
                'clusters': []
            }