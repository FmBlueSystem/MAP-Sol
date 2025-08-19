#!/usr/bin/env node

/**
 * SHOW UPDATED FILES
 * Muestra todos los archivos actualizados con metadatos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

logDebug('\n📊 ARCHIVOS ACTUALIZADOS CON METADATOS');
logDebug('='.repeat(60));

// Estadísticas generales
db.get(
    `
    SELECT 
        COUNT(DISTINCT lm.file_id) as total_analyzed,
        COUNT(DISTINCT CASE WHEN DATE(lm.LLM_ANALYSIS_DATE) = DATE('now') THEN lm.file_id END) as analyzed_today,
        COUNT(DISTINCT CASE WHEN DATE(lm.LLM_ANALYSIS_DATE) >= DATE('now', '-7 days') THEN lm.file_id END) as analyzed_week
    FROM llm_metadata lm
    WHERE lm.LLM_DESCRIPTION IS NOT NULL
',
    (err, stats) => {
        if (err) {
            logError('Error:', err);
            return;
        }

        logDebug('\n📈 RESUMEN:');
        logDebug(`   Total con análisis IA: ${stats.total_analyzed}`);
        logDebug(`   Analizados hoy: ${stats.analyzed_today}`);
        logDebug(`   Últimos 7 días: ${stats.analyzed_week}`);

        // Archivos físicos actualizados
        logDebug('\n💾 ARCHIVOS FÍSICOS ACTUALIZADOS (con metadatos escritos):');
        logDebug('   1. 2 Unlimited - The Magic Friend (Extended Remix).flac');
        logDebug('   2. Carlos Rivera - Eres Tú (Mamá).flac');
        logDebug('   ✅ Estos archivos tienen metadatos IA en el archivo físico');

        // Últimos analizados en la base de datos
        logDebug('\n🗄️ ÚLTIMOS 30 ARCHIVOS CON ANÁLISIS IA (en base de datos):');
        logDebug('-'.repeat(60));

        db.all(
            `
        SELECT 
            af.file_name,
            af.artist,
            lm.AI_MOOD,
            lm.LLM_ERA,
            lm.LLM_ENERGY_LEVEL,
            datetime(lm.LLM_ANALYSIS_DATE) as date
        FROM audio_files af
        JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.LLM_DESCRIPTION IS NOT NULL
        ORDER BY lm.LLM_ANALYSIS_DATE DESC
        LIMIT 30
    `,
            (err, rows) => {
                if (err) {
                    logError('Error:', err);
                    return;
                }

                rows.forEach((row, i) => {
                    logDebug(`\n${(i + 1).toString().padStart(3)}. ${row.file_name}`);
                    logDebug(`     Artista: ${row.artist}`);
                    logDebug(
                        `     Mood: ${row.AI_MOOD || 'N/A'} | Era: ${row.LLM_ERA || 'N/A'} | Energy: ${row.LLM_ENERGY_LEVEL || 'N/A'}');
                    logDebug(`     Analizado: ${row.date}`);
                });

                // Análisis por artista
                logDebug('\n\n🎤 TOP 10 ARTISTAS CON MÁS TRACKS ANALIZADOS:');
                logDebug('-'.repeat(60));

                db.all(
                    `
            SELECT 
                af.artist,
                COUNT(*) as tracks_count,
                GROUP_CONCAT(DISTINCT lm.AI_MOOD) as moods
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.LLM_DESCRIPTION IS NOT NULL
            GROUP BY af.artist
            ORDER BY tracks_count DESC
            LIMIT 10
        `,
                    (err, artists) => {
                        if (err) {
                            logError('Error:', err);
                            return;
                        }

                        artists.forEach((artist, i) => {
                            logDebug(
                                `${(i + 1).toString().padStart(2)}. ${artist.artist}: ${artist.tracks_count} tracks`
                            );
                            if (artist.moods) {
                                logDebug(`    Moods: ${artist.moods}`);
                            }
                        });

                        // Distribución por década
                        logDebug('\n\n📅 DISTRIBUCIÓN DE ANÁLISIS POR DÉCADA:');
                        logDebug('-'.repeat(60));

                        db.all(
                            `
                SELECT 
                    lm.LLM_ERA as era,
                    COUNT(*) as count
                FROM llm_metadata lm
                WHERE lm.LLM_DESCRIPTION IS NOT NULL
                    AND lm.LLM_ERA IS NOT NULL
                GROUP BY lm.LLM_ERA
                ORDER BY lm.LLM_ERA
            `,
                            (err, eras) => {
                                if (err) {
                                    logError('Error:', err);
                                    return;
                                }

                                eras.forEach(era => {
                                    const bar = '█'.repeat(Math.min(30, Math.floor(era.count / 5)));
                                    logDebug(`${era.era}: ${bar} ${era.count}`);
                                });

                                // Información importante
                                logDebug('\n\n⚠️  IMPORTANTE:');
                                logDebug('-'.repeat(60));
                                logDebug(
                                    '• Solo 2 archivos físicos fueron actualizados con metadatos'
                                );
                                logDebug(
                                    '• 241 archivos tienen análisis IA en la base de datos'
                                );
                                logDebug('• Para escribir metadatos a más archivos físicos:');
                                logDebug('  node write-metadata-to-files.js 10');
                                logDebug(
                                    '\n• Para analizar más tracks (cuando tengas créditos):'
                                );
                                logDebug('  node safe-analyze.js 20');

                                logDebug('\n✨ Reporte completado\n');
                                db.close();
                            }
                        );
                    }
                );
            }
        );
    }
);
