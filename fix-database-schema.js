const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing database schema...');

// Create playlists table
const createPlaylistsTable = `
    CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'manual',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        track_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        rules TEXT,
        logic TEXT DEFAULT 'AND'
    )
`;

// Create smart_playlist_rules table
const createSmartPlaylistRulesTable = `
    CREATE TABLE IF NOT EXISTS smart_playlist_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        operator TEXT NOT NULL,
        value TEXT NOT NULL,
        value2 TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )
`;

// Create playlist_tracks table
const createPlaylistTracksTable = `
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        position INTEGER,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE,
        UNIQUE(playlist_id, track_id)
    )
`;

// Add missing columns to audio_files table if they don't exist
const addMissingColumns = [
    "ALTER TABLE audio_files ADD COLUMN existing_bpm TEXT",
    "ALTER TABLE audio_files ADD COLUMN existing_key TEXT",
    "ALTER TABLE audio_files ADD COLUMN duration REAL",
    "ALTER TABLE audio_files ADD COLUMN date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE audio_files ADD COLUMN play_count INTEGER DEFAULT 0",
    "ALTER TABLE audio_files ADD COLUMN last_played TIMESTAMP",
    "ALTER TABLE audio_files ADD COLUMN rating INTEGER"
];

// Execute all schema updates
db.serialize(() => {
    // Create tables
    db.run(createPlaylistsTable, (err) => {
        if (err) {
            console.log('❌ Error creating playlists table:', err.message);
        } else {
            console.log('✅ Playlists table created/verified');
        }
    });

    db.run(createSmartPlaylistRulesTable, (err) => {
        if (err) {
            console.log('❌ Error creating smart_playlist_rules table:', err.message);
        } else {
            console.log('✅ Smart playlist rules table created/verified');
        }
    });

    db.run(createPlaylistTracksTable, (err) => {
        if (err) {
            console.log('❌ Error creating playlist_tracks table:', err.message);
        } else {
            console.log('✅ Playlist tracks table created/verified');
        }
    });

    // Add missing columns (ignore errors if columns already exist)
    addMissingColumns.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                // Only log if it's not a "column already exists" error
                if (!err.message.includes('duplicate')) {
                    console.log('Column add attempt:', sql.substring(0, 50) + '...');
                }
            } else if (!err) {
                console.log('✅ Added column:', sql.split('ADD COLUMN')[1].split(' ')[1]);
            }
        });
    });

    // Create indexes for better performance
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_playlist_type ON playlists(type)",
        "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)",
        "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id)",
        "CREATE INDEX IF NOT EXISTS idx_smart_rules_playlist ON smart_playlist_rules(playlist_id)",
        "CREATE INDEX IF NOT EXISTS idx_audio_files_bpm ON audio_files(existing_bpm)",
        "CREATE INDEX IF NOT EXISTS idx_audio_files_key ON audio_files(existing_key)"
    ];

    indexes.forEach(sql => {
        db.run(sql, (err) => {
            if (err) {
                console.log('❌ Error creating index:', err.message);
            } else {
                const indexName = sql.match(/idx_\w+/)[0];
                console.log('✅ Index created/verified:', indexName);
            }
        });
    });

    // Fix the column name in energy-flow-handler query
    // First check if existing_bmp exists and needs to be renamed
    db.all("PRAGMA table_info(audio_files)", (err, columns) => {
        if (!err) {
            const hasBmp = columns.some(col => col.name === 'existing_bmp');
            const hasBpm = columns.some(col => col.name === 'existing_bpm');
            
            if (hasBmp && !hasBpm) {
                // Rename existing_bmp to existing_bpm
                console.log('🔄 Renaming existing_bmp to existing_bpm...');
                db.run("ALTER TABLE audio_files RENAME COLUMN existing_bmp TO existing_bpm", (err) => {
                    if (err) {
                        console.log('❌ Could not rename column:', err.message);
                    } else {
                        console.log('✅ Column renamed from existing_bmp to existing_bpm');
                    }
                });
            }
        }
    });

    // Wait a bit then close
    setTimeout(() => {
        console.log('\n📊 Database schema update complete!');
        db.close();
    }, 2000);
});