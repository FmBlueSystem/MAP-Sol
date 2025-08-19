const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

logDebug('\n📊 ESTADÍSTICAS DE MUSIC ANALYZER PRO');
logDebug('='.repeat(60));

db.get(
    `
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN artwork_path IS NOT NULL THEN 1 END) as with_artwork
    FROM audio_files
    WHERE file_path NOT LIKE '%_DELETED'
',
    (err, files) => {
        if (err) {
            logError('Error:', err);
            return;
        }

        db.get(
            `
        SELECT 
            COUNT(CASE WHEN LLM_DESCRIPTION IS NOT NULL THEN 1 END) as with_ai,
            COUNT(CASE WHEN LLM_ERA IS NOT NULL THEN 1 END) as with_era,
            COUNT(CASE WHEN AI_MOOD IS NOT NULL THEN 1 END) as with_mood
        FROM llm_metadata
    `,
            (err, metadata) => {
                if (err) {
                    logError('Error:', err);
                    return;
                }

                logDebug('\n📁 ARCHIVOS:');
                logDebug(`   Total: ${files.total}`);
                logDebug(
                    `   Con carátula: ${files.with_artwork} (${((files.with_artwork / files.total) * 100).toFixed(1)}%)`
                );
                logDebug(
                    `   Con análisis IA: ${metadata.with_ai} (${((metadata.with_ai / files.total) * 100).toFixed(1)}%)`
                );

                // Distribución por era
                db.all(
                    `
            SELECT LLM_ERA, COUNT(*) as count
            FROM llm_metadata
            WHERE LLM_ERA IS NOT NULL
            GROUP BY LLM_ERA
            ORDER BY LLM_ERA
        `,
                    (err, eras) => {
                        if (err) {
                            logError('Error:', err);
                            return;
                        }

                        logDebug('\n📅 DISTRIBUCIÓN POR DÉCADA:');
                        eras.forEach(era => {
                            const bar = '█'.repeat(Math.min(30, Math.floor(era.count / 30)));
                            logDebug(`   ${era.LLM_ERA}: ${bar} ${era.count}`);
                        });

                        // Top géneros
                        db.all(
                            `
                SELECT genre, COUNT(*) as count
                FROM audio_files
                WHERE genre IS NOT NULL
                GROUP BY genre
                ORDER BY count DESC
                LIMIT 10
            `,
                            (err, genres) => {
                                if (err) {
                                    logError('Error:', err);
                                    return;
                                }

                                logDebug('\n🎸 TOP 10 GÉNEROS:');
                                genres.forEach((genre, i) => {
                                    logDebug(
                                        `   ${(i + 1).toString().padStart(2)}. ${genre.genre}: ${genre.count} tracks`
                                    );
                                });

                                // Resumen
                                logDebug('\n✨ RESUMEN:');
                                logDebug(
                                    `   Pendientes de análisis IA: ${files.total - metadata.with_ai}`
                                );
                                logDebug(
                                    `   Costo estimado para completar: ~$${((files.total - metadata.with_ai) * 0.01).toFixed(2)} USD`
                                );
                                logDebug(
                                    `   Tiempo estimado: ~${Math.ceil((files.total - metadata.with_ai) / 100)} horas`
                                );

                                logDebug('\n');
                                db.close();
                            }
                        );
                    }
                );
            }
        );
    }
);
