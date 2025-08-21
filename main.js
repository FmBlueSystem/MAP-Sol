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
const { createGetTrackWithMetadataHandler } = require('./handlers/get-track-with-metadata');
const {
    createExportHandler,
    createGetFormatsHandler,
    createGetAllTracksForExportHandler,
    createExportTracksHandler,
    createGetExportFormatsHandler,
} = require('./handlers/export-handler');
const { createNormalizationHandlers } = require('./handlers/normalization-handler');
const { createPlaylistHandlers } = require('./handlers/playlist-handler');
const { createAdvancedPlaylistHandlers } = require('./handlers/playlist-advanced-handler');
const { createAudioHandler } = require('./handlers/audio-handler');
// Track info handler - verificar que el archivo existe
const trackInfoHandlerPath = path.join(__dirname, 'handlers', 'track-info-handler.js');
console.log('Track info handler path:', trackInfoHandlerPath);
console.log('Track info handler exists:', require('fs').existsSync(trackInfoHandlerPath));
const { createTrackInfoHandler, createFindSimilarHandler } = require('./handlers/track-info-handler');
const { createSmartPlaylistHandlers, createSmartPlaylistTables } = require('./handlers/smart-playlist-handler');
const { createEnergyFlowHandlers } = require('./handlers/energy-flow-handler');
const { createSimplePlayerHandlers } = require('./handlers/simple-player-handler');

let mainWindow;
let db;
let splash;

// Logging helper function
function logInfo(message) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
}

function createSplashScreen() {
    splash = new BrowserWindow({
        width: 400,
        height: 350,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
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
    `)}`
    );

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
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Para cargar imágenes locales
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: icon || undefined, // Usar el icono si existe
    });

    mainWindow.loadFile('index-with-search.html');

    // Prevenir sobrescritura del título
    mainWindow.on('page-title-updated', (event) => {
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
                    },
                },
                { type: 'separator' },
                {
                    label: '⚙️ Audio Configuration',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => {
                        showAudioConfigWindow();
                    },
                },
                {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('open-preferences');
                    },
                },
                { type: 'separator' },
                ...(process.platform === 'darwin'
                    ? [
                          {
                              label: 'Services',
                              role: 'services',
                              submenu: [],
                          },
                          { type: 'separator' },
                          {
                              label: 'Hide MAP',
                              accelerator: 'CmdOrCtrl+H',
                              role: 'hide',
                          },
                          {
                              label: 'Hide Others',
                              accelerator: 'CmdOrCtrl+Shift+H',
                              role: 'hideothers',
                          },
                          {
                              label: 'Show All',
                              role: 'unhide',
                          },
                          { type: 'separator' },
                      ]
                    : []),
                {
                    label: 'Quit MAP',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    },
                },
            ],
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
                    },
                },
                {
                    label: 'Export Playlist...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        mainWindow.webContents.send('export-playlist');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Refresh Library',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.webContents.send('refresh-library');
                    },
                },
            ],
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
                { role: 'selectall' },
            ],
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
                { role: 'togglefullscreen' },
            ],
        },

        // Menú Window
        {
            label: 'Window',
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' },
                ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : []),
            ],
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
                    },
                },
                {
                    label: 'Documentation',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/bluesystemio/music-analyzer');
                    },
                },
            ],
        },
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
                },
            },
            {
                label: 'Preferences',
                accelerator: 'Ctrl+,',
                click: () => {
                    mainWindow.webContents.send('open-preferences');
                },
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
            contextIsolation: false,
        },
        titleBarStyle: 'hidden',
        frame: false,
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
    `)}`
    );
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
            contextIsolation: false,
        },
    });

    // HTML para la configuración de audio
    const configHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                margin: 0;
            }
            h1 {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 30px;
            }
            .config-section {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                backdrop-filter: blur(10px);
            }
            .config-section h2 {
                margin-top: 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.3);
                padding-bottom: 10px;
                font-size: 18px;
            }
            .config-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 15px 0;
            }
            label {
                flex: 1;
                font-size: 14px;
            }
            select, input[type="number"], input[type="range"] {
                flex: 1;
                padding: 8px;
                border-radius: 5px;
                border: none;
                background: rgba(255, 255, 255, 0.9);
                color: #333;
                font-size: 14px;
            }
            input[type="checkbox"] {
                width: 20px;
                height: 20px;
                cursor: pointer;
            }
            button {
                background: white;
                color: #667eea;
                border: none;
                padding: 12px 24px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin: 5px;
                transition: all 0.3s;
            }
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            .buttons {
                text-align: right;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.3);
            }
            .value-display {
                margin-left: 10px;
                font-weight: bold;
                min-width: 40px;
            }
            .hint {
                font-size: 12px;
                opacity: 0.8;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <h1>⚙️ Audio Configuration</h1>
        
        <div class="config-section">
            <h2>🔊 Smart Volume (Normalization)</h2>
            <div class="config-row">
                <label>Normalization Mode:</label>
                <select id="smartVolume">
                    <option value="off">Off</option>
                    <option value="natural">Natural (Hi-Fi)</option>
                    <option value="balanced" selected>Balanced (K-14)</option>
                    <option value="loud">Loud</option>
                </select>
            </div>
            <div class="config-row">
                <label>Target LUFS:</label>
                <input type="number" id="targetLufs" value="-14" min="-30" max="0">
            </div>
            <div class="config-row">
                <label>Peak Protection:</label>
                <input type="checkbox" id="peakProtection" checked>
            </div>
            <div class="config-row">
                <label>Algorithm:</label>
                <select id="algorithm">
                    <option value="lufs" selected>LUFS (Modern)</option>
                    <option value="replaygain">ReplayGain</option>
                    <option value="peak">Peak</option>
                    <option value="rms">RMS</option>
                </select>
            </div>
        </div>
        
        <div class="config-section">
            <h2>🎵 Playback Settings</h2>
            <div class="config-row">
                <label>Crossfade Duration:</label>
                <input type="range" id="crossfade" min="0" max="10" value="0" step="0.5">
                <span class="value-display" id="crossfadeValue">0s</span>
            </div>
            <div class="config-row">
                <label>Gapless Playback:</label>
                <input type="checkbox" id="gapless" checked>
            </div>
            <div class="config-row">
                <label>Auto-Play Next:</label>
                <input type="checkbox" id="autoPlay" checked>
            </div>
            <div class="config-row">
                <label>Pre-load Time:</label>
                <input type="range" id="preload" min="1" max="10" value="3">
                <span class="value-display" id="preloadValue">3s</span>
            </div>
        </div>
        
        <div class="config-section">
            <h2>🎛️ Audio Quality</h2>
            <div class="config-row">
                <label>Sample Rate:</label>
                <select id="sampleRate">
                    <option value="auto" selected>Auto (Match Source)</option>
                    <option value="44100">44.1 kHz (CD Quality)</option>
                    <option value="48000">48 kHz (Professional)</option>
                    <option value="96000">96 kHz (Hi-Res)</option>
                    <option value="192000">192 kHz (Studio)</option>
                </select>
            </div>
            <div class="config-row">
                <label>Buffer Size:</label>
                <select id="bufferSize">
                    <option value="256">256 samples (Low Latency)</option>
                    <option value="512">512 samples</option>
                    <option value="1024" selected>1024 samples (Balanced)</option>
                    <option value="2048">2048 samples</option>
                    <option value="4096">4096 samples (Max Stability)</option>
                </select>
            </div>
            <div class="config-row">
                <label>Hardware Acceleration:</label>
                <input type="checkbox" id="hwAccel" checked>
            </div>
        </div>
        
        <div class="buttons">
            <button onclick="resetDefaults()">Reset Defaults</button>
            <button onclick="window.close()">Cancel</button>
            <button onclick="saveConfig(this)" style="background: #667eea; color: white;">Save</button>
        </div>
        
        <script>
            const { ipcRenderer } = require('electron');
            
            // Update slider displays
            document.getElementById('crossfade').addEventListener('input', (e) => {
                document.getElementById('crossfadeValue').textContent = e.target.value + 's';
            });
            
            document.getElementById('preload').addEventListener('input', (e) => {
                document.getElementById('preloadValue').textContent = e.target.value + 's';
            });
            
            // Load saved configuration from main process
            window.addEventListener('DOMContentLoaded', async () => {
                try {
                    const config = await ipcRenderer.invoke('get-audio-config');
                    if (config) {
                        document.getElementById('smartVolume').value = config.smartVolume || 'balanced';
                        document.getElementById('targetLufs').value = config.targetLufs || -14;
                        document.getElementById('peakProtection').checked = config.peakProtection !== false;
                        document.getElementById('algorithm').value = config.algorithm || 'lufs';
                        document.getElementById('crossfade').value = config.crossfade || 0;
                        document.getElementById('gapless').checked = config.gapless !== false;
                        document.getElementById('autoPlay').checked = config.autoPlay !== false;
                        document.getElementById('preload').value = config.preload || 3;
                        document.getElementById('sampleRate').value = config.sampleRate || 'auto';
                        document.getElementById('bufferSize').value = config.bufferSize || 1024;
                        document.getElementById('hwAccel').checked = config.hwAccel !== false;
                        
                        // Update displays
                        document.getElementById('crossfadeValue').textContent = (config.crossfade || 0) + 's';
                        document.getElementById('preloadValue').textContent = (config.preload || 3) + 's';
                    }
                } catch (error) {
                    logDebug('No saved configuration found');
                }
            });
            
            function saveConfig(button) {
                const config = {
                    smartVolume: document.getElementById('smartVolume').value,
                    targetLufs: parseInt(document.getElementById('targetLufs').value),
                    peakProtection: document.getElementById('peakProtection').checked,
                    algorithm: document.getElementById('algorithm').value,
                    crossfade: parseFloat(document.getElementById('crossfade').value),
                    gapless: document.getElementById('gapless').checked,
                    autoPlay: document.getElementById('autoPlay').checked,
                    preload: parseInt(document.getElementById('preload').value),
                    sampleRate: document.getElementById('sampleRate').value,
                    bufferSize: parseInt(document.getElementById('bufferSize').value),
                    hwAccel: document.getElementById('hwAccel').checked
                };
                
                // Send to main process to save
                ipcRenderer.send('save-audio-config', config);
                
                // Show success message
                if (button) {
                    button.textContent = '✅ Saved!';
                    button.style.background = '#4CAF50';
                    button.style.color = 'white';
                    button.disabled = true;
                }
                
                // Close window after showing confirmation
                setTimeout(function() {
                    ipcRenderer.send('close-config-window');
                }, 1000);
            }
            
            function resetDefaults() {
                document.getElementById('smartVolume').value = 'balanced';
                document.getElementById('targetLufs').value = -14;
                document.getElementById('peakProtection').checked = true;
                document.getElementById('algorithm').value = 'lufs';
                document.getElementById('crossfade').value = 0;
                document.getElementById('gapless').checked = true;
                document.getElementById('autoPlay').checked = true;
                document.getElementById('preload').value = 3;
                document.getElementById('sampleRate').value = 'auto';
                document.getElementById('bufferSize').value = 1024;
                document.getElementById('hwAccel').checked = true;
                
                // Update displays
                document.getElementById('crossfadeValue').textContent = '0s';
                document.getElementById('preloadValue').textContent = '3s';
            }
        </script>
    </body>
    </html>
    `;

    configWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(configHTML)}`);

    configWindow.once('ready-to-show', () => {
        configWindow.show();
    });

    // Limpiar referencia cuando se cierre
    configWindow.on('closed', () => {
        configWindow = null;
    });
}

// Handler para cerrar la ventana de configuración si window.close() falla
ipcMain.on('close-config-window', () => {
    if (configWindow) {
        configWindow.close();
    }
});

// Suprimir advertencias de ffmpeg ANTES de que la app esté lista
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-logging');
app.commandLine.appendSwitch('--log-level=3'); // Solo errores fatales
app.commandLine.appendSwitch('--disable-dev-shm-usage');

// Suprimir específicamente errores de ffmpeg y advertencias de seguridad
// process.env.ELECTRON_ENABLE_LOGGING = '0';
// process.env.ELECTRON_LOG_FILE = '/dev/null';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
// process.env.ELECTRON_NO_ATTACH_CONSOLE = 'true';

app.whenReady().then(() => {
    console.log('=== APP WHEN READY TRIGGERED ===');
    // Configurar icono del dock en macOS
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'image.png');
        if (fs.existsSync(iconPath)) {
            const dockIcon = nativeImage.createFromPath(iconPath);
            app.dock.setIcon(dockIcon);
        }
    }

    const dbPath = path.join(__dirname, 'music_analyzer.db');

    // Create database connection with error handling
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            dialog.showErrorBox('Database Error', `Failed to open database: ${err.message}`);
            app.quit();
        } else {
            console.log('MAP - Music Analyzer Pro starting...');
            console.log('Connected to SQLite database');
            logInfo('✅ Base de datos conectada');

            // Initialize everything AFTER database connection is confirmed
            console.log('About to call initializeAppAfterDatabase...');
            initializeAppAfterDatabase();
            console.log('initializeAppAfterDatabase call completed');
        }
    });
});

function initializeAppAfterDatabase() {
    console.log('initializeAppAfterDatabase function started');
    logInfo('🔧 Starting handler initialization...');

    try {
        // Create smart playlist tables if needed
        createSmartPlaylistTables(db);
        logInfo('Smart playlist tables created');
    } catch (error) {
        logInfo('❌ Error creating smart playlist tables: ' + error.message);
    }

    // ImportMusicHandler se inicializa después de crear mainWindow

    // Registrar handlers - SOLO después de que DB esté conectada
    try {
        ipcMain.handle('get-files-with-cached-artwork', createArtworkHandler(db));
        ipcMain.handle('get-track-with-metadata', createGetTrackWithMetadataHandler(db));
        ipcMain.handle('search-tracks', createSearchHandler(db));
        ipcMain.handle('get-filter-options', createFilterHandler(db));

        // Registrar handler para track info con logging
        console.log('Registering get-track-complete-data handler...');
        if (typeof createTrackInfoHandler === 'function') {
            ipcMain.handle('get-track-complete-data', createTrackInfoHandler(db));
            console.log('✅ get-track-complete-data handler registered successfully');
        } else {
            console.error('❌ createTrackInfoHandler is not a function:', typeof createTrackInfoHandler);
        }

        ipcMain.handle('find-similar-tracks', createFindSimilarHandler(db));

        // Handler para seleccionar archivos de música - SOLO ARCHIVOS, NO CARPETAS
        ipcMain.handle('select-music-files', async () => {
            const result = await dialog.showOpenDialog({
                title: 'Select Music Files',
                properties: ['openFile', 'multiSelections'], // SOLO openFile, NO openDirectory
                filters: [
                    {
                        name: 'Music Files',
                        extensions: [
                            'mp3',
                            'flac',
                            'wav',
                            'm4a',
                            'aac',
                            'ogg',
                            'wma',
                            'aiff',
                            'opus',
                            'ape',
                            'webm',
                            'mp4',
                        ],
                    },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });

            console.log('Dialog result:', result);

            if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                console.log('Files selected:', result.filePaths);
                return { filePaths: result.filePaths };
            }
            return null;
        });

        // Handler para importar música a la base de datos
        ipcMain.handle('import-music', async (event, data) => {
            const { paths } = data;
            console.log('Importing music files:', paths);

            const mm = require('music-metadata');
            const path = require('path');
            const results = [];

            for (const filePath of paths) {
                try {
                    // Extract metadata
                    const metadata = await mm.parseFile(filePath);

                    // Prepare data for database
                    const fileData = {
                        file_path: filePath,
                        file_name: path.basename(filePath),
                        title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
                        artist: metadata.common.artist || 'Unknown Artist',
                        album: metadata.common.album || 'Unknown Album',
                        genre: metadata.common.genre ? metadata.common.genre.join(', ') : '',
                        duration: metadata.format.duration || 0,
                        format: metadata.format.codec || path.extname(filePath).slice(1).toUpperCase(),
                        bitrate: metadata.format.bitrate || 0,
                        sample_rate: metadata.format.sampleRate || 0,
                    };

                    // Insert into database
                    await new Promise((resolve, reject) => {
                        db.run(
                            `
                            INSERT OR REPLACE INTO audio_files 
                            (file_path, file_name, title, artist, album, genre, duration, format, bitrate, sample_rate, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                        `,
                            [
                                fileData.file_path,
                                fileData.file_name,
                                fileData.title,
                                fileData.artist,
                                fileData.album,
                                fileData.genre,
                                fileData.duration,
                                fileData.format,
                                fileData.bitrate,
                                fileData.sample_rate,
                            ],
                            function (err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(this.lastID);
                                }
                            }
                        );
                    });

                    results.push({ success: true, file: fileData.file_name });

                    // Send progress update
                    event.sender.send('import-progress', {
                        current: results.length,
                        total: paths.length,
                        file: fileData.file_name,
                    });
                } catch (error) {
                    console.error('Error importing file:', filePath, error);
                    results.push({ success: false, file: path.basename(filePath), error: error.message });
                }
            }

            return { results, total: paths.length };
        });

        logInfo('✅ Basic handlers registered');
    } catch (error) {
        logInfo('❌ Error registering basic handlers: ' + error.message);
    }

    try {
        // Simple Player handlers
        const simplePlayerHandlers = createSimplePlayerHandlers(db);
        ipcMain.handle('get-track-for-player', simplePlayerHandlers.getTrackForPlayerHandler);
        logInfo('✅ Simple Player handlers registered');
    } catch (error) {
        logInfo('❌ Error registering Simple Player handlers: ' + error.message);
    }

    try {
        // Smart Playlist handlers
        const smartPlaylistHandlers = createSmartPlaylistHandlers(db);
        ipcMain.handle('preview-smart-playlist', smartPlaylistHandlers.previewHandler);
        ipcMain.handle('create-smart-playlist', smartPlaylistHandlers.createHandler);
        ipcMain.handle('get-smart-playlists', smartPlaylistHandlers.getSmartPlaylistsHandler);
        ipcMain.handle('update-smart-playlist', smartPlaylistHandlers.updateSmartPlaylistHandler);
        logInfo('✅ Smart Playlist handlers registered');
    } catch (error) {
        logInfo('❌ Error registering Smart Playlist handlers: ' + error.message);
    }

    try {
        // Energy Flow handlers
        const energyFlowHandlers = createEnergyFlowHandlers(db);
        ipcMain.handle('get-queue-tracks', energyFlowHandlers.getQueueTracksHandler);
        ipcMain.handle('analyze-energy-flow', energyFlowHandlers.analyzeFlowHandler);
        ipcMain.handle('optimize-energy-flow', energyFlowHandlers.optimizeFlowHandler);
        logInfo('✅ Energy Flow handlers registered');
    } catch (error) {
        logInfo('❌ Error registering Energy Flow handlers: ' + error.message);
    }

    try {
        // Export UI handlers
        ipcMain.handle('get-all-tracks-for-export', createGetAllTracksForExportHandler(db));
        ipcMain.handle('export-tracks', createExportTracksHandler(db));
        ipcMain.handle('get-export-formats', createGetExportFormatsHandler());
        logInfo('✅ Export handlers registered');
    } catch (error) {
        logInfo('❌ Error registering Export handlers: ' + error.message);
    }

    // Handler para Audio Configuration
    ipcMain.on('save-audio-config', (event, config) => {
        // Guardar configuración en archivo
        const configPath = path.join(__dirname, 'audio-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        logInfo('✅ Audio configuration saved:', config);

        // Enviar la configuración al renderer para aplicarla
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('audio-config-updated', config);
        }
    });

    // Handler para cargar configuración guardada
    ipcMain.handle('get-audio-config', async () => {
        const configPath = path.join(__dirname, 'audio-config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        }
        return null;
    });

    // Handler for detailed track metadata
    ipcMain.handle('get-track-metadata', async (event, filePath) => {
        const mm = require('music-metadata');

        try {
            const metadata = await mm.parseFile(filePath);
            return {
                format: metadata.format.codec || metadata.format.container,
                bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : null,
                sampleRate: metadata.format.sampleRate,
                duration: metadata.format.duration,
                lossless: metadata.format.lossless,
                channels: metadata.format.numberOfChannels,
                bitsPerSample: metadata.format.bitsPerSample,
            };
        } catch (error) {
            logError('Error parsing metadata:', error);
            return null;
        }
    });
    ipcMain.handle('export-dj-format', createExportHandler(db));
    ipcMain.handle('get-export-formats', createGetFormatsHandler());

    // Registrar normalization handlers
    const normHandlers = createNormalizationHandlers(db);
    ipcMain.handle('get-normalization-data', normHandlers.getNormalizationData);
    ipcMain.handle('save-normalization-data', normHandlers.saveNormalizationData);
    ipcMain.handle('get-unanalyzed-tracks', normHandlers.getUnanalyzedTracks);
    ipcMain.handle('save-batch-normalization', normHandlers.saveBatchNormalization);
    ipcMain.handle('get-normalization-stats', normHandlers.getNormalizationStats);
    ipcMain.handle('get-normalization-preferences', normHandlers.getNormalizationPreferences);

    // Handler para obtener path de assets
    ipcMain.handle('get-asset-path', (event, assetName) => {
        const assetPath = path.join(__dirname, 'assets', assetName);
        // Verificar que el archivo existe
        if (fs.existsSync(assetPath)) {
            return assetPath;
        }
        // Fallback a imagen por defecto
        return path.join(__dirname, 'assets/images/default-album.png');
    });
    ipcMain.handle('save-normalization-preferences', normHandlers.saveNormalizationPreferences);

    // Registrar audio handlers
    const audioHandlers = createAudioHandler(db);

    // Playback control
    ipcMain.handle('play-track', audioHandlers['play-track']);
    ipcMain.handle('play-file', audioHandlers['play-file']);
    ipcMain.handle('pause', audioHandlers['pause']);
    ipcMain.handle('resume', audioHandlers['resume']);
    ipcMain.handle('stop', audioHandlers['stop']);
    ipcMain.handle('next', audioHandlers['next']);
    ipcMain.handle('previous', audioHandlers['previous']);

    // Queue management
    ipcMain.handle('set-queue', audioHandlers['set-queue']);
    ipcMain.handle('add-to-queue', audioHandlers['add-to-queue']);
    ipcMain.handle('clear-queue', audioHandlers['clear-queue']);
    ipcMain.handle('get-queue', audioHandlers['get-queue']);

    // Player state
    ipcMain.handle('get-player-state', audioHandlers['get-player-state']);
    ipcMain.handle('set-volume', audioHandlers['set-volume']);
    ipcMain.handle('seek', audioHandlers['seek']);

    // Track analysis
    ipcMain.handle('analyze-track', audioHandlers['analyze-track']);
    ipcMain.handle('get-transition-points', audioHandlers['get-transition-points']);

    // Registrar playlist handlers con HAMMS
    const playlistHandlers = createPlaylistHandlers(db);

    // CRUD básico
    ipcMain.handle('create-playlist', playlistHandlers.createPlaylist);
    ipcMain.handle('get-playlists', playlistHandlers.getPlaylists);
    ipcMain.handle('get-playlist-with-tracks', playlistHandlers.getPlaylistWithTracks);
    ipcMain.handle('add-track-to-playlist', playlistHandlers.addTrackToPlaylist);
    ipcMain.handle('remove-track-from-playlist', playlistHandlers.removeTrackFromPlaylist);
    ipcMain.handle('update-playlist', playlistHandlers.updatePlaylist);
    ipcMain.handle('delete-playlist', playlistHandlers.deletePlaylist);

    // Smart Playlists
    ipcMain.handle('create-smart-playlist', playlistHandlers.createSmartPlaylist);
    ipcMain.handle('get-smart-playlist-tracks', playlistHandlers.getSmartPlaylistTracks);

    // HAMMS Recommendations
    ipcMain.handle('get-hamms-recommendations', playlistHandlers.getHAMMSRecommendations);
    ipcMain.handle('create-hamms-playlist', playlistHandlers.createHAMMSPlaylist);

    // Análisis armónico
    ipcMain.handle('get-harmonic-matches', playlistHandlers.getHarmonicMatches);

    // Tags personalizados
    ipcMain.handle('create-tag', playlistHandlers.createTag);
    ipcMain.handle('add-tag-to-track', playlistHandlers.addTagToTrack);

    // Historial y estadísticas
    ipcMain.handle('record-play-history', playlistHandlers.recordPlayHistory);
    ipcMain.handle('get-playlist-stats', playlistHandlers.getPlaylistStats);

    // Registrar advanced playlist handlers - COMENTADO TEMPORALMENTE POR ERROR
    // const advancedPlaylistHandlers = createAdvancedPlaylistHandlers(db);

    // // Ordenamiento
    // ipcMain.handle('reorder-playlist-tracks', advancedPlaylistHandlers.reorderPlaylistTracks);
    // ipcMain.handle('move-track-in-playlist', advancedPlaylistHandlers.moveTrackInPlaylist);

    // // Duplicación y merge
    // ipcMain.handle('duplicate-playlist', advancedPlaylistHandlers.duplicatePlaylist);
    // ipcMain.handle('merge-playlists', advancedPlaylistHandlers.mergePlaylists);

    // // Folders
    // ipcMain.handle('create-playlist-folder', advancedPlaylistHandlers.createPlaylistFolder);
    // ipcMain.handle('move-playlist-to-folder', advancedPlaylistHandlers.movePlaylistToFolder);
    // ipcMain.handle('get-playlist-hierarchy', advancedPlaylistHandlers.getPlaylistHierarchy);

    // // Export avanzado
    // ipcMain.handle('export-to-rekordbox', advancedPlaylistHandlers.exportToRekordbox);
    // ipcMain.handle('export-to-m3u8', advancedPlaylistHandlers.exportToM3U8);

    // // Analytics
    // ipcMain.handle('get-playlist-analytics', advancedPlaylistHandlers.getPlaylistAnalytics);

    // // Auto-arrange
    // ipcMain.handle('auto-arrange-by-energy', advancedPlaylistHandlers.autoArrangeByEnergy);
    // ipcMain.handle('auto-arrange-by-key', advancedPlaylistHandlers.autoArrangeByKey);
    // ipcMain.handle('suggest-next-track', advancedPlaylistHandlers.suggestNextTrack);

    // Handler para guardar configuración de audio desde el menú
    ipcMain.on('save-audio-config', (event, config) => {
        logDebug('Audio configuration saved:', config);
        // Enviar la configuración actualizada a la ventana principal
        if (mainWindow) {
            mainWindow.webContents.send('audio-config-updated', config);
        }
    });

    // Asegurarse de que el nombre está configurado
    if (process.platform === 'darwin') {
        app.setName('MAP');
    }

    // Crear el menú ANTES de las ventanas
    createApplicationMenu();

    // ==================== METADATA VIEWER HANDLERS ====================
    const mm = require('music-metadata');
    const fsPromises = require('fs').promises;

    // Obtener estadísticas de la base de datos
    ipcMain.handle('get-database-stats', async () => {
        return new Promise((resolve, reject) => {
            const queries = {
                totalFiles: 'SELECT COUNT(*) as count FROM audio_files',
                withArtwork: 'SELECT COUNT(*) as count FROM audio_files WHERE artwork_path IS NOT NULL',
                withAI: 'SELECT COUNT(*) as count FROM llm_metadata WHERE AI_BPM IS NOT NULL',
                avgBPM: 'SELECT AVG(AI_BPM) as avg FROM llm_metadata WHERE AI_BPM IS NOT NULL',
            };

            const stats = {};
            let completed = 0;

            Object.entries(queries).forEach(([key, query]) => {
                db.get(query, (err, row) => {
                    if (!err && row) {
                        stats[key] = row.count || row.avg || 0;
                    }
                    completed++;
                    if (completed === Object.keys(queries).length) {
                        resolve(stats);
                    }
                });
            });
        });
    });

    // Buscar archivos por término
    ipcMain.handle('search-metadata', async (event, searchTerm) => {
        return new Promise((resolve, reject) => {
            const query = `
            SELECT file_path, title, artist, album 
            FROM audio_files 
            WHERE title LIKE ? OR artist LIKE ? OR file_name LIKE ? OR album LIKE ?
            LIMIT 10
        `;
            const pattern = `%${searchTerm}%`;

            db.all(query, [pattern, pattern, pattern, pattern], (err, rows) => {
                if (err) {
                    logError('Search error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    });

    // Obtener archivo aleatorio
    ipcMain.handle('get-random-file', async () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT file_path FROM audio_files ORDER BY RANDOM() LIMIT 1', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    });

    // Obtener metadatos completos de un archivo
    ipcMain.handle('get-file-metadata', async (event, filePath) => {
        try {
            const result = {
                filePath: filePath,
                artwork: null,
                fileSize: null,
                format: null,
                metadata: null,
                database: null,
                ai: null,
            };

            // Obtener tamaño del archivo
            try {
                const stats = await fs.stat(filePath);
                result.fileSize = stats.size;
            } catch (err) {
                logError('Error getting file stats:', err);
            }

            // Obtener metadatos del archivo
            try {
                const metadata = await mm.parseFile(filePath);

                result.format = {
                    container: metadata.format.container,
                    codec: metadata.format.codec,
                    sampleRate: metadata.format.sampleRate,
                    bitrate: metadata.format.bitrate,
                    duration: metadata.format.duration,
                    channels: metadata.format.numberOfChannels,
                    lossless: metadata.format.lossless,
                };

                result.metadata = {
                    title: metadata.common.title,
                    artist: metadata.common.artist,
                    album: metadata.common.album,
                    year: metadata.common.year,
                    genre: metadata.common.genre?.join(', '),
                    track: metadata.common.track ? `${metadata.common.track.no}/${metadata.common.track.of}` : null,
                    bpm: metadata.common.bpm,
                    key: metadata.common.key,
                    isrc: metadata.common.isrc,
                    label: metadata.common.label,
                    composer: metadata.common.composer,
                };
            } catch (err) {
                logError('Error parsing metadata:', err);
            }

            // Obtener datos de la base de datos
            const dbData = await new Promise((resolve) => {
                const query = `
                SELECT 
                    af.*,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.file_path = ?
            `;

                db.get(query, [filePath], (err, row) => {
                    if (err) {
                        logError('Database error:', err);
                        resolve(null);
                    } else {
                        resolve(row);
                    }
                });
            });

            if (dbData) {
                result.database = {
                    id: dbData.id,
                    title: dbData.title,
                    artist: dbData.artist,
                    album: dbData.album,
                    genre: dbData.genre,
                    created_at: dbData.created_at,
                    updated_at: dbData.updated_at,
                };

                if (dbData.artwork_path) {
                    result.artwork = dbData.artwork_path;
                }

                if (dbData.file_id) {
                    result.ai = {
                        LLM_GENRE: dbData.LLM_GENRE,
                        AI_MOOD: dbData.AI_MOOD,
                        LLM_MOOD: dbData.LLM_MOOD,
                        AI_ENERGY: dbData.AI_ENERGY,
                        AI_BPM: dbData.AI_BPM,
                        AI_KEY: dbData.AI_KEY,
                        AI_DANCEABILITY: dbData.AI_DANCEABILITY,
                        AI_VALENCE: dbData.AI_VALENCE,
                        AI_ACOUSTICNESS: dbData.AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS: dbData.AI_INSTRUMENTALNESS,
                        AI_LIVENESS: dbData.AI_LIVENESS,
                        AI_SPEECHINESS: dbData.AI_SPEECHINESS,
                        AI_LOUDNESS: dbData.AI_LOUDNESS,
                    };
                }
            }

            return result;
        } catch (error) {
            logError('Error in get-file-metadata:', error);
            throw error;
        }
    });

    // Crear splash screen y ventana principal DESPUÉS de inicializar handlers
    logInfo('✅ All handlers initialized, creating windows...');
    createSplashScreen();
    createWindow();
    logInfo('✅ Windows created');
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                }
            });
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            }
        });
    }
});
