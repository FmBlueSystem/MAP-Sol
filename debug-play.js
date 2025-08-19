// Debug script para encontrar el problema
logDebug('🔍 DEBUG: Iniciando diagnóstico...');

// Verificar si el player existe
logDebug('1. simplePlayer existe?', typeof window.simplePlayer !== 'undefined');
logDebug('2. fixedPlayer existe?', typeof window.fixedPlayer !== 'undefined');

// Interceptar clicks en file-cards
document.addEventListener('DOMContentLoaded', () => {
    logDebug('3. DOM loaded');

    // Buscar file-cards
    setTimeout(() => {
        const cards = document.querySelectorAll('.file-card');
        logDebug('4. File cards encontradas:', cards.length);

        if (cards.length > 0) {
            // Probar reproducir el primer archivo directamente
            const firstCard = cards[0];
            const filePath = firstCard.getAttribute('data-path');
            logDebug('5. Primer archivo path:', filePath);

            // Crear un audio de prueba directo
            logDebug('6. Creando audio de prueba...');
            const testAudio = new Audio(filePath);
            testAudio.volume = 0.5;

            testAudio.addEventListener('error', e => {
                logError('❌ Error en audio:', e);
                logError('Error code:', e.target.error?.code);
                logError('Error message:', e.target.error?.message);
            });

            testAudio.addEventListener('loadedmetadata', () => {
                logInfo('✅ Metadata cargada, duration:', testAudio.duration);
            });

            testAudio.addEventListener('canplay', () => {
                logInfo('✅ Can play!');
            });

            // Intentar reproducir
            logDebug('7. Intentando play()...');
            testAudio
                .play()
                .then(() => {
                    logInfo('✅ REPRODUCIENDO!');
                    setTimeout(() => {
                        testAudio.pause();
                        logDebug('⏸ Pausado después de 2 segundos');
                    }, 2000);
                })
                .catch(err => {
                    logError('❌ Play falló:', err.name, err.message);
                });
        }
    }, 1000);
});

// Función global para test manual
window.testPlay = function () {
    const cards = document.querySelectorAll('.file-card');
    if (cards.length > 0) {
        const filePath = cards[0].getAttribute('data-path');
        logDebug('Test manual con:', filePath);
        const audio = new Audio(filePath);
        audio
            .play()
            .then(() => {
                logInfo('✅ Test manual funcionó!');
            })
            .catch(err => {
                logError('❌ Test manual falló:', err);
            });
    }
};

logDebug('📝 Para test manual, ejecuta: testPlay()');
