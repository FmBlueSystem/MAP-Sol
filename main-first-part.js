// TASK_023: main.js modularizado - versión limpia
const { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configurar nombre de la aplicación antes de cualquier otra cosa
// IMPORTANTE: Forzar el nombre de múltiples maneras
process.title = 'MAP';
app.name = 'MAP';
app.setName('MAP');

// Handlers modularizados
const { createSearchHandler } = require('./handlers/search-handler');
const { createFilterHandler } = require('./handlers/filter-handler');
const { createArtworkHandler } = require('./handlers/artwork-handler');
const { 
    createExportHandler, 
    createGetFormatsHandler,
    createGetAllTracksForExportHandler,
    createExportTracksHandler,
    createGetExportFormatsHandler
} = require('./handlers/export-handler');
const { createNormalizationHandlers } = require('./handlers/normalization-handler');
const { createPlaylistHandlers } = require('./handlers/playlist-handler');
const { createAdvancedPlaylistHandlers } = require('./handlers/playlist-advanced-handler');
const { createAudioHandler } = require('./handlers/audio-handler');
const { createTrackInfoHandler, createFindSimilarHandler } = require('./handlers/track-info-handler');
const { createSmartPlaylistHandlers, createSmartPlaylistTables } = require('./handlers/smart-playlist-handler');
const { createEnergyFlowHandlers } = require('./handlers/energy-flow-handler');

let mainWindow;
let db;
let splash;

function createSplashScreen() {
    splash = new BrowserWindow({
        width: 400,
        height: 350,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    splash.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    user-select: none;
                }
                .logo {
                    font-size: 80px;
                    animation: rotate 4s linear infinite;
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                h1 {
                    margin: 15px 0;
                    font-size: 42px;
                    background: linear-gradient(135deg, #FDB813 0%, #FFAA00 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                p {
                    opacity: 0.9;
                    font-size: 16px;
                }
                .loader {
                    margin-top: 30px;
                    width: 200px;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .loader-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #FDB813 0%, #FFAA00 100%);
                    width: 0%;
                    animation: load 2.5s ease-out forwards;
                }
                @keyframes load {
                    to { width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="logo">☀️</div>
            <h1>Sol</h1>
            <p>Music Analyzer Pro</p>
            <div class="loader">
                <div class="loader-bar"></div>
            </div>
        </body>
        </html>
    `)}`);

    setTimeout(() => {
        if (splash && !splash.isDestroyed()) {
            splash.close();
        }
        if (mainWindow) {
            mainWindow.show();
        }
    }, 3000);
}

function createWindow() {
    // Configurar icono de la aplicación
    const iconPath = path.join(__dirname, 'image.png');
    let icon;

    // Verificar si el archivo de icono existe
    if (fs.existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath);
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'MAP - Music Analyzer Pro',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // Para macOS, título integrado
        show: false, // No mostrar hasta que el splash termine
        webPreferences: {
            nodeIntegration: true, // TEMPORARY - for compatibility
            contextIsolation: false, // TEMPORARY - for compatibility
            webSecurity: false // Para cargar imágenes locales
            // preload: path.join(__dirname, 'preload.js') // DISABLED temporarily
        },
        icon: icon || undefined // Usar el icono si existe
    });

    mainWindow.loadFile('index-with-search.html');

    // Prevenir sobrescritura del título
    mainWindow.on('page-title-updated', event => {
        event.preventDefault();
    });
}

// Función para crear el menú de aplicación
function createApplicationMenu() {
    const template = [
        // Menú principal - macOS: Nombre de App, Windows/Linux: File
        {
            label: process.platform === 'darwin' ? 'MAP' : 'File',
            submenu: [
                {
                    label: 'About MAP',
                    click: () => {
                        showAboutWindow();
                    }
                },
                { type: 'separator' },
                {
                    label: '⚙️ Audio Configuration',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => {
                        showAudioConfigWindow();
                    }
                },
                {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('open-preferences');
                    }
                },
                { type: 'separator' },
                ...(process.platform === 'darwin'
                    ? [
                          {
                              label: 'Services',
                              role: 'services',
                              submenu: []
                          },
                          { type: 'separator' },
                          {
                              label: 'Hide MAP',
                              accelerator: 'CmdOrCtrl+H',
                              role: 'hide'
                          },
                          {
                              label: 'Hide Others',
                              accelerator: 'CmdOrCtrl+Shift+H',
                              role: 'hideothers'
                          },
                          {
                              label: 'Show All',
                              role: 'unhide'
                          },
                          { type: 'separator' }
                      ]
                    : []),
                {
                    label: 'Quit MAP',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },

        // Menú File
        {
            label: 'File',
            submenu: [
                {
                    label: 'Import Music Library...',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => {
                        mainWindow.webContents.send('import-library');
                    }
                },
                {
                    label: 'Export Playlist...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        mainWindow.webContents.send('export-playlist');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Refresh Library',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.webContents.send('refresh-library');
                    }
                }
            ]
        },

        // Menú Edit
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },

        // Menú View
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },

        // Menú Window
        {
            label: 'Window',
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' },
                ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [])
            ]
        },

        // Menú Help
        {
            label: 'Help',
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: () => {
                        require('electron').shell.openExternal('https://bluesystemio.com');
                    }
                },
                {
                    label: 'Documentation',
                    click: () => {
                        require('electron').shell.openExternal(
                            'https://github.com/bluesystemio/music-analyzer'
                        );
                    }
                }
            ]
        }
    ];

    // Para Windows/Linux, reorganizar si es necesario
    if (process.platform !== 'darwin') {
        // En Windows/Linux el primer menú es File, agregar Audio Configuration allí
        template[0].submenu.unshift(
            {
                label: '⚙️ Audio Configuration',
                accelerator: 'Ctrl+Shift+A',
                click: () => {
                    showAudioConfigWindow();
                }
            },
            {
                label: 'Preferences',
                accelerator: 'Ctrl+,',
                click: () => {
                    mainWindow.webContents.send('open-preferences');
                }
            },
            { type: 'separator' }
        );
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Ventana About MAP personalizada
function showAboutWindow() {
    const aboutWindow = new BrowserWindow({
        width: 450,
        height: 400,
        resizable: false,
        modal: true,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        titleBarStyle: 'hidden',
        frame: false
    });

    aboutWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 40px;
                    text-align: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    user-select: none;
                    cursor: default;
                }
                .logo {
                    font-size: 72px;
                    margin-bottom: 20px;
                    animation: rotate 20s linear infinite;
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .codename {
                    font-size: 42px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                    background: linear-gradient(135deg, #FDB813 0%, #FFAA00 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .title {
                    font-size: 20px;
                    margin-bottom: 8px;
                    opacity: 0.95;
                }
                .company {
                    font-size: 14px;
                    opacity: 0.9;
                    margin-bottom: 20px;
                }
                .version {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-top: 30px;
                }
                .close-btn {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    font-size: 20px;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .close-btn:hover {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.1);
                }
            </style>
        </head>
        <body>
            <button class="close-btn" onclick="window.close()">×</button>
            <div class="logo">🎵</div>
            <div class="codename">MAP</div>
            <div class="title">Music Analyzer Pro</div>
            <div class="company">by BlueSystemIO | Audio Division</div>
            <div class="version">Version 1.0.0</div>
        </body>
        </html>
    ")}");
}

// Ventana de Configuración de Audio
let configWindow = null;

function showAudioConfigWindow() {
    configWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: mainWindow,
        modal: true,
        show: false,
        title: 'Audio Configuration',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

