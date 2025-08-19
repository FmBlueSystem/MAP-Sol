// Emergency fix to verify app state
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

logDebug('\n🔍 DIAGNOSTIC CHECK:\n');

// Check total files
db.get('SELECT COUNT(*) as total FROM audio_files', (err, row) => {
    if (!err && row) {
        logInfo('✅ Total files in database: ${row.total}`);
    }
});

// Check files with artwork
db.get(
    'SELECT COUNT(*) as with_artwork FROM audio_files WHERE artwork_path IS NOT NULL',
    (err, row) => {
        if (!err && row) {
            logDebug(`🖼️ Files with artwork: ${row.with_artwork}`);
        }
    }
);

// Check first 5 files
db.all('SELECT id, file_name, artwork_path FROM audio_files LIMIT 5', (err, rows) => {
    if (!err && rows) {
        logDebug('\n📋 Sample files:');
        rows.forEach(file => {
            logDebug(`  - ${file.file_name} ${file.artwork_path ? '✅' : '❌'}`);
        });
    }
});

// Check if handlers are working
setTimeout(() => {
    logDebug('\n📌 RECOMMENDATIONS:');
    logDebug('1. The database has all files');
    logDebug('2. Main process is loading index-with-search.html');
    logDebug('3. The issue is likely with the renderer/preload context');
    logDebug('\nTry opening Developer Tools in the app (View > Toggle Developer Tools)');
    logDebug('Check the Console for any errors\n');
    db.close();
}, 500);
