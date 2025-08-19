// Memory Leak Detector - Advanced memory monitoring and leak detection
class MemoryLeakDetector {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.interval = options.interval || 10000; // 10 seconds
        this.threshold = options.threshold || 50; // 50MB increase
        this.maxSamples = options.maxSamples || 100;

        this.samples = [];
        this.leaks = [];
        this.monitoring = false;
        this.observers = new Map();
        this.domNodes = new WeakMap();
        this.eventListeners = new WeakMap();

        if (this.enabled) {
            this.startMonitoring();
        }
    }

    startMonitoring() {
        if (this.monitoring || !performance.memory) {
            console.warn('Memory monitoring not available or already running');
            return;
        }

        this.monitoring = true;

        // Monitor memory usage
        this.memoryInterval = setInterval(() => {
            this.collectMemorySample();
        }, this.interval);

        // Monitor DOM mutations
        this.setupDOMMonitoring();

        // Monitor event listeners
        this.setupEventListenerMonitoring();

        // Monitor object allocations
        this.setupAllocationMonitoring();
    }

    stopMonitoring() {
        this.monitoring = false;

        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }

        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }

    collectMemorySample() {
        if (!performance.memory) {
            return;
        }

        const sample = {
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            domNodes: document.getElementsByTagName('*').length,
            listeners: this.countEventListeners()
        };

        this.samples.push(sample);

        // Keep only recent samples
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        // Analyze for leaks
        this.analyzeForLeaks(sample);
    }

    analyzeForLeaks(currentSample) {
        if (this.samples.length < 5) {
            return;
        }

        // Get baseline from 5 samples ago
        const baseline = this.samples[this.samples.length - 5];
        const memoryIncrease = currentSample.usedJSHeapSize - baseline.usedJSHeapSize;
        const memoryIncreaseMB = memoryIncrease / 1048576;

        // Check for steady memory increase
        if (memoryIncreaseMB > this.threshold) {
            const leak = {
                timestamp: Date.now(),
                increase: memoryIncreaseMB,
                current: currentSample.usedJSHeapSize / 1048576,
                baseline: baseline.usedJSHeapSize / 1048576,
                domNodeIncrease: currentSample.domNodes - baseline.domNodes,
                listenerIncrease: currentSample.listeners - baseline.listeners,
                type: this.classifyLeak(currentSample, baseline)
            };

            this.leaks.push(leak);
            this.onLeakDetected(leak);
        }

        // Check for DOM leaks
        if (currentSample.domNodes > 10000) {
            console.warn(`⚠️ High DOM node count: ${currentSample.domNodes}`);
        }

        // Check for listener leaks
        if (currentSample.listeners > 1000) {
            console.warn(`⚠️ High event listener count: ${currentSample.listeners}`);
        }
    }

    classifyLeak(current, baseline) {
        const domIncrease = current.domNodes - baseline.domNodes;
        const listenerIncrease = current.listeners - baseline.listeners;

        if (domIncrease > 100) {
            return 'DOM_LEAK';
        }
        if (listenerIncrease > 50) {
            return 'LISTENER_LEAK';
        }
        if (current.usedJSHeapSize > current.totalJSHeapSize * 0.9) {
            return 'HEAP_PRESSURE';
        }

        return 'MEMORY_LEAK';
    }

    onLeakDetected(leak) {
        console.error('🚨 Memory leak detected:', {
            type: leak.type,
            increase: `${leak.increase.toFixed(2)} MB`,
            current: `${leak.current.toFixed(2)} MB`,
            domNodes: `+${leak.domNodeIncrease}`,
            listeners: `+${leak.listenerIncrease}`
        });

        // Attempt automatic cleanup
        this.attemptCleanup(leak);

        // Notify error tracking
        if (window.errorTracker) {
            window.errorTracker.captureError({
                type: 'memoryLeak',
                leak
            });
        }
    }

    attemptCleanup(leak) {
        switch (leak.type) {
            case 'DOM_LEAK':
                this.cleanupDetachedNodes();
                break;
            case 'LISTENER_LEAK':
                this.cleanupEventListeners();
                break;
            case 'HEAP_PRESSURE':
                this.aggressiveCleanup();
                break;
            default:
                this.generalCleanup();
        }
    }

    setupDOMMonitoring() {
        // Monitor for detached DOM nodes
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                // Track removed nodes
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        // Element node
                        this.checkForDetachedNode(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observers.set('dom', observer);
    }

    checkForDetachedNode(node) {
        // Check if node is still referenced somewhere
        setTimeout(() => {
            if (!document.contains(node) && this.hasReferences(node)) {
                console.warn('⚠️ Detached DOM node still referenced:', node);
                this.domNodes.set(node, Date.now());
            }
        }, 1000);
    }

    hasReferences(node) {
        // Check for event listeners
        const listeners = this.eventListeners.get(node);
        return listeners && listeners.length > 0;
    }

    setupEventListenerMonitoring() {
        // Override addEventListener
        const originalAdd = EventTarget.prototype.addEventListener;
        const originalRemove = EventTarget.prototype.removeEventListener;

        EventTarget.prototype.addEventListener = function (type, listener, options) {
            // Track listener
            if (!window.memoryLeakDetector.eventListeners.has(this)) {
                window.memoryLeakDetector.eventListeners.set(this, []);
            }
            window.memoryLeakDetector.eventListeners.get(this).push({
                type,
                listener,
                options
            });

            return originalAdd.call(this, type, listener, options);
        };

        EventTarget.prototype.removeEventListener = function (type, listener, options) {
            // Remove from tracking
            const listeners = window.memoryLeakDetector.eventListeners.get(this);
            if (listeners) {
                const index = listeners.findIndex(l => l.type === type && l.listener === listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }

            return originalRemove.call(this, type, listener, options);
        };
    }

    setupAllocationMonitoring() {
        // Monitor large object allocations
        if (typeof FinalizationRegistry !== 'undefined') {
            this.registry = new FinalizationRegistry(heldValue => {});
        }
    }

    countEventListeners() {
        let count = 0;
        this.eventListeners.forEach(listeners => {
            count += listeners.length;
        });
        return count;
    }

    cleanupDetachedNodes() {
        let cleaned = 0;
        this.domNodes.forEach((timestamp, node) => {
            if (!document.contains(node)) {
                // Remove all event listeners
                const listeners = this.eventListeners.get(node);
                if (listeners) {
                    listeners.forEach(({ type, listener, options }) => {
                        node.removeEventListener(type, listener, options);
                    });
                    this.eventListeners.delete(node);
                }

                // Clear references
                this.domNodes.delete(node);
                cleaned++;
            }
        });
    }

    cleanupEventListeners() {
        let cleaned = 0;
        this.eventListeners.forEach((listeners, target) => {
            if (!document.contains(target) && target !== window && target !== document) {
                listeners.forEach(({ type, listener, options }) => {
                    target.removeEventListener(type, listener, options);
                });
                this.eventListeners.delete(target);
                cleaned += listeners.length;
            }
        });
    }

    generalCleanup() {
        // Clear caches
        if (window.performanceOptimizer) {
            window.performanceOptimizer.clearCache();
        }

        // Clear memory manager
        if (window.memoryManager) {
            window.memoryManager.cleanup();
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    aggressiveCleanup() {
        // Clear all caches
        this.generalCleanup();

        // Clear detached nodes
        this.cleanupDetachedNodes();

        // Clear event listeners
        this.cleanupEventListeners();

        // Clear large data structures
        if (window.trackCache) {
            window.trackCache.clear();
        }

        // Notify user
        if (window.showToast) {
            window.showToast('Memory cleanup performed', 'info');
        }
    }

    getReport() {
        const latest = this.samples[this.samples.length - 1];
        const oldest = this.samples[0];

        return {
            monitoring: this.monitoring,
            duration: latest ? (latest.timestamp - oldest.timestamp) / 1000 : 0,
            samples: this.samples.length,
            currentMemory: latest ? (latest.usedJSHeapSize / 1048576).toFixed(2) + ' MB' : 'N/A',
            memoryTrend: this.calculateTrend(),
            domNodes: latest ? latest.domNodes : 0,
            eventListeners: latest ? latest.listeners : 0,
            leaksDetected: this.leaks.length,
            lastLeak: this.leaks[this.leaks.length - 1] || null
        };
    }

    calculateTrend() {
        if (this.samples.length < 2) {
            return 'stable';
        }

        const recent = this.samples.slice(-10);
        const first = recent[0].usedJSHeapSize;
        const last = recent[recent.length - 1].usedJSHeapSize;
        const change = ((last - first) / first) * 100;

        if (change > 10) {
            return 'increasing';
        }
        if (change < -10) {
            return 'decreasing';
        }
        return 'stable';
    }

    reset() {
        this.samples = [];
        this.leaks = [];
    }
}

// Create global instance
window.memoryLeakDetector = new MemoryLeakDetector({
    enabled: true,
    interval: 10000,
    threshold: 30
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryLeakDetector;
}
