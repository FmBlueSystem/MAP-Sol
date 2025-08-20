// Handler para Smart Playlists
function createSmartPlaylistHandlers(db) {
    // Preview smart playlist
    const previewHandler = async (event, criteria) => {
        return new Promise((resolve) => {
            const { rules, logic, limit } = criteria;

            // Build SQL query based on rules
            const conditions = [];
            const params = [];

            rules.forEach((rule) => {
                let condition = '';
                const field = mapFieldToColumn(rule.field);

                switch (rule.operator) {
                    case 'equals':
                        condition = `${field} = ?`;
                        params.push(rule.value);
                        break;
                    case 'not_equals':
                        condition = `${field} != ?`;
                        params.push(rule.value);
                        break;
                    case 'greater':
                        condition = `${field} > ?`;
                        params.push(parseFloat(rule.value));
                        break;
                    case 'less':
                        condition = `${field} < ?`;
                        params.push(parseFloat(rule.value));
                        break;
                    case 'between':
                        condition = `${field} BETWEEN ? AND ?`;
                        params.push(parseFloat(rule.value));
                        params.push(parseFloat(rule.value2));
                        break;
                    case 'contains':
                        condition = `${field} LIKE ?`;
                        params.push(`%${rule.value}%`);
                        break;
                    case 'not_contains':
                        condition = `${field} NOT LIKE ?`;
                        params.push(`%${rule.value}%`);
                        break;
                }

                if (condition) {
                    conditions.push(condition);
                }
            });

            if (conditions.length === 0) {
                resolve({ success: false, error: 'No valid rules' });
                return;
            }

            const whereClause = conditions.join(logic === 'OR' ? ' OR ' : ' AND ');
            const sql = `
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.duration,
                    af.AI_BPM,
                    af.existing_bmp,
                    af.AI_KEY,
                    af.existing_key,
                    af.AI_ENERGY,
                    af.AI_DANCEABILITY,
                    af.AI_VALENCE,
                    af.artwork_path
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE ${whereClause}
                LIMIT ?
            `;

            params.push(limit || 100);

            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error previewing smart playlist:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    // Add artwork URLs
                    rows.forEach((row) => {
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

                    resolve({ success: true, tracks: rows });
                }
            });
        });
    };

    // Create smart playlist
    const createHandler = async (event, playlistData) => {
        return new Promise((resolve) => {
            const {
                name,
                description,
                rules,
                logic,
                icon,
                color,
                autoUpdate,
                removeDuplicates,
                maxTracks,
                sortBy,
                energyFlow,
            } = playlistData;

            // First create the playlist
            const playlistSql = `
                INSERT INTO playlists (name, description, type, icon, color, created_at, updated_at)
                VALUES (?, ?, 'smart', ?, ?, datetime('now'), datetime('now'))
            `;

            db.run(playlistSql, [name, description, icon, color], function (err) {
                if (err) {
                    console.error('Error creating smart playlist:', err);
                    resolve({ success: false, error: err.message });
                    return;
                }

                const playlistId = this.lastID;

                // Save the rules
                const rulePromises = rules.map((rule, index) => {
                    return new Promise((resolveRule) => {
                        const ruleSql = `
                            INSERT INTO smart_playlist_rules 
                            (playlist_id, field, operator, value, value2, logic_operator, rule_order)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;

                        db.run(
                            ruleSql,
                            [playlistId, rule.field, rule.operator, rule.value, rule.value2 || null, logic, index],
                            (err) => {
                                if (err) {
                                    console.error('Error saving rule:', err);
                                }
                                resolveRule();
                            }
                        );
                    });
                });

                Promise.all(rulePromises).then(() => {
                    // Save settings
                    const settingsSql = `
                        INSERT INTO smart_playlist_settings
                        (playlist_id, auto_update, remove_duplicates, max_tracks, sort_by, energy_flow)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;

                    db.run(
                        settingsSql,
                        [playlistId, autoUpdate ? 1 : 0, removeDuplicates ? 1 : 0, maxTracks, sortBy, energyFlow],
                        (err) => {
                            if (err) {
                                // Settings table might not exist, but playlist is created
                                console.log('Settings table might not exist:', err);
                            }

                            resolve({
                                success: true,
                                playlistId: playlistId,
                                message: 'Smart playlist created successfully',
                            });
                        }
                    );
                });
            });
        });
    };

    // Get all smart playlists
    const getSmartPlaylistsHandler = async () => {
        return new Promise((resolve) => {
            const sql = `
                SELECT 
                    p.*,
                    COUNT(DISTINCT spr.id) as rule_count
                FROM playlists p
                LEFT JOIN smart_playlist_rules spr ON p.id = spr.playlist_id
                WHERE p.type = 'smart'
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error fetching smart playlists:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, playlists: rows });
                }
            });
        });
    };

    // Update smart playlist tracks
    const updateSmartPlaylistHandler = async (event, playlistId) => {
        return new Promise((resolve) => {
            // Get rules for this playlist
            const rulesSql = `
                SELECT * FROM smart_playlist_rules 
                WHERE playlist_id = ? 
                ORDER BY rule_order
            `;

            db.all(rulesSql, [playlistId], (err, rules) => {
                if (err || !rules || rules.length === 0) {
                    resolve({ success: false, error: 'No rules found' });
                    return;
                }

                // Build query from rules
                const conditions = [];
                const params = [];
                const logic = rules[0].logic_operator || 'AND';

                rules.forEach((rule) => {
                    let condition = '';
                    const field = mapFieldToColumn(rule.field);

                    switch (rule.operator) {
                        case 'equals':
                            condition = `${field} = ?`;
                            params.push(rule.value);
                            break;
                        case 'not_equals':
                            condition = `${field} != ?`;
                            params.push(rule.value);
                            break;
                        case 'greater':
                            condition = `${field} > ?`;
                            params.push(parseFloat(rule.value));
                            break;
                        case 'less':
                            condition = `${field} < ?`;
                            params.push(parseFloat(rule.value));
                            break;
                        case 'between':
                            condition = `${field} BETWEEN ? AND ?`;
                            params.push(parseFloat(rule.value));
                            params.push(parseFloat(rule.value2));
                            break;
                        case 'contains':
                            condition = `${field} LIKE ?`;
                            params.push(`%${rule.value}%`);
                            break;
                    }

                    if (condition) {
                        conditions.push(condition);
                    }
                });

                const whereClause = conditions.join(logic === 'OR' ? ' OR ' : ' AND ');
                const tracksSql = `
                    SELECT id FROM audio_files af
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE ${whereClause}
                `;

                db.all(tracksSql, params, (err, tracks) => {
                    if (err) {
                        console.error('Error updating smart playlist:', err);
                        resolve({ success: false, error: err.message });
                        return;
                    }

                    // Clear existing tracks
                    db.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId], () => {
                        // Add new tracks
                        const insertPromises = tracks.map((track, index) => {
                            return new Promise((resolveInsert) => {
                                db.run(
                                    'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)',
                                    [playlistId, track.id, index],
                                    () => resolveInsert()
                                );
                            });
                        });

                        Promise.all(insertPromises).then(() => {
                            resolve({
                                success: true,
                                trackCount: tracks.length,
                                message: `Updated with ${tracks.length} tracks`,
                            });
                        });
                    });
                });
            });
        });
    };

    return {
        previewHandler,
        createHandler,
        getSmartPlaylistsHandler,
        updateSmartPlaylistHandler,
    };
}

// Helper function to map field names to database columns
function mapFieldToColumn(field) {
    const mapping = {
        bpm: 'COALESCE(af.AI_BPM, af.existing_bmp)',
        energy: 'af.AI_ENERGY',
        danceability: 'af.AI_DANCEABILITY',
        valence: 'af.AI_VALENCE',
        acousticness: 'af.AI_ACOUSTICNESS',
        instrumentalness: 'af.AI_INSTRUMENTALNESS',
        liveness: 'af.AI_LIVENESS',
        speechiness: 'af.AI_SPEECHINESS',
        key: 'COALESCE(af.AI_KEY, af.existing_key)',
        genre: 'COALESCE(lm.LLM_GENRE, af.genre)',
        mood: 'COALESCE(lm.AI_MOOD, lm.LLM_MOOD)',
        year: 'af.year',
        duration: 'af.duration',
        artist: 'af.artist',
        title: 'af.title',
        album: 'af.album',
    };

    return mapping[field] || `af.${field}`;
}

// Create tables if they don't exist
function createSmartPlaylistTables(db) {
    // Create smart playlist rules table
    const createRulesTable = `
        CREATE TABLE IF NOT EXISTS smart_playlist_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            field TEXT NOT NULL,
            operator TEXT NOT NULL,
            value TEXT NOT NULL,
            value2 TEXT,
            logic_operator TEXT DEFAULT 'AND',
            rule_order INTEGER DEFAULT 0,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )
    `;

    // Create smart playlist settings table
    const createSettingsTable = `
        CREATE TABLE IF NOT EXISTS smart_playlist_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            auto_update INTEGER DEFAULT 1,
            remove_duplicates INTEGER DEFAULT 0,
            max_tracks INTEGER DEFAULT 0,
            sort_by TEXT DEFAULT 'date_added',
            energy_flow TEXT,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        )
    `;

    db.run(createRulesTable, (err) => {
        if (err) {
            console.log('Rules table might already exist:', err.message);
        }
    });

    db.run(createSettingsTable, (err) => {
        if (err) {
            console.log('Settings table might already exist:', err.message);
        }
    });
}

module.exports = {
    createSmartPlaylistHandlers,
    createSmartPlaylistTables,
};
