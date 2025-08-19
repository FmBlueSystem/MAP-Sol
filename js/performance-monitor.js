// Performance Monitor - Real-time performance tracking
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: [],
            memory: [],
            loadTimes: {},
            apiCalls: {},
            renderTimes: [],
            errors: []
        };
        this.observers = new Map();
        this.isMonitoring = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;

        // Start monitoring if enabled
        if (window.APP_CONFIG?.features?.performanceMonitoring) {
            this.startMonitoring();
        }
    }

    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;

        // FPS monitoring
        this.monitorFPS();

        // Memory monitoring
        this.monitorMemory();

        // Performance observer for navigation and resource timing
        this.setupPerformanceObserver();

        // Long task detection
        this.detectLongTasks();
    }

    stopMonitoring() {
        this.isMonitoring = false;
        if (this.fpsAnimationId) {
            cancelAnimationFrame(this.fpsAnimationId);
        }
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }

    monitorFPS() {
        const measureFPS = () => {
            if (!this.isMonitoring) {
                return;
            }

            const now = performance.now();
            const delta = now - this.lastFrameTime;
            this.lastFrameTime = now;

            if (delta > 0) {
                const fps = Math.round(1000 / delta);
                this.metrics.fps.push({
                    value: fps,
                    timestamp: now
                });

                // Keep only last 60 samples
                if (this.metrics.fps.length > 60) {
                    this.metrics.fps.shift();
                }

                // Warn if FPS drops below 30
                if (fps < 30 && this.frameCount > 60) {
                    console.warn(`⚠️ Low FPS detected: ${fps}`);
                }
            }

            this.frameCount++;
            this.fpsAnimationId = requestAnimationFrame(measureFPS);
        };

        this.fpsAnimationId = requestAnimationFrame(measureFPS);
    }

    monitorMemory() {
        if (!performance.memory) {
            return;
        }

        this.memoryInterval = setInterval(() => {
            if (!this.isMonitoring) {
                return;
            }

            const memInfo = {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576), // MB
                timestamp: Date.now()
            };

            this.metrics.memory.push(memInfo);

            // Keep only last 100 samples
            if (this.metrics.memory.length > 100) {
                this.metrics.memory.shift();
            }

            // Warn if memory usage is high
            const usagePercent = (memInfo.used / memInfo.limit) * 100;
            if (usagePercent > 80) {
                console.warn(`⚠️ High memory usage: ${usagePercent.toFixed(1)}%`);
                this.triggerMemoryCleanup();
            }
        }, 5000); // Check every 5 seconds
    }

    setupPerformanceObserver() {
        // Navigation timing
        if ('PerformanceObserver' in window) {
            try {
                const navObserver = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'navigation') {
                            this.metrics.loadTimes.page = {
                                dns: entry.domainLookupEnd - entry.domainLookupStart,
                                tcp: entry.connectEnd - entry.connectStart,
                                request: entry.responseStart - entry.requestStart,
                                response: entry.responseEnd - entry.responseStart,
                                dom: entry.domComplete - entry.domInteractive,
                                load: entry.loadEventEnd - entry.loadEventStart,
                                total: entry.loadEventEnd - entry.fetchStart
                            };
                        }
                    }
                });
                navObserver.observe({ entryTypes: ['navigation'] });
                this.observers.set('navigation', navObserver);
            } catch (e) {}

            // Resource timing
            try {
                const resourceObserver = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'resource') {
                            const type = entry.name.split('.').pop()?.toLowerCase() || 'other';
                            if (!this.metrics.loadTimes[type]) {
                                this.metrics.loadTimes[type] = [];
                            }
                            this.metrics.loadTimes[type].push({
                                name: entry.name,
                                duration: entry.duration,
                                size: entry.transferSize || 0
                            });
                        }
                    }
                });
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.observers.set('resource', resourceObserver);
            } catch (e) {}
        }
    }

    detectLongTasks() {
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver(list => {
                    for (const entry of list.getEntries()) {
                        console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
                        this.metrics.renderTimes.push({
                            duration: entry.duration,
                            timestamp: entry.startTime,
                            type: 'longTask'
                        });
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longtask', longTaskObserver);
            } catch (e) {}
        }
    }

    triggerMemoryCleanup() {
        // Clear caches
        if (window.performanceOptimizer) {
            window.performanceOptimizer.clearCache();
        }

        // Clear unused DOM nodes
        if (window.memoryManager) {
            window.memoryManager.cleanup();
        }

        // Force garbage collection if available (Chrome with --expose-gc flag)
        if (window.gc) {
            window.gc();
        }
    }

    // API call tracking
    trackAPICall(endpoint, duration, success = true) {
        if (!this.metrics.apiCalls[endpoint]) {
            this.metrics.apiCalls[endpoint] = {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                failures: 0
            };
        }

        const metric = this.metrics.apiCalls[endpoint];
        metric.count++;
        metric.totalDuration += duration;
        metric.avgDuration = metric.totalDuration / metric.count;

        if (!success) {
            metric.failures++;
        }

        // Warn if API is slow
        if (duration > 1000) {
            console.warn(`⚠️ Slow API call to ${endpoint}: ${duration.toFixed(2)}ms`);
        }
    }

    // Log errors for correlation
    logError(error) {
        this.metrics.errors.push({
            ...error,
            memoryAtError: this.getCurrentMemory(),
            fpsAtError: this.getCurrentFPS()
        });

        // Keep only last 50 errors
        if (this.metrics.errors.length > 50) {
            this.metrics.errors.shift();
        }
    }

    // Get current metrics
    getCurrentFPS() {
        if (this.metrics.fps.length === 0) {
            return 60;
        }
        return this.metrics.fps[this.metrics.fps.length - 1].value;
    }

    getCurrentMemory() {
        if (this.metrics.memory.length === 0) {
            return null;
        }
        return this.metrics.memory[this.metrics.memory.length - 1];
    }

    getAverageFPS() {
        if (this.metrics.fps.length === 0) {
            return 60;
        }
        const sum = this.metrics.fps.reduce((acc, f) => acc + f.value, 0);
        return Math.round(sum / this.metrics.fps.length);
    }

    getMetrics() {
        return {
            fps: {
                current: this.getCurrentFPS(),
                average: this.getAverageFPS(),
                min: Math.min(...this.metrics.fps.map(f => f.value)),
                max: Math.max(...this.metrics.fps.map(f => f.value))
            },
            memory: this.getCurrentMemory(),
            loadTimes: this.metrics.loadTimes,
            apiCalls: this.metrics.apiCalls,
            longTasks: this.metrics.renderTimes.filter(t => t.type === 'longTask').length,
            errors: this.metrics.errors.length
        };
    }

    // Generate performance report
    generateReport() {
        const metrics = this.getMetrics();
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                fps: `${metrics.fps.average} FPS (${metrics.fps.min}-${metrics.fps.max})`,
                memory: metrics.memory
                    ? `${metrics.memory.used}/${metrics.memory.limit} MB`
                    : 'N/A',
                longTasks: metrics.longTasks,
                errors: metrics.errors
            },
            details: metrics,
            recommendations: this.getRecommendations(metrics)
        };

        return report;
    }

    getRecommendations(metrics) {
        const recommendations = [];

        if (metrics.fps.average < 30) {
            recommendations.push('Low FPS detected. Consider reducing animations or DOM updates.');
        }

        if (metrics.memory && metrics.memory.used > metrics.memory.limit * 0.8) {
            recommendations.push(
                'High memory usage. Consider clearing caches or reducing data retention.'
            );
        }

        if (metrics.longTasks > 5) {
            recommendations.push(
                'Multiple long tasks detected. Consider breaking up heavy computations.'
            );
        }

        if (metrics.errors > 10) {
            recommendations.push('High error rate detected. Review error logs for patterns.');
        }

        return recommendations;
    }
}

// Create global instance
window.performanceMonitor = new PerformanceMonitor();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}
