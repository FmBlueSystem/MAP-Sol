// Export UI - Professional export interface with multiple formats
class ExportUI {
    constructor() {
        this.selectedTracks = [];
        this.exportFormats = [];
        this.isVisible = false;
        this.currentPreset = null;
        this.init();
    }

    init() {
        this.createExportModal();
        this.loadExportFormats();
        this.attachEventListeners();
    }

    createExportModal() {
        const modalHTML = `
            <div id="export-modal" class="export-modal" style="display: none;">
                <div class="export-container">
                    <div class="export-header">
                        <h2>🚀 Export Tracks</h2>
                        <button class="close-btn" onclick="exportUI.close()">✕</button>
                    </div>
                    
                    <div class="export-content">
                        <!-- Step 1: Track Selection -->
                        <div class="export-step" id="step-tracks">
                            <div class="step-header">
                                <span class="step-number">1</span>
                                <h3>Select Tracks</h3>
                            </div>
                            <div class="step-content">
                                <div class="selection-options">
                                    <button class="selection-btn" onclick="exportUI.selectAll()">
                                        <span class="icon">✅</span>
                                        <span>All Tracks</span>
                                        <span class="count" id="all-count">0</span>
                                    </button>
                                    <button class="selection-btn" onclick="exportUI.selectCurrent()">
                                        <span class="icon">📋</span>
                                        <span>Current Queue</span>
                                        <span class="count" id="queue-count">0</span>
                                    </button>
                                    <button class="selection-btn" onclick="exportUI.selectPlaylist()">
                                        <span class="icon">🎵</span>
                                        <span>From Playlist</span>
                                    </button>
                                    <button class="selection-btn" onclick="exportUI.selectFiltered()">
                                        <span class="icon">🔍</span>
                                        <span>Filtered Results</span>
                                        <span class="count" id="filtered-count">0</span>
                                    </button>
                                    <button class="selection-btn" onclick="exportUI.selectManual()">
                                        <span class="icon">✋</span>
                                        <span>Manual Selection</span>
                                    </button>
                                </div>
                                
                                <div class="selected-summary">
                                    <h4>Selected Tracks</h4>
                                    <div class="summary-stats">
                                        <span class="stat">
                                            <strong id="selected-count">0</strong> tracks
                                        </span>
                                        <span class="stat">
                                            <strong id="selected-duration">0:00</strong> total
                                        </span>
                                        <span class="stat">
                                            <strong id="selected-size">0 MB</strong> size
                                        </span>
                                    </div>
                                    <div class="selected-tracks-preview" id="selected-tracks-preview">
                                        <!-- Preview of selected tracks -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 2: Format Selection -->
                        <div class="export-step" id="step-format">
                            <div class="step-header">
                                <span class="step-number">2</span>
                                <h3>Choose Format</h3>
                            </div>
                            <div class="step-content">
                                <div class="format-grid" id="format-grid">
                                    <!-- Common Formats -->
                                    <div class="format-category">
                                        <h4>📄 Data Formats</h4>
                                        <div class="format-options">
                                            <div class="format-card" data-format="json">
                                                <div class="format-icon">📊</div>
                                                <div class="format-name">JSON</div>
                                                <div class="format-desc">Complete metadata</div>
                                            </div>
                                            <div class="format-card" data-format="csv">
                                                <div class="format-icon">📈</div>
                                                <div class="format-name">CSV</div>
                                                <div class="format-desc">Spreadsheet compatible</div>
                                            </div>
                                            <div class="format-card" data-format="xml">
                                                <div class="format-icon">📋</div>
                                                <div class="format-name">XML</div>
                                                <div class="format-desc">Structured data</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Playlist Formats -->
                                    <div class="format-category">
                                        <h4>🎵 Playlist Formats</h4>
                                        <div class="format-options">
                                            <div class="format-card" data-format="m3u">
                                                <div class="format-icon">📝</div>
                                                <div class="format-name">M3U</div>
                                                <div class="format-desc">Universal playlist</div>
                                            </div>
                                            <div class="format-card" data-format="m3u8">
                                                <div class="format-icon">📑</div>
                                                <div class="format-name">M3U8</div>
                                                <div class="format-desc">UTF-8 playlist</div>
                                            </div>
                                            <div class="format-card" data-format="pls">
                                                <div class="format-icon">📃</div>
                                                <div class="format-name">PLS</div>
                                                <div class="format-desc">WinAmp compatible</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- DJ Software Formats -->
                                    <div class="format-category">
                                        <h4>🎛️ DJ Software</h4>
                                        <div class="format-options">
                                            <div class="format-card premium" data-format="rekordbox">
                                                <div class="format-icon">💿</div>
                                                <div class="format-name">Rekordbox XML</div>
                                                <div class="format-desc">Pioneer DJ</div>
                                                <span class="badge">PRO</span>
                                            </div>
                                            <div class="format-card premium" data-format="traktor">
                                                <div class="format-icon">🎚️</div>
                                                <div class="format-name">Traktor NML</div>
                                                <div class="format-desc">Native Instruments</div>
                                                <span class="badge">PRO</span>
                                            </div>
                                            <div class="format-card premium" data-format="serato">
                                                <div class="format-icon">🎧</div>
                                                <div class="format-name">Serato Crate</div>
                                                <div class="format-desc">Serato DJ</div>
                                                <span class="badge">PRO</span>
                                            </div>
                                            <div class="format-card premium" data-format="virtualDJ">
                                                <div class="format-icon">🎭</div>
                                                <div class="format-name">VirtualDJ</div>
                                                <div class="format-desc">VDJ Database</div>
                                                <span class="badge">PRO</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Step 3: Export Options -->
                        <div class="export-step" id="step-options">
                            <div class="step-header">
                                <span class="step-number">3</span>
                                <h3>Export Options</h3>
                            </div>
                            <div class="step-content">
                                <div class="options-grid">
                                    <!-- Metadata Options -->
                                    <div class="option-group">
                                        <h4>📝 Metadata Fields</h4>
                                        <div class="checkbox-list">
                                            <label><input type="checkbox" checked> Basic Info (Title, Artist, Album)</label>
                                            <label><input type="checkbox" checked> BPM & Key</label>
                                            <label><input type="checkbox" checked> Energy & Mood</label>
                                            <label><input type="checkbox"> AI Analysis Data</label>
                                            <label><input type="checkbox"> Cue Points & Loops</label>
                                            <label><input type="checkbox"> Custom Tags</label>
                                            <label><input type="checkbox"> File Paths</label>
                                            <label><input type="checkbox"> Artwork URLs</label>
                                        </div>
                                    </div>
                                    
                                    <!-- Export Settings -->
                                    <div class="option-group">
                                        <h4>⚙️ Export Settings</h4>
                                        <div class="settings-list">
                                            <div class="setting-item">
                                                <label>File Name</label>
                                                <input type="text" id="export-filename" value="sol-export" />
                                            </div>
                                            <div class="setting-item">
                                                <label>Encoding</label>
                                                <select id="export-encoding">
                                                    <option value="utf8">UTF-8</option>
                                                    <option value="utf16">UTF-16</option>
                                                    <option value="ascii">ASCII</option>
                                                </select>
                                            </div>
                                            <div class="setting-item">
                                                <label>Path Format</label>
                                                <select id="path-format">
                                                    <option value="absolute">Absolute</option>
                                                    <option value="relative">Relative</option>
                                                    <option value="filename">Filename Only</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Presets -->
                                    <div class="option-group">
                                        <h4>⭐ Presets</h4>
                                        <div class="preset-list">
                                            <button class="preset-btn" onclick="exportUI.applyPreset('dj-gig')">
                                                🎧 DJ Gig Export
                                            </button>
                                            <button class="preset-btn" onclick="exportUI.applyPreset('backup')">
                                                💾 Full Backup
                                            </button>
                                            <button class="preset-btn" onclick="exportUI.applyPreset('share')">
                                                🌐 Share Online
                                            </button>
                                            <button class="preset-btn" onclick="exportUI.applyPreset('minimal')">
                                                📄 Minimal Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Preview Area -->
                        <div class="export-preview" id="export-preview" style="display: none;">
                            <div class="preview-header">
                                <h4>📄 Export Preview</h4>
                                <button class="preview-toggle" onclick="exportUI.togglePreview()">
                                    Hide Preview
                                </button>
                            </div>
                            <pre class="preview-content" id="preview-content">
                                <!-- Preview content will appear here -->
                            </pre>
                        </div>
                    </div>
                    
                    <!-- Footer Actions -->
                    <div class="export-footer">
                        <div class="footer-info">
                            <span id="export-status">Ready to export</span>
                        </div>
                        <div class="footer-actions">
                            <button class="btn-secondary" onclick="exportUI.showPreview()">
                                👁️ Preview
                            </button>
                            <button class="btn-primary" onclick="exportUI.performExport()">
                                💾 Export Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = modalHTML;
        document.body.appendChild(container.firstElementChild);
        
        this.modal = document.getElementById('export-modal');
    }

    attachEventListeners() {
        // Format card selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.format-card')) {
                const card = e.target.closest('.format-card');
                if (!card.classList.contains('disabled')) {
                    // Remove previous selection
                    document.querySelectorAll('.format-card').forEach(c => 
                        c.classList.remove('selected'));
                    // Select new format
                    card.classList.add('selected');
                    this.selectedFormat = card.dataset.format;
                    this.updateExportStatus();
                }
            }
        });

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.close();
            }
        });
    }

    async loadExportFormats() {
        try {
            const response = await window.api.invoke('get-export-formats');
            if (response.success) {
                this.exportFormats = response.formats;
                this.updateFormatGrid();
            }
        } catch (error) {
            console.error('Error loading export formats:', error);
        }
    }

    updateFormatGrid() {
        // Update format availability based on backend support
        this.exportFormats.forEach(format => {
            const card = document.querySelector(`[data-format="${format.id}"]`);
            if (card && !format.available) {
                card.classList.add('disabled');
                card.title = 'Coming soon';
            }
        });
    }

    selectAll() {
        this.loadAllTracks();
    }

    async loadAllTracks() {
        try {
            const response = await window.api.invoke('get-all-tracks-for-export');
            if (response.success) {
                this.selectedTracks = response.tracks;
                this.updateSelectedSummary();
                window.showToast(`Selected ${response.tracks.length} tracks`, 'success');
            }
        } catch (error) {
            console.error('Error loading tracks:', error);
        }
    }

    selectCurrent() {
        // Get tracks from current queue
        const queueTracks = window.audioPlayer ? window.audioPlayer.queue : [];
        this.selectedTracks = queueTracks;
        this.updateSelectedSummary();
        window.showToast(`Selected ${queueTracks.length} tracks from queue`, 'success');
    }

    selectPlaylist() {
        // Show playlist selector
        window.showToast('Playlist selection coming soon', 'info');
    }

    selectFiltered() {
        // Get currently filtered tracks
        const filteredTracks = document.querySelectorAll('.track-card:not([style*="display: none"])');
        window.showToast(`Selected ${filteredTracks.length} filtered tracks`, 'success');
    }

    selectManual() {
        // Enable manual selection mode
        window.showToast('Manual selection mode - Click tracks to select', 'info');
        this.close();
    }

    updateSelectedSummary() {
        const count = this.selectedTracks.length;
        const duration = this.selectedTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
        const size = this.selectedTracks.reduce((sum, t) => sum + (t.file_size || 0), 0);
        
        document.getElementById('selected-count').textContent = count;
        document.getElementById('selected-duration').textContent = this.formatDuration(duration);
        document.getElementById('selected-size').textContent = this.formatSize(size);
        
        // Show preview of first 5 tracks
        const preview = document.getElementById('selected-tracks-preview');
        const previewTracks = this.selectedTracks.slice(0, 5);
        preview.innerHTML = previewTracks.map(t => `
            <div class="preview-track">
                <span class="track-name">${t.title || t.file_name}</span>
                <span class="track-artist">${t.artist || 'Unknown'}</span>
            </div>
        `).join('');
        
        if (count > 5) {
            preview.innerHTML += `<div class="more-tracks">... and ${count - 5} more</div>`;
        }
    }

    applyPreset(presetName) {
        this.currentPreset = presetName;
        
        const presets = {
            'dj-gig': {
                fields: ['basic', 'bpm', 'key', 'energy', 'cues'],
                format: 'rekordbox',
                encoding: 'utf8'
            },
            'backup': {
                fields: ['all'],
                format: 'json',
                encoding: 'utf8'
            },
            'share': {
                fields: ['basic', 'bpm', 'key'],
                format: 'csv',
                encoding: 'utf8'
            },
            'minimal': {
                fields: ['basic'],
                format: 'm3u',
                encoding: 'utf8'
            }
        };
        
        const preset = presets[presetName];
        if (preset) {
            // Apply preset settings
            document.querySelector(`[data-format="${preset.format}"]`)?.click();
            document.getElementById('export-encoding').value = preset.encoding;
            
            // Update checkboxes based on preset fields
            this.updateFieldSelection(preset.fields);
            
            window.showToast(`Applied "${presetName}" preset`, 'success');
        }
    }

    updateFieldSelection(fields) {
        const checkboxes = document.querySelectorAll('.checkbox-list input[type="checkbox"]');
        if (fields.includes('all')) {
            checkboxes.forEach(cb => cb.checked = true);
        } else {
            checkboxes.forEach(cb => cb.checked = false);
            // Check specific fields based on preset
            if (fields.includes('basic')) {
                checkboxes[0].checked = true;
            }
            if (fields.includes('bpm')) {
                checkboxes[1].checked = true;
            }
            if (fields.includes('key')) {
                checkboxes[1].checked = true;
            }
            if (fields.includes('energy')) {
                checkboxes[2].checked = true;
            }
            if (fields.includes('cues')) {
                checkboxes[4].checked = true;
            }
        }
    }

    async showPreview() {
        const preview = document.getElementById('export-preview');
        const content = document.getElementById('preview-content');
        
        if (preview.style.display === 'none') {
            preview.style.display = 'block';
            
            // Generate preview based on selected format
            const previewData = await this.generatePreview();
            content.textContent = previewData;
        } else {
            this.togglePreview();
        }
    }

    togglePreview() {
        const preview = document.getElementById('export-preview');
        preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
    }

    async generatePreview() {
        if (!this.selectedFormat || this.selectedTracks.length === 0) {
            return 'Please select tracks and format first';
        }
        
        // Generate preview based on format
        const sampleTracks = this.selectedTracks.slice(0, 3);
        
        switch (this.selectedFormat) {
            case 'json':
                return JSON.stringify(sampleTracks, null, 2);
            
            case 'csv':
                const headers = Object.keys(sampleTracks[0]).join(',');
                const rows = sampleTracks.map(t => Object.values(t).join(','));
                return headers + '\n' + rows.join('\n');
            
            case 'm3u':
                return '#EXTM3U\n' + sampleTracks.map(t => 
                    `#EXTINF:${t.duration || 0},${t.artist || 'Unknown'} - ${t.title || t.file_name}\n${t.file_path}`
                ).join('\n');
            
            default:
                return 'Preview not available for this format';
        }
    }

    async performExport() {
        if (!this.selectedFormat || this.selectedTracks.length === 0) {
            window.showToast('Please select tracks and format', 'error');
            return;
        }
        
        const filename = document.getElementById('export-filename').value || 'sol-export';
        const encoding = document.getElementById('export-encoding').value;
        
        try {
            // Update status
            document.getElementById('export-status').textContent = 'Exporting...';
            
            const response = await window.api.invoke('export-tracks', {
                tracks: this.selectedTracks,
                format: this.selectedFormat,
                filename: filename,
                encoding: encoding,
                options: this.getExportOptions()
            });
            
            if (response.success) {
                window.showToast(`Export successful: ${response.filepath}`, 'success');
                this.close();
            } else {
                window.showToast('Export failed', 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            window.showToast('Export error', 'error');
        } finally {
            document.getElementById('export-status').textContent = 'Ready to export';
        }
    }

    getExportOptions() {
        const options = {
            fields: [],
            pathFormat: document.getElementById('path-format').value
        };
        
        // Get selected fields
        document.querySelectorAll('.checkbox-list input:checked').forEach((cb, index) => {
            options.fields.push(cb.parentElement.textContent.trim());
        });
        
        return options;
    }

    updateExportStatus() {
        const status = document.getElementById('export-status');
        if (this.selectedTracks.length === 0) {
            status.textContent = 'Please select tracks';
        } else if (!this.selectedFormat) {
            status.textContent = 'Please select format';
        } else {
            status.textContent = `Ready to export ${this.selectedTracks.length} tracks as ${this.selectedFormat.toUpperCase()}`;
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }

    open() {
        this.modal.style.display = 'flex';
        this.isVisible = true;
        this.loadAllTracks(); // Load all tracks by default
    }

    close() {
        this.modal.style.display = 'none';
        this.isVisible = false;
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.exportUI = new ExportUI();
    });
} else {
    window.exportUI = new ExportUI();
}