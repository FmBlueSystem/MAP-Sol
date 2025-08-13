#!/usr/bin/env node
// IMPORT_005: Script maestro con checkpoints
const fs = require('fs').promises;
const path = require('path');
const { MusicScanner } = require('./scan-music');
const { MetadataExtractor } = require('./extract-metadata');
const { ArtworkExtractor } = require('./extract-artwork-batch');
const sqlite3 = require('sqlite3').verbose();

class MusicImporter {
    constructor(options = {}) {
        this.musicPath = options.path || '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks';
        this.limit = options.limit || null;
        this.resume = options.resume || false;
        this.workers = options.workers || 1;
        this.checkpointFile = 'import-checkpoint.json';
        this.checkpoint = null;
        this.stats = {
            startTime: Date.now(),
            filesScanned: 0,
            metadataExtracted: 0,
            artworkExtracted: 0,
            errors: []
        };
    }
    
    async run() {
        console.log('🎵 MUSIC LIBRARY IMPORTER v1.0');
        console.log('=' .repeat(50));
        console.log(`📁 Source: ${this.musicPath}`);
        console.log(`🔧 Workers: ${this.workers}`);
        console.log(`📊 Limit: ${this.limit || 'None'}`);
        console.log('=' .repeat(50) + '\n');
        
        try {
            // 1. Load checkpoint if resuming
            if (this.resume) {
                await this.loadCheckpoint();
            }
            
            // 2. Backup database
            if (!this.checkpoint || !this.checkpoint.backupComplete) {
                await this.backupDatabase();
                await this.saveCheckpoint({ backupComplete: true });
            }
            
            // 3. Scan files
            let files = [];
            if (!this.checkpoint || !this.checkpoint.scanComplete) {
                console.log('\n📂 PHASE 1: Scanning files...\n');
                files = await this.scanFiles();
                await this.saveCheckpoint({ 
                    scanComplete: true,
                    filesFound: files.length
                });
            } else {
                // Load from previous scan
                const scanResults = await fs.readFile('scan-results.json', 'utf8');
                files = JSON.parse(scanResults).files;
                console.log(`♻️ Loaded ${files.length} files from previous scan`);
            }
            
            // Apply limit if specified
            if (this.limit) {
                files = files.slice(0, this.limit);
                console.log(`📊 Limited to ${this.limit} files for testing`);
            }
            
            // 4. Extract metadata
            if (!this.checkpoint || !this.checkpoint.metadataComplete) {
                console.log('\n📚 PHASE 2: Extracting metadata...\n');
                await this.extractMetadata(files);
                await this.saveCheckpoint({ metadataComplete: true });
            }
            
            // 5. Extract artwork
            if (!this.checkpoint || !this.checkpoint.artworkComplete) {
                console.log('\n🎨 PHASE 3: Extracting artwork...\n');
                await this.extractArtwork();
                await this.saveCheckpoint({ artworkComplete: true });
            }
            
            // 6. Migrate to main table
            if (!this.checkpoint || !this.checkpoint.migrationComplete) {
                console.log('\n🔄 PHASE 4: Migrating to main database...\n');
                await this.migrateToMainTable();
                await this.saveCheckpoint({ migrationComplete: true });
            }
            
            // 7. Create indexes
            if (!this.checkpoint || !this.checkpoint.indexesComplete) {
                console.log('\n🔧 PHASE 5: Creating indexes...\n');
                await this.createIndexes();
                await this.saveCheckpoint({ indexesComplete: true });
            }
            
            // 8. Generate report
            await this.generateReport();
            
            console.log('\n✨ IMPORT COMPLETE! ✨\n');
            
        } catch (error) {
            console.error('\n❌ FATAL ERROR:', error);
            this.stats.errors.push(error.message);
            await this.saveCheckpoint({ error: error.message });
            process.exit(1);
        }
    }
    
    async backupDatabase() {
        const dbPath = path.join(__dirname, '../music_analyzer.db');
        const backupPath = path.join(__dirname, `../backup/music_analyzer_${Date.now()}.db`);
        
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        
        try {
            await fs.copyFile(dbPath, backupPath);
            console.log(`✅ Database backed up to: ${path.basename(backupPath)}`);
        } catch (error) {
            console.log('⚠️ Could not backup database (might not exist yet)');
        }
    }
    
    async scanFiles() {
        const scanner = new MusicScanner();
        const files = await scanner.scan(this.musicPath, { resume: this.resume });
        this.stats.filesScanned = files.length;
        return files;
    }
    
    async extractMetadata(files) {
        const extractor = new MetadataExtractor();
        await extractor.init();
        
        // Process in batches
        const batchSize = 100;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const paths = batch.map(f => f.path);
            
            await extractor.extractBatch(paths);
            
            // Save checkpoint every 500 files
            if (i % 500 === 0) {
                await this.saveCheckpoint({
                    metadataProgress: i + batch.length
                });
            }
            
            console.log(`\n📊 Overall progress: ${i + batch.length}/${files.length}`);
        }
        
        this.stats.metadataExtracted = extractor.processed;
        extractor.printSummary();
        await extractor.close();
    }
    
    async extractArtwork() {
        const extractor = new ArtworkExtractor({ startId: 492 });
        await extractor.init();
        await extractor.createPlaceholder();
        await extractor.extractFromDatabase();
        
        this.stats.artworkExtracted = extractor.stats.extracted;
        extractor.printSummary();
        await extractor.close();
    }
    
    async migrateToMainTable() {
        const db = new sqlite3.Database(
            path.join(__dirname, '../music_analyzer.db')
        );
        
        return new Promise((resolve, reject) => {
            // Migrate unique records to main table
            const sql = `
                INSERT OR IGNORE INTO audio_files (
                    file_path, file_name, title, artist, album, genre,
                    file_extension, existing_bmp, artwork_path, 
                    duration, bitrate, file_size
                )
                SELECT 
                    file_path, file_name, title, artist, album, genre,
                    file_extension, bpm as existing_bmp, artwork_path,
                    duration, bitrate, file_size
                FROM audio_files_import
                WHERE file_path NOT IN (
                    SELECT file_path FROM audio_files
                )
            `;
            
            db.run(sql, [], function(err) {
                if (err) {
                    console.error('❌ Migration error:', err);
                    reject(err);
                } else {
                    console.log(`✅ Migrated ${this.changes} new tracks to main table`);
                    db.close();
                    resolve();
                }
            });
        });
    }
    
    async createIndexes() {
        const db = new sqlite3.Database(
            path.join(__dirname, '../music_analyzer.db')
        );
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_file_path ON audio_files(file_path)',
            'CREATE INDEX IF NOT EXISTS idx_artist ON audio_files(artist)',
            'CREATE INDEX IF NOT EXISTS idx_album ON audio_files(album)',
            'CREATE INDEX IF NOT EXISTS idx_title ON audio_files(title)',
            'CREATE INDEX IF NOT EXISTS idx_genre ON audio_files(genre)'
        ];
        
        return new Promise((resolve, reject) => {
            let completed = 0;
            
            indexes.forEach(sql => {
                db.run(sql, [], (err) => {
                    if (err) console.error('Index error:', err);
                    completed++;
                    
                    if (completed === indexes.length) {
                        console.log(`✅ Created ${indexes.length} indexes`);
                        db.close();
                        resolve();
                    }
                });
            });
        });
    }
    
    async saveCheckpoint(data = {}) {
        this.checkpoint = { ...this.checkpoint, ...data };
        this.checkpoint.timestamp = new Date().toISOString();
        this.checkpoint.stats = this.stats;
        
        await fs.writeFile(
            this.checkpointFile,
            JSON.stringify(this.checkpoint, null, 2)
        );
    }
    
    async loadCheckpoint() {
        try {
            const data = await fs.readFile(this.checkpointFile, 'utf8');
            this.checkpoint = JSON.parse(data);
            console.log('♻️ Resuming from checkpoint:', this.checkpoint.timestamp);
        } catch {
            console.log('💡 No checkpoint found, starting fresh');
        }
    }
    
    async generateReport() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        const report = {
            timestamp: new Date().toISOString(),
            duration: `${(duration / 60).toFixed(2)} minutes`,
            stats: {
                filesScanned: this.stats.filesScanned,
                metadataExtracted: this.stats.metadataExtracted,
                artworkExtracted: this.stats.artworkExtracted,
                errors: this.stats.errors.length
            },
            performance: {
                filesPerSecond: (this.stats.filesScanned / duration).toFixed(2),
                averageTimePerFile: (duration / this.stats.filesScanned * 1000).toFixed(2) + 'ms'
            }
        };
        
        await fs.writeFile(
            'import-report.json',
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 IMPORT REPORT');
        console.log('='.repeat(50));
        console.log(`⏱️ Total time: ${report.duration}`);
        console.log(`📁 Files scanned: ${report.stats.filesScanned}`);
        console.log(`📚 Metadata extracted: ${report.stats.metadataExtracted}`);
        console.log(`🎨 Artwork extracted: ${report.stats.artworkExtracted}`);
        console.log(`⚡ Performance: ${report.performance.filesPerSecond} files/sec`);
        console.log(`❌ Errors: ${report.stats.errors}`);
        console.log('\n✅ Report saved to: import-report.json');
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    const options = {
        path: args.find(a => a.startsWith('--path='))?.split('=')[1],
        limit: args.find(a => a.startsWith('--limit='))?.split('=')[1],
        resume: args.includes('--resume'),
        workers: parseInt(args.find(a => a.startsWith('--workers='))?.split('=')[1] || '1')
    };
    
    if (options.limit) {
        options.limit = parseInt(options.limit);
    }
    
    const importer = new MusicImporter(options);
    importer.run();
}

module.exports = { MusicImporter };