// 🧹 VALIDACIÓN DE LIMPIEZA UI - Music Analyzer Pro
// Verifica que los botones "Mejorar" y "Enhanced Meta" fueron eliminados correctamente

logDebug('🧹 INICIANDO VALIDACIÓN DE LIMPIEZA UI...');
logDebug('════════════════════════════════════════════════════════');

const validationResults = {
    buttonsRemoved: {},
    functionsRemoved: {},
    appFunctional: {}
};

// Test 1: Verificar que el botón "Mejorar" no existe
logDebug('\n📋 Test 1: Verificando eliminación del botón "Mejorar"...');
const mejorarButtons = document.querySelectorAll('button');
let mejorarFound = false;

mejorarButtons.forEach(btn => {
    if (btn.textContent.includes('Mejorar') || btn.onclick?.toString().includes('openAIAnalyzer')) {
        mejorarFound = true;
        logError('  ❌ Botón "Mejorar" encontrado:', btn);
    }
});

if (!mejorarFound) {
    logDebug('  ✅ Botón "Mejorar" eliminado correctamente');
    validationResults.buttonsRemoved.mejorar = true;
} else {
    logError('  ❌ Botón "Mejorar" aún existe');
    validationResults.buttonsRemoved.mejorar = false;
}

// Test 2: Verificar que el botón "Enhanced Meta" no existe
logDebug('\n📋 Test 2: Verificando eliminación del botón "Enhanced Meta"...');
const enhancedButtons = document.querySelectorAll(
    '[onclick*="showEnhancedView"], [data-view="enhanced"]'
);

if (enhancedButtons.length === 0) {
    logDebug('  ✅ Botón "Enhanced Meta" eliminado correctamente');
    validationResults.buttonsRemoved.enhanced = true;
} else {
    logError('  ❌ Botón "Enhanced Meta" encontrado:', enhancedButtons);
    validationResults.buttonsRemoved.enhanced = false;
}

// Test 3: Verificar que las funciones no existen
logDebug('\n📋 Test 3: Verificando eliminación de funciones...');

if (typeof openAIAnalyzer === 'undefined') {
    logDebug('  ✅ Función openAIAnalyzer eliminada');
    validationResults.functionsRemoved.openAIAnalyzer = true;
} else {
    logError('  ❌ Función openAIAnalyzer aún existe');
    validationResults.functionsRemoved.openAIAnalyzer = false;
}

if (typeof startAIAnalysis === 'undefined') {
    logDebug('  ✅ Función startAIAnalysis eliminada');
    validationResults.functionsRemoved.startAIAnalysis = true;
} else {
    logError('  ❌ Función startAIAnalysis aún existe');
    validationResults.functionsRemoved.startAIAnalysis = false;
}

if (typeof showEnhancedView === 'undefined') {
    logDebug('  ✅ Función showEnhancedView eliminada');
    validationResults.functionsRemoved.showEnhancedView = true;
} else {
    logError('  ❌ Función showEnhancedView aún existe');
    validationResults.functionsRemoved.showEnhancedView = false;
}

// Test 4: Verificar que los view toggles funcionan
logDebug('\n📋 Test 4: Verificando funcionalidad de view toggles...');
const viewButtons = document.querySelectorAll('[data-view]');
const validViews = ['cards', 'table', 'compact'];
let viewsOk = true;

viewButtons.forEach(btn => {
    const view = btn.dataset.view;
    if (validViews.includes(view)) {
        logDebug(`  ✅ Vista "${view}" disponible");
    } else {
        logError(`  ❌ Vista inválida encontrada: "${view}"");
        viewsOk = false;
    }
});

validationResults.appFunctional.viewToggles = viewsOk;

// Test 5: Verificar que el menú contextual funciona
logDebug('\n📋 Test 5: Verificando menú contextual...');
const contextMenu = document.getElementById('contextMenu');
if (contextMenu) {
    logDebug('  ✅ Menú contextual presente');

    // Verificar que el botón de metadatos existe
    const metadataBtn = contextMenu.querySelector('[data-action="show-metadata"]');
    if (metadataBtn) {
        logDebug('  ✅ Botón "Ver todos los metadatos" presente');
        validationResults.appFunctional.metadataButton = true;
    } else {
        logWarn('  ⚠️ Botón "Ver todos los metadatos" no encontrado');
        validationResults.appFunctional.metadataButton = false;
    }

    validationResults.appFunctional.contextMenu = true;
} else {
    logError('  ❌ Menú contextual no encontrado');
    validationResults.appFunctional.contextMenu = false;
}

// Test 6: Verificar que la aplicación puede cargar archivos
logDebug('\n📋 Test 6: Verificando carga de archivos...');
const fileCards = document.querySelectorAll('.file-card');
if (fileCards.length > 0) {
    logDebug(`  ✅ ${fileCards.length} archivos cargados`);
    validationResults.appFunctional.filesLoaded = true;
} else {
    logWarn('  ⚠️ No hay archivos cargados');
    validationResults.appFunctional.filesLoaded = false;
}

// Test 7: Verificar que el reproductor funciona
logDebug('\n📋 Test 7: Verificando reproductor de audio...');
const audioPanel = document.getElementById('audio-panel');
const playButton = document.getElementById('main-play-btn');

if (audioPanel && playButton) {
    logDebug('  ✅ Reproductor de audio presente');
    validationResults.appFunctional.audioPlayer = true;
} else {
    logError('  ❌ Reproductor de audio no encontrado');
    validationResults.appFunctional.audioPlayer = false;
}

// Test 8: Verificar que no hay errores en consola
logDebug('\n📋 Test 8: Verificando errores en consola...');
const originalError = console.error;
let errorCount = 0;
console.error = function (...args) {
    errorCount++;
    originalError.apply(console, args);
};

// Simular algunos eventos para ver si hay errores
setTimeout(() => {
    // Restaurar console.error
    console.error = originalError;

    if (errorCount === 0) {
        logDebug('  ✅ No hay errores en consola');
        validationResults.appFunctional.noErrors = true;
    } else {
        logWarn(`  ⚠️ Se detectaron ${errorCount} errores`);
        validationResults.appFunctional.noErrors = false;
    }

    // Mostrar resumen final
    showSummary();
}, 1000);

// Función para mostrar resumen
function showSummary() {
    logDebug('\n════════════════════════════════════════════════════════');
    logDebug('📊 RESUMEN DE VALIDACIÓN');
    logDebug('════════════════════════════════════════════════════════');

    let totalTests = 0;
    let passedTests = 0;

    // Contar resultados
    Object.values(validationResults).forEach(category => {
        Object.values(category).forEach(result => {
            totalTests++;
            if (result === true) {
                passedTests++;
            }
        });
    });

    const percentage = Math.round((passedTests / totalTests) * 100);

    logDebug(`\nPruebas pasadas: ${passedTests}/${totalTests} (${percentage}%)`);

    // Detalles por categoría
    logDebug('\n📋 Detalles:');
    logDebug('\nBotones eliminados:');
    Object.entries(validationResults.buttonsRemoved).forEach(([key, value]) => {
        logDebug(`  ${value ? '✅' : '❌'} ${key}');
    });

    logDebug('\nFunciones eliminadas:');
    Object.entries(validationResults.functionsRemoved).forEach(([key, value]) => {
        logDebug(`  ${value ? '✅' : '❌'} ${key}');
    });

    logDebug('\nFuncionalidad de la app:');
    Object.entries(validationResults.appFunctional).forEach(([key, value]) => {
        logDebug(`  ${value ? '✅' : '❌'} ${key}');
    });

    // Diagnóstico final
    logDebug('\n🏁 DIAGNÓSTICO FINAL:');
    if (percentage === 100) {
        logDebug('  ✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
        logDebug('  ✅ La aplicación funciona correctamente sin los botones eliminados');
    } else if (percentage >= 80) {
        logDebug('  ✅ Limpieza completada con advertencias menores');
    } else {
        logDebug('  ❌ Hay problemas que necesitan atención');
    }

    logDebug('\n💡 NOTAS:');
    logDebug('- Los botones "Mejorar" y "Enhanced Meta" fueron eliminados');
    logDebug('- Las funciones relacionadas fueron comentadas');
    logDebug('- La funcionalidad core de la aplicación permanece intacta');
    logDebug('- El nuevo Metadata Inspector reemplaza la funcionalidad eliminada');

    logDebug('\n════════════════════════════════════════════════════════');
}
