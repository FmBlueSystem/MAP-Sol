// Normalization handler for database operations
const fs = require('fs');
const path = require('path');

function createNormalizationHandlers(db) {
    return {
        // Get normalization data for a track
        getNormalizationData: async (event, trackId) => {
            return new Promise((resolve) => {
                const sql = `
                    SELECT 
                        track_id,
                        integrated_lufs,
                        gain_db,
                        gain_linear,
                        true_peak,
                        true_peak_db,
                        loudness_range,
                        method,
                        target_lufs,
                        needs_limiting,
                        analyzed_at
                    FROM audio_normalization
                    WHERE track_id = ?
                `;
                
                db.get(sql, [trackId], (err, row) => {
                    if (err) {
                        console.error('Error getting normalization data:', err);
                        resolve(null);
                    } else {
                        resolve(row);
                    }
                });
            });
        },
        
        // Save normalization data for a track
        saveNormalizationData: async (event, data) => {
            return new Promise((resolve) => {
                const sql = `
                    INSERT OR REPLACE INTO audio_normalization (
                        track_id,
                        integrated_lufs,
                        gain_db,
                        gain_linear,
                        true_peak,
                        true_peak_db,
                        loudness_range,
                        method,
                        target_lufs,
                        needs_limiting,
                        algorithm_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                const params = [
                    data.track_id,
                    data.integratedLUFS || data.integrated_lufs,
                    data.gainDB || data.gain_db,
                    data.gainLinear || data.gain_linear,
                    data.truePeak || data.true_peak,
                    data.truePeakDB || data.true_peak_db,
                    data.loudnessRange || data.loudness_range,
                    data.method || 'LUFS',
                    data.targetLUFS || data.target_lufs || -14.0,
                    data.needsLimiting || data.needs_limiting ? 1 : 0,
                    'v1.0'
                ];
                
                db.run(sql, params, function(err) {
                    if (err) {
                        console.error('Error saving normalization data:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        // Update the analyzed flag in audio_files
                        db.run(
                            'UPDATE audio_files SET normalization_analyzed = 1 WHERE id = ?',
                            [data.track_id],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error('Error updating analyzed flag:', updateErr);
                                }
                            }
                        );
                        
                        resolve({ success: true, changes: this.changes });
                    }
                });
            });
        },
        
        // Get batch of unanalyzed tracks
        getUnanalyzedTracks: async (event, limit = 100) => {
            return new Promise((resolve) => {
                const sql = `
                    SELECT 
                        af.id,
                        af.file_path,
                        af.file_name,
                        af.title,
                        af.artist
                    FROM audio_files af
                    LEFT JOIN audio_normalization an ON af.id = an.track_id
                    WHERE an.track_id IS NULL
                    OR af.normalization_analyzed = 0
                    LIMIT ?
                `;
                
                db.all(sql, [limit], (err, rows) => {
                    if (err) {
                        console.error('Error getting unanalyzed tracks:', err);
                        resolve([]);
                    } else {
                        resolve(rows);
                    }
                });
            });
        },
        
        // Save batch normalization results
        saveBatchNormalization: async (event, results) => {
            return new Promise((resolve) => {
                const sql = `
                    INSERT OR REPLACE INTO audio_normalization (
                        track_id,
                        integrated_lufs,
                        gain_db,
                        gain_linear,
                        true_peak,
                        true_peak_db,
                        loudness_range,
                        method,
                        target_lufs,
                        needs_limiting,
                        algorithm_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                let successCount = 0;
                let errorCount = 0;
                
                const stmt = db.prepare(sql);
                
                results.forEach(data => {
                    const params = [
                        data.track_id,
                        data.integrated_lufs,
                        data.gain_db,
                        data.gain_linear,
                        data.true_peak,
                        data.true_peak_db,
                        data.loudness_range,
                        data.method || 'LUFS',
                        data.target_lufs || -14.0,
                        data.needs_limiting ? 1 : 0,
                        'v1.0'
                    ];
                    
                    stmt.run(params, (err) => {
                        if (err) {
                            errorCount++;
                        } else {
                            successCount++;
                            // Update analyzed flag
                            db.run(
                                'UPDATE audio_files SET normalization_analyzed = 1 WHERE id = ?',
                                [data.track_id]
                            );
                        }
                    });
                });
                
                stmt.finalize(() => {
                    resolve({
                        success: true,
                        processed: results.length,
                        saved: successCount,
                        errors: errorCount
                    });
                });
            });
        },
        
        // Get normalization statistics
        getNormalizationStats: async (event) => {
            return new Promise((resolve) => {
                const queries = {
                    total: 'SELECT COUNT(*) as count FROM audio_files',
                    analyzed: 'SELECT COUNT(*) as count FROM audio_normalization',
                    avgGain: 'SELECT AVG(gain_db) as avg FROM audio_normalization',
                    avgLUFS: 'SELECT AVG(integrated_lufs) as avg FROM audio_normalization',
                    needsLimiting: 'SELECT COUNT(*) as count FROM audio_normalization WHERE needs_limiting = 1'
                };
                
                const stats = {};
                let completed = 0;
                
                Object.entries(queries).forEach(([key, sql]) => {
                    db.get(sql, (err, row) => {
                        if (!err && row) {
                            stats[key] = row.count !== undefined ? row.count : row.avg;
                        } else {
                            stats[key] = 0;
                        }
                        
                        completed++;
                        if (completed === Object.keys(queries).length) {
                            stats.percentage = stats.total > 0 
                                ? (stats.analyzed / stats.total * 100).toFixed(1)
                                : 0;
                            resolve(stats);
                        }
                    });
                });
            });
        },
        
        // Get preferences
        getNormalizationPreferences: async (event) => {
            return new Promise((resolve) => {
                const sql = 'SELECT * FROM normalization_preferences WHERE id = 1';
                
                db.get(sql, (err, row) => {
                    if (err || !row) {
                        // Return defaults if not found
                        resolve({
                            enabled: true,
                            mode: 'smart',
                            target_lufs: -14.0,
                            album_mode: false,
                            prevent_clipping: true
                        });
                    } else {
                        resolve({
                            enabled: row.enabled === 1,
                            mode: row.mode,
                            target_lufs: row.target_lufs,
                            album_mode: row.album_mode === 1,
                            prevent_clipping: row.prevent_clipping === 1
                        });
                    }
                });
            });
        },
        
        // Save preferences
        saveNormalizationPreferences: async (event, prefs) => {
            return new Promise((resolve) => {
                const sql = `
                    UPDATE normalization_preferences
                    SET enabled = ?, mode = ?, target_lufs = ?, 
                        album_mode = ?, prevent_clipping = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                `;
                
                const params = [
                    prefs.enabled ? 1 : 0,
                    prefs.mode,
                    prefs.target_lufs,
                    prefs.album_mode ? 1 : 0,
                    prefs.prevent_clipping ? 1 : 0
                ];
                
                db.run(sql, params, function(err) {
                    if (err) {
                        console.error('Error saving preferences:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        resolve({ success: true });
                    }
                });
            });
        }
    };
}

module.exports = { createNormalizationHandlers };