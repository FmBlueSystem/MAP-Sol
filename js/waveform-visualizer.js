// Waveform Visualizer - Real-time audio waveform display
class WaveformVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.analyser = null;
        this.audioContext = null;
        this.source = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.isInitialized = false;
        this.animationId = null;
        this.peaks = [];
        this.currentTime = 0;
        this.duration = 0;

        this.init();
    }

    init() {
        // Create canvas element
        this.createCanvas();

        // Setup audio context
        this.setupAudioContext();

        // Listen for audio events
        this.setupEventListeners();
    }

    createCanvas() {
        // Check if waveform container exists
        const container = document.querySelector('.waveform-container');
        if (!container) {
            console.warn('Waveform container not found');
            return;
        }

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'waveform-canvas';
        this.canvas.width = container.offsetWidth || 800;
        this.canvas.height = container.offsetHeight || 100;

        container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        // Setup canvas styles
        this.setupCanvasStyle();
    }

    setupCanvasStyle() {
        if (!this.ctx) {
            return;
        }

        // Set default styles
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
    }

    setupAudioContext() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to setup audio context:', error);
        }
    }

    setupEventListeners() {
        // Listen for track load events
        document.addEventListener('track-loaded', e => {
            this.loadTrack(e.detail);
        });

        // Listen for playback events
        document.addEventListener('audio-play', () => {
            this.start();
        });

        document.addEventListener('audio-pause', () => {
            this.stop();
        });

        document.addEventListener('audio-seek', e => {
            this.currentTime = e.detail.time;
            this.drawStaticWaveform();
        });

        // Resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Connect to audio player if exists
        if (window.simplePlayer && window.simplePlayer.howl) {
            this.connectToHowler(window.simplePlayer.howl);
        }
    }

    connectToHowler(howl) {
        if (!howl || !this.audioContext) {
            return;
        }

        try {
            // Get the audio element from Howler
            const sound = howl._sounds[0];
            if (!sound || !sound._node) {
                return;
            }

            // Create source from audio element
            if (this.source) {
                this.source.disconnect();
            }

            this.source = this.audioContext.createMediaElementSource(sound._node);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            // Get duration
            this.duration = howl.duration();

            // Generate peaks for static waveform
            this.generatePeaks();
        } catch (error) {
            console.error('Failed to connect to Howler:', error);
        }
    }

    async loadTrack(trackData) {
        if (!trackData || !trackData.file_path) {
            return;
        }

        try {
            // Request waveform data from backend
            if (window.electronAPI) {
                const waveformData = await window.electronAPI.invoke('get-waveform', trackData.id);
                if (waveformData && waveformData.peaks) {
                    this.peaks = waveformData.peaks;
                    this.duration = waveformData.duration;
                    this.drawStaticWaveform();
                }
            }

            // Connect to audio source if playing
            if (window.simplePlayer && window.simplePlayer.howl) {
                this.connectToHowler(window.simplePlayer.howl);
            }
        } catch (error) {
            console.error('Failed to load track waveform:', error);
        }
    }

    generatePeaks() {
        // Generate fake peaks for now (will be replaced with real audio analysis)
        const peakCount = 500;
        this.peaks = [];

        for (let i = 0; i < peakCount; i++) {
            // Create realistic looking waveform
            const base = Math.random() * 0.3 + 0.2;
            const variation = Math.sin(i / 20) * 0.2;
            const spike = i % 50 === 0 ? Math.random() * 0.3 : 0;

            this.peaks.push(Math.min(1, base + variation + spike));
        }

        this.drawStaticWaveform();
    }

    drawStaticWaveform() {
        if (!this.ctx || !this.canvas) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.1)');
        gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.05)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0.1)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        if (this.peaks.length === 0) {
            // Draw placeholder line
            this.ctx.beginPath();
            this.ctx.moveTo(0, centerY);
            this.ctx.lineTo(width, centerY);
            this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            this.ctx.stroke();
            return;
        }

        // Draw waveform peaks
        const barWidth = width / this.peaks.length;
        const playbackPosition = this.duration > 0 ? this.currentTime / this.duration : 0;

        this.peaks.forEach((peak, i) => {
            const x = i * barWidth;
            const barHeight = peak * (height * 0.8);

            // Different colors for played vs unplayed
            if (i / this.peaks.length <= playbackPosition) {
                // Played portion
                this.ctx.fillStyle = '#667eea';
            } else {
                // Unplayed portion
                this.ctx.fillStyle = 'rgba(102, 126, 234, 0.3)';
            }

            // Draw mirrored bars
            this.ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
        });

        // Draw playback position line
        if (playbackPosition > 0) {
            const x = playbackPosition * width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.strokeStyle = '#FDB813';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    drawLiveWaveform() {
        if (!this.analyser || !this.ctx || !this.canvas) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Get waveform data
        this.analyser.getByteTimeDomainData(this.dataArray);

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.1)');
        gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.05)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0.1)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);

        // Draw waveform
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#667eea';
        this.ctx.beginPath();

        const sliceWidth = width / this.bufferLength;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.drawLiveWaveform());
    }

    drawFrequencyBars() {
        if (!this.analyser || !this.ctx || !this.canvas) {
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw bars
        const barWidth = (width / this.bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * height;

            // Create gradient for bars
            const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(0.5, '#764ba2');
            gradient.addColorStop(1, '#FDB813');

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.drawFrequencyBars());
    }

    start() {
        if (!this.isInitialized) {
            this.setupAudioContext();
        }

        // Start live waveform drawing
        this.drawLiveWaveform();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Draw static waveform
        this.drawStaticWaveform();
    }

    handleResize() {
        const container = document.querySelector('.waveform-container');
        if (!container || !this.canvas) {
            return;
        }

        this.canvas.width = container.offsetWidth;
        this.canvas.height = container.offsetHeight;

        this.setupCanvasStyle();
        this.drawStaticWaveform();
    }

    setVisualizationType(type) {
        // Stop current animation
        this.stop();

        // Switch visualization type
        switch (type) {
            case 'waveform':
                this.drawLiveWaveform();
                break;
            case 'frequency':
                this.drawFrequencyBars();
                break;
            case 'static':
            default:
                this.drawStaticWaveform();
                break;
        }
    }

    updateProgress(currentTime) {
        this.currentTime = currentTime;
        if (!this.animationId) {
            // Only update static waveform if not animating
            this.drawStaticWaveform();
        }
    }

    destroy() {
        this.stop();

        if (this.source) {
            this.source.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }
}

// Initialize waveform visualizer
window.waveformVisualizer = new WaveformVisualizer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaveformVisualizer;
}
