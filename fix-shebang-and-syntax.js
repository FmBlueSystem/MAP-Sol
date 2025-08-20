#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 ARREGLANDO SHEBANG Y ERRORES DE SINTAXIS');
console.log('='.repeat(60));

// Get all JS files
function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
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
        return error.stdout || error.message;
    }
}

// Fix specific patterns in a file
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const changesMade = [];

    // 1. Fix shebang placement - move to line 1
    if (content.includes('#!/usr/bin/env node') && !content.startsWith('#!/usr/bin/env node')) {
        // Remove shebang from wrong position
        content = content.replace(/^.*#!\/usr\/bin\/env node.*\n?/gm, '');
        // Add at the beginning
        content = '#!/usr/bin/env node\n\n' + content;
        changesMade.push('Fixed shebang position');
    }

    // 2. Fix logger functions - remove "function" prefix when incorrectly used
    content = content.replace(/^(\s*)function\s+(logInfo|logError|logDebug|logWarn)\s*\(/gm, '$1$2(');

    // 3. Fix function calls that were incorrectly declared as functions
    content = content.replace(/^(\s*)function\s+(extractArtworkMissing|diagnoseAudio|fixAllPaths)\s*\(\)/gm, '$1$2()');

    // 4. Fix if statements incorrectly prefixed with function
    content = content.replace(/^(\s*)function\s+if\s*\(/gm, '$1if (');
    content = content.replace(/^(\s*)async\s+function\s+if\s*\(/gm, '$1if (');

    // 5. Fix template literal issues
    // Fix backticks that should be quotes
    content = content.replace(/`([^`]*file:\/\/[^`]*)`/g, "'$1'");
    content = content.replace(/`([^`]*\/Volumes\/[^`]*)`/g, "'$1'");

    // Fix SQL template literals starting with semicolon
    content = content.replace(/const\s+\w+\s*=\s*`;/gm, match => match.replace('`;', '`'));

    // Fix specific template literal patterns
    content = content.replace(/`([^`]*)`\s*\+\s*`([^`]*)`/g, '`$1$2`');

    // 6. Fix incorrect string escaping in template literals
    content = content.replace(/text-anchor=`middle`/g, 'text-anchor="middle"');
    content = content.replace(/(\w+)=`([^`]*)`/g, '$1="$2"');

    // 7. Fix split lines in critical areas
    // Fix analyzeWithEssentia call
    content = content.replace(
        /const features = await this\.analyzeWithEssentia\(;\s*file_path,/gm,
        'const features = await this.analyzeWithEssentia(\n                file_path,'
    );

    // Fix command assignments
    content = content.replace(/const command = ``([^`]+)`\s*`([^`]*)`([^`]*)`/g, 'command = `$1 $2$3`');

    // 8. Fix specific line patterns from the error files
    // Fix calculate-audio-features.js line 112-113 pattern
    content = content.replace(
        /path\.join\(__dirname, 'src', `audio-analyzer`\);/g,
        "path.join(__dirname, 'src', 'audio-analyzer');"
    );

    // Fix datetime pattern
    content = content.replace(/datetime\(`now`\)/g, "datetime('now')");

    // Fix the specific ternary operator pattern
    content = content.replace(
        /const analyzerBinary = bmp && decodedKey\s*\?\s*path\.join/gm,
        'const analyzerBinary = bpm && decodedKey\n                    ? path.join'
    );

    // Fix if statements at end of files
    content = content.replace(/^function\s+if\s*\(/gm, 'if (');

    // 9. Fix multiline string literals that got broken
    content = content.replace(/logDebug\(`([^`\n]*)\n([^`]*)`\);/gm, 'logDebug(`$1 $2`);');

    // 10. Fix broken template literals
    content = content.replace(/`([^`]*)\$\{([^}]+)\}([^`]*)`\s*\+\s*`([^`]*)`/g, '`$1${$2}$3$4`');

    // 11. Fix const declarations that got mangled
    content = content.replace(/const ([^=]+)=\s*`([^`]+)`\s*([^;]*);/g, 'const $1 = `$2`$3;');

    // 12. Fix specific patterns that appear in multiple files
    // Fix newlines in template literals
    content = content.replace(/`([^`]*)\n\s*([^`\n]*)`/gm, '`$1 $2`');

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
const filesWithErrors = [];
jsFiles.forEach(file => {
    const error = hasSyntaxError(file);
    if (error) {
        filesWithErrors.push({ file, error });
    }
});
console.log(`   Archivos con errores: ${filesWithErrors.length}\n`);

if (filesWithErrors.length === 0) {
    console.log('✅ No hay errores de sintaxis!');
    process.exit(0);
}

console.log('🔧 Aplicando correcciones específicas...\n');
let fixedCount = 0;
let stillBrokenCount = 0;
const stillBroken = [];

filesWithErrors.forEach(({ file, error }, index) => {
    const relativePath = path.relative('.', file);
    process.stdout.write(`[${index + 1}/${filesWithErrors.length}] ${relativePath}...`);

    // Show first few lines of error for debugging
    const errorLines = error.split('\n').slice(0, 2).join(' ').substring(0, 100);
    console.log(`\n   Error: ${errorLines}`);

    const changes = fixFile(file);

    // Check if file is now valid
    const newError = hasSyntaxError(file);
    if (!newError) {
        console.log('   ✅ Fixed!');
        fixedCount++;
    } else {
        console.log('   ❌ Still has errors');
        stillBrokenCount++;
        stillBroken.push({ file: relativePath, error: newError.split('\n')[0] });
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN:');
console.log(`   ✅ Archivos arreglados: ${fixedCount}`);
console.log(`   ❌ Todavía con errores: ${stillBrokenCount}`);

if (stillBroken.length > 0) {
    console.log('\n⚠️  Los primeros 10 archivos que requieren revisión manual:');
    stillBroken.slice(0, 10).forEach(({ file, error }) => {
        console.log(`   - ${file}`);
        console.log(`     Error: ${error.substring(0, 80)}...`);
    });

    if (stillBroken.length > 10) {
        console.log(`   ... y ${stillBroken.length - 10} más`);
    }
}

console.log('\n✅ Primera pasada completada!');
