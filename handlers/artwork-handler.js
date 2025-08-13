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
                    af.existing_bmp,
                    af.artwork_path,
                    lm.LLM_GENRE,
                    lm.AI_MOOD,
                    lm.LLM_MOOD,
                    lm.AI_ENERGY,
                    lm.AI_BPM
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
                    
                    rows.forEach(file => {
                        const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
                        const defaultImagePath = path.join(__dirname, '..', 'image.png');
                        
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
                                file.artwork_url = `image.png`;
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
                    
                    console.log(`✅ ${rows.length} archivos (${withArtwork} con carátula)`);
                    resolve(rows);
                }
            });
        });
    };
}

module.exports = { createArtworkHandler };