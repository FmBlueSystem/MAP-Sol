-- Playlist Database Schema for MAP
-- Persistent playlist storage with full metadata

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    play_count INTEGER DEFAULT 0,
    is_smart BOOLEAN DEFAULT 0,
    is_folder BOOLEAN DEFAULT 0, -- For playlist folders
    smart_criteria TEXT, -- JSON for smart playlist rules
    parent_id INTEGER, -- For playlist folders hierarchy
    sort_order INTEGER DEFAULT 0,
    color TEXT, -- Hex color for UI
    FOREIGN KEY (parent_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Playlist tracks junction table
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id, position)
);

-- Playlist metadata for analytics
CREATE TABLE IF NOT EXISTS playlist_metadata (
    playlist_id INTEGER PRIMARY KEY,
    total_duration INTEGER DEFAULT 0, -- in seconds
    total_tracks INTEGER DEFAULT 0,
    avg_bpm REAL,
    avg_energy REAL,
    avg_valence REAL,
    genres TEXT, -- JSON array of top genres
    moods TEXT, -- JSON array of dominant moods
    key_distribution TEXT, -- JSON object with key counts
    last_analyzed TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Playlist history for undo/redo
CREATE TABLE IF NOT EXISTS playlist_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'add', 'remove', 'reorder', 'rename', etc.
    data TEXT, -- JSON with action details
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playlist_name ON playlists(name);
CREATE INDEX IF NOT EXISTS idx_playlist_parent ON playlists(parent_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_history ON playlist_history(playlist_id, timestamp DESC);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_playlist_timestamp 
AFTER UPDATE ON playlists
BEGIN
    UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update playlist metadata
CREATE TRIGGER IF NOT EXISTS update_playlist_track_count
AFTER INSERT ON playlist_tracks
BEGIN
    UPDATE playlist_metadata 
    SET total_tracks = (
        SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = NEW.playlist_id
    )
    WHERE playlist_id = NEW.playlist_id;
END;

CREATE TRIGGER IF NOT EXISTS update_playlist_track_count_delete
AFTER DELETE ON playlist_tracks
BEGIN
    UPDATE playlist_metadata 
    SET total_tracks = (
        SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = OLD.playlist_id
    )
    WHERE playlist_id = OLD.playlist_id;
END;