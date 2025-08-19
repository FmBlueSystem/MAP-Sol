/**
 * Main Application Entry Point for Production Build
 * Coordinates all modules and initializes the application
 */

// Core modules
import './production-logger.js';
import './performance-optimizer.js';
import './database-optimizer.js';
import './error-handler.js';

// UI Components
import './virtual-scroller-production.js';
// import './audio-panel.js'; // Temporarily disabled due to syntax issues
import './audio-player.js';
import './metadata-inspector.js';
import './playlist-manager.js';
import './theme-controller.js';
import './backup-manager.js';

// Utilities
import './memory-manager.js';
import './safe-dom.js';

// Initialize the application
class MusicAnalyzerApp {
    constructor() {
        this.isInitialized = false;
        this.modules = new Map();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            logInfo('🚀 Initializing Music Analyzer Pro...');

            // Initialize error handling first
            this.initErrorHandling();

            // Wait for DOM to be ready
            await this.waitForDOM();

            // Initialize core modules
            await this.initCoreModules();

            // Initialize UI components
            await this.initUIComponents();

            // Load initial data
            await this.loadInitialData();

            // Setup event listeners
            this.setupEventListeners();

            // Mark as initialized
            this.isInitialized = true;

            logInfo('✅ Music Analyzer Pro initialized successfully');
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('app-ready'));

        } catch (error) {
            logError('Failed to initialize application:', error);
            this.showInitError(error);
        }
    }

    initErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            logError('Global error:', event.error);
            event.preventDefault();
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            logError('Unhandled promise rejection:', event.reason);
            event.preventDefault();
        });
    }

    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    async initCoreModules() {
        logInfo('Initializing core modules...');

        // Initialize performance optimizer
        if (window.performanceOptimizer) {
            window.performanceOptimizer.init();
            this.modules.set('performanceOptimizer', window.performanceOptimizer);
        }

        // Initialize database optimizer
        if (window.dbOptimizer) {
            await window.dbOptimizer.init();
            this.modules.set('dbOptimizer', window.dbOptimizer);
        }

        // Initialize logger
        if (window.logger) {
            window.logger.init();
            this.modules.set('logger', window.logger);
        }

        // Initialize memory manager
        if (window.memoryManager) {
            window.memoryManager.init();
            this.modules.set('memoryManager', window.memoryManager);
        }
    }

    async initUIComponents() {
        logInfo('Initializing UI components...');

        // Initialize virtual scroller if content exists
        const contentElement = document.getElementById('content');
        if (contentElement && window.VirtualScroller) {
            // Virtual scroller will be initialized when data is loaded
            this.modules.set('VirtualScroller', window.VirtualScroller);
        }

        // Initialize audio player
        if (window.AudioPlayer) {
            const audioPlayer = new window.AudioPlayer();
            await audioPlayer.init();
            this.modules.set('audioPlayer', audioPlayer);
        }

        // Initialize backup manager
        if (window.backupManager) {
            await window.backupManager.init();
            this.modules.set('backupManager', window.backupManager);
        }

        // Initialize playlist manager
        if (window.playlistManager) {
            window.playlistManager.init();
            this.modules.set('playlistManager', window.playlistManager);
        }

        // Initialize theme controller
        if (window.themeController) {
            window.themeController.init();
            this.modules.set('themeController', window.themeController);
        }
    }

    async loadInitialData() {
        logInfo('Loading initial data...');

        try {
            // Load files from database
            const response = await window.electronAPI.invoke('get-files-with-cached-artwork', {
                limit: 300,
                offset: 0
            });

            if (response && response.files) {
                logInfo(`Loaded ${response.files.length} files`);
                
                // Store globally for other modules
                window.audioFiles = response.files;
                
                // Initialize virtual scroller with data
                if (window.VirtualScroller && document.getElementById('content')) {
                    const scroller = new window.VirtualScroller({
                        container: document.getElementById('content'),
                        items: response.files,
                        viewType: localStorage.getItem('viewType') || 'cards'
                    });
                    this.modules.set('virtualScroller', scroller);
                }
                
                // Update UI elements
                this.updateFileCount(response.files.length);
            }
        } catch (error) {
            logError('Failed to load initial data:', error);
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.handleSearch(e.target.value);
            }, 300));
        }

        // View toggle buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.changeView(view);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });
    }

    async handleSearch(query) {
        try {
            const results = await window.electronAPI.invoke('search-tracks', { query });
            
            if (results && results.tracks) {
                window.audioFiles = results.tracks;
                
                // Update virtual scroller
                const scroller = this.modules.get('virtualScroller');
                if (scroller) {
                    scroller.updateItems(results.tracks);
                }
                
                this.updateFileCount(results.tracks.length);
            }
        } catch (error) {
            logError('Search failed:', error);
        }
    }

    changeView(viewType) {
        // Update virtual scroller view
        const scroller = this.modules.get('virtualScroller');
        if (scroller) {
            scroller.changeView(viewType);
        }
        
        // Save preference
        localStorage.setItem('viewType', viewType);
        
        // Update UI
        document.querySelectorAll('[data-view]').forEach(button => {
            button.classList.toggle('active', button.dataset.view === viewType);
        });
    }

    handleKeyboardShortcut(event) {
        // Implement keyboard shortcuts
        const shortcuts = {
            ' ': () => this.togglePlayPause(),
            'ArrowRight': () => this.playNext(),
            'ArrowLeft': () => this.playPrevious(),
            '/': () => document.getElementById('searchInput')?.focus(),
            'Escape': () => this.clearSearch()
        };

        const handler = shortcuts[event.key];
        if (handler && !event.target.matches('input, textarea')) {
            event.preventDefault();
            handler();
        }
    }

    togglePlayPause() {
        const audioPlayer = this.modules.get('audioPlayer');
        if (audioPlayer) {
            audioPlayer.togglePlayPause();
        }
    }

    playNext() {
        const audioPlayer = this.modules.get('audioPlayer');
        if (audioPlayer) {
            audioPlayer.playNext();
        }
    }

    playPrevious() {
        const audioPlayer = this.modules.get('audioPlayer');
        if (audioPlayer) {
            audioPlayer.playPrevious();
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            this.handleSearch('');
        }
    }

    updateFileCount(count) {
        const countElement = document.getElementById('fileCount');
        if (countElement) {
            countElement.textContent = `${count} tracks`;
        }
    }

    showInitError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'init-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h2>⚠️ Initialization Error</h2>
                <p>Failed to start Music Analyzer Pro</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
                <button onclick="location.reload()">Reload Application</button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API
    getModule(name) {
        return this.modules.get(name);
    }

    isReady() {
        return this.isInitialized;
    }
}

// Create global app instance
window.musicAnalyzerApp = new MusicAnalyzerApp();

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.musicAnalyzerApp.init();
    });
} else {
    window.musicAnalyzerApp.init();
}

// Export for module systems
export default window.musicAnalyzerApp;