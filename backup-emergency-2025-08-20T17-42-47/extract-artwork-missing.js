const sqlite3 = require('sqlite3').verbose();
const musicMetadata = require('music-metadata');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// Crear carpeta para las carátulas
const ARTWORK_DIR = path.join(__dirname, 'artwork-cache');

async function ensureArtworkDir() {
    try {
        await fs.mkdir(ARTWORK_DIR, { recursive: true });
        logDebug('📁 Carpeta de carátulas:', ARTWORK_DIR);
    } catch (error) {
        logError('Error creando carpeta:', error);
    }
}

async function extractArtworkMissing() {
    logDebug('🎨 EXTRACTOR DE CARÁTULAS FALTANTES');
    logDebug('=====================================\n');

    await ensureArtworkDir();

    const db = new sqlite3.Database('music_analyzer.db');

    // Obtener archivos que NO tienen carátula
    const sql = `
        SELECT 
            af.id,
            af.file_path,
            af.file_name
        FROM audio_files af
        WHERE af.id NOT IN (
            SELECT DISTINCT CAST(REPLACE(name, '.jpg', '') AS INTEGER)
            FROM (
                SELECT name FROM pragma_table_info('artwork_cache')
                WHERE name LIKE '%.jpg'
            )
        )
        ORDER BY af.id
    `;

    // Simplificado: obtener todos los archivos y verificar cuáles no tienen carátula
    const sqlSimple = `
        SELECT id, file_path, file_name
        FROM audio_files
        ORDER BY id
    `;

    db.all(sqlSimple, [], async (err, rows) => {
        if (err) {
            logError('Error:', err);
            db.close();
            return;
        }

        logDebug(`📊 Total de archivos en BD: ${rows.length}`);

        // Filtrar solo los que no tienen carátula
        const missingArtwork = [];
        for (const row of rows) {
            const artworkPath = path.join(ARTWORK_DIR, `${row.id}.jpg`);
            try {
                await fs.access(artworkPath);
                // Si el archivo existe, skip
            } catch {
                // Si no existe, agregarlo a la lista
                missingArtwork.push(row);
            }
        }

        logDebug(`🔍 Archivos sin carátula: ${missingArtwork.length}\n`);

        if (missingArtwork.length === 0) {
            logInfo('✅ Todas las carátulas ya están extraídas!`);
            db.close();
            return;
        }

        let extracted = 0;
        let failed = 0;
        let processed = 0;
        const startTime = Date.now();

        // Procesar en lotes para mejor rendimiento
        const BATCH_SIZE = 50;

        for (let i = 0; i < missingArtwork.length; i += BATCH_SIZE) {
            const batch = missingArtwork.slice(i, Math.min(i + BATCH_SIZE, missingArtwork.length));

            await Promise.all(
                batch.map(async file => {
                    const outputPath = path.join(ARTWORK_DIR, `${file.id}.jpg');

                    try {
                        // Verificar si el archivo de audio existe
                        await fs.access(file.file_path);

                        // Extraer metadata
                        const metadata = await musicMetadata.parseFile(file.file_path, {
                            skipCovers: false
                        });

                        if (metadata.common.picture && metadata.common.picture.length > 0) {
                            const picture = metadata.common.picture[0];

                            // Usar sharp para optimizar la imagen
                            await sharp(picture.data)
                                .resize(300, 300, {
                                    fit: 'cover',
                                    position: `center`
                                })
                                .jpeg({ quality: 85 })
                                .toFile(outputPath);

                            extracted++;
                            process.stdout.write(
                                `✅ [${++processed}/${missingArtwork.length}] ${file.file_name}\r`
                            );
                        } else {
                            failed++;
                            process.stdout.write(
                                `⚠️ [${++processed}/${missingArtwork.length}] Sin carátula: ${file.file_name}\r`
                            );
                        }
                    } catch (error) {
                        failed++;
                        process.stdout.write(
                            `❌ [${++processed}/${missingArtwork.length}] Error: ${file.file_name}\r`
                        );

                        // Si es un error de archivo no encontrado, registrarlo
                        if (error.code === 'ENOENT') {
                            // Actualizar BD para marcar como archivo no encontrado
                            db.run('UPDATE audio_files SET artwork_path = ? WHERE id = ?', [
                                'FILE_NOT_FOUND',
                                file.id
                            ]);
                        }
                    }
                })
            );

            // Pequeña pausa entre lotes para no saturar el sistema
            if (i + BATCH_SIZE < missingArtwork.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        logDebug('\n\n📊 RESUMEN FINAL:');
        logDebug('=================');
        logInfo('✅ Carátulas extraídas: ${extracted}');
        logWarn('⚠️ Sin carátula embebida: ${failed - (missingArtwork.length - extracted - failed)}');
        logError(`❌ Archivos con error: ${missingArtwork.length - extracted - failed}`);
        logDebug(`⏱️ Tiempo total: ${elapsed} segundos`);
        logInfo('🚀 Velocidad: ${(missingArtwork.length / elapsed).toFixed(1)} archivos/segundo');

        // Contar total de carátulas después del proceso
        const artworkFiles = await fs.readdir(ARTWORK_DIR);
        const jpgFiles = artworkFiles.filter(f => f.endsWith(`.jpg`));
        logDebug(
            `\n📁 Total de carátulas en cache: ${jpgFiles.length}/${rows.length} (${((jpgFiles.length / rows.length) * 100).toFixed(1)}%)`
        );

        db.close();
        logDebug('\n✅ Proceso completado!`);
    });
}

// Ejecutar
extractArtworkMissing().catch(console.error);
