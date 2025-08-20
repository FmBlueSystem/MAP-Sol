// Script de prueba para verificar que el player fix funciona
// Ejecutar en la consola del navegador después de cargar la app

logDebug('🧪 INICIANDO PRUEBAS DEL PLAYER FIX...');

// Test 1: Verificar que el sistema está cargado
if (window.fixedPlayerSystem) {
    logInfo('✅ Test 1: FixedPlayerSystem está cargado');
} else {
    logError('❌ Test 1: FixedPlayerSystem NO está cargado');
}

// Test 2: Verificar elementos del player
const elements = {
    'current-title': document.getElementById('current-title'),
    'current-artist': document.getElementById('current-artist'),
    'current-album': document.getElementById('current-album'),
    'current-artwork': document.getElementById('current-artwork'),
    'main-play-btn': document.getElementById('main-play-btn'),
    'time-current': document.getElementById('time-current'),
    'time-total': document.getElementById('time-total'),
    'progress-fill': document.getElementById('progress-fill'),
    'meter-l': document.getElementById('meter-l'),
    'meter-r': document.getElementById('meter-r'),
    'db-l': document.getElementById('db-l'),
    'db-r': document.getElementById('db-r'),
    'btn-shuffle': document.getElementById('btn-shuffle'),
    'btn-repeat': document.getElementById('btn-repeat'),
};

logDebug('📋 Test 2: Verificando elementos del player:');
let elementsOk = true;
for (const [id, element] of Object.entries(elements)) {
    if (element) {
        logDebug(`  ✅ ${id}: ENCONTRADO`);
    } else {
        logError(`  ❌ ${id}: NO ENCONTRADO`);
        elementsOk = false;
    }
}

if (elementsOk) {
    logInfo('✅ Test 2: Todos los elementos están presentes');
} else {
    logWarn('⚠️ Test 2: Algunos elementos faltan');
}

// Test 3: Probar reproducción
setTimeout(() => {
    const firstCard = document.querySelector('.file-card');
    if (firstCard) {
        logDebug('🎵 Test 3: Simulando click en primera tarjeta...');
        firstCard.click();

        // Verificar después de 2 segundos
        setTimeout(() => {
            if (window.fixedPlayerSystem && window.fixedPlayerSystem.currentAudio) {
                logInfo('✅ Test 3: Audio cargado correctamente');

                // Test 4: Verificar info actualizada
                const title = document.getElementById('current-title');
                const artist = document.getElementById('current-artist');
                if (title && title.textContent !== 'No track playing') {
                    logInfo('✅ Test 4: Info del track actualizada');
                    logDebug(`  - Título: ${title.textContent}`);
                    logDebug(`  - Artista: ${artist.textContent}`);
                } else {
                    logWarn('⚠️ Test 4: Info del track no actualizada');
                }

                // Test 5: Verificar que el audio está reproduciéndose
                if (!window.fixedPlayerSystem.currentAudio.paused) {
                    logInfo('✅ Test 5: Audio reproduciéndose');
                } else {
                    logWarn('⚠️ Test 5: Audio no está reproduciéndose');
                }

                // Test 6: Probar play/pause
                logInfo('🔄 Test 6: Probando play/pause...');
                window.togglePlayPause();
                setTimeout(() => {
                    if (window.fixedPlayerSystem.currentAudio.paused) {
                        logInfo('✅ Test 6: Pause funcionando');
                        // Volver a reproducir
                        window.togglePlayPause();
                        setTimeout(() => {
                            if (!window.fixedPlayerSystem.currentAudio.paused) {
                                logInfo('✅ Test 6: Play funcionando');
                            }
                        }, 500);
                    }
                }, 500);

                // Test 7: Verificar K-Meter
                setTimeout(() => {
                    const meterL = document.getElementById('meter-l');
                    const meterR = document.getElementById('meter-r');
                    if (meterL && meterR) {
                        const widthL = parseFloat(meterL.style.width);
                        const widthR = parseFloat(meterR.style.width);
                        if (widthL > 0 || widthR > 0) {
                            logInfo('✅ Test 7: K-Meter funcionando');
                            logDebug(`  - L: ${widthL.toFixed(1)}%`);
                            logDebug(`  - R: ${widthR.toFixed(1)}%`);
                        } else {
                            logWarn('⚠️ Test 7: K-Meter no muestra actividad');
                        }
                    }
                }, 1000);
            } else {
                logError('❌ Test 3: Audio NO se cargó');
            }
        }, 2000);
    } else {
        logWarn('⚠️ No hay tarjetas para probar');
    }
}, 1000);

// Test 8: Probar controles
setTimeout(() => {
    logDebug('🎮 Test 8: Probando controles...');

    // Shuffle
    if (window.fixedPlayerSystem) {
        window.fixedPlayerSystem.toggleShuffle();
        const shuffleBtn = document.getElementById('btn-shuffle');
        if (shuffleBtn && shuffleBtn.style.color === 'rgb(29, 185, 84)') {
            logInfo('✅ Test 8a: Shuffle toggle funcionando');
        }

        // Repeat
        window.fixedPlayerSystem.toggleRepeat();
        const repeatBtn = document.getElementById('btn-repeat');
        if (repeatBtn && repeatBtn.style.color === 'rgb(29, 185, 84)') {
            logInfo('✅ Test 8b: Repeat toggle funcionando');
        }
    }
}, 5000);

logDebug('📊 RESUMEN DE PRUEBAS:');
logDebug('- Sistema cargado: ' + (window.fixedPlayerSystem ? '✅' : '❌'));
logDebug('- Elementos UI: ' + (elementsOk ? '✅' : '⚠️'));
logDebug('- Los demás tests se ejecutarán en los próximos segundos...');
logDebug('');
logDebug('💡 TIP: Si algún test falla, recarga la página y vuelve a ejecutar este script.');
