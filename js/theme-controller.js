/**
 * 🌙 THEME CONTROLLER
 * Dark/Light mode management for Music Analyzer Pro
 */

class ThemeController {
    constructor(config = {}) {
        this.config = {
            defaultTheme: config.defaultTheme || 'system',
            storageKey: config.storageKey || 'music-analyzer-theme',
            transitionDuration: config.transitionDuration || 300,
            autoDetect: config.autoDetect !== false,
            cssVariables: config.cssVariables !== false,
            callback: config.callback || null
        };

        this.currentTheme = null;
        this.systemTheme = null;
        this.observers = [];

        this.init();
    }

    init() {

        // Detect system theme
        this.detectSystemTheme();

        // Load saved theme or use default
        const savedTheme = this.getSavedTheme();
        this.setTheme(savedTheme || this.config.defaultTheme, false);

        // Setup system theme listener
        if (this.config.autoDetect) {
            this.setupSystemThemeListener();
        }

        // Setup UI
        this.setupUI();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Apply CSS variables
        if (this.config.cssVariables) {
            this.updateCSSVariables();
        }
    }

    detectSystemTheme() {
        if (window.matchMedia) {
            this.systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            this.systemTheme = 'light';
        }
    }

    setupSystemThemeListener() {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Modern browsers
            if (darkModeQuery.addEventListener) {
                darkModeQuery.addEventListener('change', (e) => {
                    this.systemTheme = e.matches ? 'dark' : 'light';
                    if (this.currentTheme === 'system') {
                        this.applyTheme(this.systemTheme);
                    }
                });
            } 
            // Older browsers
            else if (darkModeQuery.addListener) {
                darkModeQuery.addListener((e) => {
                    this.systemTheme = e.matches ? 'dark' : 'light';
                    if (this.currentTheme === 'system') {
                        this.applyTheme(this.systemTheme);
                    }
                });
            }
        }
    }

    setupUI() {
        // Create theme toggle button
        this.createThemeToggle();

        // Create theme menu
        this.createThemeMenu();

        // Add transition styles
        this.addTransitionStyles();
    }

    createThemeToggle() {
        const existingToggle = document.getElementById('theme-toggle');
        if (existingToggle) {
            this.themeToggle = existingToggle;
        } else {
            this.themeToggle = document.createElement('button');
            this.themeToggle.id = 'theme-toggle';
            this.themeToggle.className = 'theme-toggle';
            this.themeToggle.setAttribute('aria-label', 'Toggle theme');
            this.themeToggle.innerHTML = this.getThemeIcon();

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .theme-toggle {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--theme-toggle-bg, rgba(255, 255, 255, 0.9));
                    border: 2px solid var(--theme-toggle-border, #e0e0e0);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    z-index: 1000;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .theme-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .theme-toggle:active {
                    transform: scale(0.95);
                }

                .theme-toggle svg {
                    width: 24px;
                    height: 24px;
                    transition: all 0.3s ease;
                }

                body.theme-transitioning * {
                    transition: background-color var(--transition-duration) ease,
                                color var(--transition-duration) ease,
                                border-color var(--transition-duration) ease,
                                box-shadow var(--transition-duration) ease !important;
                }
            `;
            document.head.appendChild(style);

            // Add to body
            document.body.appendChild(this.themeToggle);
        }

        // Add click handler
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    createThemeMenu() {
        const menu = document.createElement('div');
        menu.id = 'theme-menu';
        menu.className = 'theme-menu';
        menu.style.display = 'none';

        menu.innerHTML = `
            <style>
                .theme-menu {
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    background: var(--theme-menu-bg, white);
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    padding: 8px;
                    z-index: 999;
                    min-width: 150px;
                }

                .theme-option {
                    display: flex;
                    align-items: center;
                    padding: 10px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                    gap: 10px;
                }

                .theme-option:hover {
                    background: var(--theme-option-hover, rgba(0, 0, 0, 0.05));
                }

                .theme-option.active {
                    background: var(--theme-option-active, rgba(102, 126, 234, 0.1));
                    color: var(--theme-option-active-color, #667eea);
                }

                .theme-option svg {
                    width: 20px;
                    height: 20px;
                }
            </style>
            <div class="theme-option" data-theme="light">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <span>Light</span>
            </div>
            <div class="theme-option" data-theme="dark">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
                </svg>
                <span>Dark</span>
            </div>
            <div class="theme-option" data-theme="system">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
                </svg>
                <span>System</span>
            </div>
        ";

        document.body.appendChild(menu);
        this.themeMenu = menu;

        // Add click handlers
        menu.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.setTheme(theme);
                this.hideThemeMenu();
            });
        });

        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (!this.themeMenu.contains(e.target) && e.target !== this.themeToggle) {
                this.hideThemeMenu();
            }
        });
    }

    showThemeMenu() {
        this.themeMenu.style.display = 'block';
        this.updateThemeMenuActive();
    }

    hideThemeMenu() {
        this.themeMenu.style.display = 'none';
    }

    updateThemeMenuActive() {
        this.themeMenu.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === this.currentTheme);
        });
    }

    addTransitionStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --transition-duration: ${this.config.transitionDuration}ms;
            }
        `;
        document.head.appendChild(style);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + L for theme toggle
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    getThemeIcon() {
        const theme = this.getActiveTheme();

        if (theme === 'dark') {
            return `<svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
            </svg>";
        } else {
            return `<svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>
            </svg>";
        }
    }

    /**
     * THEME MANAGEMENT
     */
    setTheme(theme, animate = true) {
        if (!['light', 'dark', 'system'].includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }

        this.currentTheme = theme;
        this.saveTheme(theme);

        const activeTheme = this.getActiveTheme();

        if (animate) {
            document.body.classList.add('theme-transitioning');
            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, this.config.transitionDuration);
        }

        this.applyTheme(activeTheme);

        // Update UI
        if (this.themeToggle) {
            this.themeToggle.innerHTML = this.getThemeIcon();
        }

        // Callback
        if (this.config.callback) {
            this.config.callback(activeTheme, theme);
        }

        // Emit event
        const event = new CustomEvent('theme-changed', {
            detail: { theme: activeTheme, setting: theme }
        });
        document.dispatchEvent(event);
    }

    applyTheme(theme) {
        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark');

        // Add new theme class
        document.body.classList.add(`theme-${theme}`);

        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        }

        // Update CSS variables
        if (this.config.cssVariables) {
            this.updateCSSVariables(theme);
        }

        // Store active theme
        document.documentElement.setAttribute('data-theme', theme);
    }

    updateCSSVariables(theme = null) {
        theme = theme || this.getActiveTheme();

        const root = document.documentElement;
        const isDark = theme === 'dark';

        // Define theme variables
        const themes = {
            light: {
                // Primary colors
                '--primary': '#667eea',
                '--primary-dark': '#5a67d8',
                '--primary-light': '#7c8ef0',
                '--secondary': '#764ba2',
                '--accent': '#f093fb',

                // Background colors
                '--bg-primary': '#ffffff',
                '--bg-secondary': '#f7fafc',
                '--bg-tertiary': '#edf2f7',
                '--bg-card': '#ffffff',
                '--bg-hover': 'rgba(0, 0, 0, 0.04)',
                '--bg-active': 'rgba(0, 0, 0, 0.08)',

                // Text colors
                '--text-primary': '#2d3748',
                '--text-secondary': '#4a5568',
                '--text-tertiary': '#718096',
                '--text-muted': '#a0aec0',
                '--text-inverse': '#ffffff',

                // Border colors
                '--border-primary': '#e2e8f0',
                '--border-secondary': '#cbd5e0',
                '--border-focus': '#667eea',

                // Shadow colors
                '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.12)',
                '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
                '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
                '--shadow-xl': '0 20px 25px rgba(0, 0, 0, 0.1)',

                // Status colors
                '--success': '#48bb78',
                '--warning': '#ed8936',
                '--error': '#f56565',
                '--info': '#4299e1',

                // Component specific
                '--header-bg': 'rgba(255, 255, 255, 0.95)',
                '--sidebar-bg': '#f7fafc',
                '--modal-bg': 'rgba(0, 0, 0, 0.5)',
                '--tooltip-bg': '#2d3748',
                '--dropdown-bg': '#ffffff',

                // Theme toggle
                '--theme-toggle-bg': 'rgba(255, 255, 255, 0.9)',
                '--theme-toggle-border': '#e0e0e0',
                '--theme-menu-bg': '#ffffff',
                '--theme-option-hover': 'rgba(0, 0, 0, 0.05)',
                '--theme-option-active': 'rgba(102, 126, 234, 0.1)',
                '--theme-option-active-color': '#667eea'
            },
            dark: {
                // Primary colors
                '--primary': '#7c8ef0',
                '--primary-dark': '#667eea',
                '--primary-light': '#8e9ff5',
                '--secondary': '#9f7aca',
                '--accent': '#f093fb',

                // Background colors
                '--bg-primary': '#1a1a1a',
                '--bg-secondary': '#2d2d2d',
                '--bg-tertiary': '#404040',
                '--bg-card': '#262626',
                '--bg-hover': 'rgba(255, 255, 255, 0.08)',
                '--bg-active': 'rgba(255, 255, 255, 0.12)',

                // Text colors
                '--text-primary': '#f7fafc',
                '--text-secondary': '#e2e8f0',
                '--text-tertiary': '#cbd5e0',
                '--text-muted': '#718096',
                '--text-inverse': '#1a1a1a',

                // Border colors
                '--border-primary': '#404040',
                '--border-secondary': '#525252',
                '--border-focus': '#7c8ef0',

                // Shadow colors
                '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
                '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.3)',
                '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.3)',
                '--shadow-xl': '0 20px 25px rgba(0, 0, 0, 0.3)',

                // Status colors
                '--success': '#68d391',
                '--warning': '#f6ad55',
                '--error': '#fc8181',
                '--info': '#63b3ed',

                // Component specific
                '--header-bg': 'rgba(26, 26, 26, 0.95)',
                '--sidebar-bg': '#2d2d2d',
                '--modal-bg': 'rgba(0, 0, 0, 0.7)',
                '--tooltip-bg': '#f7fafc',
                '--dropdown-bg': '#262626',

                // Theme toggle
                '--theme-toggle-bg': 'rgba(45, 45, 45, 0.9)',
                '--theme-toggle-border': '#404040',
                '--theme-menu-bg': '#262626',
                '--theme-option-hover': 'rgba(255, 255, 255, 0.08)',
                '--theme-option-active': 'rgba(124, 142, 240, 0.2)',
                '--theme-option-active-color': '#7c8ef0'
            }
        };

        // Apply theme variables
        const selectedTheme = themes[theme] || themes.light;
        Object.entries(selectedTheme).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    }

    toggleTheme() {
        const themes = ['light', 'dark', 'system'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    }

    getActiveTheme() {
        if (this.currentTheme === 'system') {
            return this.systemTheme;
        }
        return this.currentTheme;
    }

    getSavedTheme() {
        try {
            return localStorage.getItem(this.config.storageKey);
        } catch (e) {
            console.warn('Failed to get saved theme:', e);
            return null;
        }
    }

    saveTheme(theme) {
        try {
            localStorage.setItem(this.config.storageKey, theme);
        } catch (e) {
            console.warn('Failed to save theme:', e);
        }
    }

    /**
     * PUBLIC API
     */
    getTheme() {
        return this.currentTheme;
    }

    isDark() {
        return this.getActiveTheme() === 'dark';
    }

    isLight() {
        return this.getActiveTheme() === 'light';
    }

    subscribe(callback) {
        const observer = { callback };
        this.observers.push(observer);

        // Return unsubscribe function
        return () => {
            const index = this.observers.indexOf(observer);
            if (index > -1) {
                this.observers.splice(index, 1);
            }
        };
    }

    destroy() {
        // Remove UI elements
        if (this.themeToggle && this.themeToggle.parentNode) {
            this.themeToggle.parentNode.removeChild(this.themeToggle);
        }
        if (this.themeMenu && this.themeMenu.parentNode) {
            this.themeMenu.parentNode.removeChild(this.themeMenu);
        }

        // Clear observers
        this.observers = [];
    }
}

// Initialize theme controller
const themeController = new ThemeController({
    defaultTheme: 'system',
    autoDetect: true,
    cssVariables: true,
    callback: (theme, setting) => {
        ');
    }
});

// Expose globally
window.themeController = themeController;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeController;
}

