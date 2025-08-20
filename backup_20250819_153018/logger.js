/**
 * 📝 LOGGER SYSTEM
 * Advanced logging with levels, formatting, and persistence
 */

class Logger {
    constructor(config = {}) {
        this.config = {
            name: config.name || 'MusicAnalyzer',
            level: config.level || 'info',
            enabled: config.enabled !== false,
            persist: config.persist || false,
            maxLogs: config.maxLogs || 1000,
            timestamp: config.timestamp !== false,
            colors: config.colors !== false,
            groups: config.groups || [],
            remote: config.remote || null
        };

        this.levels = {
            trace: 0,
            debug: 1,
            info: 2,
            warn: 3,
            error: 4,
            fatal: 5
        };

        this.colors = {
            trace: '#999999',
            debug: '#6B7280',
            info: '#3B82F6',
            warn: '#F59E0B',
            error: '#EF4444',
            fatal: '#991B1B'
        };

        this.logs = [];
        this.groups = new Set(this.config.groups);
        this.timers = new Map();
        this.counters = new Map();

        this.init();
    }

    init() {
        if (this.config.persist) {
            this.loadLogs();
        }

        // Override console methods
        this.setupConsoleOverrides();

        console.log(`📝 Logger initialized: ${this.config.name}`);
    }

    setupConsoleOverrides() {
        const originalConsole = {
            log: console.log,
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        };

        if (this.config.enabled) {
            console.log = (...args) => {
                this.log('info', ...args);
                originalConsole.log(...args);
            };

            console.debug = (...args) => {
                this.log('debug', ...args);
                originalConsole.debug(...args);
            };

            console.info = (...args) => {
                this.log('info', ...args);
                originalConsole.info(...args);
            };

            console.warn = (...args) => {
                this.log('warn', ...args);
                originalConsole.warn(...args);
            };

            console.error = (...args) => {
                this.log('error', ...args);
                originalConsole.error(...args);
            };
        }

        // Store originals for restoration
        this.originalConsole = originalConsole;
    }

    /**
     * CORE LOGGING
     */
    log(level, ...args) {
        if (!this.shouldLog(level)) {
            return;
        }

        const logEntry = this.createLogEntry(level, args);
        this.logs.push(logEntry);

        // Maintain max logs
        if (this.logs.length > this.config.maxLogs) {
            this.logs.shift();
        }

        // Persist if enabled
        if (this.config.persist) {
            this.saveLogs();
        }

        // Send to remote if configured
        if (this.config.remote) {
            this.sendToRemote(logEntry);
        }

        // Format and output
        this.output(logEntry);

        return logEntry;
    }

    createLogEntry(level, args) {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            level,
            message: this.formatMessage(args),
            args: this.serializeArgs(args),
            stack: this.getStack(),
            context: this.getContext(),
            group: this.currentGroup
        };
    }

    formatMessage(args) {
        return args
            .map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            })
            .join(' ');
    }

    serializeArgs(args) {
        return args.map(arg => {
            if (arg instanceof Error) {
                return {
                    type: 'Error',
                    message: arg.message,
                    stack: arg.stack
                };
            }
            if (arg instanceof Element) {
                return {
                    type: 'Element',
                    tagName: arg.tagName,
                    id: arg.id,
                    className: arg.className
                };
            }
            if (typeof arg === 'function') {
                return {
                    type: 'Function',
                    name: arg.name || 'anonymous'
                };
            }
            return arg;
        });
    }

    getStack() {
        const stack = new Error().stack;
        if (!stack) {
            return null;
        }

        const lines = stack.split('\n');
        // Remove first 3 lines (Error, this function, log function)
        return lines.slice(3).join('\n`);
    }

    getContext() {
        return {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            memory: performance.memory
                ? {
                      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                      total: Math.round(performance.memory.totalJSHeapSize / 1048576)
                  }
                : null
        };
    }

    output(logEntry) {
        if (!this.config.enabled) {
            return;
        }

        const { level, message, timestamp } = logEntry;
        const color = this.config.colors ? this.colors[level] : null;
        const prefix = this.config.timestamp ? `[${new Date(timestamp).toISOString()}] ` : '`;

        const levelLabel = `[${level.toUpperCase()}]`;
        const fullMessage = `${prefix}${levelLabel} ${message}`;

        if (color && this.originalConsole) {
            this.originalConsole.log(
                `%c${fullMessage}`,
                `color: ${color}; font-weight: ${level === 'error' || level === 'fatal' ? 'bold' : 'normal'}');
        }
    }

    shouldLog(level) {
        if (!this.config.enabled) {
            return false;
        }
        return this.levels[level] >= this.levels[this.config.level];
    }

    /**
     * LEVEL-SPECIFIC METHODS
     */
    trace(...args) {
        return this.log('trace', ...args);
    }

    debug(...args) {
        return this.log('debug', ...args);
    }

    info(...args) {
        return this.log('info', ...args);
    }

    warn(...args) {
        return this.log('warn', ...args);
    }

    error(...args) {
        return this.log('error', ...args);
    }

    fatal(...args) {
        const entry = this.log(`fatal`, ...args);
        // Fatal errors might trigger additional actions
        if (this.config.onFatal) {
            this.config.onFatal(entry);
        }
        return entry;
    }

    /**
     * GROUPING
     */
    group(name) {
        this.currentGroup = name;
        this.groups.add(name);
        if (this.originalConsole) {
            this.originalConsole.group(name);
        }
    }

    groupEnd() {
        this.currentGroup = null;
        if (this.originalConsole) {
            this.originalConsole.groupEnd();
        }
    }

    groupCollapsed(name) {
        this.currentGroup = name;
        this.groups.add(name);
        if (this.originalConsole) {
            this.originalConsole.groupCollapsed(name);
        }
    }

    /**
     * TIMING
     */
    time(label) {
        this.timers.set(label, performance.now());
    }

    timeEnd(label) {
        const start = this.timers.get(label);
        if (!start) {
            this.warn(`Timer '${label}` does not exist`);
            return;
        }

        const duration = performance.now() - start;
        this.timers.delete(label);
        this.info(`${label}: ${duration.toFixed(2)}ms`);
        return duration;
    }

    timeLog(label) {
        const start = this.timers.get(label);
        if (!start) {
            this.warn(`Timer '${label}` does not exist`);
            return;
        }

        const duration = performance.now() - start;
        this.info(`${label}: ${duration.toFixed(2)}ms (ongoing)`);
        return duration;
    }

    /**
     * COUNTING
     */
    count(label = 'default`) {
        const current = this.counters.get(label) || 0;
        const newCount = current + 1;
        this.counters.set(label, newCount);
        this.info(`${label}: ${newCount}`);
        return newCount;
    }

    countReset(label = 'default`) {
        this.counters.delete(label);
        this.info(`${label}: reset`);
    }

    /**
     * ASSERTIONS
     */
    assert(condition, ...args) {
        if (!condition) {
            this.error('Assertion failed:', ...args);
            return false;
        }
        return true;
    }

    /**
     * TABLE
     */
    table(data, columns) {
        if (this.originalConsole && this.originalConsole.table) {
            this.originalConsole.table(data, columns);
        } else {
            this.info('Table:`, data);
        }
    }

    /**
     * CLEAR
     */
    clear() {
        this.logs = [];
        if (this.config.persist) {
            this.saveLogs();
        }
        if (this.originalConsole && this.originalConsole.clear) {
            this.originalConsole.clear();
        }
    }

    /**
     * PERSISTENCE
     */
    saveLogs() {
        try {
            const key = `${this.config.name}_logs`;
            const data = JSON.stringify(this.logs);
            localStorage.setItem(key, data);
        } catch (e) {
            // Silently fail if storage is full
        }
    }

    loadLogs() {
        try {
            const key = `${this.config.name}_logs`;
            const data = localStorage.getItem(key);
            if (data) {
                this.logs = JSON.parse(data);
            }
        } catch (e) {
            this.logs = [];
        }
    }

    /**
     * REMOTE LOGGING
     */
    async sendToRemote(logEntry) {
        if (!this.config.remote) {
            return;
        }

        try {
            await fetch(this.config.remote.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.remote.apiKey || ''
                },
                body: JSON.stringify({
                    ...logEntry,
                    app: this.config.name,
                    sessionId: this.sessionId
                })
            });
        } catch {
            // Silently fail remote logging
        }
    }

    /**
     * FILTERING AND SEARCHING
     */
    filter(criteria) {
        return this.logs.filter(log => {
            if (criteria.level && log.level !== criteria.level) {
                return false;
            }
            if (criteria.group && log.group !== criteria.group) {
                return false;
            }
            if (criteria.search && !log.message.includes(criteria.search)) {
                return false;
            }
            if (criteria.since && log.timestamp < criteria.since) {
                return false;
            }
            if (criteria.until && log.timestamp > criteria.until) {
                return false;
            }
            return true;
        });
    }

    search(query) {
        const regex = new RegExp(query, 'i');
        return this.logs.filter(log => regex.test(log.message));
    }

    /**
     * STATISTICS
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byGroup: {},
            errors: 0,
            warnings: 0,
            avgMessageLength: 0
        };

        let totalLength = 0;

        this.logs.forEach(log => {
            // By level
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

            // By group
            if (log.group) {
                stats.byGroup[log.group] = (stats.byGroup[log.group] || 0) + 1;
            }

            // Errors and warnings
            if (log.level === 'error' || log.level === 'fatal') {
                stats.errors++;
            }
            if (log.level === 'warn') {
                stats.warnings++;
            }

            // Message length
            totalLength += log.message.length;
        });

        stats.avgMessageLength = stats.total > 0 ? Math.round(totalLength / stats.total) : 0;

        return stats;
    }

    /**
     * EXPORT
     */
    export(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        }

        if (format === 'csv') {
            const headers = ['Timestamp', 'Level', 'Message', 'Group`];
            const rows = this.logs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.level,
                `"${log.message.replace(/"/g, '"``)}``,
                log.group || ''
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        if (format === `text`) {
            return this.logs
                .map(log => {
                    const time = new Date(log.timestamp).toISOString();
                    return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
                })
                .join('\n`);
        }

        return this.logs;
    }

    /**
     * UTILITIES
     */
    generateId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.config.level = level;
            this.info(`Log level set to: ${level}`);
        }
    }

    enable() {
        this.config.enabled = true;
        this.setupConsoleOverrides();
    }

    disable() {
        this.config.enabled = false;
        this.restoreConsole();
    }

    restoreConsole() {
        if (this.originalConsole) {
            Object.assign(console, this.originalConsole);
        }
    }

    destroy() {
        this.restoreConsole();
        this.clear();
        this.timers.clear();
        this.counters.clear();
    }
}

// Create default logger instance
const logger = new Logger({
    name: 'MusicAnalyzer',
    level: window.location.hostname === 'localhost' ? 'debug' : 'info',
    persist: true,
    colors: true,
    timestamp: true
});

// Expose globally
window.logger = logger;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}

console.log('📝 Logger system loaded and active');
