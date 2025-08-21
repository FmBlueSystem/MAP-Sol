// Preload script para React
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getTracks: () => ipcRenderer.invoke('get-files-with-cached-artwork'),
    getTrackInfo: (trackId) => ipcRenderer.invoke('get-track-complete-data', trackId),
});
