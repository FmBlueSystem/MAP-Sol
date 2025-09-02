"""
Clustering engine for automatic library organization using HAMMS + AI features.
"""

import sqlite3
import numpy as np
import json
from typing import Dict, List, Optional, Tuple

try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class ClusterEngine:
    """Cluster tracks using HAMMS vectors or fallback features."""
    
    def __init__(self, db_path: str, n_clusters: int = 12, random_state: int = 42):
        """
        Initialize the cluster engine.
        
        Args:
            db_path: Path to the database
            n_clusters: Number of clusters to create
            random_state: Random seed for reproducibility
        """
        self.db_path = db_path
        self.n_clusters = n_clusters
        self.random_state = random_state
    
    def build_features(self, track_row: dict) -> Optional[np.ndarray]:
        """
        Build feature vector for a track.
        
        Priority:
        1. Use hamms_advanced.vector_12d if available
        2. Fallback to hand-crafted features
        
        Args:
            track_row: Track data from database
            
        Returns:
            Feature vector or None if insufficient data
        """
        # Try to use HAMMS vector first
        if track_row.get('vector_12d'):
            try:
                # Parse JSON vector
                vector = json.loads(track_row['vector_12d'])
                return np.array(vector)
            except (json.JSONDecodeError, TypeError):
                pass
        
        # Fallback to hand-crafted features
        bpm = track_row.get('bpm')
        camelot_key = track_row.get('camelot_key')
        energy_level = track_row.get('energy_level')
        
        # Require minimum features
        if bpm is None or camelot_key is None:
            return None
        
        features = []
        
        # BPM normalized
        bpm_norm = max(0, min(1, (bpm - 60) / 140))
        features.append(bpm_norm)
        
        # Camelot position
        try:
            key_num = int(camelot_key[:-1])
            key_mode = camelot_key[-1]
            # Position on wheel (0-1)
            camelot_pos = (key_num - 1) / 12.0
            # Add 0.5 for B mode
            if key_mode == 'B':
                camelot_pos += 0.5
            features.append(camelot_pos % 1.0)
        except (ValueError, IndexError):
            features.append(0.5)  # Default middle position
        
        # Energy normalized
        energy_norm = (energy_level or 5) / 10.0
        features.append(energy_norm)
        
        # Mood one-hot (simple 4D)
        mood = (track_row.get('mood') or '').lower()
        mood_features = [0, 0, 0, 0]
        if 'driving' in mood:
            mood_features[0] = 1
        elif 'warm' in mood:
            mood_features[1] = 1
        elif 'dark' in mood:
            mood_features[2] = 1
        elif 'euphoric' in mood:
            mood_features[3] = 1
        features.extend(mood_features)
        
        # Genre similarity base
        genre = (track_row.get('genre') or '').lower()
        if 'techno' in genre:
            genre_sim = 1.0
        elif 'house' in genre:
            genre_sim = 0.7
        elif 'electronic' in genre:
            genre_sim = 0.4
        else:
            genre_sim = 0.0
        features.append(genre_sim)
        
        return np.array(features)
    
    def fit_and_assign(self) -> Dict[int, List[int]]:
        """
        Fit clustering model and assign tracks to clusters.
        
        Returns:
            Dict mapping cluster_id to list of track_ids
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        try:
            # Get all tracks with features
            cursor = conn.execute('''
                SELECT 
                    t.id, t.bpm, t.camelot_key, t.energy_level,
                    a.mood, a.genre,
                    NULL as vector_12d
                FROM tracks t
                LEFT JOIN ai_analysis a ON t.id = a.track_id
            ''')
            
            tracks = cursor.fetchall()
            
            # Build feature matrix
            valid_tracks = []
            feature_matrix = []
            
            for track in tracks:
                features = self.build_features(dict(track))
                if features is not None:
                    valid_tracks.append(track['id'])
                    feature_matrix.append(features)
            
            if len(valid_tracks) < self.n_clusters:
                # Not enough tracks for clustering
                # Put all in cluster 0
                return {0: valid_tracks} if valid_tracks else {}
            
            # Convert to numpy array
            X = np.array(feature_matrix)
            
            if HAS_SKLEARN:
                # Standardize features
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)
                
                # Perform clustering
                try:
                    # Use n_init='auto' if available (sklearn >= 1.4)
                    kmeans = KMeans(
                        n_clusters=self.n_clusters,
                        random_state=self.random_state,
                        n_init='auto'
                    )
                except (TypeError, ValueError):
                    # Fallback for older sklearn
                    kmeans = KMeans(
                        n_clusters=self.n_clusters,
                        random_state=self.random_state,
                        n_init=10
                    )
                
                labels = kmeans.fit_predict(X_scaled)
            else:
                # Simple fallback clustering without sklearn
                # Use simple distance-based grouping
                labels = self._simple_clustering(X, self.n_clusters)
            
            # Build cluster assignments
            assignments = {}
            for track_id, label in zip(valid_tracks, labels):
                cluster_id = int(label)
                if cluster_id not in assignments:
                    assignments[cluster_id] = []
                assignments[cluster_id].append(track_id)
            
            return assignments
            
        finally:
            conn.close()
    
    def _simple_clustering(self, X: np.ndarray, n_clusters: int) -> np.ndarray:
        """
        Simple clustering without sklearn.
        Groups tracks by sorting on first principal feature.
        """
        n_samples = X.shape[0]
        
        # Normalize features manually
        X_norm = X.copy()
        for i in range(X.shape[1]):
            col = X[:, i]
            col_min = col.min()
            col_max = col.max()
            if col_max > col_min:
                X_norm[:, i] = (col - col_min) / (col_max - col_min)
        
        # Simple approach: sort by weighted sum of features and divide into groups
        # Weight first features more (BPM, key position most important)
        weights = np.array([0.4, 0.3, 0.2] + [0.1 / (X.shape[1] - 3)] * (X.shape[1] - 3))
        weights = weights[:X.shape[1]]
        
        scores = np.dot(X_norm, weights)
        sorted_indices = np.argsort(scores)
        
        # Assign to clusters based on position in sorted list
        labels = np.zeros(n_samples, dtype=int)
        samples_per_cluster = n_samples // n_clusters
        
        for i, idx in enumerate(sorted_indices):
            cluster_id = min(i // max(1, samples_per_cluster), n_clusters - 1)
            labels[idx] = cluster_id
        
        return labels
    
    def get_cluster_stats(self, assignments: Dict[int, List[int]]) -> Dict:
        """
        Get statistics about cluster assignments.
        
        Args:
            assignments: Cluster assignments from fit_and_assign
            
        Returns:
            Dict with cluster statistics
        """
        stats = {
            'n_clusters': len(assignments),
            'total_tracks': sum(len(tracks) for tracks in assignments.values()),
            'cluster_sizes': {
                cluster_id: len(tracks)
                for cluster_id, tracks in assignments.items()
            },
            'avg_cluster_size': 0
        }
        
        if stats['n_clusters'] > 0:
            stats['avg_cluster_size'] = stats['total_tracks'] / stats['n_clusters']
        
        return stats