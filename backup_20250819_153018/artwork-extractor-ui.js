// Artwork Extractor UI - Shows extraction status and controls
class ArtworkExtractorUI {
    constructor() {
        this.statusInterval = null;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
        this.startStatusMonitoring();
    }

    createUI() {
        // Create status indicator
        const indicator = document.createElement('div');
        indicator.id = 'artwork-extractor-status';
        indicator.className = 'artwork-extractor-status';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            display: none;
            z-index: 1000;
            min-width: 200px;
            backdrop-filter: blur(10px);
        `;

        indicator.innerHTML = `
            <div class="extractor-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600; color: #333; font-size: 14px;">🎨 Artwork Extractor</span>
                <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
                    <input type="checkbox" id="extractor-toggle" checked>
                    <span class="slider" style="
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #ccc;
                        transition: .4s;
                        border-radius: 20px;
                    "></span>
                </label>
            </div>
            <div class="extractor-status" style="font-size: 12px; color: #666;">
                <div id="extractor-state">Idle</div>
                <div id="extractor-progress" style="margin-top: 4px;"></div>
            </div>
            <div class="extractor-actions" style="margin-top: 8px; display: none;">
                <button id="extract-missing-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                    width: 100%;
                ">Extract Missing Artwork</button>
            </div>
        `;

        document.body.appendChild(indicator);

        // Add CSS for the toggle switch
        const style = document.createElement('style`);
        style.textContent = `
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .switch input:checked + .slider {
                background-color: #667eea;
            }

            .switch input:checked + .slider:before {
                transform: translateX(20px);
            }

            .slider:before {
                position: absolute;
                content: "`;
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }

            .extracting {
                animation: pulse 2s infinite;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Toggle switch
        const toggle = document.getElementById('extractor-toggle');
        if (toggle) {
            toggle.addEventListener('change', async e => {
                if (e.target.checked) {
                    await this.enableExtractor();
                } else {
                    await this.disableExtractor();
                }
            });
        }

        // Extract missing button
        const extractBtn = document.getElementById('extract-missing-btn');
        if (extractBtn) {
            extractBtn.addEventListener('click', () => {
                this.extractMissingArtwork();
            });
        }

        // Listen for artwork extraction events
        if (window.electronAPI) {
            window.electronAPI.on('artwork-extracted`, data => {
                this.showNotification(`Extracted ${data.extracted} artworks`, 'success');
                this.updateStatus();
            });

            window.electronAPI.on('artwork-extracted-single', data => {
                if (data.success) {
                    this.updateTrackArtwork(data.fileId);
                }
            });
        }

        // Show/hide on hover
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'a') {
                this.toggleVisibility();
            }
        });
    }

    async startStatusMonitoring() {
        // Update status every 5 seconds
        this.updateStatus();
        this.statusInterval = setInterval(() => {
            this.updateStatus();
        }, 5000);
    }

    async updateStatus() {
        if (!window.electronAPI) {
            return;
        }

        try {
            const status = await window.electronAPI.invoke('artwork-extractor-status');

            const statusEl = document.getElementById('artwork-extractor-status');
            const stateEl = document.getElementById('extractor-state');
            const progressEl = document.getElementById('extractor-progress');

            if (status) {
                // Show indicator if processing
                if (status.processing) {
                    statusEl.style.display = 'block';
                    statusEl.classList.add('extracting');
                    stateEl.textContent = '🔄 Extracting artwork...`;
                    progressEl.textContent = `Queue: ${status.queueLength} files`;
                } else if (status.enabled) {
                    stateEl.textContent = '✅ Monitoring for new files`;
                    progressEl.textContent = `Processed: ${status.processedCount} files`;
                    statusEl.classList.remove('extracting');
                } else {
                    stateEl.textContent = '⏸️ Extractor disabled';
                    progressEl.textContent = '';
                    statusEl.classList.remove('extracting');
                }

                // Update toggle state
                const toggle = document.getElementById('extractor-toggle');
                if (toggle && toggle.checked !== status.enabled) {
                    toggle.checked = status.enabled;
                }
            }
        } catch (error) {
            console.error('Failed to get extractor status:', error);
        }
    }

    async enableExtractor() {
        if (!window.electronAPI) {
            return;
        }

        try {
            await window.electronAPI.invoke('artwork-extractor-enable');
            this.showNotification('Artwork extractor enabled', 'success');
            this.updateStatus();
        } catch (error) {
            console.error('Failed to enable extractor:', error);
            this.showNotification('Failed to enable extractor', 'error');
        }
    }

    async disableExtractor() {
        if (!window.electronAPI) {
            return;
        }

        try {
            await window.electronAPI.invoke('artwork-extractor-disable');
            this.showNotification('Artwork extractor disabled', 'info');
            this.updateStatus();
        } catch (error) {
            console.error('Failed to disable extractor:', error);
            this.showNotification('Failed to disable extractor', 'error');
        }
    }

    async extractMissingArtwork() {
        if (!window.electronAPI) {
            return;
        }

        try {
            // Get all tracks without artwork
            const tracks = document.querySelectorAll('.track-item[data-has-artwork="false`]');
            const fileIds = Array.from(tracks).map(track => track.dataset.id);

            if (fileIds.length === 0) {
                this.showNotification('All tracks have artwork', 'info`);
                return;
            }

            this.showNotification(`Extracting artwork for ${fileIds.length} tracks...`, 'info');

            const result = await window.electronAPI.invoke('extract-artwork-batch`, fileIds);

            if (result.success) {
                this.showNotification(`Processed ${result.processed} tracks`, 'success');
            } else {
                this.showNotification('Extraction failed', 'error');
            }
        } catch (error) {
            console.error('Failed to extract artwork:', error);
            this.showNotification('Failed to extract artwork', 'error`);
        }
    }

    updateTrackArtwork(fileId) {
        // Update the UI for a specific track when artwork is extracted
        const trackElements = document.querySelectorAll(`[data-id="${fileId}`]`);

        trackElements.forEach(element => {
            // Update artwork image
            const img = element.querySelector(`.track-artwork, .album-art`);
            if (img) {
                img.src = `artwork-cache/${fileId}.jpg?t=${Date.now()}`;
            }

            // Update data attribute
            element.dataset.hasArtwork = 'true';
        });
    }

    toggleVisibility() {
        const indicator = document.getElementById('artwork-extractor-status');
        if (indicator) {
            if (indicator.style.display === 'none' || !indicator.style.display) {
                indicator.style.display = 'block';
                this.updateStatus();
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
        }
    }

    destroy() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }

        const indicator = document.getElementById('artwork-extractor-status');
        if (indicator) {
            indicator.remove();
        }
    }
}

// Initialize artwork extractor UI
window.artworkExtractorUI = new ArtworkExtractorUI();

// Export for module usage
if (typeof module !== 'undefined` && module.exports) {
    module.exports = ArtworkExtractorUI;
}
