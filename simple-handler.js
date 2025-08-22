// SIMPLE HANDLER QUE FUNCIONA
const sqlite3 = require('sqlite3').verbose();

function createSimpleHandler(db) {
    return async () => {
        return new Promise((resolve) => {
            // Query DIRECTA con JOIN a llm_metadata para obtener BPM, Key y Energy
            const query = `
                SELECT 
                    af.*,
                    lm.AI_BPM,
                    lm.AI_KEY,
                    lm.AI_ENERGY,
                    lm.AI_MOOD,
                    lm.AI_DANCEABILITY,
                    lm.AI_VALENCE,
                    lm.AI_ACOUSTICNESS,
                    lm.AI_INSTRUMENTALNESS
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.id DESC
            `;

            db.all(query, (err, rows) => {
                if (err) {
                    console.error('DB Error:', err);
                    resolve({ files: [] });
                } else {
                    console.log(`✅ SIMPLE HANDLER: Found ${rows.length} tracks`);

                    // Process rows to add artwork paths
                    const fs = require('fs');
                    const path = require('path');

                    rows.forEach((row) => {
                        // Add artwork path
                        if (row.artwork_path) {
                            row.artwork_url = row.artwork_path;
                        } else if (row.id) {
                            const artworkPath = `artwork-cache/${row.id}.jpg`;
                            const fullPath = path.join(__dirname, artworkPath);
                            if (fs.existsSync(fullPath)) {
                                row.artwork_url = artworkPath;
                            } else {
                                row.artwork_url = 'assets/images/default-album.png';
                            }
                        }

                        // Add aliases for compatibility
                        row.bpm = row.AI_BPM;
                        row.key = row.AI_KEY;
                        row.energy = row.AI_ENERGY;
                        row.mood = row.AI_MOOD;
                    });

                    // Log first track with metadata
                    if (rows[0]) {
                        console.log('First track with metadata:', {
                            id: rows[0].id,
                            title: rows[0].title,
                            AI_BPM: rows[0].AI_BPM,
                            AI_KEY: rows[0].AI_KEY,
                            AI_ENERGY: rows[0].AI_ENERGY,
                        });
                    }

                    resolve({ files: rows });
                }
            });
        });
    };
}

module.exports = { createSimpleHandler };
