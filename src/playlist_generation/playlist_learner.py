"""
Playlist learner for adaptive preference learning from user edits and playback patterns.
"""

import json
from typing import List, Dict, Optional, Tuple
from datetime import datetime


class PlaylistLearner:
    """Learn user preferences from playlist edits and playback behavior."""
    
    def __init__(self, db):
        """Initialize learner with database connection."""
        self.db = db
        self._ensure_preferences_table()
    
    def _ensure_preferences_table(self):
        """Ensure user_preferences table exists."""
        try:
            self.db.conn.execute('''
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    preference_type TEXT NOT NULL,
                    preference_data TEXT,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(preference_type)
                )
            ''')
            self.db.conn.commit()
        except Exception:
            pass  # Table likely already exists
    
    def learn_from_edits(self, original: List[Dict], edited: List[Dict]) -> Dict:
        """
        Learn preferences from user edits to a playlist.
        
        Args:
            original: Original generated playlist
            edited: User-edited version of the playlist
            
        Returns:
            Dict with preference deltas for different factors
        """
        deltas = {
            'harmonic': 0.0,
            'ai_mood': 0.0,
            'ai_genre': 0.0,
            'energy_flow': 0.0
        }
        
        if not original or not edited or len(original) < 2 or len(edited) < 2:
            return deltas
        
        # Build transition maps
        original_transitions = self._get_transitions(original)
        edited_transitions = self._get_transitions(edited)
        
        # Find added and removed transitions
        added_transitions = edited_transitions - original_transitions
        removed_transitions = original_transitions - edited_transitions
        
        # Analyze added transitions (user prefers these)
        for from_id, to_id in added_transitions:
            from_track = self._find_track_by_id(edited, from_id)
            to_track = self._find_track_by_id(edited, to_id)
            if from_track and to_track:
                self._analyze_transition(from_track, to_track, deltas, weight=0.1)
        
        # Analyze removed transitions (user dislikes these)
        for from_id, to_id in removed_transitions:
            from_track = self._find_track_by_id(original, from_id)
            to_track = self._find_track_by_id(original, to_id)
            if from_track and to_track:
                self._analyze_transition(from_track, to_track, deltas, weight=-0.1)
        
        # Analyze position changes (tracks moved up = preferred earlier)
        original_positions = {self._get_track_id(t): i for i, t in enumerate(original)}
        edited_positions = {self._get_track_id(t): i for i, t in enumerate(edited)}
        
        for track_id in edited_positions:
            if track_id in original_positions:
                position_delta = original_positions[track_id] - edited_positions[track_id]
                if position_delta > 0:  # Moved earlier
                    # Check what properties this track has
                    track = self._find_track_by_id(edited, track_id)
                    if track:
                        if track.get('camelot_key'):
                            deltas['harmonic'] += 0.05
                        if track.get('mood'):
                            deltas['ai_mood'] += 0.05
        
        # Clamp deltas to [-1, 1]
        for key in deltas:
            deltas[key] = max(-1.0, min(1.0, deltas[key]))
        
        return deltas
    
    def learn_from_playback(self, playlist: List[Dict], skip_events: List[Dict]) -> Dict:
        """
        Learn preferences from playback patterns (skips, replays).
        
        Args:
            playlist: Playlist that was played
            skip_events: List of skip events with position and optional reason
            
        Returns:
            Dict with preference deltas
        """
        deltas = {
            'harmonic': 0.0,
            'ai_mood': 0.0,
            'ai_genre': 0.0,
            'energy_flow': 0.0
        }
        
        # Analyze skip patterns
        for event in skip_events:
            position = event.get('position', 0)
            if 0 < position < len(playlist):
                # Penalize transition into skipped track
                from_track = playlist[position - 1]
                to_track = playlist[position]
                self._analyze_transition(from_track, to_track, deltas, weight=-0.05)
        
        # Clamp deltas
        for key in deltas:
            deltas[key] = max(-1.0, min(1.0, deltas[key]))
        
        return deltas
    
    def update_preferences(self, deltas: Dict) -> bool:
        """
        Update stored preferences with new deltas.
        
        Args:
            deltas: Preference deltas to apply
            
        Returns:
            True if successful
        """
        try:
            # Get current preferences
            current = self.get_preferences()
            
            # Apply deltas with exponential moving average
            alpha = 0.3  # Learning rate
            for key, delta in deltas.items():
                if key in current:
                    # EMA update
                    current[key] = current[key] * (1 - alpha) + delta * alpha
                else:
                    current[key] = delta * alpha
                
                # Clamp to [-1, 1]
                current[key] = max(-1.0, min(1.0, current[key]))
            
            # Persist to database
            pref_json = json.dumps(current)
            self.db.conn.execute('''
                INSERT INTO user_preferences (preference_type, preference_data, updated_date)
                VALUES (?, ?, ?)
                ON CONFLICT(preference_type) DO UPDATE SET
                    preference_data = excluded.preference_data,
                    updated_date = excluded.updated_date
            ''', ('weights', pref_json, datetime.now()))
            self.db.conn.commit()
            
            return True
            
        except Exception as e:
            print(f"Error updating preferences: {e}")
            return False
    
    def get_preferences(self) -> Dict:
        """
        Get current user preferences.
        
        Returns:
            Dict with preference weights
        """
        try:
            cursor = self.db.conn.execute('''
                SELECT preference_data
                FROM user_preferences
                WHERE preference_type = ?
            ''', ('weights',))
            
            row = cursor.fetchone()
            if row and row[0]:
                return json.loads(row[0])
            
        except Exception as e:
            print(f"Error getting preferences: {e}")
        
        # Return defaults
        return {
            'harmonic': 0.0,
            'ai_mood': 0.0,
            'ai_genre': 0.0,
            'energy_flow': 0.0
        }
    
    def _get_transitions(self, playlist: List[Dict]) -> set:
        """Get set of transitions (from_id, to_id) in playlist."""
        transitions = set()
        for i in range(len(playlist) - 1):
            from_id = self._get_track_id(playlist[i])
            to_id = self._get_track_id(playlist[i + 1])
            if from_id and to_id:
                transitions.add((from_id, to_id))
        return transitions
    
    def _get_track_id(self, track: Dict) -> Optional[str]:
        """Get unique identifier for track."""
        # Try id, then filepath, then title+artist
        if track.get('id'):
            return f"id_{track['id']}"
        elif track.get('filepath') or track.get('file_path'):
            return track.get('filepath') or track.get('file_path')
        elif track.get('title') and track.get('artist'):
            return f"{track['title']}_{track['artist']}"
        return None
    
    def _find_track_by_id(self, playlist: List[Dict], track_id: str) -> Optional[Dict]:
        """Find track in playlist by ID."""
        for track in playlist:
            if self._get_track_id(track) == track_id:
                return track
        return None
    
    def _analyze_transition(self, from_track: Dict, to_track: Dict, 
                           deltas: Dict, weight: float):
        """
        Analyze a transition and update deltas.
        
        Args:
            from_track: Source track
            to_track: Target track
            deltas: Deltas dict to update
            weight: Weight to apply (positive for preferred, negative for disliked)
        """
        # Check harmonic compatibility
        from_key = from_track.get('camelot_key')
        to_key = to_track.get('camelot_key')
        if from_key and to_key:
            # Simple check: adjacent keys are good
            if self._keys_compatible(from_key, to_key):
                deltas['harmonic'] += weight
        
        # Check mood consistency
        from_mood = from_track.get('mood')
        to_mood = to_track.get('mood')
        if from_mood and to_mood:
            if from_mood == to_mood:
                deltas['ai_mood'] += weight
        
        # Check genre consistency
        from_genre = from_track.get('genre')
        to_genre = to_track.get('genre')
        if from_genre and to_genre:
            if from_genre == to_genre:
                deltas['ai_genre'] += weight
        
        # Check energy flow
        from_energy = from_track.get('energy_level', 5)
        to_energy = to_track.get('energy_level', 5)
        energy_delta = to_energy - from_energy
        
        if abs(energy_delta) <= 2:  # Smooth transition
            deltas['energy_flow'] += weight * 0.5
        elif energy_delta > 0:  # Building energy
            deltas['energy_flow'] += weight * 0.3
    
    def _keys_compatible(self, key1: str, key2: str) -> bool:
        """Check if two Camelot keys are compatible."""
        # Simple compatibility: same number or adjacent
        try:
            num1 = int(key1[:-1])
            mode1 = key1[-1]
            num2 = int(key2[:-1])
            mode2 = key2[-1]
            
            # Same key
            if key1 == key2:
                return True
            
            # Adjacent on wheel
            if mode1 == mode2 and abs(num1 - num2) <= 1:
                return True
            
            # Relative major/minor
            if num1 == num2 and mode1 != mode2:
                return True
                
        except (ValueError, IndexError):
            pass
        
        return False