// Handler específico para obtener un track con toda su metadata
function createGetTrackWithMetadataHandler(db) {
    return async (event, trackId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id,
                    file_path,
                    file_name,
                    title,
                    artist,
                    album,
                    genre,
                    AI_BPM as bpm,
                    AI_KEY as key,
                    AI_ENERGY as energy,
                    AI_MOOD as mood,
                    artwork_path,
                    duration
                FROM audio_files
                WHERE id = ?
            `;

            db.get(sql, [trackId], (err, row) => {
                if (err) {
                    console.error('Error getting track:', err);
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    // Log what we got
                    console.log(`📀 Track ${trackId} metadata:`, {
                        title: row.title,
                        bpm: row.bpm,
                        key: row.key,
                        energy: row.energy,
                        mood: row.mood,
                    });

                    // Add artwork path
                    const path = require('path');
                    const fs = require('fs');
                    const artworkDir = path.join(__dirname, '..', 'artwork-cache');
                    const artworkPath = path.join(artworkDir, `${row.id}.jpg`);

                    if (fs.existsSync(artworkPath)) {
                        row.artwork_url = `artwork-cache/${row.id}.jpg`;
                        row.artwork_path = artworkPath;
                    } else {
                        row.artwork_url = 'image.png';
                    }

                    resolve(row);
                }
            });
        });
    };
}

module.exports = { createGetTrackWithMetadataHandler };
