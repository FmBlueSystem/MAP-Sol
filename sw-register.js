/**
 * 🌐 SERVICE WORKER REGISTRATION
 * Registro y manejo de updates
 */

class ServiceWorkerManager {
    constructor() {
        this.registration = null;
        this.updateAvailable = false;
        this.init();
    }

    async init() {
        if (!('serviceWorker' in navigator)) {
            logWarn('Service Workers not supported');
            return;
        }

        try {
            // Registrar Service Worker
            this.registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            logInfo('✅ Service Worker registered:', this.registration.scope);

            // Setup event listeners
            this.setupEventListeners();

            // Check for updates
            this.checkForUpdates();

            // Setup periodic update check
            setInterval(() => this.checkForUpdates(), 60000); // Check every minute
        } catch (error) {
            logError('❌ Service Worker registration failed:', error);
        }
    }

    setupEventListeners() {
        // Listen for controllerchange
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            logInfo('🔄 New Service Worker activated');
            this.onControllerChange();
        });

        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', event => {
            this.handleSWMessage(event.data);
        });

        // Listen for update found
        this.registration.addEventListener('updatefound', () => {
            logDebug('🆕 New Service Worker found');
            this.onUpdateFound();
        });

        // Listen for state changes
        if (this.registration.installing) {
            this.trackInstalling(this.registration.installing);
        }

        if (this.registration.waiting) {
            this.onUpdateWaiting();
        }
    }

    trackInstalling(worker) {
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                this.onUpdateWaiting();
            }
        });
    }

    onUpdateFound() {
        const newWorker = this.registration.installing;

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.onUpdateWaiting();
            }
        });
    }

    onUpdateWaiting() {
        this.updateAvailable = true;
        this.showUpdatePrompt();
    }

    onControllerChange() {
        // Reload the page when SW takes control
        window.location.reload();
    }

    showUpdatePrompt() {
        // Create update notification
        const updateBanner = document.createElement('div');
        updateBanner.id = 'sw-update-banner';
        updateBanner.innerHTML = `
            <style>
                #sw-update-banner {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 16px 24px;
                    border-radius: 30px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 10000;
                    animation: slideUp 0.3s ease-out;
                }
                
                @keyframes slideUp {
                    from {
                        transform: translateX(-50%) translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
                
                #sw-update-banner button {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                #sw-update-banner button:hover {
                    transform: scale(1.05);
                }
                
                #sw-update-banner .close-btn {
                    background: transparent;
                    color: white;
                    padding: 4px;
                    font-size: 20px;
                }
            </style>
            <span>🎉</span>
            <span>New version available!</span>
            <button onclick="swManager.applyUpdate()">Update Now</button>
            <button class="close-btn" onclick="swManager.dismissUpdate()">×</button>
        ";

        document.body.appendChild(updateBanner);
    }

    async applyUpdate() {
        if (!this.registration.waiting) {
            return;
        }

        // Tell SW to skip waiting
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

        // Remove banner
        const banner = document.getElementById('sw-update-banner');
        if (banner) {
            banner.remove();
        }
    }

    dismissUpdate() {
        const banner = document.getElementById('sw-update-banner');
        if (banner) {
            banner.remove();
        }
    }

    async checkForUpdates() {
        if (!this.registration) {
            return;
        }

        try {
            await this.registration.update();
        } catch (error) {
            logError('Failed to check for updates:', error);
        }
    }

    handleSWMessage(data) {
        logDebug('Message from SW:', data);

        if (data.type === 'CACHE_STATUS') {
            this.updateCacheStatus(data.status);
        }
    }

    updateCacheStatus(status) {
        // Update UI with cache status
        const indicator = document.getElementById('cache-status');
        if (indicator) {
            indicator.textContent = `Cache: ${status.cached}/${status.total}`;
        }
    }

    // Public API
    async cacheArtwork(urls) {
        if (!navigator.serviceWorker.controller) {
            return;
        }

        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_ARTWORK',
            urls: urls
        });
    }

    async clearCache() {
        if (!('caches' in window)) {
            return;
        }

        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));

        logInfo('✅ All caches cleared');

        // Re-register to rebuild cache
        if (this.registration) {
            await this.registration.unregister();
            window.location.reload();
        }
    }

    getStatus() {
        return {
            supported: 'serviceWorker' in navigator,
            registered: !!this.registration,
            updateAvailable: this.updateAvailable,
            controller: !!navigator.serviceWorker.controller
        };
    }
}

// Initialize on load
const swManager = new ServiceWorkerManager();

// Expose to window for debugging
window.swManager = swManager;

logDebug('📱 Service Worker Manager initialized');
