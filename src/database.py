#!/usr/bin/env python3
"""
Database module for Music Analyzer Pro.

- Purpose: SQLite database for storing music library metadata.
- Key conventions:
  - Keys: `initial_key` stores the original key (standard or Camelot).
    `camelot_key` stores the derived Camelot code and is indexed for queries.
  - Energy: Persist as `energy_level` (1–10, integer). Algorithms/UI use
    normalized energy in [0–1]; convert using `energy_level = int(round(energy*10))`
    when writing and `energy = energy_level/10.0` when reading if needed.
"""

import sqlite3
from pathlib import Path
import json
from datetime import datetime
from utils.logger import setup_logger
from utils.music_keys import to_camelot
logger = setup_logger(__name__)


class MusicDatabase:
    """SQLite database handler for music library"""
    
    def __init__(self, db_path=None):
        """Initialize database connection"""
        if db_path is None:
            try:
                db_dir = Path.home() / '.music_player_qt'
                db_dir.mkdir(parents=True, exist_ok=True)
                db_path = db_dir / 'music_library.db'
            except Exception:
                # Fallback to workspace-local directory in restricted environments
                db_dir = Path.cwd() / '.music_player_qt'
                db_dir.mkdir(parents=True, exist_ok=True)
                db_path = db_dir / 'music_library.db'

        self.db_path = db_path
        self.conn = None
        self.init_database()
    
    def init_database(self):
        """Create database tables if they don't exist"""
        try:
            self.conn = sqlite3.connect(str(self.db_path))
        except Exception:
            # Fallback to in-memory database if file is not writable
            self.db_path = ':memory:'
            self.conn = sqlite3.connect(':memory:')
        self.conn.row_factory = sqlite3.Row
        # Improve concurrency and durability
        try:
            self.conn.execute('PRAGMA journal_mode=WAL')
            self.conn.execute('PRAGMA synchronous=NORMAL')
            self.conn.execute('PRAGMA busy_timeout=3000')
            self.conn.execute('PRAGMA foreign_keys=ON')
        except sqlite3.Error:
            pass
        
        # Create tracks table with HAMMS v3.0 fields
        try:
            self.conn.execute('''
            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                
                -- Basic metadata
                title TEXT,
                artist TEXT,
                album TEXT,
                album_artist TEXT,
                genre TEXT,
                year INTEGER,
                track_number INTEGER,
                total_tracks INTEGER,
                disc_number INTEGER,
                total_discs INTEGER,
                
                -- DJ/Production metadata
                bpm REAL,
                initial_key TEXT,
                key_data TEXT,
                energy_data TEXT,
                energy_level INTEGER,
                cuepoints TEXT,
                comment TEXT,
                
                -- Audio properties
                duration REAL,
                bitrate INTEGER,
                sample_rate INTEGER,
                channels INTEGER,
                codec TEXT,
                file_size INTEGER,
                
                -- System and statistics
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP,
                last_played TIMESTAMP,
                play_count INTEGER DEFAULT 0,
                skip_count INTEGER DEFAULT 0,
                rating INTEGER DEFAULT 0,
                
                -- Artwork
                artwork_path TEXT,
                artwork_data BLOB,
                artwork_type TEXT,
                
                -- Credits
                composer TEXT,
                performer TEXT,
                copyright TEXT,
                publisher TEXT,
                label TEXT,
                
                -- Identifiers
                isrc TEXT,
                barcode TEXT,
                musicbrainz_trackid TEXT,
                url TEXT,
                
                -- Lyrics
                lyrics TEXT,
                unsynced_lyrics TEXT
            )
        ''')
        
            # Create playlists table
            self.conn.execute('''
            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                artwork_path TEXT
            )
        ''')
        
            # Create playlist_tracks table (many-to-many relationship)
            self.conn.execute('''
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL,
                track_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
                FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE,
                UNIQUE(playlist_id, track_id)
            )
        ''')
        
            # Create artists table
            self.conn.execute('''
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                bio TEXT,
                image_path TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
            # Create albums table
            self.conn.execute('''
            CREATE TABLE IF NOT EXISTS albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT,
                year INTEGER,
                genre TEXT,
                artwork_path TEXT,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(title, artist)
            )
        ''')
        
            # Create indices for better performance
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks(artist, title)')

            self.conn.commit()
        except sqlite3.Error:
            # Reconnect to in-memory DB and retry schema creation
            try:
                self.conn.close()
            except Exception:
                pass
            self.db_path = ':memory:'
            self.conn = sqlite3.connect(':memory:')
            self.conn.row_factory = sqlite3.Row
            # Minimal schema for tests
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT UNIQUE NOT NULL
                )
            ''')
            self.conn.commit()

        # Ensure optional audio feature columns exist for analyzer updates
        self._ensure_track_feature_columns()
        
        # Ensure additional schema elements from Documento Maestro
        self._ensure_additional_schema()
    
    def _ensure_additional_schema(self):
        """Ensure additional schema elements exist (idempotent)."""
        try:
            # Check and add camelot_key column to tracks if missing
            cursor = self.conn.execute('PRAGMA table_info(tracks)')
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            if 'camelot_key' not in existing_cols:
                self.conn.execute('ALTER TABLE tracks ADD COLUMN camelot_key TEXT')
                logger.info("Added camelot_key column to tracks table")
            
            # Create indices for tracks
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_camelot ON tracks(camelot_key)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm)')
            
            # Create ai_analysis table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS ai_analysis (
                    track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    genre TEXT,
                    subgenre TEXT,
                    mood TEXT,
                    era TEXT,
                    year_estimate INTEGER,
                    tags TEXT,
                    structure TEXT,
                    quality_metrics TEXT,
                    similar_tracks TEXT,
                    ai_version TEXT,
                    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indices for ai_analysis
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_ai_genre ON ai_analysis(genre)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_ai_mood ON ai_analysis(mood)')
            
            # Check and add transition_score column to playlist_tracks if missing
            cursor = self.conn.execute('PRAGMA table_info(playlist_tracks)')
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            if 'transition_score' not in existing_cols:
                self.conn.execute('ALTER TABLE playlist_tracks ADD COLUMN transition_score REAL')
                logger.info("Added transition_score column to playlist_tracks table")
            
            # Create unique index for playlist position
            self.conn.execute('''
                CREATE UNIQUE INDEX IF NOT EXISTS uniq_playlist_pos 
                ON playlist_tracks(playlist_id, position)
            ''')
            
            # Check if user_preferences exists with old schema
            cursor = self.conn.execute('PRAGMA table_info(user_preferences)')
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            if existing_cols and 'key' in existing_cols:
                # Old schema exists, need to migrate
                logger.info("Migrating user_preferences table to new schema")
                
                # Backup existing data
                cursor = self.conn.execute('SELECT * FROM user_preferences')
                old_data = cursor.fetchall()
                
                # Drop old table
                self.conn.execute('DROP TABLE user_preferences')
                
                # Create new table with correct schema
                self.conn.execute('''
                    CREATE TABLE user_preferences (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        preference_type TEXT UNIQUE NOT NULL,
                        preference_data TEXT,
                        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Migrate old data if any (convert key->preference_type, value->preference_data)
                for row in old_data:
                    try:
                        # Assuming row has: id, key, value, created_date, modified_date
                        self.conn.execute('''
                            INSERT INTO user_preferences (preference_type, preference_data, created_date, updated_date)
                            VALUES (?, ?, ?, ?)
                        ''', (row[1], row[2], row[3], row[4]))
                    except Exception as e:
                        logger.warning(f"Could not migrate preference row: {e}")
            else:
                # Create user_preferences table with correct schema
                self.conn.execute('''
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        preference_type TEXT UNIQUE NOT NULL,
                        preference_data TEXT,
                        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            
            # Create loudness_analysis table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS loudness_analysis (
                    track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    integrated_loudness REAL,
                    true_peak REAL,
                    crest_factor REAL,
                    dynamic_range REAL,
                    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create index for faster lookups
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_loudness_track ON loudness_analysis(track_id)')
            
            # Create similar_tracks table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS similar_tracks (
                    track_id INTEGER,
                    similar_id INTEGER,
                    distance REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (track_id, similar_id),
                    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
                    FOREIGN KEY (similar_id) REFERENCES tracks(id) ON DELETE CASCADE
                )
            ''')
            
            # Create indices for similar_tracks
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_similar_track ON similar_tracks(track_id)')
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_similar_distance ON similar_tracks(track_id, distance)')
            
            # Create track_clusters table
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS track_clusters (
                    track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    cluster_id INTEGER,
                    confidence REAL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create index for cluster lookups
            self.conn.execute('CREATE INDEX IF NOT EXISTS idx_cluster_id ON track_clusters(cluster_id)')
            
            self.conn.commit()
            logger.info("Additional schema elements ensured")
            
        except sqlite3.Error as e:
            logger.error(f"Error ensuring additional schema: {e}")
    
    def clear_database(self):
        """Clear all data from database (keeps structure)"""
        tables = ['playlist_tracks', 'playlists', 'tracks', 'artists', 'albums']
        
        for table in tables:
            self.conn.execute(f'DELETE FROM {table}')
        
        # Reset autoincrement counters
        self.conn.execute("DELETE FROM sqlite_sequence")
        
        self.conn.commit()
        
        return True

    def _ensure_track_feature_columns(self):
        """Ensure analyzer feature columns exist on tracks table (idempotent)."""
        try:
            cursor = self.conn.execute('PRAGMA table_info(tracks)')
            existing_cols = {row[1] for row in cursor.fetchall()}

            # Columns used by update_track_features (static list)
            required = [
                ('danceability', 'REAL'),
                ('valence', 'REAL'),
                ('acousticness', 'REAL'),
                ('instrumentalness', 'REAL'),
                ('tempo_stability', 'REAL')
            ]

            allowed_types = {'REAL', 'INTEGER', 'TEXT', 'BLOB'}
            for col, col_type in required:
                if col not in existing_cols:
                    # Harden against injection (defensive even with static list)
                    if not str(col).isidentifier() or str(col_type).upper() not in allowed_types:
                        logger.error(f"Invalid column definition: {col} {col_type}")
                        continue
                    self.conn.execute(f'ALTER TABLE tracks ADD COLUMN {col} {col_type}')
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error ensuring feature columns: {e}")
    
    def add_track(self, track_data):
        """Add a track to the database"""
        try:
            # Determine the key value and calculate camelot_key
            key_value = track_data.get('key') or track_data.get('initial_key')
            camelot_key = to_camelot(key_value) if key_value else None
            
            with self.conn:
                cursor = self.conn.cursor()
                cursor.execute('''
                INSERT INTO tracks (
                    file_path, title, artist, album, album_artist,
                    genre, year, track_number, duration, bitrate,
                    sample_rate, file_size, artwork_path, artwork_data,
                    bpm, initial_key, energy_level, isrc, release_date, camelot_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_path) DO UPDATE SET
                    title = COALESCE(excluded.title, title),
                    artist = COALESCE(excluded.artist, artist),
                    album = COALESCE(excluded.album, album),
                    album_artist = COALESCE(excluded.album_artist, album_artist),
                    genre = COALESCE(excluded.genre, genre),
                    year = COALESCE(excluded.year, year),
                    track_number = COALESCE(excluded.track_number, track_number),
                    duration = COALESCE(excluded.duration, duration),
                    bitrate = COALESCE(excluded.bitrate, bitrate),
                    sample_rate = COALESCE(excluded.sample_rate, sample_rate),
                    file_size = COALESCE(excluded.file_size, file_size),
                    artwork_path = COALESCE(excluded.artwork_path, artwork_path),
                    artwork_data = COALESCE(excluded.artwork_data, artwork_data),
                    bpm = COALESCE(excluded.bpm, bpm),
                    initial_key = COALESCE(excluded.initial_key, initial_key),
                    energy_level = COALESCE(excluded.energy_level, energy_level),
                    isrc = COALESCE(excluded.isrc, isrc),
                    release_date = COALESCE(excluded.release_date, release_date),
                    camelot_key = COALESCE(excluded.camelot_key, camelot_key)
                ''', (
                track_data.get('file_path'),
                track_data.get('title'),
                track_data.get('artist'),
                track_data.get('album'),
                track_data.get('album_artist'),
                track_data.get('genre'),
                track_data.get('year'),
                track_data.get('track_number'),
                track_data.get('duration'),
                track_data.get('bitrate'),
                track_data.get('sample_rate'),
                track_data.get('file_size'),
                track_data.get('artwork_path'),
                track_data.get('artwork_data'),
                track_data.get('bpm'),
                key_value,
                int(track_data.get('energy', 0) * 10) if track_data.get('energy') else None,
                track_data.get('isrc'),
                track_data.get('release_date'),
                camelot_key
                ))
            if cursor.lastrowid:
                return cursor.lastrowid
            # On UPSERT update, lastrowid may be 0; fetch existing id
            row = self.conn.execute('SELECT id FROM tracks WHERE file_path = ?', (track_data.get('file_path'),)).fetchone()
            return row[0] if row else None
        except sqlite3.Error as e:
            logger.error(f"Database error: {e}")
            return None

    def add_tracks_batch(self, tracks_data: list[dict]) -> int:
        """Add multiple tracks using a single executemany batch.

        Returns the number of rows attempted (insert or upsert). Existing rows are ignored.
        """
        if not tracks_data:
            return 0
        try:
            rows = []
            for td in tracks_data:
                rows.append((
                    td.get('file_path'),
                    td.get('title'),
                    td.get('artist'),
                    td.get('album'),
                    td.get('album_artist'),
                    td.get('genre'),
                    td.get('year'),
                    td.get('track_number'),
                    td.get('duration'),
                    td.get('bitrate'),
                    td.get('sample_rate'),
                    td.get('file_size'),
                    td.get('artwork_path'),
                    td.get('artwork_data'),
                    td.get('bpm'),
                    td.get('key'),
                    int(td.get('energy', 0) * 10) if td.get('energy') else None,
                    td.get('isrc'),
                    td.get('release_date')
                ))
            with self.conn:
                self.conn.executemany('''
                    INSERT OR IGNORE INTO tracks (
                        file_path, title, artist, album, album_artist,
                        genre, year, track_number, duration, bitrate,
                        sample_rate, file_size, artwork_path, artwork_data,
                        bpm, initial_key, energy_level, isrc, release_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', rows)
            return len(rows)
        except sqlite3.Error as e:
            logger.error(f"Batch insert error: {e}")
            return 0
    
    def get_all_tracks(self):
        """Get all tracks from database"""
        cursor = self.conn.execute('''
            SELECT * FROM tracks 
            ORDER BY artist, album, track_number
        ''')
        return [dict(row) for row in cursor.fetchall()]
    
    def get_track_by_path(self, file_path):
        """Get track by file path"""
        cursor = self.conn.execute(
            'SELECT * FROM tracks WHERE file_path = ?', 
            (file_path,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def update_track_features(self, track_id, features):
        """Update track audio features"""
        try:
            # Calculate camelot_key from the key if provided
            key_value = features.get('key')
            camelot_key = to_camelot(key_value) if key_value else None
            
            with self.conn:
                self.conn.execute('''
                    UPDATE tracks 
                    SET bpm = ?, initial_key = ?, energy_level = ?,
                        danceability = ?, valence = ?, acousticness = ?,
                        instrumentalness = ?, tempo_stability = ?, camelot_key = ?
                    WHERE id = ?
                ''', (
                    features.get('bpm'),
                    key_value,
                    features.get('energy_level'),
                    features.get('danceability'),
                    features.get('valence'),
                    features.get('acousticness'),
                    features.get('instrumentalness'),
                    features.get('tempo_stability'),
                    camelot_key,
                    track_id
                ))
                return True
        except Exception as e:
            print(f"Error updating track features: {e}")
            return False
    
    def update_track_artwork(self, file_path, artwork_data=None, artwork_path=None):
        """Update track artwork"""
        with self.conn:
            self.conn.execute('''
                UPDATE tracks 
                SET artwork_data = ?, artwork_path = ?
                WHERE file_path = ?
            ''', (artwork_data, artwork_path, file_path))
    
    def search_tracks(self, query):
        """Search tracks by title, artist, or album"""
        query = f'%{query}%'
        cursor = self.conn.execute('''
            SELECT * FROM tracks 
            WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
            ORDER BY artist, album, track_number
        ''', (query, query, query))
        return [dict(row) for row in cursor.fetchall()]
    
    def save_ai_analysis(self, track_id: int, data: dict) -> bool:
        """Save or update AI analysis results for a track.
        
        Args:
            track_id: Track ID in the database
            data: Dictionary with AI analysis results
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Serialize list/dict fields to JSON strings
            tags_json = json.dumps(data.get('tags', []))
            structure_json = json.dumps(data.get('structure', {}))
            quality_metrics_json = json.dumps(data.get('quality_metrics', {}))
            similar_tracks_json = json.dumps(data.get('similar_tracks', []))
            
            with self.conn:
                self.conn.execute('''
                    INSERT INTO ai_analysis (
                        track_id, genre, subgenre, mood, era, year_estimate,
                        tags, structure, quality_metrics, similar_tracks,
                        ai_version, analysis_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(track_id) DO UPDATE SET
                        genre = excluded.genre,
                        subgenre = excluded.subgenre,
                        mood = excluded.mood,
                        era = excluded.era,
                        year_estimate = excluded.year_estimate,
                        tags = excluded.tags,
                        structure = excluded.structure,
                        quality_metrics = excluded.quality_metrics,
                        similar_tracks = excluded.similar_tracks,
                        ai_version = excluded.ai_version,
                        analysis_date = excluded.analysis_date
                ''', (
                    track_id,
                    data.get('genre'),
                    data.get('subgenre'),
                    data.get('mood'),
                    data.get('era'),
                    data.get('year_estimate'),
                    tags_json,
                    structure_json,
                    quality_metrics_json,
                    similar_tracks_json,
                    data.get('ai_version'),
                    data.get('analysis_date')
                ))
            return True
        except Exception as e:
            logger.error(f"Error saving AI analysis: {e}")
            return False
    
    def create_playlist(self, name: str, description: str = None, parameters: dict = None) -> int:
        """Create a new playlist.
        
        Args:
            name: Playlist name (must be unique)
            description: Optional description
            parameters: Optional parameters dict (will be JSON serialized)
            
        Returns:
            int: Playlist ID of created playlist
        """
        try:
            params_json = json.dumps(parameters) if parameters else None
            with self.conn:
                cursor = self.conn.cursor()
                cursor.execute('''
                    INSERT INTO playlists (name, description, parameters)
                    VALUES (?, ?, ?)
                ''', (name, description, params_json))
                return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Name already exists
            logger.warning(f"Playlist '{name}' already exists")
            return None
        except Exception as e:
            logger.error(f"Error creating playlist: {e}")
            return None
    
    def save_playlist_tracks(self, playlist_id: int, tracks: list[dict]) -> int:
        """Save tracks to a playlist with positions and transition scores.
        
        Args:
            playlist_id: ID of the playlist
            tracks: List of track dicts with file_path and optional transition_score
            
        Returns:
            int: Number of tracks saved
        """
        try:
            saved_count = 0
            with self.conn:
                # First, clear existing tracks for this playlist
                self.conn.execute('DELETE FROM playlist_tracks WHERE playlist_id = ?', (playlist_id,))
                
                for position, track in enumerate(tracks, 1):
                    # Get track_id from file_path
                    file_path = track.get('file_path')
                    if not file_path:
                        continue
                        
                    cursor = self.conn.execute(
                        'SELECT id FROM tracks WHERE file_path = ?', 
                        (file_path,)
                    )
                    row = cursor.fetchone()
                    if not row:
                        logger.warning(f"Track not found: {file_path}")
                        continue
                    
                    track_id = row[0]
                    
                    # Get transition score - first track is 1.0, others use provided score
                    transition_score = 1.0 if position == 1 else track.get('transition_score', 0.5)
                    
                    self.conn.execute('''
                        INSERT INTO playlist_tracks (playlist_id, track_id, position, transition_score)
                        VALUES (?, ?, ?, ?)
                    ''', (playlist_id, track_id, position, transition_score))
                    saved_count += 1
                    
            return saved_count
        except Exception as e:
            logger.error(f"Error saving playlist tracks: {e}")
            return 0
    
    def get_playlist(self, name: str) -> dict:
        """Get playlist by name.
        
        Args:
            name: Playlist name
            
        Returns:
            dict: Playlist data or None if not found
        """
        try:
            cursor = self.conn.execute(
                'SELECT * FROM playlists WHERE name = ?',
                (name,)
            )
            row = cursor.fetchone()
            if row:
                playlist = dict(row)
                # Deserialize parameters if present
                if playlist.get('parameters'):
                    try:
                        playlist['parameters'] = json.loads(playlist['parameters'])
                    except json.JSONDecodeError:
                        pass
                return playlist
            return None
        except Exception as e:
            logger.error(f"Error getting playlist: {e}")
            return None
    
    def get_playlist_tracks(self, playlist_id: int) -> list[dict]:
        """Get all tracks in a playlist ordered by position.
        
        Args:
            playlist_id: ID of the playlist
            
        Returns:
            list[dict]: List of track dicts with position and transition_score
        """
        try:
            cursor = self.conn.execute('''
                SELECT pt.position, pt.transition_score, t.*
                FROM playlist_tracks pt
                JOIN tracks t ON pt.track_id = t.id
                WHERE pt.playlist_id = ?
                ORDER BY pt.position
            ''', (playlist_id,))
            
            tracks = []
            for row in cursor.fetchall():
                track = dict(row)
                tracks.append(track)
            return tracks
        except Exception as e:
            logger.error(f"Error getting playlist tracks: {e}")
            return []
    
    def delete_playlist(self, playlist_id: int) -> bool:
        """Delete a playlist and its tracks.
        
        Args:
            playlist_id: ID of the playlist to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with self.conn:
                # Due to ON DELETE CASCADE, this will also delete playlist_tracks
                self.conn.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
            return True
        except Exception as e:
            logger.error(f"Error deleting playlist: {e}")
            return False
    
    def save_loudness(self, track_id: int, metrics: dict) -> bool:
        """
        Save loudness analysis results for a track.
        
        Args:
            track_id: Track ID
            metrics: Dict with loudness metrics (integrated_loudness, true_peak, etc.)
            
        Returns:
            True if successful
        """
        try:
            self.conn.execute('''
                INSERT OR REPLACE INTO loudness_analysis 
                (track_id, integrated_loudness, true_peak, crest_factor, dynamic_range, analysis_date)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                track_id,
                metrics.get('integrated_loudness'),
                metrics.get('true_peak'),
                metrics.get('crest_factor'),
                metrics.get('dynamic_range')
            ))
            self.conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error saving loudness metrics: {e}")
            return False
    
    def get_loudness(self, track_id: int) -> dict | None:
        """
        Get loudness analysis results for a track.
        
        Args:
            track_id: Track ID
            
        Returns:
            Dict with loudness metrics or None if not found
        """
        try:
            cursor = self.conn.execute('''
                SELECT integrated_loudness, true_peak, crest_factor, dynamic_range, analysis_date
                FROM loudness_analysis
                WHERE track_id = ?
            ''', (track_id,))
            
            row = cursor.fetchone()
            if row:
                return {
                    'integrated_loudness': row[0],
                    'true_peak': row[1],
                    'crest_factor': row[2],
                    'dynamic_range': row[3],
                    'analysis_date': row[4]
                }
            return None
        except Exception as e:
            logger.error(f"Error getting loudness metrics: {e}")
            return None
    
    def save_similar_tracks(self, track_id: int, items: list[dict]) -> int:
        """
        Save similar tracks for a given track.
        
        Args:
            track_id: Source track ID
            items: List of similar track dicts with 'id' and 'distance' keys
            
        Returns:
            Number of tracks saved
        """
        try:
            # Delete existing similar tracks for this track_id
            self.conn.execute('DELETE FROM similar_tracks WHERE track_id = ?', (track_id,))
            
            # Insert new similar tracks
            saved = 0
            for item in items:
                if item.get('id') and item.get('distance') is not None:
                    self.conn.execute('''
                        INSERT OR REPLACE INTO similar_tracks (track_id, similar_id, distance)
                        VALUES (?, ?, ?)
                    ''', (track_id, item['id'], item['distance']))
                    saved += 1
            
            self.conn.commit()
            return saved
            
        except Exception as e:
            logger.error(f"Error saving similar tracks: {e}")
            return 0
    
    def get_similar_tracks(self, track_id: int, limit: int = 20) -> list[dict]:
        """
        Get similar tracks for a given track.
        
        Args:
            track_id: Source track ID
            limit: Maximum number of similar tracks to return
            
        Returns:
            List of similar track dicts with full track info
        """
        try:
            cursor = self.conn.execute('''
                SELECT 
                    t.id, t.file_path as filepath, t.title, t.artist,
                    t.bpm, t.camelot_key, t.energy_level,
                    a.mood, a.genre,
                    s.distance
                FROM similar_tracks s
                JOIN tracks t ON s.similar_id = t.id
                LEFT JOIN ai_analysis a ON t.id = a.track_id
                WHERE s.track_id = ?
                ORDER BY s.distance ASC
                LIMIT ?
            ''', (track_id, limit))
            
            results = []
            for row in cursor:
                results.append({
                    'id': row[0],
                    'filepath': row[1],
                    'title': row[2] or 'Unknown',
                    'artist': row[3] or 'Unknown',
                    'bpm': row[4],
                    'camelot_key': row[5],
                    'energy_level': row[6] or 5,
                    'mood': row[7],
                    'genre': row[8],
                    'distance': row[9]
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting similar tracks: {e}")
            return []
    
    def save_track_clusters(self, assignments: list[tuple]) -> int:
        """
        Save track cluster assignments.
        
        Args:
            assignments: List of (track_id, cluster_id, confidence) tuples
            
        Returns:
            Number of assignments saved
        """
        try:
            # Clear existing assignments
            self.conn.execute('DELETE FROM track_clusters')
            
            # Insert new assignments
            saved = 0
            for assignment in assignments:
                if len(assignment) >= 2:
                    track_id = assignment[0]
                    cluster_id = assignment[1]
                    confidence = assignment[2] if len(assignment) > 2 else 1.0
                    
                    self.conn.execute('''
                        INSERT OR REPLACE INTO track_clusters 
                        (track_id, cluster_id, confidence, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (track_id, cluster_id, confidence))
                    saved += 1
            
            self.conn.commit()
            return saved
            
        except Exception as e:
            logger.error(f"Error saving track clusters: {e}")
            return 0
    
    def save_structure(self, track_id: int, structure: dict) -> bool:
        """
        Save musical structure analysis to database.
        
        Args:
            track_id: Track ID
            structure: Dict with segments, transition_points, energy_curve
            
        Returns:
            True if saved successfully
        """
        try:
            import json
            
            # Extract data
            energy_curve = structure.get('energy_curve', [])
            transition_points = structure.get('transition_points', [])
            segments = structure.get('segments', [])
            
            # Convert to JSON strings
            energy_json = json.dumps(energy_curve)
            transition_json = json.dumps(transition_points)
            
            # Check if hamms_advanced row exists
            existing = self.conn.execute(
                'SELECT file_id FROM hamms_advanced WHERE file_id = ?',
                (track_id,)
            ).fetchone()
            
            if existing:
                # Update existing row
                self.conn.execute('''
                    UPDATE hamms_advanced
                    SET energy_curve = ?, transition_points = ?
                    WHERE file_id = ?
                ''', (energy_json, transition_json, track_id))
            else:
                # Insert new row
                self.conn.execute('''
                    INSERT INTO hamms_advanced (file_id, energy_curve, transition_points)
                    VALUES (?, ?, ?)
                ''', (track_id, energy_json, transition_json))
            
            # Optionally save structure summary to ai_analysis
            if segments:
                structure_summary = {
                    'segments': segments,
                    'mix_points': {
                        'mix_in': transition_points[0] if len(transition_points) > 0 else None,
                        'mix_out': transition_points[-1] if len(transition_points) > 1 else None,
                        'drops': transition_points[1:-1] if len(transition_points) > 2 else []
                    }
                }
                structure_json = json.dumps(structure_summary)
                
                # Check if ai_analysis row exists
                ai_existing = self.conn.execute(
                    'SELECT track_id FROM ai_analysis WHERE track_id = ?',
                    (track_id,)
                ).fetchone()
                
                if ai_existing:
                    # Update structure field
                    self.conn.execute('''
                        UPDATE ai_analysis
                        SET structure = ?
                        WHERE track_id = ?
                    ''', (structure_json, track_id))
                else:
                    # Insert minimal row with structure
                    self.conn.execute('''
                        INSERT INTO ai_analysis (track_id, structure)
                        VALUES (?, ?)
                    ''', (track_id, structure_json))
            
            self.conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error saving structure: {e}")
            return False
    
    def get_cluster_tracks(self, cluster_id: int) -> list[dict]:
        """
        Get all tracks in a cluster.
        
        Args:
            cluster_id: Cluster ID
            
        Returns:
            List of track dicts with full info
        """
        try:
            cursor = self.conn.execute('''
                SELECT 
                    t.id, t.file_path as filepath, t.title, t.artist,
                    t.bpm, t.camelot_key, t.energy_level,
                    a.mood, a.genre,
                    c.confidence
                FROM track_clusters c
                JOIN tracks t ON c.track_id = t.id
                LEFT JOIN ai_analysis a ON t.id = a.track_id
                WHERE c.cluster_id = ?
                ORDER BY c.confidence DESC, t.title
            ''', (cluster_id,))
            
            results = []
            for row in cursor:
                results.append({
                    'id': row[0],
                    'filepath': row[1],
                    'title': row[2] or 'Unknown',
                    'artist': row[3] or 'Unknown',
                    'bpm': row[4],
                    'camelot_key': row[5],
                    'energy_level': row[6] or 5,
                    'mood': row[7],
                    'genre': row[8],
                    'confidence': row[9]
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting cluster tracks: {e}")
            return []
    
    def list_clusters(self) -> list[dict]:
        """
        List all clusters with their sizes.
        
        Returns:
            List of dicts with cluster_id and track_count
        """
        try:
            cursor = self.conn.execute('''
                SELECT cluster_id, COUNT(*) as track_count
                FROM track_clusters
                GROUP BY cluster_id
                ORDER BY cluster_id
            ''')
            
            results = []
            for row in cursor:
                results.append({
                    'cluster_id': row[0],
                    'track_count': row[1]
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error listing clusters: {e}")
            return []
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


# Initialize empty database on module import
if __name__ == "__main__":
    # Create and clear database
    db = MusicDatabase()
    db.clear_database()
    print(f"Database initialized and cleared at: {db.db_path}")
    db.close()
