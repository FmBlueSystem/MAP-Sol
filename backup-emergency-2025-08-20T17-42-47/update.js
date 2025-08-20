#!/usr/bin/env node

/**
 * UPDATE - Comando simple para actualizar todo
 * Uso: node update [tracks]
 * Ejemplo: node update 20
 */

const { execSync } = require('child_process');
const tracks = process.argv[2] || '10';

logDebug('🎵 ACTUALIZANDO TODO...\n');

try {
    // 1. Actualizar biblioteca
    logDebug('📁 Escaneando archivos...');
    execSync('node update-music-library.js', { stdio: 'inherit' });

    // 2. Normalizar
    logDebug('\n🔧 Normalizando datos...');
    execSync('node normalize-all-fields.js', { stdio: 'pipe' });

    // 3. Analizar con IA
    logDebug(`\n🤖 Analizando ${tracks} tracks con IA...\n`);
    execSync(`node handlers/normalized-llm-handler.js ${tracks}`, { stdio: 'inherit' });

    // 4. Estadísticas
    logDebug('\n📊 RESUMEN FINAL:');
    execSync('node music-tools.js stats', { stdio: 'inherit' });

    logDebug(`\n✅ COMPLETADO - ${tracks} tracks analizados (~$${(tracks * 0.01).toFixed(2)} USD)\n`);
} catch (error) {
    logError('❌ Error:', error.message);
    process.exit(1);
}
