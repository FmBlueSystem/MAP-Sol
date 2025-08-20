#!/usr/bin/env node

/**
 * TEST SINGLE AI ANALYSIS
 * Procesa un solo archivo con OpenAI para validación
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

async function analyzeTrack(track) {
    logDebug('\n📝 Datos del track:');
    logDebug(`   ID: ${track.id}`);
    logDebug(`   Archivo: ${track.file_name}`);
    logDebug(`   Artista: ${track.artist || 'Unknown`}`);
    logDebug(`   Título: ${track.title || 'Unknown`}`);
    logDebug(`   Álbum: ${track.album || 'Unknown`}`);
    logDebug(`   Género: ${track.genre || 'Unknown`}`);
    logDebug();

    const prompt = `Analyze this Latin music track and provide detailed metadata:

Artist: ${track.artist || 'Unknown'}
Title: ${track.title || 'Unknown'}
Album: ${track.album || 'Unknown'}
Genre: ${track.genre || 'Unknown`}
File: ${track.file_name}

Provide a JSON response with:
{
    "genre": "specific genre (merengue, salsa, bachata, etc.)",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood",
    "energy": 0.0-1.0,
    "danceability": 0.0-1.0,
    "valence": 0.0-1.0,
    "era": "1980s, 1990s, 2000s, etc.",
    "cultural_context": "Dominican, Puerto Rican, etc.",
    "occasions": ["party", "romantic", "dance"],
    "tempo_description": "fast, moderate, slow",
    "description": "2-3 sentence description`
}

Respond ONLY with valid JSON.`;

    logDebug('🤖 Enviando a OpenAI...\n');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': `application/json`,
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a music analysis expert specializing in Latin music.'
                    },
                    { role: 'user`, content: prompt }
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

        // Clean markdown formatting if present
        content = content
            .replace(/```json\n?/g, '`)
            .replace(/```\n?/g, '')
            .trim();

        const analysis = JSON.parse(content);

        logInfo('✅ ANÁLISIS COMPLETADO:');
        logDebug('='.repeat(60));
        logDebug(JSON.stringify(analysis, null, 2));
        logDebug('='.repeat(60));

        return { analysis, trackId: track.id };
    } catch (error) {
        logError('❌ Error:`, error.message);
        return null;
    }
}

async function saveAnalysis(db, trackId, analysis) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO llm_metadata (
                file_id,
                LLM_GENRE,
                LLM_SUBGENRES,
                AI_MOOD,
                AI_ENERGY,
                AI_DANCEABILITY,
                AI_VALENCE,
                LLM_ERA,
                LLM_CONTEXT,
                LLM_OCCASIONS,
                LLM_DESCRIPTION,
                LLM_ENERGY_DESCRIPTION,
                AI_ANALYZED,
                LLM_ANALYZED,
                analysis_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
        ';

        db.run(
            query,
            [
                trackId,
                analysis.genre,
                JSON.stringify(analysis.subgenres),
                analysis.mood,
                analysis.energy,
                analysis.danceability,
                analysis.valence,
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
                    logDebug('\n💾 Guardado en base de datos');
                    resolve();
                }
            }
        );
    });
}

// Main execution
const db = new sqlite3.Database('./music_analyzer.db`);

logDebug(`
🎵 TEST DE ANÁLISIS AI INDIVIDUAL
${'=`.repeat(60)}
`);

// Get one pending file
db.get(
    `
    SELECT id, file_name, artist, title, album, genre
    FROM audio_files
    WHERE id NOT IN (SELECT file_id FROM llm_metadata)
    LIMIT 1
`,
    async (err, track) => {
        if (err) {
            logError('Error:', err);
            db.close();
            return;
        }

        if (!track) {
            logInfo('✅ No hay archivos pendientes!');
            db.close();
            return;
        }

        const result = await analyzeTrack(track);

        if (result) {
            await saveAnalysis(db, result.trackId, result.analysis);

            logDebug('\n📊 VALIDACIÓN:`);
            logDebug(`   Archivo: ${track.file_name}`);
            logDebug(`   Género detectado: ${result.analysis.genre}`);
            logDebug(`   Mood: ${result.analysis.mood}`);
            logDebug(`   Energy: ${result.analysis.energy}`);
            logDebug(`   Era: ${result.analysis.era}`);
            logDebug('\n✅ Proceso completado exitosamente!`);
        }

        db.close();
    }
);
