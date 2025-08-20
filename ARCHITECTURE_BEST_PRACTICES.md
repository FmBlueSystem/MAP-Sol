# 🏗️ Architecture Best Practices - Music Analyzer Pro

## 📋 Table of Contents

1. [JavaScript Modern Standards](#javascript-modern-standards)
2. [Electron Architecture](#electron-architecture)
3. [Performance Patterns](#performance-patterns)
4. [Security Guidelines](#security-guidelines)
5. [Testing Strategy](#testing-strategy)

---

## JavaScript Modern Standards

### ES6+ Modules

```javascript
// ✅ GOOD - Use ES6 imports
import { DatabaseService } from './services/database-service.js';
import * as utils from './utils/helpers.js';

// ❌ BAD - Avoid CommonJS in renderer
const db = require('./database');
```

### Async/Await Best Practices

```javascript
// ✅ GOOD - Clean async/await with error handling
async function loadTracks() {
    try {
        const tracks = await window.electronAPI.invoke('get-tracks');
        return tracks;
    } catch (error) {
        console.error('Failed to load tracks:', error);
        throw new Error('Database connection failed');
    }
}

// ❌ BAD - Callback hell
function loadTracks(callback) {
    getTracks((err, data) => {
        if (err) callback(err);
        else
            processTracks(data, (err, result) => {
                if (err) callback(err);
                else callback(null, result);
            });
    });
}
```

### Template Literals

```javascript
// ✅ GOOD - Proper template literal usage
const message = `Found ${count} tracks in ${time}ms`;
const multiline = `
    Title: ${track.title}
    Artist: ${track.artist}
    Album: ${track.album}
`;

// ❌ BAD - String concatenation
const message = 'Found ' + count + ' tracks in ' + time + 'ms';
```

### Destructuring

```javascript
// ✅ GOOD - Clean destructuring
const { title, artist, album, year = 'Unknown' } = track;
const [first, second, ...rest] = array;

// Function parameters
async function updateTrack({ id, title, artist }) {
    // ...
}
```

### Arrow Functions

```javascript
// ✅ GOOD - Arrow functions for callbacks
const filtered = tracks.filter((track) => track.year > 2000);
const mapped = tracks.map((track) => ({
    ...track,
    display: `${track.artist} - ${track.title}`,
}));

// ❌ BAD - Be careful with 'this' context
class Player {
    constructor() {
        // ✅ GOOD - Arrow function preserves 'this'
        this.handleClick = () => {
            this.play();
        };

        // ❌ BAD - Regular function loses 'this'
        this.handleClick = function () {
            this.play(); // 'this' is undefined
        };
    }
}
```

---

## Electron Architecture

### Main Process (main.js)

```javascript
// main.js - Backend logic only
const { app, BrowserWindow, ipcMain } = require('electron');

// ✅ GOOD - Handle backend operations in main
ipcMain.handle('database-query', async (event, query) => {
    return await database.execute(query);
});

// ❌ BAD - Don't handle UI logic in main
ipcMain.handle('update-ui', (event, data) => {
    // UI updates should be in renderer
});
```

### Renderer Process (frontend)

```javascript
// renderer.js - UI logic only
// ✅ GOOD - Use contextBridge API
const tracks = await window.electronAPI.invoke('get-tracks');

// ❌ BAD - Direct Node.js access (security risk)
const fs = require('fs'); // Never in renderer!
```

### Preload Script

```javascript
// preload.js - Bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ✅ GOOD - Whitelist specific methods
    getTracks: () => ipcRenderer.invoke('get-tracks'),
    updateTrack: (data) => ipcRenderer.invoke('update-track', data),

    // ❌ BAD - Don't expose entire ipcRenderer
    ipc: ipcRenderer, // Security risk!
});
```

### IPC Communication Patterns

```javascript
// ✅ GOOD - Type-safe IPC with validation
// main.js
ipcMain.handle('get-track', async (event, trackId) => {
    // Validate input
    if (!trackId || typeof trackId !== 'number') {
        throw new Error('Invalid track ID');
    }

    try {
        return await database.getTrack(trackId);
    } catch (error) {
        // Log internally, return safe error
        console.error('Database error:', error);
        throw new Error('Failed to load track');
    }
});

// renderer.js
async function loadTrack(id) {
    try {
        const track = await window.electronAPI.invoke('get-track', id);
        displayTrack(track);
    } catch (error) {
        showError('Could not load track');
    }
}
```

---

## Performance Patterns

### Virtual Scrolling Implementation

```javascript
class VirtualScroller {
    constructor(options) {
        this.itemHeight = options.itemHeight;
        this.container = options.container;
        this.items = options.items;
        this.buffer = 5; // Render 5 extra items
    }

    render() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;

        // Calculate visible range
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.ceil((scrollTop + viewportHeight) / this.itemHeight);

        // Render only visible items + buffer
        const visibleItems = this.items.slice(
            Math.max(0, startIndex - this.buffer),
            Math.min(this.items.length, endIndex + this.buffer)
        );

        this.renderItems(visibleItems);
    }
}
```

### Debouncing & Throttling

```javascript
// Debounce - Delay execution until idle
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Use for search input
const handleSearch = debounce(async (query) => {
    const results = await searchTracks(query);
    displayResults(results);
}, 300);

// Throttle - Limit execution frequency
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Use for scroll events
const handleScroll = throttle(() => {
    updateScrollPosition();
}, 16); // 60fps
```

### Memory Management

```javascript
class ResourceManager {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100 * 1024 * 1024; // 100MB
        this.currentSize = 0;
    }

    add(key, data, size) {
        // Evict old items if needed
        while (this.currentSize + size > this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.remove(firstKey);
        }

        this.cache.set(key, data);
        this.currentSize += size;
    }

    cleanup() {
        // Periodic cleanup
        if (this.currentSize > this.maxCacheSize * 0.9) {
            // Remove least recently used
            const toRemove = Math.floor(this.cache.size * 0.2);
            const keys = Array.from(this.cache.keys()).slice(0, toRemove);
            keys.forEach((key) => this.remove(key));
        }
    }
}
```

### Lazy Loading

```javascript
class LazyLoader {
    constructor() {
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), { rootMargin: '50px' });
    }

    observe(element) {
        this.observer.observe(element);
    }

    handleIntersection(entries) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                this.loadContent(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    }

    async loadContent(element) {
        const src = element.dataset.src;
        if (src) {
            const img = new Image();
            img.src = src;
            await img.decode();
            element.src = src;
            element.classList.add('loaded');
        }
    }
}
```

---

## Security Guidelines

### Input Validation

```javascript
// ✅ GOOD - Validate and sanitize all inputs
function validateTrackData(data) {
    const errors = [];

    // Type checking
    if (typeof data.title !== 'string') {
        errors.push('Title must be a string');
    }

    // Length validation
    if (data.title.length > 255) {
        errors.push('Title too long');
    }

    // Sanitize HTML/SQL injection
    data.title = sanitizeString(data.title);

    if (errors.length > 0) {
        throw new ValidationError(errors);
    }

    return data;
}

function sanitizeString(str) {
    return str
        .replace(/[<>]/g, '') // Remove HTML
        .replace(/['";]/g, '') // Remove SQL chars
        .trim();
}
```

### SQL Injection Prevention

```javascript
// ✅ GOOD - Use parameterized queries
const query = 'SELECT * FROM tracks WHERE artist = ? AND year > ?';
const results = await db.all(query, [artist, year]);

// ❌ BAD - String concatenation
const query = `SELECT * FROM tracks WHERE artist = '${artist}'`;
```

### XSS Prevention

```javascript
// ✅ GOOD - Escape HTML content
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Use when inserting user content
element.textContent = userInput; // Safe
element.innerHTML = escapeHtml(userInput); // If HTML needed
```

### Path Traversal Prevention

```javascript
// ✅ GOOD - Validate file paths
const path = require('path');

function safeFilePath(userPath) {
    // Resolve to absolute path
    const resolved = path.resolve(userPath);

    // Ensure it's within allowed directory
    const allowed = path.resolve('./music');
    if (!resolved.startsWith(allowed)) {
        throw new Error('Invalid file path');
    }

    return resolved;
}
```

---

## Testing Strategy

### Unit Testing with Jest

```javascript
// track.test.js
describe('Track Management', () => {
    let trackService;

    beforeEach(() => {
        trackService = new TrackService();
        // Mock database
        jest.mock('./database');
    });

    test('should load tracks successfully', async () => {
        const mockTracks = [
            { id: 1, title: 'Song 1' },
            { id: 2, title: 'Song 2' },
        ];

        database.getTracks.mockResolvedValue(mockTracks);

        const tracks = await trackService.loadTracks();
        expect(tracks).toHaveLength(2);
        expect(tracks[0].title).toBe('Song 1');
    });

    test('should handle database errors', async () => {
        database.getTracks.mockRejectedValue(new Error('DB Error'));

        await expect(trackService.loadTracks()).rejects.toThrow('Failed to load tracks');
    });
});
```

### Integration Testing

```javascript
// ipc.integration.test.js
const { app } = require('electron');
const { setupIPC } = require('../main/ipc');

describe('IPC Integration', () => {
    beforeAll(async () => {
        await app.whenReady();
        setupIPC();
    });

    test('should handle get-tracks request', async () => {
        const result = await ipcRenderer.invoke('get-tracks');
        expect(Array.isArray(result)).toBe(true);
    });
});
```

### E2E Testing with Playwright

```javascript
// app.e2e.test.js
const { test, expect } = require('@playwright/test');

test('should search for tracks', async ({ page }) => {
    // Launch Electron app
    await page.goto('app://./index.html');

    // Type in search
    await page.fill('#search-input', 'Beatles');

    // Wait for results
    await page.waitForSelector('.track-item');

    // Verify results
    const tracks = await page.$$('.track-item');
    expect(tracks.length).toBeGreaterThan(0);
});
```

---

## Code Organization

### Module Structure

```
src/
├── main/              # Main process code
│   ├── database/      # Database operations
│   ├── ipc/          # IPC handlers
│   └── services/     # Business logic
├── renderer/         # Renderer process code
│   ├── components/   # UI components
│   ├── utils/        # Utilities
│   └── styles/       # CSS files
├── shared/           # Shared between processes
│   ├── constants/    # App constants
│   └── types/        # TypeScript types
└── preload/          # Preload scripts
```

### Service Pattern

```javascript
// services/TrackService.js
class TrackService {
    constructor(database) {
        this.db = database;
        this.cache = new Map();
    }

    async getTracks(options = {}) {
        const cacheKey = JSON.stringify(options);

        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Query database
        const tracks = await this.db.query('tracks', options);

        // Cache results
        this.cache.set(cacheKey, tracks);

        return tracks;
    }

    invalidateCache() {
        this.cache.clear();
    }
}

// Singleton pattern
module.exports = new TrackService(database);
```

### Event System

```javascript
// EventBus.js
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        // Return unsubscribe function
        return () => {
            this.events[event] = this.events[event].filter((cb) => cb !== callback);
        };
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach((callback) => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event ${event}:`, error);
                }
            });
        }
    }
}

// Usage
const bus = new EventBus();

// Subscribe
const unsubscribe = bus.on('track-updated', (track) => {
    updateUI(track);
});

// Emit
bus.emit('track-updated', { id: 1, title: 'New Title' });

// Cleanup
unsubscribe();
```

---

## Build & Deployment

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
    target: 'electron-renderer',

    entry: {
        main: './src/renderer/index.js',
        worker: './src/renderer/worker.js',
    },

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
    },

    optimization: {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    priority: 10,
                },
                common: {
                    minChunks: 2,
                    priority: 5,
                    reuseExistingChunk: true,
                },
            },
        },
    },

    // Don't bundle native modules
    externals: {
        sqlite3: 'commonjs sqlite3',
        'music-metadata': 'commonjs music-metadata',
    },
};
```

### Auto-updater Setup

```javascript
// main.js
const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();

    // Update events
    autoUpdater.on('update-available', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update available',
            message: 'A new version is available. It will be downloaded in the background.',
            buttons: ['OK'],
        });
    });

    autoUpdater.on('update-downloaded', () => {
        dialog
            .showMessageBox({
                type: 'info',
                title: 'Update ready',
                message: 'Update downloaded. The app will restart to apply the update.',
                buttons: ['Restart Now', 'Later'],
            })
            .then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
    });
});
```

---

## Performance Monitoring

### Performance Observer

```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.processEntry(entry);
            }
        });

        this.observer.observe({
            entryTypes: ['measure', 'navigation'],
        });
    }

    startMeasure(name) {
        performance.mark(`${name}-start`);
    }

    endMeasure(name) {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
    }

    processEntry(entry) {
        if (!this.metrics[entry.name]) {
            this.metrics[entry.name] = [];
        }

        this.metrics[entry.name].push({
            duration: entry.duration,
            timestamp: entry.startTime,
        });

        // Alert if performance degrades
        if (entry.duration > 1000) {
            console.warn(`Slow operation: ${entry.name} took ${entry.duration}ms`);
        }
    }

    getMetrics() {
        return Object.entries(this.metrics).map(([name, values]) => ({
            name,
            average: values.reduce((a, b) => a + b.duration, 0) / values.length,
            max: Math.max(...values.map((v) => v.duration)),
            min: Math.min(...values.map((v) => v.duration)),
            count: values.length,
        }));
    }
}

// Usage
const monitor = new PerformanceMonitor();

monitor.startMeasure('database-query');
const results = await database.query();
monitor.endMeasure('database-query');
```

---

## Error Handling

### Global Error Handler

```javascript
// error-handler.js
class ErrorHandler {
    constructor() {
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Catch unhandled errors
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'window-error');
            event.preventDefault();
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'promise-rejection');
            event.preventDefault();
        });
    }

    handleError(error, context) {
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error(`[${context}]`, error);
        }

        // Send to logging service
        this.logToService(error, context);

        // Show user-friendly message
        this.showUserMessage(error);
    }

    logToService(error, context) {
        // Send to external service (Sentry, LogRocket, etc.)
        const errorData = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };

        // Example: Send to backend
        fetch('/api/errors', {
            method: 'POST',
            body: JSON.stringify(errorData),
        }).catch(() => {
            // Silently fail if logging fails
        });
    }

    showUserMessage(error) {
        // Don't expose technical details to users
        const userMessage = this.getUserMessage(error);

        // Show toast notification
        showToast(userMessage, 'error');
    }

    getUserMessage(error) {
        // Map technical errors to user-friendly messages
        const errorMap = {
            NetworkError: 'Connection lost. Please check your internet.',
            DatabaseError: 'Failed to load data. Please try again.',
            ValidationError: 'Please check your input and try again.',
        };

        return errorMap[error.constructor.name] || 'Something went wrong. Please try again.';
    }
}
```

---

## Best Practices Summary

### DO's ✅

1. Use async/await for asynchronous operations
2. Implement proper error boundaries
3. Validate all user inputs
4. Use parameterized database queries
5. Implement virtual scrolling for large lists
6. Cache frequently accessed data
7. Use Web Workers for heavy computations
8. Follow the principle of least privilege for IPC
9. Write tests for critical paths
10. Monitor performance metrics

### DON'Ts ❌

1. Don't use `require()` in renderer process
2. Don't expose Node.js APIs to renderer
3. Don't concatenate SQL queries
4. Don't store sensitive data in localStorage
5. Don't block the main thread
6. Don't ignore error handling
7. Don't use synchronous file operations
8. Don't trust user input
9. Don't skip input validation
10. Don't use deprecated APIs

---

## Resources

### Official Documentation

- [Electron Security](https://www.electronjs.org/docs/tutorial/security)
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Tools

- [ESLint](https://eslint.org/) - Code linting
- [Prettier](https://prettier.io/) - Code formatting
- [Jest](https://jestjs.io/) - Testing framework
- [Playwright](https://playwright.dev/) - E2E testing

### Performance

- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)

---

**Last Updated**: 2025-08-19
**Version**: 1.0.0
**Author**: Music Analyzer Pro Team
