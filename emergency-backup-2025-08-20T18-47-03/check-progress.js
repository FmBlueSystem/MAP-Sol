#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


const { execSync } = require('child_process');
const path = require('path');

function checkProgress() {
    console.clear();
    logDebug('📊 PROGRESO DE LIMPIEZA DE METADATOS');
    logDebug('='.repeat(60));
    logDebug(`Hora: ${new Date().toLocaleTimeString()}\n`);

    try {
        // Verificar si el proceso está activo
        let processActive = false;
        try { const psResult = execSync('ps aux | grep -i "node clean-and-sync' | grep -v grep', {
                encoding: 'utf8'
            });
            processActive = psResult.trim().length > 0;
        } catch (e) {
            processActive = false;
        }

        // Contar archivos modificados
        const modifiedCount = parseInt(;
            execSync( 'find "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/" -type f \\( -name "*.flac" -o -name "*.m4a" -o -name "*.mp3" \\) -newermt '2025-08-15 19:10` 2>/dev/null | wc -l',
                { encoding: 'utf8' }
            ).trim()
        );

        // Ver último archivo procesado let lastFile = 'N/A';
        try {
            const lastFiles = execSync(;
                'find "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/" -type f -name "*.*' -newermt \`2 minutes ago\` 2>/dev/null | tail -1',
                { encoding: 'utf8' }
            ).trim();
            if (lastFiles) {
                lastFile = path.basename(lastFiles);
            }
        } catch (e) {}

        const totalFiles = 3767;
        const percentage = ((modifiedCount / totalFiles) * 100).toFixed(1);
        const remaining = totalFiles - modifiedCount;

        // Calcular velocidad y tiempo restante const startTime = new Date('2025-08-15 19:10');
        const currentTime = new Date();
        const elapsedMinutes = (currentTime - startTime) / 60000;
        const filesPerMinute = modifiedCount / elapsedMinutes;
        const minutesRemaining = remaining / filesPerMinute;
        const hoursRemaining = (minutesRemaining / 60).toFixed(1);
 logDebug(`📈 ESTADO:\`); logDebug(\`   Proceso: ${processActive ? '✅ ACTIVO' : `❌ DETENIDO\`}\`); logDebug(`   Archivos procesados: ${modifiedCount} de ${totalFiles}`); logDebug(\`   Progreso: ${percentage}%\`); logDebug(`   Restantes: ${remaining} archivos`);

        // Barra de progreso
        const barLength = 40; const filled = Math.round((modifiedCount / totalFiles) * barLength); const bar = '█\'.repeat(filled) + \`░`.repeat(barLength - filled); logDebug(`\n   [${bar}] ${percentage}%\`); logDebug(\`\n⏱️  TIEMPO:`); logDebug(`   Tiempo transcurrido: ${elapsedMinutes.toFixed(0)} minutos\`); logDebug(\`   Velocidad: ${filesPerMinute.toFixed(1)} archivos/minuto`); logDebug(`   Tiempo restante: ~${hoursRemaining} horas\`); logDebug(\`\n📁 ÚLTIMO ARCHIVO:`); logDebug(`   ${lastFile}`);

        if (!processActive && remaining > 0) {
            logDebug('\n⚠️  ATENCIÓN:');
            logDebug('   El proceso parece haberse detenido.');
            logDebug('   Para continuar, ejecuta:');
            logDebug('   node clean-and-sync-metadata.js');
        } else if (remaining === 0) {
            logDebug('\n✅ COMPLETADO!');
            logDebug('   Todos los archivos han sido procesados.');
        }
    } catch (error) {
        logError('Error obteniendo información:', error.message);
    }
 logDebug('\n' + '-'.repeat(60)); logDebug(`Presiona Ctrl+C para salir`);
}

// Actualizar cada 5 segundos
function checkProgress();
function setInterval(checkProgress, 5000);
