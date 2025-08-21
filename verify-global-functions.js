#!/usr/bin/env node

/**
 * Verificador automático de funciones globales
 * Ejecutar ANTES de cada commit para prevenir errores
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO FUNCIONES GLOBALES Y LLAMADAS\n');
console.log('='.repeat(70));

const errors = [];
const warnings = [];

// 1. Buscar todas las definiciones de funciones globales
console.log('\n1️⃣ BUSCANDO DEFINICIONES GLOBALES (window.*)...\n');

const htmlFiles = ['index-views.html', 'index.html'];
const globalFunctions = new Set();
const globalDefinitions = {};

htmlFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        // Buscar window.functionName =
        const windowAssignments = content.match(/window\.\w+\s*=\s*(?:function|async function|\w+)/g) || [];

        windowAssignments.forEach((match) => {
            const funcName = match.match(/window\.(\w+)/)[1];
            globalFunctions.add(funcName);

            // Encontrar número de línea
            const lines = content.substring(0, content.indexOf(match)).split('\n');
            const lineNumber = lines.length;

            globalDefinitions[funcName] = {
                file: file,
                line: lineNumber,
                definition: match.trim(),
            };

            console.log(`✅ Encontrada: window.${funcName} en ${file}:${lineNumber}`);
        });
    }
});

if (globalFunctions.size === 0) {
    warnings.push('No se encontraron funciones globales definidas');
}

// 2. Buscar todas las LLAMADAS a funciones globales
console.log('\n2️⃣ BUSCANDO LLAMADAS A FUNCIONES GLOBALES...\n');

const jsFiles = fs
    .readdirSync('js')
    .filter((f) => f.endsWith('.js'))
    .map((f) => `js/${f}`);
const allFiles = [...jsFiles, ...htmlFiles];

const globalCalls = {};

allFiles.forEach((file) => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');

        // Buscar window.functionName() o window.functionName sin ser una asignación
        const windowCalls = content.match(/window\.(\w+)(?:\(|\.|\s|$)/g) || [];

        windowCalls.forEach((match) => {
            // Ignorar asignaciones
            if (content.includes(match + ' =')) {
                return;
            }

            const funcName = match.match(/window\.(\w+)/)[1];

            // Ignorar objetos conocidos del navegador
            const browserObjects = [
                'location',
                'document',
                'navigator',
                'console',
                'localStorage',
                'sessionStorage',
                'alert',
                'confirm',
                'prompt',
                'electronAPI',
            ];
            if (browserObjects.includes(funcName)) {
                return;
            }

            if (!globalCalls[funcName]) {
                globalCalls[funcName] = [];
            }

            const lines = content.substring(0, content.indexOf(match)).split('\n');
            const lineNumber = lines.length;

            globalCalls[funcName].push({
                file: file,
                line: lineNumber,
            });
        });
    }
});

// 3. Verificar que todas las llamadas tienen definición
console.log('\n3️⃣ VERIFICANDO CONSISTENCIA...\n');

Object.keys(globalCalls).forEach((funcName) => {
    if (!globalFunctions.has(funcName)) {
        const calls = globalCalls[funcName];
        errors.push(`❌ window.${funcName} se llama pero NO está definida:`);
        calls.forEach((call) => {
            errors.push(`   - Llamada en ${call.file}:${call.line}`);
        });
    } else {
        console.log(`✅ window.${funcName}: definida y usada correctamente`);
    }
});

// 4. Verificar funciones definidas pero no usadas
console.log('\n4️⃣ BUSCANDO FUNCIONES NO UTILIZADAS...\n');

globalFunctions.forEach((funcName) => {
    if (!globalCalls[funcName]) {
        warnings.push(`⚠️  window.${funcName} está definida pero nunca se usa`);
    }
});

// 5. Verificar documentación
console.log('\n5️⃣ VERIFICANDO DOCUMENTACIÓN...\n');

const registryFile = 'GLOBAL_API_REGISTRY.md';
if (fs.existsSync(registryFile)) {
    const registryContent = fs.readFileSync(registryFile, 'utf8');

    globalFunctions.forEach((funcName) => {
        if (!registryContent.includes(`window.${funcName}`)) {
            warnings.push(`📝 window.${funcName} no está documentada en GLOBAL_API_REGISTRY.md`);
        }
    });

    console.log('✅ Archivo de documentación encontrado');
} else {
    errors.push('❌ GLOBAL_API_REGISTRY.md no existe');
}

// 6. Verificar handlers IPC
console.log('\n6️⃣ VERIFICANDO HANDLERS IPC...\n');

const mainFile = 'main-minimal.js';
if (fs.existsSync(mainFile)) {
    const mainContent = fs.readFileSync(mainFile, 'utf8');
    const ipcHandlers = mainContent.match(/ipcMain\.handle\(['"]([^'"]+)['"]/g) || [];

    const registeredHandlers = new Set();
    ipcHandlers.forEach((match) => {
        const handler = match.match(/ipcMain\.handle\(['"]([^'"]+)['"]/)[1];
        registeredHandlers.add(handler);
    });

    console.log(`✅ ${registeredHandlers.size} handlers IPC registrados`);

    // Buscar llamadas a electronAPI.invoke
    const invokeCalls = new Set();
    allFiles.forEach((file) => {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            const invokes = content.match(/electronAPI\.invoke\(['"]([^'"]+)['"]/g) || [];
            invokes.forEach((match) => {
                const handler = match.match(/electronAPI\.invoke\(['"]([^'"]+)['"]/)[1];
                invokeCalls.add(handler);
            });
        }
    });

    // Verificar que todas las llamadas tienen handler
    invokeCalls.forEach((handler) => {
        if (!registeredHandlers.has(handler)) {
            errors.push(`❌ electronAPI.invoke('${handler}') se llama pero NO tiene handler`);
        }
    });
}

// RESUMEN FINAL
console.log('\n' + '='.repeat(70));
console.log('📊 RESUMEN DE VERIFICACIÓN\n');

console.log(`Funciones globales definidas: ${globalFunctions.size}`);
globalFunctions.forEach((func) => {
    const def = globalDefinitions[func];
    console.log(`  - window.${func} (${def.file}:${def.line})`);
});

if (errors.length > 0) {
    console.log('\n❌ ERRORES CRÍTICOS:');
    errors.forEach((err) => console.log(err));
}

if (warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    warnings.forEach((warn) => console.log(warn));
}

if (errors.length === 0) {
    console.log('\n✅ No hay errores críticos');
}

// Generar reporte
const report = {
    timestamp: new Date().toISOString(),
    globalFunctions: Array.from(globalFunctions),
    definitions: globalDefinitions,
    errors: errors,
    warnings: warnings,
};

fs.writeFileSync('global-functions-report.json', JSON.stringify(report, null, 2));
console.log('\n📄 Reporte guardado en: global-functions-report.json');

process.exit(errors.length > 0 ? 1 : 0);
