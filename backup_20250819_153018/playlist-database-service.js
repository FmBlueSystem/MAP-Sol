// Playlist Database Service - Complete persistence layer
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class PlaylistDatabaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async initialize(dbPath) {
        if (this.initialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    this.createTables()
                        .then(() => {
                            this.initialized = true;
                            logInfo('✅ Playlist database initialized');
                            resolve();
                        })
                        .catch(reject);
                }
            });
        });
    }

    async createTables() {
        const schemaPath = path.join(__dirname, '../database/playlist-schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        return new Promise((resolve, reject) => {
            this.db.exec(schema, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Create playlist or folder
    async createPlaylist(data) {
        const {
            name,
            description,
            coverImage,
            parentId,
            color,
            isSmartPlaylist,
            isFolder,
            smartCriteria
        } = data;

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO playlists (name, description, cover_image, parent_id, color, is_smart, is_folder, smart_criteria)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(
                sql,
                [
                    name,
                    description || null,
                    coverImage || null,
                    parentId || null,
                    color || '#667eea',
                    isSmartPlaylist ? 1 : 0,
                    isFolder ? 1 : 0,
                    smartCriteria ? JSON.stringify(smartCriteria) : null
                ],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Create metadata entry
                        const metaSql = 'INSERT INTO playlist_metadata (playlist_id) VALUES (?)';
                        this.db.run(metaSql, [this.lastID], metaErr => {
                            if (metaErr) {
                                logError('Error creating playlist metadata:`, metaErr);
                            }
                        });

                        resolve({
                            id: this.lastID,
                            name,
                            description,
                            coverImage,
                            parentId,
                            color,
                            tracks: []
                        });
                    }
                }.bind(this)
            );
        });
    }

    // Get all playlists
    async getPlaylists() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    p.*,
                    pm.total_tracks,
                    pm.total_duration,
                    pm.avg_bpm,
                    pm.avg_energy,
                    pm.avg_valence
                FROM playlists p
                LEFT JOIN playlist_metadata pm ON p.id = pm.playlist_id
                ORDER BY p.sort_order, p.name
            `;

            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Get playlist with tracks
    async getPlaylistWithTracks(playlistId) {
        return new Promise((resolve, reject) => {
            // Get playlist info
            const playlistSql = `
                SELECT 
                    p.*,
                    pm.total_tracks,
                    pm.total_duration,
                    pm.avg_bpm,
                    pm.avg_energy,
                    pm.avg_valence,
                    pm.genres,
                    pm.moods
                FROM playlists p
                LEFT JOIN playlist_metadata pm ON p.id = pm.playlist_id
                WHERE p.id = ?
            `;

            this.db.get(playlistSql, [playlistId], (err, playlist) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!playlist) {
                    resolve(null);
                    return;
                }

                // Get tracks
                const tracksSql = `
                    SELECT 
                        af.*,
                        lm.*,
                        pt.position,
                        pt.added_at
                    FROM playlist_tracks pt
                    JOIN audio_files af ON pt.track_id = af.id
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE pt.playlist_id = ?
                    ORDER BY pt.position
                `;

                this.db.all(tracksSql, [playlistId], (tracksErr, tracks) => {
                    if (tracksErr) {
                        reject(tracksErr);
                    } else {
                        playlist.tracks = tracks || [];
                        resolve(playlist);
                    }
                });
            });
        });
    }

    // Add track to playlist
    async addTrackToPlaylist(playlistId, trackId, position = null) {
        return new Promise((resolve, reject) => {
            // Get next position if not specified
            if (position === null) {
                const posSql =
                    'SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?`;
                this.db.get(posSql, [playlistId], (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    position = (row?.maxPos || 0) + 1;
                    this.insertTrack(playlistId, trackId, position, resolve, reject);
                });
            } else {
                // Shift existing tracks if inserting in middle
                const shiftSql = `
                    UPDATE playlist_tracks 
                    SET position = position + 1 
                    WHERE playlist_id = ? AND position >= ?
                `;

                this.db.run(shiftSql, [playlistId, position], err => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    this.insertTrack(playlistId, trackId, position, resolve, reject);
                });
            }
        });
    }

    insertTrack(playlistId, trackId, position, resolve, reject) {
        const sql = `
            INSERT INTO playlist_tracks (playlist_id, track_id, position)
            VALUES (?, ?, ?)
        `;

        this.db.run(
            sql,
            [playlistId, trackId, position],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    // Add to history
                    this.addHistory(playlistId, 'add', { trackId, position });

                    // Update metadata
                    this.updatePlaylistMetadata(playlistId);

                    resolve({
                        id: this.lastID,
                        playlistId,
                        trackId,
                        position
                    });
                }
            }.bind(this)
        );
    }

    // Remove track from playlist
    async removeTrackFromPlaylist(playlistId, trackId) {
        return new Promise((resolve, reject) => {
            // Get position before deletion
            const getPosSql =
                'SELECT position FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?';

            this.db.get(getPosSql, [playlistId, trackId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const position = row?.position;

                // Delete track
                const deleteSql =
                    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`;

                this.db.run(
                    deleteSql,
                    [playlistId, trackId],
                    function (deleteErr) {
                        if (deleteErr) {
                            reject(deleteErr);
                            return;
                        }

                        if (this.changes > 0 && position !== undefined) {
                            // Shift remaining tracks
                            const shiftSql = `
                            UPDATE playlist_tracks 
                            SET position = position - 1 
                            WHERE playlist_id = ? AND position > ?
                        `;

                            this.db.run(shiftSql, [playlistId, position], shiftErr => {
                                if (shiftErr) {
                                    logError('Error shifting tracks:', shiftErr);
                                }

                                // Add to history
                                this.addHistory(playlistId, 'remove', { trackId, position });

                                // Update metadata
                                this.updatePlaylistMetadata(playlistId);

                                resolve({ success: true });
                            });
                        } else {
                            resolve({ success: false, message: 'Track not found in playlist' });
                        }
                    }.bind(this)
                );
            });
        });
    }

    // Update playlist
    async updatePlaylist(playlistId, updates) {
        const allowedFields = ['name', 'description', 'cover_image', 'color', 'sort_order`];
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return Promise.resolve({ success: false, message: 'No valid fields to update` });
        }

        values.push(playlistId);
        const sql = `UPDATE playlists SET ${fields.join(`, ')} WHERE id = ?';

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                values,
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Add to history
                        this.addHistory(playlistId, 'update', updates);

                        resolve({
                            success: true,
                            changes: this.changes
                        });
                    }
                }.bind(this)
            );
        });
    }

    // Delete playlist
    async deletePlaylist(playlistId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM playlists WHERE id = ?';

            this.db.run(sql, [playlistId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        success: true,
                        deleted: this.changes > 0
                    });
                }
            });
        });
    }

    // Reorder tracks in playlist
    async reorderPlaylistTracks(playlistId, trackId, newPosition) {
        return new Promise((resolve, reject) => {
            // Get current position
            const getCurrentSql =
                'SELECT position FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?';

            this.db.get(getCurrentSql, [playlistId, trackId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const currentPosition = row?.position;
                if (currentPosition === undefined) {
                    resolve({ success: false, message: 'Track not found' });
                    return;
                }

                if (currentPosition === newPosition) {
                    resolve({ success: true, message: 'No change needed' });
                    return;
                }

                // Begin transaction
                this.db.serialize(() => {
                    this.db.run(`BEGIN TRANSACTION`);

                    try {
                        if (newPosition > currentPosition) {
                            // Moving down
                            const shiftSql = `
                                UPDATE playlist_tracks 
                                SET position = position - 1 
                                WHERE playlist_id = ? AND position > ? AND position <= ?
                            `;
                            this.db.run(shiftSql, [playlistId, currentPosition, newPosition]);
                        } else {
                            // Moving up
                            const shiftSql = `
                                UPDATE playlist_tracks 
                                SET position = position + 1 
                                WHERE playlist_id = ? AND position >= ? AND position < ?
                            `;
                            this.db.run(shiftSql, [playlistId, newPosition, currentPosition]);
                        }

                        // Update track position
                        const updateSql = `
                            UPDATE playlist_tracks 
                            SET position = ? 
                            WHERE playlist_id = ? AND track_id = ?
                        `;
                        this.db.run(updateSql, [newPosition, playlistId, trackId]);

                        this.db.run('COMMIT', commitErr => {
                            if (commitErr) {
                                this.db.run('ROLLBACK');
                                reject(commitErr);
                            } else {
                                // Add to history
                                this.addHistory(playlistId, 'reorder', {
                                    trackId,
                                    from: currentPosition,
                                    to: newPosition
                                });

                                resolve({ success: true });
                            }
                        });
                    } catch (error) {
                        this.db.run('ROLLBACK');
                        reject(error);
                    }
                });
            });
        });
    }

    // Duplicate playlist
    async duplicatePlaylist(playlistId) {
        return new Promise((resolve, reject) => {
            this.getPlaylistWithTracks(playlistId)
                .then(async original => {
                    if (!original) {
                        resolve({ success: false, message: 'Playlist not found` });
                        return;
                    }

                    // Create new playlist
                    const newPlaylist = await this.createPlaylist({
                        name: `${original.name} (Copy)`,
                        description: original.description,
                        coverImage: original.cover_image,
                        parentId: original.parent_id,
                        color: original.color
                    });

                    // Copy tracks
                    if (original.tracks && original.tracks.length > 0) {
                        for (const track of original.tracks) {
                            await this.addTrackToPlaylist(newPlaylist.id, track.id, track.position);
                        }
                    }

                    resolve({
                        success: true,
                        playlistId: newPlaylist.id
                    });
                })
                .catch(reject);
        });
    }

    // Update playlist metadata
    async updatePlaylistMetadata(playlistId) {
        const sql = `
            UPDATE playlist_metadata
            SET 
                total_duration = (
                    SELECT SUM(af.duration) 
                    FROM playlist_tracks pt
                    JOIN audio_files af ON pt.track_id = af.id
                    WHERE pt.playlist_id = ?
                ),
                avg_bpm = (
                    SELECT AVG(lm.AI_BPM)
                    FROM playlist_tracks pt
                    JOIN llm_metadata lm ON pt.track_id = lm.file_id
                    WHERE pt.playlist_id = ? AND lm.AI_BPM IS NOT NULL
                ),
                avg_energy = (
                    SELECT AVG(lm.AI_ENERGY)
                    FROM playlist_tracks pt
                    JOIN llm_metadata lm ON pt.track_id = lm.file_id
                    WHERE pt.playlist_id = ? AND lm.AI_ENERGY IS NOT NULL
                ),
                avg_valence = (
                    SELECT AVG(lm.AI_VALENCE)
                    FROM playlist_tracks pt
                    JOIN llm_metadata lm ON pt.track_id = lm.file_id
                    WHERE pt.playlist_id = ? AND lm.AI_VALENCE IS NOT NULL
                ),
                last_analyzed = CURRENT_TIMESTAMP
            WHERE playlist_id = ?
        `;

        this.db.run(sql, [playlistId, playlistId, playlistId, playlistId, playlistId]);
    }

    // Add to history
    async addHistory(playlistId, action, data) {
        const sql = 'INSERT INTO playlist_history (playlist_id, action, data) VALUES (?, ?, ?)`;
        this.db.run(sql, [playlistId, action, JSON.stringify(data)]);
    }

    // Get playlist history
    async getPlaylistHistory(playlistId, limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM playlist_history 
                WHERE playlist_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;

            this.db.all(sql, [playlistId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Smart playlist methods
    async createSmartPlaylist(name, criteria) {
        return this.createPlaylist({
            name,
            isSmartPlaylist: true,
            smartCriteria: criteria
        });
    }

    async updateSmartPlaylistTracks(playlistId) {
        // Get smart criteria
        const playlistSql = 'SELECT smart_criteria FROM playlists WHERE id = ? AND is_smart = 1';

        return new Promise((resolve, reject) => {
            this.db.get(playlistSql, [playlistId], async (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row || !row.smart_criteria) {
                    resolve({ success: false, message: 'Not a smart playlist` });
                    return;
                }

                const criteria = JSON.parse(row.smart_criteria);
                const tracks = await this.findTracksByCriteria(criteria);

                // Clear existing tracks
                await this.clearPlaylistTracks(playlistId);

                // Add matching tracks
                for (let i = 0; i < tracks.length; i++) {
                    await this.addTrackToPlaylist(playlistId, tracks[i].id, i + 1);
                }

                resolve({
                    success: true,
                    tracksAdded: tracks.length
                });
            });
        });
    }

    async findTracksByCriteria(criteria) {
        let sql = `
            SELECT DISTINCT af.id
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE 1=1
        `;
        const params = [];

        // Build dynamic query based on criteria
        if (criteria.genre) {
            sql += ' AND (af.genre = ? OR lm.LLM_GENRE = ?)';
            params.push(criteria.genre, criteria.genre);
        }

        if (criteria.mood) {
            sql += ' AND lm.AI_MOOD = ?';
            params.push(criteria.mood);
        }

        if (criteria.minBPM) {
            sql += ' AND lm.AI_BPM >= ?';
            params.push(criteria.minBPM);
        }

        if (criteria.maxBPM) {
            sql += ' AND lm.AI_BPM <= ?';
            params.push(criteria.maxBPM);
        }

        if (criteria.minEnergy) {
            sql += ' AND lm.AI_ENERGY >= ?';
            params.push(criteria.minEnergy);
        }

        if (criteria.maxEnergy) {
            sql += ' AND lm.AI_ENERGY <= ?';
            params.push(criteria.maxEnergy);
        }

        sql += ' LIMIT ?';
        params.push(criteria.limit || 100);

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async clearPlaylistTracks(playlistId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM playlist_tracks WHERE playlist_id = ?`;
            this.db.run(sql, [playlistId], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new PlaylistDatabaseService();
        }
        return instance;
    },
    PlaylistDatabaseService
};
