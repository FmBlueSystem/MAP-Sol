// TASK_027: Export handler para formatos DJ - TEMPORARY FIX
const { dialog } = require('electron');
const path = require('path');

function createExportHandler(db) {
    return async (event, { format, trackIds, playlistName }) => {
        try {
            // Temporarily return success
            console.log('Export handler called with:', { format, trackIds, playlistName });
            return { 
                success: true, 
                message: 'Export functionality temporarily disabled',
                format: format,
                tracksExported: trackIds ? trackIds.length : 0
            };
        } catch (error) {
            console.error('Error en export:', error);
            return { success: false, error: error.message };
        }
    };
}

// Handler para obtener formatos soportados
function createGetFormatsHandler() {
    return async () => {
        // Return basic formats for now
        return [
            { id: 'csv', name: 'CSV', extension: '.csv' },
            { id: 'json', name: 'JSON', extension: '.json' },
            { id: 'm3u', name: 'M3U Playlist', extension: '.m3u' }
        ];
    };
}

module.exports = {
    createExportHandler,
    createGetFormatsHandler
};