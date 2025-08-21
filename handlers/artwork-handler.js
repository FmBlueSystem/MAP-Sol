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
                    af.AI_MOOD,
                    af.AI_DANCEABILITY,
                    af.AI_VALENCE,
                    COALESCE(af.AI_BPM, af.bmp, af.existing_bmp) as bpm,
                    COALESCE(af.AI_KEY, af.existing_key) as key,
                    COALESCE(af.AI_ENERGY, af.energy_level) as energy,
                    af.AI_MOOD as mood
                FROM audio_files af
                ORDER BY af.artist, af.title
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error:', err);
                    resolve([]);
                } else {
                    // DEBUG: Log first 3 rows to see the actual data
                    console.log('📊 Handler: First 3 rows from database:');
                    rows.slice(0, 3).forEach((row) => {
                        console.log(`  Track ${row.id}: ${row.title}`);
                        console.log(`    bpm: ${row.bpm}, key: ${row.key}, energy: ${row.energy}, mood: ${row.mood}`);
                    });

                    // Verificar qué archivos tienen carátula
                    const artworkDir = path.join(__dirname, '..', 'artwork-cache');
                    let withArtwork = 0;

                    // Debug log for first track with AI data
                    const tracksWithAI = rows.filter((r) => r.AI_BPM || r.AI_KEY || r.AI_ENERGY);
                    console.log('📊 Handler: Total rows from DB:', rows.length);
                    console.log('📊 Handler: Tracks with AI metadata:', tracksWithAI.length);

                    if (tracksWithAI.length > 0) {
                        console.log('📊 Handler: First track with AI:', {
                            id: tracksWithAI[0].id,
                            title: tracksWithAI[0].title,
                            AI_BPM: tracksWithAI[0].AI_BPM,
                            AI_KEY: tracksWithAI[0].AI_KEY,
                            AI_ENERGY: tracksWithAI[0].AI_ENERGY,
                        });
                    } else if (rows.length > 0) {
                        console.log('⚠️ Handler: No AI metadata found. First track fields:', Object.keys(rows[0]));
                    }

                    rows.forEach((file) => {
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
                                file.artwork_url = 'image.png';
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
                    // Debug: Check what we're sending
                    console.log('📊 Handler: Sending to frontend:', {
                        totalFiles: rows.length,
                        filesWithAI: rows.filter((r) => r.AI_BPM || r.AI_KEY || r.AI_ENERGY).length,
                        firstFileHasAI: rows[0]
                            ? {
                                  id: rows[0].id,
                                  hasAI_BPM: !!rows[0].AI_BPM,
                                  hasAI_KEY: !!rows[0].AI_KEY,
                                  hasAI_ENERGY: !!rows[0].AI_ENERGY,
                              }
                            : null,
                    });

                    // Retornar en el formato esperado por el frontend
                    resolve({ files: rows });
                }
            });
        });
    };
}

module.exports = { createArtworkHandler };
