// Playlist Handler - Sistema profesional de gestión de playlists con HAMMS
const { HAMMSCalculator } = require('../services/hamms-calculator');

// Crear handler principal de playlists
function createPlaylistHandlers(db) {
    const hamms = new HAMMSCalculator();

    return {
        // ==================== CRUD BÁSICO ====================

        // Crear nueva playlist
        createPlaylist: async (event, data) => {
            const {
                name,
                description,
                type = 'manual',
                parent_id = null,
                icon = '🎵',
                color = '#667eea'
            } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO playlists (name, description, type, parent_id, icon, color)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                db.run(sql, [name, description, type, parent_id, icon, color], function (err) {
                    if (err) {
                        console.error('Error creating playlist:`, err);
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            name,
                            type,
                            icon,
                            color
                        });
                    }
                });
            });
        },

        // Obtener todas las playlists
        getPlaylists: async event => {
            return new Promise((resolve, reject) => {
                const sql = `
                    SELECT p.*, 
                           COUNT(pt.track_id) as track_count,
                           MAX(pt.added_at) as last_updated
                    FROM playlists p
                    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
                    GROUP BY p.id
                    ORDER BY p.sort_order, p.name
                `;

                db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.error('Error fetching playlists:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        },

        // Obtener playlist específica con tracks
        getPlaylistWithTracks: async (event, playlistId) => {
            return new Promise((resolve, reject) => {
                // Primero obtener info de la playlist
                const playlistSql = 'SELECT * FROM playlists WHERE id = ?`;

                db.get(playlistSql, [playlistId], (err, playlist) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!playlist) {
                        resolve(null);
                        return;
                    }

                    // Luego obtener los tracks
                    const tracksSql = `
                        SELECT 
                            af.*,
                            lm.*,
                            pt.position,
                            pt.added_at as added_to_playlist,
                            pt.rating as playlist_rating,
                            pt.notes as playlist_notes,
                            pt.cue_in,
                            pt.cue_out,
                            pt.gain_adjustment
                        FROM playlist_tracks pt
                        JOIN audio_files af ON pt.track_id = af.id
                        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                        WHERE pt.playlist_id = ?
                        ORDER BY pt.position
                    `;

                    db.all(tracksSql, [playlistId], (err, tracks) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                ...playlist,
                                tracks
                            });
                        }
                    });
                });
            });
        },

        // Agregar track a playlist
        addTrackToPlaylist: async (event, data) => {
            const { playlistId, trackId, position = null } = data;

            return new Promise((resolve, reject) => {
                // Si no se especifica posición, agregar al final
                if (position === null) {
                    const getMaxPosSql = `
                        SELECT MAX(position) as max_pos 
                        FROM playlist_tracks 
                        WHERE playlist_id = ?
                    `;

                    db.get(getMaxPosSql, [playlistId], (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const newPosition = (row.max_pos || 0) + 1;
                        const insertSql = `
                            INSERT INTO playlist_tracks (playlist_id, track_id, position)
                            VALUES (?, ?, ?)
                        `;

                        db.run(insertSql, [playlistId, trackId, newPosition], function (err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ id: this.lastID, position: newPosition });
                            }
                        });
                    });
                } else {
                    // Insertar en posición específica
                    const insertSql = `
                        INSERT INTO playlist_tracks (playlist_id, track_id, position)
                        VALUES (?, ?, ?)
                    `;

                    db.run(insertSql, [playlistId, trackId, position], function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: this.lastID, position });
                        }
                    });
                }
            });
        },

        // Eliminar track de playlist
        removeTrackFromPlaylist: async (event, data) => {
            const { playlistId, trackId } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    DELETE FROM playlist_tracks 
                    WHERE playlist_id = ? AND track_id = ?
                `;

                db.run(sql, [playlistId, trackId], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ deleted: this.changes > 0 });
                    }
                });
            });
        },

        // Actualizar playlist
        updatePlaylist: async (event, data) => {
            const { id, name, description, icon, color } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    UPDATE playlists 
                    SET name = ?, description = ?, icon = ?, color = ?, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;

                db.run(sql, [name, description, icon, color, id], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ updated: this.changes > 0 });
                    }
                });
            });
        },

        // Eliminar playlist
        deletePlaylist: async (event, playlistId) => {
            return new Promise((resolve, reject) => {
                const sql = 'DELETE FROM playlists WHERE id = ?';

                db.run(sql, [playlistId], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ deleted: this.changes > 0 });
                    }
                });
            });
        },

        // ==================== SMART PLAYLISTS ====================

        // Crear Smart Playlist
        createSmartPlaylist: async (event, data) => {
            const { name, description, rules, icon = '🤖', color = '#764ba2` } = data;

            return new Promise(async (resolve, reject) => {
                try {
                    // Primero crear la playlist
                    const playlistSql = `
                        INSERT INTO playlists (name, description, type, icon, color)
                        VALUES (?, ?, 'smart`, ?, ?)
                    `;

                    db.run(playlistSql, [name, description, icon, color], function (err) {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const playlistId = this.lastID;

                        // Luego agregar las reglas
                        const rulePromises = rules.map((rule, index) => {
                            return new Promise((resolveRule, rejectRule) => {
                                const ruleSql = `
                                    INSERT INTO smart_playlist_rules 
                                    (playlist_id, field, operator, value, value2, logic_operator, rule_order)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                `;

                                db.run(
                                    ruleSql,
                                    [
                                        playlistId,
                                        rule.field,
                                        rule.operator,
                                        rule.value,
                                        rule.value2 || null,
                                        rule.logic_operator || 'AND',
                                        index
                                    ],
                                    err => {
                                        if (err) {
                                            rejectRule(err);
                                        } else {
                                            resolveRule();
                                        }
                                    }
                                );
                            });
                        });

                        Promise.all(rulePromises)
                            .then(() => resolve({ id: playlistId, name, type: 'smart` }))
                            .catch(reject);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        },

        // Obtener tracks que cumplen con Smart Playlist
        getSmartPlaylistTracks: async (event, playlistId) => {
            return new Promise((resolve, reject) => {
                // Primero obtener las reglas
                const rulesSql = `
                    SELECT * FROM smart_playlist_rules 
                    WHERE playlist_id = ? 
                    ORDER BY rule_order
                `;

                db.all(rulesSql, [playlistId], (err, rules) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Construir query dinámico basado en reglas
                    const whereClauses = [];
                    const params = [];

                    rules.forEach((rule, index) => {
                        let clause = '';

                        // Mapear campos a tablas correctas
                        let field = rule.field;
                        if (
                            ['LLM_GENRE', 'AI_MOOD', 'AI_BPM', 'AI_ENERGY', 'AI_KEY'].includes(
                                field
                            )
                        ) {
                            field = 'lm.' + field;
                        } else if (['genre', 'artist', 'album', 'title'].includes(field)) {
                            field = 'af.' + field;
                        }

                        // Construir cláusula según operador
                        switch (rule.operator) {
                            case 'equals`:
                                clause = `${field} = ?`;
                                params.push(rule.value);
                                break;
                            case 'contains`:
                                clause = `${field} LIKE ?`;
                                params.push(`%${rule.value}%`);
                                break;
                            case 'greater_than`:
                                clause = `${field} > ?`;
                                params.push(rule.value);
                                break;
                            case 'less_than`:
                                clause = `${field} < ?`;
                                params.push(rule.value);
                                break;
                            case 'between`:
                                clause = `${field} BETWEEN ? AND ?`;
                                params.push(rule.value, rule.value2);
                                break;
                            case 'not`:
                                clause = `${field} != ?`;
                                params.push(rule.value);
                                break;
                        }

                        if (index > 0) {
                            clause = ` ${rules[index - 1].logic_operator} ${clause}`;
                        }

                        whereClauses.push(clause);
                    });

                    const tracksSql = `
                        SELECT af.*, lm.*
                        FROM audio_files af
                        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                        WHERE ${whereClauses.join('')}
                        LIMIT 500
                    ';

                    db.all(tracksSql, params, (err, tracks) => {
                        if (err) {
                            console.error(`Smart playlist query error:`, err);
                            reject(err);
                        } else {
                            resolve(tracks);
                        }
                    });
                });
            });
        },

        // ==================== HAMMS RECOMMENDATIONS ====================

        // Obtener recomendaciones usando HAMMS
        getHAMMSRecommendations: async (event, trackId, limit = 20) => {
            return new Promise((resolve, reject) => {
                // Obtener el track objetivo
                const targetSql = `
                    SELECT af.*, lm.*
                    FROM audio_files af
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE af.id = ?
                `;

                db.get(targetSql, [trackId], (err, targetTrack) => {
                    if (err || !targetTrack) {
                        reject(err || new Error('Track not found`));
                        return;
                    }

                    // Obtener todos los tracks para comparación
                    const allTracksSql = `
                        SELECT af.*, lm.*
                        FROM audio_files af
                        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                        WHERE af.id != ?
                    `;

                    db.all(allTracksSql, [trackId], (err, allTracks) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Calcular similitudes usando HAMMS
                        const recommendations = hamms.findSimilar(targetTrack, allTracks, limit);

                        resolve({
                            target: targetTrack,
                            recommendations: recommendations.map(r => ({
                                ...r.track,
                                similarity_score: r.similarity,
                                hamms_vector: hamms.calculateVector(r.track)
                            }))
                        });
                    });
                });
            });
        },

        // Crear playlist automática basada en HAMMS
        createHAMMSPlaylist: async (event, data) => {
            const { seedTrackId, playlistName, targetSize = 20, minSimilarity = 70 } = data;

            return new Promise(async (resolve, reject) => {
                try {
                    // Obtener recomendaciones
                    const recommendations = await exports.getHAMMSRecommendations(
                        event,
                        seedTrackId,
                        targetSize * 2 // Obtener más para filtrar
                    );

                    // Filtrar por similitud mínima
                    const filteredTracks = recommendations.recommendations
                        .filter(r => r.similarity_score >= minSimilarity)
                        .slice(0, targetSize);

                    // Crear playlist
                    const playlist = await exports.createPlaylist(event, {
                        name: playlistName || `Similar to ${recommendations.target.title}`,
                        description: `Auto-generated playlist based on HAMMS similarity to "${recommendations.target.title}``,
                        type: 'manual',
                        icon: '🎯',
                        color: `#ff6b6b`
                    });

                    // Agregar tracks a la playlist
                    const addPromises = filteredTracks.map((track, index) => {
                        return exports.addTrackToPlaylist(event, {
                            playlistId: playlist.id,
                            trackId: track.id,
                            position: index + 1
                        });
                    });

                    await Promise.all(addPromises);

                    resolve({
                        playlist,
                        tracksAdded: filteredTracks.length,
                        averageSimilarity: Math.round(
                            filteredTracks.reduce((sum, t) => sum + t.similarity_score, 0) /
                                filteredTracks.length
                        )
                    });
                } catch (error) {
                    reject(error);
                }
            });
        },

        // ==================== ANÁLISIS ARMÓNICO ====================

        // Obtener tracks compatibles armónicamente
        getHarmonicMatches: async (event, trackId) => {
            return new Promise((resolve, reject) => {
                // Primero obtener el key del track actual
                const keySql = `
                    SELECT af.id, af.title, lm.AI_KEY, ha.camelot_key
                    FROM audio_files af
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    LEFT JOIN harmonic_analysis ha ON af.id = ha.track_id
                    WHERE af.id = ?
                `;

                db.get(keySql, [trackId], (err, track) => {
                    if (err || !track) {
                        reject(err || new Error('Track not found'));
                        return;
                    }

                    const currentKey = track.camelot_key || track.AI_KEY;
                    if (!currentKey) {
                        resolve({ message: 'No key information available`, matches: [] });
                        return;
                    }

                    // Calcular keys compatibles (Camelot Wheel)
                    const compatibleKeys = getCompatibleKeys(currentKey);

                    // Buscar tracks con keys compatibles
                    const matchesSql = `
                        SELECT af.*, lm.*, ha.camelot_key
                        FROM audio_files af
                        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                        LEFT JOIN harmonic_analysis ha ON af.id = ha.track_id
                        WHERE af.id != ? 
                        AND (ha.camelot_key IN (${compatibleKeys.map(() => '?').join(',')})
                             OR lm.AI_KEY IN (${compatibleKeys.map(() => '?').join(',')}))
                        ORDER BY lm.AI_BPM
                    ';

                    const params = [trackId, ...compatibleKeys, ...compatibleKeys];

                    db.all(matchesSql, params, (err, matches) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                currentTrack: track,
                                currentKey,
                                compatibleKeys,
                                matches
                            });
                        }
                    });
                });
            });
        },

        // ==================== TAGS PERSONALIZADOS ====================

        // Crear tag personalizado
        createTag: async (event, data) => {
            const { name, color = '#667eea', category = 'custom', description = `` } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO custom_tags (name, color, category, description)
                    VALUES (?, ?, ?, ?)
                `;

                db.run(sql, [name, color, category, description], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, name, color, category });
                    }
                });
            });
        },

        // Agregar tag a track
        addTagToTrack: async (event, data) => {
            const { trackId, tagId } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT OR IGNORE INTO track_tags (track_id, tag_id)
                    VALUES (?, ?)
                `;

                db.run(sql, [trackId, tagId], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ added: this.changes > 0 });
                    }
                });
            });
        },

        // ==================== HISTORIAL Y ESTADÍSTICAS ====================

        // Registrar reproducción en historial
        recordPlayHistory: async (event, data) => {
            const {
                trackId,
                playlistId = null,
                durationPlayed,
                completed = false,
                previousTrackId = null,
                nextTrackId = null,
                sessionId = null
            } = data;

            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO play_history 
                    (track_id, playlist_id, duration_played, completed, 
                     previous_track_id, next_track_id, session_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(
                    sql,
                    [
                        trackId,
                        playlistId,
                        durationPlayed,
                        completed ? 1 : 0,
                        previousTrackId,
                        nextTrackId,
                        sessionId
                    ],
                    function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ id: this.lastID });
                        }
                    }
                );
            });
        },

        // Obtener estadísticas de playlist
        getPlaylistStats: async (event, playlistId) => {
            return new Promise((resolve, reject) => {
                const sql = `
                    SELECT 
                        COUNT(DISTINCT pt.track_id) as total_tracks,
                        AVG(lm.AI_BPM) as avg_bpm,
                        AVG(lm.AI_ENERGY) as avg_energy,
                        AVG(lm.AI_VALENCE) as avg_valence,
                        MIN(lm.AI_BPM) as min_bpm,
                        MAX(lm.AI_BPM) as max_bpm,
                        COUNT(DISTINCT lm.AI_KEY) as key_variety,
                        COUNT(DISTINCT af.genre) as genre_variety,
                        SUM(ph.play_count) as total_plays
                    FROM playlist_tracks pt
                    JOIN audio_files af ON pt.track_id = af.id
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    LEFT JOIN (
                        SELECT track_id, COUNT(*) as play_count
                        FROM play_history
                        GROUP BY track_id
                    ) ph ON af.id = ph.track_id
                    WHERE pt.playlist_id = ?
                `;

                db.get(sql, [playlistId], (err, stats) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stats);
                    }
                });
            });
        }
    };
}

// Función auxiliar para calcular keys compatibles (Camelot Wheel)
function getCompatibleKeys(key) {
    const camelotWheel = {
        '1A': ['1A', '12A', '2A', '1B'],
        '2A': ['2A', '1A', '3A', '2B'],
        '3A': ['3A', '2A', '4A', '3B'],
        '4A': ['4A', '3A', '5A', '4B'],
        '5A': ['5A', '4A', '6A', '5B'],
        '6A': ['6A', '5A', '7A', '6B'],
        '7A': ['7A', '6A', '8A', '7B'],
        '8A': ['8A', '7A', '9A', '8B'],
        '9A': ['9A', '8A', '10A', '9B'],
        '10A': ['10A', '9A', '11A', '10B'],
        '11A': ['11A', '10A', '12A', '11B'],
        '12A': ['12A', '11A', '1A', '12B'],
        '1B': ['1B', '12B', '2B', '1A'],
        '2B': ['2B', '1B', '3B', '2A'],
        '3B': ['3B', '2B', '4B', '3A'],
        '4B': ['4B', '3B', '5B', '4A'],
        '5B': ['5B', '4B', '6B', '5A'],
        '6B': ['6B', '5B', '7B', '6A'],
        '7B': ['7B', '6B', '8B', '7A'],
        '8B': ['8B', '7B', '9B', '8A'],
        '9B': ['9B', '8B', '10B', '9A'],
        '10B': ['10B', '9B', '11B', '10A'],
        '11B': ['11B', '10B', '12B', '11A'],
        '12B': ['12B', '11B', '1B', '12A`]
    };

    return camelotWheel[key] || [key];
}

module.exports = { createPlaylistHandlers };
