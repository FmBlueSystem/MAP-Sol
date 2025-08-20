// Diagnostic script to test the player functionality
const { app, BrowserWindow } = require('electron');
const path = require('path');

let testWindow;

function createTestWindow() {
    testWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-secure.js'),
        },
    });

    // Load the test player page
    testWindow.loadFile('test-player.html');

    // Open DevTools for debugging
    testWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createTestWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createTestWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
