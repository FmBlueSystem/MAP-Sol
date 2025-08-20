#!/usr/bin/env node

/**
 * 🔍 Metadata Viewer Standalone
 * Visualizador de metadatos con su propia instancia de Electron y handlers
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mm = require('music-metadata');
const fs = require('fs').promises;

let viewerWindow;
let db;

// Conectar a la base de datos
function connectDatabase() {
    const dbPath = path.join(__dirname, 'music_analyzer.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            logError('❌ Error conectando a BD:', err);
        } else {
            logInfo('✅ Base de datos conectada');
        }
    });
}

// Registrar handlers IPC
function registerHandlers() {
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
}

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

    // Cargar el archivo HTML corregido
    viewerWindow.loadFile('metadata-viewer-fixed.html');

    // Menú de la aplicación
    viewerWindow.setMenuBarVisibility(true);

    viewerWindow.on('closed', () => {
        viewerWindow = null;
        if (db) {
            db.close();
        }
    });
}

app.whenReady().then(() => {
    connectDatabase();
    registerHandlers();
    createViewerWindow();
});

app.on('window-all-closed', () => {
    if (db) {
        db.close();
    }
    app.quit();
});

app.on('activate', () => {
    if (viewerWindow === null) {
        createViewerWindow();
    }
});

logDebug('🔍 Iniciando Metadata Viewer Standalone...');
