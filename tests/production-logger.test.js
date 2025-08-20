/**
 * Unit tests for Production Logger
 */

describe('ProductionLogger', () => {
    let originalConsole;
    let logger;

    beforeEach(() => {
        // Save original console methods
        originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
        };

        // Reset global variables
        global.window = {
            location: {
                hostname: 'localhost',
            }
        };

        // Clear any previous module cache
        jest.resetModules();
    });

    afterEach(() => {
        // Restore original console
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;

        delete global.window;
    });

    describe('Development Mode', () => {
        test('should log all levels in development', () => {
            global.window.location.hostname = 'localhost';

            // Create spy functions
            const logSpy = jest.fn();
            const errorSpy = jest.fn();
            const warnSpy = jest.fn();

            console.log = logSpy;
            console.error = errorSpy;
            console.warn = warnSpy;

            // Load logger module
            require('../js/production-logger');

            // Test logging functions
            global.logDebug('Debug message');
            global.logInfo('Info message');
            global.logWarn('Warning message');
            global.logError('Error message');

            expect(logSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith('Warning message');
            expect(errorSpy).toHaveBeenCalledWith('Error message');
        });
    });

    describe('Production Mode', () => {
        test('should suppress debug and info logs in production', () => {
            global.window.location.hostname = 'production.example.com';

            // Create spy functions
            const logSpy = jest.fn();
            const errorSpy = jest.fn();
            const warnSpy = jest.fn();

            console.log = logSpy;
            console.error = errorSpy;
            console.warn = warnSpy;

            // Load logger module
            require('../js/production-logger');

            // Test logging functions
            global.logDebug('Debug message');
            global.logInfo('Info message');
            global.logWarn('Warning message');
            global.logError('Error message');

            // Debug and info should not be called
            expect(logSpy).not.toHaveBeenCalled();

            // Warn and error should still be called
            expect(warnSpy).toHaveBeenCalledWith('Warning message');
            expect(errorSpy).toHaveBeenCalledWith('Error message');
        });
    });

    describe('Log History', () => {
        test('should track log history', () => {
            global.window.location.hostname = 'localhost';

            // Load logger module
            require('../js/production-logger');

            // Log some messages
            global.logInfo('Test message 1');
            global.logError('Test error');

            // Get logger instance
            const logger = global.window.productionLogger;
            const history = logger.getHistory();

            expect(history.length).toBeGreaterThan(0);
            expect(history.some((log) => log.message === 'Test message 1')).toBe(true);
            expect(history.some((log) => log.message === 'Test error')).toBe(true);
        });

        test('should limit history size', () => {
            global.window.location.hostname = 'localhost';

            // Load logger module
            require('../js/production-logger');
            const logger = global.window.productionLogger;

            // Log more than max history
            for (let i = 0; i < 1050; i++) {
                global.logInfo(`Message ${i}`);
            }

            const history = logger.getHistory();
            expect(history.length).toBeLessThanOrEqual(1000);
        });
    });

    describe('Statistics', () => {
        test('should track statistics correctly', () => {
            global.window.location.hostname = 'localhost';

            // Load logger module
            require('../js/production-logger');
            const logger = global.window.productionLogger;

            // Clear statistics
            logger.clearHistory();

            // Log various levels
            global.logDebug('Debug');
            global.logDebug('Debug 2');
            global.logInfo('Info');
            global.logWarn('Warning');
            global.logError('Error');

            const stats = logger.getStatistics();

            expect(stats.debug).toBe(2);
            expect(stats.info).toBe(1);
            expect(stats.warn).toBe(1);
            expect(stats.error).toBe(1);
            expect(stats.total).toBe(5);
        });
    });
});
