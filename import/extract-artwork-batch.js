// IMPORT_003: Extractor de carátulas optimizado (500x500)
const mm = require('music-metadata');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();

class ArtworkExtractor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || '../artwork-cache';
        this.dbPath = options.dbPath || '../music_analyzer.db';
        this.maxSize = options.maxSize || 500;
        this.quality = options.quality || 85;
        this.startId = options.startId || 492; // Continue from 492
        this.currentId = this.startId;
        this.db = null;
        this.stats = {
            extracted: 0,
            skipped: 0,
            failed: 0,
            noArtwork: 0,
        };
    }

    async init() {
        // Create output directory
        const absOutputDir = path.resolve(__dirname, this.outputDir);
        await fs.mkdir(absOutputDir, { recursive: true });

        // Connect to database
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(path.resolve(__dirname, this.dbPath), (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    async extractFromFile(filePath, fileId = null) {
        try {
            // Check if artwork already exists
            const outputId = fileId || this.currentId;
            const outputPath = path.join(__dirname, this.outputDir, `${outputId}.jpg`);

            // Skip if already exists
            try {
                await fs.access(outputPath);
                this.stats.skipped++;
                return { id: outputId, skipped: true };
            } catch {
                // File doesn't exist, continue extraction
            }

            // Parse metadata
            const metadata = await mm.parseFile(filePath, {
                skipCovers: false,
            });

            if (!metadata.common.picture || metadata.common.picture.length === 0) {
                this.stats.noArtwork++;
                return { id: outputId, noArtwork: true };
            }

            // Get the first (usually best quality) picture
            const picture = metadata.common.picture[0];

            // Process and save image
            await sharp(picture.data)
                .resize(this.maxSize, this.maxSize, {
                    fit: 'cover',
                    withoutEnlargement: true,
                })
                .jpeg({ quality: this.quality })
                .toFile(outputPath);

            this.stats.extracted++;

            // Update database
            if (fileId) {
                await this.updateDatabase(fileId, outputPath);
            }

            if (!fileId) {
                this.currentId++;
            }

            return {
                id: outputId,
                path: outputPath,
                format: picture.format,
                originalSize: picture.data.length,
                extracted: true,
            };
        } catch (error) {
            this.stats.failed++;
            throw error;
        }
    }

    async extractBatch(files) {
        console.log(`\n🎨 Extracting artwork from ${files.length} files...`);
        const startTime = Date.now();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const result = await this.extractFromFile(file.path || file, file.id || null);

                // Progress indicator
                if ((i + 1) % 10 === 0) {
                    process.stdout.write(
                        `\r✅ Processed: ${i + 1}/${files.length} ` +
                            `(${this.stats.extracted} extracted, ${this.stats.skipped} skipped, ` +
                            `${this.stats.noArtwork} no artwork)`
                    );
                }
            } catch (error) {
                console.error(`\n⚠️ Failed to extract from ${file.path || file}:`, error.message);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️ Batch complete in ${duration}s`);
    }

    async extractFromDatabase() {
        console.log('📚 Fetching files from database...');

        const sql = `
            SELECT id, file_path 
            FROM audio_files_import 
            WHERE has_artwork = 1
            ORDER BY id
        `;

        return new Promise((resolve, reject) => {
            this.db.all(sql, [], async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`📁 Found ${rows.length} files with artwork`);

                // Process in batches
                const batchSize = 100;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    await this.extractBatch(
                        batch.map((r) => ({
                            id: r.id,
                            path: r.file_path,
                        }))
                    );

                    console.log(`\n📊 Overall progress: ${i + batch.length}/${rows.length}`);
                }

                resolve();
            });
        });
    }

    async updateDatabase(fileId, artworkPath) {
        const sql = `
            UPDATE audio_files_import 
            SET artwork_path = ? 
            WHERE id = ?
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [artworkPath, fileId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async createPlaceholder() {
        const placeholderPath = path.join(__dirname, this.outputDir, 'placeholder.jpg');

        // Create a simple gradient placeholder
        await sharp({
            create: {
                width: this.maxSize,
                height: this.maxSize,
                channels: 3,
                background: { r: 100, g: 100, b: 100 },
            }
        })
            .jpeg({ quality: 70 })
            .toFile(placeholderPath);

        console.log('✅ Created placeholder image');
        return placeholderPath;
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('🎨 ARTWORK EXTRACTION COMPLETE');
        console.log('='.repeat(50));
        console.log(`✅ Extracted: ${this.stats.extracted} artworks`);
        console.log(`⏭️ Skipped (already exists): ${this.stats.skipped}`);
        console.log(`📭 No artwork found: ${this.stats.noArtwork}`);
        console.log(`❌ Failed: ${this.stats.failed}`);
        console.log(`\n📁 Artwork saved to: ${this.outputDir}/`);
        console.log(`🔢 Next ID to use: ${this.currentId}`);
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close(() => {
                    console.log('✅ Database connection closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const fromDb = args.includes('--from-db');
    const startId = args.find((a) => a.startsWith('--start-id='));

    const extractor = new ArtworkExtractor({
        startId: startId ? parseInt(startId.split('=')[1]) : 492,
    });

    (async () => {
        try {
            await extractor.init();

            // Create placeholder for files without artwork
            await extractor.createPlaceholder();

            if (fromDb) {
                // Extract from database
                await extractor.extractFromDatabase();
            } else {
                // Extract from file list
                const fileList = await fs.readFile('music-files.txt', 'utf8');
                const files = fileList.split('\n').filter((f) => f.trim());

                console.log(`📚 Processing ${files.length} files...`);
                await extractor.extractBatch(files);
            }

            extractor.printSummary();
            await extractor.close();
        } catch (error) {
            console.error('Fatal error:', error);
            // Check if sharp is installed
            if (error.message.includes('sharp')) {
                console.log('\n💡 Install sharp: npm install sharp');
            }
            process.exit(1);
        }
    })();
}

module.exports = { ArtworkExtractor };
