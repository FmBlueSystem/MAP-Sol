#!/usr/bin/env node

/**
 * Script para arreglar los errores de sintaxis restantes
 * Específicamente diseñado para MAP v3.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

console.log('\n🔧 ARREGLANDO ERRORES DE SINTAXIS RESTANTES\n');

// Obtener todos los archivos JS
function getAllJSFiles() {
    try {
        const output = execSync('find . -name "*.js" -not -path "./node_modules/*" -not -path "./backup*/*" -type f', {
            encoding: 'utf8',
        });
        return output.split('\n').filter((f) => f);
    } catch (error) {
        return [];
    }
}

// Verificar si un archivo tiene errores
function hasErrors(file) {
    try {
        execSync(`node -c "${file}" 2>&1`);
        return false;
    } catch (error) {
        return true;
    }
}

// Obtener el error específico
function getError(file) {
    try {
        execSync(`node -c "${file}" 2>&1`);
        return null;
    } catch (error) {
        return error.message || error.toString();
    }
}

// Arreglar errores específicos
function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const original = content;
        let fixed = false;

        // Fix 1: Template literals mal cerrados
        content = content.replace(/`([^`]*)\$\{([^}]*)\}([^`]*)'/gm, '`$1\${$2}$3`');
        content = content.replace(/`([^`]*)\$\{([^}]*)\}([^`]*)"/gm, '`$1\${$2}$3`');
        content = content.replace(/`([^`]*)'/g, '`$1`');
        content = content.replace(/`([^`]*)"/g, '`$1`');

        // Fix 2: Missing closing parenthesis
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens > closeParens) {
            const diff = openParens - closeParens;
            for (let i = 0; i < diff; i++) {
                content += ')';
            }
            fixed = true;
        }

        // Fix 3: Missing closing braces
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            const diff = openBraces - closeBraces;
            for (let i = 0; i < diff; i++) {
                content += '\n}';
            }
            fixed = true;
        }

        // Fix 4: Missing closing brackets
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            const diff = openBrackets - closeBrackets;
            for (let i = 0; i < diff; i++) {
                content += ']';
            }
            fixed = true;
        }

        // Fix 5: Unexpected identifier $ (jQuery/template literal issues)
        content = content.replace(/\$\{([^}]*)\s*\$/g, '${$1}');
        content = content.replace(/\$\s+\{/g, '${');

        // Fix 6: Double commas
        content = content.replace(/,,+/g, ',');

        // Fix 7: Trailing commas in function calls (not in objects/arrays)
        content = content.replace(/,\s*\)/g, ')');

        // Fix 8: Smart quotes
        content = content.replace(/[""]/g, '"');
        content = content.replace(/['']/g, "'");

        // Fix 9: Missing semicolons at end of statements
        content = content.replace(/^(\s*)(const|let|var)\s+(\w+)\s*=\s*([^;{}\n]+)$/gm, '$1$2 $3 = $4;');

        // Fix 10: Unexpected token issues with template literals
        content = content.replace(/}\s*`/g, '}`');
        content = content.replace(/`\s*{/g, '`{');

        // Fix 11: console.log con template literals mal formados
        content = content.replace(/console\.log\('([^']*)\$\{([^}]*)\}([^']*)'\)/g, 'console.log(`$1\${$2}$3`)');
        content = content.replace(/console\.log\("([^"]*)\$\{([^}]*)\}([^"]*)"\)/g, 'console.log(`$1\${$2}$3`)');

        // Fix 12: Missing function keyword
        content = content.replace(/^(\s*)async\s+(\w+)\s*\(/gm, '$1async function $2(');

        // Fix 13: Arrow functions mal formadas
        content = content.replace(/=>\s*{([^}]*)}([,;])/g, '=> {$1}$2');

        // Fix 14: Unexpected identifier con await
        content = content.replace(/(\s+)await\s+await\s+/g, '$1await ');

        // Fix 15: Template strings con comillas mezcladas
        content = content.replace(/`([^`]*)`'/g, '`$1`');
        content = content.replace(/"`([^`]*)`/g, '`$1`');

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        return false;
    } catch (error) {
        log.error(`Error procesando ${filePath}: ${error.message}`);
        return false;
    }
}

// Main
const files = getAllJSFiles();
log.info(`Total archivos JS: ${files.length}`);

let errorCount = 0;
let fixedCount = 0;
const stillBroken = [];

for (const file of files) {
    if (hasErrors(file)) {
        errorCount++;
        const error = getError(file);

        if (fixFile(file)) {
            // Verificar si se arregló
            if (!hasErrors(file)) {
                log.success(`Arreglado: ${path.basename(file)}`);
                fixedCount++;
            } else {
                stillBroken.push({ file, error });
            }
        } else {
            stillBroken.push({ file, error });
        }
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN:');
console.log(`Total archivos: ${files.length}`);
console.log(`Con errores: ${errorCount}`);
console.log(`Arreglados: ${fixedCount}`);
console.log(`Todavía con errores: ${stillBroken.length}`);

if (stillBroken.length > 0) {
    console.log('\n⚠️ Archivos que requieren corrección manual:');
    stillBroken.slice(0, 10).forEach(({ file, error }) => {
        console.log(`\n  📁 ${file}`);
        const errorLine = error.split('\n')[0];
        console.log(`     ${errorLine}`);
    });

    if (stillBroken.length > 10) {
        console.log(`\n  ... y ${stillBroken.length - 10} más`);
    }
}

console.log('\n✅ Proceso completado');

// Si quedan errores, mostrar sugerencias
if (stillBroken.length > 0) {
    console.log('\n💡 SUGERENCIAS:');
    console.log('1. Revisa manualmente los archivos listados');
    console.log('2. Busca patrones comunes en los errores');
    console.log('3. Considera comentar código problemático temporalmente');
    console.log('4. Ejecuta: npx eslint [archivo] --fix para intentar arreglos adicionales');
}
