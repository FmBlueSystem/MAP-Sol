/**
 * ADD UPDATED_AT COLUMN
 * Agrega columna updated_at a la tabla audio_files
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');

logDebug('📊 ADDING UPDATED_AT COLUMN');
logDebug('='.repeat(60));

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logError('❌ Database connection error:', err);
        process.exit(1);
    }

    logInfo('✅ Connected to database');
});

// Check if column exists
db.get("SELECT COUNT(*) as count FROM pragma_table_info('audio_files') WHERE name='updated_at'", (err, row) => {
    if (err) {
        logError('❌ Error checking column:', err);
        db.close();
        return;
    }

    if (row.count > 0) {
        logInfo('✅ Column updated_at already exists');
        db.close();
        return;
    }

    // Add column
    logDebug('📝 Adding updated_at column...');

    db.run('ALTER TABLE audio_files ADD COLUMN updated_at TIMESTAMP', (err) => {
        if (err) {
            logError('❌ Error adding column:', err);
            db.close();
        } else {
            logInfo('✅ Column added successfully');

            // Update existing records with created_at value
            db.run("UPDATE audio_files SET updated_at = COALESCE(created_at, datetime('now'))", function (err) {
                if (err) {
                    logError('❌ Error updating records:', err);
                } else {
                    logInfo('✅ Updated ${this.changes} records with timestamp');
                }

                db.close();
                logDebug('\n✨ Schema update complete!');
            });
        }
    });
});
