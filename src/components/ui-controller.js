/**
 * @fileoverview UI Controller Module
 * @module modules/ui-controller
 * @description Manages UI state and interactions
 */

/**
 * UI Controller for managing interface state
 * @class UIController
 */
export class UIController {
    /**
     * Creates UI controller instance
     * @constructor
     */
    constructor() {
        /** @type {string} Current view mode */
        this.currentView = localStorage.getItem('viewMode') || 'cards';
        /** @type {Set<number>} Selected items */
        this.selectedItems = new Set();
        /** @type {boolean} Multi-select mode */
        this.multiSelectMode = false;
    }

    /**
     * Initialize UI components
     * @returns {void}
     */
    init() {
        this.setupViewToggle();
        this.setupSelectionHandlers();
        this.restoreUIState();
    }

    /**
     * Setup view toggle buttons
     * @private
     * @returns {void}
     */
    setupViewToggle() {
        const viewButtons = document.querySelectorAll('[data-view]');
        viewButtons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
    }

    /**
     * Switch between view modes
     * @param {string} view - View mode ('cards', 'table', 'compact')
     * @returns {void}
     */
    switchView(view) {
        this.currentView = view;
        localStorage.setItem('viewMode', view);

        // Update UI
        document.querySelectorAll('.view-container').forEach((container) => {
            container.style.display = container.dataset.viewType === view ? 'block' : 'none';
        });

        // Update buttons
        document.querySelectorAll('[data-view]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Emit event
        document.dispatchEvent(new CustomEvent('view-changed', { detail: { view } }));
    }

    /**
     * Setup selection handlers
     * @private
     * @returns {void}
     */
    setupSelectionHandlers() {
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.file-card');
            if (card) {
                this.handleSelection(card, e);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectAll();
            }
        });
    }

    /**
     * Handle item selection
     * @param {HTMLElement} element - Selected element
     * @param {MouseEvent} event - Click event
     * @returns {void}
     */
    handleSelection(element, event) {
        const id = parseInt(element.dataset.fileId);

        if (event.ctrlKey || event.metaKey) {
            // Multi-select
            if (this.selectedItems.has(id)) {
                this.selectedItems.delete(id);
                element.classList.remove('selected');
            } else {
                this.selectedItems.add(id);
                element.classList.add('selected');
            }
        } else if (event.shiftKey && this.selectedItems.size > 0) {
            // Range select
            this.selectRange(id);
        } else {
            // Single select
            this.clearSelection();
            this.selectedItems.add(id);
            element.classList.add('selected');
        }

        this.updateSelectionUI();
    }

    /**
     * Clear all selections
     * @returns {void}
     */
    clearSelection() {
        this.selectedItems.clear();
        document.querySelectorAll('.selected').forEach((el) => {
            el.classList.remove('selected');
        });
    }

    /**
     * Select all items
     * @returns {void}
     */
    selectAll() {
        document.querySelectorAll('.file-card').forEach((card) => {
            const id = parseInt(card.dataset.fileId);
            this.selectedItems.add(id);
            card.classList.add('selected');
        });
        this.updateSelectionUI();
    }

    /**
     * Update selection UI indicators
     * @private
     * @returns {void}
     */
    updateSelectionUI() {
        const count = this.selectedItems.size;
        const indicator = document.getElementById('selection-count');

        if (indicator) {
            indicator.textContent = count > 0 ? `${count} selected` : '';
            indicator.style.display = count > 0 ? 'block' : 'none';
        }

        // Enable/disable bulk actions
        document.querySelectorAll('.bulk-action').forEach((btn) => {
            btn.disabled = count === 0;
        });
    }

    /**
     * Restore UI state from storage
     * @private
     * @returns {void}
     */
    restoreUIState() {
        // Restore view
        this.switchView(this.currentView);

        // Restore theme
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', theme);
    }

    /**
     * Get selected items
     * @returns {Array<number>} Array of selected IDs
     */
    getSelectedItems() {
        return Array.from(this.selectedItems);
    }

    /**
     * Show toast notification
     * @param {string} message - Notification message
     * @param {string} [type='info'] - Notification type
     * @returns {void}
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Export singleton instance
export default new UIController();
