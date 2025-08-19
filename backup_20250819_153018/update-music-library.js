/**
 * UPDATE MUSIC LIBRARY
 * Sistema completo para actualizar archivos de audio con análisis IA
 * - Escanea nuevos archivos
 * - Extrae metadata y carátulas
 * - Analiza con GPT-4
 * - Actualiza archivos modificados
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mm = require('music-metadata');
const crypto = require('crypto');
const { NormalizedLLMHandler } = require('./handlers/normalized-llm-handler');

class MusicLibraryUpdater {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.musicDir =
            '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks';
        this.artworkDir = path.join(__dirname, 'artwork-cache');
        this.db = null;
        this.llmHandler = null;

        this.stats = {
            scanned: 0,
            newFiles: 0,
            updatedFiles: 0,
            deletedFiles: 0,
            artworkExtracted: 0,
            aiAnalyzed: 0,
            errors: []
        };

        this.supportedFormats = ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg'];
    }

    async init() {
        // Initialize database
        await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Connected to database');
                    resolve();
                }
            });
        });

        // Initialize LLM handler
        this.llmHandler = new NormalizedLLMHandler();
        await this.llmHandler.init();
        logInfo('✅ LLM Handler initialized');

        // Ensure artwork directory exists
        await fs.mkdir(this.artworkDir, { recursive: true });
    }

    /**
     * STEP 1: Scan directory for audio files
     */
    async scanDirectory() {
        logDebug('\n📁 SCANNING MUSIC DIRECTORY');
        logDebug('-'.repeat(60));
        logDebug(`Directory: ${this.musicDir}\n`);

        try {
            const files = await this.walkDirectory(this.musicDir);
            const audioFiles = files.filter(file =>
                this.supportedFormats.includes(path.extname(file).toLowerCase())
            );

            this.stats.scanned = audioFiles.length;
            logInfo('✅ Found ${audioFiles.length} audio files');

            return audioFiles;
        } catch (error) {
            logError('❌ Error scanning directory:', error.message);
            this.stats.errors.push(`Scan error: ${error.message}`);
            return [];
        }
    }

    /**
     * Walk directory recursively
     */
    async walkDirectory(dir) {
        let files = [];
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                files = files.concat(await this.walkDirectory(fullPath));
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * STEP 2: Check for new and modified files
     */
    async checkFiles(audioFiles) {
        logDebug('\n🔍 CHECKING FOR NEW AND MODIFIED FILES');
        logDebug('-'.repeat(60));

        const existingFiles = await this.getExistingFiles();
        const existingPaths = new Set(existingFiles.map(f => f.file_path));

        const newFiles = [];
        const modifiedFiles = [];

        for (const filePath of audioFiles) {
            if (!existingPaths.has(filePath)) {
                newFiles.push(filePath);
            } else {
                // Check if file was modified
                const stats = await fs.stat(filePath);
                const dbFile = existingFiles.find(f => f.file_path === filePath);

                if (dbFile && stats.mtime > new Date(dbFile.updated_at)) {
                    modifiedFiles.push({
                        path: filePath,
                        id: dbFile.id
                    });
                }
            }
        }

        // Check for deleted files
        const currentPaths = new Set(audioFiles);
        const deletedFiles = existingFiles.filter(f => !currentPaths.has(f.file_path));

        logDebug('📊 Results:');
        logDebug(`   New files: ${newFiles.length}`);
        logDebug(`   Modified files: ${modifiedFiles.length}`);
        logDebug(`   Deleted files: ${deletedFiles.length}`);

        this.stats.newFiles = newFiles.length;
        this.stats.updatedFiles = modifiedFiles.length;
        this.stats.deletedFiles = deletedFiles.length;

        return { newFiles, modifiedFiles, deletedFiles };
    }

    /**
     * Get existing files from database
     */
    async getExistingFiles() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id, file_path, updated_at FROM audio_files', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * STEP 3: Process new files
     */
    async processNewFiles(newFiles) {
        if (newFiles.length === 0) {
            logDebug('\n✅ No new files to process');
            return;
        }

        logDebug(`\n🎵 PROCESSING ${newFiles.length} NEW FILES`);
        logDebug('-'.repeat(60));

        let processed = 0;

        for (const filePath of newFiles) {
            processed++;
            logDebug(`\n[${processed}/${newFiles.length}] ${path.basename(filePath)}`);

            try {
                // Extract metadata
                logDebug('   📊 Extracting metadata...');
                const metadata = await this.extractMetadata(filePath);

                // Save to database
                const fileId = await this.saveToDatabase(filePath, metadata);

                // Extract artwork
                logDebug('   🎨 Extracting artwork...');
                const artworkPath = await this.extractArtwork(filePath, fileId);
                if (artworkPath) {
                    await this.updateArtworkPath(fileId, artworkPath);
                    this.stats.artworkExtracted++;
                }

                // Analyze with AI (if enabled)
                if (process.env.ENABLE_AI_ANALYSIS === 'true') {
                    logDebug('   🤖 Analyzing with GPT-4...');
                    try {
                        await this.llmHandler.analyzeTrack(fileId);
                        this.stats.aiAnalyzed++;
                    } catch (error) {
                        logDebug(`   ⚠️  AI analysis failed: ${error.message}`);
                    }
                }

                logDebug('   ✅ File processed successfully');
            } catch (error) {
                logError(`   ❌ Error processing file: ${error.message}`);
                this.stats.errors.push(`${path.basename(filePath)}: ${error.message}`);
            }

            // Rate limiting for AI
            if (process.env.ENABLE_AI_ANALYSIS === 'true' && processed % 5 === 0) {
                logDebug('\n⏸️  Pausing for rate limiting...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Extract metadata from audio file
     */
    async extractMetadata(filePath) {
        try {
            const metadata = await mm.parseFile(filePath, {
                skipCovers: false,
                duration: true
            });

            const common = metadata.common || {};
            const format = metadata.format || {};

            // Extract ISRC if available
            let isrc = common.isrc;
            if (!isrc && metadata.native) {
                for (const [format, tags] of Object.entries(metadata.native)) {
                    const isrcTag = tags.find(
                        tag => tag.id && tag.id.toUpperCase().includes('ISRC')
                    );
                    if (isrcTag) {
                        isrc = isrcTag.value;
                        break;
                    }
                }
            }

            return {
                title: common.title || path.basename(filePath, path.extname(filePath)),
                artist: common.artist || common.albumartist || 'Unknown Artist',
                album: common.album || 'Unknown Album',
                year: common.year || common.date?.substring(0, 4),
                genre: common.genre?.join(', ') || null,
                bpm: common.bpm,
                duration: format.duration,
                bitrate: format.bitrate,
                sampleRate: format.sampleRate,
                isrc: isrc,
                track: common.track?.no,
                disk: common.disk?.no,
                comment: common.comment?.join(' '),
                hasArtwork: common.picture && common.picture.length > 0
            };
        } catch (error) {
            logError(`   ⚠️  Metadata extraction error: ${error.message}`);
            return {
                title: path.basename(filePath, path.extname(filePath)),
                artist: 'Unknown Artist',
                album: 'Unknown Album'
            };
        }
    }

    /**
     * Save file to database
     */
    async saveToDatabase(filePath, metadata) {
        return new Promise((resolve, reject) => {
            const fileName = path.basename(filePath);
            const fileExt = path.extname(filePath).substring(1);
            const fileSize = fs.stat(filePath).then(s => s.size);
            const db = this.db; // Store reference

            db.run(
                `INSERT INTO audio_files (
                    file_path, file_name, file_extension,
                    title, artist, album, genre, year,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))',
                [
                    filePath,
                    fileName,
                    fileExt,
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.genre,
                    metadata.year
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        const fileId = this.lastID;

                        // Create metadata record
                        db.run(
                            'INSERT INTO llm_metadata (file_id, LLM_ANALYZED) VALUES (?, 0)',
                            [fileId],
                            err => {
                                if (err) {
                                    logError('Metadata record error:', err);
                                }
                            }
                        );

                        // Save extended metadata if ISRC exists
                        if (metadata.isrc) {
                            db.run('UPDATE audio_files SET isrc = ? WHERE id = ?', [
                                metadata.isrc,
                                fileId
                            ]);
                        }

                        resolve(fileId);
                    }
                }
            );
        });
    }

    /**
     * Extract artwork from audio file
     */
    async extractArtwork(filePath, fileId) {
        try {
            const metadata = await mm.parseFile(filePath, {
                skipCovers: false,
                duration: false
            });

            if (metadata.common.picture && metadata.common.picture.length > 0) {
                const picture = metadata.common.picture[0];
                const extension = picture.format.split('/')[1] || 'jpg';
                const artworkPath = path.join(this.artworkDir, `${fileId}.${extension}');

                await fs.writeFile(artworkPath, picture.data);
                return `artwork-cache/${fileId}.${extension}`;
            }
        } catch (error) {
            logDebug(`   ⚠️  Artwork extraction failed: ${error.message}`);
        }

        return null;
    }

    /**
     * Update artwork path in database
     */
    async updateArtworkPath(fileId, artworkPath) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE audio_files SET artwork_path = ? WHERE id = ?',
                [artworkPath, fileId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * STEP 4: Process modified files
     */
    async processModifiedFiles(modifiedFiles) {
        if (modifiedFiles.length === 0) {
            logDebug('\n✅ No modified files to update');
            return;
        }

        logDebug(`\n🔄 UPDATING ${modifiedFiles.length} MODIFIED FILES`);
        logDebug('-'.repeat(60));

        for (const file of modifiedFiles) {
            logDebug(`\nUpdating: ${path.basename(file.path)}`);

            try {
                // Re-extract metadata
                const metadata = await this.extractMetadata(file.path);

                // Update database
                await this.updateFileMetadata(file.id, metadata);

                // Re-extract artwork if needed
                const artworkPath = await this.extractArtwork(file.path, file.id);
                if (artworkPath) {
                    await this.updateArtworkPath(file.id, artworkPath);
                }

                logDebug('   ✅ Updated successfully');
            } catch (error) {
                logError(`   ❌ Update failed: ${error.message}`);
                this.stats.errors.push(`Update ${path.basename(file.path)}: ${error.message}`);
            }
        }
    }

    /**
     * Update file metadata in database
     */
    async updateFileMetadata(fileId, metadata) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE audio_files SET
                    title = ?, artist = ?, album = ?,
                    genre = ?, year = ?, updated_at = datetime('now')
                WHERE id = ?',
                [
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.genre,
                    metadata.year,
                    fileId
                ],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * STEP 5: Handle deleted files
     */
    async handleDeletedFiles(deletedFiles) {
        if (deletedFiles.length === 0) {
            logDebug('\n✅ No deleted files to remove');
            return;
        }

        logDebug(`\n🗑️ REMOVING ${deletedFiles.length} DELETED FILES`);
        logDebug('-'.repeat(60));

        for (const file of deletedFiles) {
            logDebug(`Removing: ${file.file_path}`);

            try {
                // Mark as deleted instead of removing
                await new Promise((resolve, reject) => {
                    this.db.run(
                        `UPDATE audio_files SET 
                            file_path = file_path || '_DELETED',
                            updated_at = datetime('now')
                        WHERE id = ?',
                        [file.id],
                        err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });

                logDebug('   ✅ Marked as deleted');
            } catch (error) {
                logError(`   ❌ Error: ${error.message}`);
            }
        }
    }

    /**
     * STEP 6: Normalize all data
     */
    async normalizeData() {
        logDebug('\n🔧 NORMALIZING DATA');
        logDebug('-'.repeat(60));

        try {
            // Import and run normalizer
            const { CompleteNormalizer } = require('./normalize-all-fields');
            const normalizer = new CompleteNormalizer();
            await normalizer.init();

            await normalizer.normalizeEra();
            await normalizer.normalizeMood();
            await normalizer.normalizeEnergy();
            await normalizer.normalizeLanguage();
            await normalizer.normalizeStorytelling();
            await normalizer.fillMissingValues();

            normalizer.close();
            logInfo('✅ Data normalized');
        } catch (error) {
            logWarn('⚠️  Normalization skipped:', error.message);
        }
    }

    /**
     * Generate update report
     */
    async generateReport() {
        logDebug('\n📊 UPDATE REPORT');
        logDebug('='.repeat(60));

        const endTime = Date.now();
        const duration = (endTime - this.startTime) / 1000;

        logDebug('\n📈 Statistics:');
        logDebug(`   Files scanned: ${this.stats.scanned}`);
        logDebug(`   New files added: ${this.stats.newFiles}`);
        logDebug(`   Files updated: ${this.stats.updatedFiles}`);
        logDebug(`   Files deleted: ${this.stats.deletedFiles}`);
        logDebug(`   Artwork extracted: ${this.stats.artworkExtracted}`);
        logDebug(`   AI analyzed: ${this.stats.aiAnalyzed}`);
        logDebug(`   Errors: ${this.stats.errors.length}`);
        logDebug(`   Duration: ${duration.toFixed(1)}s`);

        if (this.stats.errors.length > 0) {
            logDebug('\n⚠️  Errors encountered:');
            this.stats.errors.slice(0, 10).forEach(error => {
                logDebug(`   - ${error}`);
            });
        }

        // Get current database stats
        const dbStats = await this.getDatabaseStats();
        logDebug('\n📊 Database Status:');
        logDebug(`   Total tracks: ${dbStats.totalTracks}`);
        logDebug(`   Tracks with metadata: ${dbStats.withMetadata}`);
        logDebug(`   Tracks with artwork: ${dbStats.withArtwork}`);
        logDebug(`   Tracks with AI analysis: ${dbStats.withAI}`);

        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            duration: duration,
            stats: this.stats,
            database: dbStats,
            errors: this.stats.errors
        };

        await fs.writeFile(`update-report-${Date.now()}.json`, JSON.stringify(report, null, 2));

        logDebug('\n💾 Report saved to file');
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    COUNT(*) as totalTracks,
                    COUNT(CASE WHEN artwork_path IS NOT NULL THEN 1 END) as withArtwork
                FROM audio_files
                WHERE file_path NOT LIKE '%_DELETED'',
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.db.get(
                            `SELECT 
                                COUNT(*) as withMetadata,
                                COUNT(CASE WHEN LLM_DESCRIPTION IS NOT NULL THEN 1 END) as withAI
                            FROM llm_metadata`,
                            (err, metadata) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({
                                        totalTracks: row.totalTracks,
                                        withArtwork: row.withArtwork,
                                        withMetadata: metadata.withMetadata,
                                        withAI: metadata.withAI
                                    });
                                }
                            }
                        );
                    }
                }
            );
        });
    }

    /**
     * Main update process
     */
    async update() {
        this.startTime = Date.now();

        logDebug('🎵 MUSIC LIBRARY UPDATE SYSTEM');
        logDebug('='.repeat(60));
        logDebug('This will scan, update, and analyze your music library\n');

        try {
            // Step 1: Scan directory
            const audioFiles = await this.scanDirectory();

            if (audioFiles.length === 0) {
                logError('❌ No audio files found');
                return;
            }

            // Step 2: Check for changes
            const { newFiles, modifiedFiles, deletedFiles } = await this.checkFiles(audioFiles);

            // Step 3: Process new files
            await this.processNewFiles(newFiles);

            // Step 4: Process modified files
            await this.processModifiedFiles(modifiedFiles);

            // Step 5: Handle deleted files
            await this.handleDeletedFiles(deletedFiles);

            // Step 6: Normalize data
            await this.normalizeData();

            // Generate report
            await this.generateReport();

            logDebug('\n✨ Update complete!');
        } catch (error) {
            logError('\n❌ Update failed:', error);
            this.stats.errors.push(`Fatal: ${error.message}`);
        }
    }

    close() {
        if (this.db) {
            this.db.close();
        }
        if (this.llmHandler) {
            this.llmHandler.close();
        }
    }
}

// CLI execution
if (require.main === module) {
    const updater = new MusicLibraryUpdater();

    // Check for command line arguments
    const args = process.argv.slice(2);
    const enableAI = args.includes('--with-ai');

    if (enableAI) {
        process.env.ENABLE_AI_ANALYSIS = 'true';
        logDebug('🤖 AI analysis enabled\n');
    } else {
        logDebug('💡 Tip: Use --with-ai flag to enable GPT-4 analysis\n');
    }

    (async () => {
        await updater.init();
        await updater.update();
        updater.close();
    })().catch(console.error);
}

module.exports = { MusicLibraryUpdater };
