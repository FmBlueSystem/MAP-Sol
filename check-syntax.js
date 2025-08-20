#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificando sintaxis de archivos JavaScript...\n');

// Directorios a verificar
const directories = ['handlers', 'services', 'js', '.'];

let errorCount = 0;
const errorFiles = [];

directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);

    if (!fs.existsSync(dirPath)) {
        console.log(`⚠️  Directorio no encontrado: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        if (!file.endsWith('.js')) {
            return;
        }
        if (file === 'check-syntax.js') {
            return;
        } // Skip this file

        const filePath = path.join(dirPath, file);

        // Skip if it's a directory
        if (fs.statSync(filePath).isDirectory()) {
            return;
        }

        try {
            execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
            console.log(`✅ ${dir}/${file}`);
        } catch (error) {
            errorCount++;
            const errorMsg = error.stderr ? error.stderr.toString() : error.toString();
            console.log(`❌ ${dir}/${file}`);
            console.log(`   Error: ${errorMsg.split('\n')[0]}`);
            errorFiles.push({
                path: filePath,
                relativePath: `${dir}/${file}`,
                error: errorMsg
            });
        }
    });
});

console.log('\n' + '='.repeat(50));

if (errorCount === 0) {
    console.log('\n✅ Todos los archivos tienen sintaxis correcta!');
} else {
    console.log(`\n❌ Se encontraron ${errorCount} archivos con errores de sintaxis:\n`);
    errorFiles.forEach(file => {
        console.log(`  - ${file.relativePath}`);
    });

    console.log('\n📝 Detalles de los errores:\n');
    errorFiles.forEach(file => {
        console.log(`\n${file.relativePath}:`);
        console.log(file.error.split('\n').slice(0, 5).join('\n'));
    });
}

process.exit(errorCount > 0 ? 1 : 0);
