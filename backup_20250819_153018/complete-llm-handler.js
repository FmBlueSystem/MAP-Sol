/**
 * COMPLETE LLM HANDLER
 * Análisis completo incluyendo letras y contexto cultural
 * Llena TODAS las columnas LLM relevantes
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODELS = {
    COMPLETE: 'gpt-4-turbo-preview',  // Para análisis completo
    LYRICS: 'gpt-4-turbo-preview'      // Para análisis de letras
};

class CompleteLLMHandler {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'music_analyzer.db');
        this.db = null;
        this.processedCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
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
     * PROMPT COMPLETO PARA ANÁLISIS INTEGRAL
     */
    buildCompletePrompt(track) {
        // Parse ISRC for geographic/temporal context
        let geoContext = '';
        if (track.isrc && track.isrc.length === 12) {
            const countryCode = track.isrc.substring(0, 2);
            const yearCode = track.isrc.substring(5, 7);
            const year = parseInt(yearCode) > 50 ? 1900 + parseInt(yearCode) : 2000 + parseInt(yearCode);

            const countries = {
                'US': 'United States',
                'GB': 'United Kingdom', 
                'DE': 'Germany',
                'FR': 'France',
                'ES': 'Spain',
                'MX': 'Mexico',
                'AR': 'Argentina'
            };

            geoContext = `Country: ${countries[countryCode] || countryCode} | Release Year: ${year}`;
        }

        return `Analyze this track comprehensively for a music database.

TRACK INFORMATION:
Title: ${track.title}
Artist: ${track.artist}
Album: ${track.album || 'Unknown'}
Year: ${track.year || 'Unknown'}
${geoContext}

EXISTING TECHNICAL DATA (already calculated):
Genre: ${track.LLM_GENRE || track.genre || 'Unknown'}
BPM: ${track.AI_BPM || 'Unknown'}
Energy: ${track.AI_ENERGY ? (track.AI_ENERGY * 100).toFixed(0) + '%' : 'Unknown'}
Key: ${track.AI_KEY || 'Unknown'}
Mood: ${track.AI_MOOD || 'Unknown'}

PROVIDE COMPREHENSIVE ANALYSIS:

1. DESCRIPTION (3-4 sentences):
   - Unique characteristics and sound signature
   - Production style and instrumentation
   - Place in artist's discography and genre evolution

2. LYRICS ANALYSIS (if applicable):
   - Main theme and narrative
   - Emotional tone and mood
   - Language (English/Spanish/etc)
   - Explicit content (Yes/No)
   - Storytelling style (Narrative/Abstract/Personal/Political)
   - Key phrases or memorable lines

3. CULTURAL CONTEXT:
   - Historical significance
   - Musical influences and predecessors
   - Artists/movements it influenced
   - Scene or subculture associations
   - Geographic origins and regional style

4. SIMILAR ARTISTS (5-7 names):
   - Contemporary peers
   - Musical influences
   - Artists they influenced
   - Format: "Artist1, Artist2, Artist3"

5. DJ/PERFORMANCE NOTES:
   - Mix compatibility (genres/moods)
   - Set placement (warm-up/peak-time/closing)
   - Energy flow and crowd response
   - Compatible BPM ranges for mixing
   - Harmonic mixing suggestions

6. PRODUCTION ANALYSIS:
   - Notable production techniques
   - Signature sounds or effects
   - Recording quality and mastering
   - Instruments and vocal style
   - Producer credits if notable

7. CONTEXTUAL FLAGS:
   - Is this a remix? (Yes/No)
   - Is this a cover? (Yes/No)
   - Is this a live recording? (Yes/No)
   - Is this a compilation track? (Yes/No)

8. ERA AND STYLE:
   - Musical era (e.g., "Early 90s House")
   - Subgenres (up to 3)
   - Style period in artist's career
   - Original vs release era if different

9. RECOMMENDATIONS:
   - If you like this, try...
   - Works well in playlists for...
   - Occasions/activities suited for

Keep analysis factual, specific, and useful for DJs, music historians, and playlist curators.';
    }

    /**
     * PARSE RESPUESTA COMPLETA EN ESTRUCTURA
     */
    parseCompleteResponse(text) {
        if (!text) return {};

        const result = {
            // Descripciones y contexto
            description: '',
            lyrics_analysis: '',
            lyrics_theme: '',
            lyrics_mood: '',
            lyrics_language: 'Unknown',
            explicit_content: 0,
            storytelling: 'Unknown',

            // Contexto cultural
            cultural_context: '',
            musical_influence: '',

            // Artistas y recomendaciones
            similar_artists: [],
            recommendations: '',

            // DJ/Performance
            dj_notes: '',
            mixing_notes: '',
            compatible_genres: '',
            occasions: '',

            // Producción
            production_style: '',
            instruments: '',
            vocal_style: '',

            // Clasificación
            is_remix: 0,
            is_cover: 0,
            is_live: 0,
            is_compilation: 0,

            // Era y estilo
            era: '',
            subgenres: '',
            style_period: ''
        };

        const lines = text.split('\n');
        let currentSection = '';
        let sectionContent = '';

        for (const line of lines) {
            const lower = line.toLowerCase();

            // Detectar secciones
            if (lower.includes('description') && line.includes(':')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'description';
                sectionContent = '';
            } else if (lower.includes('lyrics analysis')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'lyrics';
                sectionContent = '';
            } else if (lower.includes('cultural context')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'cultural';
                sectionContent = '';
            } else if (lower.includes('similar artist')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'similar';
                sectionContent = '';
            } else if (lower.includes('dj') || lower.includes('performance')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'dj';
                sectionContent = '';
            } else if (lower.includes('production')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'production';
                sectionContent = '';
            } else if (lower.includes('contextual flag')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'flags';
                sectionContent = '';
            } else if (lower.includes('era') && lower.includes('style')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'era';
                sectionContent = '';
            } else if (lower.includes('recommendation')) {
                if (currentSection && sectionContent) {
                    this.assignToResult(result, currentSection, sectionContent);
                }
                currentSection = 'recommendations';
                sectionContent = '';
            } else if (line.trim() && !line.includes('---')) {
                // Agregar contenido a la sección actual
                sectionContent += line + '\n';
            }
        }

        // Procesar última sección
        if (currentSection && sectionContent) {
            this.assignToResult(result, currentSection, sectionContent);
        }

        return result;
    }

    /**
     * ASIGNAR CONTENIDO PARSEADO A RESULTADO
     */
    assignToResult(result, section, content) {
        const cleanContent = content.trim();

        switch(section) {
            case 'description':
                result.description = cleanContent.replace(/^[-\d\.]\s*/gm, '').trim();
                break;

            case 'lyrics':
                const lyricsLines = cleanContent.split('\n');
                lyricsLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('theme')) {
                        result.lyrics_theme = line.split(':').pop()?.trim() || '';
                    } else if (lower.includes('emotional') || lower.includes('mood')) {
                        result.lyrics_mood = line.split(':').pop()?.trim() || '';
                    } else if (lower.includes('language')) {
                        result.lyrics_language = line.split(':').pop()?.trim() || 'Unknown';
                    } else if (lower.includes('explicit')) {
                        result.explicit_content = lower.includes('yes') ? 1 : 0;
                    } else if (lower.includes('storytelling')) {
                        result.storytelling = line.split(':').pop()?.trim() || 'Unknown';
                    } else if (!lower.includes(':')) {
                        result.lyrics_analysis += line + ' ';
                    }
                });
                break;

            case 'cultural':
                const culturalLines = cleanContent.split('\n');
                culturalLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('influence')) {
                        result.musical_influence += line + ' ';
                    } else {
                        result.cultural_context += line + ' ';
                    }
                });
                break;

            case 'similar':
                // Parse comma-separated artists
                const artistLine = cleanContent.replace(/^[-\d\.]\s*/gm, '');
                if (artistLine.includes(',')) {
                    result.similar_artists = artistLine.split(',')
                        .map(a => a.trim())
                        .filter(a => a && !a.includes(':'))
                        .slice(0, 7);
                }
                break;

            case 'dj':
                const djLines = cleanContent.split('\n');
                djLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('mix') || lower.includes('compatible')) {
                        result.mixing_notes += line + ' ';
                        if (lower.includes('genre')) {
                            result.compatible_genres = line.split(':').pop()?.trim() || '';
                        }
                    } else if (lower.includes('placement') || lower.includes('set')) {
                        result.dj_notes += line + ' ';
                    } else if (lower.includes('occasion')) {
                        result.occasions = line.split(':').pop()?.trim() || '';
                    }
                });
                break;

            case 'production':
                const prodLines = cleanContent.split('\n');
                prodLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('instrument')) {
                        result.instruments = line.split(':').pop()?.trim() || '';
                    } else if (lower.includes('vocal')) {
                        result.vocal_style = line.split(':').pop()?.trim() || '';
                    } else {
                        result.production_style += line + ' ';
                    }
                });
                break;

            case 'flags':
                const flagLines = cleanContent.split('\n');
                flagLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('remix')) {
                        result.is_remix = lower.includes('yes') ? 1 : 0;
                    } else if (lower.includes('cover')) {
                        result.is_cover = lower.includes('yes') ? 1 : 0;
                    } else if (lower.includes('live')) {
                        result.is_live = lower.includes('yes') ? 1 : 0;
                    } else if (lower.includes('compilation')) {
                        result.is_compilation = lower.includes('yes') ? 1 : 0;
                    }
                });
                break;

            case 'era':
                const eraLines = cleanContent.split('\n');
                eraLines.forEach(line => {
                    const lower = line.toLowerCase();
                    if (lower.includes('musical era')) {
                        result.era = line.split(':').pop()?.trim() || '';
                    } else if (lower.includes('subgenre')) {
                        result.subgenres = line.split(':').pop()?.trim() || '';
                    } else if (lower.includes('style period')) {
                        result.style_period = line.split(':').pop()?.trim() || '';
                    }
                });
                break;

            case 'recommendations':
                result.recommendations = cleanContent.replace(/^[-\d\.]\s*/gm, '').trim();
                break;
        }
    }

    /**
     * LLAMADA API PARA ANÁLISIS COMPLETO
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
                    model: MODELS.COMPLETE,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a comprehensive music analyst with expertise in lyrics, production, cultural history, and DJ performance. Provide detailed, factual analysis.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.4,
                    max_tokens: 1000  // Más tokens para análisis completo
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error('❌ OpenAI API Error:', error.message);
            throw error;
        }
    }

    /**
     * GUARDAR ANÁLISIS COMPLETO EN BASE DE DATOS
     */
    async saveCompleteToDB(fileId, analysis) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE llm_metadata SET
                    -- Descripciones principales
                    LLM_DESCRIPTION = ?,
                    LLM_CONTEXT = ?,

                    -- Análisis de letras
                    LLM_LYRICS_ANALYSIS = ?,
                    LLM_LYRICS_THEME = ?,
                    LLM_LYRICS_MOOD = ?,
                    LLM_LYRICS_LANGUAGE = ?,
                    LLM_EXPLICIT_CONTENT = ?,
                    LLM_STORYTELLING = ?,

                    -- Contexto cultural e histórico
                    LLM_CONTEXT = ?,
                    LLM_MUSICAL_INFLUENCE = ?,

                    -- Artistas y recomendaciones
                    LLM_SIMILAR_ARTISTS = ?,
                    LLM_RECOMMENDATIONS = ?,

                    -- DJ y performance
                    LLM_DJ_NOTES = ?,
                    LLM_MIXING_NOTES = ?,
                    LLM_COMPATIBLE_GENRES = ?,
                    LLM_OCCASIONS = ?,

                    -- Producción
                    LLM_PRODUCTION_STYLE = ?,
                    LLM_INSTRUMENTS = ?,
                    LLM_VOCAL_STYLE = ?,

                    -- Flags de clasificación
                    LLM_IS_REMIX = ?,
                    LLM_IS_COVER = ?,
                    LLM_IS_COMPILATION = ?,

                    -- Era y estilo
                    LLM_ERA = ?,
                    LLM_SUBGENRES = ?,
                    LLM_STYLE_PERIOD = ?,

                    -- Metadata
                    LLM_ANALYZED = 1,
                    LLM_ANALYSIS_DATE = datetime('now'),
                    llm_version = ?

                WHERE file_id = ?
            ';

            const params = [
                // Descripciones
                analysis.description,
                analysis.cultural_context,

                // Letras
                analysis.lyrics_analysis,
                analysis.lyrics_theme,
                analysis.lyrics_mood,
                analysis.lyrics_language,
                analysis.explicit_content,
                analysis.storytelling,

                // Contexto
                analysis.cultural_context,
                analysis.musical_influence,

                // Artistas
                JSON.stringify(analysis.similar_artists),
                analysis.recommendations,

                // DJ
                analysis.dj_notes,
                analysis.mixing_notes,
                analysis.compatible_genres,
                analysis.occasions,

                // Producción
                analysis.production_style,
                analysis.instruments,
                analysis.vocal_style,

                // Flags
                analysis.is_remix,
                analysis.is_cover,
                analysis.is_compilation,

                // Era
                analysis.era,
                analysis.subgenres,
                analysis.style_period,

                // Metadata
                'Complete-GPT4',
                fileId
            ];

            this.db.run(sql, params, (err) => {
                if (err) {
                    console.error('DB Error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * ANALIZAR UN TRACK COMPLETAMENTE
     */
    async analyzeTrackComplete(trackId) {
        // Get track info
        const track = await this.getTrackInfo(trackId);

        try {
            // Build and send prompt
            const prompt = this.buildCompletePrompt(track);

            const response = await this.callOpenAI(prompt);

            // Parse response
            const analysis = this.parseCompleteResponse(response);

            // Save to database
            await this.saveCompleteToDB(trackId, analysis);

            this.successCount++;

            // Show sample results
            if (analysis.similar_artists?.length > 0) {
                }');
            }
            if (analysis.lyrics_theme) {

            }
            if (analysis.era) {

            }

            return analysis;

        } catch (error) {
            this.errorCount++;

            throw error;
        } finally {
            this.processedCount++;
        }
    }

    /**
     * GET TRACK INFO
     */
    async getTrackInfo(fileId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.*,
                    lm.*
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
     * BATCH ANÁLISIS COMPLETO
     */
    async batchAnalyzeComplete(limit = 10) {

        );

        // Get tracks needing complete analysis
        const tracks = await this.getTracksNeedingCompleteAnalysis(limit);

        if (tracks.length === 0) {

            return;
        }

        const results = [];
        for (const track of tracks) {
            try {
                const analysis = await this.analyzeTrackComplete(track.id);
                results.push({
                    track_id: track.id,
                    title: track.title,
                    artist: track.artist,
                    analysis
                });

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                console.error(`Failed to analyze track ${track.id}:`, error.message);
            }
        }

        // Summary
        );

        const estimatedCost = this.successCount * 0.01; // ~$0.01 per complete analysis
        }`);

        return results;
    }

    /**
     * GET TRACKS NEEDING COMPLETE ANALYSIS
     */
    async getTracksNeedingCompleteAnalysis(limit) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    af.id,
                    af.title,
                    af.artist,
                    af.genre
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE 
                    -- Has basic genre
                    lm.LLM_GENRE IS NOT NULL
                    -- But lacks complete analysis
                    AND (
                        lm.LLM_DESCRIPTION IS NULL
                        OR lm.LLM_LYRICS_ANALYSIS IS NULL
                        OR lm.LLM_SIMILAR_ARTISTS IS NULL
                        OR lm.LLM_CONTEXT IS NULL
                        OR lm.LLM_DJ_NOTES IS NULL
                    )
                ORDER BY 
                    -- Prioritize popular genres
                    CASE 
                        WHEN af.genre LIKE '%Pop%' THEN 1
                        WHEN af.genre LIKE '%Rock%' THEN 2
                        WHEN af.genre LIKE '%House%' THEN 3
                        WHEN af.genre LIKE '%Hip%' THEN 4
                        ELSE 5
                    END,
                    RANDOM()
                LIMIT ?
            ';

            this.db.all(sql, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const handler = new CompleteLLMHandler();

    (async () => {
        await handler.init();

        // Get batch size from command line or use default
        const batchSize = parseInt(process.argv[2]) || 5;

        await handler.batchAnalyzeComplete(batchSize);

        handler.close();

    })().catch(console.error);
}

module.exports = { CompleteLLMHandler };