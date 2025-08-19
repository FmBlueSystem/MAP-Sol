// EMERGENCY FIX - Preload script with backwards compatibility
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// CRITICAL: Expose ipcRenderer for backwards compatibility
contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: (channel, ...args) => {
        logDebug('IPC invoke:', channel);
        return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
        logDebug('IPC send:', channel);
        return ipcRenderer.send(channel, ...args);
    },
    on: (channel, listener) => {
        logDebug('IPC on:', channel);
        ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
    }
});

// Also expose electronAPI for new code
contextBridge.exposeInMainWorld('electronAPI', {
    // Asset management
    getAssetPath: assetName => ipcRenderer.invoke('get-asset-path', assetName),

    // File system checks (safe, read-only)
    fileExists: filePath => {
        try {
            return fs.existsSync(filePath);
        } catch {
            return false;
        }
    },

    // Path utilities
    joinPath: (...segments) => path.join(...segments),

    // Get app paths
    getAppPath: () => __dirname,

    // Platform info
    platform: process.platform,
    isDevelopment: process.env.NODE_ENV === 'development'
});

logInfo('✅ EMERGENCY Preload script loaded - ipcRenderer exposed');
