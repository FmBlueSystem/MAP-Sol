/**
 * K-Meter Compact Visualizer
 * Versión simplificada y optimizada
 */

class KMeterCompact {
    constructor(audioElement) {
        this.audioElement = audioElement;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.peakHoldL = -Infinity;
        this.peakHoldR = -Infinity;
        this.peakDecay = 0.95;
        this.isConnected = false;

        this.init();
    }

    init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.3;

            // Create data array
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Float32Array(bufferLength);

            // Connect to audio element
            if (this.audioElement) {
                this.connectAudio();
            }

            // Start animation
            this.animate();
        } catch (error) {
            console.error('Error initializing K-Meter:', error);
        }
    }

    connectAudio() {
        if (this.isConnected || !this.audioElement) {
            return;
        }

        try {
            // Create source from audio element
            this.source = this.audioContext.createMediaElementSource(this.audioElement);

            // Create splitter for L/R channels
            this.splitter = this.audioContext.createChannelSplitter(2);

            // Connect: source -> splitter -> analyser -> destination
            this.source.connect(this.splitter);
            this.source.connect(this.audioContext.destination);
            this.splitter.connect(this.analyser, 0); // Left channel

            this.isConnected = true;
        } catch (error) {
            console.error('Error connecting audio:', error);
        }
    }

    calculatePeak() {
        if (!this.analyser) {
            return { left: -Infinity, right: -Infinity };
        }

        // Get time domain data
        this.analyser.getFloatTimeDomainData(this.dataArray);

        let peakL = 0;
        let peakR = 0;

        // Calculate peak values
        for (let i = 0; i < this.dataArray.length; i++) {
            const sample = Math.abs(this.dataArray[i]);
            if (i % 2 === 0) {
                peakL = Math.max(peakL, sample);
            } else {
                peakR = Math.max(peakR, sample);
            }
        }

        // Convert to dB
        const dbL = peakL > 0 ? 20 * Math.log10(peakL) : -Infinity;
        const dbR = peakR > 0 ? 20 * Math.log10(peakR) : -Infinity;

        // Update peak hold
        if (dbL > this.peakHoldL) {
            this.peakHoldL = dbL;
        } else {
            this.peakHoldL *= this.peakDecay;
        }

        if (dbR > this.peakHoldR) {
            this.peakHoldR = dbR;
        } else {
            this.peakHoldR *= this.peakDecay;
        }

        return { left: dbL, right: dbR };
    }

    updateDisplay(peaks) {
        // Update left channel - updated IDs for new layout
        const leftFill =
            document.getElementById('vu-left') ||
            document.getElementById('peak-left-fill-bar') ||
            document.getElementById('peak-left-fill');
        const leftValue =
            document.getElementById('vu-val-l') ||
            document.getElementById('peak-left-value-bar') ||
            document.getElementById('peak-left-value');
        const leftHold = document.getElementById('peak-left-hold-bar') || document.getElementById('peak-left-hold');

        if (leftFill && leftValue) {
            const leftPercent = Math.max(0, Math.min(100, (peaks.left + 60) * 1.67));
            leftFill.style.width = leftPercent + '%';
            leftValue.textContent = peaks.left > -60 ? peaks.left.toFixed(1) : '-∞';

            // Color based on level
            if (peaks.left > -3) {
                leftValue.style.color = '#f00';
            } else if (peaks.left > -12) {
                leftValue.style.color = '#ff0';
            } else {
                leftValue.style.color = '#0f0';
            }
        }

        if (leftHold) {
            const holdPercent = Math.max(0, Math.min(100, (this.peakHoldL + 60) * 1.67));
            leftHold.style.left = holdPercent + '%';
        }

        // Update right channel - updated IDs for new layout
        const rightFill =
            document.getElementById('vu-right') ||
            document.getElementById('peak-right-fill-bar') ||
            document.getElementById('peak-right-fill');
        const rightValue =
            document.getElementById('vu-val-r') ||
            document.getElementById('peak-right-value-bar') ||
            document.getElementById('peak-right-value');
        const rightHold = document.getElementById('peak-right-hold-bar') || document.getElementById('peak-right-hold');

        if (rightFill && rightValue) {
            const rightPercent = Math.max(0, Math.min(100, (peaks.right + 60) * 1.67));
            rightFill.style.width = rightPercent + '%';
            rightValue.textContent = peaks.right > -60 ? peaks.right.toFixed(1) : '-∞';

            // Color based on level
            if (peaks.right > -3) {
                rightValue.style.color = '#f00';
            } else if (peaks.right > -12) {
                rightValue.style.color = '#ff0';
            } else {
                rightValue.style.color = '#0f0';
            }
        }

        if (rightHold) {
            const holdPercent = Math.max(0, Math.min(100, (this.peakHoldR + 60) * 1.67));
            rightHold.style.left = holdPercent + '%';
        }
    }

    animate() {
        if (!this.audioContext) {
            return;
        }

        const peaks = this.calculatePeak();
        this.updateDisplay(peaks);

        requestAnimationFrame(() => this.animate());
    }

    reset() {
        this.peakHoldL = -Infinity;
        this.peakHoldR = -Infinity;
        this.updateDisplay({ left: -Infinity, right: -Infinity });
    }

    destroy() {
        if (this.source) {
            this.source.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Auto-initialize when audio element is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for audio element to be created
    const checkAudio = setInterval(() => {
        const audioElement = document.getElementById('audioPlayer');
        if (audioElement) {
            clearInterval(checkAudio);
            window.kMeterCompact = new KMeterCompact(audioElement);

            // Reset on track change
            audioElement.addEventListener('loadstart', () => {
                if (window.kMeterCompact) {
                    window.kMeterCompact.reset();
                }
            });
        }
    }, 100);
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KMeterCompact;
}
