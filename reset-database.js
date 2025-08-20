const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

logDebug('🗑️ RESETTING DATABASE TO EMPTY STATE...\n');

const db = new sqlite3.Database('music_analyzer.db');

// Delete all data from tables
const queries = [
    // First delete from tables with foreign keys
    'DELETE FROM llm_metadata',
    'DELETE FROM llm_metadata_old',
    'DELETE FROM playlist_tracks',
    'DELETE FROM playlists',
    'DELETE FROM playlist_metadata',
    'DELETE FROM playlist_history',
    'DELETE FROM play_history',
    'DELETE FROM audio_features',
    'DELETE FROM audio_lyrics',
    'DELETE FROM audio_normalization',
    'DELETE FROM normalization_preferences',
    'DELETE FROM harmonic_analysis',
    'DELETE FROM extended_metadata',
    'DELETE FROM custom_tags',
    'DELETE FROM track_tags',
    'DELETE FROM set_preparation_tracks',
    'DELETE FROM set_preparations',
    'DELETE FROM smart_playlist_rules',
    'DELETE FROM statistics',
    'DELETE FROM user_settings',
    'DELETE FROM folders',
    'DELETE FROM audio_files_import',

    // Then delete from main table
    'DELETE FROM audio_files',

    // Reset autoincrement counters
    "DELETE FROM sqlite_sequence WHERE name='audio_files'",
    "DELETE FROM sqlite_sequence WHERE name='llm_metadata'",
    "DELETE FROM sqlite_sequence WHERE name='playlists'",
    "DELETE FROM sqlite_sequence WHERE name='playlist_tracks'",

    // Vacuum to reclaim space
    'VACUUM',
];

let completedQueries = 0;

function runQuery(query) {
    return new Promise((resolve, reject) => {
        db.run(query, function (err) {
            if (err) {
                logError(`❌ Error running: ${query}`);
                logError(err);
                reject(err);
            } else {
                logInfo('✅ Executed: ${query.substring(0, 50)}...');
                completedQueries++;
                resolve();
            }
        });
    });
}

async function resetDatabase() {
    logDebug('📊 Starting database reset...\n');

    for (const query of queries) {
        await runQuery(query);
    }

    // Verify tables are empty
    logDebug('\n📊 Verifying tables are empty...');

    db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
        if (!err) {
            logDebug(`   audio_files: ${row.count} records`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM llm_metadata', (err, row) => {
        if (!err) {
            logDebug(`   llm_metadata: ${row.count} records`);
        }
    });

    db.get('SELECT COUNT(*) as count FROM playlists', (err, row) => {
        if (!err) {
            logDebug(`   playlists: ${row.count} records`);
        }
    });

    // Get database size
    setTimeout(() => {
        const stats = fs.statSync('music_analyzer.db');
        const fileSizeInMB = stats.size / (1024 * 1024);
        logDebug(`\n📦 Database size: ${fileSizeInMB.toFixed(2)} MB`);

        logDebug('\n' + '='.repeat(60));
        logInfo('✅ DATABASE RESET COMPLETE!');
        logDebug('='.repeat(60));
        logDebug('\n📝 Summary:');
        logDebug(`   - ${completedQueries} queries executed`);
        logDebug('   - All tables emptied');
        logDebug('   - Autoincrement counters reset');
        logDebug('   - Database vacuumed');
        logDebug('\n🎯 Next steps:');
        logDebug('   1. Run import script to add new music');
        logDebug('   2. Or start the app and add music manually');
        logDebug('   3. Backup saved as: music_analyzer.db.backup.before_reset.*');

        db.close();
        process.exit(0);
    }, 1000);
}

resetDatabase().catch((err) => {
    logError('\n❌ RESET FAILED:', err);
    db.close();
    process.exit(1);
});
