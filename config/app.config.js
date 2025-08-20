/**
 * 🎛️ APP CONFIGURATION
 * Central configuration for Music Analyzer Pro
 */

const APP_CONFIG = {
    // App Info
    app: {
        name: 'Music Analyzer Pro',
        version: '2.0.0',
        codename: 'MAP',
        author: 'BlueSystemIO',
        description: 'Professional Music Analysis & Management System',
    },

    // Features
    features: {
        serviceWorker: true,
        offlineMode: true,
        darkMode: true,
        virtualScrolling: true,
        lazyLoading: true,
        errorTracking: true,
        performanceMonitoring: true,
        logging: true,
        animations: true,
    },

    // Performance
    performance: {
        maxConcurrentRequests: 6,
        debounceTime: 300,
        throttleTime: 100,
        cacheSize: 100,
        cacheTTL: 300000, // 5 minutes
        virtualScrollBuffer: 5,
        lazyLoadOffset: 100,
        batchSize: 1000,
    },

    // Database
    database: {
        name: 'music_analyzer.db',
        version: 1,
        maxResults: 500,
        queryTimeout: 30000,
        indexes: [
            'idx_artist',
            'idx_title',
            'idx_file_name',
            'idx_genre',
            'idx_llm_genre',
            'idx_ai_mood',
            'idx_ai_bpm',
            'idx_ai_energy',
            'idx_file_id',
        ]
    },

    // UI Configuration
    ui: {
        theme: 'system', // 'light', 'dark', 'system'
        animationsEnabled: true,
        transitionDuration: 300,
        gridColumns: 'auto-fill',
        cardMinWidth: 280,
        cardMaxWidth: 400,
        itemsPerPage: 50,
        maxItemsVisible: 500,
    },

    // Audio Configuration
    audio: {
        crossfadeDuration: 5000,
        bufferSize: 4096,
        sampleRate: 44100,
        preloadNext: true,
        visualizerEnabled: true,
        normalizeVolume: true,
    },

    // Paths
    paths: {
        artwork: './artwork-cache/',
        database: './music_analyzer.db',
        serviceWorker: './service-worker.js',
        manifest: './manifest.json',
        icons: './icons/',
    },

    // API Endpoints (if needed in future)
    api: {
        base: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
    },

    // Error Tracking
    errorTracking: {
        enabled: true,
        maxErrors: 100,
        throttleMs: 1000,
        captureUnhandled: true,
        capturePromiseRejections: true,
        captureConsoleErrors: true,
    },

    // Logging
    logging: {
        enabled: true,
        level: 'info', // 'trace', 'debug', 'info', 'warn', 'error', 'fatal'
        persist: true,
        maxLogs: 1000,
        colors: true,
        timestamp: true,
    },

    // Search Configuration
    search: {
        minQueryLength: 2,
        debounceMs: 300,
        maxResults: 500,
        fuzzySearch: false,
        searchFields: ['title', 'artist', 'album', 'genre', 'file_name'],
    },

    // Cache Configuration
    cache: {
        enabled: true,
        strategies: {
            images: 'cache-first',
            api: 'network-first',
            static: 'cache-first',
            dynamic: 'stale-while-revalidate',
        },
        maxAge: {
            images: 604800000, // 7 days
            api: 300000, // 5 minutes
            static: 2592000000, // 30 days
            dynamic: 86400000, // 1 day
        }
    },

    // Development
    dev: {
        debug: window.location.hostname === 'localhost',
        verbose: false,
        mockData: false,
        showStats: true,
        showPerformance: true,
    }
};

// Freeze configuration to prevent modifications
Object.freeze(APP_CONFIG);

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
}

// Make available globally
window.APP_CONFIG = APP_CONFIG;

console.log('🎛️ App Configuration loaded:', APP_CONFIG.app.name, 'v' + APP_CONFIG.app.version);
