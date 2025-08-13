// TASK_023: Search handler modularizado
const { queryCache } = require('../cache-layer');
const fs = require('fs');
const path = require('path');

function createSearchHandler(db) {
    return async (event, { query, filters = {} }) => {
        // Cache key
        const cacheKey = JSON.stringify({ query, filters });
        const cached = queryCache.get(cacheKey);
        if (cached) {
            console.log('📦 Cache hit para búsqueda');
            return cached;
        }
        
        return new Promise((resolve) => {
            let sql = `
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
                WHERE 1=1
            `;
            
            const params = [];
            
            // Búsqueda de texto
            if (query && query.length >= 2) {
                sql += ` AND (
                    af.file_name LIKE ? OR
                    af.artist LIKE ? OR
                    af.title LIKE ? OR
                    af.album LIKE ? OR
                    lm.LLM_GENRE LIKE ? OR
                    af.genre LIKE ? OR
                    lm.AI_MOOD LIKE ? OR
                    lm.LLM_MOOD LIKE ?
                )`;
                const searchPattern = `%${query}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            }
            
            // Filtro de género
            if (filters.genre && filters.genre !== '') {
                sql += ` AND (lm.LLM_GENRE = ? OR af.genre = ?)`;
                params.push(filters.genre, filters.genre);
            }
            
            // Filtro de mood
            if (filters.mood && filters.mood !== '') {
                sql += ` AND (lm.AI_MOOD = ? OR lm.LLM_MOOD = ?)`;
                params.push(filters.mood, filters.mood);
            }
            
            // Filtro de BPM
            if (filters.bpmMin !== undefined && filters.bpmMax !== undefined) {
                sql += ` AND CAST(lm.AI_BPM AS INTEGER) BETWEEN ? AND ?`;
                params.push(filters.bpmMin, filters.bpmMax);
            }
            
            // Filtro de Energy
            if (filters.energyMin !== undefined && filters.energyMax !== undefined) {
                sql += ` AND lm.AI_ENERGY BETWEEN ? AND ?`;
                params.push(filters.energyMin, filters.energyMax);
            }
            
            // Ordenamiento
            const sortOptions = {
                'artist': 'af.artist, af.title',
                'title': 'af.title',
                'genre': 'lm.LLM_GENRE, af.artist',
                'mood': 'lm.AI_MOOD, af.artist',
                'bpm_asc': 'CAST(lm.AI_BPM AS INTEGER) ASC',
                'bpm_desc': 'CAST(lm.AI_BPM AS INTEGER) DESC',
                'energy_asc': 'lm.AI_ENERGY ASC',
                'energy_desc': 'lm.AI_ENERGY DESC'
            };
            
            sql += ` ORDER BY ${sortOptions[filters.sort] || 'af.artist, af.title'}`;
            sql += ` LIMIT 500`;
            
            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error en búsqueda:', err);
                    resolve([]);
                } else {
                    // Agregar URL de artwork
                    const artworkDir = path.join(__dirname, '..', 'artwork-cache');
                    rows.forEach(file => {
                        const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
                        const defaultImagePath = path.join(__dirname, '..', 'image.png');
                        
                        if (fs.existsSync(artworkPath)) {
                            // Provide both absolute and relative paths
                            file.artwork_url = `artwork-cache/${file.id}.jpg`;
                            file.artwork_path = artworkPath;
                            file.artwork_full = `file://${artworkPath}`;
                            file.has_artwork = true;
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
                    
                    console.log(`🔍 Búsqueda: "${query || 'todos'}" - ${rows.length} resultados`);
                    queryCache.set(cacheKey, rows);
                    resolve(rows);
                }
            });
        });
    };
}

module.exports = { createSearchHandler };