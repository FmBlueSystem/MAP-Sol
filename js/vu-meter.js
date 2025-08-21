// VU Meter Professional - Extended Range (-40 to +3 dB)
class VuMeter {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;

        // LOG DE VERIFICACIÓN DE CAMBIO DE ESCALA
        console.log('🎚️ VU METER SCALE UPDATED:');
        console.log('   Previous range: -20 to +3 dB (23 dB total)');
        console.log('   NEW RANGE: -40 to +3 dB (43 dB total)');
        console.log('   Change applied at:', new Date().toISOString());

        // VU Meter settings - EXTENDED RANGE
        this.minDb = -40; // Minimum dB level (extended from -20)
        this.maxDb = 3; // Maximum dB level (broadcast standard)
        this.dbRange = this.maxDb - this.minDb; // Total range: 43 dB

        // Visual settings
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.meterWidth = this.width * 0.9;
        this.meterHeight = 25;
        this.meterX = (this.width - this.meterWidth) / 2;
        this.meterY = (this.height - this.meterHeight) / 2;

        // Peak hold
        this.peakLevel = -Infinity;
        this.peakHoldTime = 2000; // Hold peak for 2 seconds
        this.peakDecayRate = 0.05; // How fast peak falls
        this.lastPeakTime = 0;

        // Smoothing
        this.smoothingFactor = 0.85; // Audio smoothing
        this.currentLevel = -Infinity;

        // Meter modes
        this.mode = 'broadcast'; // 'broadcast' or 'dj'
        this.showSpectrum = false;

        // Colors for different levels - ADJUSTED FOR -40 to +3 dB
        this.colors = {
            veryLow: '#0066ff', // Blue: -40 to -20 dB
            low: '#00ff00', // Green: -20 to -10 dB
            medium: '#ffff00', // Yellow: -10 to -3 dB
            high: '#ffa500', // Orange: -3 to 0 dB
            peak: '#ff0000', // Red: 0 to +3 dB
        };

        // Scale marks (will be updated by mode)
        this.updateScaleMarks();

        this.setupCanvas();
        this.initResponsive();
    }

    init(analyser) {
        this.analyser = analyser;
        this.dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.startAnimation();
    }

    setupCanvas() {
        // Set canvas resolution for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        this.ctx.scale(dpr, dpr);

        // Update dimensions after scaling
        this.width = rect.width;
        this.height = rect.height;
        this.meterWidth = this.width * 0.8;
        this.meterHeight = 40;
        this.meterX = (this.width - this.meterWidth) / 2;
        this.meterY = (this.height - this.meterHeight) / 2;
    }

    calculateRMS() {
        if (!this.analyser || !this.dataArray) {
            return -Infinity;
        }

        // Get time domain data for RMS calculation
        this.analyser.getByteTimeDomainData(this.dataArray);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            // Convert from 0-255 to -1 to 1
            const normalized = (this.dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / this.dataArray.length);

        // Convert to dB with professional calibration
        const dbFS = 20 * Math.log10(Math.max(0.00001, rms));
        const db = this.getCalibratedDb(dbFS);

        // Apply smoothing
        if (this.currentLevel === -Infinity) {
            this.currentLevel = db;
        } else {
            this.currentLevel = this.currentLevel * this.smoothingFactor + db * (1 - this.smoothingFactor);
        }

        // Update peak
        if (this.currentLevel > this.peakLevel) {
            this.peakLevel = this.currentLevel;
            this.lastPeakTime = Date.now();
        }

        // Peak decay
        const timeSincePeak = Date.now() - this.lastPeakTime;
        if (timeSincePeak > this.peakHoldTime) {
            this.peakLevel -= this.peakDecayRate;
        }

        return this.currentLevel;
    }

    dbToPixels(db) {
        // Convert dB value to pixel position
        const normalized = (db - this.minDb) / this.dbRange;
        const clamped = Math.max(0, Math.min(1, normalized));
        return this.meterX + clamped * this.meterWidth;
    }

    getColorForLevel(db) {
        // UPDATED FOR -40 to +3 dB RANGE
        if (db < -20) {
            return this.colors.veryLow; // Blue: -40 to -20 dB
        }
        if (db < -10) {
            return this.colors.low; // Green: -20 to -10 dB
        }
        if (db < -3) {
            return this.colors.medium; // Yellow: -10 to -3 dB
        }
        if (db < 0) {
            return this.colors.high; // Orange: -3 to 0 dB
        }
        return this.colors.peak; // Red: 0 to +3 dB
    }

    createGradient(level) {
        const gradient = this.ctx.createLinearGradient(this.meterX, 0, this.dbToPixels(level), 0);

        // Add color stops based on NEW dB ranges (-40 to +3)
        gradient.addColorStop(0, this.colors.veryLow); // Start with blue

        if (level > -20) {
            const stop0 = this.dbToPixels(-20) / this.meterWidth;
            gradient.addColorStop(stop0, this.colors.veryLow);
            gradient.addColorStop(stop0, this.colors.low);
        }

        if (level > -10) {
            const stop1 = this.dbToPixels(-10) / this.meterWidth;
            gradient.addColorStop(stop1, this.colors.low);
            gradient.addColorStop(stop1, this.colors.medium);
        }

        if (level > -3) {
            const stop2 = this.dbToPixels(-3) / this.meterWidth;
            gradient.addColorStop(stop2, this.colors.medium);
            gradient.addColorStop(stop2, this.colors.high);
        }

        if (level > 0) {
            const stop3 = this.dbToPixels(0) / this.meterWidth;
            gradient.addColorStop(stop3, this.colors.high);
            gradient.addColorStop(stop3, this.colors.peak);
        }

        gradient.addColorStop(1, this.getColorForLevel(level));

        return gradient;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw background meter area
        this.ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
        this.ctx.fillRect(this.meterX, this.meterY, this.meterWidth, this.meterHeight);

        // Calculate current level
        const currentDb = this.calculateRMS();

        // Draw level bar with gradient
        if (currentDb > this.minDb) {
            const levelWidth = this.dbToPixels(currentDb) - this.meterX;
            const gradient = this.createGradient(currentDb);

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(this.meterX, this.meterY, levelWidth, this.meterHeight);
        }

        // Draw peak indicator
        if (this.peakLevel > this.minDb) {
            const peakX = this.dbToPixels(this.peakLevel);
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(peakX, this.meterY - 5);
            this.ctx.lineTo(peakX, this.meterY + this.meterHeight + 5);
            this.ctx.stroke();
        }

        // Draw scale
        this.drawScale();

        // Draw dB value
        this.drawDbValue(currentDb);

        // Draw mini spectrum (optional)
        if (this.showSpectrum) {
            this.drawMiniSpectrum();
        }
    }

    drawMiniSpectrum() {
        if (!this.analyser || !this.dataArray) {
            return;
        }

        // Get frequency data for spectrum
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(frequencyData);

        // Draw small spectrum bars
        const spectrumY = this.meterY + this.meterHeight + 8;
        const spectrumHeight = 10;
        const barWidth = this.meterWidth / 32; // 32 frequency bars
        const maxFreqIndex = Math.min(32, frequencyData.length / 8);

        this.ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';

        for (let i = 0; i < maxFreqIndex; i++) {
            const value = frequencyData[i * 8] / 255;
            const barHeight = value * spectrumHeight;
            const x = this.meterX + i * barWidth;

            this.ctx.fillRect(x, spectrumY + spectrumHeight - barHeight, barWidth - 1, barHeight);
        }
    }

    // Toggle spectrum display
    toggleSpectrum() {
        this.showSpectrum = !this.showSpectrum;
    }

    // Set VU Meter mode
    setMode(mode) {
        if (mode === 'broadcast' || mode === 'dj') {
            this.mode = mode;

            if (mode === 'broadcast') {
                // Broadcast settings: slower response, stricter range
                this.smoothingFactor = 0.85;
                this.minDb = -20;
                this.maxDb = 3;
                this.peakHoldTime = 2000;
            } else {
                // DJ settings: faster response, wider range
                this.smoothingFactor = 0.7;
                this.minDb = -25;
                this.maxDb = 6;
                this.peakHoldTime = 1500;
                this.showSpectrum = true; // DJ mode shows spectrum by default
            }

            this.dbRange = this.maxDb - this.minDb;
            this.updateScaleMarks();
            console.log(`VU Meter mode set to: ${mode}`);
        }
    }

    // Update scale marks based on current range - UPDATED FOR -40 to +3 dB
    updateScaleMarks() {
        if (this.mode === 'broadcast') {
            // NEW SCALE: -40 to +3 dB with more granular marks
            this.scaleMarks = [-40, -35, -30, -25, -20, -15, -10, -7, -5, -3, 0, 3];
        } else {
            // DJ mode also updated for extended range
            this.scaleMarks = [-40, -30, -25, -20, -15, -10, -5, 0, 3, 6];
        }
    }

    drawScale() {
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';

        this.scaleMarks.forEach((db) => {
            const x = this.dbToPixels(db);

            // Draw tick mark
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.meterY - 3);
            this.ctx.lineTo(x, this.meterY);
            this.ctx.stroke();

            // Draw scale number
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.fillText(db.toString(), x, this.meterY - 8);
        });

        // Draw dB label
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillText('dB', this.meterX + this.meterWidth + 10, this.meterY + this.meterHeight / 2 + 4);
    }

    drawDbValue(db) {
        // Draw current dB value
        const displayDb = db > this.minDb ? db.toFixed(1) : '-∞';

        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = this.getColorForLevel(db);
        this.ctx.fillText(displayDb + ' dB', this.meterX - 10, this.meterY + this.meterHeight / 2 + 5);

        // Draw peak value if different from current (compact)
        if (Math.abs(this.peakLevel - db) > 0.5 && this.peakLevel > this.minDb) {
            this.ctx.font = '8px monospace';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.fillText('P:' + this.peakLevel.toFixed(1), this.meterX + this.meterWidth + 5, this.meterY + 8);
        }
    }

    startAnimation() {
        let lastTime = 0;
        const targetFPS = 60;
        const frameTime = 1000 / targetFPS;

        const animate = (currentTime) => {
            if (currentTime - lastTime >= frameTime) {
                this.draw();
                lastTime = currentTime;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    destroy() {
        this.stopAnimation();
        this.analyser = null;
        this.dataArray = null;
    }

    // Reset peak hold
    resetPeak() {
        this.peakLevel = -Infinity;
        this.lastPeakTime = 0;
    }

    // Set smoothing (0-1, higher = smoother)
    setSmoothing(value) {
        this.smoothingFactor = Math.max(0, Math.min(1, value));
    }

    // Professional calibration method
    calibrate(referenceLevel = -18) {
        // Adjust calibration offset based on reference level
        // -18 dBFS is common for broadcast/digital audio
        this.calibrationOffset = referenceLevel + 21; // Maps -18dBFS to +3dBVU
        console.log(`VU Meter calibrated to ${referenceLevel} dBFS reference`);
    }

    // Get calibrated dB value
    getCalibratedDb(dbFS) {
        const offset = this.calibrationOffset || 3;
        return dbFS + offset;
    }

    // Resize handler
    resize() {
        this.setupCanvas();
    }

    // Auto-resize on window resize
    initResponsive() {
        window.addEventListener('resize', () => {
            setTimeout(() => this.resize(), 100);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resize(), 300);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VuMeter;
} else {
    window.VuMeter = VuMeter;
}
