// TASK_023: main.js modularizado - versión limpia
const { app, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Handlers modularizados
const { createSearchHandler } = require('./handlers/search-handler');
const { createFilterHandler } = require('./handlers/filter-handler');
const { createArtworkHandler } = require('./handlers/artwork-handler');

let mainWindow;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Para cargar imágenes locales
        }
    });

    mainWindow.loadFile('index-complete.html');
}

app.whenReady().then(() => {
    const dbPath = path.join(__dirname, 'music_analyzer.db');
    db = new sqlite3.Database(dbPath);

    logInfo('✅ Base de datos conectada');

    // Registrar handlers
    ipcMain.handle('get-files-with-cached-artwork', createArtworkHandler(db));
    ipcMain.handle('search-tracks', createSearchHandler(db));
    ipcMain.handle('get-filter-options', createFilterHandler(db));

    createWindow();
});

app.on('window-all-closed', () => {
    if (db) {
        db.close();
    }
    app.quit();
});
