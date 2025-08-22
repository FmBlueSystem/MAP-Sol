// Import Music Handler - Backend processing for adding new music files
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');
const { spawn } = require('child_process');
const { HAMMSCalculator } = require('../src/services/hamms-calculator');

class ImportMusicHandler {
    constructor(db, mainWindow = null) {
        this.db = db;
        this.mainWindow = mainWindow;
        this.isProcessing = false;
        this.currentBatch = null;
        this.abortController = null;
        this.hammsCalculator = new HAMMSCalculator();
        this.processedCount = 0;
        this.startTime = null;

        this.setupHandlers();
    }

    setupHandlers() {
        // File selection dialog
        ipcMain.handle('select-music-files', async (event) => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                title: 'Select Music Files',
                properties: ['openFile', 'multiSelections'],
                buttonLabel: 'Select Files',
                filters: [
                    {
                        name: 'Music Files',
                        extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'wma', 'aiff', 'opus', 'ape', 'webm'],
                    },
                    { name: 'All Files', extensions: ['*'] },
                ],
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
        console.log('[ImportHandler] Starting import with paths:', paths);
        console.log('[ImportHandler] Options:', options);

        const startTime = Date.now();
        const results = {
            imported: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            files: [],
        };

        // Stage 1: Scan for audio files
        this.sendProgress(event, { stage: 'scan', current: 0, total: paths.length });
        const audioFiles = await this.scanForAudioFiles(paths);

        console.log('[ImportHandler] Found audio files:', audioFiles.length);

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
            total: filesToImport.length,
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
                    fileName: path.basename(file),
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
            '.mp3',
            '.m4a',
            '.flac',
            '.wav',
            '.ogg',
            '.aac',
            '.wma',
            '.aiff',
            '.ape',
            '.opus',
            '.webm',
        ]);

        console.log('[ImportHandler] Scanning paths:', paths);

        for (const inputPath of paths) {
            try {
                const stats = await fs.stat(inputPath);

                if (stats.isDirectory()) {
                    console.log('[ImportHandler] Scanning directory:', inputPath);
                    // Recursively scan directory
                    const files = await this.scanDirectory(inputPath, audioExtensions);
                    audioFiles.push(...files);
                } else if (stats.isFile()) {
                    // Check if it's an audio file
                    const ext = path.extname(inputPath).toLowerCase();
                    if (audioExtensions.has(ext)) {
                        console.log('[ImportHandler] Found audio file:', inputPath);
                        audioFiles.push(inputPath);
                    }
                }
            } catch (error) {
                console.error('[ImportHandler] Error scanning path:', inputPath, error.message);
                // Skip files that don't exist or can't be accessed
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
                if (!entry.name.startsWith('.') && !['node_modules', 'Library', 'System'].includes(entry.name)) {
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
            this.db.get('SELECT id FROM audio_files WHERE file_path = ?', [filePath], (err, row) => {
                resolve(!!row);
            });
        });
    }

    async isDuplicate(filePath, metadata, fileHash) {
        return new Promise((resolve) => {
            // Check by file path, hash, or title+artist combination
            this.db.get(
                `SELECT id FROM audio_files 
                WHERE file_path = ? 
                OR file_hash = ? 
                OR (title = ? AND artist = ?)`,
                [filePath, fileHash, metadata.title, metadata.artist],
                (err, row) => {
                    resolve(!!row);
                }
            );
        });
    }

    async importSingleFile(filePath, options, event) {
        const fileName = path.basename(filePath);

        // Stage 1: Extract enhanced metadata with Mixed In Key
        this.sendProgress(event, {
            stage: 'metadata',
            fileName,
            message: 'Reading metadata and Mixed In Key data...',
        });
        const metadata = await this.extractEnhancedMetadata(filePath);

        // Stage 2: Check for duplicates using hash + metadata
        const fileHash = await this.generateFileHash(filePath);
        if (await this.isDuplicate(filePath, metadata, fileHash)) {
            this.sendProgress(event, {
                stage: 'duplicate',
                fileName,
                message: 'Duplicate file detected, skipping...',
            });
            return null;
        }

        // Stage 3: Insert into database with transaction
        this.sendProgress(event, {
            stage: 'database',
            fileName,
            message: 'Saving to database...',
        });
        const fileId = await this.insertFileRecord(filePath, metadata, fileHash);

        // Stage 4: Save basic metadata (BPM, Key, Energy) to llm_metadata
        this.sendProgress(event, {
            stage: 'basic-metadata',
            fileName,
            message: 'Saving BPM, Key and Energy metadata...',
        });
        await this.saveBasicMetadata(fileId, metadata);

        // Stage 5: Calculate HAMMS vector
        this.sendProgress(event, {
            stage: 'hamms',
            fileName,
            message: 'Calculating HAMMS 7D similarity vector...',
        });
        await this.calculateAndSaveHAMMS(fileId, metadata);

        // Stage 5: Extract artwork (always try to extract if available)
        if (metadata.common && metadata.common.picture && metadata.common.picture.length > 0) {
            this.sendProgress(event, {
                stage: 'artwork',
                fileName,
                message: 'Extracting album artwork...',
            });
            // Pass the first picture from the metadata
            await this.extractArtwork(fileId, metadata.common.picture[0]);
        } else if (options.extractArtwork && metadata.artwork) {
            // Fallback to old format if exists
            this.sendProgress(event, {
                stage: 'artwork',
                fileName,
                message: 'Extracting album artwork...',
            });
            await this.extractArtwork(fileId, metadata.artwork);
        }

        // Stage 6: Run Essentia/Librosa analysis (if enabled)
        if (options.runAnalysis) {
            this.sendProgress(event, {
                stage: 'analysis',
                fileName,
                message: 'Analyzing audio features with Essentia...',
            });
            await this.runEnhancedAnalysis(filePath, fileId);
        }

        // Stage 7: AI enrichment with GPT-4 (optional)
        if (options.runAI && process.env.OPENAI_API_KEY) {
            this.sendProgress(event, {
                stage: 'ai',
                fileName,
                message: 'Enriching with AI analysis...',
            });
            await this.runRealAIEnrichment(fileId, metadata, filePath);
        }

        // Stage 8: Complete
        this.sendProgress(event, {
            stage: 'complete',
            fileName,
            message: `Successfully imported ${fileName}!`,
        });

        return {
            id: fileId,
            file_path: filePath,
            ...metadata,
        };
    }

    async extractEnhancedMetadata(filePath) {
        try {
            const metadata = await mm.parseFile(filePath);
            const common = metadata.common || {};
            const format = metadata.format || {};
            const native = metadata.native || {};

            // Extract artwork if present
            let artwork = null;
            if (common.picture && common.picture.length > 0) {
                artwork = common.picture[0];
            }

            // Extract Mixed In Key data from comments
            const mixedInKeyData = {};
            if (common.comment) {
                const comments = Array.isArray(common.comment) ? common.comment : [common.comment];
                comments.forEach((comment) => {
                    if (typeof comment === 'string') {
                        // Parse Mixed In Key format: "8A - 128"
                        const mikMatch = comment.match(/(\d{1,2}[AB])\s*-\s*(\d+)/);
                        if (mikMatch) {
                            mixedInKeyData.key = mikMatch[1];
                            mixedInKeyData.bpm = parseInt(mikMatch[2]);
                        }
                        // Parse energy if present
                        const energyMatch = comment.match(/Energy:\s*(\d+)/);
                        if (energyMatch) {
                            mixedInKeyData.energy = parseInt(energyMatch[1]) / 10; // Convert to 0-1 scale
                        }
                    }
                });
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
                artwork: artwork,
                isrc: common.isrc || null,
                composer: common.composer ? common.composer.join(', ') : null,
                albumArtist: common.albumartist || null,
                comment: common.comment ? common.comment.join(' ') : null,
                // Mixed In Key data
                mik_key: mixedInKeyData.key || null,
                mik_bpm: mixedInKeyData.bpm || null,
                mik_energy: mixedInKeyData.energy || null,
            };
        } catch (error) {
            console.error('Enhanced metadata extraction error:', error);
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
                artwork: null,
                mik_key: null,
                mik_bpm: null,
                mik_energy: null,
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
                    fileExt,
                ],
                function (err) {
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
        if (!artworkData) {
            return;
        }

        try {
            const artworkDir = path.join(process.cwd(), 'artwork-cache');
            await fs.mkdir(artworkDir, { recursive: true });

            const artworkFileName = `${fileId}.jpg`;
            const artworkFullPath = path.join(artworkDir, artworkFileName);
            await fs.writeFile(artworkFullPath, artworkData.data);

            // Store relative path in database (artwork-cache/ID.jpg)
            const artworkRelativePath = `artwork-cache/${artworkFileName}`;

            // Update database with relative artwork path
            return new Promise((resolve) => {
                this.db.run(
                    'UPDATE audio_files SET artwork_path = ? WHERE id = ?',
                    [artworkRelativePath, fileId],
                    (err) => {
                        if (err) {
                            console.error('Error updating artwork path:', err);
                        } else {
                            console.log(`✅ Artwork saved for track ${fileId}: ${artworkRelativePath}`);
                        }
                        resolve();
                    }
                );
            });
        } catch (error) {
            console.error('Artwork extraction error:', error);
        }
    }

    async runEnhancedAnalysis(filePath, fileId) {
        return new Promise((resolve, reject) => {
            // Run the enhanced Python analysis script with Essentia
            const analysisScript = path.join(process.cwd(), 'scripts', 'analyze_audio_enhanced.py');
            const python = spawn('python3', [analysisScript, filePath, fileId]);

            let output = '';
            let error = '';
            let progressData = {};

            python.stdout.on('data', (data) => {
                output += data.toString();
                // Parse progress updates from Python script
                const lines = data.toString().split('\n');
                lines.forEach((line) => {
                    if (line.startsWith('PROGRESS:')) {
                        try {
                            progressData = JSON.parse(line.substring(9));
                            console.log('Analysis progress:', progressData);
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                });
            });

            python.stderr.on('data', (data) => {
                error += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    console.error('Enhanced analysis error:', error);
                    reject(new Error(`Analysis failed: ${error}`));
                } else {
                    console.log('Enhanced analysis complete');
                    // Parse and save results
                    try {
                        const results = JSON.parse(output.split('RESULT:')[1] || '{}');
                        this.saveAnalysisResults(fileId, results).then(resolve);
                    } catch (e) {
                        resolve();
                    }
                }
            });

            // Set longer timeout for comprehensive analysis
            setTimeout(() => {
                python.kill();
                resolve();
            }, 60000); // 60 second timeout
        });
    }

    async runRealAIEnrichment(fileId, metadata, filePath) {
        if (!process.env.OPENAI_API_KEY) {
            console.log('OpenAI API key not configured, skipping AI enrichment');
            return;
        }

        try {
            // Prepare prompt for GPT-4 analysis
            const prompt = this.buildAIPrompt(metadata, filePath);

            // Call OpenAI API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4-turbo-preview',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a professional music analyst. Analyze the provided metadata and return a JSON object with genre, subgenres, mood, era, occasions, and a brief description.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 500,
                    response_format: { type: 'json_object' },
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            const aiAnalysis = JSON.parse(data.choices[0].message.content);

            // Save AI analysis to database
            await this.saveAIAnalysis(fileId, aiAnalysis);

            console.log('AI enrichment complete for file:', fileId);
        } catch (error) {
            console.error('AI enrichment error:', error);
            // Don't fail the import if AI enrichment fails
        }
    }

    buildAIPrompt(metadata, filePath) {
        return `
Analyze this music track and provide detailed insights:

Title: ${metadata.title}
Artist: ${metadata.artist}
Album: ${metadata.album}
Year: ${metadata.year || 'Unknown'}
Genre (from tags): ${metadata.genre || 'Unknown'}
Duration: ${metadata.duration ? Math.floor(metadata.duration / 60) + ':' + (metadata.duration % 60).toString().padStart(2, '0') : 'Unknown'}
BPM: ${metadata.mik_bpm || 'Unknown'}
Key: ${metadata.mik_key || 'Unknown'}
Energy: ${metadata.mik_energy || 'Unknown'}

Please provide:
1. Primary genre classification
2. Up to 3 relevant subgenres
3. Mood/emotion (energetic, melancholic, uplifting, etc.)
4. Era/period classification
5. Best occasions for playing (party, workout, relaxation, etc.)
6. A brief 2-3 sentence description of the track's characteristics

Return as JSON with keys: genre, subgenres (array), mood, era, occasions (array), description
        `;
    }

    async saveAIAnalysis(fileId, analysis) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE llm_metadata SET 
                    ai_genre = ?,
                    ai_subgenres = ?,
                    ai_mood = ?,
                    ai_era = ?,
                    ai_occasions = ?,
                    ai_description = ?,
                    ai_analyzed_at = datetime('now')
                WHERE file_id = ?`,
                [
                    analysis.genre,
                    JSON.stringify(analysis.subgenres || []),
                    analysis.mood,
                    analysis.era,
                    JSON.stringify(analysis.occasions || []),
                    analysis.description,
                    fileId,
                ],
                (err) => {
                    if (err) {
                        console.error('Error saving AI analysis:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async saveBasicMetadata(fileId, metadata) {
        return new Promise((resolve, reject) => {
            // First ensure the record exists in llm_metadata
            this.db.run('INSERT OR IGNORE INTO llm_metadata (file_id) VALUES (?)', [fileId], (err) => {
                if (err) {
                    console.error('Error creating llm_metadata record:', err);
                    return resolve(); // Don't fail the import
                }

                // Extract BPM, Key, Energy from various sources
                let bpm = metadata.mik_bpm || metadata.bpm || null;
                let key = metadata.mik_key || metadata.key || null;
                let energy = metadata.mik_energy || metadata.energy || null;

                // Try to extract from native tags if not found
                if (!bpm && metadata.native) {
                    for (const [format, tags] of Object.entries(metadata.native)) {
                        tags?.forEach((tag) => {
                            const tagId = tag.id?.toLowerCase() || '';
                            if (!bpm && (tagId.includes('bpm') || tagId === 'tempo')) {
                                const parsedBpm = parseFloat(tag.value);
                                if (!isNaN(parsedBpm) && parsedBpm > 0) {
                                    bpm = Math.round(parsedBpm);
                                }
                            }
                            if (!key && (tagId.includes('key') || tagId === 'initialkey' || tagId === 'tkey')) {
                                key = tag.value;
                            }
                            if (!energy && tagId.includes('energy')) {
                                const parsedEnergy = parseFloat(tag.value);
                                if (!isNaN(parsedEnergy)) {
                                    energy = parsedEnergy;
                                }
                            }
                        });
                    }
                }

                // Update the metadata
                const updates = [];
                const values = [];

                if (bpm !== null && bpm !== undefined) {
                    updates.push('AI_BPM = ?');
                    values.push(bpm);
                    console.log(`  BPM: ${bpm}`);
                }

                if (key !== null && key !== undefined) {
                    updates.push('AI_KEY = ?');
                    values.push(key);
                    console.log(`  Key: ${key}`);
                }

                if (energy !== null && energy !== undefined) {
                    // Normalize energy to 0-10 scale if it's 0-1
                    const normalizedEnergy = energy <= 1 ? energy * 10 : energy;
                    updates.push('AI_ENERGY = ?');
                    values.push(normalizedEnergy);
                    console.log(`  Energy: ${normalizedEnergy}`);
                }

                if (updates.length > 0) {
                    values.push(fileId);
                    const query = `UPDATE llm_metadata SET ${updates.join(', ')} WHERE file_id = ?`;

                    this.db.run(query, values, (err) => {
                        if (err) {
                            console.error('Error updating basic metadata:', err);
                        } else {
                            console.log(`✅ Basic metadata saved for file ID ${fileId}`);
                        }
                        resolve();
                    });
                } else {
                    console.log(`⚠️  No BPM/Key/Energy found for file ID ${fileId}`);
                    resolve();
                }
            });
        });
    }

    async calculateAndSaveHAMMS(fileId, metadata) {
        try {
            // Get any existing analysis data
            const existingData = await this.getExistingAnalysis(fileId);

            // Prepare track data for HAMMS calculation
            const trackData = {
                AI_BPM: metadata.mik_bpm || existingData?.AI_BPM || 120,
                AI_KEY: metadata.mik_key || existingData?.AI_KEY || 'C',
                AI_ENERGY: metadata.mik_energy || existingData?.AI_ENERGY || 0.5,
                AI_DANCEABILITY: existingData?.AI_DANCEABILITY || 0.5,
                AI_VALENCE: existingData?.AI_VALENCE || 0.5,
                AI_ACOUSTICNESS: existingData?.AI_ACOUSTICNESS || 0.5,
                AI_INSTRUMENTALNESS: existingData?.AI_INSTRUMENTALNESS || 0.5,
            };

            // Calculate HAMMS vector
            const hammsVector = this.hammsCalculator.calculateVector(trackData);

            // Save to database
            await this.saveHAMMSVector(fileId, hammsVector);

            console.log('HAMMS vector calculated and saved for file:', fileId);
        } catch (error) {
            console.error('Error calculating HAMMS:', error);
        }
    }

    async getExistingAnalysis(fileId) {
        return new Promise((resolve) => {
            this.db.get('SELECT * FROM llm_metadata WHERE file_id = ?', [fileId], (err, row) => {
                resolve(row || null);
            });
        });
    }

    async saveHAMMSVector(fileId, vector) {
        return new Promise((resolve, reject) => {
            // First ensure llm_metadata record exists
            this.db.run('INSERT OR IGNORE INTO llm_metadata (file_id) VALUES (?)', [fileId], (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Then update with HAMMS data
                this.db.run(
                    `UPDATE llm_metadata SET
                            hamms_bpm = ?,
                            hamms_energy = ?,
                            hamms_danceability = ?,
                            hamms_valence = ?,
                            hamms_acousticness = ?,
                            hamms_instrumentalness = ?,
                            hamms_key = ?,
                            hamms_calculated_at = datetime('now')
                        WHERE file_id = ?`,
                    [
                        vector.bpm,
                        vector.energy,
                        vector.danceability,
                        vector.valence,
                        vector.acousticness,
                        vector.instrumentalness,
                        vector.key,
                        fileId,
                    ],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        });
    }

    async saveAnalysisResults(fileId, results) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE llm_metadata SET
                    AI_DANCEABILITY = ?,
                    AI_VALENCE = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LOUDNESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_LIVENESS = ?,
                    essentia_analyzed_at = datetime('now')
                WHERE file_id = ?`,
                [
                    results.danceability || 0,
                    results.valence || 0,
                    results.acousticness || 0,
                    results.instrumentalness || 0,
                    results.loudness || 0,
                    results.speechiness || 0,
                    results.liveness || 0,
                    fileId,
                ],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    sendProgress(event, data) {
        if (event && event.sender) {
            // Calculate ETA if we have progress info
            if (this.startTime && this.processedCount > 0) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                const rate = this.processedCount / elapsed;
                const remaining = (this.currentBatch?.length || 0) - this.processedCount;
                data.eta = remaining / rate;
            }

            event.sender.send('import-progress', data);
        }
    }
}

module.exports = ImportMusicHandler;
