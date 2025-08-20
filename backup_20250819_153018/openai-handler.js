// OpenAI Integration Handler for Music Metadata Analysis
const { ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
const OPENAI_MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS) || 500;
const OPENAI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3;

// Rate limiting
const REQUESTS_PER_MINUTE = parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE) || 20;
const BATCH_SIZE = parseInt(process.env.OPENAI_BATCH_SIZE) || 10;

class OpenAIHandler {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'music_analyzer.db');
        this.db = null;
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.requestCount = 0;

        // Validate API key
        if (!OPENAI_API_KEY) {
            console.error('❌ OpenAI API key not found in .env file');
            throw new Error('OpenAI API key is required');
        }
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    console.error('❌ Database connection failed:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Generate prompt for music analysis
    generatePrompt(metadata) {
        return `Analyze this music track and provide detailed metadata in JSON format:

Title: ${metadata.title || 'Unknown'}
Artist: ${metadata.artist || 'Unknown'}
Album: ${metadata.album || 'Unknown'}
Genre: ${metadata.genre || 'Unknown'}
Duration: ${metadata.duration ? Math.round(metadata.duration) + ' seconds' : 'Unknown'}
Year: ${metadata.year || 'Unknown'}
BPM: ${metadata.bpm || 'Unknown'}

Please provide a JSON response with the following structure:
{
    "genre": "specific genre classification",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood (e.g., energetic, melancholic, uplifting)",
    "energy": 0.0-1.0 scale,
    "danceability": 0.0-1.0 scale,
    "valence": 0.0-1.0 scale (positivity),
    "acousticness": 0.0-1.0 scale,
    "instrumentalness": 0.0-1.0 scale,
    "speechiness": 0.0-1.0 scale,
    "liveness": 0.0-1.0 scale,
    "description": `2-3 sentence description of the track`s characteristics",
    "era": "musical era or time period",
    "cultural_context": "cultural or regional context",
    "occasions": ["suitable occasions for playing"],
    "similar_artists": ["artist1", "artist2"],
    "instruments": ["prominent instruments"],
    "vocal_style": "description of vocal characteristics if applicable",
    "production_style": "production and mixing characteristics",
    "key": "musical key if identifiable",
    "time_signature": "4/4, 3/4, etc.",
    "tempo_description": "slow, moderate, fast, etc.",
    "recommendations": "mixing or playlist recommendations`
}

Provide only the JSON response without any additional text.`;
    }

    // Call OpenAI API
    async callOpenAI(prompt) {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 60000 / REQUESTS_PER_MINUTE;

        if (timeSinceLastRequest < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();

        try {
            // Determine if using GPT-5 (requires different parameters)
            const isGPT5 = OPENAI_MODEL.toLowerCase().includes('gpt-5');

            const requestBody = {
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a professional music analyst with expertise in genre classification, music theory, and production. Provide accurate and detailed analysis of music tracks.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' }
            };

            // GPT-5 specific parameters
            if (isGPT5) {
                requestBody.max_completion_tokens = OPENAI_MAX_TOKENS;
                // GPT-5 only supports temperature = 1
                requestBody.temperature = 1;
            } else {
                requestBody.max_tokens = OPENAI_MAX_TOKENS;
                requestBody.temperature = OPENAI_TEMPERATURE;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': `application/json`,
                    Authorization: `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parse JSON response
            try {
                return JSON.parse(content);
            } catch (parseError) {
                console.error('Failed to parse OpenAI response:', content);
                throw new Error('Invalid JSON response from OpenAI');
            }
        } catch (error) {
            console.error('OpenAI API call failed:`, error);
            throw error;
        }
    }

    // Analyze single track
    async analyzeTrack(fileId) {
        return new Promise((resolve, reject) => {
            // Get track metadata from database
            const sql = `
                SELECT af.*, lm.* 
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            this.db.get(sql, [fileId], async (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    reject(new Error('Track not found`));
                    return;
                }

                try {
                    // Generate prompt and call OpenAI
                    const prompt = this.generatePrompt(row);
                    const analysis = await this.callOpenAI(prompt);

                    // Update database with analysis results
                    await this.updateDatabase(fileId, analysis);

                    resolve({
                        fileId,
                        title: row.title,
                        artist: row.artist,
                        analysis
                    });
                } catch (error) {
                    console.error(`❌ Analysis failed for file ${fileId}:`, error);
                    reject(error);
                }
            });
        });
    }

    // Update database with AI analysis
    async updateDatabase(fileId, analysis) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE llm_metadata SET
                    LLM_GENRE = ?,
                    LLM_SUBGENRES = ?,
                    LLM_MOOD = ?,
                    AI_ENERGY = ?,
                    AI_DANCEABILITY = ?,
                    AI_VALENCE = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_LIVENESS = ?,
                    LLM_DESCRIPTION = ?,
                    AI_ERA = ?,
                    AI_CULTURAL_CONTEXT = ?,
                    AI_OCCASION = ?,
                    LLM_Similar_Artists = ?,
                    LLM_Instruments = ?,
                    LLM_Vocal_Style = ?,
                    LLM_Production_Style = ?,
                    AI_KEY = ?,
                    AI_TIME_SIGNATURE = ?,
                    LLM_ENERGY_LEVEL = ?,
                    LLM_RECOMMENDATIONS = ?,
                    LLM_ANALYZED = 1,
                    AI_ANALYZED = 1,
                    LLM_ANALYSIS_DATE = datetime('now'),
                    AI_ANALYZED_DATE = datetime('now'),
                    llm_version = 'OpenAI-' || ?
                WHERE file_id = ?
            ';

            const params = [
                analysis.genre,
                JSON.stringify(analysis.subgenres || []),
                analysis.mood,
                analysis.energy,
                analysis.danceability,
                analysis.valence,
                analysis.acousticness,
                analysis.instrumentalness,
                analysis.speechiness,
                analysis.liveness,
                analysis.description,
                analysis.era,
                analysis.cultural_context,
                JSON.stringify(analysis.occasions || []),
                JSON.stringify(analysis.similar_artists || []),
                JSON.stringify(analysis.instruments || []),
                analysis.vocal_style,
                analysis.production_style,
                analysis.key,
                analysis.time_signature,
                analysis.tempo_description,
                analysis.recommendations,
                OPENAI_MODEL,
                fileId
            ];

            this.db.run(sql, params, err => {
                if (err) {
                    console.error('Database update failed:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Batch analyze multiple tracks
    async analyzeBatch(fileIds, progressCallback) {
        const results = [];
        const errors = [];

        for (let i = 0; i < fileIds.length; i++) {
            try {
                const result = await this.analyzeTrack(fileIds[i]);
                results.push(result);

                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: fileIds.length,
                        success: results.length,
                        errors: errors.length
                    });
                }

                // Small delay between requests
                if (i < fileIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                errors.push({
                    fileId: fileIds[i],
                    error: error.message
                });
            }
        }

        return {
            success: results,
            errors: errors,
            summary: {
                total: fileIds.length,
                successful: results.length,
                failed: errors.length
            }
        };
    }

    // Test connection
    async testConnection() {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET`,
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`
                }
            });

            if (!response.ok) {
                throw new Error(`API test failed: ${response.status}`);
            }

            const data = await response.json();

            // Check if our preferred model is available
            const modelAvailable = data.data.some(m => m.id === OPENAI_MODEL);

            return {
                success: true,
                models: data.data.length,
                modelAvailable
            };
        } catch (error) {
            console.error('❌ OpenAI connection test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Initialize handler
let handler = null;

async function initializeOpenAIHandler() {
    try {
        handler = new OpenAIHandler();
        await handler.init();

        // Test connection on startup
        const testResult = await handler.testConnection();

        if (!testResult.success) {
            console.error('OpenAI connection test failed:', testResult.error);
        }

        return handler;
    } catch (error) {
        console.error('Failed to initialize OpenAI handler:', error);
        throw error;
    }
}

// IPC Handlers
function setupOpenAIHandlers() {
    // Test connection
    ipcMain.handle('openai-test-connection', async () => {
        if (!handler) {
            await initializeOpenAIHandler();
        }
        return await handler.testConnection();
    });

    // Analyze single track
    ipcMain.handle('openai-analyze-track', async (event, fileId) => {
        if (!handler) {
            await initializeOpenAIHandler();
        }
        return await handler.analyzeTrack(fileId);
    });

    // Analyze batch
    ipcMain.handle('openai-analyze-batch', async (event, fileIds) => {
        if (!handler) {
            await initializeOpenAIHandler();
        }

        return await handler.analyzeBatch(fileIds, progress => {
            event.sender.send('openai-batch-progress', progress);
        });
    });

    // Get unanalyzed tracks
    ipcMain.handle('get-unanalyzed-tracks`, async (event, limit = 100) => {
        if (!handler) {
            await initializeOpenAIHandler();
        }

        return new Promise((resolve, reject) => {
            const sql = `
                SELECT af.id, af.title, af.artist, af.album 
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE lm.LLM_ANALYZED IS NULL OR lm.LLM_ANALYZED = 0
                LIMIT ?
            `;

            handler.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });
}

module.exports = {
    initializeOpenAIHandler,
    setupOpenAIHandlers
};
