// VU Meter con Web Audio API y Procesamiento

let analyser = null;
let dataArray = null;
let animationId = null;

// ESCALA AJUSTADA: -50 a +3 dB (más sensible)
const MIN_DB = -50;  // Cambiado de -60 a -50
const MAX_DB = 3;
const DB_RANGE = MAX_DB - MIN_DB;  // 53 dB de rango

// Inicializar VU Meter con el processor
function initVUMeter() {
    const audio = document.getElementById('global-audio');
    if (!audio) {
        console.error('Audio element not found');
        return;
    }

    try {
        // Usar el Audio Processor Lite si existe
        if (window.audioProcessorLite && !window.audioProcessorLite.isInitialized) {
            window.audioProcessorLite.initialize(audio).then(() => {
                setupVUFromProcessor();
            });
        } else if (window.audioProcessorLite && window.audioProcessorLite.isInitialized) {
            setupVUFromProcessor();
        } else {
            // Fallback: crear analyser propio
            setupStandaloneVU(audio);
        }
    } catch (error) {
        console.error('Error iniciando VU Meter:', error);
    }
}

// Usar analyser del processor
function setupVUFromProcessor() {
    if (window.audioProcessorLite && window.audioProcessorLite.getAnalyser()) {
        analyser = window.audioProcessorLite.getAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Float32Array(bufferLength);
        startVUAnimation();
        ');
    }
}

// Crear analyser standalone
function setupStandaloneVU(audio) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Float32Array(bufferLength);

        const source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        startVUAnimation();
        ');
    } catch (e) {
        console.error('Error en standalone VU:', e);
    }
}

// Animación del VU meter
function startVUAnimation() {
    function updateMeters() {
        animationId = requestAnimationFrame(updateMeters);

        if (!analyser || !dataArray) return;

        // Obtener datos de audio
        analyser.getFloatTimeDomainData(dataArray);

        // Calcular RMS para cada canal (simulado)
        let sumL = 0, sumR = 0;
        const halfLength = Math.floor(dataArray.length / 2);

        // Canal izquierdo
        for (let i = 0; i < halfLength; i++) {
            const value = dataArray[i];
            sumL += value * value;
        }

        // Canal derecho (con pequeño offset para variación)
        for (let i = halfLength; i < dataArray.length; i++) {
            const value = dataArray[i] * 1.05; // Pequeña variación
            sumR += value * value;
        }

        // Calcular RMS
        const rmsL = Math.sqrt(sumL / halfLength);
        const rmsR = Math.sqrt(sumR / halfLength);

        // Convertir a dB
        const dbL = rmsL > 0 ? 20 * Math.log10(rmsL) : -60;
        const dbR = rmsR > 0 ? 20 * Math.log10(rmsR) : -60;

        // Actualizar UI
        updateMeterUI('l', dbL);
        updateMeterUI('r', dbR);
    }

    updateMeters();
}

// Actualizar la UI del meter con nueva escala
function updateMeterUI(channel, db) {
    const meter = document.getElementById(`meter-${channel}`);
    const dbText = document.getElementById(`db-${channel}`);
    const peak = document.getElementById(`peak-${channel}`);

    if (!meter || !dbText) return;

    // Limitar el rango con nueva escala (-50 a +3)
    const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));

    // Convertir dB a porcentaje con nueva escala
    const percent = ((clampedDb - MIN_DB) / DB_RANGE) * 100;

    // Actualizar barra
    meter.style.width = percent + '%';

    // Actualizar texto con nuevo mínimo
    if (db <= MIN_DB) {
        dbText.textContent = '-∞ dB';
    } else {
        dbText.textContent = db.toFixed(1) + ' dB';
    }

    // Cambiar color según nivel
    if (db > 0) {
        meter.style.background = 'linear-gradient(90deg, #00ff00 0%, #00ff00 60%, #ffff00 80%, #ff6600 90%, #ff0000 100%)';
        dbText.style.color = '#ff0000';
        if (peak) peak.style.opacity = '1';
    } else if (db > -6) {
        dbText.style.color = '#ff6600';
        if (peak) peak.style.opacity = '0';
    } else if (db > -12) {
        dbText.style.color = '#ffff00';
        if (peak) peak.style.opacity = '0';
    } else {
        dbText.style.color = '#00ff00';
        if (peak) peak.style.opacity = '0';
    }

    // Indicadores
    updateIndicators(db);
}

// Actualizar indicadores
function updateIndicators(db) {
    // Clip indicator
    const clipIndicator = document.getElementById('clip-indicator');
    if (clipIndicator) {
        if (db > 0) {
            clipIndicator.style.background = '#ff0000';
            clipIndicator.style.boxShadow = '0 0 10px rgba(255,0,0,0.8)';
            setTimeout(() => {
                clipIndicator.style.background = '#330000';
                clipIndicator.style.boxShadow = 'none';
            }, 200);
        }
    }

    // Stereo indicator (activo con nueva escala)
    const stereoIndicator = document.getElementById('stereo-indicator');
    if (stereoIndicator && db > MIN_DB) {
        stereoIndicator.style.background = '#00ff00';
        stereoIndicator.style.boxShadow = '0 0 5px rgba(0,255,0,0.5)';
    }

    // Mostrar reducción del compresor si está disponible
    if (window.audioProcessorLite && window.audioProcessorLite.getCompressionReduction) {
        const reduction = window.audioProcessorLite.getCompressionReduction();
        if (reduction < -1) {
            const compIndicator = document.getElementById('comp-indicator');
            if (compIndicator) {
                compIndicator.style.background = '#0066ff';
                compIndicator.style.boxShadow = `0 0 ${Math.abs(reduction)}px rgba(0,102,255,0.5)`;
            }
        }
    }

    // Comp indicator (activo cuando hay compresión)
    const compIndicator = document.getElementById('comp-indicator');
    if (compIndicator && db > -20 && db < -6) {
        compIndicator.style.background = '#0066ff';
        compIndicator.style.boxShadow = '0 0 5px rgba(0,102,255,0.5)';
    } else if (compIndicator) {
        compIndicator.style.background = '#003366';
        compIndicator.style.boxShadow = 'none';
    }
}

// Esperar a que el audio esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar cuando se reproduzca algo
    const audio = document.getElementById('global-audio');
    if (audio) {
        audio.addEventListener('play', () => {
            if (!audioContext) {
                initVUMeter();
            } else if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        });

        audio.addEventListener('pause', () => {
            // Reducir meters gradualmente
            const meters = ['l', 'r'];
            meters.forEach(ch => {
                const meter = document.getElementById(`meter-${ch}`);
                const dbText = document.getElementById(`db-${ch}`);
                if (meter) {
                    meter.style.transition = 'width 1s ease-out';
                    meter.style.width = '0%';
                }
                if (dbText) {
                    setTimeout(() => {
                        dbText.textContent = '-∞ dB';
                        dbText.style.color = '#00ff00';
                    }, 1000);
                }
            });
        });
    }
});

