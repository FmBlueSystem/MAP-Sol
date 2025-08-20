// Handler para obtener datos completos del track
function createTrackInfoHandler(db) {
    return async (event, trackId) => {
        return new Promise((resolve) => {
            // Query para obtener TODOS los campos del track
            const sql = `
                SELECT 
                    -- Datos básicos de audio_files
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.year,
                    af.duration,
                    af.bitrate,
                    af.existing_bmp,
                    af.existing_key,
                    af.artwork_path,
                    
                    -- Análisis AI de audio_files
                    af.AI_KEY,
                    af.AI_BPM,
                    af.AI_ENERGY,
                    af.AI_DANCEABILITY,
                    af.AI_VALENCE,
                    af.AI_ACOUSTICNESS,
                    af.AI_INSTRUMENTALNESS,
                    af.AI_LIVENESS,
                    af.AI_SPEECHINESS,
                    af.AI_LOUDNESS,
                    af.AI_MODE,
                    af.AI_TIME_SIGNATURE,
                    af.AI_MOOD,
                    af.AI_GENRE,
                    
                    -- Datos de llm_metadata
                    lm.LLM_GENRE,
                    lm.LLM_SUBGENRES,
                    lm.LLM_ERA,
                    lm.LLM_STYLE_PERIOD,
                    lm.LLM_DESCRIPTION,
                    lm.LLM_CONTEXT,
                    lm.LLM_ENERGY_LEVEL,
                    lm.LLM_OCCASIONS,
                    lm.LLM_MOOD,
                    lm.LLM_DJ_NOTES,
                    lm.LLM_MIXING_NOTES,
                    lm.LLM_MIXING_KEYS,
                    lm.LLM_COMPATIBLE_GENRES,
                    lm.LLM_PRODUCTION_STYLE,
                    lm.LLM_INSTRUMENTS,
                    lm.LLM_VOCAL_STYLE,
                    lm.LLM_SIMILAR_ARTISTS,
                    lm.LLM_RECOMMENDATIONS,
                    lm.AI_CONFIDENCE,
                    lm.AI_TEMPO_CONFIDENCE,
                    lm.AI_KEY_CONFIDENCE
                    
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            db.get(sql, [trackId], (err, row) => {
                if (err) {
                    console.error('Error fetching track info:', err);
                    resolve({ success: false, error: err.message });
                } else if (!row) {
                    resolve({ success: false, error: 'Track not found' });
                } else {
                    // Procesar artwork path
                    if (row.id) {
                        const artworkPath = `artwork-cache/${row.id}.jpg`;
                        const fs = require('fs');
                        const path = require('path');
                        const fullPath = path.join(__dirname, '..', artworkPath);

                        if (fs.existsSync(fullPath)) {
                            row.artwork_url = artworkPath;
                        } else {
                            row.artwork_url = 'image.png';
                        }
                    }

                    // Calcular HAMMS dimensions si no existen
                    if (!row.hamms_dimensions) {
                        row.hamms_dimensions = {
                            energy: row.AI_ENERGY || 0,
                            danceability: row.AI_DANCEABILITY || 0,
                            valence: row.AI_VALENCE || 0,
                            acousticness: row.AI_ACOUSTICNESS || 0,
                            instrumentalness: row.AI_INSTRUMENTALNESS || 0,
                            liveness: row.AI_LIVENESS || 0,
                            speechiness: row.AI_SPEECHINESS || 0,
                        };
                    }

                    resolve({ success: true, data: row });
                }
            });
        });
    };
}

// Handler para buscar tracks similares usando HAMMS
function createFindSimilarHandler(db) {
    return async (event, trackId) => {
        return new Promise((resolve) => {
            // Primero obtener el track de referencia
            const refSql = `
                SELECT 
                    AI_ENERGY, AI_DANCEABILITY, AI_VALENCE,
                    AI_ACOUSTICNESS, AI_INSTRUMENTALNESS,
                    AI_LIVENESS, AI_SPEECHINESS, AI_BPM, AI_KEY
                FROM audio_files
                WHERE id = ?
            `;

            db.get(refSql, [trackId], (err, refTrack) => {
                if (err || !refTrack) {
                    resolve({ success: false, error: 'Reference track not found' });
                    return;
                }

                // Buscar tracks similares usando distancia euclidiana
                const similarSql = `
                    SELECT 
                        af.id,
                        af.title,
                        af.artist,
                        af.album,
                        af.AI_BPM,
                        af.AI_KEY,
                        af.AI_ENERGY,
                        af.AI_DANCEABILITY,
                        af.AI_VALENCE,
                        af.artwork_path,
                        (
                            POW(COALESCE(af.AI_ENERGY, 0) - ?, 2) +
                            POW(COALESCE(af.AI_DANCEABILITY, 0) - ?, 2) +
                            POW(COALESCE(af.AI_VALENCE, 0) - ?, 2) +
                            POW(COALESCE(af.AI_ACOUSTICNESS, 0) - ?, 2) +
                            POW(COALESCE(af.AI_INSTRUMENTALNESS, 0) - ?, 2) +
                            POW(COALESCE(af.AI_LIVENESS, 0) - ?, 2) +
                            POW(COALESCE(af.AI_SPEECHINESS, 0) - ?, 2)
                        ) as distance,
                        CASE 
                            WHEN af.AI_KEY = ? THEN 100
                            WHEN af.AI_KEY LIKE ? THEN 80
                            ELSE 0
                        END as key_match,
                        ABS(COALESCE(af.AI_BPM, 0) - ?) as bpm_diff
                    FROM audio_files af
                    WHERE af.id != ?
                    AND af.AI_ENERGY IS NOT NULL
                    ORDER BY distance ASC, key_match DESC, bpm_diff ASC
                    LIMIT 10
                `;

                const params = [
                    refTrack.AI_ENERGY || 0,
                    refTrack.AI_DANCEABILITY || 0,
                    refTrack.AI_VALENCE || 0,
                    refTrack.AI_ACOUSTICNESS || 0,
                    refTrack.AI_INSTRUMENTALNESS || 0,
                    refTrack.AI_LIVENESS || 0,
                    refTrack.AI_SPEECHINESS || 0,
                    refTrack.AI_KEY,
                    refTrack.AI_KEY ? refTrack.AI_KEY.charAt(0) + '%' : '',
                    refTrack.AI_BPM || 0,
                    trackId,
                ];

                db.all(similarSql, params, (err, rows) => {
                    if (err) {
                        console.error('Error finding similar tracks:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        // Calcular porcentaje de similitud
                        rows.forEach((row) => {
                            // Normalizar distancia a porcentaje (0-100%)
                            const maxDistance = 7; // Máxima distancia posible (7 dimensiones)
                            const similarity = Math.max(0, 100 - (row.distance / maxDistance) * 100);
                            row.similarity_percent = Math.round(similarity);

                            // Agregar artwork URL
                            if (row.id) {
                                const artworkPath = `artwork-cache/${row.id}.jpg`;
                                const fs = require('fs');
                                const path = require('path');
                                const fullPath = path.join(__dirname, '..', artworkPath);

                                if (fs.existsSync(fullPath)) {
                                    row.artwork_url = artworkPath;
                                } else {
                                    row.artwork_url = 'image.png';
                                }
                            }
                        });

                        resolve({
                            success: true,
                            tracks: rows,
                            reference: refTrack,
                        });
                    }
                });
            });
        });
    };
}

module.exports = {
    createTrackInfoHandler,
    createFindSimilarHandler,
};
