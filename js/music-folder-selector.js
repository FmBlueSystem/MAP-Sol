/**
 * Music Folder Selector - Simple directory and file selection for music import
 * Supports both individual files and complete folders
 */

class MusicFolderSelector {
    constructor() {
        this.selectedPath = '';
        this.selectedFiles = null;
        this.isScanning = false;
        this.init();
    }

    init() {
        this.createUI();
        this.attachEventListeners();
    }

    createUI() {
        // Remove any existing drag & drop zones
        const existingDropZone = document.querySelector('.drop-zone');
        if (existingDropZone) {
            existingDropZone.remove();
        }

        // Create the folder selector UI
        const selectorHTML = `
            <div id="music-folder-selector" class="folder-selector-container">
                <div class="selector-card">
                    <h3>🎵 Import Music Library</h3>
                    
                    <div class="current-path">
                        <label>Selected:</label>
                        <input type="text" id="folder-path-input" 
                               placeholder="No files or folder selected" 
                               readonly>
                    </div>
                    
                    <div class="selector-buttons">
                        <button id="select-files-btn" class="btn-primary">
                            🎵 Select Files
                        </button>
                        
                        <button id="select-folder-btn" class="btn-primary">
                            📁 Select Folder
                        </button>
                    </div>
                    
                    <div class="import-section" style="display: none;">
                        <button id="import-music-btn" class="btn-success" disabled>
                            ⬇️ Import Music
                        </button>
                    </div>
                    
                    <div id="import-status" class="import-status" style="display: none;">
                        <div class="status-message"></div>
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    
                    <div id="import-results" class="import-results" style="display: none;">
                        <h4>Import Complete!</h4>
                        <p>Files imported: <span id="files-imported">0</span></p>
                        <p>Errors: <span id="files-errors">0</span></p>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = `
            <style>
                .folder-selector-container {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    z-index: 1000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                }
                
                .selector-card {
                    background: rgba(30, 30, 45, 0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 20px;
                    width: 350px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                }
                
                .selector-card h3 {
                    margin: 0 0 20px 0;
                    color: #fff;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .current-path {
                    margin-bottom: 20px;
                }
                
                .current-path label {
                    display: block;
                    color: #999;
                    font-size: 12px;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                #folder-path-input {
                    width: 100%;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: #fff;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                
                .selector-buttons {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .import-section {
                    margin-bottom: 20px;
                }
                
                .btn-primary, .btn-success {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
                }
                
                .btn-success {
                    background: linear-gradient(135deg, #00b09b, #96c93d);
                    color: white;
                    width: 100%;
                }
                
                .btn-success:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(0, 176, 155, 0.4);
                }
                
                .btn-success:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .import-status {
                    margin-top: 20px;
                }
                
                .status-message {
                    color: #999;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .progress-bar {
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }
                
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    width: 0%;
                    transition: width 0.3s ease;
                }
                
                .import-results {
                    background: rgba(0, 176, 155, 0.1);
                    border: 1px solid rgba(0, 176, 155, 0.3);
                    border-radius: 6px;
                    padding: 15px;
                    margin-top: 20px;
                }
                
                .import-results h4 {
                    margin: 0 0 10px 0;
                    color: #00b09b;
                    font-size: 16px;
                }
                
                .import-results p {
                    margin: 5px 0;
                    color: #ccc;
                    font-size: 14px;
                }
                
                .import-results span {
                    color: #fff;
                    font-weight: bold;
                }
            </style>
        `;

        // Insert into DOM
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.insertAdjacentHTML('beforeend', selectorHTML);
    }

    attachEventListeners() {
        const selectFilesBtn = document.getElementById('select-files-btn');
        const selectFolderBtn = document.getElementById('select-folder-btn');
        const importBtn = document.getElementById('import-music-btn');

        selectFilesBtn.addEventListener('click', () => this.selectFiles());
        selectFolderBtn.addEventListener('click', () => this.selectFolder());
        importBtn.addEventListener('click', () => this.importMusic());
    }

    async selectFiles() {
        try {
            // Use IPC to open file dialog for individual files
            const result = await window.electronAPI.invoke('select-music-files');

            if (result && result.filePaths && result.filePaths.length > 0) {
                this.selectedFiles = result.filePaths;
                this.selectedPath = null; // Clear folder selection

                // Show selected files info
                const pathInput = document.getElementById('folder-path-input');
                if (result.filePaths.length === 1) {
                    // Show just the filename for single file
                    pathInput.value = result.filePaths[0].split('/').pop();
                } else {
                    pathInput.value = `${result.fileCount} files selected`;
                }

                // Show import button
                document.querySelector('.import-section').style.display = 'block';
                document.getElementById('import-music-btn').disabled = false;

                this.showStatus(`Selected ${result.fileCount} music file(s)`);
            }
        } catch (error) {
            console.error('Error selecting files:', error);
            this.showStatus('Error selecting files', 'error');
        }
    }

    async selectFolder() {
        try {
            // Use IPC to open folder dialog
            const result = await window.electronAPI.invoke('select-music-folder');

            if (result && result.folderPath) {
                this.selectedPath = result.folderPath;
                this.selectedFiles = null; // Clear file selection
                document.getElementById('folder-path-input').value = this.selectedPath;

                // Show import button
                document.querySelector('.import-section').style.display = 'block';
                document.getElementById('import-music-btn').disabled = false;

                // Show folder info
                if (result.fileCount !== undefined) {
                    this.showStatus(`Found ${result.fileCount} music files ready to import`);
                }
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
            this.showStatus('Error selecting folder', 'error');
        }
    }

    async importMusic() {
        if (!this.selectedPath && !this.selectedFiles) {
            this.showStatus('Please select files or a folder first', 'error');
            return;
        }

        if (this.isScanning) {
            this.showStatus('Import already in progress', 'warning');
            return;
        }

        this.isScanning = true;
        const importBtn = document.getElementById('import-music-btn');
        const selectFilesBtn = document.getElementById('select-files-btn');
        const selectFolderBtn = document.getElementById('select-folder-btn');
        importBtn.disabled = true;
        selectFilesBtn.disabled = true;
        selectFolderBtn.disabled = true;

        // Show progress
        const statusDiv = document.getElementById('import-status');
        const resultsDiv = document.getElementById('import-results');
        statusDiv.style.display = 'block';
        resultsDiv.style.display = 'none';

        try {
            let result;

            if (this.selectedFiles) {
                // Import individual files
                this.showStatus('Importing selected files...');
                result = await window.electronAPI.invoke('import-music-files', {
                    filePaths: this.selectedFiles,
                });
            } else {
                // Import folder
                this.showStatus('Scanning folder for music files...');
                result = await window.electronAPI.invoke('import-music-folder', {
                    folderPath: this.selectedPath,
                });
            }

            if (result.success) {
                // Show results
                document.getElementById('files-imported').textContent = result.imported || 0;
                document.getElementById('files-errors').textContent = result.errors || 0;
                resultsDiv.style.display = 'block';

                this.showStatus(`Import complete! ${result.imported} files imported.`, 'success');

                // Refresh the main track list
                if (window.loadFiles) {
                    window.loadFiles();
                }

                // Reset after 5 seconds
                setTimeout(() => {
                    this.reset();
                }, 5000);
            } else {
                this.showStatus(result.error || 'Import failed', 'error');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showStatus('Import failed: ' + error.message, 'error');
        } finally {
            this.isScanning = false;
            importBtn.disabled = false;
            selectFilesBtn.disabled = false;
            selectFolderBtn.disabled = false;
        }
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('import-status');
        const messageDiv = statusDiv.querySelector('.status-message');

        statusDiv.style.display = 'block';
        messageDiv.textContent = message;
        messageDiv.style.color =
            type === 'error' ? '#ff6b6b' : type === 'success' ? '#00b09b' : type === 'warning' ? '#ffd93d' : '#999';
    }

    updateProgress(percent) {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
    }

    reset() {
        this.selectedPath = '';
        this.selectedFiles = null;
        document.getElementById('folder-path-input').value = '';
        document.getElementById('import-music-btn').disabled = true;
        document.querySelector('.import-section').style.display = 'none';
        document.getElementById('import-status').style.display = 'none';
        document.getElementById('import-results').style.display = 'none';
        this.updateProgress(0);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.musicFolderSelector = new MusicFolderSelector();
    });
} else {
    window.musicFolderSelector = new MusicFolderSelector();
}

// Listen for progress updates from backend
if (window.electronAPI) {
    window.electronAPI.on('import-progress', (data) => {
        if (window.musicFolderSelector) {
            const percent = (data.current / data.total) * 100;
            window.musicFolderSelector.updateProgress(percent);
            window.musicFolderSelector.showStatus(`Importing: ${data.current}/${data.total} - ${data.file}`);
        }
    });
}
