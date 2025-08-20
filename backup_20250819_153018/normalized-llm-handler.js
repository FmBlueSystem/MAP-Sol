/**
 * NORMALIZED LLM HANDLER
 * Handler optimizado que usa y genera datos normalizados
 * Asegura consistencia en las respuestas de OpenAI
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4-turbo-preview';

class NormalizedLLMHandler {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'music_analyzer.db');
        this.db = null;

        // Valores normalizados permitidos
        this.normalizedValues = {
            era: ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
            mood: ['Happy', 'Melancholic', 'Energetic', 'Relaxed', 'Romantic', 
                   'Dark', 'Aggressive', 'Intense', 'Nostalgic', 'Uplifting', 
                   'Party', 'Introspective', 'Mysterious', 'Peaceful', 'Anxious'],
            energy: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
            language: ['English', 'Spanish', 'French', 'German', 'Italian', 
                      'Portuguese', 'Instrumental', 'Unknown'],
            storytelling: ['Narrative', 'Abstract', 'Personal', 'Political', 
                          'Romantic', 'Party', 'Introspective', 'Unknown'],
            occasions: ['Party', 'Workout', 'Relaxation', 'Driving', 'Work', 
                       'Romantic', 'Dancing', 'Morning', 'Night', 'Study']
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err);
                else {

                    resolve();
                }
            });
        });
    }

    /**
     * Build normalized prompt with constraints
     */
    buildNormalizedPrompt(track) {
        // Parse normalized data
        const era = track.LLM_ERA || this.getEraFromYear(track.year);
        const existingMood = track.AI_MOOD || 'Unknown';
        const existingEnergy = this.normalizeEnergyValue(track.AI_ENERGY);

        // Geographic context from ISRC
        let geoContext = '';
        if (track.isrc && track.isrc.length === 12) {
            const countryCode = track.isrc.substring(0, 2);
            const countries = {
                'US': 'United States', 'GB': 'United Kingdom', 
                'DE': 'Germany', 'FR': 'France', 'ES': 'Spain',
                'MX': 'Mexico', 'AR': 'Argentina', 'BR': 'Brazil'
            };
            geoContext = `Country: ${countries[countryCode] || countryCode}`;
        }

        return `Analyze this track using ONLY the normalized values provided in the constraints.

TRACK INFORMATION:
Title: ${track.title}
Artist: ${track.artist}
Album: ${track.album || 'Unknown'}
Genre: ${track.LLM_GENRE || track.genre || 'Unknown'}
${geoContext}

EXISTING NORMALIZED DATA (DO NOT CHANGE):
Era: ${era}
Energy Level: ${existingEnergy}
Current Mood: ${existingMood}
BPM: ${track.AI_BPM || 'Unknown'}
Key: ${track.AI_KEY || 'Unknown'}

NORMALIZATION CONSTRAINTS - USE ONLY THESE VALUES:

ERAS (choose one):
${this.normalizedValues.era.join(', ')}

MOODS (choose 1-2 that best fit):
${this.normalizedValues.mood.join(', ')}

ENERGY LEVELS (choose one):
${this.normalizedValues.energy.join(', ')}

LANGUAGES (choose one):
${this.normalizedValues.language.join(', ')}

STORYTELLING STYLES (choose one):
${this.normalizedValues.storytelling.join(', ')}

OCCASIONS (choose 1-3 that fit):
${this.normalizedValues.occasions.join(', ')}

PROVIDE ANALYSIS IN THIS EXACT JSON FORMAT:
{
  "description": `2-3 sentences about the track`s unique characteristics",
  "era": "Choose from ERAS list above",
  "mood": "Choose from MOODS list above",
  "energy_level": "Choose from ENERGY LEVELS list above",
  "lyrics": {
    "theme": "Brief theme description",
    "language": "Choose from LANGUAGES list above",
    "explicit": false,
    "storytelling": "Choose from STORYTELLING list above"
  },
  "cultural_context": "Brief cultural/historical significance",
  "similar_artists": ["Artist1", "Artist2", "Artist3", "Artist4", "Artist5"],
  "dj_notes": {
    "best_for": "Choose from OCCASIONS list",
    "mix_with": "Genre names that mix well",
    "set_position": "opener/warm-up/peak-time/closer",
    "bpm_range": "120-124 BPM"
  },
  "production": {
    "style": "Production style description",
    "instruments": "Main instruments",
    "quality": "Lo-fi/Standard/High/Remastered"
  },
  "flags": {
    "is_remix": false,
    "is_cover": false,
    "is_live": false
  },
  "recommendations": `If you like this, try...`
}

IMPORTANT: 
- Use ONLY the values from the constraint lists
- Return VALID JSON only
- Keep descriptions concise
- Era should match the track's actual release period';
    }

    /**
     * Get era from year
     */
    getEraFromYear(year) {
        if (!year) return '2020s';
        const y = parseInt(year);
        if (y >= 1970 && y < 1980) return '1970s';
        if (y >= 1980 && y < 1990) return '1980s';
        if (y >= 1990 && y < 2000) return '1990s';
        if (y >= 2000 && y < 2010) return '2000s';
        if (y >= 2010 && y < 2020) return '2010s';
        if (y >= 2020) return '2020s';
        return '2020s';
    }

    /**
     * Normalize energy value
     */
    normalizeEnergyValue(energy) {
        if (!energy) return 'Medium';
        const e = parseFloat(energy);
        if (e < 0.2) return 'Very Low';
        if (e < 0.4) return 'Low';
        if (e < 0.6) return 'Medium';
        if (e < 0.8) return 'High';
        return 'Very High';
    }

    /**
     * Validate and normalize response
     */
    validateResponse(response) {
        // Ensure values are from allowed lists
        if (response.era && !this.normalizedValues.era.includes(response.era)) {
            // Find closest match
            response.era = this.findClosestMatch(response.era, this.normalizedValues.era);
        }

        if (response.mood && !this.normalizedValues.mood.includes(response.mood)) {
            response.mood = this.findClosestMatch(response.mood, this.normalizedValues.mood);
        }

        if (response.energy_level && !this.normalizedValues.energy.includes(response.energy_level)) {
            response.energy_level = 'Medium';
        }

        if (response.lyrics) {
            if (!this.normalizedValues.language.includes(response.lyrics.language)) {
                response.lyrics.language = 'Unknown';
            }
            if (!this.normalizedValues.storytelling.includes(response.lyrics.storytelling)) {
                response.lyrics.storytelling = 'Unknown';
            }
        }

        return response;
    }

    /**
     * Find closest match from allowed values
     */
    findClosestMatch(value, allowedValues) {
        if (!value || typeof value !== 'string') {
            return allowedValues[0]; // Default to first option if invalid
        }
        const v = value.toLowerCase();
        for (const allowed of allowedValues) {
            if (allowed.toLowerCase().includes(v) || v.includes(allowed.toLowerCase())) {
                return allowed;
            }
        }
        return allowedValues[0]; // Default to first option
    }

    /**
     * Call OpenAI with normalized prompt (with retry logic)
     */
    async callOpenAI(prompt, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        `Authorization`: `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a music analysis expert. Always respond with valid JSON using ONLY the normalized values provided in the constraints. Never use values outside the allowed lists.'
                            },
                            {
                                role: 'user`,
                                content: prompt
                            }
                        ],
                        temperature: 0.3, // Lower temperature for consistency
                        max_tokens: 800,
                        response_format: { type: "json_object` } // Force JSON response
                    })
                });

                // Handle rate limit error
                if (response.status === 429) {
                    const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s

                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }

                const data = await response.json();
                const content = data.choices[0].message.content;

                // Parse and validate JSON
                const parsed = JSON.parse(content);
                return this.validateResponse(parsed);

            } catch (error) {
                if (attempt === retries) {
                    console.error('❌ OpenAI API Error after retries:`, error.message);
                    throw error;
                }

                // Wait before retry on other errors
                const waitTime = Math.pow(2, attempt) * 2000;

                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    /**
     * Save normalized data to database
     */
    async saveToDatabase(fileId, analysis) {
        const sql = `
            UPDATE llm_metadata SET
                -- Core fields with normalized values
                LLM_ERA = ?,
                AI_MOOD = ?,
                LLM_ENERGY_LEVEL = ?,
                LLM_DESCRIPTION = ?,
                LLM_CONTEXT = ?,

                -- Lyrics with normalized values
                LLM_LYRICS_THEME = ?,
                LLM_LYRICS_LANGUAGE = ?,
                LLM_EXPLICIT_CONTENT = ?,
                LLM_STORYTELLING = ?,

                -- DJ & Performance
                LLM_DJ_NOTES = ?,
                LLM_MIXING_NOTES = ?,
                LLM_OCCASIONS = ?,

                -- Production
                LLM_PRODUCTION_STYLE = ?,
                LLM_INSTRUMENTS = ?,

                -- Artists & Recommendations
                LLM_SIMILAR_ARTISTS = ?,
                LLM_RECOMMENDATIONS = ?,

                -- Flags
                LLM_IS_REMIX = ?,
                LLM_IS_COVER = ?,
                LLM_IS_LIVE = ?,

                -- Metadata
                LLM_ANALYZED = 1,
                LLM_ANALYSIS_DATE = datetime('now')

            WHERE file_id = ?
        ';

        const params = [
            // Core
            analysis.era,
            analysis.mood,
            analysis.energy_level,
            analysis.description,
            analysis.cultural_context,

            // Lyrics
            analysis.lyrics?.theme || '',
            analysis.lyrics?.language || 'Unknown',
            analysis.lyrics?.explicit ? 1 : 0,
            analysis.lyrics?.storytelling || 'Unknown',

            // DJ
            JSON.stringify(analysis.dj_notes || {}),
            analysis.dj_notes?.mix_with || '',
            // Convertir a JSON si es array/objeto, sino dejar como string
            typeof analysis.dj_notes?.best_for === 'object' 
                ? JSON.stringify(analysis.dj_notes.best_for) 
                : (analysis.dj_notes?.best_for || ''),

            // Production
            analysis.production?.style || '',
            analysis.production?.instruments || '',

            // Artists
            JSON.stringify(analysis.similar_artists || []),
            analysis.recommendations || '',

            // Flags
            analysis.flags?.is_remix ? 1 : 0,
            analysis.flags?.is_cover ? 1 : 0,
            analysis.flags?.is_live ? 1 : 0,

            fileId
        ];

        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err) reject(err);
                else {

                    resolve();
                }
            });
        });
    }

    /**
     * Analyze track with normalized values
     */
    async analyzeTrack(trackData) {
        // Si es un número, obtener info de BD. Si es objeto, usar directamente
        let track;
        let trackId;

        if (typeof trackData === 'number') {
            trackId = trackData;
            track = await this.getTrackInfo(trackId);
        } else if (typeof trackData === 'object' && trackData !== null) {
            trackId = trackData.id;
            track = trackData;
        } else {
            throw new Error('Invalid track data provided`);
        }

        try {
            // Build normalized prompt
            const prompt = this.buildNormalizedPrompt(track);

            const analysis = await this.callOpenAI(prompt);

            // Save to database
            await this.saveToDatabase(trackId, analysis);

            // Display normalized results

            return analysis;

        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get track info from database
     */
    async getTrackInfo(fileId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT af.*, lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            this.db.get(sql, [fileId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Batch analyze with normalized values
     */
    async batchAnalyze(limit = 10) {

        );

        // Get tracks needing analysis
        const tracks = await this.getTracksForAnalysis(limit);

        if (tracks.length === 0) {

            return;
        }

        const results = [];
        let success = 0;
        let failed = 0;

        for (const track of tracks) {
            try {
                const analysis = await this.analyzeTrack(track.id);
                results.push({ track_id: track.id, analysis });
                success++;

                // Rate limiting - increased to avoid 429 errors

                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                console.error(`Failed track ${track.id}: ${error.message}`);
                failed++;
            }
        }

        // Summary
        );

        // Show value distribution
        await this.showValueDistribution();

        return results;
    }

    /**
     * Get tracks for analysis
     */
    async getTracksForAnalysis(limit) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT af.id, af.title, af.artist, af.genre
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE lm.LLM_DESCRIPTION IS NULL
                   OR lm.LLM_ERA IS NULL
                   OR lm.AI_MOOD IS NULL
                ORDER BY 
                    CASE 
                        WHEN af.genre LIKE '%Pop%' THEN 1
                        WHEN af.genre LIKE '%Rock%' THEN 2
                        ELSE 3
                    END
                LIMIT ?
            ';

            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Show distribution of normalized values
     */
    async showValueDistribution() {

        );

        const fields = ['LLM_ERA', 'AI_MOOD', 'LLM_ENERGY_LEVEL', 'LLM_LYRICS_LANGUAGE`];

        for (const field of fields) {
            const distribution = await new Promise((resolve, reject) => {
                this.db.all(
                    `SELECT ${field} as value, COUNT(*) as count
                     FROM llm_metadata
                     WHERE ${field} IS NOT NULL
                     GROUP BY ${field}
                     ORDER BY count DESC
                     LIMIT 5`,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            distribution.forEach(row => {
                const bar = '█`.repeat(Math.min(20, Math.floor(row.count / 50)));
                } ${bar} ${row.count}`);
            });
        }
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const handler = new NormalizedLLMHandler();

    (async () => {
        await handler.init();

        const batchSize = parseInt(process.argv[2]) || 5;

        await handler.batchAnalyze(batchSize);

        handler.close();

    })().catch(console.error);
}

module.exports = { NormalizedLLMHandler };