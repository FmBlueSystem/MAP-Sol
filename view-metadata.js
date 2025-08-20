#!/usr/bin/env node

/**
 * 🔍 Metadata Viewer Launcher
 * Abre la interfaz visual de metadatos en una ventana de Electron
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

let viewerWindow;

function createViewerWindow() {
    viewerWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'icons', 'icon.png'),
        title: 'Metadata Viewer - Music Analyzer Pro',
        backgroundColor: '#1e3c72',
    });

    // Cargar el archivo HTML
    viewerWindow.loadFile('metadata-viewer.html');

    // Abrir DevTools en desarrollo
    if (process.env.NODE_ENV === 'development') {
        viewerWindow.webContents.openDevTools();
    }

    viewerWindow.on('closed', () => {
        viewerWindow = null;
    });
}

app.whenReady().then(createViewerWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (viewerWindow === null) {
        createViewerWindow();
    }
});

logDebug('🔍 Abriendo Metadata Viewer...');
