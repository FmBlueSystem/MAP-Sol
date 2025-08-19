/**
 * ⚡ PERFORMANCE OPTIMIZER
 * General performance optimization for Music Analyzer Pro
 */

class PerformanceOptimizer {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled !== false,
            debounceTime: config.debounceTime || 300,
            throttleTime: config.throttleTime || 100,
            lazyLoadOffset: config.lazyLoadOffset || 100,
            imageCacheSize: config.imageCacheSize || 50,
            preloadAhead: config.preloadAhead || 5,
            maxConcurrentRequests: config.maxConcurrentRequests || 6,
            resourceHints: config.resourceHints !== false,
            debug: config.debug || false
        };

        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.imageCache = new Map();
        this.requestQueue = [];
        this.activeRequests = 0;
        this.observers = new Map();
        this.rafCallbacks = new Set();
        this.idleCallbacks = [];

        this.init();
    }

    init() {

        // Setup resource hints
        if (this.config.resourceHints) {
            this.setupResourceHints();
        }

        // Setup request idle callback
        this.setupIdleCallback();

        // Setup animation frame batching
        this.setupRAFBatching();

        // Monitor performance
        this.monitorPerformance();
    }

    /**
     * DEBOUNCING AND THROTTLING
     */
    debounce(func, wait = this.config.debounceTime, immediate = false) {
        const key = func.toString();

        return (...args) => {
            const later = () => {
                this.debounceTimers.delete(key);
                if (!immediate) func(...args);
            };

            const callNow = immediate && !this.debounceTimers.has(key);

            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }

            this.debounceTimers.set(key, setTimeout(later, wait));

            if (callNow) func(...args);
        };
    }

    throttle(func, limit = this.config.throttleTime) {
        const key = func.toString();

        return (...args) => {
            if (!this.throttleTimers.has(key)) {
                func(...args);
                this.throttleTimers.set(key, true);

                setTimeout(() => {
                    this.throttleTimers.delete(key);
                }, limit);
            }
        };
    }

    /**
     * LAZY LOADING
     */
    lazyLoad(selector, options = {}) {
        const config = {
            root: options.root || null,
            rootMargin: options.rootMargin || `${this.config.lazyLoadOffset}px`,
            threshold: options.threshold || 0.01,
            onLoad: options.onLoad || null,
            onError: options.onError || null
        };

        const elements = document.querySelectorAll(selector);

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadElement(entry.target, config);
                        observer.unobserve(entry.target);
                    }
                });
            }, config);

            elements.forEach(element => {
                observer.observe(element);
            });

            // Store observer for cleanup
            this.observers.set(selector, observer);
        } else {
            // Fallback for older browsers
            elements.forEach(element => {
                this.loadElement(element, config);
            });
        }
    }

    loadElement(element, config) {
        if (element.tagName === 'IMG') {
            this.loadImage(element, config);
        } else if (element.tagName === 'IFRAME') {
            this.loadIframe(element, config);
        } else {
            // Generic lazy loading
            const src = element.dataset.src;
            if (src) {
                element.src = src;
                delete element.dataset.src;
            }
        }
    }

    loadImage(img, config) {
        const src = img.dataset.src || img.dataset.lazySrc;
        if (!src) return;

        // Check cache first
        if (this.imageCache.has(src)) {
            img.src = src;
            img.classList.add('loaded');
            if (config.onLoad) config.onLoad(img);
            return;
        }

        // Create temp image for preloading
        const tempImg = new Image();

        tempImg.onload = () => {
            img.src = src;
            img.classList.add('loaded');

            // Add to cache
            this.addToImageCache(src);

            if (config.onLoad) config.onLoad(img);
        };

        tempImg.onerror = () => {
            img.classList.add('error');
            if (config.onError) config.onError(img);
        };

        tempImg.src = src;
        delete img.dataset.src;
        delete img.dataset.lazySrc;
    }

    loadIframe(iframe, config) {
        const src = iframe.dataset.src;
        if (!src) return;

        iframe.src = src;
        delete iframe.dataset.src;

        iframe.onload = () => {
            if (config.onLoad) config.onLoad(iframe);
        };
    }

    addToImageCache(src) {
        this.imageCache.set(src, true);

        // Enforce cache size limit
        if (this.imageCache.size > this.config.imageCacheSize) {
            const firstKey = this.imageCache.keys().next().value;
            this.imageCache.delete(firstKey);
        }
    }

    /**
     * PRELOADING
     */
    preload(resources) {
        resources.forEach(resource => {
            if (typeof resource === 'string') {
                this.preloadResource(resource);
            } else {
                this.preloadResource(resource.url, resource.as);
            }
        });
    }

    preloadResource(url, as = 'fetch') {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = as;

        if (as === 'font') {
            link.crossOrigin = 'anonymous';
        }

        document.head.appendChild(link);
    }

    prefetch(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    preconnect(origins) {
        origins.forEach(origin => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = origin;
            document.head.appendChild(link);
        });
    }

    /**
     * REQUEST QUEUE MANAGEMENT
     */
    async queueRequest(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ request, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        while (this.requestQueue.length > 0 && 
               this.activeRequests < this.config.maxConcurrentRequests) {
            const { request, resolve, reject } = this.requestQueue.shift();
            this.activeRequests++;

            try {
                const result = await request();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.activeRequests--;
                this.processQueue();
            }
        }
    }

    /**
     * DOM OPTIMIZATION
     */
    batchDOMUpdates(updates) {
        requestAnimationFrame(() => {
            // Read phase
            const reads = updates.filter(u => u.type === 'read');
            const readResults = reads.map(u => u.callback());

            // Write phase
            const writes = updates.filter(u => u.type === 'write');
            writes.forEach((u, i) => {
                u.callback(readResults[i]);
            });
        });
    }

    virtualDOM(container, items, renderItem) {
        // Simple virtual DOM implementation
        const fragment = document.createDocumentFragment();

        items.forEach(item => {
            const element = renderItem(item);
            fragment.appendChild(element);
        });

        // Clear and append in one operation
        requestAnimationFrame(() => {
            container.innerHTML = '';
            container.appendChild(fragment);
        });
    }

    /**
     * MEMORY MANAGEMENT
     */
    releaseMemory() {
        // Clear caches
        this.imageCache.clear();

        // Cancel pending timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Garbage collection hint
        if (window.gc) {
            window.gc();
        }

    }

    monitorMemory() {
        if (!performance.memory) return;

        setInterval(() => {
            const used = performance.memory.usedJSHeapSize;
            const limit = performance.memory.jsHeapSizeLimit;
            const usage = (used / limit) * 100;

            if (usage > 90) {
                console.warn('High memory usage:', usage.toFixed(2) + '%');
                this.releaseMemory();
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * ANIMATION OPTIMIZATION
     */
    setupRAFBatching() {
        let rafId = null;

        const processCallbacks = () => {
            const callbacks = [...this.rafCallbacks];
            this.rafCallbacks.clear();

            callbacks.forEach(callback => callback());
            rafId = null;
        };

        this.scheduleRAF = (callback) => {
            this.rafCallbacks.add(callback);

            if (!rafId) {
                rafId = requestAnimationFrame(processCallbacks);
            }
        };
    }

    animateWithRAF(element, properties, duration = 300) {
        const start = performance.now();
        const initial = {};

        // Get initial values
        Object.keys(properties).forEach(prop => {
            initial[prop] = parseFloat(getComputedStyle(element)[prop]) || 0;
        });

        const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);

            // Apply properties
            Object.keys(properties).forEach(prop => {
                const from = initial[prop];
                const to = parseFloat(properties[prop]) || 0;
                const value = from + (to - from) * eased;

                if (prop === 'opacity') {
                    element.style[prop] = value;
                } else {
                    element.style[prop] = `${value}px`;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * IDLE CALLBACK MANAGEMENT
     */
    setupIdleCallback() {
        if ('requestIdleCallback' in window) {
            this.scheduleIdleTask = (callback, options = {}) => {
                const handle = requestIdleCallback(callback, {
                    timeout: options.timeout || 2000
                });

                return () => cancelIdleCallback(handle);
            };
        } else {
            // Fallback
            this.scheduleIdleTask = (callback) => {
                const handle = setTimeout(callback, 1);
                return () => clearTimeout(handle);
            };
        }
    }

    whenIdle(callback) {
        return new Promise((resolve) => {
            this.scheduleIdleTask(() => {
                callback();
                resolve();
            });
        });
    }

    /**
     * RESOURCE HINTS
     */
    setupResourceHints() {
        // DNS prefetch for common domains
        const commonDomains = [
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com'
        ];

        commonDomains.forEach(domain => {
            const link = document.createElement('link');
            link.rel = 'dns-prefetch';
            link.href = domain;
            document.head.appendChild(link);
        });
    }

    /**
     * PERFORMANCE MONITORING
     */
    monitorPerformance() {
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) {
                            if (this.config.debug) {
                                console.warn('Long task detected:', entry.duration + 'ms');
                            }
                        }
                    }
                });

                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task monitoring not supported
            }
        }

        // Monitor memory
        this.monitorMemory();
    }

    /**
     * UTILITIES
     */
    measurePerformance(name, callback) {
        const start = performance.now();
        const result = callback();
        const duration = performance.now() - start;

        if (this.config.debug) {
            }ms');
        }

        return result;
    }

    async measureAsync(name, callback) {
        const start = performance.now();
        const result = await callback();
        const duration = performance.now() - start;

        if (this.config.debug) {
            }ms');
        }

        return result;
    }

    /**
     * PUBLIC API
     */
    optimize(element) {
        // Apply various optimizations to an element
        element.style.willChange = 'auto';
        element.style.contain = 'layout style paint';
        element.style.contentVisibility = 'auto';
    }

    cleanup() {
        // Disconnect all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Clear caches
        this.imageCache.clear();

        // Clear callbacks
        this.rafCallbacks.clear();

    }

    getStats() {
        return {
            activeRequests: this.activeRequests,
            queuedRequests: this.requestQueue.length,
            imageCacheSize: this.imageCache.size,
            observers: this.observers.size,
            pendingDebounce: this.debounceTimers.size,
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            } : null
        };
    }
}

// Create singleton instance
const perfOptimizer = new PerformanceOptimizer({
    enabled: true,
    debug: window.location.hostname === 'localhost'
});

// Expose globally
window.perfOptimizer = perfOptimizer;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}

