// Auto Artwork Extractor Service - Automatically extract artwork on import
const fs = require('fs').promises;
const path = require('path');
const mm = require('music-metadata');
const sharp = require('sharp');

class AutoArtworkExtractor {
    constructor(db) {
        this.db = db;
        this.artworkDir = path.join(__dirname, '..', 'artwork-cache');
        this.processing = false;
        this.queue = [];
        this.processed = new Set();
        this.batchSize = 10;
        this.isEnabled = true;

        this.init();
    }

    async init() {
        // Ensure artwork directory exists
        try {
            await fs.access(this.artworkDir);
        } catch {
            await fs.mkdir(this.artworkDir, { recursive: true });
        }

        // Start monitoring for new files
        this.startMonitoring();
    }

    startMonitoring() {
        // Check for files without artwork every 30 seconds
        setInterval(() => {
            if (this.isEnabled && !this.processing) {
                this.checkAndExtractMissing();
            }
        }, 30000);

        // Initial check
        setTimeout(() => this.checkAndExtractMissing(), 1000);
    }

    async checkAndExtractMissing() {
        if (this.processing) {
            return;
        }

        try {
            // Find files without artwork
            const sql = `
                SELECT id, file_path, file_name 
                FROM audio_files 
                WHERE artwork_path IS NULL 
                   OR artwork_path = ''
                LIMIT 100
            ';

            this.db.all(sql, async (err, rows) => {
                if (err) {
                    logError('Error finding files without artwork:', err);
                    return;
                }

                if (rows && rows.length > 0) {
                    logDebug(
                        `🎨 Found ${rows.length} files without artwork. Starting extraction...`
                    );
                    await this.processFiles(rows);
                }
            });
        } catch (error) {
            logError('Error in checkAndExtractMissing:', error);
        }
    }

    async processFiles(files) {
        if (this.processing) {
            return;
        }
        this.processing = true;

        const chunks = [];
        for (let i = 0; i < files.length; i += this.batchSize) {
            chunks.push(files.slice(i, i + this.batchSize));
        }

        let totalExtracted = 0;
        let totalFailed = 0;

        for (const chunk of chunks) {
            const results = await Promise.allSettled(chunk.map(file => this.extractArtwork(file)));

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    totalExtracted++;
                } else {
                    totalFailed++;
                    if (result.reason) {
                        logError(
                            `Failed to extract artwork for ${chunk[index].file_name}:`,
                            result.reason
                        );
                    }
                }
            });

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logInfo('✅ Artwork extraction complete: ${totalExtracted} extracted, ${totalFailed} failed');

        // Notify renderer about updates
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
            global.mainWindow.webContents.send('artwork-extracted', {
                extracted: totalExtracted,
                failed: totalFailed
            });
        }

        this.processing = false;
    }

    async extractArtwork(file) {
        // Skip if already processed in this session
        if (this.processed.has(file.id)) {
            return false;
        }

        const artworkPath = path.join(this.artworkDir, `${file.id}.jpg');

        try {
            // Check if artwork already exists
            await fs.access(artworkPath);
            this.processed.add(file.id);
            return false; // Already exists
        } catch {
            // Artwork doesn't exist, continue extraction
        }

        try {
            // Check if file exists
            await fs.access(file.file_path);

            // Extract metadata
            const metadata = await mm.parseFile(file.file_path);

            if (metadata.common && metadata.common.picture && metadata.common.picture.length > 0) {
                const picture = metadata.common.picture[0];

                // Convert and optimize image with sharp
                await sharp(picture.data)
                    .resize(500, 500, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .jpeg({
                        quality: 85,
                        progressive: true
                    })
                    .toFile(artworkPath);

                // Update database
                await this.updateDatabase(file.id, artworkPath);

                this.processed.add(file.id);
                logInfo('✅ Extracted artwork for: ${file.file_name}');
                return true;
            } else {
                // No artwork in file
                this.processed.add(file.id);
                return false;
            }
        } catch (error) {
            logError(`Error extracting artwork for ${file.file_name}:`, error.message);
            this.processed.add(file.id);
            return false;
        }
    }

    updateDatabase(fileId, artworkPath) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE audio_files 
                SET artwork_path = ?, 
                    updated_at = datetime('now')
                WHERE id = ?
            ';

            this.db.run(sql, [artworkPath, fileId], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async extractForNewFile(filePath, fileId) {
        // Extract artwork immediately for a newly imported file
        try {
            const file = {
                id: fileId,
                file_path: filePath,
                file_name: path.basename(filePath)
            };

            const result = await this.extractArtwork(file);

            if (result) {
                // Notify renderer
                if (global.mainWindow && !global.mainWindow.isDestroyed()) {
                    global.mainWindow.webContents.send('artwork-extracted-single', {
                        fileId: fileId,
                        success: true
                    });
                }
            }

            return result;
        } catch (error) {
            logError('Error extracting artwork for new file:', error);
            return false;
        }
    }

    async extractBatch(fileIds) {
        // Extract artwork for specific files
        const sql = `
            SELECT id, file_path, file_name 
            FROM audio_files 
            WHERE id IN (${fileIds.map(() => '?').join(',')})
        ';

        return new Promise(resolve => {
            this.db.all(sql, fileIds, async (err, rows) => {
                if (err || !rows) {
                    resolve({ success: false, error: err });
                    return;
                }

                await this.processFiles(rows);
                resolve({ success: true, processed: rows.length });
            });
        });
    }

    enable() {
        this.isEnabled = true;
        logDebug('🎨 Auto artwork extraction enabled');
        this.checkAndExtractMissing();
    }

    disable() {
        this.isEnabled = false;
        logDebug('🎨 Auto artwork extraction disabled');
    }

    getStatus() {
        return {
            enabled: this.isEnabled,
            processing: this.processing,
            queueLength: this.queue.length,
            processedCount: this.processed.size
        };
    }

    clearCache() {
        this.processed.clear();
        logDebug('🎨 Artwork extraction cache cleared');
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: db => {
        if (!instance && db) {
            instance = new AutoArtworkExtractor(db);
        }
        return instance;
    },
    AutoArtworkExtractor
};
