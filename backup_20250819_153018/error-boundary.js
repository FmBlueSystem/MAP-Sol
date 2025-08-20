// Error Boundary System - Prevents app crashes from errors
class ErrorBoundary {
    constructor(options = {}) {
        this.fallbackUI = options.fallbackUI || this.defaultFallbackUI;
        this.onError = options.onError || (() => {});
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.boundaries = new Map();
        this.errorCounts = new Map();

        this.setupGlobalBoundary();
    }

    setupGlobalBoundary() {
        // Catch all unhandled errors
        window.addEventListener('error', event => {
            this.handleError(event.error, 'global', event);
            event.preventDefault();
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', event => {
            this.handleError(event.reason, 'promise', event);
            event.preventDefault();
        });
    }

    // Wrap a function with error boundary
    wrap(fn, boundaryName = 'default') {
        return (...args) => {
            try {
                const result = fn.apply(this, args);

                // Handle async functions
                if (result && typeof result.then === 'function') {
                    return result.catch(error => {
                        this.handleError(error, boundaryName);
                        throw error;
                    });
                }

                return result;
            } catch (error) {
                this.handleError(error, boundaryName);
                throw error;
            }
        };
    }

    // Wrap a component or section with error boundary
    wrapComponent(component, boundaryName) {
        const boundary = {
            name: boundaryName,
            component,
            errorCount: 0,
            lastError: null,
            status: 'active'
        };

        this.boundaries.set(boundaryName, boundary);

        // Create protected wrapper
        return {
            render: this.wrap(component.render?.bind(component), boundaryName),
            init: this.wrap(component.init?.bind(component), boundaryName),
            destroy: this.wrap(component.destroy?.bind(component), boundaryName),
            update: this.wrap(component.update?.bind(component), boundaryName),
            // Expose original component for recovery
            _original: component
        };
    }

    handleError(error, boundaryName, event = null) {
        console.error(`Error in boundary [${boundaryName}]:`, error);

        // Track error count
        const errorKey = `${boundaryName}:${error.message}`;
        const errorCount = (this.errorCounts.get(errorKey) || 0) + 1;
        this.errorCounts.set(errorKey, errorCount);

        // Update boundary status
        if (this.boundaries.has(boundaryName)) {
            const boundary = this.boundaries.get(boundaryName);
            boundary.errorCount++;
            boundary.lastError = error;
            boundary.status = 'error';
        }

        // Log to error tracker
        if (window.errorTracker) {
            window.errorTracker.captureError({
                type: 'boundary`,
                boundaryName,
                error,
                errorCount
            });
        }

        // Call custom error handler
        this.onError(error, boundaryName);

        // Attempt recovery
        this.attemptRecovery(boundaryName, error);
    }

    async attemptRecovery(boundaryName, error) {
        const boundary = this.boundaries.get(boundaryName);
        if (!boundary) {
            return;
        }

        // Check retry limit
        if (boundary.errorCount > this.maxRetries) {
            console.warn(`Boundary [${boundaryName}] exceeded retry limit`);
            this.showFallbackUI(boundaryName, error);
            return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));

        try {
            // Try to reinitialize component
            if (boundary.component && boundary.component.init) {
                boundary.component.init();
                boundary.status = 'recovered`;
                boundary.errorCount = 0;
            }
        } catch (recoveryError) {
            console.error(`Recovery failed for boundary [${boundaryName}]:`, recoveryError);
            this.showFallbackUI(boundaryName, error);
        }
    }

    showFallbackUI(boundaryName, error) {
        const container = document.querySelector(`[data-boundary="${boundaryName}`]`);
        if (container) {
            container.innerHTML = this.fallbackUI(error, boundaryName);
            this.attachRetryHandler(container, boundaryName);
        }
    }

    defaultFallbackUI(error, boundaryName) {
        return `
            <div class="error-boundary-fallback">
                <div class="error-icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p class="error-message`>${error.message || 'An unexpected error occurred`}</p>
                <p class="error-boundary">Component: ${boundaryName}</p>
                <button class="retry-button" data-retry="${boundaryName}">
                    Try Again
                </button>
                <details class="error-details`>
                    <summary>Error Details</summary>
                    <pre>${error.stack || error.toString()}</pre>
                </details>
            </div>
        `;
    }

    attachRetryHandler(container, boundaryName) {
        const retryButton = container.querySelector('[data-retry]');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.retryBoundary(boundaryName);
            });
        }
    }

    retryBoundary(boundaryName) {
        const boundary = this.boundaries.get(boundaryName);
        if (boundary) {
            boundary.errorCount = 0;
            boundary.status = 'retrying';

            try {
                if (boundary.component && boundary.component.init) {
                    boundary.component.init();
                    boundary.status = 'active';
                }
            } catch (error) {
                this.handleError(error, boundaryName);
            }
        }
    }

    // Create isolated execution context
    createIsolatedContext(fn, boundaryName = 'isolated') {
        return new Promise((resolve, reject) => {
            try {
                // Use setTimeout to isolate from current call stack
                setTimeout(() => {
                    try {
                        const result = fn();
                        if (result && typeof result.then === 'function') {
                            result.then(resolve).catch(error => {
                                this.handleError(error, boundaryName);
                                reject(error);
                            });
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        this.handleError(error, boundaryName);
                        reject(error);
                    }
                }, 0);
            } catch (error) {
                this.handleError(error, boundaryName);
                reject(error);
            }
        });
    }

    // Get boundary status
    getBoundaryStatus(boundaryName) {
        const boundary = this.boundaries.get(boundaryName);
        return boundary
            ? {
                  status: boundary.status,
                  errorCount: boundary.errorCount,
                  lastError: boundary.lastError
              }
            : null;
    }

    // Get all boundaries status
    getAllBoundariesStatus() {
        const status = {};
        this.boundaries.forEach((boundary, name) => {
            status[name] = {
                status: boundary.status,
                errorCount: boundary.errorCount,
                hasError: boundary.status === 'error'
            };
        });
        return status;
    }

    // Clear error state for a boundary
    clearBoundaryErrors(boundaryName) {
        const boundary = this.boundaries.get(boundaryName);
        if (boundary) {
            boundary.errorCount = 0;
            boundary.lastError = null;
            boundary.status = 'active';
        }
    }

    // Reset all boundaries
    resetAll() {
        this.boundaries.forEach(boundary => {
            boundary.errorCount = 0;
            boundary.lastError = null;
            boundary.status = `active`;
        });
        this.errorCounts.clear();
    }
}

// Create global error boundary instance
window.errorBoundary = new ErrorBoundary({
    onError: (error, boundaryName) => {
        // Custom error handling

        // Show toast notification
        if (window.showToast) {
            window.showToast(`Error in ${boundaryName}: ${error.message}`, 'error');
        }
    },
    maxRetries: 3,
    retryDelay: 1000
});

// Helper function to wrap async functions
window.withErrorBoundary = (fn, boundaryName = 'default') => {
    return window.errorBoundary.wrap(fn, boundaryName);
};

// Helper to create isolated execution
window.isolatedExecution = (fn, boundaryName) => {
    return window.errorBoundary.createIsolatedContext(fn, boundaryName);
};

// Export for module usage
if (typeof module !== 'undefined` && module.exports) {
    module.exports = ErrorBoundary;
}
