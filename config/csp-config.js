/**
 * Content Security Policy Configuration
 * Protects against XSS, injection attacks, and other vulnerabilities
 */

class CSPConfig {
    constructor() {
        this.policies = {
            // Production CSP - Restrictive
            production: {
                'default-src': ["'self'"],
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"], // Required for dynamic styles
                'img-src': ["'self'", 'data:', 'file:', 'blob:'],
                'media-src': ["'self'", 'file:', 'blob:'],
                'font-src': ["'self'", 'data:'],
                'connect-src': ["'self'"],
                'frame-src': ["'none'"],
                'object-src': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"],
                'frame-ancestors': ["'none'"],
                'upgrade-insecure-requests': [],
            },

            // Development CSP - More permissive
            development: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow eval for dev tools
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'file:', 'blob:', 'http:', 'https:'],
                'media-src': ["'self'", 'file:', 'blob:'],
                'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
                'connect-src': ["'self'", 'https://api.openai.com', 'https://fonts.googleapis.com', 'ws:', 'wss:'],
                'frame-src': ["'none'"],
                'object-src': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"],
            }
        };

        this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    }

    /**
     * Get CSP header string for current environment
     */
    getCSPHeader() {
        const policy = this.policies[this.environment];
        const directives = [];

        for (const [directive, values] of Object.entries(policy)) {
            if (values.length === 0) {
                directives.push(directive);
            } else {
                directives.push(`${directive} ${values.join(' ')}`);
            }
        }

        return directives.join('; ');
    }

    /**
     * Apply CSP to Electron window
     */
    applyToWindow(window) {
        window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [this.getCSPHeader()],
                    'X-Content-Type-Options': ['nosniff'],
                    'X-Frame-Options': ['DENY'],
                    'X-XSS-Protection': ['1; mode=block'],
                    'Referrer-Policy': ['strict-origin-when-cross-origin'],
                }
            });
        });
    }

    /**
     * Log CSP violations for debugging
     */
    enableViolationReporting(window) {
        window.webContents.on('console-message', (event, level, message) => {
            if (message.includes('Content Security Policy')) {
                console.warn('CSP Violation:', message);

                // Log to file in development
                if (this.environment === 'development') {
                    const fs = require('fs');
                    const path = require('path');
                    const logPath = path.join(__dirname, '..', 'csp-violations.log');
                    const timestamp = new Date().toISOString();
                    fs.appendFileSync(logPath, `${timestamp}: ${message}\n`);
                }
            }
        });
    }

    /**
     * Update CSP for specific needs
     */
    addSource(directive, source) {
        const policy = this.policies[this.environment];
        if (!policy[directive]) {
            policy[directive] = [];
        }
        if (!policy[directive].includes(source)) {
            policy[directive].push(source);
        }
    }

    /**
     * Remove CSP source
     */
    removeSource(directive, source) {
        const policy = this.policies[this.environment];
        if (policy[directive]) {
            const index = policy[directive].indexOf(source);
            if (index > -1) {
                policy[directive].splice(index, 1);
            }
        }
    }

    /**
     * Get report of current CSP configuration
     */
    getReport() {
        return {
            environment: this.environment,
            policy: this.policies[this.environment],
            header: this.getCSPHeader(),
        };
    }
}

module.exports = CSPConfig;
