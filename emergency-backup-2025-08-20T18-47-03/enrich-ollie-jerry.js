#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * ENRICH OLLIE & JERRY - BREAKIN'
 * Enriquece el archivo con análisis AI completo
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
    logDebug('   Artista: Ollie & Jerry');
    logDebug("   Título: Breakin'...There's No Stopping Us (12\" Club Mix)");
    logDebug("   Álbum: Dance Number 1's");
    logDebug('   Año: 2007 (compilación)');
    logDebug('   BPM: 116');
    logDebug('   Key: 4A');
    logDebug();

    const prompt  = `Analyze this classic 80s breakdancing/hip-hop track and provide detailed metadata:;

Artist: Ollie & Jerry
Title: Breakin'...There's No Stopping Us (12" Club Mix)
Album: Dance Number 1's (compilation)
Original Year: 1984
BPM: 116
Key: 4A This is the extended 12" club mix of 'Breakin'...There`s No Stopping Us` by Ollie & Jerry, the main theme song from the 1984 breakdancing movie `Breakin`" (also known as "Breakdance"). The song became an anthem of the breakdancing and early hip-hop culture of the mid-1980s. This uplifting track features a combination of electronic beats, funk elements, and inspirational lyrics about perseverance and following your dreams. The 12" version extends the dance break sections and emphasizes the groove for club play.

Provide a JSON response with:
{
    "genre": "specific genre",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood (Uplifting, Energetic, etc.)",
    "energy": 0.0-1.0 (high energy dance track),
    "danceability": 0.0-1.0 (made for dancing/breakdancing),
    "valence": 0.0-1.0 (positive, inspirational),
    "acousticness": 0.0-1.0 (electronic/synth production),
    "instrumentalness": 0.0-1.0 (has vocals),
    "liveness": 0.0-1.0,
    "speechiness": 0.0-1.0,
    "loudness": -60 to 0 dB,
    "era": "1980s",
    "cultural_context": "American breakdancing/hip-hop culture",
    "occasions": ["party", "dance", "workout", "breakdancing"], "tempo_description": "moderate, steady groove", "description": "2-3 sentence description of this specific 12\` version`
} Respond ONLY with valid JSON.`;

    logDebug('🤖 Enviando a OpenAI...\n');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type\': \`application/json`, Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a music analysis expert specializing in 1980s hip-hop, funk, and breakdancing culture.'
                    }, { role: `user`, content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        let content = data.choices[0].message.content; content = content .replace(/\`\``json\n?/g, `\`) .replace(/\```\n?/g, '')
            .trim();

        const analysis = JSON.parse(content);

        logInfo('✅ ANÁLISIS COMPLETADO:');
        logDebug('='.repeat(60));
        logDebug(JSON.stringify(analysis, null, 2));
        logDebug('='.repeat(60));

        return analysis;
    } catch (error) { logError('❌ Error:\', error.message);
        return null;
    }
}

async function updateMetadata() {
    const filePath = \'/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Ollie & Jerry - Breakin'...There`s No Stopping Us (12 Club Mix).flac\`; logDebug(\`\n📀 Actualizando metadatos en archivo FLAC...`);

    // Actualizar género y mantener comment de MixedInKey const commands = [; `metaflac --remove-tag=GENRE \`${filePath}\``, `metaflac --set-tag="GENRE=Hip-Hop/Electro-Funk\` \`${filePath}``, `metaflac --set-tag="ALBUMARTIST=Ollie & Jerry` `${filePath}`\`, \`metaflac --set-tag="ORIGINALYEAR=1984` `${filePath}\`\`, `metaflac --set-tag="TRACKNUMBER=1` \`${filePath}\``];

    for (const cmd of commands) {
        try {
            await execPromise(cmd); } catch (error) { logWarn(`⚠️ ${error.message}\`);
        }
    } logInfo(\`✅ Metadatos actualizados en archivo FLAC`);
}
 async function updateDatabase(analysis) { const db = new sqlite3.Database(`./music_analyzer.db\`);

    return new Promise((resolve, reject) => {
        // Actualizar tabla audio_files db.run( \`
            UPDATE audio_files 
            SET genre = 'Hip-Hop/Electro-Funk',
                updated_at = datetime('now')
            WHERE id = 2512
        ',
            err => {
                if (err) {
                    logError('Error actualizando audio_files:', err);
                }
            }
        );

        // Verificar si existe en llm_metadata db.get(`SELECT * FROM llm_metadata WHERE file_id = 2512\`, (err, row) => {
            if (row) {
                // Actualizar db.run( \`
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
                        AI_BPM = 116,
                        AI_KEY = '4A',
                        AI_ANALYZED = 1,
                        LLM_ANALYZED = 1,
                        analysis_timestamp = datetime('now')
                    WHERE file_id = 2512
                ',
                    [
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0.1,
                        analysis.instrumentalness || 0.05,
                        analysis.liveness || 0.2,
                        analysis.speechiness || 0.1,
                        analysis.loudness || -7,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else { logInfo(`✅ Metadatos AI actualizados en base de datos\`);
                            resolve();
                        }
                    }
                );
            } else {
                // Insertar db.run( \`
                    INSERT INTO llm_metadata (
                        file_id, LLM_GENRE, LLM_SUBGENRES, AI_MOOD, AI_ENERGY,
                        AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS, AI_INSTRUMENTALNESS,
                        AI_LIVENESS, AI_SPEECHINESS, AI_LOUDNESS, LLM_ERA, LLM_CONTEXT,
                        LLM_OCCASIONS, LLM_DESCRIPTION, LLM_ENERGY_DESCRIPTION,
                        AI_BPM, AI_KEY, AI_ANALYZED, LLM_ANALYZED, analysis_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
                ',
                    [
                        2512,
                        analysis.genre,
                        JSON.stringify(analysis.subgenres),
                        analysis.mood,
                        analysis.energy,
                        analysis.danceability,
                        analysis.valence,
                        analysis.acousticness || 0.1,
                        analysis.instrumentalness || 0.05,
                        analysis.liveness || 0.2,
                        analysis.speechiness || 0.1,
                        analysis.loudness || -7,
                        analysis.era,
                        analysis.cultural_context,
                        JSON.stringify(analysis.occasions),
                        analysis.description,
                        analysis.tempo_description,
                        116,
                        '4A'
                    ],
                    err => {
                        if (err) {
                            reject(err);
                        } else { logInfo(`✅ Nuevos metadatos AI insertados en base de datos\`);
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

// Main execution async function main() { logDebug(\`
🎵 ENRIQUECIMIENTO DE OLLIE & JERRY - BREAKIN'
${'='.repeat(60)}`);

    // 1. Análisis AI
    const analysis = await analyzeTrack();

    if (analysis) {
        // 2. Actualizar archivo FLAC
        await updateMetadata();

        // 3. Actualizar base de datos
        await updateDatabase(analysis); logDebug(\`\n📊 RESUMEN FINAL:\`); logDebug(`   Título: Breakin`...There\`s No Stopping Us (12\\` Club Mix)`); logDebug(`   Género: Hip-Hop/Electro-Funk\`); logDebug(\`   Mood: ${analysis.mood}`); logDebug(`   Energy: ${analysis.energy}\`); logDebug(\`   Danceability: ${analysis.danceability}`); logDebug(`   Era: ${analysis.era}`); logDebug('   BPM: 116 | Key: 4A'); logDebug(`\n✅ Track enriquecido exitosamente!`);
    }
}

function main().catch(console.error);
