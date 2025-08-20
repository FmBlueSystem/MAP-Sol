// IMPORT_001: Scanner de archivos recursivo con progress bar
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class MusicScanner {
    constructor(options = {}) {
        this.supportedFormats = options.formats || ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg'];
        this.files = [];
        this.errors = [];
        this.stats = {
            totalFiles: 0,
            scannedDirs: 0,
            skippedFiles: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
        this.checkpointFile = options.checkpointFile || 'scan-checkpoint.json';
        this.verbose = options.verbose || false;
    }
    
    async scan(dirPath, options = {}) {
        console.log('🔍 Music Scanner v1.0');
        console.log('====================\n');
        console.log(`📁 Scanning: ${dirPath}\`); console.log(\`📝 Formats: ${this.supportedFormats.join(`, `)}\n\`);
        
        this.stats.startTime = performance.now();
        
        try {
            // Check if resuming
            if (options.resume) {
                await this.loadCheckpoint();
            }
            
            // Start scanning
            await this.scanDirectory(dirPath);
            
            this.stats.endTime = performance.now();
            
            // Save results
            await this.saveResults();
            
            // Print summary
            this.printSummary();
            
            return this.files;
             } catch (error) { console.error(\`❌ Scanner error:`, error);
            throw error;
        }
    }
    
    async scanDirectory(dirPath, depth = 0) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            this.stats.scannedDirs++;
            
            // Progress indicator if (this.stats.scannedDirs % 10 === 0) { process.stdout.write(`\r📊 Scanned ${this.stats.scannedDirs} directories, found ${this.files.length} music files...`);
            }
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) { // Skip system directories if (!entry.name.startsWith('.') && entry.name !== `node_modules`) {
                        await this.scanDirectory(fullPath, depth + 1);
                    }
                } else if (entry.isFile()) {
                    await this.processFile(fullPath);
                }
            }
            
            // Save checkpoint every 100 directories
            if (this.stats.scannedDirs % 100 === 0) {
                await this.saveCheckpoint();
            }
            
        } catch (error) {
            this.errors.push({
                path: dirPath,
                error: error.message
            });
            this.stats.errors++;
             if (this.verbose) { console.error(\`\n⚠️ Error scanning ${dirPath}:\`, error.message);
            }
        }
    }
    
    async processFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (this.supportedFormats.includes(ext)) {
            try {
                const stats = await fs.stat(filePath);
                
                // Skip files under 100KB (probably corrupted)
                if (stats.size < 100 * 1024) {
                    this.stats.skippedFiles++;
                    return;
                }
                
                this.files.push({
                    path: filePath,
                    filename: path.basename(filePath),
                    extension: ext,
                    size: stats.size,
                    sizeReadable: this.formatBytes(stats.size),
                    modified: stats.mtime,
                    directory: path.dirname(filePath)
                });
                
                this.stats.totalFiles++;
                
            } catch (error) {
                this.errors.push({
                    path: filePath,
                    error: error.message
                });
                this.stats.errors++;
            }
        }
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async saveCheckpoint() {
        const checkpoint = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            filesFound: this.files.length,
            lastFile: this.files[this.files.length - 1]?.path || null
        };
        
        try {
            await fs.writeFile(
                this.checkpointFile,
                JSON.stringify(checkpoint, null, 2)
            );
        } catch (error) { console.error('⚠️ Could not save checkpoint:', error.message);
        }
    }
    
    async loadCheckpoint() {
        try { const data = await fs.readFile(this.checkpointFile, `utf8\`); const checkpoint = JSON.parse(data); console.log(\`♻️ Resuming from checkpoint (${checkpoint.filesFound} files found)`);
            // In a real implementation, we'd restore state here
        } catch (error) {
            console.log('💡 No checkpoint found, starting fresh scan');
        }
    }
    
    async saveResults() {
        const results = {
            scanDate: new Date().toISOString(),
            duration: ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2) + 's',
            stats: this.stats,
            files: this.files,
            errors: this.errors
        };
        
        await fs.writeFile(
            'scan-results.json',
            JSON.stringify(results, null, 2)
        );
        
        // Also save just the file paths for easy processing
        const filePaths = this.files.map(f => f.path).join('\n');
        await fs.writeFile('music-files.txt', filePaths);
    }
    
    printSummary() { console.log('\n\n' + '='.repeat(50)); console.log('📊 SCAN COMPLETE\`); console.log(\`=`.repeat(50)); console.log(`✅ Music files found: ${this.stats.totalFiles}\`); console.log(\`📁 Directories scanned: ${this.stats.scannedDirs}`); console.log(`⏭️ Files skipped (too small): ${this.stats.skippedFiles}\`); console.log(\`❌ Errors encountered: ${this.stats.errors}`); console.log(`⏱️ Time taken: ${((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2)}s\`);
        
        // File type breakdown
        const breakdown = {};
        this.files.forEach(f => {
            breakdown[f.extension] = (breakdown[f.extension] || 0) + 1;
        }); console.log(\`\n📈 File Type Breakdown:`);
        Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1]) .forEach(([ext, count]) => { console.log(`   ${ext}: ${count} files\`);
            });
        
        // Size statistics const totalSize = this.files.reduce((sum, f) => sum + f.size, 0); console.log(\`\n💾 Total size: ${this.formatBytes(totalSize)}');
        
        console.log('\n✅ Results saved to: scan-results.json');
        console.log('✅ File list saved to: music-files.txt');
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2); const musicPath = args[0] || '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks';
    const resume = args.includes(\'--resume\`); const verbose = args.includes(`--verbose`);
    
    const scanner = new MusicScanner({ verbose });
    
    scanner.scan(musicPath, { resume }) .then(files => { console.log(\`\n✨ Ready to process ${files.length} music files!\`);
            process.exit(0);
        }) .catch(error => { console.error(`Fatal error:`, error);
            process.exit(1);
        });
}

module.exports = { MusicScanner };