#!/usr/bin/env node

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkStatus() {
    // Get scan results
    const scanResults = JSON.parse(fs.readFileSync('scan-results.json', 'utf8'));
    const files = scanResults.files;

    // Check what files are already processed
    const db = new sqlite3.Database('./music_analyzer.db');

    db.all('SELECT file_path FROM audio_files_import', (err, rows) => {
        if (err) {
            logError(err);
            return;
        }

        const processedPaths = new Set(rows.map(r => r.file_path));
        const unprocessed = files.filter(f => !processedPaths.has(f.path));

        logDebug('📊 IMPORT STATUS CHECK');
        logDebug('='.repeat(50));
        logDebug('Total files in scan:', files.length);
        logDebug('Already processed:', processedPaths.size);
        logDebug('Remaining to process:', unprocessed.length);
        logDebug('Completion:', ((processedPaths.size / files.length) * 100).toFixed(1) + '%');

        if (unprocessed.length > 0) {
            logDebug('\n❌ First 10 unprocessed files:');
            unprocessed.slice(0, 10).forEach(f => {
                logDebug('  -', f.filename);
            });

            // Check if there's a problematic file pattern
            const extensions = {};
            unprocessed.forEach(f => {
                const ext = f.extension;
                extensions[ext] = (extensions[ext] || 0) + 1;
            });

            logDebug('\n📈 Unprocessed by extension:');
            Object.entries(extensions).forEach(([ext, count]) => {
                logDebug(`  ${ext}: ${count} files`);
            });
        }

        db.close();
    });
}

checkStatus().catch(console.error);
