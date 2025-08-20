#!/usr/bin/env node

/**
 * Script de validación para verificar que el fix de audio está funcionando
 */

const fs = require('fs');
const path = require('path');

logDebug('🔍 Validando fix de reproducción de audio...\n');

// Test 1: Verificar que los archivos necesarios existen
logDebug('Test 1: Verificando archivos...');

const filesToCheck = ['index-production.html', 'js/howler-path-fix.js', 'js/app-production.js', 'main-secure.js'];

let allFilesExist = true;
filesToCheck.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        logDebug(`  ✅ ${file} existe`);
    } else {
        logDebug(`  ❌ ${file} NO encontrado`);
        allFilesExist = false;
    }
});

// Test 2: Verificar que howler-path-fix.js está incluido en index-production.html
logDebug('\nTest 2: Verificando inclusión del fix en HTML...');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index-production.html'), 'utf8');
const hasHowlerFix = htmlContent.includes('howler-path-fix.js');
const hasCorrectOrder =
    htmlContent.indexOf('howler.min.js') < htmlContent.indexOf('howler-path-fix.js') &&
    htmlContent.indexOf('howler-path-fix.js') < htmlContent.indexOf('app-production.js');

if (hasHowlerFix) {
    logDebug('  ✅ howler-path-fix.js está incluido en el HTML');
} else {
    logDebug('  ❌ howler-path-fix.js NO está incluido en el HTML');
}

if (hasCorrectOrder) {
    logDebug('  ✅ Los scripts están en el orden correcto');
    logDebug('     1. howler.min.js');
    logDebug('     2. howler-path-fix.js');
    logDebug('     3. app-production.js');
} else {
    logDebug('  ❌ Los scripts NO están en el orden correcto');
}

// Test 3: Verificar el contenido del fix
logDebug('\nTest 3: Verificando contenido del fix...');

const fixContent = fs.readFileSync(path.join(__dirname, 'js/howler-path-fix.js'), 'utf8');
const hasFileProtocolFix = fixContent.includes("'file://'");
const hasConsoleLog = fixContent.includes('console.log');
const hasHowlOverride = fixContent.includes('window.Howl');

if (hasFileProtocolFix) {
    logDebug('  ✅ El fix añade el protocolo file://');
} else {
    logDebug('  ❌ El fix NO añade el protocolo file://');
}

if (hasHowlOverride) {
    logDebug('  ✅ El fix sobrescribe el constructor de Howl');
} else {
    logDebug('  ❌ El fix NO sobrescribe el constructor de Howl');
}

if (hasConsoleLog) {
    logDebug('  ✅ El fix incluye logs de depuración');
} else {
    logDebug('  ⚠️  El fix no incluye logs de depuración');
}

// Test 4: Verificar la base de datos
logDebug('\nTest 4: Verificando base de datos...');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('music_analyzer.db');

db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
    if (err) {
        logDebug('  ❌ Error al acceder a la base de datos:', err.message);
    } else {
        logDebug(`  ✅ Base de datos accesible - ${row.count} archivos de audio`);
    }

    // Verificar un archivo de muestra
    db.get('SELECT file_path FROM audio_files LIMIT 1', (err, row) => {
        if (err) {
            logDebug('  ❌ Error al obtener archivo de muestra:', err.message);
        } else if (row && row.file_path) {
            logDebug(`  ✅ Archivo de muestra: ${row.file_path.substring(0, 50)}...`);

            // Verificar que el archivo existe
            if (fs.existsSync(row.file_path)) {
                logDebug('  ✅ El archivo de audio existe en el sistema');
            } else {
                logDebug('  ⚠️  El archivo de audio no existe en la ruta especificada');
            }
        }

        db.close();

        // Resumen final
        logDebug('\n' + '='.repeat(60));
        logDebug('RESUMEN DE VALIDACIÓN:');
        logDebug('='.repeat(60));

        const allTestsPassed =
            allFilesExist && hasHowlerFix && hasCorrectOrder && hasFileProtocolFix && hasHowlOverride;

        if (allTestsPassed) {
            logDebug('\n✅ TODOS LOS TESTS PASARON - El fix está correctamente implementado');
            logDebug('\n📝 Próximos pasos:');
            logDebug('  1. Ejecutar la aplicación con: npm start');
            logDebug('  2. Hacer doble clic en cualquier canción para reproducir');
            logDebug('  3. Verificar en la consola que aparece el mensaje:');
            logDebug('     "🔊 Howler source fixed: file://..."');
            logDebug('  4. Si el audio se reproduce correctamente, el fix está funcionando');
        } else {
            logDebug('\n❌ ALGUNOS TESTS FALLARON - Revisar los errores arriba');
            logDebug('\n📝 Para solucionar:');
            logDebug('  1. Verificar que todos los archivos existen');
            logDebug('  2. Asegurarse que howler-path-fix.js está incluido en index-production.html');
            logDebug('  3. Verificar el orden de carga de scripts');
        }

        logDebug('\n💡 Para probar manualmente:');
        logDebug('  Abrir test-audio-validation.html en el navegador');
        logDebug('='.repeat(60));
    });
});
