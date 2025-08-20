// IMPORT_002: Extractor de metadata con batch processing
const mm = require('music-metadata');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class MetadataExtractor {
    constructor(dbPath = '../music_analyzer.db') {
        this.dbPath = path.resolve(__dirname, dbPath);
        this.db = null;
        this.batchSize = 100;
        this.saveInterval = 100; // Save to DB every 100 files (optimized)
        this.processed = 0;
        this.failed = [];
        this.cache = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Connected to database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        // Ensure tables exist
        const sql = `
            CREATE TABLE IF NOT EXISTS audio_files_import (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE,
                file_name TEXT,
                title TEXT,
                artist TEXT,
                album TEXT,
                album_artist TEXT,
                genre TEXT,
                year INTEGER,
                track_number INTEGER,
                total_tracks INTEGER,
                disc_number INTEGER,
                total_discs INTEGER,
                duration REAL,
                bitrate INTEGER,
                sample_rate INTEGER,
                codec TEXT,
                file_extension TEXT,
                file_size INTEGER,
                date_added TEXT,
                date_modified TEXT,
                bpm REAL,
                key TEXT,
                comment TEXT,
                rating INTEGER,
                play_count INTEGER,
                file_hash TEXT,
                has_artwork INTEGER,
                artwork_format TEXT,
                channels INTEGER,
                bits_per_sample INTEGER,
                lossless INTEGER,
                compilation INTEGER,
                publisher TEXT,
                isrc TEXT,
                copyright TEXT,
                encoded_by TEXT,
                encoding_date TEXT,
                tagging_date TEXT,
                lyrics TEXT,
                mood TEXT,
                energy REAL,
                existing_bmp TEXT,
                import_date TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_import_artist ON audio_files_import(artist);
            CREATE INDEX IF NOT EXISTS idx_import_album ON audio_files_import(album);
            CREATE INDEX IF NOT EXISTS idx_import_genre ON audio_files_import(genre);
            CREATE INDEX IF NOT EXISTS idx_import_hash ON audio_files_import(file_hash);
        `;

        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async extractBatch(filePaths) {
        console.log(`\n📦 Processing batch of ${filePaths.length} files...`);
        const startTime = Date.now();

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];

            try {
                const metadata = await this.extractSingle(filePath);
                if (metadata) {
                    this.cache.push(metadata);
                    this.processed++;

                    // Progress
                    if (this.processed % 10 === 0) {
                        process.stdout.write(`\r✅ Processed: ${this.processed} files (${this.failed.length} failed)`);
                    }

                    // Save to DB periodically
                    if (this.cache.length >= this.saveInterval) {
                        await this.saveToDatabase();
                    }
                }
            } catch (error) {
                this.failed.push({
                    path: filePath,
                    error: error.message,
                });
            }
        }

        // Save remaining cache
        if (this.cache.length > 0) {
            await this.saveToDatabase();
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️ Batch complete in ${duration}s`);
    }

    async extractSingle(filePath) {
        try {
            const metadata = await mm.parseFile(filePath, {
                skipCovers: true, // Skip covers for speed (we extract them separately)
                duration: true,
            });

            const stats = await fs.stat(filePath);
            // Skip hash for speed (can be done later if needed)
            const fileHash = null; // await this.calculateHash(filePath);

            return {
                file_path: filePath,
                file_name: path.basename(filePath),
                title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
                artist: metadata.common.artist || 'Unknown Artist',
                album: metadata.common.album || 'Unknown Album',
                album_artist: metadata.common.albumartist || metadata.common.artist,
                genre: Array.isArray(metadata.common.genre) ? metadata.common.genre[0] : metadata.common.genre,
                year: metadata.common.year,
                track_number: metadata.common.track?.no,
                total_tracks: metadata.common.track?.of,
                disc_number: metadata.common.disk?.no,
                total_discs: metadata.common.disk?.of,
                duration: metadata.format.duration,
                bitrate: metadata.format.bitrate,
                sample_rate: metadata.format.sampleRate,
                codec: metadata.format.codec,
                file_extension: path.extname(filePath).toLowerCase(),
                file_size: stats.size,
                date_modified: stats.mtime.toISOString(),
                bpm: metadata.common.bpm,
                key: metadata.common.key,
                comment: Array.isArray(metadata.common.comment) ? metadata.common.comment[0] : metadata.common.comment,
                rating: metadata.common.rating?.[0]?.rating,
                file_hash: fileHash,
                has_artwork: metadata.common.picture && metadata.common.picture.length > 0 ? 1 : 0,
                artwork_format: metadata.common.picture?.[0]?.format,
                channels: metadata.format.numberOfChannels,
                bits_per_sample: metadata.format.bitsPerSample,
                lossless: metadata.format.lossless ? 1 : 0,
                compilation: metadata.common.compilation ? 1 : 0,
                publisher: metadata.common.publisher?.[0],
                isrc: metadata.common.isrc?.[0],
                copyright: metadata.common.copyright,
                encoded_by: metadata.common.encodedby,
                encoding_date: metadata.common.encodingdate,
                tagging_date: metadata.common.taggingdate,
                lyrics: metadata.common.lyrics?.[0],
                mood: metadata.common.mood,
                energy: this.extractEnergyLevel(metadata),
                existing_bmp:
                    metadata.common.bpm || metadata.native?.['ID3v2.4']?.find((tag) => tag.id === 'TBPM')?.value,
            };
        } catch (error) {
            throw new Error(`Failed to extract metadata: ${error.message}`);
        }
    }

    extractEnergyLevel(metadata) {
        // Prioridad 1: Buscar en tags nativos ENERGYLEVEL
        const energyLevelTag = metadata.native?.['ID3v2.4']?.find(
            (tag) => tag.id === 'TXXX' && tag.value?.description === 'ENERGYLEVEL'
        );
        if (energyLevelTag?.value?.text) {
            const energy = parseInt(energyLevelTag.value.text);
            if (!isNaN(energy)) {
                return energy;
            }
        }

        // Prioridad 2: Buscar en el comment "Energy X"
        const comment = Array.isArray(metadata.common.comment) ? metadata.common.comment[0] : metadata.common.comment;
        if (comment) {
            const energyMatch = comment.match(/Energy\s+(\d+)/i);
            if (energyMatch) {
                const energy = parseInt(energyMatch[1]);
                if (!isNaN(energy)) {
                    return energy;
                }
            }
        }

        // Prioridad 3: metadata.common.energy
        if (metadata.common.energy) {
            // Si es un valor entre 0-1, convertir a 1-10
            const energy = parseFloat(metadata.common.energy);
            if (!isNaN(energy)) {
                if (energy <= 1) {
                    return Math.round(energy * 10);
                }
                return Math.round(energy);
            }
        }

        // Prioridad 4: Buscar AI_Energy en tags
        const aiEnergyTag = metadata.native?.['ID3v2.4']?.find(
            (tag) => tag.id === 'TXXX' && tag.value?.description === 'AI_Energy'
        );
        if (aiEnergyTag?.value?.text) {
            const energy = parseFloat(aiEnergyTag.value.text);
            if (!isNaN(energy)) {
                return Math.round(energy * 10);
            }
        }

        return null;
    }

    async calculateHash(filePath, bytes = 1024 * 1024) {
        // Read first 1MB for hash (faster than full file)
        const buffer = Buffer.alloc(bytes);
        const fd = await fs.open(filePath, 'r');
        await fd.read(buffer, 0, bytes, 0);
        await fd.close();

        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    async saveToDatabase() {
        if (this.cache.length === 0) {
            return;
        }

        // Use transaction for better performance
        await new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        const placeholders = this.cache.map(() => '(' + Array(40).fill('?').join(',') + ')').join(',');

        const sql = `
            INSERT OR REPLACE INTO audio_files_import (
                file_path, file_name, title, artist, album, album_artist,
                genre, year, track_number, total_tracks, disc_number, total_discs,
                duration, bitrate, sample_rate, codec, file_extension, file_size,
                date_modified, bpm, key, comment, rating, file_hash,
                has_artwork, artwork_format, channels, bits_per_sample, lossless,
                compilation, publisher, isrc, copyright, encoded_by,
                encoding_date, tagging_date, lyrics, mood, energy, existing_bmp
            ) VALUES ${placeholders}
        `;

        const values = [];
        this.cache.forEach((track) => {
            values.push(
                track.file_path,
                track.file_name,
                track.title,
                track.artist,
                track.album,
                track.album_artist,
                track.genre,
                track.year,
                track.track_number,
                track.total_tracks,
                track.disc_number,
                track.total_discs,
                track.duration,
                track.bitrate,
                track.sample_rate,
                track.codec,
                track.file_extension,
                track.file_size,
                track.date_modified,
                track.bpm,
                track.key,
                track.comment,
                track.rating,
                track.file_hash,
                track.has_artwork,
                track.artwork_format,
                track.channels,
                track.bits_per_sample,
                track.lossless,
                track.compilation,
                track.publisher,
                track.isrc,
                track.copyright,
                track.encoded_by,
                track.encoding_date,
                track.tagging_date,
                track.lyrics,
                track.mood,
                track.energy,
                track.existing_bmp
            );
        });

        return new Promise((resolve, reject) => {
            this.db.run(sql, values, async (err) => {
                if (err) {
                    console.error('❌ DB Error:', err);
                    // Rollback transaction
                    this.db.run('ROLLBACK', () => reject(err));
                } else {
                    // Commit transaction
                    this.db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            console.error('❌ Commit Error:', commitErr);
                            reject(commitErr);
                        } else {
                            console.log(`\n💾 Saved ${this.cache.length} tracks to database`);
                            this.cache = [];
                            resolve();
                        }
                    });
                }
            });
        });
    }

    async close() {
        // Save any remaining cache
        if (this.cache.length > 0) {
            await this.saveToDatabase();
        }

        return new Promise((resolve) => {
            this.db.close(() => {
                console.log('✅ Database connection closed');
                resolve();
            });
        });
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 METADATA EXTRACTION COMPLETE');
        console.log('='.repeat(50));
        console.log(`✅ Successfully processed: ${this.processed}`);
        console.log(`❌ Failed: ${this.failed.length}`);

        if (this.failed.length > 0 && this.failed.length <= 10) {
            console.log('\n❌ Failed files:');
            this.failed.forEach((f) => {
                console.log(`   ${f.path}: ${f.error}`);
            });
        } else if (this.failed.length > 10) {
            console.log(`\n❌ ${this.failed.length} files failed (check metadata-errors.json)`);
            fs.writeFile('metadata-errors.json', JSON.stringify(this.failed, null, 2));
        }
    }
}

// CLI execution
if (require.main === module) {
    const extractor = new MetadataExtractor();

    (async () => {
        try {
            // Read file list from scanner output
            const fileList = await fs.readFile('music-files.txt', 'utf8');
            const files = fileList.split('\n').filter((f) => f.trim());

            console.log(`📚 Found ${files.length} files to process`);

            await extractor.init();

            // Process in batches
            for (let i = 0; i < files.length; i += extractor.batchSize) {
                const batch = files.slice(i, i + extractor.batchSize);
                await extractor.extractBatch(batch);

                console.log(`\n📊 Overall progress: ${i + batch.length}/${files.length}`);
            }

            extractor.printSummary();
            await extractor.close();
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = { MetadataExtractor };
