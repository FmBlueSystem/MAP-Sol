// Smart Playlist Wizard - Crear playlists inteligentes con criterios
class SmartPlaylistWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.playlistData = {
            name: '',
            description: '',
            rules: [],
            icon: '🎵',
            color: '#667eea',
            autoUpdate: true
        };
        this.previewTracks = [];
        this.init();
    }

    init() {
        this.createWizard();
        this.attachEventListeners();
    }

    createWizard() {
        const wizardHTML = `
            <div id="smart-playlist-wizard" class="wizard-modal" style="display: none;">
                <div class="wizard-container">
                    <div class="wizard-header">
                        <h2>🧙 Smart Playlist Wizard</h2>
                        <button class="close-btn" onclick="smartPlaylistWizard.close()">✕</button>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="wizard-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 25%"></div>
                        </div>
                        <div class="progress-steps">
                            <div class="step active" data-step="1">
                                <span class="step-number">1</span>
                                <span class="step-label">Basic Info</span>
                            </div>
                            <div class="step" data-step="2">
                                <span class="step-number">2</span>
                                <span class="step-label">Criteria</span>
                            </div>
                            <div class="step" data-step="3">
                                <span class="step-number">3</span>
                                <span class="step-label">Advanced</span>
                            </div>
                            <div class="step" data-step="4">
                                <span class="step-number">4</span>
                                <span class="step-label">Preview</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Wizard Content -->
                    <div class="wizard-content">
                        <!-- Step 1: Basic Info -->
                        <div class="wizard-step" id="step1" style="display: block;">
                            <h3>Playlist Information</h3>
                            
                            <div class="form-group">
                                <label for="playlist-name">Playlist Name *</label>
                                <input type="text" id="playlist-name" placeholder="e.g., High Energy Workout" maxlength="50">
                            </div>
                            
                            <div class="form-group">
                                <label for="playlist-desc">Description</label>
                                <textarea id="playlist-desc" placeholder="Describe your playlist..." rows="3"></textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Icon</label>
                                    <div class="icon-selector">
                                        <button class="icon-btn selected" data-icon="🎵">🎵</button>
                                        <button class="icon-btn" data-icon="🎸">🎸</button>
                                        <button class="icon-btn" data-icon="🎹">🎹</button>
                                        <button class="icon-btn" data-icon="🎤">🎤</button>
                                        <button class="icon-btn" data-icon="🎧">🎧</button>
                                        <button class="icon-btn" data-icon="💿">💿</button>
                                        <button class="icon-btn" data-icon="🔥">🔥</button>
                                        <button class="icon-btn" data-icon="⚡">⚡</button>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="playlist-color">Color</label>
                                    <input type="color" id="playlist-color" value="#667eea">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 2: Criteria -->
                        <div class="wizard-step" id="step2" style="display: none;">
                            <h3>Define Criteria</h3>
                            
                            <div class="rules-builder">
                                <div class="rule-group" id="rules-container">
                                    <!-- Rules will be added here -->
                                </div>
                                
                                <button class="add-rule-btn" onclick="smartPlaylistWizard.addRule()">
                                    + Add Rule
                                </button>
                            </div>
                            
                            <div class="logic-operator">
                                <label>Match</label>
                                <select id="match-logic">
                                    <option value="AND">All rules (AND)</option>
                                    <option value="OR">Any rule (OR)</option>
                                </select>
                            </div>
                            
                            <!-- Quick Templates -->
                            <div class="templates-section">
                                <h4>Quick Templates</h4>
                                <div class="template-buttons">
                                    <button class="template-btn" onclick="smartPlaylistWizard.applyTemplate('highEnergy')">
                                        ⚡ High Energy
                                    </button>
                                    <button class="template-btn" onclick="smartPlaylistWizard.applyTemplate('chill')">
                                        😌 Chill Vibes
                                    </button>
                                    <button class="template-btn" onclick="smartPlaylistWizard.applyTemplate('party')">
                                        🎉 Party Mix
                                    </button>
                                    <button class="template-btn" onclick="smartPlaylistWizard.applyTemplate('workout')">
                                        💪 Workout
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 3: Advanced Options -->
                        <div class="wizard-step" id="step3" style="display: none;">
                            <h3>Advanced Options</h3>
                            
                            <div class="advanced-options">
                                <div class="option-group">
                                    <label class="switch-label">
                                        <input type="checkbox" id="auto-update" checked>
                                        <span class="switch"></span>
                                        <span>Auto-update when new tracks match</span>
                                    </label>
                                </div>
                                
                                <div class="option-group">
                                    <label class="switch-label">
                                        <input type="checkbox" id="remove-duplicates" checked>
                                        <span class="switch"></span>
                                        <span>Remove duplicate artists</span>
                                    </label>
                                </div>
                                
                                <div class="form-group">
                                    <label for="max-tracks">Maximum tracks (0 = unlimited)</label>
                                    <input type="number" id="max-tracks" min="0" max="1000" value="0">
                                </div>
                                
                                <div class="form-group">
                                    <label for="sort-by">Sort by</label>
                                    <select id="sort-by">
                                        <option value="date_added">Date Added (Newest)</option>
                                        <option value="title">Title (A-Z)</option>
                                        <option value="artist">Artist (A-Z)</option>
                                        <option value="bpm">BPM (Low to High)</option>
                                        <option value="energy">Energy (Low to High)</option>
                                        <option value="random">Random</option>
                                    </select>
                                </div>
                                
                                <!-- Energy Flow -->
                                <div class="energy-flow-section">
                                    <h4>Energy Flow</h4>
                                    <select id="energy-flow">
                                        <option value="none">No specific flow</option>
                                        <option value="ascending">Build up (Low → High)</option>
                                        <option value="descending">Cool down (High → Low)</option>
                                        <option value="wave">Wave (Up and Down)</option>
                                        <option value="peak">Peak in middle</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 4: Preview -->
                        <div class="wizard-step" id="step4" style="display: none;">
                            <h3>Preview Playlist</h3>
                            
                            <div class="preview-summary">
                                <div class="preview-header">
                                    <span class="preview-icon">🎵</span>
                                    <div class="preview-info">
                                        <h4 id="preview-name">--</h4>
                                        <p id="preview-desc">--</p>
                                    </div>
                                </div>
                                
                                <div class="preview-stats">
                                    <div class="stat">
                                        <span class="stat-value" id="track-count">0</span>
                                        <span class="stat-label">Tracks</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-value" id="total-duration">0:00</span>
                                        <span class="stat-label">Duration</span>
                                    </div>
                                    <div class="stat">
                                        <span class="stat-value" id="avg-bpm">--</span>
                                        <span class="stat-label">Avg BPM</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="preview-tracks" id="preview-tracks-list">
                                <div class="loading">Loading preview...</div>
                            </div>
                            
                            <div class="preview-actions">
                                <button class="refresh-btn" onclick="smartPlaylistWizard.refreshPreview()">
                                    🔄 Refresh Preview
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Wizard Footer -->
                    <div class="wizard-footer">
                        <button class="btn-secondary" id="prev-btn" onclick="smartPlaylistWizard.previousStep()" style="display: none;">
                            ← Previous
                        </button>
                        <button class="btn-primary" id="next-btn" onclick="smartPlaylistWizard.nextStep()">
                            Next →
                        </button>
                        <button class="btn-success" id="create-btn" onclick="smartPlaylistWizard.createPlaylist()" style="display: none;">
                            ✓ Create Playlist
                        </button>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = wizardHTML;
        document.body.appendChild(container.firstElementChild);
        this.wizard = document.getElementById('smart-playlist-wizard');
        
        // Add first rule by default
        this.addRule();
    }

    attachEventListeners() {
        // Name input
        document.getElementById('playlist-name').addEventListener('input', (e) => {
            this.playlistData.name = e.target.value;
        });

        // Description
        document.getElementById('playlist-desc').addEventListener('input', (e) => {
            this.playlistData.description = e.target.value;
        });

        // Icon selector
        document.querySelectorAll('.icon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.playlistData.icon = btn.dataset.icon;
            });
        });

        // Color picker
        document.getElementById('playlist-color').addEventListener('change', (e) => {
            this.playlistData.color = e.target.value;
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.wizard.style.display !== 'none') {
                this.close();
            }
        });
    }

    addRule() {
        const rulesContainer = document.getElementById('rules-container');
        const ruleId = Date.now();
        
        const ruleHTML = `
            <div class="rule-item" data-rule-id="${ruleId}">
                <select class="rule-field" onchange="smartPlaylistWizard.updateOperators(${ruleId})">
                    <option value="bpm">BPM</option>
                    <option value="energy">Energy</option>
                    <option value="danceability">Danceability</option>
                    <option value="valence">Valence</option>
                    <option value="key">Key</option>
                    <option value="genre">Genre</option>
                    <option value="mood">Mood</option>
                    <option value="year">Year</option>
                    <option value="duration">Duration</option>
                    <option value="artist">Artist</option>
                </select>
                
                <select class="rule-operator">
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="greater">greater than</option>
                    <option value="less">less than</option>
                    <option value="between">between</option>
                    <option value="contains">contains</option>
                </select>
                
                <input type="text" class="rule-value" placeholder="Value">
                <input type="text" class="rule-value2" placeholder="Max value" style="display: none;">
                
                <button class="remove-rule-btn" onclick="smartPlaylistWizard.removeRule(${ruleId})">✕</button>
            </div>
        `;
        
        rulesContainer.insertAdjacentHTML('beforeend', ruleHTML);
    }

    removeRule(ruleId) {
        const rule = document.querySelector(`[data-rule-id="${ruleId}"]`);
        if (rule) {
            rule.remove();
        }
    }

    updateOperators(ruleId) {
        const rule = document.querySelector(`[data-rule-id="${ruleId}"]`);
        const field = rule.querySelector('.rule-field').value;
        const operator = rule.querySelector('.rule-operator');
        const value2 = rule.querySelector('.rule-value2');
        
        // Update operators based on field type
        operator.innerHTML = '';
        
        if (['bpm', 'energy', 'danceability', 'valence', 'year', 'duration'].includes(field)) {
            // Numeric fields
            operator.innerHTML = `
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="greater">greater than</option>
                <option value="less">less than</option>
                <option value="between">between</option>
            `;
        } else {
            // Text fields
            operator.innerHTML = `
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="contains">contains</option>
                <option value="not_contains">not contains</option>
            `;
        }
        
        // Show/hide second value field for between operator
        operator.addEventListener('change', () => {
            value2.style.display = operator.value === 'between' ? 'block' : 'none';
        });
    }

    applyTemplate(template) {
        // Clear existing rules
        document.getElementById('rules-container').innerHTML = '';
        
        const templates = {
            highEnergy: [
                { field: 'energy', operator: 'greater', value: '0.7' },
                { field: 'bpm', operator: 'between', value: '120', value2: '140' },
                { field: 'danceability', operator: 'greater', value: '0.6' }
            ],
            chill: [
                { field: 'energy', operator: 'less', value: '0.5' },
                { field: 'valence', operator: 'between', value: '0.3', value2: '0.7' },
                { field: 'acousticness', operator: 'greater', value: '0.3' }
            ],
            party: [
                { field: 'danceability', operator: 'greater', value: '0.7' },
                { field: 'energy', operator: 'greater', value: '0.6' },
                { field: 'valence', operator: 'greater', value: '0.5' }
            ],
            workout: [
                { field: 'bpm', operator: 'between', value: '125', value2: '135' },
                { field: 'energy', operator: 'greater', value: '0.8' },
                { field: 'danceability', operator: 'greater', value: '0.7' }
            ]
        };
        
        const rules = templates[template];
        if (rules) {
            rules.forEach(rule => {
                this.addRule();
                const lastRule = document.querySelector('.rule-item:last-child');
                lastRule.querySelector('.rule-field').value = rule.field;
                lastRule.querySelector('.rule-operator').value = rule.operator;
                lastRule.querySelector('.rule-value').value = rule.value;
                if (rule.value2) {
                    lastRule.querySelector('.rule-value2').value = rule.value2;
                    lastRule.querySelector('.rule-value2').style.display = 'block';
                }
            });
        }
        
        window.showToast(`Template "${template}" applied`, 'success');
    }

    collectRules() {
        const rules = [];
        document.querySelectorAll('.rule-item').forEach(ruleEl => {
            const field = ruleEl.querySelector('.rule-field').value;
            const operator = ruleEl.querySelector('.rule-operator').value;
            const value = ruleEl.querySelector('.rule-value').value;
            const value2 = ruleEl.querySelector('.rule-value2').value;
            
            if (value) {
                rules.push({ field, operator, value, value2 });
            }
        });
        return rules;
    }

    async refreshPreview() {
        const rules = this.collectRules();
        const logic = document.getElementById('match-logic').value;
        
        // Show loading
        document.getElementById('preview-tracks-list').innerHTML = '<div class="loading">Loading preview...</div>';
        
        try {
            // Call IPC handler to get matching tracks
            const response = await window.api.invoke('preview-smart-playlist', {
                rules: rules,
                logic: logic,
                limit: 20
            });
            
            if (response.success) {
                this.previewTracks = response.tracks;
                this.renderPreview(response.tracks);
            }
        } catch (error) {
            console.error('Error previewing playlist:', error);
        }
    }

    renderPreview(tracks) {
        const container = document.getElementById('preview-tracks-list');
        
        if (!tracks || tracks.length === 0) {
            container.innerHTML = '<div class="no-tracks">No tracks match the criteria</div>';
            document.getElementById('track-count').textContent = '0';
            return;
        }
        
        // Update stats
        document.getElementById('track-count').textContent = tracks.length;
        
        const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
        const mins = Math.floor(totalDuration / 60);
        const hours = Math.floor(mins / 60);
        const displayMins = mins % 60;
        document.getElementById('total-duration').textContent = 
            hours > 0 ? `${hours}h ${displayMins}m` : `${mins}m`;
        
        const avgBpm = Math.round(
            tracks.reduce((sum, t) => sum + (t.AI_BPM || t.existing_bmp || 0), 0) / tracks.length
        );
        document.getElementById('avg-bpm').textContent = avgBpm || '--';
        
        // Render tracks
        let html = '';
        tracks.slice(0, 10).forEach((track, index) => {
            html += `
                <div class="preview-track">
                    <span class="track-number">${index + 1}</span>
                    <img src="${track.artwork_url || 'image.png'}" alt="" class="track-thumb">
                    <div class="track-info">
                        <div class="track-title">${track.title || track.file_name}</div>
                        <div class="track-artist">${track.artist || 'Unknown'}</div>
                    </div>
                    <span class="track-bpm">${track.AI_BPM || track.existing_bmp || '--'} BPM</span>
                </div>
            `;
        });
        
        if (tracks.length > 10) {
            html += `<div class="more-tracks">... and ${tracks.length - 10} more tracks</div>`;
        }
        
        container.innerHTML = html;
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Validate current step
            if (this.currentStep === 1 && !document.getElementById('playlist-name').value) {
                window.showToast('Please enter a playlist name', 'error');
                return;
            }
            
            if (this.currentStep === 2) {
                this.playlistData.rules = this.collectRules();
                if (this.playlistData.rules.length === 0) {
                    window.showToast('Please add at least one rule', 'error');
                    return;
                }
            }
            
            // Move to next step
            document.getElementById(`step${this.currentStep}`).style.display = 'none';
            this.currentStep++;
            document.getElementById(`step${this.currentStep}`).style.display = 'block';
            
            // Update progress
            this.updateProgress();
            
            // Update buttons
            this.updateButtons();
            
            // If reaching preview step, load preview
            if (this.currentStep === 4) {
                this.showPreviewSummary();
                this.refreshPreview();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            document.getElementById(`step${this.currentStep}`).style.display = 'none';
            this.currentStep--;
            document.getElementById(`step${this.currentStep}`).style.display = 'block';
            
            this.updateProgress();
            this.updateButtons();
        }
    }

    updateProgress() {
        const progressFill = this.wizard.querySelector('.progress-fill');
        progressFill.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        
        // Update step indicators
        document.querySelectorAll('.step').forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            if (stepNum <= this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }

    updateButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const createBtn = document.getElementById('create-btn');
        
        prevBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
        nextBtn.style.display = this.currentStep < this.totalSteps ? 'block' : 'none';
        createBtn.style.display = this.currentStep === this.totalSteps ? 'block' : 'none';
    }

    showPreviewSummary() {
        document.getElementById('preview-name').textContent = this.playlistData.name || 'Untitled';
        document.getElementById('preview-desc').textContent = this.playlistData.description || 'No description';
        document.querySelector('.preview-icon').textContent = this.playlistData.icon;
    }

    async createPlaylist() {
        // Collect all data
        this.playlistData.rules = this.collectRules();
        this.playlistData.logic = document.getElementById('match-logic').value;
        this.playlistData.autoUpdate = document.getElementById('auto-update').checked;
        this.playlistData.removeDuplicates = document.getElementById('remove-duplicates').checked;
        this.playlistData.maxTracks = parseInt(document.getElementById('max-tracks').value) || 0;
        this.playlistData.sortBy = document.getElementById('sort-by').value;
        this.playlistData.energyFlow = document.getElementById('energy-flow').value;
        
        try {
            // Create the smart playlist
            const response = await window.api.invoke('create-smart-playlist', this.playlistData);
            
            if (response.success) {
                window.showToast('Smart playlist created successfully!', 'success');
                this.close();
                
                // Refresh playlists view if exists
                if (window.playlistManager) {
                    window.playlistManager.loadPlaylists();
                }
            } else {
                window.showToast('Error creating playlist', 'error');
            }
        } catch (error) {
            console.error('Error creating playlist:', error);
            window.showToast('Error creating playlist', 'error');
        }
    }

    open() {
        this.wizard.style.display = 'flex';
        this.reset();
    }

    close() {
        this.wizard.style.display = 'none';
    }

    reset() {
        this.currentStep = 1;
        this.playlistData = {
            name: '',
            description: '',
            rules: [],
            icon: '🎵',
            color: '#667eea',
            autoUpdate: true
        };
        
        // Reset form
        document.getElementById('playlist-name').value = '';
        document.getElementById('playlist-desc').value = '';
        document.getElementById('rules-container').innerHTML = '';
        this.addRule();
        
        // Reset steps
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.style.display = 'none';
        });
        document.getElementById('step1').style.display = 'block';
        
        this.updateProgress();
        this.updateButtons();
    }
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.smartPlaylistWizard = new SmartPlaylistWizard();
    });
} else {
    window.smartPlaylistWizard = new SmartPlaylistWizard();
}