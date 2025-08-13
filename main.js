// TASK_023: main.js modularizado - versión limpia
const { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configurar nombre de la aplicación - CODENAME: Sol
app.setName('Sol');

// Handlers modularizados
const { createSearchHandler } = require('./handlers/search-handler');
const { createFilterHandler } = require('./handlers/filter-handler');
const { createArtworkHandler } = require('./handlers/artwork-handler');
const { createExportHandler, createGetFormatsHandler } = require('./handlers/export-handler');
const { createNormalizationHandlers } = require('./handlers/normalization-handler');

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

    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
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
        title: 'Sol - Music Analyzer Pro',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // Para macOS, título integrado
        show: false, // No mostrar hasta que el splash termine
        webPreferences: {
            nodeIntegration: true,  // REVERTED - App needs this
            contextIsolation: false,  // REVERTED - For now
            webSecurity: false, // Para cargar imágenes locales
            // preload: path.join(__dirname, 'preload.js') // DISABLED for now
        },
        icon: icon || undefined // Usar el icono si existe
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
            label: process.platform === 'darwin' ? 'Sol' : 'File',
            submenu: [
                {
                    label: 'About Sol',
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
                ...(process.platform === 'darwin' ? [
                    {
                        label: 'Services',
                        role: 'services',
                        submenu: []
                    },
                    { type: 'separator' },
                    {
                        label: 'Hide Sol',
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
                ] : []),
                {
                    label: 'Quit Sol',
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
                ...(process.platform === 'darwin' ? [
                    { type: 'separator' },
                    { role: 'front' }
                ] : [])
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
                        require('electron').shell.openExternal('https://github.com/bluesystemio/music-analyzer');
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

// Ventana About Sol personalizada
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
    
    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
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
            <div class="logo">☀️</div>
            <div class="codename">Sol</div>
            <div class="title">Music Analyzer Pro</div>
            <div class="company">by BlueSystemIO | Audio Division</div>
            <div class="version">Version 1.0.0 - Codename: Sol</div>
        </body>
        </html>
    `)}`);
}

// Ventana de Configuración de Audio
function showAudioConfigWindow() {
    const configWindow = new BrowserWindow({
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
            <button onclick="saveConfig()" style="background: #667eea; color: white;">Save</button>
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
            
            // Load saved configuration
            window.addEventListener('DOMContentLoaded', () => {
                const saved = localStorage.getItem('audioConfig');
                if (saved) {
                    const config = JSON.parse(saved);
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
            });
            
            function saveConfig() {
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
                
                // Save locally
                localStorage.setItem('audioConfig', JSON.stringify(config));
                
                // Send to main process
                ipcRenderer.send('save-audio-config', config);
                window.close();
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
}

app.whenReady().then(() => {
    // Configurar icono del dock en macOS
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'image.png');
        if (fs.existsSync(iconPath)) {
            const dockIcon = nativeImage.createFromPath(iconPath);
            app.dock.setIcon(dockIcon);
        }
    }
    
    const dbPath = path.join(__dirname, 'music_analyzer.db');
    db = new sqlite3.Database(dbPath);
    
    console.log('✅ Base de datos conectada');
    
    // Registrar handlers
    ipcMain.handle('get-files-with-cached-artwork', createArtworkHandler(db));
    ipcMain.handle('search-tracks', createSearchHandler(db));
    ipcMain.handle('get-filter-options', createFilterHandler(db));
    
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
                bitsPerSample: metadata.format.bitsPerSample
            };
        } catch (error) {
            console.error('Error parsing metadata:', error);
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
    
    // Handler para guardar configuración de audio desde el menú
    ipcMain.on('save-audio-config', (event, config) => {
        console.log('Audio configuration saved:', config);
        // Enviar la configuración actualizada a la ventana principal
        if (mainWindow) {
            mainWindow.webContents.send('audio-config-updated', config);
        }
    });
    
    // Crear splash screen primero
    createSplashScreen();
    createWindow();
    createApplicationMenu(); // Crear el menú de aplicación
});

app.on('window-all-closed', () => {
    if (db) db.close();
    app.quit();
});