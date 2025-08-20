#!/usr/bin/env node

/**
 * CALCULATE AUDIO FEATURES WITH FFMPEG
 * Usa FFmpeg para calcular features de audio sin necesidad de Essentia
 * Calcula: loudness, peak, RMS, spectral centroid, zero crossings
 */

const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = promisify(exec);

class FFmpegAudioAnalyzer {
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
                    peak REAL,
                    rms REAL,
                    dynamic_range REAL,
                    spectral_centroid REAL,
                    spectral_rolloff REAL,
                    zero_crossing_rate REAL,
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
     * Analyze audio using FFmpeg filters
     */
    async analyzeWithFFmpeg(filePath) {
        try {
            // 1. Get loudness stats (LUFS)
            const loudnessCmd = `ffmpeg -i "${filePath}" -af ebur128=framelog=quiet -f null - 2>&1 | grep -E "I:|LRA:``;
            const { stdout: loudnessOut } = await execPromise(loudnessCmd, {
                maxBuffer: 10 * 1024 * 1024
            });

            // Parse loudness
            let lufs = -23.0;
            let lra = 7.0;
            const lufsMatch = loudnessOut.match(/I:\s*(-?\d+\.?\d*)/);
            const lraMatch = loudnessOut.match(/LRA:\s*(-?\d+\.?\d*)/);
            if (lufsMatch) {
                lufs = parseFloat(lufsMatch[1]);
            }
            if (lraMatch) {
                lra = parseFloat(lraMatch[1]);
            }

            // 2. Get peak and RMS
            const statsCmd = `ffmpeg -i "${filePath}" -af astats=metadata=1:reset=1 -f null - 2>&1 | grep -E "Peak_level|RMS_level` | head -4`;
            const { stdout: statsOut } = await execPromise(statsCmd, {
                maxBuffer: 10 * 1024 * 1024
            });

            let peak = 0.0;
            let rms = -20.0;
            const peakMatch = statsOut.match(/Peak_level.*?(-?\d+\.?\d*)/);
            const rmsMatch = statsOut.match(/RMS_level.*?(-?\d+\.?\d*)/);
            if (peakMatch) {
                peak = parseFloat(peakMatch[1]);
            }
            if (rmsMatch) {
                rms = parseFloat(rmsMatch[1]);
            }

            // 3. Get spectral characteristics
            const spectralCmd = `ffmpeg -i "${filePath}" -af aspectralstats=win_size=1024 -f null - 2>&1 | grep -E "mean|variance|centroid|spread|skewness|kurtosis|entropy|flatness|crest|flux|slope|decrease|rolloff` | head -20`;
            const { stdout: spectralOut } = await execPromise(spectralCmd, {
                maxBuffer: 10 * 1024 * 1024
            }).catch(() => ({ stdout: `` }));

            let spectralCentroid = 1000.0;
            let spectralRolloff = 5000.0;
            const centroidMatch = spectralOut.match(/centroid.*?(\d+\.?\d*)/);
            const rolloffMatch = spectralOut.match(/rolloff.*?(\d+\.?\d*)/);
            if (centroidMatch) {
                spectralCentroid = parseFloat(centroidMatch[1]);
            }
            if (rolloffMatch) {
                spectralRolloff = parseFloat(rolloffMatch[1]);
            }

            // 4. Get zero crossing rate (for speechiness detection)
            const zcrCmd = `ffmpeg -i "${filePath}" -af "silencedetect=n=-50dB:d=0.01" -f null - 2>&1 | grep -c "silence_" || echo "0``;
            const { stdout: zcrOut } = await execPromise(zcrCmd).catch(() => ({ stdout: `0` }));
            const silenceCount = parseInt(zcrOut.trim()) || 0;
            const zcr = Math.min(1.0, silenceCount / 100.0); // Normalize

            return {
                loudness: lufs,
                peak: peak,
                rms: rms,
                dynamic_range: lra,
                spectral_centroid: spectralCentroid,
                spectral_rolloff: spectralRolloff,
                zero_crossing_rate: zcr
            };
        } catch (error) {
            logError(`Error analyzing ${path.basename(filePath)}:`, error.message);
            return null;
        }
    }

    /**
     * Calculate derived features based on FFmpeg analysis and existing metadata
     */
    calculateDerivedFeatures(ffmpegData, bpm, key, energy) {
        if (!ffmpegData) {
            return null;
        }

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

        const isMajor = decodedKey.endsWith('B');
        const normalizedEnergy = energy ? energy / 10.0 : 0.5;

        // DANCEABILITY: Based on BPM, energy, and dynamic range
        let danceability = 0.5;
        if (bpm) {
            if (bpm >= 118 && bpm <= 132) {
                danceability = 0.75 + normalizedEnergy * 0.15;
            } else if (bpm >= 100 && bpm <= 140) {
                danceability = 0.6 + normalizedEnergy * 0.2;
            } else if (bpm >= 90 && bpm <= 150) {
                danceability = 0.4 + normalizedEnergy * 0.15;
            } else {
                danceability = 0.25 + normalizedEnergy * 0.1;
            }
        }
        // Adjust for dynamic range (compressed = more danceable)
        const compressionFactor = 1.0 - ffmpegData.dynamic_range / 20.0;
        danceability *= 0.8 + compressionFactor * 0.2;
        danceability = Math.min(1.0, Math.max(0.0, danceability));

        // ACOUSTICNESS: Based on spectral content and energy
        // Lower spectral centroid + lower energy = more acoustic
        const normalizedCentroid = Math.min(1.0, ffmpegData.spectral_centroid / 10000.0);
        const acousticness = Math.max(
            0.0,
            Math.min(
                1.0,
                (1.0 - normalizedCentroid) * 0.5 +
                    (1.0 - normalizedEnergy) * 0.3 +
                    (ffmpegData.dynamic_range / 20.0) * 0.2
            )
        );

        // INSTRUMENTALNESS: Based on zero crossing rate and spectral rolloff
        // Low ZCR + high rolloff = likely instrumental
        const instrumentalness = Math.max(
            0.0,
            Math.min(
                1.0,
                0.7 + // Base for electronic music
                    (1.0 - ffmpegData.zero_crossing_rate) * 0.2 +
                    (ffmpegData.spectral_rolloff / 20000.0) * 0.1
            )
        );

        // LIVENESS: Based on dynamic range and peak variations
        // Higher dynamic range might indicate live recording
        const liveness = Math.max(
            0.0,
            Math.min(
                1.0,
                0.1 + // Base low for studio recordings
                    (ffmpegData.dynamic_range / 30.0) * 0.2 +
                    Math.random() * 0.1 // Small random variation
            )
        );

        // SPEECHINESS: Based on zero crossing rate and spectral characteristics
        const speechiness = Math.max(
            0.0,
            Math.min(
                1.0,
                ffmpegData.zero_crossing_rate * 0.5 +
                    (1.0 - normalizedCentroid) * 0.3 +
                    Math.random() * 0.05
            )
        );

        // VALENCE: Based on key (major/minor), energy, and loudness
        let valence = isMajor ? 0.6 : 0.4;
        valence += normalizedEnergy * 0.2;
        valence += (1.0 - Math.abs(ffmpegData.loudness + 14) / 14.0) * 0.1; // Optimal around -14 LUFS
        valence += danceability * 0.1;
        valence = Math.min(1.0, Math.max(0.0, valence));

        return {
            ...ffmpegData,
            danceability,
            acousticness,
            instrumentalness,
            liveness,
            speechiness,
            valence,
            energy: normalizedEnergy,
            bpm: bpm || null,
            key: decodedKey
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

            logDebug(`🎵 Analyzing: ${file_name}`);
            logDebug(
                `   BPM: ${existing_bmp || 'N/A'} | Key: ${existing_key ? '✓' : 'N/A'} | Energy: ${energy_level || 'N/A'}');

            // Analyze with FFmpeg
            const ffmpegData = await this.analyzeWithFFmpeg(file_path);
            if (!ffmpegData) {
                logError('   ❌ FFmpeg analysis failed');
                this.stats.errors++;
                return false;
            }

            // Calculate derived features
            const features = this.calculateDerivedFeatures(
                ffmpegData,
                existing_bmp,
                existing_key,
                energy_level
            );
            if (!features) {
                logError(`   ❌ Feature calculation failed`);
                this.stats.errors++;
                return false;
            }

            // Save to database
            await this.saveFeatures(id, features);

            logDebug(
                `   ✅ LUFS: ${features.loudness.toFixed(1)}dB | Dance: ${features.danceability.toFixed(2)} | Valence: ${features.valence.toFixed(2)}`
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

    async saveFeatures(fileId, features) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO audio_features (
                    file_id,
                    loudness,
                    peak,
                    rms,
                    dynamic_range,
                    spectral_centroid,
                    spectral_rolloff,
                    zero_crossing_rate,
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ';

            this.db.run(
                query,
                [
                    fileId,
                    features.loudness,
                    features.peak,
                    features.rms,
                    features.dynamic_range,
                    features.spectral_centroid,
                    features.spectral_rolloff,
                    features.zero_crossing_rate,
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
                        // Also update llm_metadata
                        this.updateLLMMetadata(fileId, features).then(resolve).catch(resolve); // Continue even if update fails
                    }
                }
            );
        });
    }

    async updateLLMMetadata(fileId, features) {
        return new Promise((resolve, reject) => {
            const checkQuery = 'SELECT file_id FROM llm_metadata WHERE file_id = ?`;

            this.db.get(checkQuery, [fileId], (err, row) => {
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
                            AI_ANALYZED,
                            analysis_timestamp
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
                    `;
                    params = [
                        fileId,
                        features.loudness,
                        features.danceability,
                        features.acousticness,
                        features.instrumentalness,
                        features.liveness,
                        features.speechiness,
                        features.valence
                    ];
                }

                this.db.run(query, params, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
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

    async processInBatches(batchSize = 25) {
        let offset = 0;
        let hasMore = true;

        const startTime = Date.now();

        while (hasMore) {
            const files = await this.getFilesToProcess(batchSize, offset);

            if (files.length === 0) {
                hasMore = false;
                break;
            }

            logDebug(`\n📦 Processing batch: ${offset + 1} to ${offset + files.length}`);
            logDebug('=`.repeat(60));

            for (const file of files) {
                this.stats.processed++;

                // Show progress
                const progress = ((this.stats.processed / this.stats.total) * 100).toFixed(1);
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const rate = this.stats.processed / (elapsed || 1);
                const eta = Math.floor((this.stats.total - this.stats.processed) / rate);

                logDebug(
                    `\n[${this.stats.processed}/${this.stats.total}] (${progress}%) | ETA: ${eta}s`
                );

                await this.processFile(file);

                // Small delay every 10 files to avoid overwhelming FFmpeg
                if (this.stats.processed % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
                    MIN(feat.loudness) as min_loudness,
                    MAX(feat.loudness) as max_loudness,
                    AVG(feat.dynamic_range) as avg_dynamic_range
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
🎵 AUDIO FEATURE CALCULATOR WITH FFMPEG
${'='.repeat(60)}
Calculating: loudness, peak, RMS, spectral features,
            danceability, acousticness, instrumentalness,
            liveness, speechiness, valence
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
            logDebug(`   Average Loudness: ${stats.avg_loudness?.toFixed(1)} LUFS`);
            logDebug(`   Average Dynamic Range: ${stats.avg_dynamic_range?.toFixed(1)} LU`);

            this.db.close();
            return;
        }

        const confirm = process.argv[2] === '--yes';
        if (!confirm) {
            logWarn('⚠️  This will analyze all files with FFmpeg (may take several hours)');
            logDebug('   Run with --yes to confirm');
            this.db.close();
            return;
        }

        logInfo('🚀 Starting FFmpeg analysis...\n');

        // Process in smaller batches for FFmpeg
        await this.processInBatches(25);

        logDebug('\n' + '='.repeat(60));
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
        logDebug(
            `   Coverage: ${((stats.analyzed_files / stats.total_files) * 100).toFixed(1)}%`
        );
        logDebug(`   Average Loudness: ${stats.avg_loudness?.toFixed(1)} LUFS`);
        logDebug(`   Average Danceability: ${stats.avg_danceability?.toFixed(2)}`);
        logDebug(`   Average Acousticness: ${stats.avg_acousticness?.toFixed(2)}`);
        logDebug(`   Average Valence: ${stats.avg_valence?.toFixed(2)}`);
        logDebug(
            `   Loudness Range: ${stats.min_loudness?.toFixed(1)} to ${stats.max_loudness?.toFixed(1)} LUFS`
        );
        logDebug(`   Average Dynamic Range: ${stats.avg_dynamic_range?.toFixed(1)} LU`);

        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const analyzer = new FFmpegAudioAnalyzer();

    analyzer.run().catch(error => {
        logError('Fatal error:`, error);
        process.exit(1);
    });
}

module.exports = FFmpegAudioAnalyzer;
