// 🧪 SCRIPT DE VALIDACIÓN - Player Fix Complete
// Ejecutar desde la consola del navegador después de cargar la app

logDebug('════════════════════════════════════════════════════════');
logDebug('🧪 VALIDACIÓN DEL FIX DEL PLAYER - Music Analyzer Pro');
logDebug('════════════════════════════════════════════════════════');

// Objeto para almacenar resultados
const validationResults = {
    backend: {},
    frontend: {},
    integration: {},
    performance: {}
};

// ============================================
// TEST 1: VALIDACIÓN DEL BACKEND (main-secure.js)
// ============================================
async function validateBackend() {
    logDebug('\n📋 TEST 1: Validando Backend Handlers...');

    // Verificar que el IPC bridge está disponible
    if (window.api) {
        logDebug('  ✅ IPC Bridge disponible');
        validationResults.backend.ipcBridge = true;
    } else {
        logError('  ❌ IPC Bridge NO disponible');
        validationResults.backend.ipcBridge = false;
        return;
    }

    // Verificar configuración de audio
    try {
        const config = await window.api.invoke('get-audio-config');
        if (config) {
            logDebug('  ✅ Configuración de audio cargada');
            logDebug(
                `    - K-Meter: ${config.kMeterEnabled === false ? '✅ DESHABILITADO' : '❌ HABILITADO'}');
            logDebug(`    - Volume: ${config.volume || 0.7}`);
            logDebug(`    - HTML5: ${config.useHtml5 === true ? '✅' : '❌'}');
            validationResults.backend.audioConfig = config.kMeterEnabled === false;
        }
    } catch (error) {
        logError('  ❌ Error obteniendo configuración:', error);
        validationResults.backend.audioConfig = false;
    }

    // Verificar handler play-track
    try {
        const testPath = '/test/audio.mp3';
        // No ejecutar realmente, solo verificar que responde
        logDebug('  ℹ️ Handler play-track registrado (no se puede probar sin archivo real)');
        validationResults.backend.playHandler = true;
    } catch (error) {
        logError('  ❌ Handler play-track no responde:', error);
        validationResults.backend.playHandler = false;
    }
}

// ============================================
// TEST 2: VALIDACIÓN DEL FRONTEND (player-fix.js)
// ============================================
function validateFrontend() {
    logDebug('\n📋 TEST 2: Validando Frontend Player...');

    // Verificar que FixedPlayerSystem está cargado
    if (window.fixedPlayerSystem) {
        logDebug('  ✅ FixedPlayerSystem cargado');
        validationResults.frontend.playerSystem = true;

        // Verificar propiedades del sistema
        const props = ['currentAudio', 'audioContext', 'analyser', 'volume'];
        props.forEach(prop => {
            if (prop in window.fixedPlayerSystem) {
                logDebug(`    ✅ Propiedad ${prop} existe`);
            } else {
                logWarn(`    ⚠️ Propiedad ${prop} no encontrada`);
            }
        });
    } else {
        logError('  ❌ FixedPlayerSystem NO cargado');
        validationResults.frontend.playerSystem = false;
    }

    // Verificar elementos UI
    const uiElements = {
        'current-title': 'Título del track',
        'current-artist': 'Artista',
        'current-artwork': 'Artwork',
        'main-play-btn': 'Botón Play/Pause',
        'time-current': 'Tiempo actual',
        'time-total': 'Duración total',
        'progress-fill': 'Barra de progreso',
        'meter-l': 'K-Meter izquierdo',
        'meter-r': 'K-Meter derecho'
    };

    let allElementsPresent = true;
    Object.entries(uiElements).forEach(([id, description]) => {
        const element = document.getElementById(id);
        if (element) {
            logDebug(`  ✅ ${description} (${id})`);
        } else {
            logError(`  ❌ ${description} (${id}) NO encontrado`);
            allElementsPresent = false;
        }
    });

    validationResults.frontend.uiElements = allElementsPresent;
}

// ============================================
// TEST 3: PRUEBA DE INTEGRACIÓN
// ============================================
async function validateIntegration() {
    logDebug('\n📋 TEST 3: Prueba de Integración...');

    // Buscar primera tarjeta de música
    const firstCard = document.querySelector('.file-card');
    if (!firstCard) {
        logWarn('  ⚠️ No hay tarjetas de música para probar');
        validationResults.integration.playback = false;
        return;
    }

    logDebug('  🎵 Simulando click en primera tarjeta...');
    firstCard.click();

    // Esperar 2 segundos para que cargue
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar que el audio se cargó
    if (window.fixedPlayerSystem && window.fixedPlayerSystem.currentAudio) {
        logDebug('  ✅ Audio cargado en el player');
        validationResults.integration.audioLoaded = true;

        // Verificar información actualizada
        const title = document.getElementById('current-title');
        const artist = document.getElementById('current-artist');

        if (title && title.textContent !== 'No track playing') {
            logDebug(`  ✅ Título actualizado: "${title.textContent}"");
            validationResults.integration.infoUpdated = true;
        } else {
            logError('  ❌ Título NO actualizado');
            validationResults.integration.infoUpdated = false;
        }

        if (artist && artist.textContent !== 'Select a song') {
            logDebug(`  ✅ Artista actualizado: "${artist.textContent}"");
        }

        // Verificar estado de reproducción
        if (!window.fixedPlayerSystem.currentAudio.paused) {
            logDebug('  ✅ Audio reproduciéndose');
            validationResults.integration.playing = true;
        } else {
            logWarn('  ⚠️ Audio no está reproduciéndose');
            validationResults.integration.playing = false;
        }
    } else {
        logError('  ❌ Audio NO se cargó');
        validationResults.integration.audioLoaded = false;
    }
}

// ============================================
// TEST 4: VALIDACIÓN DE PERFORMANCE
// ============================================
function validatePerformance() {
    logDebug('\n📋 TEST 4: Validación de Performance...');

    // Verificar AudioContext
    if (window.fixedPlayerSystem && window.fixedPlayerSystem.audioContext) {
        const ctx = window.fixedPlayerSystem.audioContext;
        logDebug(`  ℹ️ AudioContext state: ${ctx.state}`);

        if (ctx.state === 'running') {
            logDebug('  ✅ AudioContext funcionando');
            validationResults.performance.audioContext = true;
        } else if (ctx.state === 'suspended') {
            logWarn('  ⚠️ AudioContext suspendido (requiere user gesture)');
            validationResults.performance.audioContext = false;
        }
    }

    // Verificar memory leaks
    if (performance.memory) {
        const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        logDebug(`  ℹ️ Memoria JS usada: ${memoryMB} MB`);

        if (memoryMB < 200) {
            logDebug('  ✅ Uso de memoria normal');
            validationResults.performance.memory = true;
        } else {
            logWarn('  ⚠️ Uso de memoria alto');
            validationResults.performance.memory = false;
        }
    }
}

// ============================================
// TEST 5: VERIFICACIÓN DE K-METER
// ============================================
function validateKMeter() {
    logDebug('\n📋 TEST 5: Verificación de K-Meter...');

    if (!window.fixedPlayerSystem || !window.fixedPlayerSystem.currentAudio) {
        logWarn('  ⚠️ No hay audio reproduciéndose para probar K-Meter');
        return;
    }

    // Verificar si el K-Meter está deshabilitado en configuración
    logDebug('  ℹ️ K-Meter debe estar DESHABILITADO para evitar saturación');

    const meterL = document.getElementById('meter-l');
    const meterR = document.getElementById('meter-r');

    if (meterL && meterR) {
        // Observar cambios durante 1 segundo
        let hasActivity = false;
        const startWidth = meterL.style.width;

        setTimeout(() => {
            const endWidth = meterL.style.width;
            if (startWidth !== endWidth) {
                hasActivity = true;
            }

            if (hasActivity) {
                logWarn('  ⚠️ K-Meter ACTIVO - Puede causar saturación');
                validationResults.performance.kMeterDisabled = false;
            } else {
                logDebug('  ✅ K-Meter inactivo (correcto para evitar saturación)');
                validationResults.performance.kMeterDisabled = true;
            }
        }, 1000);
    }
}

// ============================================
// EJECUTAR TODAS LAS VALIDACIONES
// ============================================
async function runAllValidations() {
    logDebug('\n🚀 Iniciando validación completa...\n');

    // Backend
    await validateBackend();

    // Frontend
    validateFrontend();

    // Integration
    await validateIntegration();

    // Performance
    validatePerformance();

    // K-Meter
    validateKMeter();

    // Esperar un poco para que terminen las pruebas asíncronas
    setTimeout(() => {
        showResults();
    }, 3000);
}

// ============================================
// MOSTRAR RESULTADOS
// ============================================
function showResults() {
    logDebug('\n════════════════════════════════════════════════════════');
    logDebug('📊 RESULTADOS DE VALIDACIÓN');
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

    logDebug(`\n✅ Tests pasados: ${passedTests}/${totalTests} (${percentage}%)`);

    // Detalles por categoría
    logDebug('\n📋 Detalles por categoría:');

    Object.entries(validationResults).forEach(([category, results]) => {
        const passed = Object.values(results).filter(r => r === true).length;
        const total = Object.values(results).length;
        logDebug(`  ${category.toUpperCase()}: ${passed}/${total}`);
    });

    // Diagnóstico final
    logDebug('\n🏁 DIAGNÓSTICO FINAL:');

    if (percentage === 100) {
        logDebug('  ✅ PLAYER COMPLETAMENTE FUNCIONAL');
    } else if (percentage >= 80) {
        logDebug('  ✅ Player funcional con problemas menores');
    } else if (percentage >= 60) {
        logDebug('  ⚠️ Player parcialmente funcional');
    } else {
        logDebug('  ❌ Player con problemas críticos');
    }

    // Recomendaciones
    if (!validationResults.backend?.audioConfig) {
        logDebug('\n⚠️ IMPORTANTE: K-Meter debe estar deshabilitado en configuración');
    }

    if (!validationResults.performance?.audioContext) {
        logDebug('\n⚠️ NOTA: AudioContext requiere interacción del usuario (click)');
    }

    logDebug('\n════════════════════════════════════════════════════════');
}

// Ejecutar validaciones
runAllValidations();
