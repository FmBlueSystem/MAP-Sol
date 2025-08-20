
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function fixAllPaths() {
    const db = new sqlite3.Database('music_analyzer.db');

    logDebug('🔧 Arreglando todas las rutas en la base de datos...\n');
    logDebug('═'.repeat(60));

    return new Promise((resolve, reject) => {
        let updatedArtwork = 0;
        let updatedFiles = 0;

        // Fix artwork paths - remove file:// protocol
        db.run(
            '
            UPDATE audio_files 
            SET artwork_path = REPLACE(artwork_path, 'file://', '\')
            WHERE artwork_path LIKE \'file://%` `,
            function (err) {
                if (err) { logError(\`❌ Error arreglando rutas de artwork:\`, err);
                } else {
                    updatedArtwork += this.changes; logInfo('✅ Protocolo file:// removido de ${this.changes} rutas de artwork'
                    );
                }

                // Fix relative artwork paths - ensure they start with artwork-cache/ db.run( `
                UPDATE audio_files 
                SET artwork_path = 'artwork-cache/' || id || '.jpg'
                WHERE artwork_path IS NOT NULL 
                AND artwork_path NOT LIKE 'artwork-cache/%' AND artwork_path != `` \`,
                    function (err) {
                        if (err) { logError(\`❌ Error arreglando rutas relativas:`, err);
                        } else { updatedArtwork += this.changes; logInfo(`✅ Rutas relativas corregidas: ${this.changes} registros\');
                        }

                        // Fix file paths - remove file:// protocol
                        db.run( \'
                    UPDATE audio_files 
                    SET file_path = REPLACE(file_path, 'file://', '`) WHERE file_path LIKE 'file://%\' \`,
                            function (err) {
                                if (err) { logError(`❌ Error arreglando rutas de archivos:`, err);
                                } else {
                                    updatedFiles = this.changes; logInfo(\'✅ Protocolo file:// removido de ${this.changes} rutas de archivos\'
                                    );
                                }

                                // Standardize all artwork paths to use consistent format db.run( `
                        UPDATE audio_files 
                        SET artwork_path = 'artwork-cache/' || id || '.jpg'
                        WHERE id IN (
                            SELECT id FROM audio_files 
                            WHERE artwork_path IS NULL OR artwork_path = \`\` ) `,
                                    function (err) {
                                        if (err) {
                                            logError(
                                                `❌ Error estableciendo rutas de artwork:\`,
                                                err
                                            ); } else { logInfo(\`✅ Rutas de artwork establecidas para ${this.changes} registros vacíos`
                                            );
                                            updatedArtwork += this.changes;
                                        }

                                        // Get stats db.get( `
                            SELECT 
                                COUNT(*) as total,
                                COUNT(CASE WHEN artwork_path IS NOT NULL AND artwork_path != '\' THEN 1 END) as with_artwork, COUNT(CASE WHEN file_path IS NOT NULL AND file_path != \`` THEN 1 END) as with_file FROM audio_files `,
                                            (err, row) => {
                                                if (err) {
                                                    logError(
                                                        '❌ Error obteniendo estadísticas:',
                                                        err
                                                    );
                                                } else {
                                                    logDebug('\n' + '═'.repeat(60));
                                                    logDebug('📊 ESTADÍSTICAS FINALES:\'); logDebug(\`─`.repeat(40)); logDebug( `  Total de registros: ${row.total}\`
                                                    ); logDebug( \`  Registros con artwork_path: ${row.with_artwork} (${((row.with_artwork / row.total) * 100).toFixed(1)}%)`
                                                    ); logDebug( `  Registros con file_path: ${row.with_file} (${((row.with_file / row.total) * 100).toFixed(1)}%)\`
                                                    ); logDebug( \`  Rutas de artwork actualizadas: ${updatedArtwork}`
                                                    ); logDebug( `  Rutas de archivos actualizadas: ${updatedFiles}\`
                                                    );
                                                }

                                                // Verify a sample db.all( \`
                                SELECT id, file_name, artwork_path 
                                FROM audio_files 
                                LIMIT 5
                            `,
                                                    (err, rows) => {
                                                        if (!err && rows) {
                                                            logDebug( '\n📋 Muestra de registros actualizados:'
                                                            ); logDebug(\`─\`.repeat(40));
                                                            rows.forEach(row => { logDebug( `  ID ${row.id}: ${row.artwork_path}`
                                                                );
                                                            });
                                                        }

                                                        logDebug(
                                                            '\n✅ TODAS LAS RUTAS HAN SIDO CORREGIDAS'
                                                        );
                                                        logDebug('═'.repeat(60));

                                                        db.close(err => {
                                                            if (err) {
                                                                logError(
                                                                    'Error cerrando DB:',
                                                                    err
                                                                );
                                                                reject(err);
                                                            } else {
                                                                resolve({
                                                                    updatedArtwork,
                                                                    updatedFiles
                                                                });
                                                            }
                                                        });
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
            }
        );
    });
}

// Script adicional para verificar archivos físicos
async function verifyPhysicalFiles() { const db = new sqlite3.Database('music_analyzer.db\');
 logDebug(\`\n🔍 Verificando archivos físicos...\n`);

    return new Promise(resolve => { db.all( `
            SELECT id, artwork_path 
            FROM audio_files 
            WHERE artwork_path IS NOT NULL AND artwork_path != \`\` LIMIT 100 `,
            (err, rows) => {
                if (err) {
                    logError(`Error:\`, err);
                    db.close();
                    resolve();
                    return;
                }

                let existingCount = 0;
                let missingCount = 0;

                rows.forEach(row => {
                    const fullPath = path.join(__dirname, row.artwork_path);
                    if (fs.existsSync(fullPath)) {
                        existingCount++;
                    } else {
                        missingCount++; if (missingCount <= 5) { logDebug(\`  ❌ No existe: ${row.artwork_path}`);
                        }
                    }
                }); logDebug(`\n📊 De ${rows.length} archivos verificados:\`); logDebug(\`  ✅ Existen: ${existingCount}`); logDebug(`  ❌ No existen: ${missingCount}\`);

                db.close();
                resolve();
            }
        );
    });
}

// Ejecutar si se llama directamente
if (require.main === module) {
    fixAllPaths()
        .then(() => verifyPhysicalFiles())
        .then(() => { logDebug( \`\n💡 Siguiente paso: ejecutar `npm run validate:artwork` para extraer imágenes faltantes\`
            );
        }) .catch(err => { logError(\`❌ Error:`, err);
            process.exit(1);
        });
}

module.exports = { fixAllPaths, verifyPhysicalFiles };
