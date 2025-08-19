/**
 * ENRICHMENT AI HANDLER
 * Enriquece los metadatos EXISTENTES con análisis contextual y descripciones
 * NO duplica datos que ya tenemos (BPM, Energy, Key, Mood, etc.)
 * 
 * ESTRATEGIA:
 * - USA los datos existentes como CONTEXTO
 * - ENFOCA en lo que falta: descripciones, contexto cultural, artistas similares
 * - OPTIMIZA tokens y costos al no re-analizar lo que ya sabemos
 */

const { ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Modelos optimizados para enriquecimiento
const MODELS = {
    ENRICHMENT: 'gpt-4-turbo-preview',  // Mejor para contexto rico
    FALLBACK: 'gpt-3.5-turbo'          // Backup económico
};

class EnrichmentAIHandler {
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
     * PROMPT OPTIMIZADO - USA DATOS EXISTENTES COMO CONTEXTO
     * No pide lo que ya tenemos, se enfoca en enriquecer
     */
    generateEnrichmentPrompt(track) {
        // Parse ISRC information
        let isrcContext = '';
        if (track.isrc && track.isrc.length === 12) {
            const country = track.isrc.substring(0, 2);
            const year = track.isrc.substring(5, 7);
            const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;

            const countryNames = {
                'US': 'United States',
                'GB': 'United Kingdom',
                'NL': 'Netherlands',
                'DE': 'Germany',
                'FR': 'France',
                'ES': 'Spain',
                'IT': 'Italy',
                'CA': 'Canada',
                'AU': 'Australia',
                'JP': 'Japan',
                'SE': 'Sweden',
                'NO': 'Norway'
            };

            isrcContext = `ISRC: ${track.isrc} (${countryNames[country] || country}, ${fullYear})\n`;
        }

        // Detectar características especiales
        const isRemix = track.title?.includes('Remix') || track.title?.includes('Mix');
        const isLive = track.title?.includes('Live') || track.AI_LIVENESS > 0.8;
        const isClassical = track.genre?.includes('Classical');
        const isJazz = track.genre?.includes('Jazz');
        const isCollaboration = track.title?.includes('feat') || track.artist?.includes('&');
        const isInstrumental = track.AI_INSTRUMENTALNESS > 0.5;

        // Contexto especial basado en datos existentes
        let specialContext = '';
        if (track.AI_ENERGY > 0.8) {
            specialContext += 'This is a high-energy track. ';
        }
        if (track.AI_DANCEABILITY > 0.7) {
            specialContext += 'This track is highly danceable. ';
        }
        if (track.AI_VALENCE > 0.7) {
            specialContext += 'The mood is positive and uplifting. ';
        } else if (track.AI_VALENCE < 0.3) {
            specialContext += 'The mood is melancholic or dark. ';
        }
        if (isRemix) {
            specialContext += 'This is a remix - analyze the remix approach. ';
        }
        if (isInstrumental) {
            specialContext += 'This appears to be instrumental. ';
        }

        return `Enrich this track's metadata with contextual analysis and descriptions.

TRACK INFORMATION:
Title: ${track.title || 'Unknown'}
Artist: ${track.artist || 'Unknown'}
Album: ${track.album || 'Unknown'}
Year: ${track.year || 'Unknown'}
${isrcContext}

EXISTING ANALYSIS (DO NOT RE-ANALYZE THESE):
Genre: ${track.LLM_GENRE || track.genre}
BPM: ${track.AI_BPM || track.bpm_llm || 'Unknown'}
Energy: ${track.AI_ENERGY ? (track.AI_ENERGY * 100).toFixed(0) + '%' : 'Unknown'}
Mood: ${track.AI_MOOD || track.mood || 'Unknown'}
Key: ${track.AI_KEY || 'Unknown'}
Danceability: ${track.AI_DANCEABILITY ? (track.AI_DANCEABILITY * 100).toFixed(0) + '%' : 'Unknown'}
Valence: ${track.AI_VALENCE ? (track.AI_VALENCE * 100).toFixed(0) + '%' : 'Unknown'}

${specialContext}

PROVIDE ONLY THESE ENRICHMENTS:

1. DESCRIPTION (2-3 sentences):
   - What makes this track unique or notable?
   - Describe the sound, style, and production characteristics
   - How does it fit within the artist's catalog or its era?

2. CULTURAL CONTEXT:
   - Historical significance or influence
   - Scene/movement it belongs to
   - Why this track matters in music history

3. SIMILAR ARTISTS (3-5 names only):
   - Artists with comparable style from the same era
   - Modern artists influenced by this sound
   - Format: "Artist1, Artist2, Artist3"

4. DJ/PLAYLIST NOTES:
   - Best mixed with what genres/moods?
   - Ideal placement in a set (opener/peak/closer)
   - Compatible BPM range for mixing

5. PRODUCTION NOTES:
   - Notable production techniques or signature sounds
   - Recording quality assessment
   - Any interesting production history

${isRemix ? '6. REMIX SPECIFICS:\n   - How does it transform the original?\n   - What genre/style does the remix bring?' : ''}
${isLive ? '6. LIVE PERFORMANCE NOTES:\n   - Venue/tour information if notable\n   - How it differs from studio version' : ''}
${isClassical ? '6. CLASSICAL CONTEXT:\n   - Composer and composition period\n   - Performance/interpretation notes' : ''}

Keep responses concise and factual. Focus on enriching, not repeating existing data.';
    }

    /**
     * PARSE Y ESTRUCTURA LA RESPUESTA DE ENRIQUECIMIENTO
     */
    parseEnrichmentResponse(text) {
        if (!text) return {};

        const sections = {
            description: '',
            cultural_context: '',
            similar_artists: [],
            dj_notes: '',
            production_notes: '',
            special_notes: ''
        };

        // Parse sections from response
        const lines = text.split('\n');
        let currentSection = '';

        for (const line of lines) {
            const lower = line.toLowerCase();

            // Detect section headers
            if (lower.includes('description') && lower.includes(':')) {
                currentSection = 'description';
            } else if (lower.includes('cultural') || lower.includes('context')) {
                currentSection = 'cultural_context';
            } else if (lower.includes('similar artist')) {
                currentSection = 'similar_artists';
            } else if (lower.includes('dj') || lower.includes('playlist')) {
                currentSection = 'dj_notes';
            } else if (lower.includes('production')) {
                currentSection = 'production_notes';
            } else if (lower.includes('remix') || lower.includes('live') || lower.includes('classical')) {
                currentSection = 'special_notes';
            } else if (line.trim() && currentSection) {
                // Add content to current section
                if (currentSection === 'similar_artists') {
                    // Parse comma-separated artists
                    if (line.includes(',')) {
                        sections.similar_artists = line.split(',').map(a => a.trim()).filter(a => a && !a.includes(':'));
                    } else if (!line.includes(':')) {
                        sections.similar_artists.push(line.trim());
                    }
                } else {
                    // Remove section numbers and clean
                    let cleanLine = line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim();
                    if (!cleanLine.endsWith(':')) {
                        sections[currentSection] += cleanLine + ' ';
                    }
                }
            }
        }

        // Clean up
        Object.keys(sections).forEach(key => {
            if (typeof sections[key] === 'string') {
                sections[key] = sections[key].trim();
            }
        });

        // Ensure similar_artists is limited to 5
        if (sections.similar_artists.length > 5) {
            sections.similar_artists = sections.similar_artists.slice(0, 5);
        }

        return sections;
    }

    /**
     * LLAMADA API OPTIMIZADA PARA ENRIQUECIMIENTO
     */
    async callOpenAI(prompt) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: MODELS.ENRICHMENT,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a music historian and DJ with deep knowledge of all genres, eras, and production techniques. Provide enriching context without repeating given information.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 600  // Optimizado para descripciones
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error('OpenAI call failed:', error);

            // Try fallback model

            return this.callFallback(prompt);
        }
    }

    /**
     * ENRICH SINGLE TRACK
     */
    async enrichTrack(fileId) {
        // Get existing data
        const track = await this.getTrackWithExistingData(fileId);

        if (!track) {
            throw new Error('Track not found');
        }

        }, Key=${track.AI_KEY}');

        try {
            // Generate enrichment prompt
            const prompt = this.generateEnrichmentPrompt(track);

            // Get enrichment from AI

            const response = await this.callOpenAI(prompt);

            // Parse response
            const enrichment = this.parseEnrichmentResponse(response);

            if (enrichment.description) {
                }...');
            }
            if (enrichment.similar_artists?.length > 0) {
                }`);
            }

            // Update database with enrichment only
            await this.updateDatabaseEnrichment(fileId, enrichment);

            return {
                fileId,
                title: track.title,
                artist: track.artist,
                existingData: {
                    bpm: track.AI_BPM,
                    energy: track.AI_ENERGY,
                    key: track.AI_KEY,
                    mood: track.AI_MOOD
                },
                enrichment
            };

        } catch (error) {
            console.error(`   ❌ Enrichment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * GET TRACK WITH ALL EXISTING DATA
     */
    async getTrackWithExistingData(fileId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.*,
                    lm.AI_BPM,
                    lm.AI_ENERGY,
                    lm.AI_KEY,
                    lm.AI_MOOD,
                    lm.AI_DANCEABILITY,
                    lm.AI_VALENCE,
                    lm.AI_ACOUSTICNESS,
                    lm.AI_INSTRUMENTALNESS,
                    lm.AI_SPEECHINESS,
                    lm.AI_LIVENESS,
                    lm.LLM_GENRE,
                    lm.bpm_llm,
                    lm.mood,
                    lm.LLM_DESCRIPTION,
                    lm.LLM_Similar_Artists
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
     * UPDATE DATABASE WITH ENRICHMENT ONLY
     * NO sobrescribe datos existentes
     */
    async updateDatabaseEnrichment(fileId, enrichment) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE llm_metadata SET
                    -- Only update enrichment fields
                    LLM_DESCRIPTION = COALESCE(LLM_DESCRIPTION, ?),
                    AI_CULTURAL_CONTEXT = COALESCE(AI_CULTURAL_CONTEXT, ?),
                    LLM_Similar_Artists = COALESCE(LLM_Similar_Artists, ?),
                    LLM_DJ_Notes = COALESCE(LLM_DJ_Notes, ?),
                    LLM_Production_Style = COALESCE(LLM_Production_Style, ?),
                    LLM_MIXING_NOTES = COALESCE(LLM_MIXING_NOTES, ?),

                    -- Update metadata
                    LLM_ANALYZED = 1,
                    LLM_ANALYSIS_DATE = datetime('now'),
                    llm_version = 'Enrichment-' || ?

                WHERE file_id = ?
            ';

            const params = [
                enrichment.description,
                enrichment.cultural_context,
                enrichment.similar_artists?.length > 0 ? JSON.stringify(enrichment.similar_artists) : null,
                enrichment.dj_notes,
                enrichment.production_notes,
                enrichment.special_notes,
                MODELS.ENRICHMENT,
                fileId
            ];

            this.db.run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * GET TRACKS THAT NEED ENRICHMENT
     * Tienen datos básicos pero les falta contexto
     */
    async getTracksNeedingEnrichment(limit = 100) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.id,
                    af.title,
                    af.artist,
                    lm.AI_BPM,
                    lm.AI_ENERGY,
                    lm.LLM_DESCRIPTION
                FROM audio_files af
                JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE 
                    -- Has basic data
                    (lm.AI_BPM IS NOT NULL OR lm.AI_ENERGY IS NOT NULL)
                    -- But lacks enrichment
                    AND (lm.LLM_DESCRIPTION IS NULL 
                         OR lm.LLM_Similar_Artists IS NULL
                         OR lm.AI_CULTURAL_CONTEXT IS NULL)
                ORDER BY 
                    -- Prioritize popular artists/genres
                    CASE 
                        WHEN af.genre LIKE '%Pop%' THEN 1
                        WHEN af.genre LIKE '%Rock%' THEN 2
                        WHEN af.genre LIKE '%Hip%' THEN 3
                        ELSE 4
                    END,
                    af.artist
                LIMIT ?
            ';

            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// Export
module.exports = { EnrichmentAIHandler };