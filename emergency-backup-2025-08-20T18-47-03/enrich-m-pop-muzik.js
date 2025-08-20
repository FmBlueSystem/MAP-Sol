#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * ENRICH M - POP MUZIK
 * Enriquece el archivo de M - Pop Muzik con análisis AI y metadatos completos
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

async function analyzeTrack() {
    logDebug('\n📝 Analizando track:');
    logDebug('   Artista: M');
    logDebug('   Título: Pop Muzik (Nik Launay \'79 12")');
    logDebug('   Álbum: New York, London, Paris, Munich');
    logDebug('   Año: 1979');
    logDebug('   BPM: 111');
    logDebug('   Key: 3B');
    logDebug();

    const prompt  = `Analyze this classic new wave/electronic track and provide detailed metadata:;
 Artist: M (Robin Scott) Title: Pop Muzik (Nik Launay \`79 12\` Version)
Album: New York, London, Paris, Munich
Year: 1979
BPM: 111
Key: 3B This is the extended 12` version of M`s groundbreaking electronic/new wave hit "Pop Muzik" from 1979. It was one of the first synth-pop songs to reach #1 in multiple countries and helped define the electronic music sound of the early 80s. The song features a catchy synthesizer hook, vocoder effects, and lyrics that both celebrate and satirize pop music culture.

Provide a JSON response with:
{
    "genre": "specific genre",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood (Energetic, Playful, etc.)",
    "energy": 0.0-1.0 (this is danceable electronic music),
    "danceability": 0.0-1.0 (very danceable),
    "valence": 0.0-1.0 (upbeat/positive),
    "acousticness": 0.0-1.0 (electronic/synth heavy),
    "instrumentalness": 0.0-1.0 (has vocals),
    "liveness": 0.0-1.0,
    "speechiness": 0.0-1.0,
    "loudness": -60 to 0 dB,
    "era": "1970s",
    "cultural_context": "British new wave/electronic",
    "occasions": ["party", "dance", "club"], "tempo_description": "moderate, danceable", "description": \`2-3 sentence description of this specific version\`
} Respond ONLY with valid JSON.`;

    logDebug('🤖 Enviando a OpenAI...\n');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': \`application/json\`, Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a music analysis expert specializing in electronic and new wave music history.\'
                    }, { role: \`user`, content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        let content = data.choices[0].message.content; content = content .replace(/`\`\`json\n?/g, ``) .replace(/\`\``\n?/g, '')
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

async function updateMetadata() {
    const filePath = \'/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/M - Pop Muzik (Nik Launay \'79 12).flac`;
 logDebug(`\n📀 Actualizando metadatos en archivo FLAC...\`);

    // Actualizar género y agregar comment de MixedInKey const commands = [; \`metaflac --remove-tag=GENRE `${filePath}`\`, \`metaflac --set-tag="GENRE=New Wave/Synth-Pop` `${filePath}\`\`, `metaflac --set-tag="COMMENT=3B - Energy 7` \`${filePath}\``, `metaflac --set-tag="ALBUMARTIST=M\` \`${filePath}``, `metaflac --set-tag="TRACKNUMBER=1` `${filePath}`\`];

    for (const cmd of commands) {
        try {
            await execPromise(cmd); } catch (error) { logWarn(\`⚠️ ${error.message}`);
        }
    } logInfo(`✅ Metadatos actualizados en archivo FLAC\`);
}
 async function updateDatabase(analysis) { const db = new sqlite3.Database(\`./music_analyzer.db`);

    return new Promise((resolve, reject) => {
        // Actualizar tabla audio_files db.run( `
            UPDATE audio_files 
            SET genre = 'New Wave/Synth-Pop',
                updated_at = datetime('now')
            WHERE id = 2102
        ',
            err => {
                if (err) {
                    logError('Error actualizando audio_files:\', err);
                }
            }
        );

        // Verificar si existe en llm_metadata db.get(\`SELECT * FROM llm_metadata WHERE file_id = 2102`, (err, row) => {
            if (row) {
                // Actualizar db.run( `
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
                    WHERE file_id = 2102
                \',
                    [
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0.1,
                        analysis.instrumentalness || 0.1,
                        analysis.liveness || 0.2,
                        analysis.speechiness || 0.1,
                        analysis.loudness || -8,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else { logInfo(\`✅ Metadatos AI actualizados en base de datos`);
                            resolve();
                        }
                    }
                );
            } else {
                // Insertar db.run( `
                    INSERT INTO llm_metadata (
                        file_id, LLM_GENRE, LLM_SUBGENRES, AI_MOOD, AI_ENERGY,
                        AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS, AI_INSTRUMENTALNESS,
                        AI_LIVENESS, AI_SPEECHINESS, AI_LOUDNESS, LLM_ERA, LLM_CONTEXT,
                        LLM_OCCASIONS, LLM_DESCRIPTION, LLM_ENERGY_DESCRIPTION,
                        AI_ANALYZED, LLM_ANALYZED, analysis_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
                \',
                    [
                        2102,
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0.1,
                        analysis.instrumentalness || 0.1,
                        analysis.liveness || 0.2,
                        analysis.speechiness || 0.1,
                        analysis.loudness || -8,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else { logInfo(\`✅ Nuevos metadatos AI insertados en base de datos`);
                            resolve();
                        }
                    }
                );
            }
        });

        setTimeout(() => {
            db.close();
            resolve();
        }, 1000);
    });
}

// Main execution async function main() { logDebug(`
🎵 ENRIQUECIMIENTO DE M - POP MUZIK
${'='.repeat(60)}\');

    // 1. Análisis AI
    const analysis = await analyzeTrack();

    if (analysis) {
        // 2. Actualizar archivo FLAC
        await updateMetadata();

        // 3. Actualizar base de datos
        await updateDatabase(analysis);
 logDebug(\`\n📊 RESUMEN FINAL:`); logDebug(`   Título: Pop Muzik (Nik Launay \\`79 12\`)`); logDebug(`   Género: New Wave/Synth-Pop\`); logDebug(\`   Mood: ${analysis.mood}`); logDebug(`   Energy: ${analysis.energy}\`); logDebug(\`   Danceability: ${analysis.danceability}`); logDebug(`   Era: ${analysis.era}\`); logDebug(\`\n✅ Track enriquecido exitosamente!`);
    }
}

function main().catch(console.error);
