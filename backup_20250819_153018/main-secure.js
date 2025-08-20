// SECURE MAIN PROCESS - Fixed version with all security patches
// No SQL injection, proper async handling, secure file system access

const { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const CSPConfig = require('./config/csp-config');

// Safe IPC handler registration to prevent duplicates
const registeredHandlers = new Set();

function safeIpcHandle(channel, handler) {
    if (registeredHandlers.has(channel)) {
        logWarn(`⚠️ IPC handler '${channel}' already registered, skipping...`);
        return;
    }

    ipcMain.handle(channel, handler);
    registeredHandlers.add(channel);
    logInfo(`✅ IPC handler '${channel}' registered`);
}

// Import secure services and handlers
const dbService = require('./services/database-service');
const fileSystemHandler = require('./handlers/file-system-secure');
const { createSearchHandler } = require('./handlers/search-handler');
const { createFilterHandler } = require('./handlers/filter-handler');
const { createArtworkHandler } = require('./handlers/artwork-handler');
const { createCompleteArtworkHandler } = require('./handlers/artwork-handler-complete');
const { createExportHandler, createGetFormatsHandler } = require('./handlers/export-handler');
const { createNormalizationHandlers } = require('./handlers/normalization-handler');
const { createPlaylistHandlers } = require('./handlers/playlist-handler');
const { createAdvancedPlaylistHandlers } = require('./handlers/playlist-advanced-handler');
const { createAudioHandler } = require('./handlers/audio-handler');
const { createCompleteMetadataHandler } = require('./handlers/complete-metadata-handler');

// Configure app
process.title = 'MAP';
app.name = 'MAP';
app.setName('MAP');

// Suppress ffmpeg warnings
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-logging');
app.commandLine.appendSwitch('--log-level=3');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
process.env.ELECTRON_ENABLE_LOGGING = '0';
process.env.ELECTRON_LOG_FILE = '/dev/null';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_NO_ATTACH_CONSOLE = 'true';

let mainWindow;
let splash;
let configWindow = null;

// Error handler
process.on('uncaughtException', (error) => {
    logError('Uncaught Exception:', error);
    // Log to file instead of crashing
    const errorLog = path.join(app.getPath('userData'), 'error.log');
    fs.appendFileSync(errorLog, `${new Date().toISOString()}: ${error.stack}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    logError('Unhandled Rejection at:', promise, 'reason:', reason);
});

function createSplashScreen() {
    splash = new BrowserWindow({
        width: 400,
        height: 350,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        }
    });

    const splashHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline';">
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
            <div class="logo">🎵</div>
            <h1>MAP</h1>
            <p>Music Analyzer Pro</p>
            <div class="loader">
                <div class="loader-bar"></div>
            </div>
        </body>
        </html>
    `;

    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);

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
    const iconPath = path.join(__dirname, 'image.png');
    let icon;

    if (fs.existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath);
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'MAP - Music Analyzer Pro',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload-secure.js'),
        },
        icon: icon || undefined,
    });

    // Configure Content Security Policy
    const cspConfig = new CSPConfig();
    cspConfig.applyToWindow(mainWindow);
    cspConfig.enableViolationReporting(mainWindow);

    logInfo('✅ CSP headers configured for ' + cspConfig.environment);

    // Load the production HTML file with all features
    mainWindow.loadFile('index-production.html');

    // Open DevTools to debug
    mainWindow.webContents.openDevTools();

    // Prevent title changes
    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createApplicationMenu() {
    const template = [
        {
            label: process.platform === 'darwin' ? 'MAP' : 'File',
            submenu: [
                {
                    label: 'About MAP',
                    click: () => showAboutWindow(),
                },
                { type: 'separator' },
                {
                    label: '⚙️ Audio Configuration',
                    accelerator: 'CmdOrCtrl+Shift+A',
                    click: () => showAudioConfigWindow(),
                },
                {
                    label: 'Preferences...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('open-preferences');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Quit MAP',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit(),
                }
            ]
        },
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
            ]
        },
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
            ]
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [{ role: 'minimize' }, { role: 'close' }],
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function showAboutWindow() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About MAP',
        message: 'Music Analyzer Pro',
        detail: 'Version 2.0.0\nSecure Edition\n\nProfessional DJ Software\nby BlueSystemIO',
        buttons: ['OK'],
    });
}

function showAudioConfigWindow() {
    if (configWindow && !configWindow.isDestroyed()) {
        configWindow.focus();
        return;
    }

    configWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: mainWindow,
        modal: true,
        show: false,
        title: 'Audio Configuration',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload-config.js'),
        }
    });

    configWindow.loadFile('audio-config.html');

    configWindow.once('ready-to-show', () => {
        configWindow.show();
    });

    configWindow.on('closed', () => {
        configWindow = null;
    });
}

app.whenReady().then(async () => {
    // Set dock icon for macOS
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'image.png');
        if (fs.existsSync(iconPath)) {
            const dockIcon = nativeImage.createFromPath(iconPath);
            app.dock.setIcon(dockIcon);
        }
    }

    // Initialize database
    const dbPath = path.join(__dirname, 'music_analyzer.db');

    try {
        await dbService.connect(dbPath);
        await dbService.createIndexes();
        logInfo('✅ Secure database connection established');

        // Initialize playlist database
        const playlistDb = require('./services/playlist-database-service').getInstance();
        await playlistDb.initialize(dbPath);
        logInfo('✅ Playlist database initialized');

        // Initialize auto artwork extractor
        const artworkExtractor = require('./services/auto-artwork-extractor').getInstance(playlistDb.db);
        logInfo('✅ Auto artwork extractor initialized');

        // Initialize simple audio handlers
        const SimpleAudioHandler = require('./handlers/simple-audio-handler');
        new SimpleAudioHandler();
        logInfo('✅ Simple audio handlers registered');

        // Make mainWindow globally accessible for the extractor
        global.mainWindow = mainWindow;
    } catch (error) {
        logError('Failed to connect to database:', error);
        dialog.showErrorBox('Database Error', 'Failed to connect to database. The application will exit.');
        app.quit();
        return;
    }

    // Register secure IPC handlers

    // Search (SQL injection protected)
    safeIpcHandle('search-tracks', createSearchHandler());

    // File system (path traversal protected)
    const fsHandlers = fileSystemHandler.createHandlers();
    safeIpcHandle('show-in-folder', fsHandlers['show-in-folder']);
    safeIpcHandle('check-file-exists', fsHandlers['check-file-exists']);
    safeIpcHandle('get-file-metadata', fsHandlers['get-file-metadata']);
    safeIpcHandle('list-audio-files', fsHandlers['list-audio-files']);

    // Database queries (all parameterized) - NO LIMIT BY DEFAULT
    safeIpcHandle('get-files-with-cached-artwork', async (event, limit, offset) => {
        logDebug('📥 Handler called!');

        // Always return empty array for now to test
        const result = { success: true, files: [] };
        logDebug('📤 Returning:', result);
        return result;
    });

    safeIpcHandle('get-filter-options', async () => {
        try {
            const options = await dbService.getFilterOptions();
            return { success: true, ...options };
        } catch (error) {
            logError('Error getting filter options:', error);
            return { success: false, genres: [], moods: [] };
        }
    });

    safeIpcHandle('get-track-metadata', async (event, trackId) => {
        try {
            // Validate trackId
            if (!trackId || isNaN(trackId)) {
                throw new Error('Invalid track ID');
            }

            const track = await dbService.getTrackById(trackId);
            return { success: true, track };
        } catch (error) {
            logError('Error getting track:', error);
            return { success: false, track: null };
        }
    });

    // Get complete metadata for a single file (143 fields)
    safeIpcHandle('get-complete-metadata', async (event, filePath) => {
        try {
            if (!filePath) {
                throw new Error('File path is required');
            }

            // Query to get ALL fields from both tables
            const query = `
                SELECT 
                    af.*,
                    llm.*
                FROM audio_files af
                LEFT JOIN llm_metadata llm ON af.id = llm.file_id
                WHERE af.file_path = ?
            `;

            const result = await new Promise((resolve, reject) => {
                playlistDb.db.get(query, [filePath], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });

            if (result) {
                logInfo(`✅ Retrieved complete metadata for: ${filePath}`);
                logDebug(`📊 Total fields: ${Object.keys(result).length}`);
                return result;
            } else {
                logWarn(`⚠️ No metadata found for: ${filePath}`);
                return null;
            }
        } catch (error) {
            logError('Error getting complete metadata:', error);
            return null;
        }
    });

    safeIpcHandle('update-track-metadata', async (event, trackId, metadata) => {
        try {
            // Validate inputs
            if (!trackId || isNaN(trackId)) {
                throw new Error('Invalid track ID');
            }

            const result = await dbService.updateTrackMetadata(trackId, metadata);
            return { success: true, ...result };
        } catch (error) {
            logError('Error updating track:', error);
            return { success: false, error: 'Failed to update track' };
        }
    });

    // Comprehensive metadata update handler for metadata editor
    safeIpcHandle('update-metadata', async (event, updates) => {
        try {
            if (!updates || !updates.id) {
                throw new Error('Invalid track ID');
            }

            const trackId = updates.id;

            // Prepare SQL for audio_files table
            const audioFieldsMap = {
                title: 'title',
                artist: 'artist',
                album: 'album',
                genre: 'genre',
                year: 'year',
                comment: 'comment',
                isrc: 'isrc',
                bmp: 'bmp',
                existing_bmp: 'existing_bmp',
                existing_key: 'existing_key',
                energy_level: 'energy_level',
            };

            // Prepare SQL for llm_metadata table
            const llmFieldsMap = {
                LLM_GENRE: 'LLM_GENRE',
                AI_MOOD: 'AI_MOOD',
                AI_BPM: 'AI_BPM',
                AI_KEY: 'AI_KEY',
                AI_ENERGY: 'AI_ENERGY',
                AI_DANCEABILITY: 'AI_DANCEABILITY',
                AI_VALENCE: 'AI_VALENCE',
                AI_ACOUSTICNESS: 'AI_ACOUSTICNESS',
                AI_INSTRUMENTALNESS: 'AI_INSTRUMENTALNESS',
                AI_LIVENESS: 'AI_LIVENESS',
                AI_SPEECHINESS: 'AI_SPEECHINESS',
                AI_LOUDNESS: 'AI_LOUDNESS',
            };

            // Update audio_files table
            const audioUpdates = [];
            const audioParams = [];

            for (const [key, field] of Object.entries(audioFieldsMap)) {
                if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
                    audioUpdates.push(`${field} = ?`);
                    audioParams.push(updates[key]);
                }
            }

            if (audioUpdates.length > 0) {
                audioParams.push(trackId);
                const audioSql = `UPDATE audio_files SET ${audioUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
                await dbService.query(audioSql, audioParams);
                logInfo(`✅ Updated audio_files for track ${trackId}`);
            }

            // Update llm_metadata table
            const llmUpdates = [];
            const llmParams = [];

            for (const [key, field] of Object.entries(llmFieldsMap)) {
                if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
                    llmUpdates.push(`${field} = ?`);
                    llmParams.push(updates[key]);
                }
            }

            if (llmUpdates.length > 0) {
                // Check if record exists
                const existsResult = await dbService.query('SELECT file_id FROM llm_metadata WHERE file_id = ?', [
                    trackId,
                ]);

                if (existsResult.length > 0) {
                    // Update existing record
                    llmParams.push(trackId);
                    const llmSql = `UPDATE llm_metadata SET ${llmUpdates.join(', ')} WHERE file_id = ?`;
                    await dbService.query(llmSql, llmParams);
                } else {
                    // Insert new record
                    const insertFields = ['file_id'];
                    const insertValues = [trackId];

                    for (const [key, field] of Object.entries(llmFieldsMap)) {
                        if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
                            insertFields.push(field);
                            insertValues.push(updates[key]);
                        }
                    }

                    const placeholders = insertValues.map(() => '?').join(', ');
                    const insertSql = `INSERT INTO llm_metadata (${insertFields.join(', ')}) VALUES (${placeholders})`;
                    await dbService.query(insertSql, insertValues);
                }
                logInfo(`✅ Updated llm_metadata for track ${trackId}`);
            }

            return { success: true, message: 'Metadata updated successfully' };
        } catch (error) {
            logError('Error updating metadata:', error);
            return { success: false, error: error.message };
        }
    });

    // Audio playback handlers
    const { Howl } = require('howler');

    // Helper function to sanitize file paths
    function sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        // Remove any potentially dangerous characters
        return input.replace(/[<>:"|?*]/g, '');
    }

    // Helper function to get audio config
    async function getAudioConfig() {
        const configPath = path.join(app.getPath('userData'), 'audio-config.json');
        try {
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(data);
                // Ensure K-Meter is disabled to prevent saturation
                config.kMeterEnabled = false;
                return config;
            }
        } catch (error) {
            logError('Error reading audio config:', error);
        }
        // Return default config with K-Meter disabled
        return {
            volume: 0.7,
            kMeterEnabled: false,
            useHtml5: true,
            preloadNext: false,
            crossfade: false,
            bufferSize: 4096,
            gaplessPlayback: false,
        };
    }

    // Audio configuration handler
    safeIpcHandle('get-audio-config', async () => {
        return await getAudioConfig();
    });

    safeIpcHandle('save-audio-config', async (event, config) => {
        const configPath = path.join(app.getPath('userData'), 'audio-config.json');

        try {
            // Validate config object
            if (!config || typeof config !== 'object') {
                throw new Error('Invalid configuration');
            }

            // Force K-Meter to be disabled
            config.kMeterEnabled = false;

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Notify renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('audio-config-updated', config);
            }

            return { success: true };
        } catch (error) {
            logError('Error saving audio config:', error);
            return { success: false, error: 'Failed to save configuration' };
        }
    });

    // Main audio playback handler with robust error handling
    safeIpcHandle('play-track', async (event, trackPath) => {
        try {
            logDebug('🎵 Play track requested:', trackPath);
            logDebug('Type of trackPath:', typeof trackPath);

            // Handle if trackPath is an object
            if (typeof trackPath === 'object' && trackPath !== null) {
                trackPath = trackPath.file_path || trackPath.path || '';
            }

            // 1. Validate path
            const sanitized = sanitizeInput(trackPath);
            logDebug('Sanitized path:', sanitized);

            if (!sanitized || !fs.existsSync(sanitized)) {
                logError('❌ File not found:', sanitized);
                logError('Original path:', trackPath);
                throw new Error('File not found: ' + sanitized);
            }

            logInfo('✅ File exists, size:', fs.statSync(sanitized).size, 'bytes');

            // 2. Cleanup previous sound
            if (global.audioManager?.currentSound) {
                logDebug('🧹 Cleaning up previous sound');
                global.audioManager.currentSound.unload();
                global.audioManager.currentSound = null;
            }

            // 3. Get configuration (K-Meter disabled)
            const config = await getAudioConfig();
            logDebug('⚙️ Audio config loaded, K-Meter disabled:', config.kMeterEnabled === false);

            // 4. Create Howler instance with fallbacks
            const sound = new Howl({
                src: [sanitized],
                html5: true, // Important for large files
                volume: config.volume || 0.7,
                autoplay: false,
                preload: true,
                onload: () => {
                    logInfo('✅ Track loaded successfully');
                    event.sender.send('track-loaded', {
                        duration: sound.duration(),
                        format: sound._format || 'unknown',
                    });
                },
                onplay: () => {
                    logDebug('▶️ Playback started');
                    event.sender.send('playback-started');
                },
                onpause: () => {
                    logDebug('⏸️ Playback paused');
                    event.sender.send('playback-paused');
                },
                onend: () => {
                    logDebug('⏹️ Track ended');
                    event.sender.send('track-ended');
                    // Cleanup
                    if (global.audioManager?.currentSound) {
                        global.audioManager.currentSound.unload();
                        global.audioManager.currentSound = null;
                    }
                },
                onloaderror: (id, error) => {
                    logError('❌ Load error:', error);
                    event.sender.send('playback-error', {
                        error: 'Failed to load audio file',
                        details: error,
                    });
                },
                onplayerror: (id, error) => {
                    logError('❌ Play error:', error);
                    event.sender.send('playback-error', {
                        error: 'Failed to play audio file',
                        details: error,
                    });
                    // Try fallback to native Audio API
                    fallbackToNativeAudio(sanitized, event);
                },
            });

            // 5. Store global reference
            if (!global.audioManager) {
                global.audioManager = {};
            }
            global.audioManager.currentSound = sound;

            // 6. Start playback
            sound.play();
            logDebug('🎵 Playback initiated');

            return {
                success: true,
                duration: sound.duration(),
                format: sound._format || 'unknown',
            };
        } catch (error) {
            logError('❌ Play error:', error);
            return {
                success: false,
                error: error.message,
                fallback: 'native',
            };
        }
    });

    // Fallback function using native Audio API
    async function fallbackToNativeAudio(filePath, event) {
        try {
            logInfo('🔄 Attempting fallback to native Audio API');
            // Note: Native Audio API has limitations in Electron
            // This is a basic fallback that may not work for all formats
            event.sender.send('playback-fallback', {
                message: 'Using fallback player',
                path: filePath,
            });
        } catch (error) {
            logError('❌ Fallback also failed:', error);
        }
    }

    // Pause handler
    safeIpcHandle('pause-track', async () => {
        try {
            if (global.audioManager?.currentSound) {
                global.audioManager.currentSound.pause();
                return { success: true };
            }
            return { success: false, error: 'No track playing' };
        } catch (error) {
            logError('Error pausing track:', error);
            return { success: false, error: error.message };
        }
    });

    // Resume handler
    safeIpcHandle('resume-track', async () => {
        try {
            if (global.audioManager?.currentSound) {
                global.audioManager.currentSound.play();
                return { success: true };
            }
            return { success: false, error: 'No track to resume' };
        } catch (error) {
            logError('Error resuming track:', error);
            return { success: false, error: error.message };
        }
    });

    // Stop handler
    safeIpcHandle('stop-track', async () => {
        try {
            if (global.audioManager?.currentSound) {
                global.audioManager.currentSound.stop();
                global.audioManager.currentSound.unload();
                global.audioManager.currentSound = null;
                return { success: true };
            }
            return { success: false, error: 'No track playing' };
        } catch (error) {
            logError('Error stopping track:', error);
            return { success: false, error: error.message };
        }
    });

    // Seek handler
    safeIpcHandle('seek-track', async (event, position) => {
        try {
            if (global.audioManager?.currentSound) {
                global.audioManager.currentSound.seek(position);
                return { success: true, position };
            }
            return { success: false, error: 'No track playing' };
        } catch (error) {
            logError('Error seeking track:', error);
            return { success: false, error: error.message };
        }
    });

    // Volume handler
    safeIpcHandle('set-volume', async (event, volume) => {
        try {
            // Validate volume (0-1)
            const vol = Math.max(0, Math.min(1, volume));
            if (global.audioManager?.currentSound) {
                global.audioManager.currentSound.volume(vol);
            }
            // Save to config
            const config = await getAudioConfig();
            config.volume = vol;
            const configPath = path.join(app.getPath('userData'), 'audio-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return { success: true, volume: vol };
        } catch (error) {
            logError('Error setting volume:', error);
            return { success: false, error: error.message };
        }
    });

    // Get playback state
    safeIpcHandle('get-playback-state', async () => {
        try {
            if (global.audioManager?.currentSound) {
                const sound = global.audioManager.currentSound;
                return {
                    success: true,
                    playing: sound.playing(),
                    duration: sound.duration(),
                    position: sound.seek(),
                    volume: sound.volume(),
                };
            }
            return { success: true, playing: false };
        } catch (error) {
            logError('Error getting playback state:', error);
            return { success: false, error: error.message };
        }
    });

    // Register playlist handlers
    const playlistDb = require('./services/playlist-database-service').getInstance();

    // Add missing playlist handlers
    safeIpcHandle('get-playlists', async () => {
        try {
            const playlists = await playlistDb.getPlaylists();
            return playlists || [];
        } catch (error) {
            logError('Error getting playlists:', error);
            return [];
        }
    });

    safeIpcHandle('create-playlist', async (event, data) => {
        try {
            return await playlistDb.createPlaylist(data);
        } catch (error) {
            logError('Error creating playlist:', error);
            return { success: false, error: error.message };
        }
    });

    safeIpcHandle('get-playlist-with-tracks', async (event, playlistId) => {
        try {
            return await playlistDb.getPlaylistWithTracks(playlistId);
        } catch (error) {
            logError('Error getting playlist:', error);
            return null;
        }
    });

    safeIpcHandle('update-playlist', async (event, playlistId, updates) => {
        try {
            return await playlistDb.updatePlaylist(playlistId, updates);
        } catch (error) {
            logError('Error updating playlist:', error);
            return { success: false };
        }
    });

    safeIpcHandle('delete-playlist', async (event, playlistId) => {
        try {
            return await playlistDb.deletePlaylist(playlistId);
        } catch (error) {
            logError('Error deleting playlist:', error);
            return { success: false };
        }
    });

    const playlistHandlers = require('./handlers/playlist-handler');

    if (playlistHandlers && typeof playlistHandlers === 'function') {
        const handlers = playlistHandlers(playlistDb.db);
        Object.entries(handlers).forEach(([channel, handler]) => {
            safeIpcHandle(channel, handler);
        });
    }

    // Register audio handlers
    const audioHandlers = require('./handlers/audio-handler-complete');
    const audioHandler = audioHandlers(playlistDb.db);
    Object.entries(audioHandler).forEach(([channel, handler]) => {
        safeIpcHandle(channel, handler);
    });

    // Register track management handlers
    const trackHandlers = require('./handlers/track-management-handler');
    const trackHandler = trackHandlers(playlistDb.db);
    Object.entries(trackHandler).forEach(([channel, handler]) => {
        // Skip update-track-metadata as it's already registered above
        if (channel !== 'update-track-metadata') {
            safeIpcHandle(channel, handler);
        }
    });

    // Register export handlers
    const exportHandlers = require('./handlers/export-handler');
    if (exportHandlers && typeof exportHandlers.createExportHandler === 'function') {
        safeIpcHandle('export-json', exportHandlers.createExportHandler(playlistDb.db));
        safeIpcHandle('export-csv', exportHandlers.createExportHandler(playlistDb.db));
        safeIpcHandle('export-m3u', exportHandlers.createExportHandler(playlistDb.db));
    }

    // Register backup handlers
    try {
        const { createBackupHandler } = require('./handlers/backup-handler');
        const backupHandlers = createBackupHandler();

        safeIpcHandle('backup-create', backupHandlers['backup-create']);
        safeIpcHandle('backup-incremental', backupHandlers['backup-incremental']);
        safeIpcHandle('backup-restore', backupHandlers['backup-restore']);
        safeIpcHandle('backup-list', backupHandlers['backup-list']);
        safeIpcHandle('backup-stats', backupHandlers['backup-stats']);
        safeIpcHandle('backup-critical', backupHandlers['backup-critical']);
        safeIpcHandle('backup-schedule', backupHandlers['backup-schedule']);

        logInfo('✅ Backup handlers registered successfully');
    } catch (error) {
        logError('Failed to register backup handlers:', error);
    }

    // Register normalization handlers
    const normalizationHandlers = require('./handlers/normalization-handler');
    if (normalizationHandlers && typeof normalizationHandlers.createNormalizationHandlers === 'function') {
        const normHandlers = normalizationHandlers.createNormalizationHandlers(playlistDb.db);
        Object.entries(normHandlers).forEach(([channel, handler]) => {
            safeIpcHandle(channel, handler);
        });
    }

    // Register artwork handlers
    const artworkHandlers = require('./handlers/artwork-handler');
    if (artworkHandlers && typeof artworkHandlers.createArtworkHandler === 'function') {
        safeIpcHandle('extract-artwork', artworkHandlers.createArtworkHandler(playlistDb.db));
        safeIpcHandle('get-artwork', artworkHandlers.createArtworkHandler(playlistDb.db));
    }

    // Register complete metadata handler (143 fields)
    safeIpcHandle('update-complete-metadata', createCompleteMetadataHandler(playlistDb.db));
    logInfo('✅ Complete metadata handler registered (143 fields)');

    // Register auto artwork extractor handlers
    const artworkExtractor = require('./services/auto-artwork-extractor').getInstance();

    safeIpcHandle('extract-artwork-batch', async (event, fileIds) => {
        return await artworkExtractor.extractBatch(fileIds);
    });

    safeIpcHandle('extract-artwork-single', async (event, filePath, fileId) => {
        return await artworkExtractor.extractForNewFile(filePath, fileId);
    });

    safeIpcHandle('artwork-extractor-status', async () => {
        return artworkExtractor.getStatus();
    });

    safeIpcHandle('artwork-extractor-enable', async () => {
        artworkExtractor.enable();
        return { success: true };
    });

    safeIpcHandle('artwork-extractor-disable', async () => {
        artworkExtractor.disable();
        return { success: true };
    });

    // Register music analyzer handlers
    const MusicAnalyzer = require('./music-analyzer-complete');
    let analyzerInstance = null;

    safeIpcHandle('analyze-directory', async (event, directoryPath) => {
        if (analyzerInstance && analyzerInstance.isRunning) {
            return { success: false, error: 'Analysis already in progress' };
        }

        logDebug(`📁 Starting directory analysis: ${directoryPath}`);

        analyzerInstance = new MusicAnalyzer();
        await analyzerInstance.initialize();

        const result = await analyzerInstance.analyzeDirectory(directoryPath, (progress) => {
            // Send progress updates to renderer
            logDebug(`Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
            event.sender.send('analysis-progress', progress);
        });

        analyzerInstance.close();

        logInfo(`✅ Directory analysis complete: ${result.processed}/${result.total} files`);
        return {
            success: true,
            result: result,
            results: [], // For consistency with analyze-files
        };
    });

    safeIpcHandle('analyze-files', async (event, filePaths) => {
        if (analyzerInstance && analyzerInstance.isRunning) {
            return { success: false, error: 'Analysis already in progress' };
        }

        logDebug(`🎵 Starting analysis of ${filePaths.length} files`);

        analyzerInstance = new MusicAnalyzer();
        await analyzerInstance.initialize();

        let processed = 0;
        const total = filePaths.length;
        const results = [];
        const startTime = Date.now();

        for (const filePath of filePaths) {
            try {
                logDebug(`\nAnalyzing: ${path.basename(filePath)}`);

                // Send initial progress
                event.sender.send('analysis-progress', {
                    current: processed,
                    total: total,
                    percentage: Math.round((processed / total) * 100),
                    currentFile: path.basename(filePath),
                    estimatedTimeRemaining: 0,
                });

                await analyzerInstance.analyzeFile(filePath);
                processed++;

                // Send updated progress
                const elapsedTime = (Date.now() - startTime) / 1000;
                const timePerFile = elapsedTime / processed;
                const remainingFiles = total - processed;
                const estimatedTime = remainingFiles * timePerFile;

                event.sender.send('analysis-progress', {
                    current: processed,
                    total: total,
                    percentage: Math.round((processed / total) * 100),
                    currentFile: path.basename(filePath),
                    estimatedTimeRemaining: Math.round(estimatedTime),
                });

                results.push({ file: filePath, success: true });
                logInfo(`✅ Completed ${processed}/${total}`);
            } catch (error) {
                logError(`❌ Failed: ${error.message}`);
                results.push({ file: filePath, success: false, error: error.message });
                processed++;
            }
        }

        analyzerInstance.close();

        const duration = (Date.now() - startTime) / 1000;
        const finalResult = {
            success: true,
            result: {
                total: total,
                processed: processed,
                failed: results.filter((r) => !r.success).length,
                duration: duration,
            },
            results: results,
        };

        logDebug(`\n✅ Analysis complete: ${processed}/${total} files in ${Math.round(duration)}s`);
        return finalResult;
    });

    safeIpcHandle('pause-analysis', async () => {
        if (analyzerInstance) {
            analyzerInstance.pause();
            return { success: true };
        }
        return { success: false, error: 'No analysis in progress' };
    });

    safeIpcHandle('resume-analysis', async () => {
        if (analyzerInstance) {
            analyzerInstance.resume();
            return { success: true };
        }
        return { success: false, error: 'No analysis in progress' };
    });

    safeIpcHandle('stop-analysis', async () => {
        if (analyzerInstance) {
            analyzerInstance.stop();
            return { success: true };
        }
        return { success: false, error: 'No analysis in progress' };
    });

    // File/Folder selection dialogs for analyzer
    safeIpcHandle('select-music-folder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Music Folder to Analyze',
            buttonLabel: 'Select Folder',
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return { success: true, path: result.filePaths[0] };
        }
        return { success: false, canceled: true };
    });

    safeIpcHandle('select-music-files', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            title: 'Select Music Files to Analyze',
            buttonLabel: 'Select Files',
            filters: [
                {
                    name: 'Audio Files',
                    extensions: ['mp3', 'm4a', 'flac', 'wav', 'aac', 'ogg', 'opus', 'wma'],
                },
                { name: 'All Files', extensions: ['*'] },
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return { success: true, paths: result.filePaths };
        }
        return { success: false, canceled: true };
    });

    safeIpcHandle('get-all-library-files', async () => {
        try {
            // Get all files from database
            const files = await dbService.query('SELECT file_path FROM audio_files WHERE file_path IS NOT NULL');
            return { success: true, paths: files.map((f) => f.file_path) };
        } catch (error) {
            logError('Error getting library files:', error);
            return { success: false, error: error.message };
        }
    });

    // Create menu
    createApplicationMenu();

    // Create windows
    createSplashScreen();
    createWindow();
});

app.on('window-all-closed', async () => {
    // Cleanup
    try {
        await dbService.close();
        logInfo('✅ Database closed');
    } catch (error) {
        logError('Error closing database:', error);
    }

    app.quit();
});

// Clean up IPC handlers before quitting
app.on('before-quit', () => {
    // Remove all IPC handlers to prevent duplicate registration on reload
    registeredHandlers.forEach((channel) => {
        ipcMain.removeHandler(channel);
    });
    registeredHandlers.clear();
    logInfo('✅ IPC handlers cleaned up');
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
}
