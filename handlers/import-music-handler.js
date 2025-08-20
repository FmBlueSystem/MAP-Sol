// Import Music Handler - Backend processing for adding new music files
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');
const { spawn } = require('child_process');

class ImportMusicHandler {
    constructor(db) {
        this.db = db;
        this.isProcessing = false;
        this.currentBatch = null;
        this.abortController = null;
        
        this.setupHandlers();
    }
    
    setupHandlers() {
        // File selection dialog
        ipcMain.handle('select-music-files', async (event) => {
            const result = await dialog.showOpenDialog({
                properties: ['openFile', 'openDirectory', 'multiSelections'],
                filters: [
                    { 
                        name: 'Audio Files', 
                        extensions: ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'aac', 'wma', 'aiff', 'ape', 'opus', 'webm'] 
                    },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!result.canceled) {
                return { filePaths: result.filePaths };
            }
            return null;
        });
        
        // Main import handler
        ipcMain.handle('import-music', async (event, data) => {
            if (this.isProcessing) {
                throw new Error('Import already in progress');
            }
            
            this.isProcessing = true;
            this.abortController = new AbortController();
            
            try {
                const { paths, options } = data;
                const result = await this.importFiles(paths, options, event);
                return result;
            } finally {
                this.isProcessing = false;
                this.abortController = null;
            }
        });
        
        // Cancel import
        ipcMain.handle('cancel-import', async () => {
            if (this.abortController) {
                this.abortController.abort();
            }
            this.isProcessing = false;
            return { canceled: true };
        });
    }
    
    async importFiles(paths, options, event) {
        const startTime = Date.now();
        const results = {
            imported: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            files: []
        };
        
        // Stage 1: Scan for audio files
        this.sendProgress(event, { stage: 'scan', current: 0, total: paths.length });
        const audioFiles = await this.scanForAudioFiles(paths);
        
        if (audioFiles.length === 0) {
            throw new Error('No audio files found in selected paths');
        }
        
        // Stage 2: Check for duplicates
        let filesToImport = audioFiles;
        if (options.checkDuplicates) {
            filesToImport = await this.filterDuplicates(audioFiles);
            results.skipped = audioFiles.length - filesToImport.length;
        }
        
        // Stage 3: Import files
        this.sendProgress(event, { 
            stage: 'import', 
            current: 0, 
            total: filesToImport.length 
        });
        
        for (let i = 0; i < filesToImport.length; i++) {
            if (this.abortController?.signal.aborted) {
                break;
            }
            
            const file = filesToImport[i];
            
            try {
                // Send progress update
                this.sendProgress(event, {
                    stage: 'import',
                    current: i + 1,
                    total: filesToImport.length,
                    fileName: path.basename(file)
                });
                
                // Import the file
                const fileData = await this.importSingleFile(file, options, event);
                results.files.push(fileData);
                results.imported++;
                
            } catch (error) {
                console.error(`Failed to import ${file}:`, error);
                results.errors.push({ file, error: error.message });
                results.failed++;
            }
        }
        
        // Calculate duration
        const duration = Math.round((Date.now() - startTime) / 1000);
        results.duration = duration;
        
        return results;
    }
    
    async scanForAudioFiles(paths) {
        const audioFiles = [];
        const audioExtensions = new Set([
            '.mp3', '.m4a', '.flac', '.wav', '.ogg', 
            '.aac', '.wma', '.aiff', '.ape', '.opus', '.webm'
        ]);
        
        for (const inputPath of paths) {
            const stats = await fs.stat(inputPath);
            
            if (stats.isDirectory()) {
                // Recursively scan directory
                const files = await this.scanDirectory(inputPath, audioExtensions);
                audioFiles.push(...files);
            } else if (stats.isFile()) {
                // Check if it's an audio file
                const ext = path.extname(inputPath).toLowerCase();
                if (audioExtensions.has(ext)) {
                    audioFiles.push(inputPath);
                }
            }
        }
        
        return audioFiles;
    }
    
    async scanDirectory(dirPath, extensions) {
        const files = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Skip hidden directories and common non-music folders
                if (!entry.name.startsWith('.') && 
                    !['node_modules', 'Library', 'System'].includes(entry.name)) {
                    const subFiles = await this.scanDirectory(fullPath, extensions);
                    files.push(...subFiles);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (extensions.has(ext)) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }
    
    async filterDuplicates(files) {
        const uniqueFiles = [];
        
        for (const file of files) {
            const exists = await this.checkFileExists(file);
            if (!exists) {
                uniqueFiles.push(file);
            }
        }
        
        return uniqueFiles;
    }
    
    async checkFileExists(filePath) {
        return new Promise((resolve) => {
            this.db.get(
                'SELECT id FROM audio_files WHERE file_path = ?',
                [filePath],
                (err, row) => {
                    resolve(!!row);
                }
            );
        });
    }
    
    async importSingleFile(filePath, options, event) {
        // Stage 1: Extract metadata
        this.sendProgress(event, { stage: 'metadata' });
        const metadata = await this.extractMetadata(filePath);
        
        // Stage 2: Generate file hash for deduplication
        const fileHash = await this.generateFileHash(filePath);
        
        // Stage 3: Insert into database
        const fileId = await this.insertFileRecord(filePath, metadata, fileHash);
        
        // Stage 4: Extract artwork
        if (options.extractArtwork && metadata.artwork) {
            this.sendProgress(event, { stage: 'artwork' });
            await this.extractArtwork(fileId, metadata.artwork);
        }
        
        // Stage 5: Run analysis (if enabled)
        if (options.runAnalysis) {
            this.sendProgress(event, { stage: 'analysis' });
            await this.runAnalysis(filePath, fileId);
        }
        
        // Stage 6: AI enrichment (optional)
        if (options.runAI) {
            this.sendProgress(event, { stage: 'ai' });
            await this.runAIEnrichment(fileId, metadata);
        }
        
        return {
            id: fileId,
            file_path: filePath,
            ...metadata
        };
    }
    
    async extractMetadata(filePath) {
        try {
            const metadata = await mm.parseFile(filePath);
            const common = metadata.common || {};
            const format = metadata.format || {};
            
            // Extract artwork if present
            let artwork = null;
            if (common.picture && common.picture.length > 0) {
                artwork = common.picture[0];
            }
            
            return {
                title: common.title || path.basename(filePath, path.extname(filePath)),
                artist: common.artist || 'Unknown Artist',
                album: common.album || 'Unknown Album',
                genre: common.genre ? common.genre.join(', ') : null,
                year: common.year || null,
                track: common.track?.no || null,
                duration: format.duration || null,
                bitrate: format.bitrate || null,
                sampleRate: format.sampleRate || null,
                artwork: artwork
            };
        } catch (error) {
            console.error('Metadata extraction error:', error);
            // Return basic metadata from filename
            return {
                title: path.basename(filePath, path.extname(filePath)),
                artist: 'Unknown Artist',
                album: 'Unknown Album',
                genre: null,
                year: null,
                track: null,
                duration: null,
                bitrate: null,
                sampleRate: null,
                artwork: null
            };
        }
    }
    
    async generateFileHash(filePath) {
        const stats = await fs.stat(filePath);
        const hash = crypto.createHash('md5');
        
        // Use file size and first 1KB of data for quick hash
        const buffer = Buffer.alloc(1024);
        const fd = await fs.open(filePath, 'r');
        await fd.read(buffer, 0, 1024, 0);
        await fd.close();
        
        hash.update(buffer);
        hash.update(stats.size.toString());
        
        return hash.digest('hex');
    }
    
    async insertFileRecord(filePath, metadata, fileHash) {
        return new Promise((resolve, reject) => {
            const fileName = path.basename(filePath);
            const fileExt = path.extname(filePath).toLowerCase().substring(1);
            
            this.db.run(
                `INSERT INTO audio_files (
                    file_path, file_name, title, artist, album, 
                    genre, year, track_number, duration, bitrate,
                    sample_rate, file_hash, file_extension, 
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    filePath,
                    fileName,
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.genre,
                    metadata.year,
                    metadata.track,
                    metadata.duration,
                    metadata.bitrate,
                    metadata.sampleRate,
                    fileHash,
                    fileExt
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
    
    async extractArtwork(fileId, artworkData) {
        if (!artworkData) return;
        
        try {
            const artworkDir = path.join(process.cwd(), 'artwork-cache');
            await fs.mkdir(artworkDir, { recursive: true });
            
            const artworkPath = path.join(artworkDir, `${fileId}.jpg`);
            await fs.writeFile(artworkPath, artworkData.data);
            
            // Update database with artwork path
            return new Promise((resolve) => {
                this.db.run(
                    'UPDATE audio_files SET artwork_path = ? WHERE id = ?',
                    [artworkPath, fileId],
                    (err) => {
                        if (err) console.error('Error updating artwork path:', err);
                        resolve();
                    }
                );
            });
        } catch (error) {
            console.error('Artwork extraction error:', error);
        }
    }
    
    async runAnalysis(filePath, fileId) {
        return new Promise((resolve) => {
            // Run the Python analysis script
            const analysisScript = path.join(process.cwd(), 'calculate_audio_features.py');
            const python = spawn('python3', [analysisScript, filePath, fileId]);
            
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    console.error('Analysis error:', error);
                } else {
                    console.log('Analysis complete:', output);
                }
                resolve();
            });
            
            // Set timeout for analysis
            setTimeout(() => {
                python.kill();
                resolve();
            }, 30000); // 30 second timeout
        });
    }
    
    async runAIEnrichment(fileId, metadata) {
        // This would call the AI enrichment script
        // For now, just log that it would run
        console.log(`Would run AI enrichment for file ${fileId}`);
        return Promise.resolve();
    }
    
    sendProgress(event, data) {
        if (event && event.sender) {
            event.sender.send('import-progress', data);
        }
    }
}

module.exports = ImportMusicHandler;