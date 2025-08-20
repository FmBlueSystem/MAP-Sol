// Secure Preload Script - Context Bridge for safe IPC communication
// Prevents direct access to Node.js APIs from renderer

const { contextBridge, ipcRenderer } = require('electron');

// Validate channel names to prevent injection
const validChannels = {
    invoke: [
        'search-tracks',
        'get-files-with-cached-artwork',
        'get-filter-options',
        'get-track-metadata',
        'update-track-metadata',
        'show-in-folder',
        'check-file-exists',
        'get-file-metadata',
        'list-audio-files',
        'get-audio-config',
        'save-audio-config',
        'play-track',
        'pause-track',
        'resume-track',
        'stop-track',
        'seek-track',
        'get-playback-state',
        'pause',
        'resume',
        'stop',
        'next',
        'previous',
        'set-queue',
        'get-queue',
        'get-player-state',
        'set-volume',
        'seek',
        'create-playlist',
        'get-playlists',
        'get-playlist-with-tracks',
        'add-track-to-playlist',
        'remove-track-from-playlist',
        'update-playlist',
        'delete-playlist',
        'duplicate-playlist',
        'merge-playlists',
        'create-playlist-folder',
        'get-playlist-hierarchy',
        'export-to-rekordbox',
        'export-to-m3u8',
        'get-playlist-analytics',
        'auto-arrange-by-energy',
        'auto-arrange-by-key',
        'suggest-next-track',
        'analyze-track',
        'get-transition-points',
        'get-hamms-recommendations',
        'create-hamms-playlist',
        'analyze-directory',
        'analyze-files',
        'pause-analysis',
        'resume-analysis',
        'stop-analysis',
        'select-music-folder',
        'select-music-files',
        'get-all-library-files',
    ],
    send: ['save-audio-config', 'close-config-window', 'play-playlist', 'export-playlist', 'broadcast-player-state'],
    receive: [
        'audio-config-updated',
        'track-loaded',
        'playback-started',
        'playback-paused',
        'playback-error',
        'track-ended',
        'playback-fallback',
        'play-audio',
        'pause-audio',
        'resume-audio',
        'stop-audio',
        'set-volume',
        'seek-audio',
        'queue-updated',
        'player-state-update',
        'player-command',
        'open-preferences',
        'import-library',
        'export-playlist',
        'refresh-library',
        'playlist-updated',
        'track-added-to-playlist',
        'analysis-progress',
    ],
};

// Expose protected API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Invoke functions (request-response)
    invoke: async (channel, ...args) => {
        if (validChannels.invoke.includes(channel)) {
            try {
                // Sanitize arguments
                const sanitizedArgs = args.map((arg) => {
                    if (typeof arg === 'string') {
                        // Basic XSS prevention
                        return arg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                    }
                    return arg;
                });

                return await ipcRenderer.invoke(channel, ...sanitizedArgs);
            } catch (error) {
                logError(`IPC invoke error on channel ${channel}:`, error);
                throw new Error('Communication error');
            }
        } else {
            throw new Error(`Invalid channel: ${channel}`);
        }
    },

    // Send messages (one-way)
    send: (channel, ...args) => {
        if (validChannels.send.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        } else {
            logError(`Invalid send channel: ${channel}`);
        }
    },

    // Receive messages from main
    on: (channel, callback) => {
        if (validChannels.receive.includes(channel)) {
            // Wrap callback to prevent leaks
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);

            // Return unsubscribe function
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        } else {
            logError(`Invalid receive channel: ${channel}`);
            return () => {};
        }
    },

    // One-time listener
    once: (channel, callback) => {
        if (validChannels.receive.includes(channel)) {
            ipcRenderer.once(channel, (event, ...args) => callback(...args));
        } else {
            logError(`Invalid receive channel: ${channel}`);
        }
    },

    // Remove all listeners for a channel
    removeAllListeners: (channel) => {
        if (validChannels.receive.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        }
    },

    // System info (safe to expose)
    getSystemInfo: () => ({
        platform: process.platform,
        arch: process.arch,
        version: process.versions.electron,
    }),

    // Path utilities (safe subset)
    path: {
        join: (...args) => {
            // Validate paths don't contain traversal attempts
            const safe = args.every((arg) => typeof arg === 'string' && !arg.includes('..') && !arg.includes('~'));

            if (safe) {
                return args.join('/').replace(/\/+/g, '/');
            }
            throw new Error('Invalid path');
        },

        basename: (path) => {
            if (typeof path === 'string' && !path.includes('..')) {
                const parts = path.split(/[\\/]/);
                return parts[parts.length - 1];
            }
            throw new Error('Invalid path');
        },

        extname: (path) => {
            if (typeof path === 'string') {
                const match = path.match(/\.[^.]+$/);
                return match ? match[0] : '';
            }
            return '';
        },
    },
});

// Expose performance monitoring
contextBridge.exposeInMainWorld('performanceAPI', {
    measure: (name, fn) => {
        const start = performance.now();
        const result = fn();
        const end = performance.now();

        logDebug(`Performance [${name}]: ${(end - start).toFixed(2)}ms`);
        return result;
    },

    getMemoryUsage: () => {
        if (performance.memory) {
            return {
                usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
            };
        }
        return null;
    },
});

// Log that preload script is active
logDebug('🔒 Secure preload script loaded - Context isolation active');
