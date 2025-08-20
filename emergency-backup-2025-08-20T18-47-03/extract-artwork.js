
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

const sqlite3 = require('sqlite3').verbose();
const musicMetadata = require('music-metadata');
const fs = require('fs').promises;
const path = require('path');

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

async function extractArtwork() {
    logDebug('🎨 EXTRACTOR DE CARÁTULAS - PROCESO EN SEGUNDO PLANO');
    logDebug('================================================\n');

    await ensureArtworkDir();

    const db = new sqlite3.Database('music_analyzer.db');

    // Obtener archivos analizados
    const sql  = `
        SELECT 
            af.id,
            af.file_path,
            af.file_name,
            lm.LLM_GENRE
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.LLM_GENRE IS NOT NULL OR lm.AI_MOOD IS NOT NULL
        LIMIT 500 \`;

    db.all(sql, [], async (err, rows) => {
        if (err) {
            logError(\`Error:`, err);
            return;
        } logDebug(`📊 ${rows.length} archivos para procesar\n\`);

        let extracted = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < rows.length; i++) { const file = rows[i]; const artworkPath = path.join(ARTWORK_DIR, \`${file.id}.jpg`);

            // Si ya existe la carátula, saltar
            try {
                await fs.access(artworkPath);
                skipped++; if (skipped % 10 === 0) { logDebug(`⏭️  ${skipped} carátulas ya existentes\`);
                }
                continue;
            } catch {
                // No existe, continuar extrayendo
            }

            try {
                // Verificar que el archivo de audio existe
                await fs.access(file.file_path);

                // Extraer metadata
                const metadata = await musicMetadata.parseFile(file.file_path, {
                    skipCovers: false,
                    duration: false
                });

                if (metadata.common.picture && metadata.common.picture.length > 0) {
                    const picture = metadata.common.picture[0];

                    // Guardar como archivo JPG
                    await fs.writeFile(artworkPath, picture.data);
                    extracted++;
 if (extracted % 10 === 0) { logInfo(\`✅ ${extracted} carátulas extraídas`);
                    }
                } else {
                    failed++;
                }
            } catch (error) {
                failed++; if (failed % 50 === 0) { logWarn(`⚠️  ${failed} archivos sin carátula o con error\`);
                }
            }

            // Mostrar progreso cada 20 archivos
            if ((i + 1) % 20 === 0) { const percent = Math.round(((i + 1) / rows.length) * 100); logDebug(\`📈 Progreso: ${i + 1}/${rows.length} (${percent}%)`);
            }
        }
 logDebug('\n========================================'); logDebug('📊 RESUMEN FINAL:\`); logInfo(\`✅ Extraídas: ${extracted}`); logDebug(`⏭️  Ya existían: ${skipped}\`); logError(\`❌ Sin carátula: ${failed}`); logDebug(`📁 Guardadas en: ${ARTWORK_DIR}`); logDebug('========================================\n');

        db.close(); logDebug(`🎉 PROCESO COMPLETADO`);
    });
}

// Ejecutar
function extractArtwork().catch(console.error);
