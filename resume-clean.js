#!/usr/bin/env node

/**
 * RESUME CLEAN - Continúa la limpieza desde donde se interrumpió
 */

const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

logDebug(`
🔄 REANUDANDO LIMPIEZA DE METADATOS
${'='.repeat(60)}
');

// Verificar estado actual
const db = new sqlite3.Database('./music_analyzer.db');

db.get(
    `
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN AI_ANALYZED = 'YES' THEN 1 END) as processed
    FROM audio_files
',
    (err, row) => {
        if (err) {
            logError('❌ Error al verificar estado:', err);
            db.close();
            return;
        }

        const { total, processed } = row;
        const pending = total - processed;

        logDebug('📊 Estado actual:');
        logDebug(`   Total archivos: ${total}`);
        logDebug(`   Ya procesados: ${processed}`);
        logDebug(`   Pendientes: ${pending}`);
        logDebug();

        if (pending === 0) {
            logInfo('✅ Todos los archivos ya están procesados!');
            db.close();
            return;
        }

        logDebug(`⏳ Procesando ${pending} archivos restantes...`);
        logDebug('Esto puede tomar varios minutos...\n');

        db.close();

        try {
            // Ejecutar limpieza con flag de resume
            execSync('node clean-and-sync-metadata.js --resume', {
                stdio: 'inherit'
            });

            logDebug('\n✅ LIMPIEZA COMPLETADA');
        } catch (error) {
            logError('\n❌ Error durante la limpieza:', error.message);
            logDebug('💡 Puedes volver a ejecutar este script para continuar');
        }
    }
);
