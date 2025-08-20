// EMERGENCY FIX - Preload script with backwards compatibility
const { contextBridge, ipcRenderer } = require('electron');

// Simple logging functions
function logDebug(...args) {
    console.log('[Preload Debug]', ...args);
}

function logInfo(...args) {
    console.log('[Preload Info]', ...args);
}

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

    // Get app paths
    getAppPath: () => __dirname,

    // Platform info
    platform: process.platform,
    isDevelopment: process.env.NODE_ENV === 'development'
});

// Expose require for Electron modules
contextBridge.exposeInMainWorld('require', module => {
    if (module === 'electron') {
        return {
            ipcRenderer: {
                invoke: (channel, ...args) => {
                    logDebug('require.electron.ipcRenderer.invoke:', channel);
                    return ipcRenderer.invoke(channel, ...args);
                },
                on: (channel, listener) => {
                    logDebug('require.electron.ipcRenderer.on:', channel);
                    ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
                },
                send: (channel, ...args) => {
                    logDebug('require.electron.ipcRenderer.send:', channel);
                    return ipcRenderer.send(channel, ...args);
                }
            }
        };
    }
    return null;
});

logInfo('✅ EMERGENCY Preload script loaded - ipcRenderer exposed');
