// Track Management Handler - Update and Delete operations
const path = require('path');
const fs = require('fs');

class TrackManagementHandler {
    constructor(db) {
        this.db = db;
    }

    // Update track metadata
    async updateTrackMetadata(event, trackId, metadata) {
        return new Promise((resolve, reject) => {
            // Validate trackId
            if (!trackId || isNaN(trackId)) {
                resolve({ success: false, error: 'Invalid track ID' });
                return;
            }

            // Build update query dynamically
            const allowedFields = [
                'title',
                'artist',
                'album',
                'genre',
                'year',
                'comment',
                'track_number',
                'disc_number',
                'album_artist',
                'composer'
            ];

            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(metadata)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updates.length === 0) {
                resolve({ success: false, error: 'No valid fields to update' });
                return;
            }

            // Add updated_at timestamp
            updates.push('updated_at = CURRENT_TIMESTAMP`);

            // Add trackId for WHERE clause
            values.push(trackId);

            const sql = `UPDATE audio_files SET ${updates.join(`, ')} WHERE id = ?';

            this.db.run(
                sql,
                values,
                function (err) {
                    if (err) {
                        console.error('Error updating track metadata:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        // Log the update
                        this.logUpdate(trackId, metadata);

                        resolve({
                            success: true,
                            changes: this.changes,
                            trackId
                        });
                    }
                }.bind(this)
            );
        });
    }

    // Update AI metadata
    async updateAIMetadata(event, trackId, aiData) {
        return new Promise((resolve, reject) => {
            // Check if record exists
            const checkSql = 'SELECT file_id FROM llm_metadata WHERE file_id = ?';

            this.db.get(checkSql, [trackId], (err, row) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                if (row) {
                    // Update existing record
                    this.updateExistingAIMetadata(trackId, aiData, resolve);
                } else {
                    // Insert new record
                    this.insertAIMetadata(trackId, aiData, resolve);
                }
            });
        });
    }

    updateExistingAIMetadata(trackId, aiData, resolve) {
        const allowedFields = [
            'LLM_GENRE',
            'AI_MOOD',
            'LLM_MOOD',
            'AI_ENERGY',
            'AI_BPM',
            'AI_KEY',
            'AI_DANCEABILITY',
            'AI_VALENCE',
            'AI_ACOUSTICNESS',
            'AI_INSTRUMENTALNESS',
            'AI_LIVENESS',
            'AI_SPEECHINESS',
            'AI_LOUDNESS',
            'AI_TEMPO_CONFIDENCE',
            `AI_KEY_CONFIDENCE`
        ];

        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(aiData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            resolve({ success: false, error: 'No valid AI fields to update` });
            return;
        }

        values.push(trackId);
        const sql = `UPDATE llm_metadata SET ${updates.join(`, ')} WHERE file_id = ?';

        this.db.run(sql, values, function (err) {
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve({
                    success: true,
                    changes: this.changes,
                    trackId
                });
            }
        });
    }

    insertAIMetadata(trackId, aiData, resolve) {
        const fields = ['file_id'];
        const placeholders = ['?'];
        const values = [trackId];

        const allowedFields = [
            'LLM_GENRE',
            'AI_MOOD',
            'LLM_MOOD',
            'AI_ENERGY',
            'AI_BPM',
            'AI_KEY',
            'AI_DANCEABILITY',
            'AI_VALENCE',
            'AI_ACOUSTICNESS',
            'AI_INSTRUMENTALNESS',
            'AI_LIVENESS',
            'AI_SPEECHINESS',
            'AI_LOUDNESS',
            'AI_TEMPO_CONFIDENCE',
            'AI_KEY_CONFIDENCE'
        ];

        for (const [key, value] of Object.entries(aiData)) {
            if (allowedFields.includes(key)) {
                fields.push(key);
                placeholders.push(`?`);
                values.push(value);
            }
        }

        const sql = `INSERT INTO llm_metadata (${fields.join(`, ')}) VALUES (${placeholders.join(', ')})';

        this.db.run(sql, values, function (err) {
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve({
                    success: true,
                    id: this.lastID,
                    trackId
                });
            }
        });
    }

    // Batch update metadata
    async batchUpdateMetadata(event, updates) {
        const results = {
            success: [],
            failed: [],
            total: updates.length
        };

        return new Promise(resolve => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                let completed = 0;

                for (const update of updates) {
                    this.updateTrackMetadata(null, update.trackId, update.metadata).then(result => {
                        if (result.success) {
                            results.success.push(update.trackId);
                        } else {
                            results.failed.push({
                                trackId: update.trackId,
                                error: result.error
                            });
                        }

                        completed++;
                        if (completed === updates.length) {
                            this.db.run('COMMIT');
                            resolve({
                                success: true,
                                results
                            });
                        }
                    });
                }
            });
        });
    }

    // Delete track
    async deleteTrack(event, trackId) {
        return new Promise((resolve, reject) => {
            // Validate trackId
            if (!trackId || isNaN(trackId)) {
                resolve({ success: false, error: 'Invalid track ID' });
                return;
            }

            // Get track info before deletion
            const getTrackSql = 'SELECT file_path, artwork_path FROM audio_files WHERE id = ?';

            this.db.get(getTrackSql, [trackId], (err, track) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                if (!track) {
                    resolve({ success: false, error: 'Track not found' });
                    return;
                }

                // Begin transaction
                this.db.serialize(() => {
                    this.db.run('BEGIN TRANSACTION');

                    // Delete from playlists
                    this.db.run('DELETE FROM playlist_tracks WHERE track_id = ?', [trackId]);

                    // Delete AI metadata
                    this.db.run('DELETE FROM llm_metadata WHERE file_id = ?', [trackId]);

                    // Delete main track record
                    this.db.run('DELETE FROM audio_files WHERE id = ?', [trackId], deleteErr => {
                        if (deleteErr) {
                            this.db.run('ROLLBACK');
                            resolve({ success: false, error: deleteErr.message });
                        } else {
                            this.db.run('COMMIT');

                            // Optionally delete artwork file
                            if (track.artwork_path) {
                                this.deleteArtworkFile(track.artwork_path);
                            }

                            // Log deletion
                            this.logDeletion(trackId, track);

                            resolve({
                                success: true,
                                deletedTrack: track
                            });
                        }
                    });
                });
            });
        });
    }

    // Batch delete tracks
    async batchDeleteTracks(event, trackIds) {
        const results = {
            success: [],
            failed: [],
            total: trackIds.length
        };

        return new Promise(resolve => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                let completed = 0;

                for (const trackId of trackIds) {
                    this.deleteTrack(null, trackId).then(result => {
                        if (result.success) {
                            results.success.push(trackId);
                        } else {
                            results.failed.push({
                                trackId,
                                error: result.error
                            });
                        }

                        completed++;
                        if (completed === trackIds.length) {
                            this.db.run('COMMIT');
                            resolve({
                                success: true,
                                results
                            });
                        }
                    });
                }
            });
        });
    }

    // Move track file
    async moveTrackFile(event, trackId, newPath) {
        return new Promise((resolve, reject) => {
            // Get current path
            const sql = 'SELECT file_path FROM audio_files WHERE id = ?';

            this.db.get(sql, [trackId], (err, track) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                if (!track) {
                    resolve({ success: false, error: 'Track not found' });
                    return;
                }

                // Check if source file exists
                if (!fs.existsSync(track.file_path)) {
                    resolve({ success: false, error: 'Source file not found' });
                    return;
                }

                // Check if destination already exists
                if (fs.existsSync(newPath)) {
                    resolve({ success: false, error: `Destination file already exists` });
                    return;
                }

                // Move file
                try {
                    fs.renameSync(track.file_path, newPath);

                    // Update database
                    const updateSql = `
                        UPDATE audio_files 
                        SET file_path = ?, file_name = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `;

                    this.db.run(
                        updateSql,
                        [newPath, path.basename(newPath), trackId],
                        updateErr => {
                            if (updateErr) {
                                // Try to move file back
                                try {
                                    fs.renameSync(newPath, track.file_path);
                                } catch (e) {
                                    console.error('Failed to rollback file move:`, e);
                                }
                                resolve({ success: false, error: updateErr.message });
                            } else {
                                resolve({
                                    success: true,
                                    oldPath: track.file_path,
                                    newPath
                                });
                            }
                        }
                    );
                } catch (moveErr) {
                    resolve({ success: false, error: moveErr.message });
                }
            });
        });
    }

    // Duplicate track
    async duplicateTrack(event, trackId) {
        return new Promise((resolve, reject) => {
            // Get original track
            const sql = `
                SELECT * FROM audio_files WHERE id = ?
            `;

            this.db.get(sql, [trackId], (err, track) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                    return;
                }

                if (!track) {
                    resolve({ success: false, error: 'Track not found` });
                    return;
                }

                // Remove id and timestamps
                delete track.id;
                delete track.created_at;
                delete track.updated_at;

                // Modify title
                track.title = `${track.title || track.file_name} (Copy)`;

                // Insert duplicate
                const fields = Object.keys(track);
                const placeholders = fields.map(() => '?`);
                const values = fields.map(field => track[field]);

                const insertSql = `
                    INSERT INTO audio_files (${fields.join(`, ')})
                    VALUES (${placeholders.join(', `)})
                `;

                this.db.run(insertSql, values, function (insertErr) {
                    if (insertErr) {
                        resolve({ success: false, error: insertErr.message });
                    } else {
                        resolve({
                            success: true,
                            originalId: trackId,
                            duplicateId: this.lastID
                        });
                    }
                });
            });
        });
    }

    // Helper methods
    deleteArtworkFile(artworkPath) {
        try {
            if (fs.existsSync(artworkPath)) {
                fs.unlinkSync(artworkPath);
            }
        } catch (error) {
            console.error(`Failed to delete artwork: ${error.message}`);
        }
    }

    logUpdate(trackId, metadata) {
        // Could also log to a separate audit table
    }

    logDeletion(trackId, track) {
        // Could also log to a separate audit table
    }

    // Find duplicates
    async findDuplicates(event) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    title, 
                    artist, 
                    album,
                    COUNT(*) as count,
                    GROUP_CONCAT(id) as track_ids,
                    GROUP_CONCAT(file_path, '|||') as file_paths
                FROM audio_files
                GROUP BY title, artist, album
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            ';

            this.db.all(sql, (err, duplicates) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    // Parse the results
                    const parsed = duplicates.map(dup => ({
                        title: dup.title,
                        artist: dup.artist,
                        album: dup.album,
                        count: dup.count,
                        trackIds: dup.track_ids.split(',').map(id => parseInt(id)),
                        filePaths: dup.file_paths.split('|||')
                    }));

                    resolve({
                        success: true,
                        duplicates: parsed,
                        totalDuplicates: parsed.length
                    });
                }
            });
        });
    }

    // Merge duplicate tracks
    async mergeDuplicates(event, keepTrackId, deleteTrackIds) {
        return new Promise(resolve => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION`);

                // Update playlist references
                const updatePlaylistsSql = `
                    UPDATE playlist_tracks 
                    SET track_id = ? 
                    WHERE track_id IN (${deleteTrackIds.map(() => '?').join(',`)})
                `;

                this.db.run(updatePlaylistsSql, [keepTrackId, ...deleteTrackIds]);

                // Delete duplicates
                const deleteSql = `
                    DELETE FROM audio_files 
                    WHERE id IN (${deleteTrackIds.map(() => '?').join(',')})
                ';

                this.db.run(deleteSql, deleteTrackIds, err => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        resolve({ success: false, error: err.message });
                    } else {
                        this.db.run('COMMIT');
                        resolve({
                            success: true,
                            keptTrackId: keepTrackId,
                            deletedCount: deleteTrackIds.length
                        });
                    }
                });
            });
        });
    }
}

// Create handlers for IPC
function createTrackManagementHandlers(db) {
    const handler = new TrackManagementHandler(db);

    return {
        'update-track-metadata': handler.updateTrackMetadata.bind(handler),
        'update-ai-metadata': handler.updateAIMetadata.bind(handler),
        'batch-update-metadata': handler.batchUpdateMetadata.bind(handler),
        'delete-track': handler.deleteTrack.bind(handler),
        'batch-delete-tracks': handler.batchDeleteTracks.bind(handler),
        'move-track-file': handler.moveTrackFile.bind(handler),
        'duplicate-track': handler.duplicateTrack.bind(handler),
        'find-duplicates': handler.findDuplicates.bind(handler),
        `merge-duplicates`: handler.mergeDuplicates.bind(handler)
    };
}

module.exports = createTrackManagementHandlers;
