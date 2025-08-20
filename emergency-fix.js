#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚑 CORRECCIÓN DE EMERGENCIA - ERRORES DE SINTAXIS\n');

// Corregir audio-panel.js - agregar cierre faltante si es necesario
function fixAudioPanel() {
    console.log('Corrigiendo audio-panel.js...');
    const filePath = path.join(__dirname, 'js', 'audio-panel.js');
    
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Contar llaves
    let openBraces = 0;
    let closeBraces = 0;
    
    for (const line of lines) {
        openBraces += (line.match(/{/g) || []).length;
        closeBraces += (line.match(/}/g) || []).length;
    }
    
    console.log(`  Llaves abiertas: ${openBraces}, cerradas: ${closeBraces}`);
    
    if (openBraces > closeBraces) {
        const diff = openBraces - closeBraces;
        console.log(`  ⚠️ Faltan ${diff} llaves de cierre`);
        
        // Buscar dónde insertar el cierre
        // Debe ser antes del DOMContentLoaded
        let insertLine = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('document.addEventListener(\'DOMContentLoaded\'')) {
                insertLine = i - 1;
                break;
            }
        }
        
        if (insertLine > 0) {
            // Insertar las llaves faltantes
            for (let i = 0; i < diff; i++) {
                lines.splice(insertLine, 0, '} // Auto-fixed closing brace');
            }
            
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log('  ✅ Llaves de cierre agregadas');
        }
    } else if (openBraces === closeBraces) {
        console.log('  ✅ Llaves balanceadas correctamente');
    }
}

// Verificar artwork-helper.js
function fixArtworkHelper() {
    console.log('\nVerificando artwork-helper.js...');
    const filePath = path.join(__dirname, 'utils', 'artwork-helper.js');
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Asegurar que termine con nueva línea
    if (!content.endsWith('\n')) {
        content += '\n';
        fs.writeFileSync(filePath, content);
        console.log('  ✅ Agregado salto de línea final');
    } else {
        console.log('  ✅ Archivo correcto');
    }
}

// Ejecutar correcciones
fixAudioPanel();
fixArtworkHelper();

console.log('\n✅ Corrección de emergencia completada');
console.log('🔄 Por favor, reinicia la aplicación');