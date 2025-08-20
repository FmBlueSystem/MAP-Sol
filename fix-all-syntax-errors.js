#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 ARREGLANDO TODOS LOS ERRORES DE SINTAXIS');
console.log('='.repeat(60));

// Patterns to fix
const fixes = [
    // 1. Fix incorrect function declarations in if statements
    {
        pattern: /^(\s*)function\s+if\s*\(/gm,
        replacement: '$1if (',
        description: 'function if() -> if()',
    },
    {
        pattern: /^(\s*)async\s+function\s+if\s*\(/gm,
        replacement: '$1if (',
        description: 'async function if() -> if()',
    },

    // 2. Fix logger function declarations
    {
        pattern: /^(\s*)function\s+(logInfo|logError|logDebug|logWarn)\s*\(/gm,
        replacement: '$1$2(',
        description: 'function logX() -> logX()',
    },

    // 3. Fix function calls that were incorrectly declared as functions
    {
        pattern: /^(\s*)function\s+(extractArtworkMissing|diagnoseAudio|fixAllPaths)\s*\(\)/gm,
        replacement: '$1$2()',
        description: 'function funcName() -> funcName()',
    },

    // 4. Fix class methods with 'function' keyword
    {
        pattern: /^(\s{4,})(async\s+)?function\s+(\w+)\s*\(/gm,
        replacement: '$1$2$3(',
        description: 'class method: function name() -> name()',
    },

    // 5. Fix template literal errors - backticks inside backticks
    {
        pattern: /(`[^`]*)`([^`]*)`([^`]*`)/g,
        replacement: (match, p1, p2, p3) => {
            // If p2 contains quotes, it's likely meant to be a string
            if (p2.includes("'") || p2.includes('"')) {
                return match; // Keep as is
            }
            return p1 + '\\`' + p2 + '\\`' + p3;
        },
        description: 'Escape nested backticks',
    },

    // 6. Fix SQL template literals with incorrect semicolons
    {
        pattern: /const\s+\w+\s*=\s*`;/gm,
        replacement: (match) => match.replace('`;', '`'),
        description: 'Remove semicolon at start of template literal',
    },

    // 7. Fix ternary operators split across lines incorrectly
    {
        pattern: /(\w+)\s*\?\s*\n\s*([^:]+)\s*:\s*([^;]+);/gm,
        replacement: '$1 ? $2 : $3;',
        description: 'Fix multiline ternary operators',
    },

    // 8. Fix incorrect template literal continuations
    {
        pattern: /(\$\{[^}]+\})\s*\+\s*`/g,
        replacement: '$1',
        description: 'Remove + after template literal expression',
    },
    {
        pattern: /`\s*\+\s*(\$\{[^}]+\})/g,
        replacement: '$1',
        description: 'Remove + before template literal expression',
    },

    // 9. Fix incorrect string concatenation in template literals
    {
        pattern: /`([^`]*)\$\{([^}]+)\}([^`]*)`\s*\+\s*`/g,
        replacement: '`$1${$2}$3',
        description: 'Fix template literal concatenation',
    },

    // 10. Fix missing const/let/var declarations (conservative)
    {
        pattern: /^(\s*)(sql|query|command|result|data|options|config)\s*=/gm,
        replacement: '$1const $2 =',
        description: 'Add const to common variable names',
    },
];

// Get all JS files
function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip node_modules and backup directories
            if (!file.includes('node_modules') && !file.includes('backup')) {
                getAllJsFiles(filePath, fileList);
            }
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Check if file has syntax errors
function hasSyntaxError(filePath) {
    try {
        execSync(`node -c "${filePath}" 2>&1`, { encoding: 'utf8' });
        return false;
    } catch (error) {
        return true;
    }
}

// Apply fixes to a file
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const changesMade = [];

    // Apply each fix
    fixes.forEach((fix) => {
        const beforeLength = content.length;
        if (typeof fix.replacement === 'function') {
            content = content.replace(fix.pattern, fix.replacement);
        } else {
            content = content.replace(fix.pattern, fix.replacement);
        }
        if (content.length !== beforeLength) {
            changesMade.push(fix.description);
        }
    });

    // Additional complex fixes

    // Fix SQL queries with incorrect quoting
    content = content.replace(/const\s+sql\s*=\s*`;([^`]+)`/gm, (match, query) => {
        // Remove leading semicolon if present
        query = query.replace(/^\s*;/, '');
        return `const sql = \`${query}\``;
    });

    // Fix incorrect line 112-113 pattern (ternary operator)
    content = content.replace(/(\w+)\s+&&\s+(\w+);\s*\?\s*([^:]+)\s*:\s*([^;]+);/gm, (match, p1, p2, p3, p4) => {
        return `${p1} && ${p2} ? ${p3} : ${p4};`;
    });

    // Fix line continuation in template literals
    content = content.replace(/`([^`]*)\n\s*([^`]*)`/gm, (match, p1, p2) => {
        // Check if this is a SQL query or multi-line string
        if (p1.includes('SELECT') || p1.includes('UPDATE') || p1.includes('INSERT')) {
            return match; // Keep SQL queries multi-line
        }
        // For other cases, check if line needs continuation
        if (p1.endsWith('\\')) {
            return match;
        }
        return `\`${p1} ${p2}\``;
    });

    // Fix specific pattern: src`, `audio-analyzer`
    content = content.replace(/`src`,\s*`([^`]+)`/g, "'src', '$1'");

    // Fix specific pattern in calculate-audio-features.js lines 112-113
    content = content.replace(
        /const analyzerBinary = bpm && decodedKey;\s*\?\s*path\.join/gm,
        'const analyzerBinary = bpm && decodedKey\n                    ? path.join'
    );

    // Fix command template literals with incorrect quotes
    content = content.replace(/command\s*=\s*``([^`]+)`\s*`([^`]+)`([^`]*)`/g, 'command = `$1 $2$3`');

    // Fix specific pattern: 'now'
    content = content.replace(/datetime\(`now`\)/g, "datetime('now')");

    // Fix incorrect backtick escaping in strings
    content = content.replace(/`([^`]*)'([^'`]*)`([^`]*)`/g, (match, p1, p2, p3) => {
        // Check if this is meant to be a template literal with a quote inside
        if (p2 && !p2.includes('${')) {
            return `\`${p1}'${p2}'${p3}\``;
        }
        return match;
    });

    // If changes were made, write the file
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        return changesMade;
    }

    return null;
}

// Main execution
console.log('\n📂 Escaneando archivos JavaScript...');
const jsFiles = getAllJsFiles('.');
console.log(`   Encontrados: ${jsFiles.length} archivos\n`);

console.log('🔍 Identificando archivos con errores de sintaxis...');
const filesWithErrors = jsFiles.filter((file) => hasSyntaxError(file));
console.log(`   Archivos con errores: ${filesWithErrors.length}\n`);

if (filesWithErrors.length === 0) {
    console.log('✅ No hay errores de sintaxis!');
    process.exit(0);
}

console.log('🔧 Aplicando correcciones...\n');
let fixedCount = 0;
let stillBrokenCount = 0;
const stillBroken = [];

filesWithErrors.forEach((file, index) => {
    const relativePath = path.relative('.', file);
    process.stdout.write(`[${index + 1}/${filesWithErrors.length}] ${relativePath}...`);

    const changes = fixFile(file);

    // Check if file is now valid
    if (!hasSyntaxError(file)) {
        console.log(' ✅');
        fixedCount++;
    } else {
        console.log(' ❌ (todavía con errores)');
        stillBrokenCount++;
        stillBroken.push(relativePath);
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN:');
console.log(`   ✅ Archivos arreglados: ${fixedCount}`);
console.log(`   ❌ Todavía con errores: ${stillBrokenCount}`);

if (stillBroken.length > 0) {
    console.log('\n⚠️  Archivos que requieren revisión manual:');
    stillBroken.forEach((file) => {
        console.log(`   - ${file}`);
    });

    console.log('\n💡 Ejecuta este comando para ver los errores específicos:');
    console.log(`   node -c "${stillBroken[0]}"`);
}

console.log('\n✅ Proceso completado!');
console.log('   Próximo paso: npm run lint:fix');
