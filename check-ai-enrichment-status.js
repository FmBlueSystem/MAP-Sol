#!/usr/bin/env node

/**
 * CHECK AI ENRICHMENT STATUS
 * Verifica el estado del enriquecimiento con OpenAI
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./music_analyzer.db');

logDebug(`
🤖 ESTADO DEL ENRIQUECIMIENTO CON AI/OPENAI
${'='.repeat(60)}
');

// 1. Estado general
db.get(
    `
    SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN id IN (SELECT file_id FROM llm_metadata) THEN 1 END) as analyzed,
        COUNT(CASE WHEN id NOT IN (SELECT file_id FROM llm_metadata) THEN 1 END) as pending
    FROM audio_files
`,
    (err, row) => {
        if (err) {
            logError('Error:', err);
            return;
        }

        const percentage = ((row.analyzed / row.total_files) * 100).toFixed(1);

        logDebug('📊 RESUMEN GENERAL:');
        logDebug(`   Total archivos: ${row.total_files}`);
        logDebug(`   ✅ Analizados con AI: ${row.analyzed} (${percentage}%)`);
        logDebug(`   ⏳ Pendientes: ${row.pending}`);
        logDebug();

        // 2. Análisis por campos
        db.get(
            `
        SELECT 
            COUNT(CASE WHEN LLM_GENRE IS NOT NULL THEN 1 END) as has_genre,
            COUNT(CASE WHEN AI_MOOD IS NOT NULL THEN 1 END) as has_mood,
            COUNT(CASE WHEN AI_ENERGY IS NOT NULL THEN 1 END) as has_energy,
            COUNT(CASE WHEN AI_BPM IS NOT NULL THEN 1 END) as has_bpm,
            COUNT(CASE WHEN AI_KEY IS NOT NULL THEN 1 END) as has_key,
            COUNT(CASE WHEN AI_DANCEABILITY IS NOT NULL THEN 1 END) as has_danceability,
            COUNT(CASE WHEN AI_VALENCE IS NOT NULL THEN 1 END) as has_valence,
            COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as has_description,
            COUNT(CASE WHEN similar_artists IS NOT NULL THEN 1 END) as has_similar_artists,
            COUNT(CASE WHEN cultural_context IS NOT NULL THEN 1 END) as has_cultural_context
        FROM llm_metadata
    `,
            (err, fields) => {
                if (err) {
                    logError('Error:', err);
                    return;
                }

                logDebug('📈 CAMPOS ANALIZADOS:');
                logDebug(`   Género AI: ${fields.has_genre}`);
                logDebug(`   Mood: ${fields.has_mood}`);
                logDebug(`   Energy: ${fields.has_energy}`);
                logDebug(`   BPM: ${fields.has_bpm}`);
                logDebug(`   Key: ${fields.has_key}`);
                logDebug(`   Danceability: ${fields.has_danceability}`);
                logDebug(`   Valence: ${fields.has_valence}`);
                logDebug(`   Descripción: ${fields.has_description || 0}`);
                logDebug(`   Artistas similares: ${fields.has_similar_artists || 0}`);
                logDebug(`   Contexto cultural: ${fields.has_cultural_context || 0}`);
                logDebug();

                // 3. Diversidad de análisis
                db.all(
                    `
            SELECT 
                COUNT(DISTINCT LLM_GENRE) as unique_genres,
                COUNT(DISTINCT AI_MOOD) as unique_moods,
                COUNT(DISTINCT AI_KEY) as unique_keys
            FROM llm_metadata
        `,
                    (err, diversity) => {
                        if (err) {
                            logError('Error:', err);
                            return;
                        }

                        logDebug('🎨 DIVERSIDAD DE ANÁLISIS:');
                        logDebug(`   Géneros únicos: ${diversity[0].unique_genres}`);
                        logDebug(`   Moods únicos: ${diversity[0].unique_moods}`);
                        logDebug(`   Keys únicos: ${diversity[0].unique_keys}`);
                        logDebug();

                        // 4. Top géneros y moods
                        db.all(
                            `
                SELECT LLM_GENRE, COUNT(*) as count
                FROM llm_metadata
                WHERE LLM_GENRE IS NOT NULL
                GROUP BY LLM_GENRE
                ORDER BY count DESC
                LIMIT 10
            `,
                            (err, genres) => {
                                if (err) {
                                    logError('Error:', err);
                                    return;
                                }

                                logDebug('🎵 TOP 10 GÉNEROS AI:');
                                genres.forEach((g, i) => {
                                    logDebug(`   ${i + 1}. ${g.LLM_GENRE}: ${g.count} tracks`);
                                });
                                logDebug();

                                // 5. Archivos pendientes (muestra)
                                db.all(
                                    `
                    SELECT file_name, artist, title
                    FROM audio_files
                    WHERE id NOT IN (SELECT file_id FROM llm_metadata)
                    LIMIT 5
                `,
                                    (err, pending) => {
                                        if (err) {
                                            logError('Error:', err);
                                            return;
                                        }

                                        if (pending.length > 0) {
                                            logDebug('📝 EJEMPLOS DE ARCHIVOS PENDIENTES:');
                                            pending.forEach(p => {
                                                logDebug(
                                                    `   • ${p.artist || 'Unknown'} - ${p.title || p.file_name}');
                                            });
                                            logDebug();
                                        }

                                        // 6. Estado de la API
                                        logDebug('🔑 CONFIGURACIÓN OPENAI:');
                                        logDebug(
                                            `   API Key: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ No configurada'}');
                                        logDebug(
                                            `   Modelo: ${process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'}');
                                        logDebug(
                                            `   Rate limit: ${process.env.OPENAI_REQUESTS_PER_MINUTE || 20} req/min`
                                        );
                                        logDebug(
                                            `   Batch size: ${process.env.OPENAI_BATCH_SIZE || 10}`
                                        );
                                        logDebug();

                                        // 7. Estimación de tiempo y costo
                                        const pendingCount = row.total_files - row.analyzed;
                                        if (pendingCount > 0) {
                                            const rateLimit =
                                                parseInt(process.env.OPENAI_REQUESTS_PER_MINUTE) ||
                                                20;
                                            const estimatedMinutes = Math.ceil(
                                                pendingCount / rateLimit
                                            );
                                            const estimatedCost = (pendingCount * 0.03).toFixed(2); // ~$0.03 per request estimate

                                            logDebug('⏱️  ESTIMACIONES PARA COMPLETAR:');
                                            logDebug(
                                                `   Tiempo estimado: ${estimatedMinutes} minutos (~${(estimatedMinutes / 60).toFixed(1)} horas)`
                                            );
                                            logDebug(
                                                `   Costo estimado: ~$${estimatedCost} USD`
                                            );
                                            logDebug();
                                        }

                                        logDebug('💡 COMANDOS DISPONIBLES:');
                                        logDebug(
                                            '   node update-music-library.js    # Actualizar biblioteca completa'
                                        );
                                        logDebug(
                                            '   node analyze-all.js              # Analizar archivos pendientes'
                                        );
                                        logDebug(
                                            '   node test-openai-integration.js  # Probar conexión con OpenAI'
                                        );
                                        logDebug();

                                        db.close();
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);
