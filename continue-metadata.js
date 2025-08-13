#!/usr/bin/env node

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { MetadataExtractor } = require('./import/extract-metadata');

async function continueExtraction() {
    console.log('🔄 CONTINUING METADATA EXTRACTION');
    console.log('=' .repeat(50));
    
    // Get scan results
    const scanResults = JSON.parse(fs.readFileSync('scan-results.json', 'utf8'));
    const allFiles = scanResults.files;
    
    // Check what files are already processed
    const db = new sqlite3.Database('./music_analyzer.db');
    
    const processedPaths = await new Promise((resolve, reject) => {
        db.all('SELECT file_path FROM audio_files_import', (err, rows) => {
            if (err) reject(err);
            else resolve(new Set(rows.map(r => r.file_path)));
        });
    });
    
    db.close();
    
    const unprocessed = allFiles.filter(f => !processedPaths.has(f.path));
    
    console.log(`Found ${unprocessed.length} unprocessed files`);
    
    if (unprocessed.length === 0) {
        console.log('✅ All files already processed!');
        
        // Update checkpoint
        const checkpoint = JSON.parse(fs.readFileSync('import-checkpoint.json', 'utf8'));
        checkpoint.metadataComplete = true;
        checkpoint.timestamp = new Date().toISOString();
        fs.writeFileSync('import-checkpoint.json', JSON.stringify(checkpoint, null, 2));
        
        return;
    }
    
    // Process remaining files
    const extractor = new MetadataExtractor();
    await extractor.init();
    
    console.log('\n📚 Processing remaining files...\n');
    
    // Process in smaller batches to avoid hanging
    const batchSize = 10; // Smaller batch size
    let processed = 0;
    
    for (let i = 0; i < unprocessed.length; i += batchSize) {
        const batch = unprocessed.slice(i, Math.min(i + batchSize, unprocessed.length));
        
        console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} files)`);
        
        try {
            await extractor.extractBatch(batch);
            processed += batch.length;
            
            console.log(`✅ Progress: ${processedPaths.size + processed}/${allFiles.length} (${((processedPaths.size + processed) / allFiles.length * 100).toFixed(1)}%)`);
            
            // Update checkpoint periodically
            if (processed % 50 === 0) {
                const checkpoint = JSON.parse(fs.readFileSync('import-checkpoint.json', 'utf8'));
                checkpoint.metadataProgress = processedPaths.size + processed;
                checkpoint.timestamp = new Date().toISOString();
                fs.writeFileSync('import-checkpoint.json', JSON.stringify(checkpoint, null, 2));
            }
        } catch (error) {
            console.error(`❌ Error processing batch:`, error);
            console.log('Continuing with next batch...');
        }
    }
    
    extractor.printSummary();
    await extractor.close();
    
    // Mark as complete
    const checkpoint = JSON.parse(fs.readFileSync('import-checkpoint.json', 'utf8'));
    checkpoint.metadataComplete = true;
    checkpoint.metadataProgress = allFiles.length;
    checkpoint.timestamp = new Date().toISOString();
    fs.writeFileSync('import-checkpoint.json', JSON.stringify(checkpoint, null, 2));
    
    console.log('\n✅ Metadata extraction complete!');
}

continueExtraction().catch(console.error);