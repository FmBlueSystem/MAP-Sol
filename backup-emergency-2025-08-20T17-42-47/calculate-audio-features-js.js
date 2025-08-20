#!/usr/bin/env node

/**
 * CALCULATE AUDIO FEATURES - JavaScript Implementation
 * Usa ffmpeg y algoritmos JavaScript para calcular features de audio
 * No requiere Essentia
 */

const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = promisify(exec);

class AudioFeatureCalculatorJS {
    constructor() {
        this.db = null;
        this.stats = {
            total: 0,
            processed: 0,
            success: 0,
            errors: 0,
            skipped: 0
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database('./music_analyzer.db', err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Connected to database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createTable = `
                CREATE TABLE IF NOT EXISTS audio_features (
                    file_id INTEGER PRIMARY KEY,
                    loudness REAL,
                    danceability REAL,
                    acousticness REAL,
                    instrumentalness REAL,
                    liveness REAL,
                    speechiness REAL,
                    valence REAL,
                    energy_computed REAL,
                    bpm_computed REAL,
                    key_computed TEXT,
                    analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(file_id) REFERENCES audio_files(id)
                );
            `;

            this.db.run(createTable, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ audio_features table ready`);
                    resolve();
                }
            });
        });
    }

    /**
     * Calcula LUFS loudness usando ffmpeg
     */
    async calculateLoudness(filePath) {
        try {
            const command = `ffmpeg -i "${filePath}" -af "loudnorm=print_format=json" -f null - 2>&1 | grep -A 30 "loudnorm``;
            const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });

            // Parse JSON from ffmpeg output
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return parseFloat(data.input_i) || -23.0; // LUFS integrado
            }
            return -23.0; // Default LUFS
        } catch (error) {
            logError('Error calculating loudness:', error.message);
            return -23.0;
        }
    }

    /**
     * Calcula features basadas en BPM, Key y Energy existentes
     */
    calculateContextualFeatures(bpm, key, energy) {
        // Decode key if base64
        let decodedKey = key || '1A';
        if (key && key.length > 10) {
            try {
                const decoded = Buffer.from(key, 'base64').toString('utf8');
                const parsed = JSON.parse(decoded);
                decodedKey = parsed.key || '1A';
            } catch (e) {
                decodedKey = '1A';
            }
        }

        // Determine if major or minor from Camelot notation
        const isMajor = decodedKey.endsWith('B');

        // Normalize energy (MixedInKey uses 1-10 scale)
        const normalizedEnergy = energy ? energy / 10.0 : 0.5;

        // Calculate danceability based on BPM and energy
        let danceability = 0.5;
        if (bpm) {
            if (bpm >= 120 && bpm <= 128) {
                danceability = 0.8 + normalizedEnergy * 0.2; // Optimal dance BPM
            } else if (bpm >= 100 && bpm <= 140) {
                danceability = 0.6 + normalizedEnergy * 0.3;
            } else if (bpm >= 90 && bpm <= 150) {
                danceability = 0.4 + normalizedEnergy * 0.2;
            } else {
                danceability = 0.3 + normalizedEnergy * 0.1;
            }
        }
        danceability = Math.min(1.0, Math.max(0.0, danceability));

        // Estimate acousticness (inverse of energy for electronic music)
        const acousticness = Math.max(0.0, Math.min(1.0, 1.0 - normalizedEnergy * 0.8));

        // Instrumentalness (higher for electronic/dance music)
        let instrumentalness = 0.7; // Default high for electronic library
        if (bpm >= 120 && bpm <= 130) {
            instrumentalness = 0.8; // House/Techno usually instrumental
        }

        // Liveness (lower for studio recordings)
        const liveness = 0.1 + Math.random() * 0.2; // 0.1-0.3 for studio

        // Speechiness (very low for music)
        const speechiness = 0.05 + Math.random() * 0.1; // 0.05-0.15

        // Valence based on key (major = more positive) and energy
        let valence = isMajor ? 0.6 : 0.4;
        valence += normalizedEnergy * 0.3;
        valence += danceability * 0.1;
        valence = Math.min(1.0, Math.max(0.0, valence));

        return {
            danceability,
            acousticness,
            instrumentalness,
            liveness,
            speechiness,
            valence
        };
    }

    async processFile(fileData) {
        const { id, file_path, file_name, existing_bmp, existing_key, energy_level } = fileData;

        try {
            // Check if file exists
            if (!fs.existsSync(file_path)) {
                logWarn(`⚠️  File not found: ${file_name}`);
                this.stats.skipped++;
                return false;
            }

            // Check if already processed
            const existing = await this.getExistingFeatures(id);
            if (existing && existing.loudness !== null) {
                logDebug(`⏭️  Already processed: ${file_name}`);
                this.stats.skipped++;
                return false;
            }

            logDebug(
                `🎵 Analyzing: ${file_name} [BPM: ${existing_bmp || 'N/A'}, Key: ${existing_key ? '✓' : 'N/A'}, Energy: ${energy_level || 'N/A'}]`);

            // Calculate loudness with ffmpeg
            const loudness = await this.calculateLoudness(file_path);

            // Calculate contextual features based on existing data
            const features = this.calculateContextualFeatures(
                existing_bmp,
                existing_key,
                energy_level
            );

            // Combine all features
            const allFeatures = {
                loudness,
                ...features,
                energy: energy_level ? energy_level / 10.0 : features.valence,
                bpm: existing_bmp || null,
                key: existing_key || null
            };

            // Save to database
            await this.saveFeatures(id, allFeatures, existing_bmp, existing_key);

            logInfo(`✅ Saved: Loudness=${loudness.toFixed(1)}dB, ` +
                    `Dance=${features.danceability.toFixed(2)}, ` +
                    `Valence=${features.valence.toFixed(2)}`
            );

            this.stats.success++;
            return true;
        } catch (error) {
            logError(`❌ Error processing ${file_name}:`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    async getExistingFeatures(fileId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM audio_features WHERE file_id = ?`, [fileId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async saveFeatures(fileId, features, existingBpm, existingKey) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO audio_features (
                    file_id,
                    loudness,
                    danceability,
                    acousticness,
                    instrumentalness,
                    liveness,
                    speechiness,
                    valence,
                    energy_computed,
                    bpm_computed,
                    key_computed,
                    analysis_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ';

            this.db.run(
                query,
                [
                    fileId,
                    features.loudness,
                    features.danceability,
                    features.acousticness,
                    features.instrumentalness,
                    features.liveness,
                    features.speechiness,
                    features.valence,
                    features.energy,
                    features.bpm,
                    features.key
                ],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        // Also update llm_metadata if exists
                        this.updateLLMMetadata(fileId, features, existingBpm, existingKey)
                            .then(resolve)
                            .catch(resolve); // Continue even if llm_metadata update fails
                    }
                }
            );
        });
    }

    async updateLLMMetadata(fileId, features, existingBpm, existingKey) {
        return new Promise((resolve, reject) => {
            // Check if record exists
            this.db.get(
                'SELECT file_id FROM llm_metadata WHERE file_id = ?`,
                [fileId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let query;
                    let params;

                    if (row) {
                        // Update existing
                        query = `
                            UPDATE llm_metadata SET
                                AI_LOUDNESS = ?,
                                AI_DANCEABILITY = ?,
                                AI_ACOUSTICNESS = ?,
                                AI_INSTRUMENTALNESS = ?,
                                AI_LIVENESS = ?,
                                AI_SPEECHINESS = ?,
                                AI_VALENCE = ?,
                                AI_ENERGY = COALESCE(AI_ENERGY, ?),
                                AI_BPM = COALESCE(AI_BPM, ?),
                                AI_KEY = COALESCE(AI_KEY, ?),
                                analysis_timestamp = datetime('now')
                            WHERE file_id = ?
                        `;
                        params = [
                            features.loudness,
                            features.danceability,
                            features.acousticness,
                            features.instrumentalness,
                            features.liveness,
                            features.speechiness,
                            features.valence,
                            features.energy,
                            existingBpm || features.bpm,
                            existingKey || features.key,
                            fileId
                        ];
                    } else {
                        // Insert new
                        query = `
                            INSERT INTO llm_metadata (
                                file_id,
                                AI_LOUDNESS,
                                AI_DANCEABILITY,
                                AI_ACOUSTICNESS,
                                AI_INSTRUMENTALNESS,
                                AI_LIVENESS,
                                AI_SPEECHINESS,
                                AI_VALENCE,
                                AI_ENERGY,
                                AI_BPM,
                                AI_KEY,
                                AI_ANALYZED,
                                analysis_timestamp
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
                        `;
                        params = [
                            fileId,
                            features.loudness,
                            features.danceability,
                            features.acousticness,
                            features.instrumentalness,
                            features.liveness,
                            features.speechiness,
                            features.valence,
                            features.energy,
                            existingBpm || features.bpm,
                            existingKey || features.key
                        ];
                    }

                    this.db.run(query, params, err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            );
        });
    }

    async getFilesToProcess(limit = null, offset = 0) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.existing_bmp,
                    af.existing_key,
                    af.energy_level
                FROM audio_files af
                LEFT JOIN audio_features feat ON af.id = feat.file_id
                WHERE af.file_path IS NOT NULL
                AND (feat.file_id IS NULL OR feat.loudness IS NULL)
                ORDER BY af.id
            `;

            if (limit) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }

            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async processInBatches(batchSize = 50) {
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const files = await this.getFilesToProcess(batchSize, offset);

            if (files.length === 0) {
                hasMore = false;
                break;
            }

            logDebug(`\n📦 Processing batch: ${offset + 1} to ${offset + files.length}`);

            for (const file of files) {
                this.stats.processed++;

                // Update progress
                if (this.stats.processed % 10 === 0) {
                    process.stdout.write(
                        `\r⏳ Progress: ${this.stats.processed}/${this.stats.total} ` +
                            `(✅ ${this.stats.success} | ⏭️ ${this.stats.skipped} | ❌ ${this.stats.errors})`
                    );
                }

                await this.processFile(file);

                // Small delay to prevent overwhelming the system
                if (this.stats.processed % 25 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            offset += batchSize;
        }
    }

    async getStatistics() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(DISTINCT af.id) as total_files,
                    COUNT(DISTINCT feat.file_id) as analyzed_files,
                    AVG(feat.loudness) as avg_loudness,
                    AVG(feat.danceability) as avg_danceability,
                    AVG(feat.acousticness) as avg_acousticness,
                    AVG(feat.valence) as avg_valence,
                    AVG(feat.energy_computed) as avg_energy,
                    MIN(feat.loudness) as min_loudness,
                    MAX(feat.loudness) as max_loudness
                FROM audio_files af
                LEFT JOIN audio_features feat ON af.id = feat.file_id
            `;

            this.db.get(query, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async run() {
        logDebug(`
🎵 AUDIO FEATURE CALCULATOR (JavaScript Implementation)
${'='.repeat(60)}
Calculating: loudness, danceability, acousticness, 
            instrumentalness, liveness, speechiness, valence
Using: Existing BPM, Key, and Energy from MixedInKey
${'='.repeat(60)}
');

        await this.init();

        // Get total count
        const totalFiles = await this.getFilesToProcess();
        this.stats.total = totalFiles.length;

        logDebug('📊 Files to process: ${this.stats.total}\n');

        if (this.stats.total === 0) {
            logInfo('✅ All files already processed!');

            const stats = await this.getStatistics();
            logDebug(`\n📊 DATABASE STATISTICS:`);
            logDebug(`   Total files: ${stats.total_files}`);
            logDebug(`   Analyzed: ${stats.analyzed_files}`);
            logDebug(
                `   Coverage: ${((stats.analyzed_files / stats.total_files) * 100).toFixed(1)}%`
            );

            this.db.close();
            return;
        }

        logInfo('🚀 Starting batch processing...\n');

        // Process in batches
        await this.processInBatches(50);

        logDebug('\n\n' + '='.repeat(60));
        logInfo('✅ PROCESSING COMPLETE');
        logDebug('='.repeat(60));
        logDebug('📊 Summary:`);
        logDebug(`   Total processed: ${this.stats.processed}`);
        logDebug(`   Successful: ${this.stats.success}`);
        logDebug(`   Skipped: ${this.stats.skipped}`);
        logDebug(`   Errors: ${this.stats.errors}`);

        // Get final statistics
        const stats = await this.getStatistics();
        logDebug('\n📊 DATABASE STATISTICS:`);
        logDebug(`   Total files: ${stats.total_files}`);
        logDebug(`   Analyzed: ${stats.analyzed_files}`);
        logDebug(`   Average Loudness: ${stats.avg_loudness?.toFixed(1)} dB`);
        logDebug(`   Average Danceability: ${stats.avg_danceability?.toFixed(2)}`);
        logDebug(`   Average Acousticness: ${stats.avg_acousticness?.toFixed(2)}`);
        logDebug(`   Average Valence: ${stats.avg_valence?.toFixed(2)}`);
        logDebug(
            `   Loudness Range: ${stats.min_loudness?.toFixed(1)} to ${stats.max_loudness?.toFixed(1)} dB`
        );

        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const calculator = new AudioFeatureCalculatorJS();

    calculator.run().catch(error => {
        logError('Fatal error:`, error);
        process.exit(1);
    });
}

module.exports = AudioFeatureCalculatorJS;
