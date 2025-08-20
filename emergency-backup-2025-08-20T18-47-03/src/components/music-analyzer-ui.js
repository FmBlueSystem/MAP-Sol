/**
 * MUSIC ANALYZER UI
 * Beautiful modal interface for music analysis with progress tracking
 */

class MusicAnalyzerUI {
    constructor() {
        this.modal = null;
        this.isAnalyzing = false;
        this.currentAnalysis = null;
        this.selectedFiles = [];
        this.init();
    }

    init() {
        this.createModal();
        this.attachEventListeners();
        this.listenToProgressUpdates();
    }

    createModal() {
        // Create modal HTML
        const modalHTML  = `
            <div id="analyzerModal" class="analyzer-modal" style="display: none;">
                <div class="analyzer-modal-content">
                    <div class="analyzer-header">
                        <h2>🎵 Music Analyzer Pro</h2>
                        <button class="close-btn" id="closeAnalyzer">&times;</button>
                    </div>
                    
                    <div class="analyzer-body">
                        <!-- File Selection -->
                        <div class="file-selection-section" id="fileSelectionSection">
                            <h3>Select Music to Analyze</h3>
                            <div class="selection-options">
                                <button class="btn-primary" id="selectFolderBtn">
                                    📁 Select Folder
                                </button>
                                <button class="btn-secondary" id="selectFilesBtn">
                                    🎵 Select Files
                                </button>
                                <button class="btn-info" id="analyzeAllBtn">
                                    🔄 Analyze All Library
                                </button>
                            </div>
                            
                            <div class="selected-info" id="selectedInfo" style="display: none;">
                                <p><strong>Selected:</strong> <span id="selectedCount">0</span> files</p>
                                <div class="selected-path" id="selectedPath"></div>
                            </div>
                        </div>
                        
                        <!-- Analysis Options -->
                        <div class="analysis-options" id="analysisOptions" style="display: none;">
                            <h3>Analysis Options</h3>
                            <div class="options-grid">
                                <label class="checkbox-option">
                                    <input type="checkbox" id="extractMetadata" checked>
                                    <span>📝 Extract Metadata</span>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" id="extractArtwork" checked>
                                    <span>🎨 Extract Artwork</span>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" id="calculateFeatures" checked>
                                    <span>🎵 Calculate Audio Features</span>
                                </label>
                                <label class="checkbox-option">
                                    <input type="checkbox" id="enrichWithAI">
                                    <span>🤖 AI Enrichment (OpenAI)</span>
                                </label>
                            </div>
                            
                            <div class="batch-settings">
                                <label>
                                    Batch Size: 
                                    <input type="number" id="batchSize" value="10" min="1" max="50">
                                </label>
                            </div>
                        </div>
                        
                        <!-- Progress Section -->
                        <div class="progress-section" id="progressSection" style="display: none;">
                            <h3>Analysis Progress</h3>
                            
                            <div class="current-file">
                                <span class="label">Current File:</span>
                                <span class="filename" id="currentFileName">-</span>
                            </div>
                            
                            <div class="progress-container">
                                <div class="progress-bar-wrapper">
                                    <div class="progress-bar" id="progressBar" style="width: 0%">
                                        <span class="progress-text" id="progressText">0%</span>
                                    </div>
                                </div>
                                <div class="progress-stats">
                                    <span id="progressStats">0 / 0 files</span>
                                    <span id="progressETA">ETA: --:--</span>
                                </div>
                            </div>
                            
                            <div class="step-indicators">
                                <div class="step" id="step1">
                                    <span class="step-icon">📝</span>
                                    <span class="step-label">Metadata</span>
                                </div>
                                <div class="step" id="step2">
                                    <span class="step-icon">🎨</span>
                                    <span class="step-label">Artwork</span>
                                </div>
                                <div class="step" id="step3">
                                    <span class="step-icon">🎵</span>
                                    <span class="step-label">Features</span>
                                </div>
                                <div class="step" id="step4">
                                    <span class="step-icon">🤖</span>
                                    <span class="step-label">AI</span>
                                </div>
                            </div>
                            
                            <div class="analysis-log" id="analysisLog">
                                <div class="log-content" id="logContent"></div>
                            </div>
                        </div>
                        
                        <!-- Results Section -->
                        <div class="results-section" id="resultsSection" style="display: none;">
                            <h3>Analysis Complete! ✅</h3>
                            <div class="results-summary">
                                <div class="result-stat">
                                    <span class="stat-value" id="totalProcessed">0</span>
                                    <span class="stat-label">Files Processed</span>
                                </div>
                                <div class="result-stat">
                                    <span class="stat-value" id="successCount">0</span>
                                    <span class="stat-label">Successful</span>
                                </div>
                                <div class="result-stat">
                                    <span class="stat-value" id="failedCount">0</span>
                                    <span class="stat-label">Failed</span>
                                </div>
                                <div class="result-stat">
                                    <span class="stat-value" id="totalTime">0s</span>
                                    <span class="stat-label">Total Time</span>
                                </div>
                            </div>
                            
                            <div class="failed-files" id="failedFiles" style="display: none;">
                                <h4>Failed Files:</h4>
                                <ul id="failedFilesList"></ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="analyzer-footer">
                        <button class="btn-secondary" id="cancelBtn" style="display: none;">Cancel</button>
                        <button class="btn-primary" id="startBtn" style="display: none;">Start Analysis</button>
                        <button class="btn-warning" id="pauseBtn" style="display: none;">Pause</button> <button class="btn-success" id="resumeBtn" style="display: none;">Resume</button> <button class="btn-primary" id="doneBtn" style=\`display: none;\`>Done</button>
                    </div>
                </div> </div> `;

        // Add CSS styles
        const styleHTML  = `
            <style>
                .analyzer-modal {
                    display: none;
                    position: fixed;
                    z-index: 10000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(10px);
                    animation: fadeIn 0.3s ease;
                }

                .analyzer-modal-content {
                    position: relative;
                    background: linear-gradient(135deg, rgba(30, 30, 40, 0.95), rgba(20, 20, 30, 0.95));
                    margin: 50px auto;
                    padding: 0;
                    width: 90%;
                    max-width: 800px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    animation: slideUp 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .analyzer-header {
                    padding: 20px 30px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-radius: 20px 20px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .analyzer-header h2 {
                    margin: 0;
                    color: white;
                    font-size: 24px;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 30px;
                    cursor: pointer;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }

                .close-btn:hover {
                    opacity: 1;
                }

                .analyzer-body {
                    padding: 30px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .analyzer-body h3 {
                    color: #667eea;
                    margin-bottom: 20px;
                }

                .selection-options {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .btn-primary, .btn-secondary, .btn-info, .btn-warning, .btn-success {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                    color: white;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                }

                .btn-secondary {
                    background: linear-gradient(135deg, #4a5568, #2d3748);
                }

                .btn-info {
                    background: linear-gradient(135deg, #00b4d8, #0077b6);
                }

                .btn-warning {
                    background: linear-gradient(135deg, #f77f00, #d62828);
                }

                .btn-success {
                    background: linear-gradient(135deg, #06ffa5, #00b4d8);
                    color: #1a1a2e;
                }

                .btn-primary:hover, .btn-secondary:hover, .btn-info:hover,
                .btn-warning:hover, .btn-success:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
                }

                .selected-info {
                    background: rgba(102, 126, 234, 0.1);
                    padding: 15px;
                    border-radius: 10px;
                    margin-top: 20px;
                }

                .options-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .checkbox-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    transition: background 0.2s;
                }

                .checkbox-option:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .checkbox-option input {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }

                .progress-container {
                    margin: 20px 0;
                }

                .progress-bar-wrapper {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 15px;
                    height: 40px;
                    overflow: hidden;
                    position: relative;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    border-radius: 15px;
                    transition: width 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
                }

                .progress-text {
                    color: white;
                    font-weight: bold;
                    font-size: 18px;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }

                .progress-stats {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                    color: #a0a0a0;
                }

                .current-file {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 10px 15px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    display: flex;
                    gap: 10px;
                }

                .current-file .label {
                    color: #667eea;
                    font-weight: bold;
                }

                .current-file .filename {
                    color: #fff;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .step-indicators {
                    display: flex;
                    justify-content: space-around;
                    margin: 30px 0;
                }

                .step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    opacity: 0.3;
                    transition: all 0.3s;
                }

                .step.active {
                    opacity: 1;
                    transform: scale(1.1);
                }

                .step.completed {
                    opacity: 0.8;
                }

                .step.completed .step-icon {
                    background: linear-gradient(135deg, #06ffa5, #00b4d8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .step-icon {
                    font-size: 30px;
                }

                .step-label {
                    font-size: 12px;
                    color: #a0a0a0;
                }

                .analysis-log {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 10px;
                    padding: 15px;
                    max-height: 150px;
                    overflow-y: auto;
                    margin-top: 20px;
                }

                .log-content {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #06ffa5;
                    line-height: 1.5;
                }

                .results-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin: 30px 0;
                }

                .result-stat {
                    text-align: center;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 15px;
                    transition: transform 0.3s;
                }

                .result-stat:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.1);
                }

                .stat-value {
                    display: block;
                    font-size: 32px;
                    font-weight: bold;
                    color: #667eea;
                    margin-bottom: 10px;
                }

                .stat-label {
                    color: #a0a0a0;
                    font-size: 14px;
                }

                .analyzer-footer {
                    padding: 20px 30px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 0 0 20px 20px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            </style>
        ';

        // Add to DOM
        document.head.insertAdjacentHTML('beforeend', styleHTML);
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        this.modal = document.getElementById('analyzerModal');
    }

    attachEventListeners() {
        // Close button
        document.getElementById('closeAnalyzer').addEventListener('click', () => {
            this.close();
        });

        // Selection buttons
        document.getElementById('selectFolderBtn').addEventListener('click', () => {
            this.selectFolder();
        });

        document.getElementById('selectFilesBtn').addEventListener('click', () => {
            this.selectFiles();
        });

        document.getElementById('analyzeAllBtn').addEventListener('click', () => {
            this.analyzeAll();
        });

        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startAnalysis();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.cancelAnalysis();
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseAnalysis();
        });

        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.resumeAnalysis();
        });

        document.getElementById('doneBtn').addEventListener('click', () => {
            this.close();
        });
    }

    listenToProgressUpdates() {
        // Listen for progress updates from main process
        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('analysis-progress', progress => {
                this.updateProgress(progress);
            });
        }
    }

    show() {
        this.modal.style.display = 'block';
        this.reset();
    }

    close() {
        this.modal.style.display = 'none';
        if (this.isAnalyzing) {
            this.cancelAnalysis();
        }
    }

    reset() {
        // Reset UI to initial state
        document.getElementById('fileSelectionSection').style.display = 'block';
        document.getElementById('analysisOptions').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';

        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('resumeBtn').style.display = 'none';
        document.getElementById('doneBtn').style.display = 'none';

        this.selectedFiles = [];
        this.isAnalyzing = false;
    }

    async selectFolder() {
        // Use native dialog to select folder
        if (window.electronAPI && window.electronAPI.invoke) {
            try {
                const result = await window.electronAPI.invoke('select-music-folder');
                if (result.success && result.path) {
                    this.selectedFiles = [result.path];
                    this.showSelectedInfo(result.path, 'folder');
                }
            } catch (error) {
                console.error('Error selecting folder:', error);
                alert('Failed to select folder: ' + error.message);
            }
        } else { alert('File selection not available. Please restart the application.\');
        }
    }

    async selectFiles() {
        // Use native dialog to select files
        if (window.electronAPI && window.electronAPI.invoke) {
            try { const result = await window.electronAPI.invoke(\`select-music-files`);
                if (result.success && result.paths) { this.selectedFiles = result.paths; this.showSelectedInfo(`${result.paths.length} files`, 'files');
                }
            } catch (error) {
                console.error('Error selecting files:', error);
                alert('Failed to select files: ' + error.message);
            }
        } else { alert('File selection not available. Please restart the application.');
        }
    }

    async analyzeAll() {
        // Get all files from library
        if (window.electronAPI && window.electronAPI.invoke) {
            try { const result = await window.electronAPI.invoke(`get-all-library-files`);
                if (result.success && result.paths) {
                    this.selectedFiles = result.paths; this.showSelectedInfo( \`Entire Library (${result.paths.length} files)\`,
                        'library'
                    );
                } else {
                    alert('No files found in library. Please add music files first.');
                }
            } catch (error) {
                console.error('Error getting library files:', error);
                alert('Failed to get library files: ' + error.message);
            }
        }
    }

    showSelectedInfo(selection, type) {
        document.getElementById('selectedInfo').style.display = 'block';
        document.getElementById('analysisOptions').style.display = 'block';
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('cancelBtn').style.display = 'inline-block';

        if (type === 'folder') {
            // Show folder path
            const folderName =
                selection.split('/').pop() || selection.split('\\').pop() || selection;
            document.getElementById('selectedPath').textContent = selection;
            document.getElementById('selectedPath').title = selection; // Tooltip with full path
            document.getElementById('selectedCount').textContent = 'Folder: ' + folderName;
        } else if (type === 'files') {
            // Show file count const count = parseInt(selection.split(' ')[0]) || this.selectedFiles.length; document.getElementById(`selectedPath\`).textContent = \`${count} audio files selected`;
            document.getElementById('selectedCount').textContent = count;
        } else if (type === 'library') {
            // Show library info
            document.getElementById('selectedPath').textContent = selection;
            document.getElementById('selectedCount').textContent = this.selectedFiles.length;
        }
    }

    async startAnalysis() {
        this.isAnalyzing = true;

        // Show progress section
        document.getElementById('fileSelectionSection').style.display = 'none';
        document.getElementById('analysisOptions').style.display = 'none';
        document.getElementById('progressSection').style.display = 'block';

        // Update buttons
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';

        // Start analysis
        if (window.electronAPI && window.electronAPI.invoke) {
            const options = {
                extractMetadata: document.getElementById('extractMetadata').checked,
                extractArtwork: document.getElementById('extractArtwork').checked,
                calculateFeatures: document.getElementById('calculateFeatures').checked,
                enrichWithAI: document.getElementById('enrichWithAI').checked,
                batchSize: parseInt(document.getElementById('batchSize').value)
            };

            let result;
            try {
                // Check if it's a directory or files
                if (this.selectedFiles.length === 1 && !this.selectedFiles[0].includes('.')) {
                    // Likely a directory path
                    const result = await window.electronAPI.invoke(
                        'analyze-directory',
                        this.selectedFiles[0]
                    );
                } else {
                    // Individual files
                    const result = await window.electronAPI.invoke('analyze-files', this.selectedFiles);
                }

                this.showResults(result);
            } catch (error) {
                console.error('Analysis error:', error);
                alert('Analysis failed: ' + error.message);
                this.close();
            }
        } else { alert('ElectronAPI not available. Please restart the application.');
        }
    }

    updateProgress(progress) {
        // Update progress bar document.getElementById(\`progressBar\`).style.width = `${progress.percentage}%`; document.getElementById(\`progressText\`).textContent = `${progress.percentage}%`;
 // Update stats document.getElementById(\`progressStats\`).textContent = `${progress.current} / ${progress.total} files`;

        // Update ETA
        const eta = progress.estimatedTimeRemaining;
        const minutes = Math.floor(eta / 60); const seconds = Math.floor(eta % 60); document.getElementById(\`progressETA\`).textContent = `ETA: ${minutes}:${seconds.toString().padStart(2, `0\`)}\`;

        // Update current file if (progress.currentFile) { document.getElementById(`currentFileName`).textContent = progress.currentFile;
        }

        // Update step indicators (simplified)
        const step = Math.ceil((progress.percentage / 100) * 4); for (let i = 1; i <= 4; i++) { const stepEl = document.getElementById(\`step${i}\`);
            if (i < step) {
                stepEl.classList.add('completed');
                stepEl.classList.remove('active');
            } else if (i === step) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed'); } else { stepEl.classList.remove('active', `completed\`);
            }
        }
 // Add to log this.addToLog(\`Processing: ${progress.currentFile || `Unknown`}\`);
    }
 addToLog(message) { const logContent = document.getElementById(\`logContent`); const timestamp = new Date().toLocaleTimeString(); logContent.innerHTML += `[${timestamp}] ${message}\n`;
        logContent.scrollTop = logContent.scrollHeight;
    }

    async pauseAnalysis() {
        if (window.electronAPI && window.electronAPI.invoke) {
            await window.electronAPI.invoke('pause-analysis');
            document.getElementById('pauseBtn').style.display = 'none';
            document.getElementById('resumeBtn').style.display = 'inline-block';
        }
    }

    async resumeAnalysis() {
        if (window.electronAPI && window.electronAPI.invoke) {
            await window.electronAPI.invoke('resume-analysis');
            document.getElementById('resumeBtn').style.display = 'none';
            document.getElementById('pauseBtn').style.display = 'inline-block';
        }
    }

    async cancelAnalysis() {
        if (window.electronAPI && window.electronAPI.invoke) {
            await window.electronAPI.invoke('stop-analysis');
        }
        this.isAnalyzing = false;
        this.close();
    }

    showResults(result) {
        this.isAnalyzing = false;

        // Hide progress, show results
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';

        // Update buttons
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('doneBtn').style.display = 'inline-block';

        // Show results
        if (result && result.result) {
            const data = result.result;
            document.getElementById('totalProcessed').textContent = data.processed || 0;
            document.getElementById('successCount').textContent = data.processed - data.failed || 0; document.getElementById('failedCount').textContent = data.failed || 0; document.getElementById(`totalTime`).textContent = \`${Math.round(data.duration || 0)}s\`;

            // Show failed files if any
            if (data.failed > 0 && result.results) {
                const failedFiles = result.results.filter(r => !r.success);
                if (failedFiles.length > 0) {
                    document.getElementById('failedFiles').style.display = 'block'; const list = document.getElementById('failedFilesList'); list.innerHTML = '`;
                    failedFiles.forEach(f => {
                        const li = document.createElement(`li\`); li.textContent = \`${f.file}: ${f.error}`;
                        list.appendChild(li);
                    });
                }
            }
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => {
        window.musicAnalyzerUI = new MusicAnalyzerUI();
    });
} else {
    window.musicAnalyzerUI = new MusicAnalyzerUI();
}

// Export for use if (typeof module !== `undefined` && module.exports) {
    module.exports = MusicAnalyzerUI;
}
