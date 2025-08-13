#!/usr/bin/env node
// Monitor de progreso de importación

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function monitor() {
    console.clear();
    console.log('📊 IMPORT MONITOR v1.0');
    console.log('=' .repeat(50));
    
    // Check checkpoint file
    try {
        const checkpoint = JSON.parse(
            fs.readFileSync('import-checkpoint.json', 'utf8')
        );
        
        console.log('\n📍 Checkpoint Status:');
        console.log(`   Last update: ${checkpoint.timestamp}`);
        console.log(`   Backup: ${checkpoint.backupComplete ? '✅' : '⏳'}`);
        console.log(`   Scan: ${checkpoint.scanComplete ? '✅' : '⏳'}`);
        console.log(`   Metadata: ${checkpoint.metadataComplete ? '✅' : '⏳'}`);
        console.log(`   Artwork: ${checkpoint.artworkComplete ? '✅' : '⏳'}`);
        console.log(`   Migration: ${checkpoint.migrationComplete ? '✅' : '⏳'}`);
        
        if (checkpoint.metadataProgress) {
            console.log(`   Progress: ${checkpoint.metadataProgress} files`);
        }
    } catch {
        console.log('\n⚠️ No checkpoint file found');
    }
    
    // Check scan results
    try {
        const scanResults = JSON.parse(
            fs.readFileSync('scan-results.json', 'utf8')
        );
        
        console.log('\n📁 Scan Results:');
        console.log(`   Files found: ${scanResults.stats.totalFiles}`);
        console.log(`   Directories: ${scanResults.stats.scannedDirs}`);
        console.log(`   Duration: ${scanResults.duration}`);
    } catch {
        console.log('\n⚠️ No scan results found');
    }
    
    // Check database
    const db = new sqlite3.Database(
        path.join(__dirname, '../music_analyzer.db')
    );
    
    db.get('SELECT COUNT(*) as count FROM audio_files_import', [], (err, row) => {
        if (!err && row) {
            console.log('\n💾 Database Status:');
            console.log(`   Import table: ${row.count} tracks`);
        }
        
        db.get('SELECT COUNT(*) as count FROM audio_files', [], (err, row) => {
            if (!err && row) {
                console.log(`   Main table: ${row.count} tracks`);
            }
            
            // Check artwork
            const artworkDir = path.join(__dirname, '../artwork-cache');
            try {
                const files = fs.readdirSync(artworkDir);
                const jpgFiles = files.filter(f => f.endsWith('.jpg'));
                console.log(`   Artwork extracted: ${jpgFiles.length} images`);
            } catch {
                console.log(`   Artwork extracted: 0 images`);
            }
            
            console.log('\n' + '=' .repeat(50));
            console.log('📊 Press Ctrl+C to exit');
            
            db.close();
        });
    });
}

// Auto-refresh every 5 seconds
setInterval(monitor, 5000);
monitor();

console.log('\n🔄 Monitoring... (updates every 5 seconds)');