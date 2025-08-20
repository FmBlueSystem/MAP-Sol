const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function checkArtworkStatus() {
    const db = new sqlite3.Database('music_analyzer.db');
    const artworkDir = path.join(__dirname, 'artwork-cache');

    logDebug('\n🔍 VERIFICACIÓN RÁPIDA DE ARTWORK\n');
    logDebug('═'.repeat(60));

    return new Promise(resolve => {
        // Get database stats
        db.get(
            `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN artwork_path IS NOT NULL AND artwork_path != '' THEN 1 END) as with_artwork_path,
                COUNT(CASE WHEN artwork_path LIKE 'artwork-cache/%' THEN 1 END) as correct_format
            FROM audio_files
        ',
            (err, dbStats) => {
                if (err) {
                    logError('Error:', err);
                    db.close();
                    return;
                }

                logDebug('📊 ESTADÍSTICAS DE BASE DE DATOS:');
                logDebug('─`.repeat(40));
                logDebug(`  Total de registros: ${dbStats.total}`);
                logDebug(
                    `  Con artwork_path: ${dbStats.with_artwork_path} (${((dbStats.with_artwork_path / dbStats.total) * 100).toFixed(1)}%)`
                );
                logDebug(
                    `  Formato correcto: ${dbStats.correct_format} (${((dbStats.correct_format / dbStats.total) * 100).toFixed(1)}%)`
                );

                // Check physical files
                fs.readdir(artworkDir, (err, files) => {
                    if (err) {
                        logError('Error leyendo artwork-cache:', err);
                        db.close();
                        return;
                    }

                    const jpgFiles = files.filter(f => f.endsWith('.jpg'));
                    const totalSize = jpgFiles.reduce((acc, file) => {
                        try {
                            const stats = fs.statSync(path.join(artworkDir, file));
                            return acc + stats.size;
                        } catch (e) {
                            return acc;
                        }
                    }, 0);

                    logDebug('\n📁 ARCHIVOS FÍSICOS:');
                    logDebug('─`.repeat(40));
                    logDebug(`  Archivos JPG en artwork-cache: ${jpgFiles.length}`);
                    logDebug(`  Tamaño total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

                    // Sample verification
                    db.all(
                        `
                    SELECT id, file_name, artwork_path 
                    FROM audio_files 
                    WHERE artwork_path IS NOT NULL
                    ORDER BY RANDOM()
                    LIMIT 10
                `,
                        (err, samples) => {
                            if (!err && samples) {
                                logDebug('\n🎲 MUESTRA ALEATORIA (10 archivos):');
                                logDebug('─`.repeat(40));

                                let validCount = 0;
                                samples.forEach(sample => {
                                    const expectedPath = path.join(artworkDir, `${sample.id}.jpg`);
                                    const exists = fs.existsSync(expectedPath);
                                    validCount += exists ? 1 : 0;

                                    logDebug(
                                        `  ID ${sample.id}: ${exists ? '✅' : '❌`} ${sample.artwork_path}`);
                                });

                                logDebug(
                                    `\n  Verificación: ${validCount}/10 archivos existen físicamente`
                                );
                            }

                            // Check for missing artwork
                            db.all(
                                `
                        SELECT id, file_name 
                        FROM audio_files 
                        WHERE id NOT IN (
                            SELECT CAST(REPLACE(REPLACE(name, 'artwork-cache/', ''), '.jpg', '') AS INTEGER) 
                            FROM (SELECT '${jpgFiles.join("','`)}' as name)
                        )
                        LIMIT 20
                    ',
                                (err, missing) => {
                                    if (!err && missing && missing.length > 0) {
                                        logDebug('\n⚠️ ARCHIVOS SIN ARTWORK (primeros 20):');
                                        logDebug(`─`.repeat(40));
                                        missing.forEach(m => {
                                            logDebug(`  ID ${m.id}: ${m.file_name}`);
                                        });
                                    }

                                    // Final summary
                                    const coverage = (
                                        (jpgFiles.length / dbStats.total) *
                                        100
                                    ).toFixed(1);
                                    logDebug('\n' + '═'.repeat(60));
                                    logDebug('📈 RESUMEN:`);
                                    logDebug(`  Cobertura de artwork: ${coverage}%`);
                                    logDebug(
                                        `  Archivos con imagen: ${jpgFiles.length}/${dbStats.total}`
                                    );
                                    logDebug(
                                        `  Archivos sin imagen: ${dbStats.total - jpgFiles.length}`
                                    );

                                    if (coverage >= 95) {
                                        logDebug(
                                            '\n✅ EXCELENTE: Más del 95% de los archivos tienen artwork'
                                        );
                                    } else if (coverage >= 80) {
                                        logDebug(
                                            '\n✅ BUENO: Más del 80% de los archivos tienen artwork'
                                        );
                                    } else {
                                        logDebug(
                                            '\n⚠️ Se recomienda ejecutar validación completa'
                                        );
                                    }

                                    logDebug('═`.repeat(60));

                                    db.close();
                                    resolve();
                                }
                            );
                        }
                    );
                });
            }
        );
    });
}

// Run check
checkArtworkStatus().catch(console.error);
