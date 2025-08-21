/**
 * Enhanced Toast Notification System
 * Provides rich feedback during music import process
 */

class EnhancedToastNotifications {
    constructor() {
        this.toasts = new Map();
        this.container = null;
        this.init();
    }

    init() {
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.createContainer();
        }
        this.container = document.getElementById('toast-container');
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';

        const styles = `
            <style>
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 400px;
                }

                .toast {
                    background: rgba(30, 30, 45, 0.98);
                    backdrop-filter: blur(20px);
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    animation: slideIn 0.3s ease-out;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    min-width: 300px;
                }

                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                .toast.removing {
                    animation: slideOut 0.3s ease-in;
                    opacity: 0;
                }

                @keyframes slideOut {
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }

                .toast-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .toast-content {
                    flex: 1;
                    color: #fff;
                }

                .toast-title {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                }

                .toast-message {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.4;
                }

                .toast-progress {
                    margin-top: 8px;
                }

                .toast-progress-bar {
                    height: 3px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                    position: relative;
                }

                .toast-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    transition: width 0.3s ease;
                    border-radius: 2px;
                }

                .toast-eta {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.5);
                    margin-top: 4px;
                }

                .toast-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                }

                .toast-action {
                    padding: 6px 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    color: #fff;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .toast-action:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .toast-close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    font-size: 18px;
                    padding: 4px;
                    line-height: 1;
                }

                .toast-close:hover {
                    color: rgba(255, 255, 255, 0.8);
                }

                /* Toast types */
                .toast.success {
                    border-left: 4px solid #00b09b;
                }

                .toast.error {
                    border-left: 4px solid #ff4757;
                }

                .toast.warning {
                    border-left: 4px solid #ffa502;
                }

                .toast.info {
                    border-left: 4px solid #667eea;
                }

                .toast.progress {
                    border-left: 4px solid #764ba2;
                }

                /* Details section */
                .toast-details {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                }

                .toast-detail-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }

                .toast-detail-label {
                    font-weight: 500;
                }

                .toast-detail-value {
                    color: rgba(255, 255, 255, 0.9);
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(container);
    }

    /**
     * Show a simple toast notification
     */
    show(message, type = 'info', duration = 5000) {
        const id = Date.now().toString();
        const toast = this.createToast(id, message, type);

        this.toasts.set(id, toast);
        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    /**
     * Show a progress toast with live updates
     */
    showProgress(title, message, options = {}) {
        const id = options.id || Date.now().toString();

        const toast = this.createProgressToast(id, title, message, options);

        this.toasts.set(id, {
            element: toast,
            startTime: Date.now(),
            ...options,
        });

        this.container.appendChild(toast);

        return id;
    }

    /**
     * Update an existing progress toast
     */
    updateProgress(id, updates) {
        const toastData = this.toasts.get(id);
        if (!toastData) {
            return;
        }

        const toast = toastData.element;

        if (updates.message) {
            const messageEl = toast.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = updates.message;
            }
        }

        if (updates.progress !== undefined) {
            const progressFill = toast.querySelector('.toast-progress-fill');
            if (progressFill) {
                progressFill.style.width = `${updates.progress}%`;
            }
        }

        if (updates.eta) {
            const etaEl = toast.querySelector('.toast-eta');
            if (etaEl) {
                etaEl.textContent = `ETA: ${this.formatTime(updates.eta)}`;
            }
        }

        if (updates.details) {
            this.updateDetails(toast, updates.details);
        }
    }

    /**
     * Create a basic toast element
     */
    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.dataset.id = id;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            progress: '⏳',
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '📢'}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="window.toastNotifications.remove('${id}')">×</button>
        `;

        return toast;
    }

    /**
     * Create a progress toast with additional features
     */
    createProgressToast(id, title, message, options) {
        const toast = document.createElement('div');
        toast.className = 'toast progress';
        toast.dataset.id = id;

        let detailsHTML = '';
        if (options.details) {
            detailsHTML = this.createDetailsHTML(options.details);
        }

        let actionsHTML = '';
        if (options.actions) {
            actionsHTML = `
                <div class="toast-actions">
                    ${options.actions
                        .map(
                            (action) => `
                        <button class="toast-action" onclick="${action.onclick}">
                            ${action.label}
                        </button>
                    `
                        )
                        .join('')}
                </div>
            `;
        }

        toast.innerHTML = `
            <div class="toast-icon">${options.icon || '⏳'}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
                <div class="toast-progress">
                    <div class="toast-progress-bar">
                        <div class="toast-progress-fill" style="width: ${options.progress || 0}%"></div>
                    </div>
                    ${options.eta ? `<div class="toast-eta">ETA: ${this.formatTime(options.eta)}</div>` : ''}
                </div>
                ${detailsHTML}
                ${actionsHTML}
            </div>
            ${options.closable !== false ? `<button class="toast-close" onclick="window.toastNotifications.remove('${id}')">×</button>` : ''}
        `;

        return toast;
    }

    /**
     * Create details section HTML
     */
    createDetailsHTML(details) {
        return `
            <div class="toast-details">
                ${Object.entries(details)
                    .map(
                        ([label, value]) => `
                    <div class="toast-detail-item">
                        <span class="toast-detail-label">${label}:</span>
                        <span class="toast-detail-value">${value}</span>
                    </div>
                `
                    )
                    .join('')}
            </div>
        `;
    }

    /**
     * Update details in an existing toast
     */
    updateDetails(toast, details) {
        let detailsEl = toast.querySelector('.toast-details');

        if (!detailsEl && Object.keys(details).length > 0) {
            detailsEl = document.createElement('div');
            detailsEl.className = 'toast-details';
            toast.querySelector('.toast-content').appendChild(detailsEl);
        }

        if (detailsEl) {
            detailsEl.innerHTML = Object.entries(details)
                .map(
                    ([label, value]) => `
                <div class="toast-detail-item">
                    <span class="toast-detail-label">${label}:</span>
                    <span class="toast-detail-value">${value}</span>
                </div>
            `
                )
                .join('');
        }
    }

    /**
     * Remove a toast
     */
    remove(id) {
        const toastData = this.toasts.get(id);
        if (!toastData) {
            return;
        }

        const element = toastData.element || toastData;
        element.classList.add('removing');

        setTimeout(() => {
            element.remove();
            this.toasts.delete(id);
        }, 300);
    }

    /**
     * Clear all toasts
     */
    clearAll() {
        this.toasts.forEach((_, id) => this.remove(id));
    }

    /**
     * Format time in seconds to human readable
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${mins}m ${secs}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        }
    }

    /**
     * Show import-specific notifications
     */
    showImportStage(stage, fileName, progress = 0) {
        const stages = {
            metadata: { icon: '📖', title: 'Reading Metadata', message: `Extracting metadata from ${fileName}` },
            hamms: { icon: '🎯', title: 'HAMMS Analysis', message: 'Calculating 7D similarity vector' },
            essentia: { icon: '🔬', title: 'Audio Analysis', message: 'Analyzing audio features with Essentia' },
            ai: { icon: '🤖', title: 'AI Enrichment', message: 'Enhancing with GPT-4 analysis' },
            database: { icon: '💾', title: 'Saving', message: 'Storing in database' },
            artwork: { icon: '🎨', title: 'Artwork', message: 'Extracting album artwork' },
            complete: { icon: '✅', title: 'Complete', message: `${fileName} imported successfully!` },
        };

        const stageInfo = stages[stage];
        if (!stageInfo) {
            return;
        }

        if (stage === 'complete') {
            return this.show(stageInfo.message, 'success', 3000);
        }

        return this.showProgress(stageInfo.title, stageInfo.message, {
            icon: stageInfo.icon,
            progress: progress,
            closable: false,
        });
    }
}

// Create global instance
window.toastNotifications = new EnhancedToastNotifications();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedToastNotifications;
}
