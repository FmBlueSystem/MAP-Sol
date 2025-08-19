// Metadata Editor Modal
class MetadataEditor {
    constructor() {
        this.currentFile = null;
        this.modal = null;
        this.init();
    }

    init() {
        // Create modal HTML if it doesn't exist
        if (!document.getElementById('metadata-editor-modal')) {
            this.createModal();
        }
        this.modal = document.getElementById('metadata-editor-modal');
        this.setupEventListeners();
    }

    createModal() {
        const modalHTML = `
        <div id="metadata-editor-modal" class="modal-backdrop" style="display: none;">
            <div class="metadata-modal">
                <div class="modal-header">
                    <h2>📝 Edit Metadata</h2>
                    <button class="close-btn" onclick="metadataEditor.close()">✕</button>
                </div>
                
                <div class="modal-body">
                    <!-- Tabs -->
                    <div class="metadata-tabs">
                        <button class="tab-btn active" data-tab="basic">Basic Info</button>
                        <button class="tab-btn" data-tab="technical">Technical</button>
                        <button class="tab-btn" data-tab="analysis">AI Analysis</button>
                        <button class="tab-btn" data-tab="advanced">Advanced</button>
                    </div>
                    
                    <!-- Tab Content -->
                    <div class="tab-content">
                        <!-- Basic Info Tab -->
                        <div id="tab-basic" class="tab-panel active">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Title *</label>
                                    <input type="text" id="meta-title" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Artist *</label>
                                    <input type="text" id="meta-artist" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Album</label>
                                    <input type="text" id="meta-album" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Genre</label>
                                    <input type="text" id="meta-genre" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Year</label>
                                    <input type="text" id="meta-year" class="meta-input" pattern="[0-9]{4}">
                                </div>
                                <div class="form-group">
                                    <label>Track Number</label>
                                    <input type="number" id="meta-track" class="meta-input" min="1">
                                </div>
                                <div class="form-group">
                                    <label>Comment</label>
                                    <textarea id="meta-comment" class="meta-input" rows="3"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>ISRC</label>
                                    <input type="text" id="meta-isrc" class="meta-input">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Technical Tab -->
                        <div id="tab-technical" class="tab-panel">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>BPM (Original)</label>
                                    <input type="number" id="meta-bpm" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>Key</label>
                                    <select id="meta-key" class="meta-input">
                                        <option value="">-- Select Key --</option>
                                        <option value="C">C Major</option>
                                        <option value="Am">A Minor</option>
                                        <option value="G">G Major</option>
                                        <option value="Em">E Minor</option>
                                        <option value="D">D Major</option>
                                        <option value="Bm">B Minor</option>
                                        <option value="A">A Major</option>
                                        <option value="F#m">F# Minor</option>
                                        <option value="E">E Major</option>
                                        <option value="C#m">C# Minor</option>
                                        <option value="B">B Major</option>
                                        <option value="G#m">G# Minor</option>
                                        <option value="F#">F# Major</option>
                                        <option value="D#m">D# Minor</option>
                                        <option value="Db">Db Major</option>
                                        <option value="Bbm">Bb Minor</option>
                                        <option value="Ab">Ab Major</option>
                                        <option value="Fm">F Minor</option>
                                        <option value="Eb">Eb Major</option>
                                        <option value="Cm">C Minor</option>
                                        <option value="Bb">Bb Major</option>
                                        <option value="Gm">G Minor</option>
                                        <option value="F">F Major</option>
                                        <option value="Dm">D Minor</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Energy Level (1-10)</label>
                                    <input type="number" id="meta-energy" class="meta-input" min="1" max="10">
                                </div>
                                <div class="form-group">
                                    <label>Duration (seconds)</label>
                                    <input type="number" id="meta-duration" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Bitrate (kbps)</label>
                                    <input type="number" id="meta-bitrate" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Format</label>
                                    <input type="text" id="meta-format" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Size</label>
                                    <input type="text" id="meta-filesize" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Sample Rate</label>
                                    <input type="text" id="meta-samplerate" class="meta-input" readonly>
                                </div>
                            </div>
                        </div>
                        
                        <!-- AI Analysis Tab -->
                        <div id="tab-analysis" class="tab-panel">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>AI Genre</label>
                                    <input type="text" id="meta-ai-genre" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Mood</label>
                                    <select id="meta-ai-mood" class="meta-input">
                                        <option value="">-- Select Mood --</option>
                                        <option value="Happy">Happy</option>
                                        <option value="Sad">Sad</option>
                                        <option value="Energetic">Energetic</option>
                                        <option value="Relaxed">Relaxed</option>
                                        <option value="Aggressive">Aggressive</option>
                                        <option value="Melancholic">Melancholic</option>
                                        <option value="Uplifting">Uplifting</option>
                                        <option value="Dark">Dark</option>
                                        <option value="Romantic">Romantic</option>
                                        <option value="Mysterious">Mysterious</option>
                                        <option value="Chill">Chill</option>
                                        <option value="Intense">Intense</option>
                                        <option value="Dreamy">Dreamy</option>
                                        <option value="Groovy">Groovy</option>
                                        <option value="Atmospheric">Atmospheric</option>
                                        <option value="Euphoric">Euphoric</option>
                                        <option value="Nostalgic">Nostalgic</option>
                                        <option value="Powerful">Powerful</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>AI BPM</label>
                                    <input type="number" id="meta-ai-bpm" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>AI Key</label>
                                    <input type="text" id="meta-ai-key" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>AI Energy (0-1)</label>
                                    <input type="number" id="meta-ai-energy" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Danceability (0-1)</label>
                                    <input type="number" id="meta-ai-danceability" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Valence (0-1)</label>
                                    <input type="number" id="meta-ai-valence" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Acousticness (0-1)</label>
                                    <input type="number" id="meta-ai-acousticness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Instrumentalness (0-1)</label>
                                    <input type="number" id="meta-ai-instrumentalness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Liveness (0-1)</label>
                                    <input type="number" id="meta-ai-liveness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Speechiness (0-1)</label>
                                    <input type="number" id="meta-ai-speechiness" class="meta-input" min="0" max="1" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Loudness (dB)</label>
                                    <input type="number" id="meta-ai-loudness" class="meta-input" min="-60" max="0" step="0.1">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Advanced Tab -->
                        <div id="tab-advanced" class="tab-panel">
                            <div class="form-grid">
                                <div class="form-group full-width">
                                    <label>File Path</label>
                                    <input type="text" id="meta-filepath" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File ID</label>
                                    <input type="text" id="meta-id" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Date Added</label>
                                    <input type="text" id="meta-date-added" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Date Modified</label>
                                    <input type="text" id="meta-date-modified" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Last Analyzed</label>
                                    <input type="text" id="meta-last-analyzed" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>MixedInKey BPM</label>
                                    <input type="number" id="meta-existing-bmp" class="meta-input" min="60" max="200" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>MixedInKey Key</label>
                                    <input type="text" id="meta-existing-key" class="meta-input">
                                </div>
                                <div class="form-group">
                                    <label>Analysis Version</label>
                                    <input type="text" id="meta-analysis-version" class="meta-input" readonly>
                                </div>
                                <div class="form-group">
                                    <label>File Hash</label>
                                    <input type="text" id="meta-file-hash" class="meta-input" readonly>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="footer-info">
                        <span id="save-status"></span>
                    </div>
                    <div class="footer-actions">
                        <button class="btn-secondary" onclick="metadataEditor.close()">Cancel</button>
                        <button class="btn-primary" onclick="metadataEditor.save()">💾 Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
        ";

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .metadata-modal {
                background: linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(30, 30, 30, 0.98));
                border-radius: 12px;
                width: 90%;
                max-width: 900px;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .modal-header {
                padding: 20px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .modal-header h2 {
                margin: 0;
                font-size: 20px;
                color: #fff;
            }
            
            .close-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s;
            }
            
            .close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            
            .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            }
            
            .metadata-tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .tab-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.6);
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                border-bottom: 2px solid transparent;
                margin-bottom: -1px;
            }
            
            .tab-btn:hover {
                color: rgba(255, 255, 255, 0.8);
            }
            
            .tab-btn.active {
                color: #1db954;
                border-bottom-color: #1db954;
            }
            
            .tab-panel {
                display: none;
            }
            
            .tab-panel.active {
                display: block;
                animation: fadeIn 0.3s ease;
            }
            
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .form-group.full-width {
                grid-column: 1 / -1;
            }
            
            .form-group label {
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .meta-input {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 10px 12px;
                color: #fff;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .meta-input:focus {
                outline: none;
                border-color: #1db954;
                background: rgba(255, 255, 255, 0.08);
                box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
            }
            
            .meta-input[readonly] {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            select.meta-input {
                cursor: pointer;
            }
            
            textarea.meta-input {
                resize: vertical;
                min-height: 60px;
            }
            
            .modal-footer {
                padding: 16px 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .footer-info {
                color: rgba(255, 255, 255, 0.6);
                font-size: 12px;
            }
            
            .footer-actions {
                display: flex;
                gap: 12px;
            }
            
            .btn-primary, .btn-secondary {
                padding: 10px 20px;
                border-radius: 6px;
                border: none;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #1db954, #1ed760);
                color: #000;
                font-weight: 600;
            }
            
            .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(29, 185, 84, 0.4);
            }
            
            .btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.8);
            }
            
            .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            
            #save-status {
                color: #1db954;
                animation: fadeIn 0.3s;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Close on backdrop click
        const modal = document.getElementById('metadata-editor-modal');
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.close();
            }
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });
    }

    async open(fileData) {
        this.currentFile = fileData;
        this.modal.style.display = 'flex';

        // Load data into form
        this.loadData(fileData);

        // Switch to basic tab by default
        this.switchTab('basic');
    }

    loadData(file) {
        // Basic Info
        document.getElementById('meta-title').value = file.title || '';
        document.getElementById('meta-artist').value = file.artist || '';
        document.getElementById('meta-album').value = file.album || '';
        document.getElementById('meta-genre').value = file.genre || '';
        document.getElementById('meta-year').value = file.year || '';
        document.getElementById('meta-comment').value = file.comment || '';
        document.getElementById('meta-isrc').value = file.isrc || '';

        // Technical
        document.getElementById('meta-bpm').value = file.bmp || file.existing_bmp || '';
        document.getElementById('meta-key').value = file.existing_key || '';
        document.getElementById('meta-energy').value = file.energy_level || '';
        document.getElementById('meta-duration').value = file.duration || '';
        document.getElementById('meta-bitrate').value = file.bitrate || '';
        document.getElementById('meta-format').value = file.file_extension || '';
        document.getElementById('meta-filesize').value = this.formatFileSize(file.file_size) || '';

        // AI Analysis
        document.getElementById('meta-ai-genre').value = file.LLM_GENRE || '';
        document.getElementById('meta-ai-mood').value = file.AI_MOOD || '';
        document.getElementById('meta-ai-bpm').value = file.AI_BPM || '';
        document.getElementById('meta-ai-key').value = file.AI_KEY || '';
        document.getElementById('meta-ai-energy').value = file.AI_ENERGY || '';
        document.getElementById('meta-ai-danceability').value = file.AI_DANCEABILITY || '';
        document.getElementById('meta-ai-valence').value = file.AI_VALENCE || '';
        document.getElementById('meta-ai-acousticness').value = file.AI_ACOUSTICNESS || '';
        document.getElementById('meta-ai-instrumentalness').value = file.AI_INSTRUMENTALNESS || '';
        document.getElementById('meta-ai-liveness').value = file.AI_LIVENESS || '';
        document.getElementById('meta-ai-speechiness').value = file.AI_SPEECHINESS || '';
        document.getElementById('meta-ai-loudness').value = file.AI_LOUDNESS || '';

        // Advanced
        document.getElementById('meta-filepath').value = file.file_path || '';
        document.getElementById('meta-id').value = file.id || '';
        document.getElementById('meta-date-added').value = file.date_added || '';
        document.getElementById('meta-date-modified').value = file.date_modified || '';
        document.getElementById('meta-last-analyzed').value = file.last_analyzed || '';
        document.getElementById('meta-existing-bmp').value = file.existing_bmp || '';
        document.getElementById('meta-existing-key').value = file.existing_key || '';
        document.getElementById('meta-analysis-version').value = file.analysis_version || '';
        document.getElementById('meta-file-hash').value = file.file_hash || '';
    }

    formatFileSize(bytes) {
        if (!bytes) {
            return '';
        }
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async save() {
        if (!this.currentFile) {
            return;
        }

        // Collect all updated values
        const updates = {
            id: this.currentFile.id,
            title: document.getElementById('meta-title').value,
            artist: document.getElementById('meta-artist').value,
            album: document.getElementById('meta-album').value,
            genre: document.getElementById('meta-genre').value,
            year: document.getElementById('meta-year').value,
            comment: document.getElementById('meta-comment').value,
            isrc: document.getElementById('meta-isrc').value,
            bmp: parseFloat(document.getElementById('meta-bpm').value) || null,
            existing_key: document.getElementById('meta-key').value,
            energy_level: parseInt(document.getElementById('meta-energy').value) || null,
            existing_bmp: parseFloat(document.getElementById('meta-existing-bmp').value) || null,

            // AI fields
            LLM_GENRE: document.getElementById('meta-ai-genre').value,
            AI_MOOD: document.getElementById('meta-ai-mood').value,
            AI_BPM: parseFloat(document.getElementById('meta-ai-bpm').value) || null,
            AI_KEY: document.getElementById('meta-ai-key').value,
            AI_ENERGY: parseFloat(document.getElementById('meta-ai-energy').value) || null,
            AI_DANCEABILITY:
                parseFloat(document.getElementById('meta-ai-danceability').value) || null,
            AI_VALENCE: parseFloat(document.getElementById('meta-ai-valence').value) || null,
            AI_ACOUSTICNESS:
                parseFloat(document.getElementById('meta-ai-acousticness').value) || null,
            AI_INSTRUMENTALNESS:
                parseFloat(document.getElementById('meta-ai-instrumentalness').value) || null,
            AI_LIVENESS: parseFloat(document.getElementById('meta-ai-liveness').value) || null,
            AI_SPEECHINESS:
                parseFloat(document.getElementById('meta-ai-speechiness').value) || null,
            AI_LOUDNESS: parseFloat(document.getElementById('meta-ai-loudness').value) || null
        };

        try {
            // Show saving status
            document.getElementById('save-status').textContent = 'Saving...';

            // Call IPC to save to database
            const result = await window.electronAPI.invoke('update-metadata', updates);

            if (result.success) {
                document.getElementById('save-status').textContent = '✅ Saved successfully!';

                // Update the current file data
                Object.assign(this.currentFile, updates);

                // Refresh the main view after a short delay
                setTimeout(() => {
                    this.close();
                    if (window.loadData) {
                        window.loadData(); // Reload the main data
                    }
                }, 1000);
            } else {
                document.getElementById('save-status').textContent = '❌ Error saving changes';
            }
        } catch (error) {
            console.error('Error saving metadata:', error);
            document.getElementById('save-status').textContent = '❌ Error: ' + error.message;
        }
    }

    close() {
        this.modal.style.display = 'none';
        this.currentFile = null;
        document.getElementById('save-status').textContent = '';
    }
}

// Initialize global instance
window.metadataEditor = new MetadataEditor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetadataEditor;
}
