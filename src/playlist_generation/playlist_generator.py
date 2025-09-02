"""
Playlist generator using harmonic compatibility and HAMMS analysis.
"""

import sqlite3
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set, Union
from playlist_generation.harmonic_engine import HarmonicEngine
from playlist_generation.playlist_learner import PlaylistLearner


class PlaylistGenerator:
    """Generate playlists based on harmonic compatibility and musical features."""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize playlist generator with database connection."""
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
        
        # Initialize learner for preferences
        self.learner = None
        self.user_preferences = None
    
    def generate(self, 
                 start_track: Optional[Union[int, str, dict]] = None,
                 duration_minutes: float = 60,
                 playlist_type: str = 'harmonic_journey',
                 constraints: Optional[dict] = None) -> List[Dict]:
        """
        Generate a playlist based on the specified parameters.
        
        Args:
            start_track: Starting track (id, filepath, or dict/row). If None, select opener.
            duration_minutes: Target playlist duration in minutes.
            playlist_type: Type of playlist generation:
                - 'harmonic_journey': Prioritize Camelot + BPM with smooth energy progression
                - 'energy_progression': Prioritize increasing energy with acceptable harmony
                - 'mood_based': Prioritize maintaining mood/genre consistency
            constraints: Optional constraints dict with keys:
                - bpm_range: (min, max)
                - camelot_strictness: 'strict' or 'flexible'
                - allowed_genres: list of genres
                - allowed_moods: list of moods
                - exclude_ids: set of track IDs to exclude
                - max_tracks: maximum number of tracks
                
        Returns:
            List of track dicts with at least: id, filepath, title, artist, bpm, 
            camelot_key, energy_level, duration
        """
        constraints = constraints or {}
        target_duration_seconds = duration_minutes * 60
        
        # Parse constraints
        bpm_range = constraints.get('bpm_range', (60, 200))
        camelot_strictness = constraints.get('camelot_strictness', 'flexible')
        allowed_genres = constraints.get('allowed_genres')
        allowed_moods = constraints.get('allowed_moods')
        exclude_ids = constraints.get('exclude_ids', set())
        max_tracks = constraints.get('max_tracks', 100)
        
        # Get connection
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        # Load user preferences
        try:
            from database import MusicDatabase
            db = MusicDatabase(self.db_path)
            self.learner = PlaylistLearner(db)
            self.user_preferences = self.learner.get_preferences()
        except Exception:
            self.user_preferences = {}
        
        try:
            # Get start track
            if start_track is None:
                current_track = self._select_opener(conn, constraints)
                if not current_track:
                    return []
            else:
                current_track = self._get_track(conn, start_track)
                if not current_track:
                    return []
            
            # Initialize playlist with first track having transition_score 1.0
            current_track['transition_score'] = 1.0
            playlist = [current_track]
            used_ids = {current_track['id']}
            total_duration = float(current_track.get('duration', 240))
            
            # Generate playlist
            while total_duration < target_duration_seconds and len(playlist) < max_tracks:
                # Find candidates
                candidates = self._find_candidates(
                    conn, current_track, playlist_type, constraints, used_ids
                )
                
                if not candidates:
                    break
                
                # Score and pick next track with score
                weights = constraints.get('weights')
                next_track, transition_score = self._pick_next_with_score(
                    current_track, candidates, playlist_type, playlist, weights
                )
                
                if not next_track:
                    break
                
                # Add transition score to track
                next_track['transition_score'] = transition_score
                
                # Add to playlist
                playlist.append(next_track)
                used_ids.add(next_track['id'])
                total_duration += float(next_track.get('duration', 240))
                current_track = next_track
            
            return playlist
            
        finally:
            conn.close()
    
    def _select_opener(self, conn: sqlite3.Connection, constraints: dict) -> Optional[Dict]:
        """Select opening track based on constraints."""
        bpm_range = constraints.get('bpm_range', (60, 200))
        allowed_genres = constraints.get('allowed_genres')
        allowed_moods = constraints.get('allowed_moods')
        
        # Build query
        where_clauses = [
            "t.camelot_key IS NOT NULL",
            "t.bpm >= ? AND t.bpm <= ?"
        ]
        params = [bpm_range[0], bpm_range[1]]
        
        if allowed_genres:
            placeholders = ','.join(['?'] * len(allowed_genres))
            where_clauses.append(f"a.genre IN ({placeholders})")
            params.extend(allowed_genres)
        
        if allowed_moods:
            placeholders = ','.join(['?'] * len(allowed_moods))
            where_clauses.append(f"a.mood IN ({placeholders})")
            params.extend(allowed_moods)
        
        query = f"""
            SELECT t.id, t.file_path as filepath, t.title, t.artist, t.bpm, 
                   t.camelot_key, t.energy_level, t.duration, a.mood, a.genre
            FROM tracks t
            LEFT JOIN ai_analysis a ON a.track_id = t.id
            WHERE {' AND '.join(where_clauses)}
            ORDER BY t.energy_level ASC, ABS(t.bpm - ?) ASC
            LIMIT 1
        """
        
        # Add center BPM for secondary sort
        center_bpm = (bpm_range[0] + bpm_range[1]) / 2
        params.append(center_bpm)
        
        cursor = conn.execute(query, params)
        row = cursor.fetchone()
        
        if row:
            return self._row_to_dict(row)
        return None
    
    def _get_track(self, conn: sqlite3.Connection, track_ref: Union[int, str, dict]) -> Optional[Dict]:
        """Get track from database by various reference types."""
        if isinstance(track_ref, dict):
            # Already a dict, just ensure required fields
            return self._normalize_track(track_ref)
        
        # Build query based on reference type
        if isinstance(track_ref, int):
            query = """
                SELECT t.id, t.file_path as filepath, t.title, t.artist, t.bpm,
                       t.camelot_key, t.energy_level, t.duration, a.mood, a.genre
                FROM tracks t
                LEFT JOIN ai_analysis a ON a.track_id = t.id
                WHERE t.id = ?
            """
            params = [track_ref]
        else:  # string filepath
            query = """
                SELECT t.id, t.file_path as filepath, t.title, t.artist, t.bpm,
                       t.camelot_key, t.energy_level, t.duration, a.mood, a.genre
                FROM tracks t
                LEFT JOIN ai_analysis a ON a.track_id = t.id
                WHERE t.file_path = ?
            """
            params = [track_ref]
        
        cursor = conn.execute(query, params)
        row = cursor.fetchone()
        
        if row:
            return self._row_to_dict(row)
        return None
    
    def _find_candidates(self, conn: sqlite3.Connection, current_track: Dict,
                        playlist_type: str, constraints: dict,
                        used_ids: Set[int]) -> List[Dict]:
        """Find candidate tracks for next position."""
        bpm_range = constraints.get('bpm_range', (60, 200))
        
        # Get compatible keys for harmonic filtering
        if current_track.get('camelot_key'):
            compatible_keys = self.harmonic_engine.compatibles(
                current_track['camelot_key'], mode='perfect_good'
            )
        else:
            compatible_keys = []
        
        # Build query
        where_clauses = ["t.id NOT IN ({})".format(','.join(['?'] * len(used_ids)))]
        params = list(used_ids)
        
        # Add BPM range
        where_clauses.append("t.bpm >= ? AND t.bpm <= ?")
        params.extend([bpm_range[0], bpm_range[1]])
        
        # For harmonic modes, filter by compatible keys
        if playlist_type in ('harmonic_journey', 'energy_progression') and compatible_keys:
            placeholders = ','.join(['?'] * len(compatible_keys))
            where_clauses.append(f"t.camelot_key IN ({placeholders})")
            params.extend(compatible_keys)
        
        # For mood-based, try to match mood/genre
        if playlist_type == 'mood_based':
            if current_track.get('mood'):
                where_clauses.append("(a.mood = ? OR a.mood IS NULL)")
                params.append(current_track['mood'])
            elif current_track.get('genre'):
                where_clauses.append("(a.genre = ? OR a.genre IS NULL)")
                params.append(current_track['genre'])
        
        query = f"""
            SELECT t.id, t.file_path as filepath, t.title, t.artist, t.bpm,
                   t.camelot_key, t.energy_level, t.duration, a.mood, a.genre
            FROM tracks t
            LEFT JOIN ai_analysis a ON a.track_id = t.id
            WHERE {' AND '.join(where_clauses)}
            LIMIT 50
        """
        
        cursor = conn.execute(query, params)
        candidates = [self._row_to_dict(row) for row in cursor.fetchall()]
        
        return candidates
    
    def _score_transition(self, from_track: Dict, to_track: Dict,
                         playlist_type: str, playlist: List[Dict], 
                         weights: Optional[Dict] = None) -> float:
        """Score the transition between two tracks."""
        score = 0.0
        
        # Get features with defaults
        from_key = from_track.get('camelot_key')
        to_key = to_track.get('camelot_key')
        from_bpm = float(from_track.get('bpm', 120))
        to_bpm = float(to_track.get('bpm', 120))
        from_energy = float(from_track.get('energy_level', 5)) / 10.0
        to_energy = float(to_track.get('energy_level', 5)) / 10.0
        
        # Calculate component scores based on playlist type
        if playlist_type == 'hybrid':
            # Hybrid scoring with adjustable HAMMS vs AI weights
            if weights is None:
                weights = {'harmonic': 0.6, 'ai': 0.4}  # Default weights
            
            # HAMMS components (normalized to 0-1)
            harmonic_score = 0.0
            if from_key and to_key:
                harmonic_score = self.harmonic_engine.compatibility_score(from_key, to_key)
            
            bpm_score = 0.0
            if self.harmonic_engine.bpm_compatible(from_bpm, to_bpm, 'flexible'):
                bpm_diff_ratio = abs(from_bpm - to_bpm) / from_bpm
                bpm_score = max(0, 1.0 - bpm_diff_ratio / 0.06)  # Normalize to 0-1
            
            # AI components (normalized to 0-1)
            energy_continuity = 1.0 - abs(to_energy - from_energy)
            mood_consistency = self._mood_similarity(from_track.get('mood'), to_track.get('mood'))
            genre_consistency = self._genre_consistency(from_track.get('genre'), to_track.get('genre'))
            
            # Combine groups with weights
            hamms_group = (harmonic_score * 0.67 + bpm_score * 0.33)  # 2:1 ratio within HAMMS
            ai_group = (energy_continuity * 0.375 + mood_consistency * 0.375 + genre_consistency * 0.25)  # Balanced within AI
            
            # Apply user-adjustable weights
            score = hamms_group * weights.get('harmonic', 0.6) + ai_group * weights.get('ai', 0.4)
            
        elif playlist_type == 'harmonic_journey':
            # Harmonic compatibility (50%)
            if from_key and to_key:
                harmonic_score = self.harmonic_engine.compatibility_score(from_key, to_key)
                score += harmonic_score * 0.5
            
            # BPM compatibility (20%)
            if self.harmonic_engine.bpm_compatible(from_bpm, to_bpm, 'flexible'):
                bpm_score = 1.0 - (abs(from_bpm - to_bpm) / from_bpm) / 0.06  # Normalize to 0-1
                score += bpm_score * 0.2
            
            # Energy progression (20%) - prefer smooth transitions
            energy_diff = abs(to_energy - from_energy)
            energy_score = 1.0 - min(energy_diff / 0.3, 1.0)  # Penalize large jumps
            score += energy_score * 0.2
            
            # Mood/genre (10%)
            if from_track.get('mood') and to_track.get('mood'):
                if from_track['mood'] == to_track['mood']:
                    score += 0.1
            elif from_track.get('genre') and to_track.get('genre'):
                if from_track['genre'] == to_track['genre']:
                    score += 0.1
        
        elif playlist_type == 'energy_progression':
            # Energy progression (40%) - prefer increasing
            energy_delta = to_energy - from_energy
            if energy_delta > 0:
                energy_score = min(energy_delta / 0.2, 1.0)  # Reward increases
            else:
                energy_score = max(0, 1.0 + energy_delta)  # Penalize decreases
            score += energy_score * 0.4
            
            # Harmonic compatibility (30%)
            if from_key and to_key:
                harmonic_score = self.harmonic_engine.compatibility_score(from_key, to_key)
                score += harmonic_score * 0.3
            
            # BPM compatibility (20%)
            if self.harmonic_engine.bpm_compatible(from_bpm, to_bpm, 'flexible'):
                bpm_score = 1.0 - (abs(from_bpm - to_bpm) / from_bpm) / 0.06
                score += bpm_score * 0.2
            
            # Mood consistency (10%)
            if from_track.get('mood') and to_track.get('mood'):
                if from_track['mood'] == to_track['mood']:
                    score += 0.1
        
        elif playlist_type == 'mood_based':
            # Mood/genre matching (50%)
            mood_score = 0.0
            if from_track.get('mood') and to_track.get('mood'):
                if from_track['mood'] == to_track['mood']:
                    mood_score = 1.0
            elif from_track.get('genre') and to_track.get('genre'):
                if from_track['genre'] == to_track['genre']:
                    mood_score = 0.8
            score += mood_score * 0.5
            
            # Harmonic compatibility (25%)
            if from_key and to_key:
                harmonic_score = self.harmonic_engine.compatibility_score(from_key, to_key)
                score += harmonic_score * 0.25
            
            # Energy continuity (15%)
            energy_diff = abs(to_energy - from_energy)
            energy_score = 1.0 - min(energy_diff / 0.5, 1.0)
            score += energy_score * 0.15
            
            # BPM compatibility (10%)
            if self.harmonic_engine.bpm_compatible(from_bpm, to_bpm, 'flexible'):
                bpm_score = 1.0 - (abs(from_bpm - to_bpm) / from_bpm) / 0.1
                score += bpm_score * 0.1
        
        # Apply user preference adjustments (max ±0.05)
        if self.user_preferences:
            prefs = self.user_preferences
            
            # Harmonic preference adjustment
            if from_key and to_key and prefs.get('harmonic', 0) != 0:
                harmonic_compat = self.harmonic_engine.compatibility_score(from_key, to_key)
                if harmonic_compat > 0.8:  # Perfect or near-perfect
                    score += 0.05 * max(0, min(1, prefs['harmonic']))
            
            # Mood preference adjustment
            if from_track.get('mood') and to_track.get('mood') and prefs.get('ai_mood', 0) != 0:
                if from_track['mood'] == to_track['mood']:
                    score += 0.05 * max(0, min(1, prefs['ai_mood']))
            
            # Genre preference adjustment
            if from_track.get('genre') and to_track.get('genre') and prefs.get('ai_genre', 0) != 0:
                if from_track['genre'] == to_track['genre']:
                    score += 0.05 * max(0, min(1, prefs['ai_genre']))
            
            # Energy flow preference adjustment
            if prefs.get('energy_flow', 0) != 0:
                energy_delta = to_energy - from_energy
                if prefs['energy_flow'] > 0 and energy_delta > 0:  # Prefers building energy
                    score += 0.03 * max(0, min(1, prefs['energy_flow']))
                elif prefs['energy_flow'] < 0 and energy_delta < 0:  # Prefers decreasing energy
                    score += 0.03 * max(0, min(1, abs(prefs['energy_flow'])))
        
        # Ensure score stays in [0, 1]
        return max(0.0, min(1.0, score))
    
    def _pick_next(self, current_track: Dict, candidates: List[Dict],
                   playlist_type: str, playlist: List[Dict], weights: Optional[Dict] = None) -> Optional[Dict]:
        """Pick the next track from candidates."""
        if not candidates:
            return None
        
        # Score all candidates
        scored_candidates = []
        for candidate in candidates:
            score = self._score_transition(current_track, candidate, playlist_type, playlist, weights)
            scored_candidates.append((score, candidate))
        
        # Sort by score and pick best
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        
        if scored_candidates:
            return scored_candidates[0][1]
        return None
    
    def _pick_next_with_score(self, current_track: Dict, candidates: List[Dict],
                              playlist_type: str, playlist: List[Dict], 
                              weights: Optional[Dict] = None) -> Tuple[Optional[Dict], float]:
        """Pick the next track from candidates and return with transition score."""
        if not candidates:
            return None, 0.0
        
        # Score all candidates
        scored_candidates = []
        for candidate in candidates:
            score = self._score_transition(current_track, candidate, playlist_type, playlist, weights)
            scored_candidates.append((score, candidate))
        
        # Sort by score and pick best
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        
        if scored_candidates:
            best_score, best_track = scored_candidates[0]
            return best_track, best_score
        return None, 0.0
    
    def _row_to_dict(self, row: sqlite3.Row) -> Dict:
        """Convert database row to dict with proper types."""
        return {
            'id': row['id'],
            'filepath': row['filepath'],
            'file_path': row['filepath'],  # Include both for compatibility
            'title': row['title'],
            'artist': row['artist'],
            'bpm': float(row['bpm']) if row['bpm'] else 120.0,
            'camelot_key': row['camelot_key'],
            'energy_level': int(row['energy_level']) if row['energy_level'] else 5,
            'duration': float(row['duration']) if row['duration'] else 240.0,
            'mood': row['mood'] if 'mood' in row.keys() else None,
            'genre': row['genre'] if 'genre' in row.keys() else None
        }
    
    def _normalize_track(self, track: dict) -> Dict:
        """Normalize track dict to ensure required fields."""
        filepath = track.get('filepath') or track.get('file_path')
        return {
            'id': track.get('id'),
            'filepath': filepath,
            'file_path': filepath,  # Include both for compatibility
            'title': track.get('title'),
            'artist': track.get('artist'),
            'bpm': float(track.get('bpm', 120)),
            'camelot_key': track.get('camelot_key'),
            'energy_level': int(track.get('energy_level', 5)),
            'duration': float(track.get('duration', 240)),
            'mood': track.get('mood'),
            'genre': track.get('genre')
        }
    
    def _mood_similarity(self, mood_a: Optional[str], mood_b: Optional[str]) -> float:
        """
        Calculate mood similarity between two tracks.
        
        Returns:
            1.0 if same mood
            0.7 if related moods (e.g., driving-euphoric, warm-calm)
            0.0 if different or missing
        """
        if not mood_a or not mood_b:
            return 0.0
        
        if mood_a.lower() == mood_b.lower():
            return 1.0
        
        # Define mood relationships
        mood_groups = [
            {'driving', 'euphoric', 'energetic'},
            {'warm', 'calm', 'relaxed'},
            {'dark', 'deep', 'mysterious'},
            {'uplifting', 'happy', 'joyful'},
            {'melancholic', 'sad', 'emotional'}
        ]
        
        mood_a_lower = mood_a.lower()
        mood_b_lower = mood_b.lower()
        
        for group in mood_groups:
            if mood_a_lower in group and mood_b_lower in group:
                return 0.7
        
        return 0.0
    
    def _genre_consistency(self, genre_a: Optional[str], genre_b: Optional[str]) -> float:
        """
        Calculate genre consistency between two tracks.
        
        Returns:
            1.0 if same genre
            0.7 if share base word (e.g., "Techno" vs "Melodic Techno")
            0.0 if different or missing
        """
        if not genre_a or not genre_b:
            return 0.0
        
        if genre_a.lower() == genre_b.lower():
            return 1.0
        
        # Check for shared base words
        words_a = set(genre_a.lower().split())
        words_b = set(genre_b.lower().split())
        
        # Common genre base words
        base_genres = {'techno', 'house', 'trance', 'drum', 'bass', 'dubstep', 
                      'ambient', 'electronic', 'dance', 'disco', 'funk', 'soul'}
        
        shared_bases = (words_a & words_b) & base_genres
        if shared_bases:
            return 0.7
        
        return 0.0
