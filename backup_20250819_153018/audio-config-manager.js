// Audio Configuration Manager
// Maneja la configuración de audio y la aplica al reproductor

class AudioConfigManager {
    constructor() {
        this.config = {
            smartVolume: 'balanced',
            targetLufs: -14,
            peakProtection: true,
            algorithm: 'lufs',
            crossfade: 0,
            gapless: true,
            autoPlay: true,
            preload: 3,
            sampleRate: 'auto',
            bufferSize: 1024,
            hwAccel: true
        };

        this.loadConfig();
        this.setupListeners();
    }

    async loadConfig() {
        try {
            // Intentar cargar desde el backend
            if (window.electronAPI && window.electronAPI.getAudioConfig) {
                const savedConfig = await window.electronAPI.getAudioConfig();
                if (savedConfig) {
                    this.config = { ...this.config, ...savedConfig };

                    this.applyConfig();
                }
            }
        } catch (error) {

        }
    }

    setupListeners() {
        // Escuchar actualizaciones de configuración desde el main process
        if (window.electronAPI && window.electronAPI.onAudioConfigUpdated) {
            window.electronAPI.onAudioConfigUpdated(config => {

                this.config = { ...this.config, ...config };
                this.applyConfig();
            });
        }
    }

    applyConfig() {
        // Aplicar auto-play
        if (window.player) {
            window.player.autoPlay = this.config.autoPlay;
            window.player.continuousPlay = this.config.autoPlay;

        }

        if (window.fixedPlayer) {
            // Aplicar configuración al FixedAudioPlayer
            if (this.config.autoPlay !== undefined) {
                // El player usará esta configuración

            }
        }

        // Aplicar configuración al Audio Processor Lite
        if (window.audioProcessorLite) {
            window.audioProcessorLite.applyConfig(this.config);

        }

        // Aplicar normalización de volumen
        this.applyNormalization();

        // Aplicar configuración de calidad
        this.applyQualitySettings();
    }

    applyNormalization() {
        if (!this.config.smartVolume || this.config.smartVolume === 'off') {

            return;
        }

        // Configurar target LUFS según el modo
        let targetLufs = this.config.targetLufs;
        switch (this.config.smartVolume) {
            case 'natural':
                targetLufs = -18; // Hi-Fi standard
                break;
            case 'balanced':
                targetLufs = -14; // Streaming standard (Spotify, YouTube)
                break;
            case 'loud':
                targetLufs = -9; // Radio/Club standard
                break;
        }

        ');

        // Aquí se aplicaría la normalización real al audio
        // Por ahora solo guardamos la configuración
        this.targetLufs = targetLufs;
    }

    applyQualitySettings() {
        if (this.config.sampleRate && this.config.sampleRate !== 'auto') {

        }

        if (this.config.bufferSize) {

        }

        if (this.config.hwAccel) {

        }
    }

    // Métodos para obtener configuración específica
    getConfig() {
        return this.config;
    }

    shouldAutoPlay() {
        return this.config.autoPlay;
    }

    getCrossfadeDuration() {
        return this.config.crossfade || 0;
    }

    isGaplessEnabled() {
        return this.config.gapless;
    }

    getPreloadTime() {
        return this.config.preload || 3;
    }

    getNormalizationSettings() {
        return {
            enabled: this.config.smartVolume !== 'off',
            mode: this.config.smartVolume,
            targetLufs: this.targetLufs || this.config.targetLufs,
            peakProtection: this.config.peakProtection,
            algorithm: this.config.algorithm
        };
    }
}

// Export class globally for testing
window.AudioConfigManager = AudioConfigManager;

// Crear instancia global
window.audioConfigManager = new AudioConfigManager();

