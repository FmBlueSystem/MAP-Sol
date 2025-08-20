// TASK_027: Export handler para formatos DJ
const { dialog } = require('electron');
const { DJExporter } = require('../services/dj-exporter');
const path = require('path');

function createExportHandler(db) {
    const exporter = new DJExporter();

    return async (event, { format, trackIds, playlistName }) => {
        try {
            // Obtener tracks de la BD
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

                    // Seleccionar directorio de guardado
                    const result = await dialog.showSaveDialog({
                        title: `Exportar como ${format.toUpperCase()}`,
                        defaultPath: path.join(
                            process.env.HOME || process.env.USERPROFILE,
                            'Desktop',
                            `${playlistName || 'playlist'}_${format}`
                        ),
                        filters: exporter
                            .getSupportedFormats()
                            .filter(f => f.id === format)
                            .map(f => ({
                                name: f.name,
                                extensions: [f.extension.slice(1)]
                            }))
                    });

                    if (result.canceled) {
                        resolve({ success: false, canceled: true });
                        return;
                    }

                    // Exportar
                    const exportResult = await exporter.export(tracks, format, {
                        name: playlistName || 'Playlist',
                        savePath: path.dirname(result.filePath)
                    });

                    resolve({
                        success: true,
                        format: exportResult.format,
                        path: exportResult.savedTo,
                        tracksExported: tracks.length
                    });
                });
            });
        } catch (error) {
            console.error('Error en export:', error);
            return { success: false, error: error.message };
        }
    };
}

// Handler para obtener formatos soportados
function createGetFormatsHandler() {
    const exporter = new DJExporter();
    return async () => {
        return exporter.getSupportedFormats();
    };
}

module.exports = {
    createExportHandler,
    createGetFormatsHandler
};
