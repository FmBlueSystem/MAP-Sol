#!/usr/bin/env node

/**
 * Test script to verify folder import functionality
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');

console.log('🔍 Testing Folder Import Functionality...\n');

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to connect to database:', err);
        process.exit(1);
    }

    console.log('✅ Connected to database');

    // Check audio_files table
    db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
        if (err) {
            console.error('❌ Error querying audio_files:', err);
        } else {
            console.log(`📊 Current tracks in database: ${row.count}`);
        }
    });

    // Check if handlers are registered (we can't test IPC directly from Node)
    console.log('\n📋 IPC Handlers that should be registered:');
    console.log('  - select-music-folder: Opens folder dialog');
    console.log('  - import-music-folder: Imports music from selected folder');
    console.log('  - get-files-with-cached-artwork: Gets tracks for display');
    console.log('  - search-tracks: Searches for tracks');

    console.log('\n✅ To test the import:');
    console.log('1. Start the app with: npm start');
    console.log('2. Look for the "Import Music Library" panel (bottom right)');
    console.log('3. Click "📁 Select Music Folder"');
    console.log('4. Choose a folder with music files');
    console.log('5. Click "⬇️ Import Music"');
    console.log('6. Watch the progress and results');

    db.close();
});
