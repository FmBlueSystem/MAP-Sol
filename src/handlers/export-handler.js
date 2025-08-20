// Export handler for DJ formats
const { dialog } = require('electron');
const path = require('path');

// Create mock DJExporter class if not exists
class DJExporter {
    getSupportedFormats() {
        return [
            { id: 'json', name: 'JSON', extension: '.json' },
            { id: 'csv', name: 'CSV', extension: '.csv' },
            { id: 'm3u', name: 'M3U Playlist', extension: '.m3u' },
            { id: 'xml', name: 'XML', extension: '.xml' },
        ];
    }

    async export(tracks, format, options) {
        return {
            format: format,
            savedTo: options.savePath,
            extension: this.getSupportedFormats().find((f) => f.id === format)?.extension || '.txt',
        };
    }
}

function createExportHandler(db) {
    const exporter = new DJExporter();

    return async (event, params) => {
        try {
            const { format, trackIds, playlistName } = params || {};

            if (!trackIds || trackIds.length === 0) {
                return { success: false, error: 'No tracks selected' };
            }

            // Get tracks from database
            const placeholders = trackIds.map(() => '?').join(',');
            const sql = `
                SELECT 
                    af.*, 
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id IN (${placeholders})
            `;

            return new Promise((resolve, reject) => {
                db.all(sql, trackIds, async (err, tracks) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Select save directory
                    const result = await dialog.showSaveDialog({
                        title: 'Export as ' + format.toUpperCase(),
                        defaultPath: path.join(
                            process.env.HOME || process.env.USERPROFILE,
                            'Desktop',
                            (playlistName || 'playlist') + '_' + format
                        ),
                        filters: exporter
                            .getSupportedFormats()
                            .filter((f) => f.id === format)
                            .map((f) => ({
                                name: f.name,
                                extensions: [f.extension.slice(1)],
                            })),
                    });

                    if (result.canceled) {
                        resolve({ success: false, canceled: true });
                        return;
                    }

                    // Export
                    const exportResult = await exporter.export(tracks, format, {
                        name: playlistName || 'Playlist',
                        savePath: path.dirname(result.filePath),
                    });

                    resolve({
                        success: true,
                        format: exportResult.format,
                        path: exportResult.savedTo,
                        tracksExported: tracks.length,
                    });
                });
            });
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, error: error.message };
        }
    };
}

// Handler to get supported formats
function createGetFormatsHandler() {
    const exporter = new DJExporter();
    return async () => {
        return exporter.getSupportedFormats();
    };
}

// Handler to get all tracks for export
function createGetAllTracksForExportHandler(db) {
    return async () => {
        return new Promise((resolve) => {
            const sql = `
                SELECT 
                    af.*,
                    lm.AI_BPM,
                    lm.AI_KEY,
                    lm.AI_ENERGY,
                    lm.AI_DANCEABILITY,
                    lm.AI_VALENCE,
                    lm.AI_MOOD,
                    lm.LLM_GENRE
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.artist, af.album, af.title
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching tracks for export:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, tracks: rows });
                }
            });
        });
    };
}

// Handler for actual export operation
function createExportTracksHandler(db) {
    return async (event, exportData) => {
        const { tracks, format, filename, encoding, options } = exportData;
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');

        try {
            let content = '';
            let extension = '';

            // Generate content based on format
            switch (format) {
                case 'json':
                    content = JSON.stringify(tracks, null, 2);
                    extension = '.json';
                    break;

                case 'csv':
                    // Generate CSV
                    const headers = Object.keys(tracks[0]).join(',');
                    const rows = tracks.map((t) =>
                        Object.values(t)
                            .map((v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v))
                            .join(',')
                    );
                    content = headers + '\n' + rows.join('\n');
                    extension = '.csv';
                    break;

                case 'm3u':
                case 'm3u8':
                    // Generate M3U playlist
                    content = '#EXTM3U\n';
                    tracks.forEach((track) => {
                        const duration = track.duration || 0;
                        const artist = track.artist || 'Unknown';
                        const title = track.title || track.file_name;
                        content += `#EXTINF:${duration},${artist} - ${title}\n`;
                        content += `${track.file_path}\n`;
                    });
                    extension = format === 'm3u8' ? '.m3u8' : '.m3u';
                    break;

                case 'xml':
                    // Basic XML export
                    content = '<?xml version="1.0" encoding="UTF-8"?>\n';
                    content += '<tracks>\n';
                    tracks.forEach((track) => {
                        content += '  <track>\n';
                        Object.entries(track).forEach(([key, value]) => {
                            if (value !== null && value !== undefined) {
                                content += `    <${key}>${value}</${key}>\n`;
                            }
                        });
                        content += '  </track>\n';
                    });
                    content += '</tracks>';
                    extension = '.xml';
                    break;

                default:
                    return { success: false, error: 'Unsupported format' };
            }

            // Save file
            const downloadsPath = app.getPath('downloads');
            const filepath = path.join(downloadsPath, filename + extension);

            fs.writeFileSync(filepath, content, encoding || 'utf8');

            return {
                success: true,
                filepath: filepath,
                message: `Exported ${tracks.length} tracks to ${filepath}`,
            };
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, error: error.message };
        }
    };
}

// Handler to get available export formats
function createGetExportFormatsHandler() {
    return async () => {
        return {
            success: true,
            formats: [
                { id: 'json', name: 'JSON', available: true },
                { id: 'csv', name: 'CSV', available: true },
                { id: 'xml', name: 'XML', available: true },
                { id: 'm3u', name: 'M3U', available: true },
                { id: 'm3u8', name: 'M3U8', available: true },
                { id: 'pls', name: 'PLS', available: false },
                { id: 'rekordbox', name: 'Rekordbox XML', available: false },
                { id: 'traktor', name: 'Traktor NML', available: false },
                { id: 'serato', name: 'Serato Crate', available: false },
                { id: 'virtualDJ', name: 'VirtualDJ', available: false },
            ]
        };
    };
}

module.exports = {
    createExportHandler,
    createGetFormatsHandler,
    createGetAllTracksForExportHandler,
    createExportTracksHandler,
    createGetExportFormatsHandler,
};
