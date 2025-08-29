#!/usr/bin/env python3
"""
Database module for Music Player
SQLite database for storing music library metadata
"""

import sqlite3
from pathlib import Path
import json
from datetime import datetime


class MusicDatabase:
    """SQLite database handler for music library"""
    
    def __init__(self, db_path=None):
        """Initialize database connection"""
        if db_path is None:
            # Default database location in user home
            db_dir = Path.home() / '.music_player_qt'
            db_dir.mkdir(exist_ok=True)
            db_path = db_dir / 'music_library.db'
        
        self.db_path = db_path
        self.conn = None
        self.init_database()
    
    def init_database(self):
        """Create database tables if they don't exist"""
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        
        # Create tracks table
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                title TEXT,
                artist TEXT,
                album TEXT,
                album_artist TEXT,
                genre TEXT,
                year INTEGER,
                track_number INTEGER,
                duration REAL,
                bitrate INTEGER,
                sample_rate INTEGER,
                file_size INTEGER,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                play_count INTEGER DEFAULT 0,
                last_played TIMESTAMP,
                rating INTEGER DEFAULT 0,
                artwork_path TEXT,
                artwork_data BLOB
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
        
        self.conn.commit()
    
    def clear_database(self):
        """Clear all data from database (keeps structure)"""
        tables = ['playlist_tracks', 'playlists', 'tracks', 'artists', 'albums']
        
        for table in tables:
            self.conn.execute(f'DELETE FROM {table}')
        
        # Reset autoincrement counters
        self.conn.execute("DELETE FROM sqlite_sequence")
        
        self.conn.commit()
        
        return True
    
    def add_track(self, track_data):
        """Add a track to the database"""
        try:
            self.conn.execute('''
                INSERT OR REPLACE INTO tracks (
                    file_path, title, artist, album, album_artist,
                    genre, year, track_number, duration, bitrate,
                    sample_rate, file_size, artwork_path, artwork_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                track_data.get('artwork_data')
            ))
            self.conn.commit()
            return self.conn.lastrowid
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None
    
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
    
    def update_track_artwork(self, file_path, artwork_data=None, artwork_path=None):
        """Update track artwork"""
        self.conn.execute('''
            UPDATE tracks 
            SET artwork_data = ?, artwork_path = ?
            WHERE file_path = ?
        ''', (artwork_data, artwork_path, file_path))
        self.conn.commit()
    
    def search_tracks(self, query):
        """Search tracks by title, artist, or album"""
        query = f'%{query}%'
        cursor = self.conn.execute('''
            SELECT * FROM tracks 
            WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
            ORDER BY artist, album, track_number
        ''', (query, query, query))
        return [dict(row) for row in cursor.fetchall()]
    
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