// Audio Processor Lite - Procesamiento de audio optimizado

class AudioProcessorLite {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.compressor = null;
        this.limiter = null;
        this.analyser = null;
        this.gainNode = null;
        this.isInitialized = false;

        // Configuración
        this.config = {
            smartVolume: 'balanced',
            targetLufs: -14,
            peakProtection: true,
            algorithm: 'lufs'
        };
    }

    async initialize(audioElement) {
        if (this.isInitialized) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Crear nodos
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.analyser = this.audioContext.createAnalyser();
            this.gainNode = this.audioContext.createGain();

            // Configurar analyser para VU meter
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            // Configurar compresor inicial
            this.updateCompressor();

            // Configurar limiter (peak protection)
            this.limiter.threshold.value = -1.0; // -1 dB ceiling
            this.limiter.ratio.value = 20.0; // Brick wall
            this.limiter.knee.value = 0;
            this.limiter.attack.value = 0.001; // 1ms
            this.limiter.release.value = 0.01; // 10ms

            // Gain con headroom
            this.gainNode.gain.value = 0.95;

            // Conectar fuente si se proporciona
            if (audioElement) {
                try {
                    this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
                    this.connectNodes();
                } catch (e) {
                    if (e.name === 'InvalidStateError') {

                    }
                }
            }

            this.isInitialized = true;

            // Resume si está suspendido
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.error('Error inicializando processor:', error);
        }
    }

    connectNodes() {
        if (!this.sourceNode) return;

        // Cadena: Source → Compressor → Limiter → Analyser → Gain → Output
        this.sourceNode.connect(this.compressor);
        this.compressor.connect(this.limiter);
        this.limiter.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

    }

    updateCompressor() {
        if (!this.compressor) return;

        let threshold, ratio, knee, attack, release;

        switch (this.config.smartVolume) {
            case 'off':
                // Bypass
                threshold = 0;
                ratio = 1;
                knee = 0;
                attack = 0.003;
                release = 0.1;
                break;

            case 'natural':
                // Hi-Fi suave
                threshold = -18;
                ratio = 2;
                knee = 6;
                attack = 0.02;
                release = 0.3;
                break;

            case 'balanced':
                // K-14 estándar
                threshold = -14;
                ratio = 3;
                knee = 4;
                attack = 0.01;
                release = 0.2;
                break;

            case 'loud':
                // Radio/Club
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

        // Aplicar configuración
        this.compressor.threshold.value = threshold;
        this.compressor.ratio.value = ratio;
        this.compressor.knee.value = knee;
        this.compressor.attack.value = attack;
        this.compressor.release.value = release;

        ');
    }

    applyConfig(config) {
        this.config = { ...this.config, ...config };
        this.updateCompressor();

        // Actualizar target LUFS según modo
        if (config.smartVolume) {
            switch (config.smartVolume) {
                case 'natural':
                    this.config.targetLufs = -18;
                    break;
                case 'balanced':
                    this.config.targetLufs = config.targetLufs || -14;
                    break;
                case 'loud':
                    this.config.targetLufs = -9;
                    break;
            }
        }

    }

    getAnalyser() {
        return this.analyser;
    }

    getCompressionReduction() {
        if (this.compressor) {
            return this.compressor.reduction;
        }
        return 0;
    }

    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// Crear instancia global
window.audioProcessorLite = new AudioProcessorLite();

// Cargar configuración si existe
if (window.audioConfigManager) {
    window.audioProcessorLite.applyConfig(window.audioConfigManager.getConfig());
}

