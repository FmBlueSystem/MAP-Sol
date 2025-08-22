#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const mm = require('music-metadata');
const { spawn } = require('child_process');

const DB_PATH = path.join(__dirname, '..', 'music_analyzer.db');

class AudioMetadataExtractor {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.processedCount = 0;
        this.extractedCount = 0;
        this.errorCount = 0;
    }

    async init() {
        // Ensure llm_metadata table exists and has the right structure
        await this.ensureMetadataTable();
    }

    ensureMetadataTable() {
        return new Promise((resolve, reject) => {
            // First check if llm_metadata has any rows
            this.db.get('SELECT COUNT(*) as count FROM llm_metadata', (err, row) => {
                if (err || row.count === 0) {
                    // Create entries for all audio files if they don't exist
                    this.db.run(
                        `
                        INSERT OR IGNORE INTO llm_metadata (file_id)
                        SELECT id FROM audio_files
                    `,
                        (err) => {
                            if (err) {
                                console.error('Error creating llm_metadata entries:', err);
                            }
                            resolve();
                        }
                    );
                } else {
                    resolve();
                }
            });
        });
    }

    async getTracksWithoutMetadata() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT af.id, af.file_path, af.title, af.artist,
                       lm.AI_BPM, lm.AI_KEY, lm.AI_ENERGY
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE lm.AI_BPM IS NULL OR lm.AI_KEY IS NULL OR lm.AI_ENERGY IS NULL
                ORDER BY af.id
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

    async extractBasicMetadata(track) {
        try {
            // Check if file exists
            await fs.access(track.file_path);

            // Extract metadata using music-metadata
            const metadata = await mm.parseFile(track.file_path, {
                skipCovers: true,
                duration: true,
            });

            // Try to get BPM from native tags first
            let bpm = null;
            let key = null;
            let energy = null;

            // Check common BPM tags
            if (metadata.native) {
                for (const [format, tags] of Object.entries(metadata.native)) {
                    tags.forEach((tag) => {
                        const tagId = tag.id?.toLowerCase() || '';
                        const tagValue = tag.value;

                        // BPM detection
                        if (!bpm && (tagId.includes('bpm') || tagId === 'tempo')) {
                            const parsedBpm = parseFloat(tagValue);
                            if (!isNaN(parsedBpm) && parsedBpm > 0) {
                                bpm = Math.round(parsedBpm);
                            }
                        }

                        // Key detection
                        if (!key && (tagId.includes('key') || tagId === 'initialkey' || tagId === 'tkey')) {
                            key = tagValue;
                        }

                        // Energy detection (less common in tags)
                        if (!energy && tagId.includes('energy')) {
                            const parsedEnergy = parseFloat(tagValue);
                            if (!isNaN(parsedEnergy)) {
                                energy = parsedEnergy;
                            }
                        }
                    });
                }
            }

            // Try common metadata fields
            if (!bpm && metadata.common?.bpm) {
                bpm = Math.round(metadata.common.bpm);
            }

            // If no BPM found, try to estimate using Essentia
            if (!bpm) {
                bpm = await this.estimateBPMWithEssentia(track.file_path);
            }

            // Set default values if still missing
            if (!bpm) {
                console.log(`⚠️  No BPM found for track ${track.id}: ${track.title}`);
                // Don't set a default BPM - leave it null
            }

            if (!key) {
                console.log(`⚠️  No key found for track ${track.id}: ${track.title}`);
                // Don't set a default key - leave it null
            }

            if (energy === null) {
                // Energy is often not in metadata, we'll need to compute it
                console.log(`⚠️  No energy found for track ${track.id}: ${track.title}`);
                // Energy can be estimated based on other factors or left null
            }

            // Update database
            await this.updateMetadata(track.id, bpm, key, energy);

            console.log(`✅ Updated track ${track.id}: ${track.title}`);
            console.log(`   BPM: ${bpm || 'N/A'}, Key: ${key || 'N/A'}, Energy: ${energy || 'N/A'}`);

            this.extractedCount++;
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ File not found for track ${track.id}: ${track.file_path}`);
            } else {
                console.error(`❌ Error extracting metadata for track ${track.id}:`, error.message);
            }
            this.errorCount++;
            return false;
        }
    }

    async estimateBPMWithEssentia(filePath) {
        return new Promise((resolve) => {
            const pythonScript = path.join(__dirname, 'estimate_bpm.py');

            // Check if Python script exists
            fs.access(pythonScript).catch(() => {
                // Create a simple BPM estimation script if it doesn't exist
                const scriptContent = `#!/usr/bin/env python3
import sys
import json
try:
    import essentia.standard as es
    
    audio = es.MonoLoader(filename=sys.argv[1])()
    rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
    bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
    
    print(json.dumps({"bpm": round(bpm)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
                fs.writeFile(pythonScript, scriptContent, { mode: 0o755 });
            });

            const python = spawn('python3', [pythonScript, filePath]);
            let output = '';

            python.stdout.on('data', (data) => {
                output += data.toString();
            });

            python.on('close', (code) => {
                try {
                    const result = JSON.parse(output);
                    if (result.bpm) {
                        resolve(result.bpm);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });

            python.on('error', () => {
                resolve(null);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                python.kill();
                resolve(null);
            }, 10000);
        });
    }

    async updateMetadata(trackId, bpm, key, energy) {
        return new Promise((resolve, reject) => {
            // First ensure the record exists
            this.db.run('INSERT OR IGNORE INTO llm_metadata (file_id) VALUES (?)', [trackId], (err) => {
                if (err) {
                    console.error('Error ensuring llm_metadata record:', err);
                }

                // Then update the values
                const updates = [];
                const values = [];

                if (bpm !== null && bpm !== undefined) {
                    updates.push('AI_BPM = ?');
                    values.push(bpm);
                }

                if (key !== null && key !== undefined) {
                    updates.push('AI_KEY = ?');
                    values.push(key);
                }

                if (energy !== null && energy !== undefined) {
                    updates.push('AI_ENERGY = ?');
                    values.push(energy);
                }

                if (updates.length > 0) {
                    values.push(trackId);
                    const query = `UPDATE llm_metadata SET ${updates.join(', ')} WHERE file_id = ?`;

                    this.db.run(query, values, (err) => {
                        if (err) {
                            console.error('Error updating metadata:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    async process() {
        try {
            await this.init();

            const tracks = await this.getTracksWithoutMetadata();
            console.log(`\n🔍 Found ${tracks.length} tracks without complete metadata (BPM/Key/Energy)\n`);

            if (tracks.length === 0) {
                console.log('✨ All tracks have metadata!');
                return;
            }

            for (const track of tracks) {
                await this.extractBasicMetadata(track);
                this.processedCount++;

                // Progress update
                const progress = Math.round((this.processedCount / tracks.length) * 100);
                console.log(`\n📊 Progress: ${this.processedCount}/${tracks.length} (${progress}%)\n`);
            }

            console.log('\n✅ Metadata extraction complete!');
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
const extractor = new AudioMetadataExtractor();
extractor.process();
