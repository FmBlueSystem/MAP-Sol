#!/usr/bin/env node

/**
 * CLEAN ALL - Limpia y sincroniza TODOS los archivos
 */

const { execSync } = require('child_process');
const readline = require('readline');

logDebug(`
🧹 LIMPIEZA COMPLETA DE BIBLIOTECA MUSICAL
${'='.repeat(60)}

Este comando:
1. ELIMINARÁ todos los metadatos de IA de los archivos
2. MANTENDRÁ solo: título, artista, álbum, género, año
3. AGREGARÁ marca de fecha/hora a los archivos analizados

Los archivos analizados tendrán:
• AI_ANALYZED="YES"
• DB_SYNC_DATE="DD/MM/YYYY"
• DB_SYNC_TIME="HH:MM:SS"

⚠️  ESTO MODIFICARÁ LOS 3,767 ARCHIVOS DE TU BIBLIOTECA
");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('¿Estás seguro de que quieres continuar? (s/n): ', answer => {
    rl.close();

    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'si') {
        logDebug('\n🚀 Iniciando limpieza completa...\n');
        logDebug('Esto puede tomar 30-60 minutos. Por favor espera...\n');

        try {
            // Ejecutar limpieza completa
            execSync('node clean-and-sync-metadata.js', {
                stdio: 'inherit'
            });

            logDebug('\n✅ LIMPIEZA COMPLETA TERMINADA');
            logDebug('Todos los archivos han sido procesados.');
        } catch (error) {
            logError('\n❌ Error durante la limpieza:', error.message);
        }
    } else {
        logDebug('\n❌ Operación cancelada');
    }
});
