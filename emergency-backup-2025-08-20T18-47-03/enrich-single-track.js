#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * ENRICH SINGLE TRACK
 * Enriquece un archivo específico con análisis AI completo
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

async function analyzeTrack(track) {
    logDebug('\n📝 Analizando track:');
    logDebug(`   Artista: ${track.artist}\`); logDebug(\`   Título: ${track.title}`); logDebug(`   Álbum: ${track.album}\`); logDebug(\`   Género actual: ${track.genre}`); logDebug(`   BPM: ${track.existing_bmp}\`); logDebug(\`   Key: ${track.existing_key}`);
    logDebug(); const prompt  = `Analyze this 80s pop/dance track and provide detailed metadata:;

Artist: ${track.artist}
Title: ${track.title}
Album: ${track.album}
Current Genre: ${track.genre}
Year: ${track.year}
BPM: ${track.existing_bmp}
Key: 2B

This is Cyndi Lauper\`s iconic 1983 hit \`Girls Just Want to Have Fun` in its extended 12` dance version. It`s a new wave/synth-pop anthem about female empowerment and independence.

Provide a JSON response with:
{
    "genre": "specific genre",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood (Energetic, Happy, Uplifting, etc.)",
    "energy": 0.0-1.0 (this is high energy dance version),
    "danceability": 0.0-1.0 (very danceable),
    "valence": 0.0-1.0 (positive/happy feeling),
    "acousticness": 0.0-1.0 (electronic/synth heavy),
    "instrumentalness": 0.0-1.0 (has vocals),
    "liveness": 0.0-1.0,
    "speechiness": 0.0-1.0,
    "loudness": -60 to 0 dB,
    "era": "1980s",
    "cultural_context": "American new wave/synth-pop",
    "occasions": ["party", "dance", "celebration"], "tempo_description": "fast, upbeat", "description`: `2-3 sentence description`
} Respond ONLY with valid JSON.`;

    logDebug('🤖 Enviando a OpenAI...\n');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type`: `application/json\`, Authorization: \`Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a music analysis expert specializing in 1980s pop and dance music.'
                    }, { role: \`user\`, content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        let content = data.choices[0].message.content;

        // Clean markdown formatting if present content = content .replace(/``\`json\n?/g, \``) .replace(/`\`\`\n?/g, '')
            .trim();

        const analysis = JSON.parse(content);

        logInfo('✅ ANÁLISIS COMPLETADO:');
        logDebug('='.repeat(60));
        logDebug(JSON.stringify(analysis, null, 2));
        logDebug('='.repeat(60));

        return analysis;
    } catch (error) { logError('❌ Error:', error.message);
        return null;
    }
}

async function updateDatabase(db, fileId, analysis) {
    return new Promise((resolve, reject) => {
        // Primero verificar si existe registro en llm_metadata db.get(`SELECT * FROM llm_metadata WHERE file_id = ?\`, [fileId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (row) { // Actualizar registro existente const updateQuery = \`;
                    UPDATE llm_metadata SET
                        LLM_GENRE = ?,
                        LLM_SUBGENRES = ?,
                        AI_MOOD = ?,
                        AI_ENERGY = ?,
                        AI_DANCEABILITY = ?,
                        AI_VALENCE = ?,
                        AI_ACOUSTICNESS = ?,
                        AI_INSTRUMENTALNESS = ?,
                        AI_LIVENESS = ?,
                        AI_SPEECHINESS = ?,
                        AI_LOUDNESS = ?,
                        LLM_ERA = ?,
                        LLM_CONTEXT = ?,
                        LLM_OCCASIONS = ?,
                        LLM_DESCRIPTION = ?,
                        LLM_ENERGY_DESCRIPTION = ?,
                        AI_ANALYZED = 1,
                        LLM_ANALYZED = 1,
                        analysis_timestamp = datetime('now')
                    WHERE file_id = ?
                ';

                db.run(
                    updateQuery,
                    [
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0,
                        analysis.instrumentalness || 0,
                        analysis.liveness || 0,
                        analysis.speechiness || 0,
                        analysis.loudness || -10,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description,
                        fileId
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else { logDebug(`\n💾 Metadatos AI actualizados en la base de datos\`);
                            resolve();
                        }
                    }
                );
            } else { // Insertar nuevo registro const insertQuery = \`;
                    INSERT INTO llm_metadata (
                        file_id,
                        LLM_GENRE,
                        LLM_SUBGENRES,
                        AI_MOOD,
                        AI_ENERGY,
                        AI_DANCEABILITY,
                        AI_VALENCE,
                        AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS,
                        AI_LIVENESS,
                        AI_SPEECHINESS,
                        AI_LOUDNESS,
                        LLM_ERA,
                        LLM_CONTEXT,
                        LLM_OCCASIONS,
                        LLM_DESCRIPTION,
                        LLM_ENERGY_DESCRIPTION,
                        AI_ANALYZED,
                        LLM_ANALYZED,
                        analysis_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
                ';

                db.run(
                    insertQuery,
                    [
                        fileId,
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0,
                        analysis.instrumentalness || 0,
                        analysis.liveness || 0,
                        analysis.speechiness || 0,
                        analysis.loudness || -10,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else {
                            logDebug('\n💾 Nuevos metadatos AI guardados en la base de datos');
                            resolve();
                        }
                    }
                );
            }
        });
    });
}

// Main execution
const db = new sqlite3.Database('./music_analyzer.db');

const filePath = '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Cyndi Lauper - Girls Just Want to Have Fun (12 Version).flac\';
 logDebug(\`
🎵 ENRIQUECIMIENTO DE TRACK CON AI ${`=`.repeat(60)}\`);

// Obtener información del track db.get( \`
    SELECT 
        id,
        file_path,
        title,
        artist,
        album,
        genre,
        year,
        existing_bmp,
        existing_key
    FROM audio_files
    WHERE file_path = ?
`,
    [filePath],
    async (err, track) => {
        if (err) {
            logError('Error:', err);
            db.close();
            return;
        }

        if (!track) {
            logError('❌ Archivo no encontrado en la base de datos');
            db.close();
            return;
        }

        // Decodificar mixing key
        if (track.existing_key) {
            try {
                const decoded = Buffer.from(track.existing_key, 'base64').toString('utf8');
                const parsed = JSON.parse(decoded);
                track.existing_key = parsed.key;
            } catch { track.existing_key = '2B';
            }
        }

        const analysis = await analyzeTrack(track);

        if (analysis) {
            await updateDatabase(db, track.id, analysis);
 logDebug(\`\n📊 RESUMEN:\`); logDebug(`   Archivo: ${track.title}`); logDebug(\`   Género AI: ${analysis.genre}\`); logDebug(`   Mood: ${analysis.mood}`); logDebug(\`   Energy: ${analysis.energy}\`); logDebug(`   Danceability: ${analysis.danceability}`); logDebug(\`   Valence: ${analysis.valence}\`); logDebug(`\n✅ Track enriquecido exitosamente!`);
        }

        db.close();
    }
);
