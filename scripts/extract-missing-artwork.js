#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const mm = require('music-metadata');

const DB_PATH = path.join(__dirname, '..', 'music_analyzer.db');
const ARTWORK_DIR = path.join(__dirname, '..', 'artwork-cache');

class ArtworkExtractor {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.processedCount = 0;
        this.extractedCount = 0;
        this.errorCount = 0;
    }

    async init() {
        // Ensure artwork directory exists
        await fs.mkdir(ARTWORK_DIR, { recursive: true });
        console.log(`📁 Artwork directory: ${ARTWORK_DIR}`);
    }

    async getTracksWithoutArtwork() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, file_path, title, artist 
                FROM audio_files 
                WHERE artwork_path IS NULL OR artwork_path = ''
                ORDER BY id
            `;

            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async extractArtworkFromFile(track) {
        const artworkPath = path.join(ARTWORK_DIR, `${track.id}.jpg`);

        // Check if artwork already exists
        try {
            await fs.access(artworkPath);
            console.log(`✅ Artwork already exists for track ${track.id}: ${track.title}`);
            await this.updateArtworkPath(track.id, artworkPath);
            return true;
        } catch (err) {
            // File doesn't exist, continue with extraction
        }

        try {
            // Check if source file exists
            await fs.access(track.file_path);

            // Extract metadata
            const metadata = await mm.parseFile(track.file_path, {
                skipCovers: false,
                duration: false,
            });

            if (metadata.common.picture && metadata.common.picture.length > 0) {
                const picture = metadata.common.picture[0];
                await fs.writeFile(artworkPath, picture.data);
                await this.updateArtworkPath(track.id, artworkPath);

                console.log(`✅ Extracted artwork for track ${track.id}: ${track.title || track.file_path}`);
                this.extractedCount++;
                return true;
            } else {
                console.log(`⚠️  No artwork found in track ${track.id}: ${track.title || track.file_path}`);
                return false;
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ File not found for track ${track.id}: ${track.file_path}`);
            } else {
                console.error(`❌ Error extracting artwork for track ${track.id}:`, error.message);
            }
            this.errorCount++;
            return false;
        }
    }

    async updateArtworkPath(trackId, artworkPath) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE audio_files SET artwork_path = ? WHERE id = ?', [artworkPath, trackId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async process() {
        try {
            await this.init();

            const tracks = await this.getTracksWithoutArtwork();
            console.log(`\n🔍 Found ${tracks.length} tracks without artwork\n`);

            if (tracks.length === 0) {
                console.log('✨ All tracks have artwork paths!');
                return;
            }

            const batchSize = 10;
            for (let i = 0; i < tracks.length; i += batchSize) {
                const batch = tracks.slice(i, Math.min(i + batchSize, tracks.length));

                await Promise.all(batch.map((track) => this.extractArtworkFromFile(track)));

                this.processedCount += batch.length;

                // Progress update
                const progress = Math.round((this.processedCount / tracks.length) * 100);
                console.log(`\n📊 Progress: ${this.processedCount}/${tracks.length} (${progress}%)`);
                console.log(`   Extracted: ${this.extractedCount}, Errors: ${this.errorCount}\n`);
            }

            console.log('\n✅ Artwork extraction complete!');
            console.log(`   Total processed: ${this.processedCount}`);
            console.log(`   Successfully extracted: ${this.extractedCount}`);
            console.log(`   Errors: ${this.errorCount}`);
        } catch (error) {
            console.error('Fatal error:', error);
        } finally {
            this.db.close();
        }
    }
}

// Run the extractor
const extractor = new ArtworkExtractor();
extractor.process();
