#!/usr/bin/env python3
"""
Genre Clustering Module using K-means
Automatically detects and clusters music genres based on HAMMS vectors
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import json
try:
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
except Exception:  # sklearn not available in some environments (e.g., sandbox/tests)
    KMeans = None
    StandardScaler = None
    PCA = None
import sqlite3
from pathlib import Path


class GenreClusterer:
    """Automatic genre detection using K-means clustering on HAMMS vectors"""
    
    def __init__(self, db_path=None, n_clusters=10):
        """
        Initialize genre clusterer
        
        Args:
            db_path: Path to database
            n_clusters: Number of genre clusters to create
        """
        if db_path is None:
            db_dir = Path.home() / '.music_player_qt'
            db_path = db_dir / 'music_library.db'
        
        self.db_path = db_path
        self.n_clusters = n_clusters
        self.kmeans = None
        # Lazy/optional sklearn setup
        self.scaler = StandardScaler() if StandardScaler else None
        self.pca = PCA(n_components=5) if PCA else None
        self.cluster_names = {}
        self.cluster_characteristics = {}
    
    def get_all_vectors(self) -> Tuple[List[int], np.ndarray]:
        """
        Get all HAMMS vectors from database
        
        Returns:
            Tuple of (track_ids, vectors_array)
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.execute("""
            SELECT file_id, vector_12d 
            FROM hamms_advanced 
            WHERE vector_12d IS NOT NULL
        """)
        
        track_ids = []
        vectors = []
        
        for row in cursor.fetchall():
            track_ids.append(row[0])
            vector = json.loads(row[1])
            vectors.append(vector)
        
        conn.close()
        
        if not vectors:
            return [], np.array([])
        
        return track_ids, np.array(vectors)
    
    def cluster_tracks(self) -> Dict:
        """
        Perform K-means clustering on all tracks
        
        Returns:
            Dictionary with clustering results
        """
        # Get all vectors
        track_ids, vectors = self.get_all_vectors()
        
        if len(vectors) < self.n_clusters:
            print(f"Not enough tracks ({len(vectors)}) for {self.n_clusters} clusters")
            self.n_clusters = min(len(vectors), 3)
        
        if len(vectors) == 0:
            return {'success': False, 'message': 'No tracks to cluster'}
        
        if not (KMeans and self.scaler and self.pca):
            return {'success': False, 'message': 'sklearn not available'}

        # Standardize features
        vectors_scaled = self.scaler.fit_transform(vectors)

        # Reduce dimensionality
        vectors_reduced = self.pca.fit_transform(vectors_scaled)

        # Perform K-means clustering
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10
        )
        cluster_labels = self.kmeans.fit_predict(vectors_reduced)
        
        # Analyze clusters
        self._analyze_clusters(track_ids, vectors, cluster_labels)
        
        # Update database with cluster assignments
        self._update_database_clusters(track_ids, cluster_labels)
        
        # Save cluster information
        self._save_cluster_info()
        
        return {
            'success': True,
            'n_clusters': self.n_clusters,
            'n_tracks': len(track_ids),
            'cluster_names': self.cluster_names,
            'cluster_sizes': self._get_cluster_sizes(cluster_labels)
        }
    
    def _analyze_clusters(self, track_ids: List[int], vectors: np.ndarray, labels: np.ndarray):
        """Analyze characteristics of each cluster"""
        conn = sqlite3.connect(str(self.db_path))
        
        for cluster_id in range(self.n_clusters):
            # Get tracks in this cluster
            cluster_mask = labels == cluster_id
            cluster_track_ids = [track_ids[i] for i, mask in enumerate(cluster_mask) if mask]
            cluster_vectors = vectors[cluster_mask]
            
            if len(cluster_vectors) == 0:
                continue
            
            # Calculate cluster centroid
            centroid = np.mean(cluster_vectors, axis=0)
            
            # Get track metadata for naming
            cursor = conn.execute("""
                SELECT bpm, initial_key, energy_level, genre
                FROM tracks
                WHERE id IN ({})
            """.format(','.join('?' * len(cluster_track_ids))), cluster_track_ids)
            
            tracks_data = cursor.fetchall()
            
            # Analyze cluster characteristics
            if tracks_data:
                avg_bpm = np.mean([t[0] for t in tracks_data if t[0]])
                common_keys = self._most_common([t[1] for t in tracks_data if t[1]])
                avg_energy = np.mean([t[2] for t in tracks_data if t[2]]) / 10
                genres = [t[3] for t in tracks_data if t[3]]
                
                # Generate cluster name based on characteristics
                cluster_name = self._generate_cluster_name(
                    avg_bpm, avg_energy, common_keys, genres
                )
                
                self.cluster_names[cluster_id] = cluster_name
                self.cluster_characteristics[cluster_id] = {
                    'centroid': centroid.tolist(),
                    'avg_bpm': float(avg_bpm) if avg_bpm else 120,
                    'dominant_keys': common_keys[:3],
                    'avg_energy': float(avg_energy) if avg_energy else 0.5,
                    'member_count': len(cluster_track_ids),
                    'common_genres': self._most_common(genres)[:3]
                }
        
        conn.close()
    
    def _generate_cluster_name(self, avg_bpm: float, avg_energy: float, 
                              keys: List[str], genres: List[str]) -> str:
        """Generate descriptive name for cluster"""
        # Check if there's a dominant genre
        if genres and len(set(genres)) == 1:
            return genres[0]
        
        # Generate name based on characteristics
        tempo_desc = ""
        if avg_bpm:
            if avg_bpm < 100:
                tempo_desc = "Slow"
            elif avg_bpm < 120:
                tempo_desc = "Moderate"
            elif avg_bpm < 130:
                tempo_desc = "Upbeat"
            elif avg_bpm < 140:
                tempo_desc = "Fast"
            else:
                tempo_desc = "Very Fast"
        
        energy_desc = ""
        if avg_energy:
            if avg_energy < 0.3:
                energy_desc = "Chill"
            elif avg_energy < 0.5:
                energy_desc = "Mellow"
            elif avg_energy < 0.7:
                energy_desc = "Energetic"
            else:
                energy_desc = "High Energy"
        
        # Combine descriptors
        if tempo_desc and energy_desc:
            return f"{energy_desc} {tempo_desc}"
        elif tempo_desc:
            return tempo_desc
        elif energy_desc:
            return energy_desc
        else:
            return f"Cluster {len(self.cluster_names) + 1}"
    
    def _most_common(self, items: List, n: int = 1) -> List:
        """Get most common items from list"""
        if not items:
            return []
        
        from collections import Counter
        counter = Counter(items)
        return [item for item, _ in counter.most_common(n)]
    
    def _get_cluster_sizes(self, labels: np.ndarray) -> Dict[int, int]:
        """Get size of each cluster"""
        unique, counts = np.unique(labels, return_counts=True)
        return dict(zip(unique, counts))
    
    def _update_database_clusters(self, track_ids: List[int], labels: np.ndarray):
        """Update database with cluster assignments"""
        conn = sqlite3.connect(str(self.db_path))
        
        for track_id, cluster_id in zip(track_ids, labels):
            conn.execute("""
                UPDATE hamms_advanced
                SET genre_cluster = ?
                WHERE file_id = ?
            """, (int(cluster_id), track_id))
        
        conn.commit()
        conn.close()
    
    def _save_cluster_info(self):
        """Save cluster information to database"""
        conn = sqlite3.connect(str(self.db_path))
        
        # Clear existing clusters
        conn.execute("DELETE FROM genre_clusters")
        
        # Insert new clusters
        for cluster_id, name in self.cluster_names.items():
            chars = self.cluster_characteristics.get(cluster_id, {})
            
            conn.execute("""
                INSERT INTO genre_clusters (
                    cluster_id, cluster_name, centroid_vector,
                    member_count, avg_bpm, dominant_keys, energy_profile
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                cluster_id,
                name,
                json.dumps(chars.get('centroid', [])),
                chars.get('member_count', 0),
                chars.get('avg_bpm', 120),
                json.dumps(chars.get('dominant_keys', [])),
                json.dumps({'avg_energy': chars.get('avg_energy', 0.5)})
            ))
        
        conn.commit()
        conn.close()
    
    def predict_cluster(self, vector: np.ndarray) -> Tuple[int, str]:
        """
        Predict cluster for a new track
        
        Args:
            vector: 12D HAMMS vector
            
        Returns:
            Tuple of (cluster_id, cluster_name)
        """
        if self.kmeans is None:
            # Load or train model
            self.cluster_tracks()
        
        if self.kmeans is None:
            return 0, "Uncategorized"
        
        # Prepare vector
        vector_scaled = self.scaler.transform([vector])
        vector_reduced = self.pca.transform(vector_scaled)
        
        # Predict cluster
        cluster_id = self.kmeans.predict(vector_reduced)[0]
        cluster_name = self.cluster_names.get(cluster_id, f"Cluster {cluster_id}")
        
        return cluster_id, cluster_name
    
    def get_cluster_tracks(self, cluster_id: int) -> List[Dict]:
        """
        Get all tracks in a specific cluster
        
        Returns:
            List of track dictionaries
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.execute("""
            SELECT t.id, t.title, t.artist, t.bpm, t.initial_key, t.energy_level
            FROM tracks t
            JOIN hamms_advanced h ON t.id = h.file_id
            WHERE h.genre_cluster = ?
            ORDER BY t.artist, t.title
        """, (cluster_id,))
        
        tracks = []
        for row in cursor.fetchall():
            tracks.append({
                'id': row[0],
                'title': row[1],
                'artist': row[2],
                'bpm': row[3],
                'key': row[4],
                'energy': row[5]
            })
        
        conn.close()
        return tracks
    
    def get_similar_clusters(self, cluster_id: int, n: int = 3) -> List[Tuple[int, float]]:
        """
        Find similar clusters based on centroid distance
        
        Returns:
            List of (cluster_id, similarity_score) tuples
        """
        if cluster_id not in self.cluster_characteristics:
            return []
        
        source_centroid = np.array(self.cluster_characteristics[cluster_id]['centroid'])
        similarities = []
        
        for other_id, chars in self.cluster_characteristics.items():
            if other_id == cluster_id:
                continue
            
            other_centroid = np.array(chars['centroid'])
            distance = np.linalg.norm(source_centroid - other_centroid)
            similarity = 1 / (1 + distance)  # Convert distance to similarity
            similarities.append((other_id, similarity))
        
        # Sort by similarity and return top n
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:n]
