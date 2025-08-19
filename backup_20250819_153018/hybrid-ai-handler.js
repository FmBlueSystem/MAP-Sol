/**
 * HYBRID AI ANALYSIS HANDLER
 * Combina GPT-4 Turbo (para JSON estructurado) con GPT-5 (para análisis profundo)
 * 
 * FLUJO DE ANÁLISIS:
 * 1. GPT-4 Turbo → Metadatos estructurados (JSON confiable)
 * 2. GPT-5 → Análisis contextual profundo y descripciones
 * 3. Merge → Combina ambos resultados en la BD
 */

const { ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Modelos híbridos
const MODELS = {
    STRUCTURED: 'gpt-4-turbo-preview',  // Para JSON confiable
    CREATIVE: 'gpt-5-mini',              // Para análisis profundo
    FALLBACK: 'gpt-3.5-turbo'           // Backup si falla
};

class HybridAIHandler {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'music_analyzer.db');
        this.db = null;

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
     * PASO 1: ANÁLISIS ESTRUCTURADO CON GPT-4
     * Obtiene metadatos técnicos en JSON perfecto
     */
    generateStructuredPrompt(metadata) {
        return `Analyze this music track and return ONLY valid JSON:

Title: ${metadata.title || 'Unknown'}
Artist: ${metadata.artist || 'Unknown'}
Album: ${metadata.album || 'Unknown'}
Genre: ${metadata.genre || 'Unknown'}
Year: ${metadata.year || 'Unknown'}
Duration: ${metadata.duration ? Math.round(metadata.duration) + 's' : 'Unknown'}

Return EXACTLY this JSON structure:
{
    "genre": "primary genre",
    "subgenres": ["subgenre1", "subgenre2", "subgenre3"],
    "mood": "primary mood",
    "energy": 0.0-1.0,
    "danceability": 0.0-1.0,
    "valence": 0.0-1.0,
    "acousticness": 0.0-1.0,
    "instrumentalness": 0.0-1.0,
    "speechiness": 0.0-1.0,
    "liveness": 0.0-1.0,
    "bpm_estimated": integer 60-200,
    "key": "musical key",
    "time_signature": "4/4",
    "era": "decade or period",
    "vocal_type": "male/female/instrumental/mixed",
    "production_quality": "lo-fi/standard/hi-fi/professional"
}";
    }

    /**
     * PASO 2: ANÁLISIS CREATIVO CON GPT-5
     * Obtiene descripciones profundas y contexto cultural
     */
    generateCreativePrompt(metadata, structuredData) {
        // Casos especiales para tracks difíciles
        const isRemix = metadata.title?.includes('Remix') || metadata.title?.includes('Mix');
        const isClassical = metadata.genre?.includes('Classical');
        const isJazz = metadata.genre?.includes('Jazz');
        const isCollaboration = metadata.title?.includes('feat') || metadata.title?.includes('&');
        const isMultiGenre = metadata.genre?.includes('/') || metadata.genre?.includes('&');

        let specialContext = '';
        if (isRemix) {
            specialContext = 'This is a remix. Analyze both the original composition and the remix treatment. ';
        }
        if (isClassical) {
            specialContext += 'This is classical music. Consider the composer, period, and orchestration. ';
        }
        if (isJazz) {
            specialContext += 'This is jazz. Analyze improvisation, swing, harmony complexity. ';
        }
        if (isCollaboration) {
            specialContext += 'This is a collaboration. Analyze how the artists complement each other. ';
        }
        if (isMultiGenre) {
            specialContext += 'This blends multiple genres. Identify the fusion elements. ';
        }

        return `Provide a deep musical and cultural analysis of this track:

TRACK INFO:
Title: ${metadata.title}
Artist: ${metadata.artist}
Album: ${metadata.album}
Genre: ${metadata.genre}
Year: ${metadata.year}

INITIAL ANALYSIS:
Primary Genre: ${structuredData?.genre}
Mood: ${structuredData?.mood}
Energy: ${structuredData?.energy}
Key: ${structuredData?.key}

${specialContext}

Provide a detailed analysis covering:

1. MUSICAL DESCRIPTION (2-3 sentences):
   - Describe the sonic characteristics, instrumentation, and production style
   - What makes this track unique or notable?

2. CULTURAL CONTEXT:
   - Historical significance or influence
   - Scene/movement it belongs to
   - Regional or cultural origins

3. EMOTIONAL JOURNEY:
   - How does the track evolve emotionally?
   - What feelings does it evoke?

4. SIMILAR ARTISTS (3-5):
   - Artists with similar style or from same era

5. IDEAL OCCASIONS:
   - When/where would this track work best?
   - What activities or moods does it suit?

6. DJ/MIXING NOTES:
   - Compatible genres for mixing
   - Energy flow considerations
   - Key compatibility suggestions

7. PRODUCTION ANALYSIS:
   - Recording quality and techniques
   - Notable production elements
   - Era-specific characteristics

${isRemix ? '8. REMIX ANALYSIS:\n   - How does it differ from the original?\n   - What elements were added/changed?' : ''}
${isClassical ? '8. CLASSICAL ELEMENTS:\n   - Compositional structure\n   - Performance interpretation' : ''}
${isJazz ? '8. JAZZ ELEMENTS:\n   - Improvisation quality\n   - Harmonic complexity' : ''}

Format your response as clear paragraphs, not JSON.';
    }

    /**
     * LLAMADA A OPENAI API
     */
    async callOpenAI(model, prompt, expectJSON = false) {
        const isGPT5 = model.includes('gpt-5');

        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: expectJSON 
                        ? 'You are a music metadata API. Return only valid JSON.'
                        : 'You are a professional music critic and analyst with deep knowledge of all genres and eras.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        // Model-specific parameters
        if (expectJSON) {
            requestBody.response_format = { type: "json_object" };
        }

        if (isGPT5) {
            requestBody.max_completion_tokens = expectJSON ? 400 : 800;
            requestBody.temperature = 1;
        } else {
            requestBody.max_tokens = expectJSON ? 400 : 800;
            requestBody.temperature = expectJSON ? 0.3 : 0.7;
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            if (expectJSON) {
                try {
                    return JSON.parse(content);
                } catch (e) {
                    console.error('Failed to parse JSON:', content);
                    throw new Error('Invalid JSON response');
                }
            }

            return content;

        } catch (error) {
            console.error(`${model} API call failed:`, error);
            throw error;
        }
    }

    /**
     * ANÁLISIS HÍBRIDO COMPLETO
     */
    async analyzeTrackHybrid(fileId) {
        // Get track metadata
        const track = await this.getTrackMetadata(fileId);

        if (!track) {
            throw new Error('Track not found');
        }

        );

        let structuredData = null;
        let creativeAnalysis = null;
        let errors = [];

        // STEP 1: Structured Analysis (GPT-4)
        try {

            const structuredPrompt = this.generateStructuredPrompt(track);
            structuredData = await this.callOpenAI(MODELS.STRUCTURED, structuredPrompt, true);

        } catch (error) {
            console.error('   ❌ Structured analysis failed:', error.message);
            errors.push({ step: 'structured', error: error.message });
        }

        // STEP 2: Creative Analysis (GPT-5)
        try {

            const creativePrompt = this.generateCreativePrompt(track, structuredData);
            creativeAnalysis = await this.callOpenAI(MODELS.CREATIVE, creativePrompt, false);

            // Parse creative text into sections
            const sections = this.parseCreativeAnalysis(creativeAnalysis);
            creativeAnalysis = sections;

        } catch (error) {
            console.error('   ❌ Creative analysis failed:', error.message);
            errors.push({ step: 'creative', error: error.message });

            // Fallback to GPT-3.5
            try {

                const creativePrompt = this.generateCreativePrompt(track, structuredData);
                creativeAnalysis = await this.callOpenAI(MODELS.FALLBACK, creativePrompt, false);
                creativeAnalysis = this.parseCreativeAnalysis(creativeAnalysis);
            } catch (fallbackError) {
                errors.push({ step: 'fallback', error: fallbackError.message });
            }
        }

        // STEP 3: Merge and Save

        const mergedData = this.mergeAnalysisResults(structuredData, creativeAnalysis);

        // STEP 4: Update Database
        await this.updateDatabase(fileId, mergedData);

        );

        return {
            fileId,
            track: {
                title: track.title,
                artist: track.artist
            },
            structured: structuredData,
            creative: creativeAnalysis,
            merged: mergedData,
            errors
        };
    }

    /**
     * PARSE CREATIVE TEXT INTO STRUCTURED SECTIONS
     */
    parseCreativeAnalysis(text) {
        if (!text) return {};

        const sections = {
            description: '',
            cultural_context: '',
            emotional_journey: '',
            similar_artists: [],
            occasions: [],
            dj_notes: '',
            production_notes: '',
            special_analysis: ''
        };

        // Simple parsing by looking for section headers
        const lines = text.split('\n');
        let currentSection = 'description';

        for (const line of lines) {
            const lower = line.toLowerCase();

            if (lower.includes('cultural context') || lower.includes('historical')) {
                currentSection = 'cultural_context';
            } else if (lower.includes('emotional') || lower.includes('journey')) {
                currentSection = 'emotional_journey';
            } else if (lower.includes('similar artist')) {
                currentSection = 'similar_artists';
            } else if (lower.includes('occasion') || lower.includes('when')) {
                currentSection = 'occasions';
            } else if (lower.includes('dj') || lower.includes('mixing')) {
                currentSection = 'dj_notes';
            } else if (lower.includes('production') || lower.includes('recording')) {
                currentSection = 'production_notes';
            } else if (lower.includes('remix') || lower.includes('classical') || lower.includes('jazz')) {
                currentSection = 'special_analysis';
            } else if (line.trim()) {
                if (currentSection === 'similar_artists' || currentSection === 'occasions') {
                    if (line.includes('-') || line.includes('•')) {
                        sections[currentSection].push(line.replace(/[-•]/g, '').trim());
                    }
                } else {
                    sections[currentSection] += line + ' ';
                }
            }
        }

        // Clean up
        Object.keys(sections).forEach(key => {
            if (typeof sections[key] === 'string') {
                sections[key] = sections[key].trim();
            }
        });

        return sections;
    }

    /**
     * MERGE STRUCTURED AND CREATIVE RESULTS
     */
    mergeAnalysisResults(structured, creative) {
        return {
            // From structured (GPT-4)
            genre: structured?.genre || null,
            subgenres: structured?.subgenres || [],
            mood: structured?.mood || null,
            energy: structured?.energy || null,
            danceability: structured?.danceability || null,
            valence: structured?.valence || null,
            acousticness: structured?.acousticness || null,
            instrumentalness: structured?.instrumentalness || null,
            speechiness: structured?.speechiness || null,
            liveness: structured?.liveness || null,
            bpm: structured?.bpm_estimated || null,
            key: structured?.key || null,
            time_signature: structured?.time_signature || null,
            era: structured?.era || null,
            vocal_type: structured?.vocal_type || null,
            production_quality: structured?.production_quality || null,

            // From creative (GPT-5)
            description: creative?.description || null,
            cultural_context: creative?.cultural_context || null,
            emotional_journey: creative?.emotional_journey || null,
            similar_artists: creative?.similar_artists || [],
            occasions: creative?.occasions || [],
            dj_notes: creative?.dj_notes || null,
            production_notes: creative?.production_notes || null,
            special_analysis: creative?.special_analysis || null,

            // Metadata
            analysis_timestamp: new Date().toISOString(),
            models_used: {
                structured: MODELS.STRUCTURED,
                creative: MODELS.CREATIVE
            }
        };
    }

    /**
     * GET TRACK METADATA FROM DATABASE
     */
    async getTrackMetadata(fileId) {
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
     * UPDATE DATABASE WITH HYBRID ANALYSIS
     */
    async updateDatabase(fileId, data) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE llm_metadata SET
                    -- Structured data (GPT-4)
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
                    AI_BPM = ?,
                    AI_KEY = ?,
                    AI_TIME_SIGNATURE = ?,
                    AI_ERA = ?,

                    -- Creative data (GPT-5)
                    LLM_DESCRIPTION = ?,
                    AI_CULTURAL_CONTEXT = ?,
                    LLM_Similar_Artists = ?,
                    AI_OCCASION = ?,
                    LLM_DJ_Notes = ?,
                    LLM_Production_Style = ?,

                    -- Metadata
                    LLM_ANALYZED = 1,
                    AI_ANALYZED = 1,
                    LLM_ANALYSIS_DATE = datetime('now'),
                    AI_ANALYZED_DATE = datetime('now'),
                    llm_version = ?
                WHERE file_id = ?
            ';

            const params = [
                // Structured
                data.genre,
                JSON.stringify(data.subgenres),
                data.mood,
                data.energy,
                data.danceability,
                data.valence,
                data.acousticness,
                data.instrumentalness,
                data.speechiness,
                data.liveness,
                data.bpm,
                data.key,
                data.time_signature,
                data.era,

                // Creative
                data.description,
                data.cultural_context,
                JSON.stringify(data.similar_artists),
                JSON.stringify(data.occasions),
                data.dj_notes,
                data.production_notes,

                // Metadata
                `Hybrid-${MODELS.STRUCTURED}+${MODELS.CREATIVE}`,
                fileId
            ];

            this.db.run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// Export for use in main.js
module.exports = { HybridAIHandler };