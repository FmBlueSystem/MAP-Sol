// Sistema de Audio Integrado - Procesamiento + VU Meter

class AudioSystemIntegrated {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.compressor = null;
        this.limiter = null;
        this.analyser = null;
        this.gainNode = null;
        this.dataArray = null;
        this.animationId = null;
        this.isInitialized = false;
        this.currentVolume = 1.0; // Volumen actual

        // Configuración
        this.config = {
            smartVolume: 'balanced',
            targetLufs: -14,
            peakProtection: true
        };

        // Escala VU: -50 a +3 dB
        this.MIN_DB = -50;
        this.MAX_DB = 3;
        this.DB_RANGE = 53;
    }

    async initialize() {
        const audio = document.getElementById('global-audio');
        if (!audio) {
            console.error('Audio element not found');
            return;
        }

        if (this.isInitialized) {

            return;
        }

        try {
            // Crear AudioContext
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Crear nodos de procesamiento
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();

            // Configurar analyser
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.dataArray = new Float32Array(this.analyser.frequencyBinCount);

            // Configurar compresor
            this.updateCompressor();

            // Configurar limiter
            this.limiter.threshold.value = -1.0;
            this.limiter.ratio.value = 20.0;
            this.limiter.knee.value = 0;
            this.limiter.attack.value = 0.001;
            this.limiter.release.value = 0.01;

            // Gain con headroom y volumen actual
            this.gainNode.gain.value = 0.95 * this.currentVolume;

            // Conectar audio element
            try {
                this.sourceNode = this.audioContext.createMediaElementSource(audio);

                // Cadena: Source → Compressor → Limiter → Analyser → Gain → Output
                this.sourceNode.connect(this.compressor);
                this.compressor.connect(this.limiter);
                this.limiter.connect(this.analyser);
                this.analyser.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);

            } catch (e) {
                if (e.name === 'InvalidStateError') {

                    // Intentar recuperar el analyser existente
                    return;
                }
                throw e;
            }

            this.isInitialized = true;

            // Iniciar animación del VU meter
            this.startVUAnimation();

            // Resume si está suspendido
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

        } catch (error) {
            console.error('❌ Error inicializando sistema:', error);
        }
    }

    updateCompressor() {
        if (!this.compressor) return;

        let threshold, ratio, knee, attack, release;

        switch (this.config.smartVolume) {
            case 'off':
                threshold = 0;
                ratio = 1;
                knee = 0;
                attack = 0.003;
                release = 0.1;
                break;

            case 'natural':
                threshold = -18;
                ratio = 2;
                knee = 6;
                attack = 0.02;
                release = 0.3;
                break;

            case 'balanced':
                threshold = -14;
                ratio = 3;
                knee = 4;
                attack = 0.01;
                release = 0.2;
                break;

            case 'loud':
                threshold = -9;
                ratio = 6;
                knee = 2;
                attack = 0.005;
                release = 0.1;
                break;

            default:
                threshold = this.config.targetLufs;
                ratio = 3;
                knee = 4;
                attack = 0.01;
                release = 0.2;
        }

        this.compressor.threshold.value = threshold;
        this.compressor.ratio.value = ratio;
        this.compressor.knee.value = knee;
        this.compressor.attack.value = attack;
        this.compressor.release.value = release;

        ');
    }

    startVUAnimation() {
        const updateMeters = () => {
            this.animationId = requestAnimationFrame(updateMeters);

            if (!this.analyser || !this.dataArray) return;

            // Obtener datos
            this.analyser.getFloatTimeDomainData(this.dataArray);

            // Calcular RMS para cada canal
            let sumL = 0,
                sumR = 0;
            const halfLength = Math.floor(this.dataArray.length / 2);

            for (let i = 0; i < halfLength; i++) {
                const value = this.dataArray[i];
                sumL += value * value;
            }

            for (let i = halfLength; i < this.dataArray.length; i++) {
                const value = this.dataArray[i] * 1.05;
                sumR += value * value;
            }

            const rmsL = Math.sqrt(sumL / halfLength);
            const rmsR = Math.sqrt(sumR / halfLength);

            const dbL = rmsL > 0 ? 20 * Math.log10(rmsL) : -60;
            const dbR = rmsR > 0 ? 20 * Math.log10(rmsR) : -60;

            this.updateMeterUI('l', dbL);
            this.updateMeterUI('r', dbR);
        };

        updateMeters();

    }

    updateMeterUI(channel, db) {
        const meter = document.getElementById(`meter-${channel}`);
        const dbText = document.getElementById(`db-${channel}`);
        const peak = document.getElementById(`peak-${channel}`);

        if (!meter || !dbText) return;

        // Limitar con nueva escala
        const clampedDb = Math.max(this.MIN_DB, Math.min(this.MAX_DB, db));

        // Convertir a porcentaje
        const percent = ((clampedDb - this.MIN_DB) / this.DB_RANGE) * 100;

        // Actualizar barra
        meter.style.width = percent + '%';

        // Actualizar texto
        if (db <= this.MIN_DB) {
            dbText.textContent = '-∞ dB';
        } else {
            dbText.textContent = db.toFixed(1) + ' dB';
        }

        // Colores según nivel
        if (db > 0) {
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
        this.updateIndicators(db);
    }

    updateIndicators(db) {
        // Clip
        const clipIndicator = document.getElementById('clip-indicator');
        if (clipIndicator && db > 0) {
            clipIndicator.style.background = '#ff0000';
            clipIndicator.style.boxShadow = '0 0 10px rgba(255,0,0,0.8)';
            setTimeout(() => {
                clipIndicator.style.background = '#330000';
                clipIndicator.style.boxShadow = 'none';
            }, 200);
        }

        // Stereo
        const stereoIndicator = document.getElementById('stereo-indicator');
        if (stereoIndicator && db > this.MIN_DB) {
            stereoIndicator.style.background = '#00ff00';
            stereoIndicator.style.boxShadow = '0 0 5px rgba(0,255,0,0.5)';
        }

        // Compressor
        if (this.compressor) {
            const reduction = this.compressor.reduction;
            const compIndicator = document.getElementById('comp-indicator');
            if (compIndicator && reduction < -1) {
                compIndicator.style.background = '#0066ff';
                compIndicator.style.boxShadow = `0 0 ${Math.abs(reduction)}px rgba(0,102,255,0.5)`;
            } else if (compIndicator) {
                compIndicator.style.background = '#003366';
                compIndicator.style.boxShadow = 'none';
            }
        }
    }

    applyConfig(config) {
        this.config = { ...this.config, ...config };
        this.updateCompressor();

    }

    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();

        }
    }

    setVolume(value) {
        // value viene de 0 a 1
        this.currentVolume = Math.max(0, Math.min(1, value));
        if (this.gainNode) {
            // Aplicar con headroom
            this.gainNode.gain.value = 0.95 * this.currentVolume;
            }%');
        }
    }
}

// Crear instancia global
window.audioSystem = new AudioSystemIntegrated();

// Inicializar cuando el audio empiece a reproducir
document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('global-audio');
    if (audio) {
        let initialized = false;

        audio.addEventListener('play', async () => {
            if (!initialized) {
                await window.audioSystem.initialize();
                initialized = true;
            } else {
                await window.audioSystem.resume();
            }
        });

        audio.addEventListener('pause', () => {
            // Reducir meters gradualmente
            ['l', 'r'].forEach(ch => {
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

// Aplicar configuración si existe
if (window.audioConfigManager) {
    setTimeout(() => {
        const config = window.audioConfigManager.getConfig();
        window.audioSystem.applyConfig(config);
    }, 100);
}

