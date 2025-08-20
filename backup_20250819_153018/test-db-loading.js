#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

logDebug('Testing database loading...');

const sql = `
    SELECT COUNT(*) as total FROM audio_files
`;

db.get(sql, [], (err, row) => {
    if (err) {
        logError('Error:', err);
    } else {
        logDebug(`Total files in database: ${row.total}`);

        // Now test loading first 10
        const testSql = `
            SELECT 
                af.id,
                af.file_path,
                af.file_name,
                af.title,
                af.artist
            FROM audio_files af
            LIMIT 10
        `;

        db.all(testSql, [], (err2, rows) => {
            if (err2) {
                logError('Error loading files:', err2);
            } else {
                logDebug(`Loaded ${rows.length} test files successfully`);
                rows.forEach((r) => logDebug(`  - ${r.artist} - ${r.title || r.file_name}`));
            }
            db.close();
        });
    }
});
