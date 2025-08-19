// Audio Processor - Web Audio API Integration
// Handles normalization, crossfade, and audio processing

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.compressor = null;
        this.analyser = null;
        this.crossfadeGain1 = null;
        this.crossfadeGain2 = null;
        this.currentSource = null;
        this.nextSource = null;
        this.isInitialized = false;

        // Normalization settings
        this.normalizationEnabled = false;
        this.targetLUFS = -14;
        this.peakProtection = true;

        // Crossfade settings
        this.crossfadeDuration = 0;
        this.isCrossfading = false;

        // Pre-buffer for gapless playback
        this.preBufferedTrack = null;
        this.preBufferTime = 3; // seconds
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Create or get AudioContext
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create master gain node (with headroom)
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.95; // Leave 5% headroom to prevent clipping

            // Create dynamics compressor for normalization
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.setupCompressor();

            // Create peak limiter to prevent saturation
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.limiter.threshold.value = -1.0; // -1 dB ceiling
            this.limiter.ratio.value = 20.0; // Limiting ratio (essentially brick wall)
            this.limiter.knee.value = 0; // Hard knee for limiting
            this.limiter.attack.value = 0.001; // 1ms - very fast for peaks
            this.limiter.release.value = 0.01; // 10ms - quick recovery

            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            // Create crossfade gain nodes (with compensation)
            this.crossfadeGain1 = this.audioContext.createGain();
            this.crossfadeGain2 = this.audioContext.createGain();
            this.crossfadeGain1.gain.value = 1;
            this.crossfadeGain2.gain.value = 0;

            // Connect nodes with limiter: source -> crossfade -> compressor -> limiter -> analyser -> master -> output
            this.crossfadeGain1.connect(this.compressor);
            this.crossfadeGain2.connect(this.compressor);
            this.compressor.connect(this.limiter);
            this.limiter.connect(this.analyser);
            this.analyser.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);

            this.isInitialized = true;
            this.isConnected = true;

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.error('Failed to initialize Audio Processor:', error);
        }
    }

    setupCompressor() {
        if (!this.compressor) return;

        // Professional audio normalization settings with better presets
        if (this.normalizationEnabled) {
            // Use optimized presets based on mode to prevent saturation
            let threshold, ratio, knee, attack, release;

            switch (this.normalizationMode) {
                case 'natural':
                    threshold = -18; // High-fidelity threshold
                    ratio = 2; // Gentle compression
                    knee = 6; // Soft knee for smooth transition
                    attack = 0.02; // 20ms - preserves transients
                    release = 0.3; // 300ms - natural decay
                    break;

                case 'balanced':
                    threshold = -14; // K-14 standard (not -20!)
                    ratio = 3; // Moderate compression (not 4!)
                    knee = 4; // Medium knee
                    attack = 0.01; // 10ms - balanced (not 3ms!)
                    release = 0.2; // 200ms - musical
                    break;

                case 'loud':
                    threshold = -9; // Aggressive threshold
                    ratio = 6; // Strong compression
                    knee = 2; // Hard knee
                    attack = 0.005; // 5ms - fast but not too fast
                    release = 0.1; // 100ms - quick recovery
                    break;

                default:
                    threshold = this.targetLUFS;
                    ratio = 3;
                    knee = 4;
                    attack = 0.01;
                    release = 0.2;
            }

            // Apply settings with smooth transitions
            this.compressor.threshold.setValueAtTime(threshold, this.audioContext.currentTime);
            this.compressor.knee.setValueAtTime(knee, this.audioContext.currentTime);
            this.compressor.ratio.setValueAtTime(ratio, this.audioContext.currentTime);
            this.compressor.attack.setValueAtTime(attack, this.audioContext.currentTime);
            this.compressor.release.setValueAtTime(release, this.audioContext.currentTime);

        } else {
            // Bypass compression
            this.compressor.threshold.setValueAtTime(0, this.audioContext.currentTime);
            this.compressor.ratio.setValueAtTime(1, this.audioContext.currentTime);
        }
    }

    getCompressionRatio() {
        // Different ratios for different normalization modes
        switch (this.normalizationMode) {
            case 'natural':
                return 2; // Light compression
            case 'balanced':
                return 4; // Moderate compression
            case 'loud':
                return 8; // Heavy compression
            default:
                return 4;
        }
    }

    async connectAudioElement(audioElement) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Check if element already has a source to avoid re-creating
            if (audioElement._audioSource) {

                return audioElement._audioSource;
            }

            // Resume context if suspended - CRITICAL
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();

            }

            // Check if element is already connected to something
            if (audioElement._connected) {

                return null;
            }

            // Create media element source - this can only be done once per element
            let source;
            try {
                source = this.audioContext.createMediaElementSource(audioElement);
                audioElement._audioSource = source;
                audioElement._connected = true;
            } catch (e) {
                if (e.name === 'InvalidStateError') {

                    return null;
                }
                throw e;
            }

            // Connect to crossfade chain
            if (!this.currentSource) {
                source.connect(this.crossfadeGain1);
                this.currentSource = source;
            } else {
                source.connect(this.crossfadeGain2);
                this.nextSource = source;
            }

            return source;
        } catch (error) {
            console.error('Failed to connect audio element:', error);
            // Don't block playback if connection fails
            return null;
        }
    }

    // Apply configuration from Audio Config Manager
    applyConfiguration(config) {

        // IMPORTANT: Never disconnect or recreate nodes while playing
        // Store current playing state
        const wasPlaying = this.currentSource !== null;

        // Normalization settings
        if (config.smartVolume) {
            this.normalizationEnabled = config.smartVolume !== 'off';
            this.normalizationMode = config.smartVolume;

            // Set target LUFS based on mode
            switch (config.smartVolume) {
                case 'natural':
                    this.targetLUFS = -18;
                    break;
                case 'balanced':
                    this.targetLUFS = config.targetLufs || -14;
                    break;
                case 'loud':
                    this.targetLUFS = -9;
                    break;
                default:
                    this.targetLUFS = config.targetLufs || -14;
            }

            this.peakProtection = config.peakProtection !== false;

            // Only update compressor settings, don't recreate connections
            if (this.compressor && this.isInitialized) {
                this.setupCompressor();
            }
        }

        // Crossfade settings
        if (config.crossfade !== undefined) {
            this.crossfadeDuration = config.crossfade;

        }

        // Pre-buffer time for gapless playback
        if (config.preload !== undefined) {
            this.preBufferTime = config.preload;

        }

        // Resume context if it got suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {

            });
        }

        // Ensure connection state is preserved
        if (wasPlaying) {

            this.isConnected = true;
        }

    }

    // Crossfade between current and next track with compensation
    async startCrossfade(duration = null) {
        if (!this.nextSource || this.isCrossfading) return;

        const fadeDuration = duration || this.crossfadeDuration;
        if (fadeDuration <= 0) return;

        this.isCrossfading = true;
        const startTime = this.audioContext.currentTime;
        const endTime = startTime + fadeDuration;

        // Compensation factor to prevent summing peaks during crossfade
        const compensation = 0.707; // -3dB compensation when both tracks playing

        // Fade out current track with compensation
        this.crossfadeGain1.gain.cancelScheduledValues(startTime);
        this.crossfadeGain1.gain.setValueAtTime(1, startTime);
        this.crossfadeGain1.gain.linearRampToValueAtTime(0, endTime);

        // Fade in next track with compensation (never exceeds 0.707 during overlap)
        this.crossfadeGain2.gain.cancelScheduledValues(startTime);
        this.crossfadeGain2.gain.setValueAtTime(0, startTime);
        this.crossfadeGain2.gain.linearRampToValueAtTime(
            compensation,
            startTime + fadeDuration / 2
        );
        this.crossfadeGain2.gain.linearRampToValueAtTime(1, endTime);

        // Swap references after fade completes
        setTimeout(() => {
            // Swap gain nodes
            [this.crossfadeGain1, this.crossfadeGain2] = [this.crossfadeGain2, this.crossfadeGain1];

            // Update source references
            this.currentSource = this.nextSource;
            this.nextSource = null;

            this.isCrossfading = false;

        }, fadeDuration * 1000);
    }

    // Pre-buffer next track for gapless playback
    async preBufferNextTrack(audioUrl) {
        if (!this.audioContext) return;

        try {

            // Fetch and decode audio data
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.preBufferedTrack = {
                buffer: audioBuffer,
                url: audioUrl
            };

            return true;
        } catch (error) {
            console.error('Failed to pre-buffer track:', error);
            return false;
        }
    }

    // Play pre-buffered track immediately (gapless)
    playPreBufferedTrack() {
        if (!this.preBufferedTrack || !this.audioContext) return null;

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.preBufferedTrack.buffer;

            // Connect to next crossfade gain
            source.connect(this.crossfadeGain2);
            this.nextSource = source;

            // Start playback
            source.start(0);

            // If crossfade is enabled, start it
            if (this.crossfadeDuration > 0) {
                this.startCrossfade();
            } else {
                // Instant switch for gapless
                this.crossfadeGain1.gain.value = 0;
                this.crossfadeGain2.gain.value = 1;
                [this.crossfadeGain1, this.crossfadeGain2] = [
                    this.crossfadeGain2,
                    this.crossfadeGain1
                ];
                this.currentSource = this.nextSource;
                this.nextSource = null;
            }

            ');

            // Clear pre-buffer
            this.preBufferedTrack = null;

            return source;
        } catch (error) {
            console.error('Failed to play pre-buffered track:', error);
            return null;
        }
    }

    // Get current audio levels for visualization
    getAudioLevels() {
        if (!this.analyser || !this.isInitialized) {
            return { peak: 0, rms: 0, lufs: 0 };
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        let peak = 0;
        let sum = 0;

        for (let i = 0; i < bufferLength; i++) {
            const value = Math.abs(dataArray[i]);
            peak = Math.max(peak, value);
            sum += value * value;
        }

        const rms = Math.sqrt(sum / bufferLength);

        // Approximate LUFS (simplified calculation)
        const lufs = rms > 0 ? 20 * Math.log10(rms) : -70;

        return {
            peak: peak,
            rms: rms,
            lufs: lufs,
            peakDb: peak > 0 ? 20 * Math.log10(peak) : -70,
            rmsDb: rms > 0 ? 20 * Math.log10(rms) : -70
        };
    }

    // Set master volume
    setVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, value));
        }
    }

    // Get frequency data for spectrum analyzer
    getFrequencyData() {
        if (!this.analyser || !this.isInitialized) {
            return new Uint8Array(128);
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        return dataArray;
    }

    // Clean up resources
    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;

    }
}

// Export class globally for testing
window.AudioProcessor = AudioProcessor;

// Export as singleton
window.audioProcessor = new AudioProcessor();

