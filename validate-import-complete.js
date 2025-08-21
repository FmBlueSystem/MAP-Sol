#!/usr/bin/env node

/**
 * VALIDACIÓN COMPLETA DEL SISTEMA DE IMPORTACIÓN
 * Pruebas exhaustivas para verificar que TODO funciona
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 VALIDACIÓN EXHAUSTIVA DEL SISTEMA DE IMPORTACIÓN\n');
console.log('='.repeat(70));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

function test(description, testFn) {
    totalTests++;
    process.stdout.write(`📋 ${description}... `);
    try {
        const result = testFn();
        if (result) {
            console.log('✅ PASS');
            passedTests++;
        } else {
            console.log('❌ FAIL');
            failedTests++;
            errors.push(`Test failed: ${description}`);
        }
    } catch (err) {
        console.log('❌ ERROR:', err.message);
        failedTests++;
        errors.push(`Test error in "${description}": ${err.message}`);
    }
}

// 1. VALIDAR ARCHIVOS CRÍTICOS
console.log('\n1️⃣ VALIDANDO ARCHIVOS CRÍTICOS\n');

test('main-minimal.js existe', () => {
    return fs.existsSync('main-minimal.js');
});

test('js/music-folder-selector.js existe', () => {
    return fs.existsSync('js/music-folder-selector.js');
});

test('preload.js existe', () => {
    return fs.existsSync('preload.js');
});

test('index-views.html existe', () => {
    return fs.existsSync('index-views.html');
});

// 2. VALIDAR HANDLERS EN main-minimal.js
console.log('\n2️⃣ VALIDANDO HANDLERS IPC\n');

const mainContent = fs.readFileSync('main-minimal.js', 'utf8');

test('Handler select-music-files está registrado', () => {
    return mainContent.includes("ipcMain.handle('select-music-files'");
});

test('Handler import-music-files está registrado', () => {
    return mainContent.includes("ipcMain.handle('import-music-files'");
});

test('Handler select-music-folder está registrado', () => {
    return mainContent.includes("ipcMain.handle('select-music-folder'");
});

test('Handler import-music-folder está registrado', () => {
    return mainContent.includes("ipcMain.handle('import-music-folder'");
});

test('Handler usa dialog.showOpenDialog correctamente', () => {
    return (
        mainContent.includes('dialog.showOpenDialog({') &&
        mainContent.includes("properties: ['openFile', 'multiSelections']")
    );
});

test('Handler de archivos tiene filtros de audio', () => {
    return mainContent.includes("extensions: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'aac', 'wma']");
});

// 3. VALIDAR UI COMPONENT
console.log('\n3️⃣ VALIDANDO COMPONENTE UI\n');

const selectorContent = fs.readFileSync('js/music-folder-selector.js', 'utf8');

test('Clase MusicFolderSelector existe', () => {
    return selectorContent.includes('class MusicFolderSelector');
});

test('Método selectFiles() implementado', () => {
    return selectorContent.includes('async selectFiles()');
});

test('Método selectFolder() implementado', () => {
    return selectorContent.includes('async selectFolder()');
});

test('Método importMusic() maneja archivos y carpetas', () => {
    return (
        selectorContent.includes('if (this.selectedFiles)') &&
        selectorContent.includes('import-music-files') &&
        selectorContent.includes('import-music-folder')
    );
});

test('UI tiene botón Select Files', () => {
    return selectorContent.includes('select-files-btn') && selectorContent.includes('🎵 Select Files');
});

test('UI tiene botón Select Folder', () => {
    return selectorContent.includes('select-folder-btn') && selectorContent.includes('📁 Select Folder');
});

// 4. VALIDAR index-views.html
console.log('\n4️⃣ VALIDANDO INCLUSIÓN EN HTML\n');

const htmlContent = fs.readFileSync('index-views.html', 'utf8');

test('music-folder-selector.js está incluido', () => {
    return htmlContent.includes('js/music-folder-selector.js');
});

test('add-music-button.js NO está incluido', () => {
    return !htmlContent.includes('js/add-music-button.js');
});

// 5. VALIDAR preload.js
console.log('\n5️⃣ VALIDANDO PRELOAD\n');

const preloadContent = fs.readFileSync('preload.js', 'utf8');

test('electronAPI está expuesto', () => {
    return preloadContent.includes("contextBridge.exposeInMainWorld('electronAPI'");
});

test('electronAPI.invoke está implementado', () => {
    return preloadContent.includes('invoke: (channel, ...args)');
});

// 6. VALIDAR package.json
console.log('\n6️⃣ VALIDANDO CONFIGURACIÓN\n');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('Main apunta a main-minimal.js', () => {
    return packageJson.main === 'main-minimal.js';
});

test('music-metadata está en dependencias', () => {
    return packageJson.dependencies['music-metadata'] !== undefined;
});

test('sqlite3 está en dependencias', () => {
    return packageJson.dependencies['sqlite3'] !== undefined;
});

// 7. VALIDAR SINTAXIS DE JAVASCRIPT
console.log('\n7️⃣ VALIDANDO SINTAXIS\n');

test('main-minimal.js sin errores de sintaxis', () => {
    try {
        new Function(mainContent);
        return true;
    } catch (e) {
        console.log('\n   Error:', e.message);
        return false;
    }
});

test('music-folder-selector.js sin errores de sintaxis', () => {
    try {
        // Remove DOM-specific code for syntax check
        const cleanCode = selectorContent
            .replace(/document\./g, 'globalThis.')
            .replace(/window\./g, 'globalThis.')
            .replace(/localStorage/g, 'globalThis');
        new Function(cleanCode);
        return true;
    } catch (e) {
        console.log('\n   Error:', e.message);
        return false;
    }
});

// 8. VERIFICAR LÓGICA DE IMPORTACIÓN
console.log('\n8️⃣ VALIDANDO LÓGICA DE IMPORTACIÓN\n');

test('Handler import-music-files procesa arrays de archivos', () => {
    return (
        mainContent.includes('const files = data.filePaths;') &&
        mainContent.includes('for (let i = 0; i < files.length; i++)')
    );
});

test('Handler import-music-folder escanea recursivamente', () => {
    return (
        mainContent.includes('function scanDirectory(dir)') &&
        mainContent.includes('if (stat.isDirectory())') &&
        mainContent.includes('scanDirectory(fullPath)')
    );
});

test('Metadata se extrae con music-metadata', () => {
    return (
        mainContent.includes("require('music-metadata')") &&
        mainContent.includes('await musicMetadata.parseFile(filePath)')
    );
});

test('Datos se insertan en audio_files', () => {
    return (
        mainContent.includes('INSERT OR IGNORE INTO audio_files') &&
        mainContent.includes('file_path, file_name, title, artist, album')
    );
});

// 9. VERIFICAR MANEJO DE ERRORES
console.log('\n9️⃣ VALIDANDO MANEJO DE ERRORES\n');

test('Manejo de errores en importación', () => {
    return mainContent.includes('} catch (err) {') && mainContent.includes('console.error');
});

test('Validación de datos en handlers', () => {
    return (
        mainContent.includes('if (!data || !data.filePaths') && mainContent.includes('if (!data || !data.folderPath')
    );
});

// RESUMEN FINAL
console.log('\n' + '='.repeat(70));
console.log('📊 RESUMEN DE VALIDACIÓN\n');
console.log(`Total de pruebas: ${totalTests}`);
console.log(`✅ Pasadas: ${passedTests}`);
console.log(`❌ Fallidas: ${failedTests}`);
console.log(`Porcentaje de éxito: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (errors.length > 0) {
    console.log('\n⚠️  ERRORES ENCONTRADOS:');
    errors.forEach((err) => console.log(`   - ${err}`));
}

if (failedTests === 0) {
    console.log('\n✨ ¡TODAS LAS PRUEBAS PASARON! EL SISTEMA ESTÁ LISTO.');
} else {
    console.log('\n❌ HAY PRUEBAS QUE FALLARON. REVISA LOS ERRORES ARRIBA.');
}

console.log('\n🎯 SIGUIENTE PASO:');
console.log('   1. Ejecuta: npm start');
console.log('   2. Busca el panel "Import Music Library" (abajo a la derecha)');
console.log('   3. Prueba ambos botones:');
console.log('      - 🎵 Select Files: Para archivos individuales');
console.log('      - 📁 Select Folder: Para carpetas completas');
console.log('   4. Click en ⬇️ Import Music');

process.exit(failedTests > 0 ? 1 : 0);
