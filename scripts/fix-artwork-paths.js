#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'music_analyzer.db');

const db = new sqlite3.Database(DB_PATH);

// Get all tracks with absolute artwork paths
db.all("SELECT id, artwork_path FROM audio_files WHERE artwork_path LIKE '/Users/%'", (err, rows) => {
    if (err) {
        console.error('Error querying database:', err);
        db.close();
        return;
    }

    console.log(`Found ${rows.length} tracks with absolute artwork paths`);

    let updated = 0;
    const updates = rows.map((row) => {
        return new Promise((resolve) => {
            const fileName = path.basename(row.artwork_path);
            const relativePath = `artwork-cache/${fileName}`;

            db.run('UPDATE audio_files SET artwork_path = ? WHERE id = ?', [relativePath, row.id], (err) => {
                if (err) {
                    console.error(`Error updating track ${row.id}:`, err);
                } else {
                    updated++;
                    console.log(`Updated track ${row.id}: ${row.artwork_path} -> ${relativePath}`);
                }
                resolve();
            });
        });
    });

    Promise.all(updates).then(() => {
        console.log(`\n✅ Updated ${updated} artwork paths to relative paths`);
        db.close();
    });
});
