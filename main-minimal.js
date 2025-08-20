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
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        title: 'MAP - Music Analyzer Pro'
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
    db = new sqlite3.Database(dbPath, err => {
        if (err) {
            console.error('Error opening database:', err);
        } else {
            console.log('Connected to SQLite database');
        }
    });
}

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
                rows.forEach(row => {
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
                rows.forEach(row => {
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
    return new Promise(resolve => {
        const genres = [];
        const moods = [];

        // Get unique genres
        db.all('SELECT DISTINCT genre FROM audio_files WHERE genre IS NOT NULL', (err, genreRows) => {
            if (!err && genreRows) {
                genreRows.forEach(row => {
                    if (row.genre) {
                        genres.push(row.genre);
                    }
                });
            }

            // Get unique moods
            db.all('SELECT DISTINCT AI_MOOD FROM llm_metadata WHERE AI_MOOD IS NOT NULL', (err, moodRows) => {
                if (!err && moodRows) {
                    moodRows.forEach(row => {
                        if (row.AI_MOOD) {
                            moods.push(row.AI_MOOD);
                        }
                    });
                }

                resolve({
                    genres: genres.sort(),
                    moods: moods.sort()
                });
            });
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

// Import music handler
ipcMain.handle('import-music', async () => {
    const musicMetadata = require('music-metadata');

    // Open folder dialog
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Music Folder'
    });

    if (result.canceled) {
        return { success: false, canceled: true };
    }

    const folderPath = result.filePaths[0];
    const files = [];

    // Function to scan directory recursively
    function scanDirectory(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (['.mp3', '.flac', '.m4a', '.wav', '.ogg'].includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    try {
        scanDirectory(folderPath);

        if (files.length === 0) {
            return { success: false, error: 'No music files found' };
        }

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
