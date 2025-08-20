#!/usr/bin/env node

/**
 * Script de diagnóstico y corrección para errores de sintaxis
 * Ejecutar con: node diagnose-and-fix.js
 */

const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para contar caracteres de apertura y cierre
function countBrackets(content) {
    const counts = {
        openBrace: (content.match(/{/g) || []).length,
        closeBrace: (content.match(/}/g) || []).length,
        openParen: (content.match(/\(/g) || []).length,
        closeParen: (content.match(/\)/g) || []).length,
        openBracket: (content.match(/\[/g) || []).length,
        closeBracket: (content.match(/\]/g) || []).length
    };
    return counts;
}

// Función para detectar strings sin cerrar
function detectUnclosedStrings(content) {
    const lines = content.split('\n');
    const issues = [];
    
    lines.forEach((line, index) => {
        // Detectar comillas simples sin cerrar
        const singleQuotes = (line.match(/'/g) || []).length;
        if (singleQuotes % 2 !== 0) {
            // Verificar si no es parte de un comentario
            if (!line.trim().startsWith('//')) {
                issues.push({
                    line: index + 1,
                    type: 'Unclosed single quote',
                    content: line.trim()
                });
            }
        }
        
        // Detectar comillas dobles sin cerrar
        const doubleQuotes = (line.match(/"/g) || []).length;
        if (doubleQuotes % 2 !== 0) {
            if (!line.trim().startsWith('//')) {
                issues.push({
                    line: index + 1,
                    type: 'Unclosed double quote',
                    content: line.trim()
                });
            }
        }
        
        // Detectar template literals sin cerrar
        const backticks = (line.match(/`/g) || []).length;
        if (backticks % 2 !== 0) {
            issues.push({
                line: index + 1,
                type: 'Unclosed template literal',
                content: line.trim()
            });
        }
    });
    
    return issues;
}

// Función para detectar comentarios mal cerrados
function detectUnclosedComments(content) {
    const openComments = (content.match(/\/\*/g) || []).length;
    const closeComments = (content.match(/\*\//g) || []).length;
    
    if (openComments !== closeComments) {
        return {
            issue: true,
            openCount: openComments,
            closeCount: closeComments,
            difference: openComments - closeComments
        };
    }
    return { issue: false };
}

// Función principal de diagnóstico
function diagnoseFile(filePath) {
    log(`\n${'='.repeat(60)}`, 'blue');
    log(`Analizando: ${filePath}`, 'magenta');
    log('='.repeat(60), 'blue');
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // 1. Información básica
        log(`\n📊 Información básica:`, 'yellow');
        log(`   Total de líneas: ${lines.length}`);
        log(`   Tamaño: ${(content.length / 1024).toFixed(2)} KB`);
        
        // 2. Conteo de brackets
        const brackets = countBrackets(content);
        log(`\n🔍 Análisis de brackets:`, 'yellow');
        
        let hasIssue = false;
        if (brackets.openBrace !== brackets.closeBrace) {
            log(`   ❌ Llaves: ${brackets.openBrace} abiertas, ${brackets.closeBrace} cerradas`, 'red');
            hasIssue = true;
        } else {
            log(`   ✅ Llaves: ${brackets.openBrace} pares balanceados`, 'green');
        }
        
        if (brackets.openParen !== brackets.closeParen) {
            log(`   ❌ Paréntesis: ${brackets.openParen} abiertos, ${brackets.closeParen} cerrados`, 'red');
            hasIssue = true;
        } else {
            log(`   ✅ Paréntesis: ${brackets.openParen} pares balanceados`, 'green');
        }
        
        if (brackets.openBracket !== brackets.closeBracket) {
            log(`   ❌ Corchetes: ${brackets.openBracket} abiertos, ${brackets.closeBracket} cerrados`, 'red');
            hasIssue = true;
        } else {
            log(`   ✅ Corchetes: ${brackets.openBracket} pares balanceados`, 'green');
        }
        
        // 3. Detectar strings sin cerrar
        const stringIssues = detectUnclosedStrings(content);
        if (stringIssues.length > 0) {
            log(`\n⚠️  Posibles strings sin cerrar:`, 'yellow');
            stringIssues.forEach(issue => {
                log(`   Línea ${issue.line}: ${issue.type}`, 'red');
                log(`   > ${issue.content.substring(0, 80)}...`);
            });
            hasIssue = true;
        }
        
        // 4. Detectar comentarios sin cerrar
        const commentIssues = detectUnclosedComments(content);
        if (commentIssues.issue) {
            log(`\n⚠️  Comentarios mal cerrados:`, 'yellow');
            log(`   Abiertos: ${commentIssues.openCount}, Cerrados: ${commentIssues.closeCount}`, 'red');
            hasIssue = true;
        }
        
        // 5. Buscar patrones problemáticos
        log(`\n🔎 Búsqueda de patrones problemáticos:`, 'yellow');
        
        // Buscar funciones que podrían no estar cerradas
        const functionDeclarations = content.match(/function\s+\w+\s*\([^)]*\)\s*{/g) || [];
        const arrowFunctions = content.match(/\([^)]*\)\s*=>\s*{/g) || [];
        log(`   Declaraciones de función: ${functionDeclarations.length}`);
        log(`   Arrow functions: ${arrowFunctions.length}`);
        
        // 6. Verificar la última línea
        const lastNonEmptyLine = lines.filter(l => l.trim()).pop();
        if (lastNonEmptyLine) {
            log(`\n📝 Última línea con contenido:`, 'yellow');
            log(`   "${lastNonEmptyLine.trim()}"`);
            
            if (lastNonEmptyLine.trim().endsWith('{') || 
                lastNonEmptyLine.trim().endsWith('(') ||
                lastNonEmptyLine.trim().endsWith('[')) {
                log(`   ⚠️  La última línea parece incompleta`, 'red');
                hasIssue = true;
            }
        }
        
        // 7. Resultado final
        log(`\n📋 Resultado del diagnóstico:`, 'yellow');
        if (hasIssue) {
            log(`   ❌ Se detectaron posibles problemas de sintaxis`, 'red');
        } else {
            log(`   ✅ No se detectaron problemas obvios de sintaxis`, 'green');
        }
        
        return { hasIssue, content, lines };
        
    } catch (error) {
        log(`   ❌ Error al leer el archivo: ${error.message}`, 'red');
        return { hasIssue: true, error };
    }
}

// Función para intentar auto-corrección
function attemptAutoFix(filePath, content, lines) {
    log(`\n🔧 Intentando auto-corrección...`, 'yellow');
    
    let fixed = content;
    let changesMade = false;
    
    // 1. Verificar si falta un cierre al final
    const brackets = countBrackets(content);
    
    if (brackets.openBrace > brackets.closeBrace) {
        const diff = brackets.openBrace - brackets.closeBrace;
        log(`   Agregando ${diff} llaves de cierre al final...`);
        fixed += '\n' + '}'.repeat(diff);
        changesMade = true;
    }
    
    if (brackets.openParen > brackets.closeParen) {
        const diff = brackets.openParen - brackets.closeParen;
        log(`   Agregando ${diff} paréntesis de cierre al final...`);
        fixed += ')'.repeat(diff);
        changesMade = true;
    }
    
    if (brackets.openBracket > brackets.closeBracket) {
        const diff = brackets.openBracket - brackets.closeBracket;
        log(`   Agregando ${diff} corchetes de cierre al final...`);
        fixed += ']'.repeat(diff);
        changesMade = true;
    }
    
    if (changesMade) {
        // Crear backup
        const backupPath = filePath + '.backup_' + Date.now();
        fs.writeFileSync(backupPath, content);
        log(`   📁 Backup creado: ${backupPath}`, 'green');
        
        // Escribir archivo corregido
        fs.writeFileSync(filePath, fixed);
        log(`   ✅ Archivo corregido y guardado`, 'green');
        
        return true;
    }
    
    log(`   ℹ️  No se realizaron cambios automáticos`, 'blue');
    return false;
}

// Archivos a diagnosticar
const filesToCheck = [
    'utils/artwork-helper.js',
    'js/audio-panel.js',
    'preload.js'
];

// Ejecutar diagnóstico
log('🏥 DIAGNÓSTICO DE ERRORES DE SINTAXIS', 'magenta');
log('=' * 60, 'magenta');

filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        const result = diagnoseFile(fullPath);
        
        if (result.hasIssue && result.content) {
            const shouldFix = process.argv.includes('--fix');
            if (shouldFix) {
                attemptAutoFix(fullPath, result.content, result.lines);
            } else {
                log(`\n   💡 Ejecuta con --fix para intentar corrección automática`, 'yellow');
            }
        }
    } else {
        log(`\n⚠️  Archivo no encontrado: ${file}`, 'red');
    }
});

log(`\n${'='.repeat(60)}`, 'blue');
log('Diagnóstico completado', 'green');
log('Para aplicar correcciones automáticas, ejecuta: node diagnose-and-fix.js --fix', 'yellow');