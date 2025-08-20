const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');

console.log('📦 Creating database schema...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Create tables
db.serialize(() => {
    // Create audio_files table
    db.run(
        `
        CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE,
            file_name TEXT,
            title TEXT,
            artist TEXT,
            album TEXT,
            genre TEXT,
            year INTEGER,
            duration REAL,
            bitrate INTEGER,
            sample_rate INTEGER,
            file_size INTEGER,
            file_extension TEXT,
            existing_bpm TEXT,
            artwork_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `,
        (err) => {
            if (err) {
                console.error('❌ Error creating audio_files table:', err);
            } else {
                console.log('✅ Created audio_files table');
            }
        }
    );

    // Create llm_metadata table
    db.run(
        `
        CREATE TABLE IF NOT EXISTS llm_metadata (
            file_id INTEGER PRIMARY KEY,
            LLM_GENRE TEXT,
            AI_MOOD TEXT,
            LLM_MOOD TEXT,
            AI_ENERGY REAL,
            AI_BPM INTEGER,
            AI_KEY TEXT,
            AI_DANCEABILITY REAL,
            AI_VALENCE REAL,
            AI_ACOUSTICNESS REAL,
            AI_INSTRUMENTALNESS REAL,
            AI_LIVENESS REAL,
            AI_SPEECHINESS REAL,
            AI_LOUDNESS REAL,
            AI_TEMPO_CONFIDENCE REAL,
            AI_KEY_CONFIDENCE REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES audio_files(id) ON DELETE CASCADE
        )
    `,
        (err) => {
            if (err) {
                console.error('❌ Error creating llm_metadata table:', err);
            } else {
                console.log('✅ Created llm_metadata table');
            }
        }
    );

    // Create indexes for better performance
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_artist ON audio_files(artist)',
        'CREATE INDEX IF NOT EXISTS idx_title ON audio_files(title)',
        'CREATE INDEX IF NOT EXISTS idx_album ON audio_files(album)',
        'CREATE INDEX IF NOT EXISTS idx_genre ON audio_files(genre)',
        'CREATE INDEX IF NOT EXISTS idx_file_name ON audio_files(file_name)',
        'CREATE INDEX IF NOT EXISTS idx_llm_genre ON llm_metadata(LLM_GENRE)',
        'CREATE INDEX IF NOT EXISTS idx_ai_mood ON llm_metadata(AI_MOOD)',
        'CREATE INDEX IF NOT EXISTS idx_ai_bpm ON llm_metadata(AI_BPM)',
        'CREATE INDEX IF NOT EXISTS idx_ai_energy ON llm_metadata(AI_ENERGY)',
        'CREATE INDEX IF NOT EXISTS idx_file_id ON llm_metadata(file_id)',
    ];

    indexes.forEach((indexSql) => {
        db.run(indexSql, (err) => {
            if (err) {
                console.error('❌ Error creating index:', err);
            }
        });
    });

    console.log('✅ Created indexes');

    // Check if tables are empty
    db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
        if (err) {
            console.error('❌ Error checking table:', err);
        } else {
            console.log('\n📊 Database status:');
            console.log(`   Audio files: ${row.count}`);

            if (row.count === 0) {
                console.log('\n⚠️  Database is empty!');
                console.log('   Run one of these commands to import music:');
                console.log('   - npm run import');
                console.log('   - node import-music.js /path/to/music/folder');
            }
        }

        db.close(() => {
            console.log('\n✅ Database setup complete!');
        });
    });
});
