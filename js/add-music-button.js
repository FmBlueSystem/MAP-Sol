// Add Music Button - Minimal implementation with drag & drop
class AddMusicButton {
    constructor() {
        this.container = null;
        this.fab = null;
        this.dropZone = null;
        this.progressOverlay = null;
        this.isProcessing = false;
        this.importQueue = [];
        this.currentBatch = null;
        this.abortController = null;
        
        this.init();
    }
    
    init() {
        this.createElements();
        this.attachEventListeners();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
    }
    
    createElements() {
        const html = `
            <div id="add-music-container" class="add-music-container">
                <!-- Floating Action Button -->
                <button id="add-music-fab" class="add-music-fab" title="Add Music (Ctrl+O)">
                    <svg class="fab-icon" viewBox="0 0 24 24">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
                    </svg>
                    <span class="fab-label">Add Music</span>
                </button>
                
                <!-- Drop Zone (Hidden by default) -->
                <div id="drop-zone" class="drop-zone" style="display: none;">
                    <div class="drop-zone-content">
                        <svg class="drop-icon" viewBox="0 0 24 24">
                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="currentColor" opacity="0.3"/>
                            <path d="M14 13v4h-4v-4H7l5-5 5 5h-3z" fill="currentColor"/>
                        </svg>
                        <p class="drop-text">Drop audio files here</p>
                        <p class="drop-subtext">or click to browse</p>
                        <div class="supported-formats">
                            MP3 • FLAC • WAV • M4A • OGG • AAC
                        </div>
                    </div>
                </div>
                
                <!-- Progress Overlay -->
                <div id="import-progress" class="import-progress" style="display: none;">
                    <div class="progress-header">
                        <span class="progress-title">Importing Music...</span>
                        <button class="progress-cancel" onclick="addMusicButton.cancelImport()">✕</button>
                    </div>
                    <div class="progress-details">
                        <span id="current-file">Preparing...</span>
                        <span id="progress-count">0 / 0</span>
                    </div>
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-stages">
                        <span class="stage" data-stage="scan">Scanning</span>
                        <span class="stage" data-stage="import">Importing</span>
                        <span class="stage" data-stage="metadata">Metadata</span>
                        <span class="stage" data-stage="artwork">Artwork</span>
                        <span class="stage" data-stage="analysis">Analysis</span>
                        <span class="stage" data-stage="ai">AI</span>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        this.container = document.getElementById('add-music-container');
        this.fab = document.getElementById('add-music-fab');
        this.dropZone = document.getElementById('drop-zone');
        this.progressOverlay = document.getElementById('import-progress');
    }
    
    attachEventListeners() {
        // FAB click
        this.fab.addEventListener('click', () => this.handleFabClick());
        
        // Drop zone click
        this.dropZone.addEventListener('click', () => this.openFileDialog());
    }
    
    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        // Drag enter/over - show drop zone
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                if (this.isDraggedDataValid(e)) {
                    this.showDropZone();
                    this.dropZone.classList.add('drag-over');
                }
            });
        });
        
        // Drag leave
        document.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                this.dropZone.classList.remove('drag-over');
            }
        });
        
        // Drop
        document.addEventListener('drop', async (e) => {
            if (this.isDraggedDataValid(e)) {
                await this.handleDrop(e);
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + O to open file dialog
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                this.openFileDialog();
            }
        });
    }
    
    handleFabClick() {
        if (this.isProcessing) {
            // Show progress if processing
            this.progressOverlay.style.display = 'block';
        } else {
            // Toggle drop zone
            this.toggleDropZone();
        }
    }
    
    toggleDropZone() {
        const isVisible = this.dropZone.style.display === 'block';
        
        if (isVisible) {
            this.hideDropZone();
        } else {
            this.showDropZone();
        }
    }
    
    showDropZone() {
        this.dropZone.style.display = 'block';
        this.fab.classList.add('active');
        
        // Animate entrance
        requestAnimationFrame(() => {
            this.dropZone.classList.add('active');
        });
    }
    
    hideDropZone() {
        this.dropZone.classList.remove('active');
        this.fab.classList.remove('active');
        
        setTimeout(() => {
            this.dropZone.style.display = 'none';
            this.dropZone.classList.remove('drag-over');
        }, 300);
    }
    
    isDraggedDataValid(e) {
        const dt = e.dataTransfer;
        if (!dt || !dt.types) return false;
        
        // Check if files are being dragged
        return dt.types.includes('Files') || 
               dt.types.includes('application/x-moz-file');
    }
    
    async handleDrop(e) {
        this.dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        const paths = [];
        
        // Get file paths
        for (const file of files) {
            if (this.isAudioFile(file.name) || file.type === '') {
                // Empty type might be a folder
                paths.push(file.path || file.name);
            }
        }
        
        if (paths.length > 0) {
            this.startImport(paths);
        }
    }
    
    isAudioFile(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const audioExtensions = [
            'mp3', 'm4a', 'flac', 'wav', 'ogg', 
            'aac', 'wma', 'aiff', 'ape', 'opus', 'webm'
        ];
        return audioExtensions.includes(ext);
    }
    
    async openFileDialog() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('select-music-files');
            
            if (result && result.filePaths && result.filePaths.length > 0) {
                this.startImport(result.filePaths);
            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
            this.showError('Failed to open file selector');
        }
    }
    
    async startImport(paths) {
        if (this.isProcessing) {
            this.showError('Import already in progress');
            return;
        }
        
        this.isProcessing = true;
        this.importQueue = paths;
        this.abortController = new AbortController();
        
        // Update UI
        this.hideDropZone();
        this.showProgress();
        this.fab.classList.add('processing');
        
        try {
            const { ipcRenderer } = require('electron');
            
            // Start import process
            const result = await ipcRenderer.invoke('import-music', {
                paths: paths,
                options: {
                    checkDuplicates: true,
                    extractArtwork: true,
                    runAnalysis: true,
                    runAI: false // Optional AI enrichment
                }
            });
            
            this.handleImportComplete(result);
            
        } catch (error) {
            console.error('Import error:', error);
            this.handleImportError(error);
        }
    }
    
    showProgress() {
        this.progressOverlay.style.display = 'block';
        this.updateProgress(0, 0, 'Initializing...');
        this.setActiveStage('scan');
    }
    
    hideProgress() {
        this.progressOverlay.style.display = 'none';
        this.fab.classList.remove('processing');
    }
    
    updateProgress(current, total, fileName = '') {
        const progressFill = document.getElementById('progress-fill');
        const progressCount = document.getElementById('progress-count');
        const currentFile = document.getElementById('current-file');
        
        const percentage = total > 0 ? (current / total) * 100 : 0;
        
        progressFill.style.width = `${percentage}%`;
        progressCount.textContent = `${current} / ${total}`;
        
        if (fileName) {
            const shortName = fileName.length > 40 
                ? '...' + fileName.slice(-37) 
                : fileName;
            currentFile.textContent = shortName;
        }
    }
    
    setActiveStage(stageName) {
        document.querySelectorAll('.stage').forEach(stage => {
            stage.classList.remove('active');
            if (stage.dataset.stage === stageName) {
                stage.classList.add('active');
            } else if (this.getStageOrder(stage.dataset.stage) < 
                      this.getStageOrder(stageName)) {
                stage.classList.add('completed');
            }
        });
    }
    
    getStageOrder(stage) {
        const order = {
            'scan': 0,
            'import': 1,
            'metadata': 2,
            'artwork': 3,
            'analysis': 4,
            'ai': 5
        };
        return order[stage] || 999;
    }
    
    async cancelImport() {
        if (this.abortController) {
            this.abortController.abort();
        }
        
        try {
            const { ipcRenderer } = require('electron');
            await ipcRenderer.invoke('cancel-import');
        } catch (error) {
            console.error('Error canceling import:', error);
        }
        
        this.isProcessing = false;
        this.hideProgress();
        this.showNotification('Import canceled', 'warning');
    }
    
    handleImportComplete(result) {
        this.isProcessing = false;
        this.hideProgress();
        
        const message = `Successfully imported ${result.imported} tracks`;
        this.showNotification(message, 'success');
        
        // Refresh the main track list
        if (window.loadFiles) {
            window.loadFiles();
        }
        
        // Show summary if there were issues
        if (result.skipped > 0 || result.failed > 0) {
            this.showImportSummary(result);
        }
    }
    
    handleImportError(error) {
        this.isProcessing = false;
        this.hideProgress();
        
        const message = error.message || 'Import failed';
        this.showNotification(message, 'error');
    }
    
    showImportSummary(result) {
        const summary = `
Import Complete:
✅ Imported: ${result.imported}
⏭️ Skipped (duplicates): ${result.skipped}
❌ Failed: ${result.failed}

Total time: ${result.duration}s
        `;
        
        console.log(summary);
    }
    
    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.addMusicButton = new AddMusicButton();
    });
} else {
    window.addMusicButton = new AddMusicButton();
}

// Listen for progress updates from backend
if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('import-progress', (event, data) => {
        if (window.addMusicButton) {
            window.addMusicButton.updateProgress(
                data.current, 
                data.total, 
                data.fileName
            );
            
            if (data.stage) {
                window.addMusicButton.setActiveStage(data.stage);
            }
        }
    });
}