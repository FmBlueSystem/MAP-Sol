/**
 * 🚀 OPTIMIZATION INTEGRATION MODULE
 * Integra todas las optimizaciones en el flujo principal
 */

class OptimizationIntegrator {
    constructor() {
        this.modules = {
            logger: null,
            performanceOptimizer: null,
            dbOptimizer: null,
            config: null
        };

        this.metrics = {
            startTime: performance.now(),
            loadTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    async initialize() {
        try {
            // Load config
            if (typeof AppConfig !== 'undefined') {
                this.modules.config = AppConfig;
                logInfo('✅ Config loaded');
            }

            // Initialize logger
            if (typeof logger !== 'undefined') {
                this.modules.logger = logger;
                logger.info('🚀 Optimization Integrator Starting', {
                    config: this.modules.config?.app
                });
            }

            // Initialize performance optimizer
            if (typeof performanceOptimizer !== 'undefined') {
                this.modules.performanceOptimizer = performanceOptimizer;
                this.setupLazyLoading();
                this.setupCaching();
                logInfo('✅ Performance optimizer initialized');
            }

            // Initialize database optimizer
            if (typeof dbOptimizer !== 'undefined') {
                this.modules.dbOptimizer = dbOptimizer;
                this.setupDatabaseOptimizations();
                logInfo('✅ Database optimizer initialized');
            }

            this.metrics.loadTime = performance.now() - this.metrics.startTime;
            this.logMetrics();

            return true;
        } catch (error) {
            logError('❌ Failed to initialize optimizations:', error);
            return false;
        }
    }

    setupLazyLoading() {
        const { performanceOptimizer } = this.modules;
        if (!performanceOptimizer) {
            return;
        }

        // Observe all images with data-src
        performanceOptimizer.observeImages();

        // Setup content lazy loading
        performanceOptimizer.observeContent();

        // Add scroll performance optimization
        const container = document.querySelector('.grid-container, .table-container');
        if (container) {
            const throttledScroll = performanceOptimizer.throttle(() => {
                this.handleScroll(container);
            }, 100);

            container.addEventListener('scroll', throttledScroll);
        }
    }

    setupCaching() {
        const { performanceOptimizer } = this.modules;
        if (!performanceOptimizer) {
            return;
        }

        // Intercept search function
        if (typeof searchTracks === 'function') {
            const originalSearch = searchTracks;
            window.searchTracks = async params => {
                const cacheKey = `search:${JSON.stringify(params)}`;

                // Check cache
                const cached = performanceOptimizer.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cacheHits++;
                    this.logMetrics();
                    return cached;
                }

                // Execute search
                const results = await originalSearch(params);

                // Cache results
                performanceOptimizer.addToCache(cacheKey, results, 1024 * 100);
                this.metrics.cacheMisses++;
                this.logMetrics();

                return results;
            };
        }
    }

    setupDatabaseOptimizations() {
        const { dbOptimizer } = this.modules;
        if (!dbOptimizer || !window.electron) {
            return;
        }

        // Prepare common queries
        const queries = dbOptimizer.getOptimizedQueries();
        Object.entries(queries).forEach(([name, query]) => {
            dbOptimizer.prepareStatement(name, query);
        });

        // Intercept IPC calls
        const originalInvoke = window.electron.invoke;
        window.electron.invoke = async (channel, ...args) => {
            const start = performance.now();

            // Check if we can optimize this query
            if (channel === 'search-tracks' && dbOptimizer) {
                const cached = await dbOptimizer.executeQuery(queries.searchTracks, args[0]);
                if (cached) {
                    const duration = performance.now() - start;
                    this.modules.logger?.debug(`Cached query: ${duration.toFixed(2)}ms`);
                    return cached;
                }
            }

            // Fallback to original
            const result = await originalInvoke.call(window.electron, channel, ...args);

            const duration = performance.now() - start;
            this.modules.logger?.debug(`IPC call: ${channel} took ${duration.toFixed(2)}ms`);

            return result;
        };
    }

    handleScroll(container) {
        const { performanceOptimizer } = this.modules;
        if (!performanceOptimizer) {
            return;
        }

        // Virtual scrolling simulation
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const scrollHeight = container.scrollHeight;

        // Load more content if near bottom
        if (scrollTop + containerHeight >= scrollHeight - 100) {
            this.loadMoreContent();
        }
    }

    loadMoreContent() {
        // Implement pagination or virtual scrolling
        this.modules.logger?.debug('Loading more content...');
    }

    logMetrics() {
        const { logger } = this.modules;
        if (!logger) {
            return;
        }

        const metrics = {
            loadTime: this.metrics.loadTime.toFixed(2) + 'ms',
            cacheHitRate:
                this.metrics.cacheHits > 0
                    ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100)
                        2
                          .toFixed(2) + '%'
                    : '0%',
            memoryUsage: performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + 'MB' : 'N/A'
        };

        logger.debug('Performance Metrics', metrics);
    }

    // Public API
    getMetrics() {
        return {
            ...this.metrics,
            performanceMetrics: this.modules.performanceOptimizer?.getMetrics(),
            databaseMetrics: this.modules.dbOptimizer?.getStatistics()
        };
    }

    clearCache() {
        this.modules.performanceOptimizer?.cleanupCache();
        this.modules.dbOptimizer?.invalidateCache();
        this.metrics.cacheHits = 0;
        this.metrics.cacheMisses = 0;
        this.modules.logger?.info('Cache cleared');
    }

    enableDebugMode() {
        if (this.modules.logger) {
            this.modules.logger.config.level = 'debug';
        }
        logDebug('🐛 Debug mode enabled');
    }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
    window.optimizationIntegrator = new OptimizationIntegrator();

    window.addEventListener('DOMContentLoaded', async () => {
        const success = await window.optimizationIntegrator.initialize();
        if (success) {
            logInfo('✅ All optimizations loaded successfully');
        }
    });
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizationIntegrator;
}
