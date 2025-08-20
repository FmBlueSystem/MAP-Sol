const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

class SimpleAudioHandler {
    constructor() {
        this.setupHandlers();
    }

    setupHandlers() {
        // Play audio file directly
        ipcMain.handle('play-audio-file', async (event, filePath) => {
            try {
                // Clean the path
                let cleanPath = filePath;
                if (cleanPath.startsWith('file://')) {
                    cleanPath = cleanPath.replace('file://', '');
                }

                // Check if file exists
                if (!fs.existsSync(cleanPath)) {
                    throw new Error(`File not found: ${cleanPath}`);
                }

                // Get file stats
                const stats = fs.statSync(cleanPath);

                // Read file and convert to base64 data URL (for small files)
                if (stats.size < 10 * 1024 * 1024) {
                    // Less than 10MB
                    const buffer = fs.readFileSync(cleanPath);
                    const base64 = buffer.toString('base64');

                    // Determine MIME type
                    const ext = path.extname(cleanPath).toLowerCase();
                    let mimeType = 'audio/mpeg';

                    switch (ext) {
                        case '.mp3':
                            mimeType = 'audio/mpeg';
                            break;
                        case '.m4a':
                        case '.aac':
                            mimeType = 'audio/aac';
                            break;
                        case '.flac':
                            mimeType = 'audio/flac';
                            break;
                        case '.wav':
                            mimeType = 'audio/wav';
                            break;
                        case '.ogg':
                            mimeType = 'audio/ogg';
                            break;
                    }

                    const dataUrl = `data:${mimeType};base64,${base64}`;

                    return {
                        success: true,
                        dataUrl: dataUrl,
                        method: 'dataUrl'
                    };
                } else {
                    // For larger files, return the file:// URL with proper encoding
                    const fileUrl = 'file://' + encodeURI(cleanPath).replace(/#/g, '%23');

                    return {
                        success: true,
                        url: fileUrl,
                        method: 'fileUrl',
                        size: stats.size
                    };
                }
            } catch (error) {
                console.error('❌ Error playing audio:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        // Get audio file as buffer (alternative approach)
        ipcMain.handle('get-audio-buffer', async (event, filePath) => {
            try {
                let cleanPath = filePath;
                if (cleanPath.startsWith('file://')) {
                    cleanPath = cleanPath.replace('file://', '');
                }

                if (!fs.existsSync(cleanPath)) {
                    throw new Error('File not found');
                }

                const buffer = fs.readFileSync(cleanPath);

                return {
                    success: true,
                    buffer: buffer,
                    size: buffer.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        // Simple file check
        // COMMENTED OUT: This handler is already registered in main-secure.js via file-system-secure.js
        // to prevent duplicate registration errors
        /*
        ipcMain.handle('check-file-exists', async (event, filePath) => {
            try {
                let cleanPath = filePath;
                if (cleanPath.startsWith('file://')) {
                    cleanPath = cleanPath.replace('file://', '');
                }

                const exists = fs.existsSync(cleanPath);
                const stats = exists ? fs.statSync(cleanPath) : null;

                return {
                    exists: exists,
                    size: stats ? stats.size : 0,
                    readable: exists && stats && stats.isFile()
                };

            } catch (error) {
                return {
                    exists: false,
                    error: error.message
                };
            }
        });
        */
    }
}

module.exports = SimpleAudioHandler;
