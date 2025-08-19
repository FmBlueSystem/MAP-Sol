// Production Logger - Replaces console.log with controlled logging
class ProductionLogger {
    constructor() {
        this.isDevelopment =
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.logLevel = this.isDevelopment ? 'debug' : 'error';
        this.logs = [];
        this.maxLogs = 1000;

        // Log levels
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4
        };

        // Replace console methods in production
        if (!this.isDevelopment) {
            this.replaceConsoleMethods();
        }
    }

    replaceConsoleMethods() {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        // Store originals for critical errors
        window._originalConsole = originalConsole;

        // Replace console methods
        console.log = (...args) => this.log('info', ...args);
        console.info = (...args) => this.log('info', ...args);
        console.warn = (...args) => this.log('warn', ...args);
        console.error = (...args) => this.log('error', ...args);
        console.debug = (...args) => this.log('debug', ...args);
    }

    log(level, ...args) {
        // Check if we should log this level
        if (this.levels[level] < this.levels[this.logLevel]) {
            return;
        }

        // Create log entry
        const entry = {
            level,
            message: args
                .map(arg => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch {
                            return String(arg);
                        }
                    }
                    return String(arg);
                })
                .join(' '),
            timestamp: new Date().toISOString(),
            stack: new Error().stack
        };

        // Store log
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // In development, still output to console
        if (this.isDevelopment && window._originalConsole) {
            const method = window._originalConsole[level] || window._originalConsole.log;
            method(...args);
        }

        // For errors, always output in development
        if (level === 'error' || level === 'critical') {
            if (window._originalConsole) {
                window._originalConsole.error(...args);
            }
        }
    }

    setLogLevel(level) {
        if (this.levels[level] !== undefined) {
            this.logLevel = level;
        }
    }

    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    exportLogs() {
        return {
            logs: this.logs,
            environment: this.isDevelopment ? 'development' : 'production',
            logLevel: this.logLevel,
            timestamp: new Date().toISOString()
        };
    }
}

// Initialize production logger
window.productionLogger = new ProductionLogger();

// Safe logging function for production
window.safeLog = (level, ...args) => {
    if (window.productionLogger) {
        window.productionLogger.log(level, ...args);
    }
};
