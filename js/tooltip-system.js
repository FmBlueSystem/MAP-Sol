// Professional Tooltip System for Music Analyzer Pro
class TooltipSystem {
    constructor() {
        this.tooltip = null;
        this.currentTarget = null;
        this.hideTimeout = null;
        this.showTimeout = null;
        this.init();
    }

    init() {
        // Create tooltip element
        this.createTooltipElement();

        // Attach global event listeners
        this.attachEventListeners();

        // Initialize all existing tooltips
        this.initializeTooltips();
    }

    createTooltipElement() {
        // Remove existing tooltip if any
        const existing = document.getElementById('tooltip-container');
        if (existing) {
            existing.remove();
        }

        // Create new tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'tooltip-container';
        this.tooltip.className = 'tooltip-container';
        this.tooltip.innerHTML = `
            <div class="tooltip-content">
                <span class="tooltip-text"></span>
                <span class="tooltip-shortcut"></span>
            </div>
            <div class="tooltip-arrow"></div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .tooltip-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease, transform 0.2s ease;
                transform: translateY(5px);
            }
            
            .tooltip-container.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .tooltip-content {
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                color: #e0e0e0;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                white-space: nowrap;
                max-width: 250px;
            }
            
            .tooltip-text {
                display: block;
                font-weight: 500;
            }
            
            .tooltip-shortcut {
                display: block;
                margin-top: 4px;
                color: #1db954;
                font-size: 11px;
                font-weight: 600;
                font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            }
            
            .tooltip-shortcut:empty {
                display: none;
            }
            
            .tooltip-arrow {
                position: absolute;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 6px 6px 0 6px;
                border-color: #1a1a1a transparent transparent transparent;
                left: 50%;
                transform: translateX(-50%);
                bottom: -6px;
            }
            
            .tooltip-container.tooltip-bottom .tooltip-arrow {
                top: -6px;
                bottom: auto;
                border-width: 0 6px 6px 6px;
                border-color: transparent transparent #2a2a2a transparent;
            }
            
            /* Special styles for different tooltip types */
            .tooltip-container.tooltip-error .tooltip-content {
                background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                color: white;
            }
            
            .tooltip-container.tooltip-success .tooltip-content {
                background: linear-gradient(135deg, #1db954 0%, #169c46 100%);
                color: white;
            }
            
            .tooltip-container.tooltip-info .tooltip-content {
                background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
                color: white;
            }
            
            .tooltip-container.tooltip-warning .tooltip-content {
                background: linear-gradient(135deg, #ffa726 0%, #f57c00 100%);
                color: white;
            }
            
            /* Animated pulse for important tooltips */
            @keyframes tooltip-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3), 0 0 0 1px rgba(29, 185, 84, 0.3); }
                50% { box-shadow: 0 4px 20px rgba(29, 185, 84, 0.5), 0 0 0 2px rgba(29, 185, 84, 0.5); }
            }
            
            .tooltip-container.tooltip-pulse .tooltip-content {
                animation: tooltip-pulse 2s infinite;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.tooltip);
    }

    attachEventListeners() {
        // Use event delegation for better performance
        document.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
        document.addEventListener('click', this.handleClick.bind(this), true);

        // Hide tooltip on scroll
        window.addEventListener('scroll', () => this.hide(), true);
    }

    handleMouseEnter(e) {
        if (!e.target || typeof e.target.closest !== 'function') {
            return;
        }
        const target = e.target.closest('[data-tooltip]');
        if (!target) {
            return;
        }

        // Clear any existing timeouts
        clearTimeout(this.hideTimeout);
        clearTimeout(this.showTimeout);

        // Show tooltip after a short delay
        this.showTimeout = setTimeout(() => {
            this.show(target);
        }, 500); // 500ms delay before showing
    }

    handleMouseLeave(e) {
        if (!e.target || typeof e.target.closest !== 'function') {
            return;
        }
        const target = e.target.closest('[data-tooltip]');
        if (!target) {
            return;
        }

        // Clear show timeout if leaving before tooltip appears
        clearTimeout(this.showTimeout);

        // Hide tooltip after a short delay
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, 100);
    }

    handleClick(e) {
        // Hide tooltip on click
        this.hide();
    }

    show(element) {
        if (!element || !element.dataset.tooltip) {
            return;
        }

        this.currentTarget = element;

        // Set tooltip content
        const textElement = this.tooltip.querySelector('.tooltip-text');
        const shortcutElement = this.tooltip.querySelector('.tooltip-shortcut');

        textElement.textContent = element.dataset.tooltip;
        shortcutElement.textContent = element.dataset.shortcut || '';

        // Set tooltip type
        this.tooltip.className = 'tooltip-container';
        if (element.dataset.tooltipType) {
            this.tooltip.classList.add(`tooltip-${element.dataset.tooltipType}`);
        }

        // Position tooltip
        this.position(element);

        // Show tooltip
        requestAnimationFrame(() => {
            this.tooltip.classList.add('visible');
        });
    }

    hide() {
        clearTimeout(this.showTimeout);
        clearTimeout(this.hideTimeout);
        this.tooltip.classList.remove('visible');
        this.currentTarget = null;
    }

    position(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        // Calculate position
        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

        // Check if tooltip goes above viewport
        if (top < 10) {
            top = rect.bottom + 10;
            this.tooltip.classList.add('tooltip-bottom');
        } else {
            this.tooltip.classList.remove('tooltip-bottom');
        }

        // Check horizontal boundaries
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Apply position
        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    initializeTooltips() {
        // Define tooltip data for all elements
        const tooltipData = {
            // Player controls
            '#btn-play': {
                tooltip: 'Play / Pause',
                shortcut: 'Spacebar',
            },
            '#btn-prev': {
                tooltip: 'Previous Track',
                shortcut: '← Arrow',
            },
            '#btn-next': {
                tooltip: 'Next Track',
                shortcut: '→ Arrow',
            },
            '#btn-mute': {
                tooltip: 'Toggle Mute',
                shortcut: 'M',
            },
            '#volume-bar': {
                tooltip: 'Adjust Volume',
                shortcut: '↑/↓ Arrows',
            },
            '#seek-bar': {
                tooltip: 'Seek Position',
                shortcut: 'Click or drag',
            },
            '#btn-queue': {
                tooltip: 'Show Queue',
                shortcut: 'Q',
            },
            '#btn-vu-mode': {
                tooltip: 'Toggle VU Meter Mode',
                shortcut: 'V',
            },

            // Track info
            '#player-title': {
                tooltip: 'Track Title',
                shortcut: 'Click to copy',
            },
            '#player-artist': {
                tooltip: 'Artist Name',
                shortcut: 'Click to search',
            },
            '#player-album': {
                tooltip: 'Album Name',
                shortcut: 'Click for details',
            },
            '#player-bpm': {
                tooltip: 'Beats Per Minute',
                shortcut: 'AI analyzed',
            },
            '#player-key': {
                tooltip: 'Musical Key',
                shortcut: 'Camelot notation',
            },
            '#player-energy': {
                tooltip: 'Energy Level',
                shortcut: '0-100 scale',
            },
            '#player-mood': {
                tooltip: 'Track Mood',
                shortcut: 'AI detected',
            },

            // VU Meter
            '#vu-meter-canvas': {
                tooltip: 'Audio Level Meter',
                shortcut: 'dB scale: -60 to +6',
            },
            '.spectrum-visualizer': {
                tooltip: 'Frequency Spectrum',
                shortcut: '32 bands',
            },

            // Time displays
            '#time-current': {
                tooltip: 'Current Position',
            },
            '#time-total': {
                tooltip: 'Track Duration',
            },

            // Queue
            '#btn-clear-queue': {
                tooltip: 'Clear Queue',
                shortcut: 'Removes all tracks',
            },
            '#queue-count': {
                tooltip: 'Tracks in Queue',
            },

            // Additional controls
            '.player-artwork': {
                tooltip: 'Album Artwork',
                shortcut: 'Click to enlarge',
            },
            '.vu-meter-label': {
                tooltip: 'VU Meter',
                shortcut: 'Professional audio levels',
            },
        };

        // Apply tooltips to elements
        Object.entries(tooltipData).forEach(([selector, data]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element) => {
                if (data.tooltip) {
                    element.dataset.tooltip = data.tooltip;
                }
                if (data.shortcut) {
                    element.dataset.shortcut = data.shortcut;
                }
                if (data.type) {
                    element.dataset.tooltipType = data.type;
                }
            });
        });
    }

    // Public method to add tooltip to element programmatically
    addTooltip(element, text, shortcut = '', type = '') {
        if (!element) {
            return;
        }

        element.dataset.tooltip = text;
        if (shortcut) {
            element.dataset.shortcut = shortcut;
        }
        if (type) {
            element.dataset.tooltipType = type;
        }
    }

    // Public method to update tooltip text
    updateTooltip(element, text, shortcut = '') {
        if (!element) {
            return;
        }

        element.dataset.tooltip = text;
        if (shortcut !== undefined) {
            element.dataset.shortcut = shortcut;
        }

        // Update immediately if this tooltip is currently showing
        if (this.currentTarget === element && this.tooltip.classList.contains('visible')) {
            const textElement = this.tooltip.querySelector('.tooltip-text');
            const shortcutElement = this.tooltip.querySelector('.tooltip-shortcut');

            textElement.textContent = text;
            shortcutElement.textContent = shortcut || '';
        }
    }

    // Show tooltip immediately (for important messages)
    showImmediate(element, text, shortcut = '', type = '', duration = 3000) {
        this.addTooltip(element, text, shortcut, type);
        this.show(element);

        if (duration > 0) {
            setTimeout(() => this.hide(), duration);
        }
    }
}

// Initialize tooltip system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.tooltipSystem = new TooltipSystem();
    });
} else {
    window.tooltipSystem = new TooltipSystem();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TooltipSystem;
}
