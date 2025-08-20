// Production Monitoring System - Complete telemetry for production
class ProductionMonitor {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled !== false,
            endpoint: config.endpoint || '/api/telemetry',
            batchSize: config.batchSize || 50,
            flushInterval: config.flushInterval || 30000, // 30 seconds
            sessionId: this.generateSessionId(),
            userId: config.userId || 'anonymous',
            version: config.version || '2.0.0',
        };

        this.metrics = {
            performance: [],
            errors: [],
            interactions: [],
            custom: [],
        };

        this.vitals = {
            FCP: null, // First Contentful Paint
            LCP: null, // Largest Contentful Paint
            FID: null, // First Input Delay
            CLS: null, // Cumulative Layout Shift
            TTFB: null, // Time to First Byte
        };

        if (this.config.enabled) {
            this.initialize();
        }
    }

    initialize() {
        // Web Vitals
        this.measureWebVitals();

        // Performance monitoring
        this.setupPerformanceObserver();

        // Error monitoring
        this.setupErrorMonitoring();

        // User interaction tracking
        this.setupInteractionTracking();

        // Network monitoring
        this.setupNetworkMonitoring();

        // Start batch sending
        this.startBatchSending();

        // Send telemetry on page unload
        this.setupUnloadHandler();
    }

    measureWebVitals() {
        // First Contentful Paint
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                    this.vitals.FCP = entry.startTime;
                    this.track('vital', { name: 'FCP', value: entry.startTime });
                }
            }
        }).observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
            this.track('vital', { name: 'LCP', value: this.vitals.LCP });
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((list) => {
            const firstInput = list.getEntries()[0];
            this.vitals.FID = firstInput.processingStart - firstInput.startTime;
            this.track('vital', { name: 'FID', value: this.vitals.FID });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            }
            this.vitals.CLS = clsValue;
            this.track('vital', { name: 'CLS', value: clsValue });
        }).observe({ entryTypes: ['layout-shift'] });

        // Time to First Byte
        new PerformanceObserver((list) => {
            const navigation = list.getEntries()[0];
            this.vitals.TTFB = navigation.responseStart - navigation.requestStart;
            this.track('vital', { name: 'TTFB', value: this.vitals.TTFB });
        }).observe({ entryTypes: ['navigation'] });
    }

    setupPerformanceObserver() {
        // Long tasks
        if ('PerformanceObserver' in window) {
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) {
                            this.track('performance', {
                                type: 'longTask',
                                duration: entry.duration,
                                startTime: entry.startTime,
                            });
                        }
                    }
                }).observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task observer not supported
            }
        }

        // Resource timing
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 1000) {
                    this.track('performance', {
                        type: 'slowResource',
                        name: entry.name,
                        duration: entry.duration,
                        size: entry.transferSize,
                    });
                }
            }
        }).observe({ entryTypes: ['resource'] });
    }

    setupErrorMonitoring() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.track('error', {
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
            });
        });

        // Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.track('error', {
                type: 'unhandledRejection',
                reason: event.reason,
                promise: String(event.promise),
            });
        });

        // Resource errors
        window.addEventListener(
            'error',
            (event) => {
                if (event.target !== window) {
                    this.track('error', {
                        type: 'resource',
                        tagName: event.target.tagName,
                        src: event.target.src || event.target.href,
                    });
                }
            },
            true
        );
    }

    setupInteractionTracking() {
        // Click tracking
        document.addEventListener('click', (event) => {
            const target = event.target;
            const selector = this.getSelector(target);

            this.track('interaction', {
                type: 'click',
                selector,
                text: target.textContent?.slice(0, 100),
                timestamp: Date.now(),
            });
        });

        // Form submissions
        document.addEventListener('submit', (event) => {
            const form = event.target;
            this.track('interaction', {
                type: 'formSubmit',
                formId: form.id,
                formName: form.name,
                timestamp: Date.now(),
            });
        });

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            this.track('interaction', {
                type: 'visibilityChange',
                hidden: document.hidden,
                timestamp: Date.now(),
            });
        });
    }

    setupNetworkMonitoring() {
        // Monitor fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            const [resource, config] = args;

            try {
                const response = await originalFetch(...args);
                const duration = performance.now() - startTime;

                this.track('network', {
                    type: 'fetch',
                    url: resource,
                    method: config?.method || 'GET',
                    status: response.status,
                    duration,
                    ok: response.ok,
                });

                return response;
            } catch (error) {
                const duration = performance.now() - startTime;

                this.track('network', {
                    type: 'fetch',
                    url: resource,
                    method: config?.method || 'GET',
                    error: error.message,
                    duration,
                });

                throw error;
            }
        };

        // Monitor connection changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this.track('network', {
                    type: 'connectionChange',
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt,
                });
            });
        }
    }

    track(category, data) {
        if (!this.config.enabled) {
            return;
        }

        const metric = {
            category,
            data,
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            userId: this.config.userId,
            version: this.config.version,
            url: window.location.href,
            userAgent: navigator.userAgent,
        };

        this.metrics[category] = this.metrics[category] || [];
        this.metrics[category].push(metric);

        // Check if we should flush
        const totalMetrics = Object.values(this.metrics).reduce((sum, arr) => sum + arr.length, 0);

        if (totalMetrics >= this.config.batchSize) {
            this.flush();
        }
    }

    startBatchSending() {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }

    async flush() {
        const metricsToSend = { ...this.metrics };

        // Clear current metrics
        Object.keys(this.metrics).forEach((key) => {
            this.metrics[key] = [];
        });

        // Don't send if empty
        const hasMetrics = Object.values(metricsToSend).some((arr) => arr.length > 0);
        if (!hasMetrics) {
            return;
        }

        try {
            // In production, send to real endpoint
            if (window.location.hostname !== 'localhost') {
                await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        metrics: metricsToSend,
                        vitals: this.vitals,
                        timestamp: Date.now(),
                    }),
                });
            } else {
                // In development, just log
            }
        } catch (error) {
            console.error('Failed to send telemetry:', error);
            // Re-add metrics for retry
            Object.keys(metricsToSend).forEach((key) => {
                this.metrics[key].unshift(...metricsToSend[key]);
            });
        }
    }

    setupUnloadHandler() {
        // Send remaining metrics on page unload
        window.addEventListener('beforeunload', () => {
            this.flush();
        });

        // Also handle page hide for mobile
        window.addEventListener('pagehide', () => {
            this.flush();
        });
    }

    getSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        if (element.className) {
            return `.${element.className.split(' ')[0]}`;
        }
        return element.tagName.toLowerCase();
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Custom metric tracking
    trackCustom(name, value, metadata = {}) {
        this.track('custom', {
            name,
            value,
            metadata,
            timestamp: Date.now(),
        });
    }

    // Get current metrics summary
    getSummary() {
        return {
            sessionId: this.config.sessionId,
            vitals: this.vitals,
            metricsCount: Object.values(this.metrics).reduce((sum, arr) => sum + arr.length, 0),
            uptime: Date.now() - parseInt(this.config.sessionId.split('-')[0]),
        };
    }

    // Enable/disable monitoring
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled && this.flushInterval) {
            clearInterval(this.flushInterval);
        } else if (enabled && !this.flushInterval) {
            this.startBatchSending();
        }
    }
}

// Initialize production monitor
window.productionMonitor = new ProductionMonitor({
    enabled: true,
    version: '2.0.0-optimized',
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductionMonitor;
}
