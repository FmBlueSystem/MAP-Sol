const { app, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { queryCache } = require('./cache-layer');

let mainWindow;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Para cargar imágenes locales
        }
    });

    mainWindow.loadFile('index-complete.html');
}

app.whenReady().then(() => {
    const dbPath = path.join(__dirname, 'music_analyzer.db');
    db = new sqlite3.Database(dbPath);
    
    console.log('✅ Base de datos conectada');
    createWindow();
});

// Handler optimizado - usa carátulas pre-extraídas
ipcMain.handle('get-files-with-cached-artwork', async () => {
    return new Promise((resolve) => {
        const sql = `
            SELECT 
                af.id,
                af.file_name,
                af.title,
                af.artist,
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
            WHERE lm.LLM_GENRE IS NOT NULL OR lm.AI_MOOD IS NOT NULL
            ORDER BY af.artist, af.title
            LIMIT 300
        `;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error:', err);
                resolve([]);
            } else {
                // Verificar qué archivos tienen carátula
                const artworkDir = path.join(__dirname, 'artwork-cache');
                let withArtwork = 0;
                
                rows.forEach(file => {
                    const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
                    if (fs.existsSync(artworkPath)) {
                        file.artwork_url = `file://${artworkPath}`;
                        withArtwork++;
                    }
                });
                
                console.log(`✅ ${rows.length} archivos (${withArtwork} con carátula)`);
                resolve(rows);
            }
        });
    });
});

// Handler para búsqueda con filtros (con cache)
ipcMain.handle('search-tracks', async (event, { query, filters = {} }) => {
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
                af.file_name,
                af.title,
                af.artist,
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
                lm.LLM_GENRE LIKE ? OR
                af.genre LIKE ?
            )`;
            const searchPattern = `%${query}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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
        
        // Filtro de solo analizados
        if (filters.analyzedOnly) {
            sql += ` AND (lm.LLM_GENRE IS NOT NULL OR lm.AI_MOOD IS NOT NULL)`;
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
                const artworkDir = path.join(__dirname, 'artwork-cache');
                rows.forEach(file => {
                    const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
                    if (fs.existsSync(artworkPath)) {
                        file.artwork_url = `file://${artworkPath}`;
                    }
                });
                
                console.log(`🔍 Búsqueda: "${query || 'todos'}" - ${rows.length} resultados`);
                // Guardar en cache
                queryCache.set(cacheKey, rows);
                resolve(rows);
            }
        });
    });
});

// Handler para obtener géneros y moods únicos para los filtros
ipcMain.handle('get-filter-options', async () => {
    return new Promise((resolve) => {
        const result = { genres: [], moods: [] };
        
        // Obtener géneros únicos
        db.all(`
            SELECT DISTINCT LLM_GENRE as genre 
            FROM llm_metadata 
            WHERE LLM_GENRE IS NOT NULL 
            ORDER BY LLM_GENRE
        `, [], (err, genreRows) => {
            if (!err) {
                result.genres = genreRows.map(r => r.genre).filter(g => g);
            }
            
            // Obtener moods únicos
            db.all(`
                SELECT DISTINCT AI_MOOD as mood 
                FROM llm_metadata 
                WHERE AI_MOOD IS NOT NULL 
                ORDER BY AI_MOOD
            `, [], (err, moodRows) => {
                if (!err) {
                    result.moods = moodRows.map(r => r.mood).filter(m => m);
                }
                
                console.log(`📊 Opciones de filtros: ${result.genres.length} géneros, ${result.moods.length} moods`);
                resolve(result);
            });
        });
    });
});

app.on('window-all-closed', () => {
    if (db) db.close();
    app.quit();
});