const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Database path
const dbPath = path.join(__dirname, 'music_analyzer.db');
let db;
let mainWindow;

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        title: 'MAP - Music Analyzer Pro',
    });

    // Load the main HTML file
    mainWindow.loadFile('index-views.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize database
function initDatabase() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err);
        } else {
            console.log('Connected to SQLite database');
            // Register IPC handlers AFTER database is connected
            registerIPCHandlers();
        }
    });
}

// Register all IPC handlers after database is connected
function registerIPCHandlers() {
    console.log('Registering IPC handlers...');

    // Handler para seleccionar ARCHIVOS individuales de música
    // COMENTADO: Ahora se usa el handler avanzado de import-music-handler.js
    /*
    ipcMain.handle('select-music-files', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Select Music Files',
            properties: ['openFile', 'multiSelections'],
            buttonLabel: 'Select Files',
            filters: [
                { name: 'Music Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'wma', 'aiff', 'opus', 'ape', 'webm', 'mp4'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            return { 
                filePaths: result.filePaths,
                fileCount: result.filePaths.length
            };
        }
        return null;
    });
    */

    // Handler para seleccionar CARPETA de música
    ipcMain.handle('select-music-folder', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Select Music Folder',
            properties: ['openDirectory'],
            buttonLabel: 'Select Folder',
        });

        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];

            // Count music files in folder
            let fileCount = 0;
            function countFiles(dir) {
                try {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            countFiles(fullPath);
                        } else if (stat.isFile()) {
                            const ext = path.extname(item).toLowerCase();
                            if (['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.aac', '.wma'].includes(ext)) {
                                fileCount++;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error counting files:', err);
                }
            }

            countFiles(folderPath);

            return { folderPath, fileCount };
        }
        return null;
    });

    // Handler para importar ARCHIVOS individuales
    ipcMain.handle('import-music-files', async (event, data) => {
        const musicMetadata = require('music-metadata');

        if (!data || !data.filePaths || data.filePaths.length === 0) {
            return { success: false, error: 'No files provided' };
        }

        const files = data.filePaths;
        let imported = 0;
        let errors = 0;

        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            try {
                const metadata = await musicMetadata.parseFile(filePath);
                const fileName = path.basename(filePath);

                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO audio_files 
                        (file_path, file_name, title, artist, album, genre, year, duration, file_extension) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            filePath,
                            fileName,
                            metadata.common.title || fileName,
                            metadata.common.artist || 'Unknown Artist',
                            metadata.common.album || 'Unknown Album',
                            metadata.common.genre ? metadata.common.genre[0] : null,
                            metadata.common.year,
                            metadata.format.duration,
                            path.extname(filePath),
                        ],
                        (err) => {
                            if (err) {
                                errors++;
                                console.error(`Error importing ${fileName}:`, err);
                                resolve();
                            } else {
                                imported++;
                                resolve();
                            }
                        }
                    );
                });

                // Send progress update
                event.sender.send('import-progress', {
                    current: i + 1,
                    total: files.length,
                    file: fileName,
                });
            } catch (err) {
                errors++;
                console.error(`Error processing ${filePath}:`, err);
            }
        }

        return {
            success: true,
            imported,
            errors,
            total: files.length,
        };
    });

    // Handler para importar música desde CARPETA
    ipcMain.handle('import-music-folder', async (event, data) => {
        const musicMetadata = require('music-metadata');

        if (!data || !data.folderPath) {
            return { success: false, error: 'No folder path provided' };
        }

        const files = [];

        // Scan folder for music files
        function scanDirectory(dir) {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        scanDirectory(fullPath);
                    } else if (stat.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.aac', '.wma'].includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (err) {
                console.error('Error scanning directory:', err);
            }
        }

        scanDirectory(data.folderPath);

        if (files.length === 0) {
            return { success: false, error: 'No music files found in folder' };
        }

        let imported = 0;
        let errors = 0;

        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            try {
                const metadata = await musicMetadata.parseFile(filePath);
                const fileName = path.basename(filePath);

                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO audio_files 
                        (file_path, file_name, title, artist, album, genre, year, duration, file_extension) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            filePath,
                            fileName,
                            metadata.common.title || fileName,
                            metadata.common.artist || 'Unknown Artist',
                            metadata.common.album || 'Unknown Album',
                            metadata.common.genre ? metadata.common.genre[0] : null,
                            metadata.common.year,
                            metadata.format.duration,
                            path.extname(filePath),
                        ],
                        (err) => {
                            if (err) {
                                errors++;
                                console.error(`Error importing ${fileName}:`, err);
                                resolve();
                            } else {
                                imported++;
                                resolve();
                            }
                        }
                    );
                });

                // Send progress update
                event.sender.send('import-progress', {
                    current: i + 1,
                    total: files.length,
                    file: fileName,
                });
            } catch (err) {
                errors++;
                console.error(`Error processing ${filePath}:`, err);
            }
        }

        return {
            success: true,
            imported,
            errors,
            total: files.length,
        };
    });

    // Basic IPC handler for getting files
    ipcMain.handle('get-files-with-cached-artwork', async (event, limit = 300) => {
        return new Promise((resolve, reject) => {
            const sql = `
            SELECT 
                af.id,
                af.file_path,
                af.file_name,
                af.title,
                af.artist,
                af.album,
                af.genre,
                af.artwork_path,
                lm.AI_BPM as bpm,
                lm.AI_KEY as key,
                lm.AI_ENERGY as energy,
                lm.AI_MOOD as mood
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            LIMIT ?
        `;

            db.all(sql, [limit], (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    resolve([]);
                } else {
                    // Add artwork URLs
                    rows.forEach((row) => {
                        if (row.artwork_path) {
                            row.artwork_url = `artwork-cache/${row.id}.jpg`;
                        }
                    });
                    resolve(rows);
                }
            });
        });
    });

    // Search handler
    ipcMain.handle('search-tracks', async (event, searchTerm) => {
        return new Promise((resolve, reject) => {
            const searchPattern = `%${searchTerm}%`;
            const sql = `
            SELECT 
                af.id,
                af.file_path,
                af.file_name,
                af.title,
                af.artist,
                af.album,
                af.genre,
                af.artwork_path,
                lm.AI_BPM as bpm,
                lm.AI_KEY as key,
                lm.AI_ENERGY as energy,
                lm.AI_MOOD as mood
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.title LIKE ? 
               OR af.artist LIKE ? 
               OR af.album LIKE ?
               OR af.genre LIKE ?
            LIMIT 100
        `;

            db.all(sql, [searchPattern, searchPattern, searchPattern, searchPattern], (err, rows) => {
                if (err) {
                    console.error('Search error:', err);
                    resolve([]);
                } else {
                    // Add artwork URLs
                    rows.forEach((row) => {
                        if (row.artwork_path) {
                            row.artwork_url = `artwork-cache/${row.id}.jpg`;
                        }
                    });
                    resolve(rows);
                }
            });
        });
    });

    // Get filter options
    ipcMain.handle('get-filter-options', async () => {
        return new Promise((resolve) => {
            const genres = [];
            const moods = [];

            // Get unique genres
            db.all('SELECT DISTINCT genre FROM audio_files WHERE genre IS NOT NULL', (err, genreRows) => {
                if (!err && genreRows) {
                    genreRows.forEach((row) => {
                        if (row.genre) {
                            genres.push(row.genre);
                        }
                    });
                }

                // Get unique moods
                db.all('SELECT DISTINCT AI_MOOD FROM llm_metadata WHERE AI_MOOD IS NOT NULL', (err, moodRows) => {
                    if (!err && moodRows) {
                        moodRows.forEach((row) => {
                            if (row.AI_MOOD) {
                                moods.push(row.AI_MOOD);
                            }
                        });
                    }

                    resolve({
                        genres: genres.sort(),
                        moods: moods.sort(),
                    });
                });
            });
        });
    });

    // Handler para obtener datos completos del track
    ipcMain.handle('get-track-complete-data', async (event, trackId) => {
        console.log('get-track-complete-data called with trackId:', trackId);
        return new Promise((resolve) => {
            const sql = `
            SELECT 
                af.*,
                lm.AI_BPM,
                lm.AI_KEY,
                lm.AI_ENERGY,
                lm.AI_DANCEABILITY,
                lm.AI_VALENCE,
                lm.AI_ACOUSTICNESS,
                lm.AI_INSTRUMENTALNESS,
                lm.AI_MOOD
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.id = ?
        `;

            db.get(sql, [trackId], (err, row) => {
                if (err) {
                    console.error('Error getting track data:', err);
                    resolve({ success: false, error: err.message });
                } else if (!row) {
                    resolve({ success: false, error: 'Track not found' });
                } else {
                    // Add artwork URL if available
                    if (row.artwork_path) {
                        row.artwork_url = `artwork-cache/${row.id}.jpg`;
                    }
                    resolve({ success: true, data: row });
                }
            });
        });
    });

    // Show in folder handler
    ipcMain.handle('show-in-folder', async (event, filePath) => {
        if (filePath && typeof filePath === 'string') {
            shell.showItemInFolder(filePath);
            return { success: true };
        }
        return { success: false, error: 'Invalid file path' };
    });

    // Import music handler - Modified to accept file paths from frontend
    // COMENTADO: Ahora se usa el handler avanzado de import-music-handler.js
    /*
ipcMain.handle('import-music', async (event, data) => {
    const musicMetadata = require('music-metadata');
    
    // Check if paths were provided (from select-music-files)
    if (!data || !data.paths || data.paths.length === 0) {
        return { success: false, error: 'No files provided' };
    }
    
    const files = data.paths;

    try {
        if (files.length === 0) {
            return { success: false, error: 'No files to import' };
        }
        
        console.log(`Starting import of ${files.length} files...`);

        // Import files to database
        let imported = 0;
        for (const filePath of files) {
            try {
                // Get metadata
                const metadata = await musicMetadata.parseFile(filePath);
                const fileName = path.basename(filePath);

                // Insert into database
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR IGNORE INTO audio_files 
                        (file_path, file_name, title, artist, album, genre, year, duration, file_extension) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            filePath,
                            fileName,
                            metadata.common.title || fileName,
                            metadata.common.artist || 'Unknown Artist',
                            metadata.common.album || 'Unknown Album',
                            metadata.common.genre ? metadata.common.genre[0] : null,
                            metadata.common.year,
                            metadata.format.duration,
                            path.extname(filePath)
                        ],
                        err => {
                            if (err) {
                                reject(err);
                            } else {
                                imported++;
                                resolve();
                            }
                        }
                    );
                });
            } catch (err) {
                console.error(`Error importing ${filePath}:`, err);
            }
        }

        return {
            success: true,
            imported: imported,
            total: files.length,
            message: `Imported ${imported} of ${files.length} files`
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
    });
    */

    // Register additional handlers from external modules
    try {
        // Smart Playlist handlers
        const { createSmartPlaylistHandlers } = require('./handlers/smart-playlist-handler');
        const smartPlaylistHandlers = createSmartPlaylistHandlers(db);
        ipcMain.handle('get-smart-playlists', smartPlaylistHandlers.getSmartPlaylistsHandler);
        console.log('Smart Playlist handlers registered');
    } catch (error) {
        console.error('Error registering Smart Playlist handlers:', error.message);
    }

    try {
        // Energy Flow handlers
        const { createEnergyFlowHandlers } = require('./handlers/energy-flow-handler');
        const energyFlowHandlers = createEnergyFlowHandlers(db);
        ipcMain.handle('get-queue-tracks', energyFlowHandlers.getQueueTracksHandler);
        console.log('Energy Flow handlers registered');
    } catch (error) {
        console.error('Error registering Energy Flow handlers:', error.message);
    }

    try {
        // Export handlers
        const { createGetExportFormatsHandler } = require('./handlers/export-handler');
        ipcMain.handle('get-export-formats', createGetExportFormatsHandler());
        console.log('Export handlers registered');
    } catch (error) {
        console.error('Error registering Export handlers:', error.message);
    }

    try {
        // Enhanced Import handlers (with artwork extraction)
        const ImportMusicHandler = require('./handlers/import-music-handler');
        const importHandler = new ImportMusicHandler(db, mainWindow);
        console.log('Enhanced Import handlers registered');
    } catch (error) {
        console.error('Error registering Enhanced Import handlers:', error.message);
    }

    console.log('All IPC handlers registered successfully');
}

// App event handlers
app.whenReady().then(() => {
    initDatabase();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close();
        }
        app.quit();
    }
});

// Handle app termination
app.on('before-quit', () => {
    if (db) {
        db.close();
    }
});

console.log('MAP - Music Analyzer Pro starting...');
