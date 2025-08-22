// TASK_023: Artwork handler modularizado
const fs = require('fs');
const path = require('path');

function createArtworkHandler(db) {
    return async () => {
        return new Promise((resolve) => {
            const sql = `
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.file_extension,
                    af.bmp,
                    af.existing_bmp,
                    af.existing_key,
                    af.artwork_path,
                    af.duration,
                    af.energy_level,
                    af.comment,
                    af.AI_ENERGY,
                    af.AI_KEY,
                    af.AI_BPM,
                    lm.LLM_GENRE,
                    lm.AI_MOOD,
                    lm.LLM_MOOD,
                    lm.AI_BPM as LM_AI_BPM,
                    COALESCE(af.bmp, af.existing_bmp, lm.AI_BPM, af.AI_BPM) as BPM
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.artist, af.title
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error:', err);
                    resolve([]);
                } else {
                    // Verificar qué archivos tienen carátula
                    const artworkDir = path.join(__dirname, '..', 'artwork-cache');
                    let withArtwork = 0;

                    rows.forEach((file) => {
                        const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
                        const defaultImagePath = path.join(__dirname, '..', 'assets/images/default-album.png');

                        if (fs.existsSync(artworkPath)) {
                            // Provide both absolute and relative paths
                            file.artwork_url = `artwork-cache/${file.id}.jpg`;
                            file.artwork_path = artworkPath;
                            file.artwork_full = `file://${artworkPath}`;
                            file.has_artwork = true;
                            withArtwork++;
                        } else {
                            // Use default image.png as fallback
                            if (fs.existsSync(defaultImagePath)) {
                                file.artwork_url = 'assets/images/default-album.png';
                                file.artwork_path = defaultImagePath;
                                file.artwork_full = `file://${defaultImagePath}`;
                                file.has_artwork = false;
                            } else {
                                // Final fallback if image.png doesn't exist
                                file.artwork_url = null;
                                file.artwork_path = null;
                                file.artwork_full = null;
                                file.has_artwork = false;
                            }
                        }
                    });
                    // Retornar en el formato esperado por el frontend
                    resolve({ files: rows });
                }
            });
        });
    };
}

module.exports = { createArtworkHandler };
