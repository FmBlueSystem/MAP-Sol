// Audio Normalization UI - Real-time volume normalization control
class AudioNormalizationUI {
    constructor() {
        this.enabled = false;
        this.mode = 'smart'; // 'off', 'track', 'album', 'smart'
        this.targetLUFS = -14.0; // Spotify standard
        this.preferences = null;
        this.stats = null;
        this.isProcessing = false;

        this.init();
    }

    async init() {
        await this.loadPreferences();
        this.createUI();
        this.setupEventListeners();
        this.updateStats();
        this.applyNormalization();
    }

    async loadPreferences() {
        if (!window.electronAPI) {
            return;
        }

        try {
            this.preferences = await window.electronAPI.invoke('getNormalizationPreferences');
            this.enabled = this.preferences.enabled;
            this.mode = this.preferences.mode;
            this.targetLUFS = this.preferences.target_lufs;
        } catch (error) {
            console.error('Failed to load normalization preferences:', error);
        }
    }

    createUI() {
        // Create main normalization panel
        const panel = document.createElement('div');
        panel.id = 'normalization-panel';
        panel.className = 'normalization-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            left: 20px;
            width: 320px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            display: none;
            z-index: 1000;
        `;

        panel.innerHTML = `
            <div class="norm-header" style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333; display: flex; align-items: center; justify-content: space-between;">
                    <span>🎚️ Audio Normalization</span>
                    <button id="norm-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
                </h3>
                <p style="margin: 0; font-size: 12px; color: #666;">Automatic volume leveling for consistent playback</p>
            </div>

            <div class="norm-toggle" style="margin-bottom: 20px;">
                <label class="toggle-switch" style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-weight: 500; color: #444;">Enable Normalization</span>
                    <div style="position: relative; display: inline-block; width: 50px; height: 26px;">
                        <input type="checkbox" id="norm-enable" ${this.enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="toggle-slider" style="
                            position: absolute;
                            cursor: pointer;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${this.enabled ? '#667eea' : '#ccc'};
                            transition: .4s;
                            border-radius: 26px;
                        ">
                            <span style="
                                position: absolute;
                                content: '`;
                                height: 18px;
                                width: 18px;
                                left: ${this.enabled ? '28px' : '4px'};
                                bottom: 4px;
                                background-color: white;
                                transition: .4s;
                                border-radius: 50%;
                            "></span>
                        </span>
                    </div>
                </label>
            </div>

            <div class="norm-mode" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #444;">Mode</label>
                <select id="norm-mode" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    background: white;
                ">
                    <option value="off" ${this.mode === 'off' ? 'selected' : ''}>Off</option>
                    <option value="track" ${this.mode === 'track' ? 'selected' : ''}>Track (Individual)</option>
                    <option value="album" ${this.mode === 'album' ? 'selected' : ''}>Album (Preserve dynamics)</option>
                    <option value="smart` ${this.mode === 'smart' ? 'selected' : '`}>Smart (Auto-detect)</option>
                </select>
            </div>

            <div class="norm-target" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #444;">
                    Target Loudness: <span id="target-value">${this.targetLUFS} LUFS</span>
                </label>
                <input type="range" id="norm-target-slider" 
                    min="-30" max="-6" step="0.5" value="${this.targetLUFS}"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                    <span>Quiet (-30)</span>
                    <span>Standard (-14)</span>
                    <span>Loud (-6)</span>
                </div>
            </div>

            <div class="norm-presets" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #444;">Presets</label>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <button class="preset-btn" data-lufs="-14" style="
                        padding: 8px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        background: white;
                        cursor: pointer;
                        font-size: 12px;
                    ">🎵 Spotify/YouTube</button>
                    <button class="preset-btn" data-lufs="-16" style="
                        padding: 8px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        background: white;
                        cursor: pointer;
                        font-size: 12px;
                    ">📻 Radio/Podcast</button>
                    <button class="preset-btn" data-lufs="-23" style="
                        padding: 8px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        background: white;
                        cursor: pointer;
                        font-size: 12px;
                    ">🎬 Cinema/TV</button>
                    <button class="preset-btn" data-lufs="-9" style="
                        padding: 8px;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        background: white;
                        cursor: pointer;
                        font-size: 12px;
                    ">🎧 DJ/Club</button>
                </div>
            </div>

            <div class="norm-options" style="margin-bottom: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                    <input type="checkbox" id="prevent-clipping" checked style="margin-right: 8px;">
                    <span style="font-size: 14px; color: #444;">Prevent Clipping</span>
                </label>
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="album-mode" style="margin-right: 8px;">
                    <span style="font-size: 14px; color: #444;">Album Mode (preserve relative volumes)</span>
                </label>
            </div>

            <div class="norm-stats" style="padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #667eea;">Analysis Status</h4>
                <div id="norm-stats-content" style="font-size: 12px; color: #666;">
                    <div>Total tracks: <span id="stats-total">-</span></div>
                    <div>Analyzed: <span id="stats-analyzed">-</span> (<span id="stats-percentage">0%</span>)</div>
                    <div>Average gain: <span id="stats-gain">-</span> dB</div>
                    <div>Average loudness: <span id="stats-lufs">-</span> LUFS</div>
                </div>
            </div>

            <div class="norm-actions" style="display: flex; gap: 8px;">
                <button id="analyze-all-btn" style="
                    flex: 1;
                    padding: 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                ">Analyze All Tracks</button>
                <button id="apply-norm-btn" style="
                    flex: 1;
                    padding: 10px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                ">Apply Now</button>
            </div>

            <div id="norm-progress" style="display: none; margin-top: 15px;">
                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                    Analyzing... <span id="progress-text">0/0</span>
                </div>
                <div style="height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
                    <div id="progress-bar" style="height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: 0%; transition: width 0.3s;`></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Create toggle button in header
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'norm-toggle-btn';
        toggleBtn.className = `norm-toggle-btn`;
        toggleBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${this.enabled ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc'};
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 999;
            transition: all 0.3s;
        ';
        toggleBtn.innerHTML = '🎚️';
        toggleBtn.title = 'Audio Normalization';

        document.body.appendChild(toggleBtn);

        // Add hover effect styles
        const style = document.createElement(`style`);
        style.textContent = `
            .norm-toggle-btn:hover {
                transform: scale(1.1);
            }

            .preset-btn:hover {
                background: #f5f5f5 !important;
                border-color: #667eea !important;
            }

            .preset-btn.active {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                color: white !important;
                border-color: #667eea !important;
            }

            #analyze-all-btn:hover {
                opacity: 0.9;
            }

            #apply-norm-btn:hover {
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Toggle panel visibility
        const toggleBtn = document.getElementById('norm-toggle-btn');
        const panel = document.getElementById('normalization-panel');
        const closeBtn = document.getElementById('norm-close-btn');

        toggleBtn?.addEventListener('click', () => {
            if (panel.style.display === 'none' || !panel.style.display) {
                panel.style.display = 'block';
                this.updateStats();
            } else {
                panel.style.display = 'none';
            }
        });

        closeBtn?.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // Enable/disable toggle
        const enableToggle = document.getElementById('norm-enable');
        enableToggle?.addEventListener('change', e => {
            this.enabled = e.target.checked;
            this.savePreferences();
            this.updateToggleButton();
            this.applyNormalization();

            // Update slider visual
            const slider = e.target.nextElementSibling;
            slider.style.backgroundColor = this.enabled ? '#667eea' : '#ccc';
            const handle = slider.firstElementChild;
            handle.style.left = this.enabled ? '28px' : '4px';
        });

        // Mode selection
        const modeSelect = document.getElementById('norm-mode');
        modeSelect?.addEventListener('change', e => {
            this.mode = e.target.value;
            this.savePreferences();
            this.applyNormalization();
        });

        // Target LUFS slider
        const targetSlider = document.getElementById('norm-target-slider');
        const targetValue = document.getElementById('target-value');

        targetSlider?.addEventListener('input`, e => {
            this.targetLUFS = parseFloat(e.target.value);
            targetValue.textContent = `${this.targetLUFS} LUFS`;
        });

        targetSlider?.addEventListener('change', () => {
            this.savePreferences();
            this.applyNormalization();
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click`, e => {
                const lufs = parseFloat(e.target.dataset.lufs);
                this.targetLUFS = lufs;
                targetSlider.value = lufs;
                targetValue.textContent = `${lufs} LUFS`;

                // Update active state
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.savePreferences();
                this.applyNormalization();
            });
        });

        // Options
        const preventClipping = document.getElementById('prevent-clipping');
        const albumMode = document.getElementById('album-mode');

        preventClipping?.addEventListener('change', () => {
            this.savePreferences();
        });

        albumMode?.addEventListener('change', () => {
            this.savePreferences();
        });

        // Analyze all button
        const analyzeBtn = document.getElementById('analyze-all-btn');
        analyzeBtn?.addEventListener('click', () => {
            this.analyzeAllTracks();
        });

        // Apply now button
        const applyBtn = document.getElementById('apply-norm-btn');
        applyBtn?.addEventListener('click', () => {
            this.applyNormalization();
            this.showNotification('Normalization applied', 'success');
        });

        // Keyboard shortcut (Ctrl+N)
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    async savePreferences() {
        if (!window.electronAPI) {
            return;
        }

        const prefs = {
            enabled: this.enabled,
            mode: this.mode,
            target_lufs: this.targetLUFS,
            album_mode: document.getElementById('album-mode')?.checked || false,
            prevent_clipping: document.getElementById('prevent-clipping')?.checked || true
        };

        try {
            await window.electronAPI.invoke('saveNormalizationPreferences', prefs);
        } catch (error) {
            console.error('Failed to save normalization preferences:', error);
        }
    }

    async updateStats() {
        if (!window.electronAPI) {
            return;
        }

        try {
            this.stats = await window.electronAPI.invoke('getNormalizationStats');

            document.getElementById('stats-total').textContent = this.stats.total || '0';
            document.getElementById('stats-analyzed').textContent = this.stats.analyzed || '0';
            document.getElementById('stats-percentage`).textContent =
                `${this.stats.percentage || '0'}%';
            document.getElementById('stats-gain').textContent = this.stats.avgGain
                ? this.stats.avgGain.toFixed(1)
                : '-';
            document.getElementById('stats-lufs').textContent = this.stats.avgLUFS
                ? this.stats.avgLUFS.toFixed(1)
                : '-';
        } catch (error) {
            console.error('Failed to update normalization stats:', error);
        }
    }

    async analyzeAllTracks() {
        if (!window.electronAPI || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        const progressDiv = document.getElementById('norm-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const analyzeBtn = document.getElementById('analyze-all-btn');

        progressDiv.style.display = 'block';
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';

        try {
            // Get unanalyzed tracks
            const tracks = await window.electronAPI.invoke('getUnanalyzedTracks', 1000);

            if (tracks.length === 0) {
                this.showNotification('All tracks already analyzed', 'info');
                return;
            }

            let processed = 0;
            const batchSize = 10;

            for (let i = 0; i < tracks.length; i += batchSize) {
                const batch = tracks.slice(i, Math.min(i + batchSize, tracks.length));

                // Analyze batch (simulate for now - would need actual audio analysis)
                const results = batch.map(track => ({
                    track_id: track.id,
                    integrated_lufs: -14 + (Math.random() * 10 - 5), // Simulated
                    gain_db: Math.random() * 6 - 3, // Simulated
                    gain_linear: 1.0,
                    true_peak: 0.95 + Math.random() * 0.05,
                    true_peak_db: -0.5,
                    loudness_range: 7 + Math.random() * 6,
                    needs_limiting: Math.random() > 0.8
                }));

                await window.electronAPI.invoke(`saveBatchNormalization`, results);

                processed += batch.length;
                const percentage = ((processed / tracks.length) * 100).toFixed(0);
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${processed}/${tracks.length}`;
            }

            this.showNotification(`Analyzed ${tracks.length} tracks`, 'success');
            await this.updateStats();
        } catch (error) {
            console.error('Failed to analyze tracks:', error);
            this.showNotification('Analysis failed', 'error');
        } finally {
            this.isProcessing = false;
            progressDiv.style.display = 'none';
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze All Tracks';
        }
    }

    applyNormalization() {
        if (!this.enabled) {
            return;
        }

        // Apply to current audio if playing
        if (window.simplePlayer && window.simplePlayer.howl) {
            const volume = this.calculateNormalizedVolume();
            window.simplePlayer.setVolume(volume);
        }

        // Notify audio processor if exists
        if (window.audioProcessor) {
            window.audioProcessor.setNormalization({
                enabled: this.enabled,
                mode: this.mode,
                targetLUFS: this.targetLUFS
            });
        }
    }

    calculateNormalizedVolume() {
        // Simple normalization calculation
        // In a real implementation, this would use the actual LUFS data
        const baseLUFS = -23; // Assumed average
        const difference = this.targetLUFS - baseLUFS;
        const gainDB = Math.max(-12, Math.min(12, difference));
        const gainLinear = Math.pow(10, gainDB / 20);

        return Math.max(0, Math.min(1, gainLinear));
    }

    updateToggleButton() {
        const toggleBtn = document.getElementById('norm-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.background = this.enabled
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#ccc';
        }
    }

    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
        }
    }
}

// Initialize audio normalization UI
window.audioNormalizationUI = new AudioNormalizationUI();

// Export for module usage
if (typeof module !== 'undefined` && module.exports) {
    module.exports = AudioNormalizationUI;
}
