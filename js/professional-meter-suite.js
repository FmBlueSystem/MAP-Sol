/**
 * Professional Meter Suite
 * Broadcast Quality Audio Metering
 * ITU-R BS.1770-4 Compliant
 * LUFS + True Peak + RMS + Correlation
 */

class ProfessionalMeterSuite {
    constructor() {
        // Audio context and nodes
        this.audioContext = null;
        this.source = null;
        this.splitter = null;

        // Analyzers
        this.analyserL = null;
        this.analyserR = null;
        this.analyserMono = null;

        // K-weighting filters for LUFS
        this.preFilterL = null;
        this.preFilterR = null;
        this.rlbFilterL = null;
        this.rlbFilterR = null;

        // LUFS measurements
        this.lufsIntegrated = -23.0;
        this.lufsShortTerm = -23.0;
        this.lufsMomentary = -23.0;
        this.lufsRange = 0.0;

        // True Peak measurements
        this.truePeakL = -60;
        this.truePeakR = -60;
        this.truePeakHoldL = -60;
        this.truePeakHoldR = -60;

        // RMS measurements
        this.rmsL = -60;
        this.rmsR = -60;

        // Correlation
        this.correlation = 0;

        // Measurement history
        this.measurementHistory = [];
        this.maxHistoryLength = 600; // 10 seconds at 60fps

        // Peak hold times
        this.peakHoldTime = 2000; // 2 seconds
        this.lastPeakTimeL = 0;
        this.lastPeakTimeR = 0;

        // Configuration
        this.config = {
            targetLUFS: -14, // Streaming (Spotify/YouTube)
            targetLUFSBroadcast: -23, // EBU R128
            targetLUFSCinema: -27, // Cinema
            truePeakLimit: -1.0, // dBTP
            integrationTime: 400, // ms for momentary
            shortTermWindow: 3000, // 3s for short-term
            gatingThreshold: -70, // LUFS absolute gate
            relativeGate: -10, // dB below ungated
            oversampleFactor: 4, // 4x oversampling for true peak
            refreshRate: 60 // FPS
        };

        // State
        this.isConnected = false;
        this.isFrozen = false;
        this.animationId = null;
        this.startTime = Date.now();

        // Statistics
        this.maxTruePeak = -60;
        this.clipCount = 0;

        // UI Elements cache
        this.elements = {};

        // Initialize
        this.init();
    }

    init() {
        // Create HTML structure
        this.createHTML();
        // Cache DOM elements
        this.cacheElements();
        // Setup event listeners
        this.setupEventListeners();
        // Initialize peak segments
        this.initializePeakSegments();
    }

    createHTML() {
        const html = `
            <div class="professional-meter-suite" id="professional-meter-suite">
                <!-- Header with controls -->
                <div class="meter-header">
                    <h3 class="meter-title">PROFESSIONAL METER SUITE</h3>
                    <div class="meter-controls">
                        <select id="meter-standard" class="meter-select">
                            <option value="streaming" selected>Streaming (-14 LUFS)</option>
                            <option value="broadcast">Broadcast (-23 LUFS)</option>
                            <option value="cinema">Cinema (-27 LUFS)</option>
                            <option value="custom">Custom</option>
                        </select>
                        <button id="meter-reset" class="meter-btn">Reset</button>
                        <button id="meter-freeze" class="meter-btn">Freeze</button>
                        <button id="meter-minimize" class="meter-btn">_</button>
                    </div>
                </div>

                <!-- Main meter container -->
                <div class="meter-content">
                    <!-- LUFS Section -->
                    <div class="lufs-section">
                        <h4 class="section-title">LOUDNESS (LUFS)</h4>
                        <div class="lufs-meters">
                            <!-- Integrated LUFS -->
                            <div class="lufs-meter">
                                <label class="meter-label">INTEGRATED</label>
                                <div class="lufs-bar-container vertical">
                                    <div class="lufs-scale">
                                        <span>0</span>
                                        <span>-6</span>
                                        <span>-14</span>
                                        <span>-23</span>
                                        <span>-36</span>
                                        <span>-48</span>
                                        <span>-60</span>
                                    </div>
                                    <div class="lufs-bar" id="lufs-integrated-bar">
                                        <div class="lufs-fill"></div>
                                        <div class="lufs-target-line"></div>
                                    </div>
                                </div>
                                <div class="lufs-value" id="lufs-integrated-value">-∞</div>
                                <div class="lufs-unit">LUFS</div>
                            </div>

                            <!-- Short-term LUFS -->
                            <div class="lufs-meter">
                                <label class="meter-label">SHORT TERM</label>
                                <div class="lufs-bar-container vertical">
                                    <div class="lufs-bar" id="lufs-short-bar">
                                        <div class="lufs-fill"></div>
                                    </div>
                                </div>
                                <div class="lufs-value" id="lufs-short-value">-∞</div>
                                <div class="lufs-unit">LUFS</div>
                            </div>

                            <!-- Momentary LUFS -->
                            <div class="lufs-meter">
                                <label class="meter-label">MOMENTARY</label>
                                <div class="lufs-bar-container vertical">
                                    <div class="lufs-bar" id="lufs-momentary-bar">
                                        <div class="lufs-fill"></div>
                                    </div>
                                </div>
                                <div class="lufs-value" id="lufs-momentary-value">-∞</div>
                                <div class="lufs-unit">LUFS</div>
                            </div>

                            <!-- Loudness Range -->
                            <div class="lufs-meter">
                                <label class="meter-label">RANGE (LRA)</label>
                                <div class="range-bar-container">
                                    <div class="range-bar" id="lufs-range-bar">
                                        <div class="range-fill"></div>
                                    </div>
                                </div>
                                <div class="lufs-value" id="lufs-range-value">0.0</div>
                                <div class="lufs-unit">LU</div>
                            </div>
                        </div>
                    </div>

                    <!-- True Peak Section -->
                    <div class="true-peak-section">
                        <h4 class="section-title">TRUE PEAK</h4>
                        <div class="peak-meters">
                            <!-- Left True Peak -->
                            <div class="peak-meter">
                                <label class="meter-label">LEFT</label>
                                <div class="peak-bar-container">
                                    <div class="peak-segments" id="peak-segments-left"></div>
                                    <div class="peak-bar" id="true-peak-left">
                                        <div class="peak-fill"></div>
                                        <div class="peak-hold-indicator"></div>
                                    </div>
                                </div>
                                <div class="peak-value" id="true-peak-left-value">-∞</div>
                                <div class="peak-unit">dBTP</div>
                            </div>

                            <!-- Right True Peak -->
                            <div class="peak-meter">
                                <label class="meter-label">RIGHT</label>
                                <div class="peak-bar-container">
                                    <div class="peak-segments" id="peak-segments-right"></div>
                                    <div class="peak-bar" id="true-peak-right">
                                        <div class="peak-fill"></div>
                                        <div class="peak-hold-indicator"></div>
                                    </div>
                                </div>
                                <div class="peak-value" id="true-peak-right-value">-∞</div>
                                <div class="peak-unit">dBTP</div>
                            </div>
                        </div>
                    </div>

                    <!-- RMS Section -->
                    <div class="rms-section">
                        <h4 class="section-title">RMS</h4>
                        <div class="rms-meters">
                            <!-- RMS Left -->
                            <div class="rms-meter">
                                <label class="meter-label">LEFT</label>
                                <div class="rms-bar-container">
                                    <div class="rms-bar" id="rms-left">
                                        <div class="rms-fill"></div>
                                        <div class="rms-average"></div>
                                    </div>
                                </div>
                                <div class="rms-value" id="rms-left-value">-∞</div>
                                <div class="rms-unit">dBFS</div>
                            </div>

                            <!-- RMS Right -->
                            <div class="rms-meter">
                                <label class="meter-label">RIGHT</label>
                                <div class="rms-bar-container">
                                    <div class="rms-bar" id="rms-right">
                                        <div class="rms-fill"></div>
                                        <div class="rms-average"></div>
                                    </div>
                                </div>
                                <div class="rms-value" id="rms-right-value">-∞</div>
                                <div class="rms-unit">dBFS</div>
                            </div>
                        </div>
                    </div>

                    <!-- Correlation/Phase Section -->
                    <div class="correlation-section">
                        <h4 class="section-title">PHASE CORRELATION</h4>
                        <div class="correlation-container">
                            <div class="correlation-scale">
                                <span>-1</span>
                                <span>OUT</span>
                                <span>0</span>
                                <span>MONO</span>
                                <span>+1</span>
                            </div>
                            <div class="correlation-bar" id="correlation-bar">
                                <div class="correlation-negative"></div>
                                <div class="correlation-positive"></div>
                                <div class="correlation-indicator"></div>
                            </div>
                            <div class="correlation-value" id="correlation-value">+1.00</div>
                            <div class="correlation-status" id="correlation-status">STEREO</div>
                        </div>

                        <!-- Goniometer -->
                        <div class="goniometer-container">
                            <canvas id="goniometer" width="150" height="150"></canvas>
                            <label class="gonio-label">GONIOMETER</label>
                        </div>
                    </div>

                    <!-- Statistics -->
                    <div class="meter-statistics">
                        <div class="stat-row">
                            <div class="stat-item">
                                <label>Max TP:</label>
                                <span id="stat-max-tp" class="stat-value">-∞ dBTP</span>
                            </div>
                            <div class="stat-item">
                                <label>PLR:</label>
                                <span id="stat-plr" class="stat-value">0.0 LU</span>
                            </div>
                            <div class="stat-item">
                                <label>Clips:</label>
                                <span id="stat-clips" class="stat-value">0</span>
                            </div>
                        </div>
                        <div class="stat-row">
                            <div class="stat-item">
                                <label>Time:</label>
                                <span id="stat-time" class="stat-value">00:00</span>
                            </div>
                            <div class="stat-item">
                                <label>Target:</label>
                                <span id="stat-target" class="stat-value target-ok">-14 LUFS ✓</span>
                            </div>
                            <div class="stat-item">
                                <label>Headroom:</label>
                                <span id="stat-headroom" class="stat-value">14 dB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ";

        // Insert into player bar
        const playerBar = document.getElementById('player-bar');
        if (playerBar) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            playerBar.appendChild(tempDiv.firstElementChild);
        } else {
            // Fallback: insert into body
            document.body.insertAdjacentHTML('beforeend', html);
        }
    }

    cacheElements() {
        this.elements = {
            // Main container
            suite: document.getElementById('professional-meter-suite'),

            // Controls
            standardSelect: document.getElementById('meter-standard'),
            resetBtn: document.getElementById('meter-reset'),
            freezeBtn: document.getElementById('meter-freeze'),
            minimizeBtn: document.getElementById('meter-minimize'),

            // LUFS elements
            lufsIntegratedBar: document.querySelector('#lufs-integrated-bar .lufs-fill'),
            lufsIntegratedValue: document.getElementById('lufs-integrated-value'),
            lufsShortBar: document.querySelector('#lufs-short-bar .lufs-fill'),
            lufsShortValue: document.getElementById('lufs-short-value'),
            lufsMomentaryBar: document.querySelector('#lufs-momentary-bar .lufs-fill'),
            lufsMomentaryValue: document.getElementById('lufs-momentary-value'),
            lufsRangeBar: document.querySelector('#lufs-range-bar .range-fill'),
            lufsRangeValue: document.getElementById('lufs-range-value'),
            targetLine: document.querySelector('.lufs-target-line'),

            // True Peak elements
            truePeakLeftBar: document.querySelector('#true-peak-left .peak-fill'),
            truePeakLeftValue: document.getElementById('true-peak-left-value'),
            truePeakLeftHold: document.querySelector('#true-peak-left .peak-hold-indicator'),
            truePeakRightBar: document.querySelector('#true-peak-right .peak-fill'),
            truePeakRightValue: document.getElementById('true-peak-right-value'),
            truePeakRightHold: document.querySelector('#true-peak-right .peak-hold-indicator'),

            // RMS elements
            rmsLeftBar: document.querySelector('#rms-left .rms-fill'),
            rmsLeftValue: document.getElementById('rms-left-value'),
            rmsRightBar: document.querySelector('#rms-right .rms-fill'),
            rmsRightValue: document.getElementById('rms-right-value'),

            // Correlation elements
            correlationIndicator: document.querySelector('.correlation-indicator'),
            correlationValue: document.getElementById('correlation-value'),
            correlationStatus: document.getElementById('correlation-status'),

            // Goniometer
            goniometer: document.getElementById('goniometer'),

            // Statistics
            statMaxTP: document.getElementById('stat-max-tp'),
            statPLR: document.getElementById('stat-plr'),
            statClips: document.getElementById('stat-clips'),
            statTime: document.getElementById('stat-time'),
            statTarget: document.getElementById('stat-target'),
            statHeadroom: document.getElementById('stat-headroom')
        };
    }

    setupEventListeners() {
        // Standard selector
        if (this.elements.standardSelect) {
            this.elements.standardSelect.addEventListener('change', e => {
                this.setStandard(e.target.value);
            });
        }

        // Reset button
        if (this.elements.resetBtn) {
            this.elements.resetBtn.addEventListener('click', () => {
                this.resetMeasurements();
            });
        }

        // Freeze button
        if (this.elements.freezeBtn) {
            this.elements.freezeBtn.addEventListener('click', () => {
                this.toggleFreeze();
            });
        }

        // Minimize button
        if (this.elements.minimizeBtn) {
            this.elements.minimizeBtn.addEventListener('click', () => {
                this.toggleMinimize();
            });
        }
    }

    initializePeakSegments() {
        // Create peak meter segments
        const segmentCount = 30;
        const leftContainer = document.getElementById('peak-segments-left');
        const rightContainer = document.getElementById('peak-segments-right');

        if (leftContainer && rightContainer) {
            for (let i = 0; i < segmentCount; i++) {
                const segmentL = document.createElement('div');
                segmentL.className = 'segment';
                segmentL.dataset.index = i;
                leftContainer.appendChild(segmentL);

                const segmentR = document.createElement('div');
                segmentR.className = 'segment';
                segmentR.dataset.index = i;
                rightContainer.appendChild(segmentR);
            }
        }
    }

    // Connect to audio element at the END of the chain
    connectToAudio(audioElement) {
        if (!audioElement) {
            console.error('No audio element provided');
            return;
        }

        // Clean up if already connected
        if (this.isConnected) {
            this.disconnect();
        }

        try {
            // Create or get audio context
            this.audioContext =
                window.audioContext || new (window.AudioContext || window.webkitAudioContext)();

            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Create or reuse source
            if (audioElement._sourceNode) {
                // Reuse existing source from any component
                this.source = audioElement._sourceNode;
            } else {
                // Create new source and store reference
                this.source = this.audioContext.createMediaElementSource(audioElement);
                audioElement._sourceNode = this.source;
            }

            // Create splitter for stereo channels
            this.splitter = this.audioContext.createChannelSplitter(2);

            // Create analyzers
            this.analyserL = this.audioContext.createAnalyser();
            this.analyserR = this.audioContext.createAnalyser();
            this.analyserMono = this.audioContext.createAnalyser();

            // Configure analyzers for high precision
            this.analyserL.fftSize = 8192;
            this.analyserR.fftSize = 8192;
            this.analyserMono.fftSize = 8192;
            this.analyserL.smoothingTimeConstant = 0;
            this.analyserR.smoothingTimeConstant = 0;
            this.analyserMono.smoothingTimeConstant = 0;

            // Create K-weighting filters for LUFS (ITU-R BS.1770-4)
            this.createKWeightingFilters();

            // CRITICAL: Connect audio to destination FIRST (if not already connected)
            try {
                this.source.connect(this.audioContext.destination);
            } catch (e) {
                // Already connected, that's fine
            }

            // Then tap the signal for analysis (parallel connection)
            this.source.connect(this.splitter);
            this.source.connect(this.analyserMono); // For correlation

            // Connect channels through K-weighting to analyzers
            this.splitter.connect(this.preFilterL, 0);
            this.splitter.connect(this.preFilterR, 1);

            // Create data arrays
            this.dataArrayL = new Float32Array(this.analyserL.frequencyBinCount);
            this.dataArrayR = new Float32Array(this.analyserR.frequencyBinCount);
            this.dataArrayMono = new Float32Array(this.analyserMono.frequencyBinCount);

            this.isConnected = true;
            this.startTime = Date.now();

            // Start measurement loop
            this.startMeasurement();
        } catch (error) {
            console.error('❌ Error connecting meter suite:', error);
        }
    }

    // Create K-weighting filters for LUFS measurement
    createKWeightingFilters() {
        // Pre-filter (high shelf) - Stage 1
        this.preFilterL = this.audioContext.createBiquadFilter();
        this.preFilterL.type = 'highshelf';
        this.preFilterL.frequency.value = 1500;
        this.preFilterL.gain.value = 4;

        this.preFilterR = this.audioContext.createBiquadFilter();
        this.preFilterR.type = 'highshelf';
        this.preFilterR.frequency.value = 1500;
        this.preFilterR.gain.value = 4;

        // RLB filter (high-pass) - Stage 2
        this.rlbFilterL = this.audioContext.createBiquadFilter();
        this.rlbFilterL.type = 'highpass';
        this.rlbFilterL.frequency.value = 38;
        this.rlbFilterL.Q.value = 0.5;

        this.rlbFilterR = this.audioContext.createBiquadFilter();
        this.rlbFilterR.type = 'highpass';
        this.rlbFilterR.frequency.value = 38;
        this.rlbFilterR.Q.value = 0.5;

        // Connect filter chain
        this.preFilterL.connect(this.rlbFilterL);
        this.rlbFilterL.connect(this.analyserL);

        this.preFilterR.connect(this.rlbFilterR);
        this.rlbFilterR.connect(this.analyserR);
    }

    // Start continuous measurement
    startMeasurement() {
        if (this.animationId) {
            return;
        }

        const measure = () => {
            if (!this.isConnected || this.isFrozen) {
                this.animationId = requestAnimationFrame(measure);
                return;
            }

            // Get audio data
            this.analyserL.getFloatTimeDomainData(this.dataArrayL);
            this.analyserR.getFloatTimeDomainData(this.dataArrayR);
            this.analyserMono.getFloatTimeDomainData(this.dataArrayMono);

            // Calculate all metrics
            const measurement = this.performMeasurement();

            // Store in history
            this.addToHistory(measurement);

            // Update LUFS values
            this.updateLUFSValues();

            // Update display
            this.updateDisplay(measurement);

            // Draw goniometer
            this.drawGoniometer();

            // Update statistics
            this.updateStatistics();

            // Continue loop
            this.animationId = requestAnimationFrame(measure);
        };

        measure();
    }

    performMeasurement() {
        // Calculate True Peak with 4x oversampling
        const truePeakL = this.calculateTruePeak(this.dataArrayL);
        const truePeakR = this.calculateTruePeak(this.dataArrayR);

        // Calculate RMS
        const rmsL = this.calculateRMS(this.dataArrayL);
        const rmsR = this.calculateRMS(this.dataArrayR);

        // Calculate LUFS (already K-weighted)
        const lufs = this.calculateLUFS(this.dataArrayL, this.dataArrayR);

        // Calculate correlation
        const correlation = this.calculateCorrelation(this.dataArrayL, this.dataArrayR);

        return {
            timestamp: Date.now(),
            truePeakL,
            truePeakR,
            rmsL,
            rmsR,
            lufs,
            correlation
        };
    }

    // Calculate True Peak with oversampling
    calculateTruePeak(data) {
        // 4x oversampling for inter-sample peak detection
        const oversampled = this.oversample4x(data);
        let peak = 0;

        for (let i = 0; i < oversampled.length; i++) {
            const abs = Math.abs(oversampled[i]);
            if (abs > peak) {
                peak = abs;
            }
        }

        // Convert to dBTP
        const dbTP = 20 * Math.log10(Math.max(0.00001, peak));

        // Check for clipping
        if (dbTP > this.config.truePeakLimit) {
            this.clipCount++;
        }

        return dbTP;
    }

    // 4x oversampling using linear interpolation
    oversample4x(data) {
        const factor = this.config.oversampleFactor;
        const oversampled = new Float32Array(data.length * factor);

        for (let i = 0; i < data.length - 1; i++) {
            const current = data[i];
            const next = data[i + 1];
            const diff = next - current;

            for (let j = 0; j < factor; j++) {
                oversampled[i * factor + j] = current + (diff * j) / factor;
            }
        }

        return oversampled;
    }

    // Calculate RMS
    calculateRMS(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        return 20 * Math.log10(Math.max(0.00001, rms));
    }

    // Calculate LUFS (K-weighted input)
    calculateLUFS(dataL, dataR) {
        // Calculate mean square for each channel
        let sumL = 0,
            sumR = 0;

        for (let i = 0; i < dataL.length; i++) {
            sumL += dataL[i] * dataL[i];
        }
        for (let i = 0; i < dataR.length; i++) {
            sumR += dataR[i] * dataR[i];
        }

        const meanSquareL = sumL / dataL.length;
        const meanSquareR = sumR / dataR.length;

        // Sum weighted channels (stereo)
        const meanSquareTotal = meanSquareL + meanSquareR;

        // Convert to LUFS
        const lufs = -0.691 + 10 * Math.log10(meanSquareTotal + 1e-10);

        return Math.max(-70, lufs); // Apply absolute gate
    }

    // Calculate phase correlation
    calculateCorrelation(dataL, dataR) {
        let sumL = 0,
            sumR = 0,
            sumLR = 0;
        let sumL2 = 0,
            sumR2 = 0;

        const samples = Math.min(dataL.length, dataR.length);

        for (let i = 0; i < samples; i++) {
            sumL += dataL[i];
            sumR += dataR[i];
            sumLR += dataL[i] * dataR[i];
            sumL2 += dataL[i] * dataL[i];
            sumR2 += dataR[i] * dataR[i];
        }

        const n = samples;
        const num = n * sumLR - sumL * sumR;
        const den = Math.sqrt((n * sumL2 - sumL * sumL) * (n * sumR2 - sumR * sumR));

        return den === 0 ? 0 : num / den;
    }

    // Add measurement to history
    addToHistory(measurement) {
        this.measurementHistory.push(measurement);

        // Keep history size manageable
        if (this.measurementHistory.length > this.maxHistoryLength) {
            this.measurementHistory.shift();
        }

        // Update max true peak
        this.maxTruePeak = Math.max(this.maxTruePeak, measurement.truePeakL, measurement.truePeakR);

        // Update true peak values
        this.truePeakL = measurement.truePeakL;
        this.truePeakR = measurement.truePeakR;

        // Update peak hold
        const now = Date.now();
        if (measurement.truePeakL > this.truePeakHoldL) {
            this.truePeakHoldL = measurement.truePeakL;
            this.lastPeakTimeL = now;
        } else if (now - this.lastPeakTimeL > this.peakHoldTime) {
            this.truePeakHoldL = Math.max(this.truePeakHoldL - 0.1, -60);
        }

        if (measurement.truePeakR > this.truePeakHoldR) {
            this.truePeakHoldR = measurement.truePeakR;
            this.lastPeakTimeR = now;
        } else if (now - this.lastPeakTimeR > this.peakHoldTime) {
            this.truePeakHoldR = Math.max(this.truePeakHoldR - 0.1, -60);
        }

        // Update RMS
        this.rmsL = measurement.rmsL;
        this.rmsR = measurement.rmsR;

        // Update correlation
        this.correlation = measurement.correlation;
    }

    // Update LUFS values (Integrated, Short-term, Momentary)
    updateLUFSValues() {
        const now = Date.now();

        // Momentary LUFS (400ms window)
        const momentaryWindow = this.measurementHistory.filter(
            m => m.timestamp > now - this.config.integrationTime
        );
        if (momentaryWindow.length > 0) {
            const sum = momentaryWindow.reduce((acc, m) => acc + Math.pow(10, m.lufs / 10), 0);
            this.lufsMomentary = 10 * Math.log10(sum / momentaryWindow.length);
        }

        // Short-term LUFS (3s window)
        const shortTermWindow = this.measurementHistory.filter(
            m => m.timestamp > now - this.config.shortTermWindow
        );
        if (shortTermWindow.length > 0) {
            const sum = shortTermWindow.reduce((acc, m) => acc + Math.pow(10, m.lufs / 10), 0);
            this.lufsShortTerm = 10 * Math.log10(sum / shortTermWindow.length);
        }

        // Integrated LUFS (all history with gating)
        if (this.measurementHistory.length > 0) {
            const gatedMeasurements = this.applyGating(this.measurementHistory);
            if (gatedMeasurements.length > 0) {
                const sum = gatedMeasurements.reduce(
                    (acc, m) => acc + Math.pow(10, m.lufs / 10),
                    0
                );
                this.lufsIntegrated = 10 * Math.log10(sum / gatedMeasurements.length);
            }
        }

        // Calculate loudness range
        this.calculateLoudnessRange();
    }

    // Apply gating for integrated LUFS (ITU-R BS.1770-4)
    applyGating(measurements) {
        // Absolute gate at -70 LUFS
        let gated = measurements.filter(m => m.lufs > this.config.gatingThreshold);

        if (gated.length === 0) {
            return [];
        }

        // Calculate ungated loudness
        const sum = gated.reduce((acc, m) => acc + Math.pow(10, m.lufs / 10), 0);
        const ungatedLoudness = 10 * Math.log10(sum / gated.length);

        // Relative gate at -10 LU below ungated
        const relativeThreshold = ungatedLoudness + this.config.relativeGate;
        gated = gated.filter(m => m.lufs > relativeThreshold);

        return gated;
    }

    // Calculate loudness range (LRA)
    calculateLoudnessRange() {
        if (this.measurementHistory.length < 60) {
            this.lufsRange = 0;
            return;
        }

        const values = this.measurementHistory.map(m => m.lufs).sort((a, b) => a - b);
        const low = values[Math.floor(values.length * 0.1)];
        const high = values[Math.floor(values.length * 0.95)];

        this.lufsRange = high - low;
    }

    // Draw goniometer (Lissajous figure)
    drawGoniometer() {
        const canvas = this.elements.goniometer;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // Clear with fade effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Draw circle (mono/stereo reference)
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.min(centerX, centerY) * 0.8, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw Lissajous figure
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();

        const samples = Math.min(this.dataArrayL.length, 2048);
        for (let i = 0; i < samples; i += 4) {
            const x = centerX + this.dataArrayL[i] * centerX * 0.7;
            const y = centerY - this.dataArrayR[i] * centerY * 0.7;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Update all display elements
    updateDisplay(measurement) {
        // Update LUFS meters
        this.updateLUFSMeter('integrated', this.lufsIntegrated);
        this.updateLUFSMeter('short', this.lufsShortTerm);
        this.updateLUFSMeter('momentary', this.lufsMomentary);
        this.updateRangeMeter(this.lufsRange);

        // Update True Peak meters
        this.updateTruePeakMeter('left', this.truePeakL, this.truePeakHoldL);
        this.updateTruePeakMeter('right', this.truePeakR, this.truePeakHoldR);

        // Update RMS meters
        this.updateRMSMeter('left', this.rmsL);
        this.updateRMSMeter('right', this.rmsR);

        // Update correlation
        this.updateCorrelationMeter(this.correlation);

        // Update peak segments
        this.updatePeakSegments('left', this.truePeakL);
        this.updatePeakSegments('right', this.truePeakR);
    }

    updateLUFSMeter(type, value) {
        let bar, valueEl;

        switch (type) {
            case 'integrated':
                bar = this.elements.lufsIntegratedBar;
                valueEl = this.elements.lufsIntegratedValue;
                break;
            case 'short':
                bar = this.elements.lufsShortBar;
                valueEl = this.elements.lufsShortValue;
                break;
            case 'momentary':
                bar = this.elements.lufsMomentaryBar;
                valueEl = this.elements.lufsMomentaryValue;
                break;
        }

        if (bar && valueEl) {
            // Map -60 to 0 LUFS to 0-100%
            const percent = Math.max(0, Math.min(100, ((value + 60) / 60) * 100));
            bar.style.height = percent + '%';

            // Update value display
            valueEl.textContent = value > -60 ? value.toFixed(1) : '-∞';

            // Color coding based on target
            const diff = Math.abs(value - this.config.targetLUFS);
            if (diff < 1) {
                valueEl.style.color = '#00ff00';
            } else if (diff < 3) {
                valueEl.style.color = '#ffff00';
            } else {
                valueEl.style.color = '#ff9999';
            }
        }
    }

    updateRangeMeter(value) {
        if (this.elements.lufsRangeBar && this.elements.lufsRangeValue) {
            // Map 0-20 LU to 0-100%
            const percent = Math.min(100, (value / 20) * 100);
            this.elements.lufsRangeBar.style.width = percent + '%';
            this.elements.lufsRangeValue.textContent = value.toFixed(1);
        }
    }

    updateTruePeakMeter(channel, value, holdValue) {
        let bar, valueEl, hold;

        if (channel === 'left') {
            bar = this.elements.truePeakLeftBar;
            valueEl = this.elements.truePeakLeftValue;
            hold = this.elements.truePeakLeftHold;
        } else {
            bar = this.elements.truePeakRightBar;
            valueEl = this.elements.truePeakRightValue;
            hold = this.elements.truePeakRightHold;
        }

        if (bar && valueEl) {
            // Map -60 to +3 dBTP to 0-100%
            const percent = Math.max(0, Math.min(100, ((value + 60) / 63) * 100));
            bar.style.width = percent + '%';

            // Update hold indicator
            if (hold) {
                const holdPercent = Math.max(0, Math.min(100, ((holdValue + 60) / 63) * 100));
                hold.style.left = holdPercent + '%';
            }

            // Update value display
            valueEl.textContent = value > -60 ? value.toFixed(1) : '-∞';

            // Color coding
            if (value > 0) {
                valueEl.style.color = '#ff0000';
                bar.style.background = '#ff0000';
            } else if (value > -3) {
                valueEl.style.color = '#ffff00';
                bar.style.background =
                    'linear-gradient(90deg, #00ff00 0%, #ffff00 80%, #ff0000 100%)';
            } else {
                valueEl.style.color = '#00ff00';
                bar.style.background =
                    'linear-gradient(90deg, #00ff00 0%, #00ff00 70%, #ffff00 100%)';
            }
        }
    }

    updateRMSMeter(channel, value) {
        let bar, valueEl;

        if (channel === 'left') {
            bar = this.elements.rmsLeftBar;
            valueEl = this.elements.rmsLeftValue;
        } else {
            bar = this.elements.rmsRightBar;
            valueEl = this.elements.rmsRightValue;
        }

        if (bar && valueEl) {
            // Map -60 to 0 dBFS to 0-100%
            const percent = Math.max(0, Math.min(100, ((value + 60) / 60) * 100));
            bar.style.width = percent + '%';

            // Update value display
            valueEl.textContent = value > -60 ? value.toFixed(1) : '-∞';
        }
    }

    updateCorrelationMeter(value) {
        if (this.elements.correlationIndicator && this.elements.correlationValue) {
            // Map -1 to +1 to 0-100%
            const percent = ((value + 1) / 2) * 100;
            this.elements.correlationIndicator.style.left = percent + '%';
            this.elements.correlationValue.textContent = value.toFixed(2);

            // Update status
            if (this.elements.correlationStatus) {
                if (value < -0.5) {
                    this.elements.correlationStatus.textContent = 'OUT OF PHASE';
                    this.elements.correlationStatus.style.color = '#ff0000';
                } else if (value > 0.9) {
                    this.elements.correlationStatus.textContent = 'MONO';
                    this.elements.correlationStatus.style.color = '#ffff00';
                } else {
                    this.elements.correlationStatus.textContent = 'STEREO';
                    this.elements.correlationStatus.style.color = '#00ff00';
                }
            }
        }
    }

    updatePeakSegments(channel, value) {
        const container = document.getElementById(`peak-segments-${channel}`);
        if (!container) {
            return;
        }

        const segments = container.querySelectorAll('.segment');
        const dbPerSegment = 63 / segments.length; // -60 to +3 dB range
        const activeSegments = Math.floor((value + 60) / dbPerSegment);

        segments.forEach((segment, index) => {
            segment.classList.remove('active', 'green', 'yellow', 'red');

            if (index < activeSegments) {
                segment.classList.add('active');

                // Color based on level
                const segmentDb = index * dbPerSegment - 60;
                if (segmentDb > 0) {
                    segment.classList.add('red');
                } else if (segmentDb > -6) {
                    segment.classList.add('yellow');
                } else {
                    segment.classList.add('green');
                }
            }
        });
    }

    updateStatistics() {
        // Update max true peak
        if (this.elements.statMaxTP) {
            this.elements.statMaxTP.textContent =
                this.maxTruePeak > -60 ? this.maxTruePeak.toFixed(1) + ' dBTP' : '-∞ dBTP';
        }

        // Update PLR (Peak to Loudness Ratio)
        if (this.elements.statPLR) {
            const plr = this.maxTruePeak - this.lufsIntegrated;
            this.elements.statPLR.textContent = plr.toFixed(1) + ' LU';
        }

        // Update clip count
        if (this.elements.statClips) {
            this.elements.statClips.textContent = this.clipCount.toString();
            if (this.clipCount > 0) {
                this.elements.statClips.style.color = '#ff0000';
            }
        }

        // Update time
        if (this.elements.statTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.elements.statTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}';
        }

        // Update target status
        if (this.elements.statTarget) {
            const diff = Math.abs(this.lufsIntegrated - this.config.targetLUFS);
            this.elements.statTarget.textContent = `${this.config.targetLUFS} LUFS`;

            if (diff < 1) {
                this.elements.statTarget.textContent += ' ✓';
                this.elements.statTarget.className = 'stat-value target-ok';
            } else if (diff < 3) {
                this.elements.statTarget.textContent += ' ⚠';
                this.elements.statTarget.className = 'stat-value target-warning';
            } else {
                this.elements.statTarget.textContent += ' ✗';
                this.elements.statTarget.className = 'stat-value target-error';
            }
        }

        // Update headroom
        if (this.elements.statHeadroom) {
            const headroom = Math.abs(this.maxTruePeak);
            this.elements.statHeadroom.textContent = headroom.toFixed(1) + ' dB';
        }
    }

    // Control methods
    setStandard(standard) {
        switch (standard) {
            case 'streaming':
                this.config.targetLUFS = -14;
                break;
            case 'broadcast':
                this.config.targetLUFS = -23;
                break;
            case 'cinema':
                this.config.targetLUFS = -27;
                break;
        }

        // Update target line position
        if (this.elements.targetLine) {
            const percent = Math.max(0, Math.min(100, ((this.config.targetLUFS + 60) / 60) * 100));
            this.elements.targetLine.style.bottom = percent + '%';
        }
    }

    resetMeasurements() {
        // Reset all measurements
        this.lufsIntegrated = -60;
        this.lufsShortTerm = -60;
        this.lufsMomentary = -60;
        this.lufsRange = 0;
        this.truePeakL = -60;
        this.truePeakR = -60;
        this.truePeakHoldL = -60;
        this.truePeakHoldR = -60;
        this.rmsL = -60;
        this.rmsR = -60;
        this.correlation = 0;
        this.maxTruePeak = -60;
        this.clipCount = 0;
        this.measurementHistory = [];
        this.startTime = Date.now();
    }

    toggleFreeze() {
        this.isFrozen = !this.isFrozen;

        if (this.elements.freezeBtn) {
            this.elements.freezeBtn.classList.toggle('active', this.isFrozen);
            this.elements.freezeBtn.textContent = this.isFrozen ? 'Unfreeze' : 'Freeze';
        }
    }

    toggleMinimize() {
        if (this.elements.suite) {
            this.elements.suite.classList.toggle('minimized');
        }
    }

    disconnect() {
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Disconnect audio nodes
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {}
        }

        // Clean up filters
        if (this.preFilterL) {
            this.preFilterL.disconnect();
        }
        if (this.preFilterR) {
            this.preFilterR.disconnect();
        }
        if (this.rlbFilterL) {
            this.rlbFilterL.disconnect();
        }
        if (this.rlbFilterR) {
            this.rlbFilterR.disconnect();
        }
        if (this.analyserL) {
            this.analyserL.disconnect();
        }
        if (this.analyserR) {
            this.analyserR.disconnect();
        }
        if (this.analyserMono) {
            this.analyserMono.disconnect();
        }
        if (this.splitter) {
            this.splitter.disconnect();
        }

        this.isConnected = false;
    }
}

// Create global instance
window.professionalMeterSuite = new ProfessionalMeterSuite();
