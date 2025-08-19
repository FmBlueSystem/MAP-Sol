#!/usr/bin/env node

/**
 * Script para eliminar console.log de producción de forma segura
 * Reemplaza con sistema de logging profesional
 */

const fs = require('fs');
const path = require('path');

// Contadores
let totalFiles = 0;
let modifiedFiles = 0;
let consoleLogsRemoved = 0;
let consoleLogsReplaced = 0;

// Directorios a procesar
const directories = ['js', 'handlers', 'services'];

// Archivos a excluir
const excludeFiles = [
    'production-logger.js',
    'logger.js',
    'error-tracker.js',
    'remove-console-logs-safe.js'
];

/**
 * Procesa un archivo JavaScript
 */
function processFile(filePath) {
    // Skip si está en la lista de exclusión
    const fileName = path.basename(filePath);
    if (excludeFiles.includes(fileName)) {
        console.log(`⏭️  Skipping: ${fileName}`);
        return;
    }
    
    totalFiles++;
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Patrones para detectar console.log
        const patterns = [
            // console.log simple
            /console\.log\s*\(/g,
            // console.error que deberíamos mantener pero convertir
            /console\.error\s*\(/g,
            // console.warn que deberíamos mantener pero convertir
            /console\.warn\s*\(/g,
            // console.info
            /console\.info\s*\(/g,
            // console.debug
            /console\.debug\s*\(/g
        ];
        
        // Contar console.logs antes
        const logMatches = content.match(/console\.(log|info|debug)\s*\(/g);
        const logCount = logMatches ? logMatches.length : 0;
        
        // Reemplazos según el contexto
        if (logCount > 0) {
            // Para archivos críticos, convertir a logging apropiado
            content = content.replace(/console\.log\s*\(\s*['""]🔄/g, 'logInfo(\'🔄');
            content = content.replace(/console\.log\s*\(\s*['""]✅/g, 'logInfo(\'✅');
            content = content.replace(/console\.log\s*\(\s*['""]❌/g, 'logError(\'❌');
            content = content.replace(/console\.log\s*\(\s*['""]⚠️/g, 'logWarn(\'⚠️');
            content = content.replace(/console\.log\s*\(\s*['""]🚀/g, 'logInfo(\'🚀');
            content = content.replace(/console\.log\s*\(\s*['""]📦/g, 'logDebug(\'📦');
            content = content.replace(/console\.log\s*\(\s*['""]🎯/g, 'logDebug(\'🎯');
            content = content.replace(/console\.log\s*\(\s*['""]📊/g, 'logDebug(\'📊');
            
            // Reemplazar console.log genéricos con logDebug (se ocultarán en producción)
            content = content.replace(/console\.log\s*\(/g, 'logDebug(');
            
            // Mantener console.error y console.warn pero usar el nuevo sistema
            content = content.replace(/console\.error\s*\(/g, 'logError(');
            content = content.replace(/console\.warn\s*\(/g, 'logWarn(');
            content = content.replace(/console\.info\s*\(/g, 'logInfo(');
            content = content.replace(/console\.debug\s*\(/g, 'logDebug(');
            
            // Contar reemplazos
            const newLogMatches = content.match(/log(Debug|Info|Warn|Error)\s*\(/g);
            const replacedCount = newLogMatches ? newLogMatches.length : 0;
            
            if (content !== originalContent) {
                // Guardar archivo modificado
                fs.writeFileSync(filePath, content, 'utf8');
                modifiedFiles++;
                consoleLogsReplaced += replacedCount;
                console.log(`✅ Modified: ${filePath} (${replacedCount} logs converted)`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
}

/**
 * Procesa un directorio recursivamente
 */
function processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`⚠️  Directory not found: ${dirPath}`);
        return;
    }
    
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Recursivo para subdirectorios
            processDirectory(fullPath);
        } else if (file.endsWith('.js')) {
            processFile(fullPath);
        }
    });
}

// Función principal
function main() {
    console.log('🔍 Removing console.logs from production code...\n');
    
    // Procesar cada directorio
    directories.forEach(dir => {
        console.log(`📁 Processing ${dir}/...`);
        processDirectory(dir);
    });
    
    // También procesar archivos .js en la raíz
    const rootFiles = fs.readdirSync('.');
    rootFiles.forEach(file => {
        if (file.endsWith('.js') && !excludeFiles.includes(file)) {
            processFile(file);
        }
    });
    
    // Resumen
    console.log('\n📊 Summary:');
    console.log(`   Total files scanned: ${totalFiles}`);
    console.log(`   Files modified: ${modifiedFiles}`);
    console.log(`   Console.logs replaced: ${consoleLogsReplaced}`);
    
    if (consoleLogsReplaced > 0) {
        console.log('\n✅ Console.logs have been replaced with production-safe logging!');
        console.log('   - logDebug() → Hidden in production');
        console.log('   - logInfo() → Shown if important');
        console.log('   - logWarn() → Always shown');
        console.log('   - logError() → Always shown');
        console.log('\n📝 Remember to include production-logger.js in your HTML!');
    } else {
        console.log('\n✨ No console.logs found to replace!');
    }
}

// Ejecutar
main();