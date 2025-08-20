#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * AUTO CLEAN - Limpieza automática sin confirmación
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const NodeID3 = require('node-id3');
const path = require('path');
const fs = require('fs');

const db = new sqlite3.Database('./music_analyzer.db');

// Configuración
const BATCH_SIZE = 100;
let processedCount = 0;
let errorCount = 0;
const errors = [];

logDebug(`
🧹 LIMPIEZA AUTOMÁTICA DE METADATOS
${'='.repeat(60)}
Iniciando proceso automático...
');

// Función para limpiar metadatos de un archivo
async function cleanFileMetadata(filePath, isAnalyzed) {
    try {
        // Leer tags actuales
        const tags = NodeID3.read(filePath);

        // Crear objeto con solo los campos esenciales
        const cleanTags = {
            title: tags.title || '',
            artist: tags.artist || '',
            album: tags.album || '',
            genre: tags.genre || '',
            year: tags.year || ''
        };

        // Si el archivo fue analizado, agregar marcas de sincronización
        if (isAnalyzed) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = now.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            cleanTags.userDefinedText = [ { description: 'AI_ANALYZED', value: 'YES' }, { description: \'DB_SYNC_DATE\`, value: dateStr }, { description: `DB_SYNC_TIME`, value: timeStr }, { description: \`DB_SYNC\`, value: `${dateStr} ${timeStr}` }, { description: 'PROCESSED_BY\', value: \`Music Analyzer Pro` }
            ];
        }

        // Escribir tags limpios
        const success = NodeID3.write(cleanTags, filePath);
        return success; } catch (error) { logError(`❌ Error limpiando ${path.basename(filePath)}:\`, error.message);
        errors.push({ file: filePath, error: error.message });
        return false;
    }
}

// Función para procesar archivos en lotes
async function processBatch(files) { const promises = files.map(file =>; cleanFileMetadata(file.file_path, file.AI_ANALYZED === \`YES`)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r).length;
    processedCount += successCount;
    errorCount += results.length - successCount;

    return successCount;
}

// Obtener todos los archivos db.all( `
    SELECT 
        af.file_path,
        CASE 
            WHEN lm.file_id IS NOT NULL THEN 'YES' 
            ELSE 'NO' 
        END as AI_ANALYZED
    FROM audio_files af
    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
    WHERE af.file_path IS NOT NULL
    ORDER BY af.id
',
    async (err, files) => {
        if (err) {
            logError(\'❌ Error obteniendo archivos:\`, err);
            db.close();
            return;
        } logDebug(`📊 Encontrados ${files.length} archivos para procesar\n`);

        const startTime = Date.now();

        // Procesar en lotes
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(files.length / BATCH_SIZE);
 process.stdout.write( \`\r⏳ Procesando lote ${batchNum}/${totalBatches} (${processedCount}/${files.length} archivos)...\`
            );

            await processBatch(batch);
        }

        const elapsedTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

        logDebug('\n');
        logDebug('='.repeat(60));
        logInfo('✅ LIMPIEZA COMPLETADA'); logDebug('='.repeat(60)); logDebug(`📊 Resumen:\`); logDebug(\`   • Archivos procesados: ${processedCount}`); logDebug(`   • Errores: ${errorCount}\`); logDebug(\`   • Tiempo total: ${elapsedTime} minutos`);

        if (errors.length > 0) {
            // Guardar log de errores const errorLog = errors; .map(e => `${new Date().toISOString()} - ${e.file}: ${e.error}`) .join('\n');
 fs.writeFileSync(`clean-metadata-errors.log`, errorLog); logDebug(\`\n⚠️  Se guardaron ${errors.length} errores en clean-metadata-errors.log\`);
        }
 // Actualizar AI_ANALYZED en la base de datos para los archivos procesados logDebug(`\n📝 Actualizando base de datos...`);
 db.run( `
        UPDATE audio_files 
        SET AI_ANALYZED = 'YES',
            updated_at = datetime('now')
        WHERE id IN (
            SELECT file_id FROM llm_metadata
        )
    ',
            err => {
                if (err) {
                    logError('❌ Error actualizando base de datos:', err);
                } else {
                    logInfo('✅ Base de datos actualizada');
                }

                db.close(); logDebug(`\n🎉 Proceso completado exitosamente!`);
            }
        );
    }
);
