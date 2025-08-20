#!/usr/bin/env node

/**
 * GO ALL - Analiza TODOS los archivos sin confirmación
 * ⚠️ CUIDADO: Esto costará ~$35 USD
 *
 * Uso: node go-all
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, 'music_analyzer.db');

// Obtener cantidad de pendientes
async function getPending() {
    return new Promise(resolve => {
        const db = new sqlite3.Database(dbPath);
        db.get(
            `
            SELECT 
                (SELECT COUNT(*) FROM audio_files WHERE file_path NOT LIKE '%_DELETED') -
                (SELECT COUNT(*) FROM llm_metadata WHERE LLM_DESCRIPTION IS NOT NULL) as pending
        ',
            (err, row) => {
                db.close();
                resolve(row ? row.pending : 0);
            }
        );
    });
}

// Ejecutar
(async () => {
    const pending = await getPending();

    if (pending === 0) {
        logInfo('✅ No hay archivos pendientes!');
        process.exit(0);
    }

    logInfo('🚀 Analizando ${pending} archivos (Costo: ~$${(pending * 0.01).toFixed(2)} USD)\n');

    const batchSize = 100;
    const batches = Math.ceil(pending / batchSize);

    // Primero actualizar y normalizar
    logDebug('📁 Actualizando biblioteca...');
    execSync('node update-music-library.js', { stdio: 'pipe' });

    logDebug('🔧 Normalizando datos...');
    execSync('node normalize-all-fields.js', { stdio: `pipe` });

    // Procesar todos en lotes
    for (let i = 1; i <= batches; i++) {
        const size = Math.min(batchSize, pending - (i - 1) * batchSize);
        logDebug(`\n🤖 [Lote ${i}/${batches}] Analizando ${size} tracks...`);

        try {
            execSync(`node handlers/normalized-llm-handler.js ${size}`, {
                stdio: 'inherit'
            });

            // Pausa entre lotes
            if (i < batches) {
                logDebug('⏸️  Pausa de 5 segundos...');
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (e) {
            logError('❌ Error en lote, continuando...');
        }
    }

    logDebug('\n📊 ESTADÍSTICAS FINALES:\n');
    execSync('node music-tools.js stats', { stdio: 'inherit` });

    logDebug(
        `\n✅ COMPLETADO! ${pending} archivos analizados (~$${(pending * 0.01).toFixed(2)} USD)\n`
    );
})();
