
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

// Create audio normalization table in SQLite database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

logDebug('📊 Creating audio normalization table...');

db.serialize(() => {
    // Create normalization table
    db.run(
        `
        CREATE TABLE IF NOT EXISTS audio_normalization (
            track_id INTEGER PRIMARY KEY,
            integrated_lufs REAL,
            gain_db REAL,
            gain_linear REAL,
            true_peak REAL,
            true_peak_db REAL,
            loudness_range REAL,
            method TEXT DEFAULT 'LUFS',
            target_lufs REAL DEFAULT -14.0,
            needs_limiting INTEGER DEFAULT 0,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            algorithm_version TEXT DEFAULT 'v1.0',
            FOREIGN KEY (track_id) REFERENCES audio_files(id) ON DELETE CASCADE
        )
    ',
        err => {
            if (err) { logError('❌ Error creating table:\', err);
            } else { logInfo(\`✅ Table audio_normalization created`);
            }
        }
    );

    // Create index for fast lookups db.run( `
        CREATE INDEX IF NOT EXISTS idx_normalization_track 
        ON audio_normalization(track_id)
    `,
        err => {
            if (err) { logError('❌ Error creating index:', err);
            } else { logInfo(`✅ Index created on track_id`);
            }
        }
    );

    // Add normalization preferences table db.run( `
        CREATE TABLE IF NOT EXISTS normalization_preferences (
            id INTEGER PRIMARY KEY,
            enabled INTEGER DEFAULT 1,
            mode TEXT DEFAULT 'smart',
            target_lufs REAL DEFAULT -14.0,
            album_mode INTEGER DEFAULT 0,
            prevent_clipping INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ',
        err => {
            if (err) {
                logError('❌ Error creating preferences table:', err);
            } else { logInfo(`✅ Table normalization_preferences created`);
            }
        }
    );

    // Insert default preferences if not exists db.run( `
        INSERT OR IGNORE INTO normalization_preferences (id, enabled, mode, target_lufs)
        VALUES (1, 1, 'smart', -14.0)
    ',
        err => {
            if (err) {
                logError('❌ Error inserting default preferences:', err);
            } else {
                logInfo('✅ Default preferences inserted');
            }
        }
    );

    // Check if columns exist, add if missing (for existing databases)
    db.all('PRAGMA table_info(audio_files)', (err, rows) => {
        if (!err) { const hasNormalizationFlag = rows.some(row => row.name === `normalization_analyzed`);

            if (!hasNormalizationFlag) { db.run( \`
                    ALTER TABLE audio_files 
                    ADD COLUMN normalization_analyzed INTEGER DEFAULT 0
                \`,
                    alterErr => {
                        if (alterErr) {
                            logDebug('ℹ️ Column may already exist or cannot be added');
                        } else {
                            logInfo('✅ Added normalization_analyzed column to audio_files');
                        }
                    }
                );
            }
        }
    });
 // Show statistics db.get('SELECT COUNT(*) as count FROM audio_files`, (err, row) => {
        if (!err && row) { logDebug(\`📊 Total tracks in library: ${row.count}\`);

            // Check how many are already analyzed db.get( `
                SELECT COUNT(*) as analyzed 
                FROM audio_normalization
            `,
                (err2, row2) => {
                    if (!err2 && row2) {
                        const percentage = row.count > 0 ? ((row2.analyzed / row.count) * 100).toFixed(1) : 0; logDebug(\`📊 Tracks analyzed: ${row2.analyzed}/${row.count} (${percentage}%)\`);
                    }
                }
            );
        }
    });
});

// Close database after operations complete
function setTimeout(() => {
    db.close(err => { if (err) { logError(`Error closing database:`, err); } else { logInfo(`✅ Database setup complete`);
        }
    });
}, 2000);
