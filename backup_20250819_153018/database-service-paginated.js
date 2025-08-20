// Enhanced Database Service with Pagination for 10k+ tracks
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseServicePaginated {
    constructor() {
        this.db = null;
        this.preparedStatements = new Map();
        this.queryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.defaultPageSize = 100;
        this.maxPageSize = 1000;
    }

    async connect(dbPath) {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    // Enable optimizations
                    this.db.run('PRAGMA journal_mode = WAL');
                    this.db.run('PRAGMA synchronous = NORMAL');
                    this.db.run('PRAGMA cache_size = 10000');
                    this.db.run('PRAGMA temp_store = MEMORY');
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close(err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Paginated query for files with artwork
    async getFilesWithArtworkPaginated(page = 1, pageSize = null, filters = {}) {
        pageSize = this.validatePageSize(pageSize);
        const offset = (page - 1) * pageSize;

        let sql = `
            SELECT 
                af.id,
                af.file_path,
                af.file_name,
                af.title,
                af.artist,
                af.album,
                af.genre,
                af.artwork_path,
                af.file_extension,
                lm.LLM_GENRE,
                lm.AI_MOOD,
                lm.AI_ENERGY,
                lm.AI_BPM,
                lm.AI_KEY,
                lm.AI_DANCEABILITY,
                lm.AI_VALENCE,
                lm.AI_ACOUSTICNESS,
                lm.AI_INSTRUMENTALNESS
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE 1=1
        `;

        const params = [];

        // Add filters
        if (filters.genre) {
            sql += ' AND (af.genre = ? OR lm.LLM_GENRE = ?)';
            params.push(filters.genre, filters.genre);
        }

        if (filters.mood) {
            sql += ' AND lm.AI_MOOD = ?';
            params.push(filters.mood);
        }

        if (filters.minBPM) {
            sql += ' AND lm.AI_BPM >= ?';
            params.push(filters.minBPM);
        }

        if (filters.maxBPM) {
            sql += ' AND lm.AI_BPM <= ?';
            params.push(filters.maxBPM);
        }

        // Add pagination
        sql += ' ORDER BY af.id LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        // Get total count for pagination info
        const countSql = sql
            .replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
            .replace(/ORDER BY[\s\S]*$/, '');
        const countParams = params.slice(0, -2);

        return new Promise((resolve, reject) => {
            // Get total count
            this.db.get(countSql, countParams, (err, countRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get paginated data
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            data: rows || [],
                            pagination: {
                                page,
                                pageSize,
                                total: countRow?.total || 0,
                                totalPages: Math.ceil((countRow?.total || 0) / pageSize),
                                hasNext: page * pageSize < (countRow?.total || 0),
                                hasPrev: page > 1
                            }
                        });
                    }
                });
            });
        });
    }

    // Paginated search with optimizations
    async searchTracksPaginated(searchTerm, filters = {}, page = 1, pageSize = null) {
        pageSize = this.validatePageSize(pageSize);
        const offset = (page - 1) * pageSize;

        // Sanitize search term
        const sanitizedSearch = searchTerm ? searchTerm.trim().slice(0, 100) : '`;

        let sql = `
            SELECT 
                af.*,
                lm.*,
                CASE 
                    WHEN af.title LIKE ? THEN 10
                    WHEN af.artist LIKE ? THEN 8
                    WHEN af.album LIKE ? THEN 6
                    WHEN af.file_name LIKE ? THEN 4
                    ELSE 2
                END as relevance
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE 1=1
        `;

        const params = [];
        const searchPattern = `%${sanitizedSearch}%`;

        // Add relevance params
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);

        // Add search condition
        if (sanitizedSearch) {
            sql += ` AND (
                af.title LIKE ? OR 
                af.artist LIKE ? OR 
                af.album LIKE ? OR 
                af.file_name LIKE ?
            )`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add filters
        if (filters.genre) {
            sql += ' AND (af.genre = ? OR lm.LLM_GENRE = ?)';
            params.push(filters.genre, filters.genre);
        }

        if (filters.mood) {
            sql += ' AND lm.AI_MOOD = ?';
            params.push(filters.mood);
        }

        if (filters.yearStart) {
            sql += ' AND af.year >= ?';
            params.push(filters.yearStart);
        }

        if (filters.yearEnd) {
            sql += ' AND af.year <= ?';
            params.push(filters.yearEnd);
        }

        // Order by relevance and paginate
        sql += ' ORDER BY relevance DESC, af.title ASC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        // Get total count
        const countSql = `
            SELECT COUNT(*) as total 
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE 1=1
            ${
                sanitizedSearch
                    ? `AND (
                af.title LIKE ? OR 
                af.artist LIKE ? OR 
                af.album LIKE ? OR 
                af.file_name LIKE ?
            )`
                    : ''
            }
            ${filters.genre ? 'AND (af.genre = ? OR lm.LLM_GENRE = ?)' : ''}
            ${filters.mood ? 'AND lm.AI_MOOD = ?' : '`}
        `;

        const countParams = params.slice(4, -2);

        return new Promise((resolve, reject) => {
            this.db.get(countSql, countParams, (err, countRow) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            data: rows || [],
                            pagination: {
                                page,
                                pageSize,
                                total: countRow?.total || 0,
                                totalPages: Math.ceil((countRow?.total || 0) / pageSize),
                                hasNext: page * pageSize < (countRow?.total || 0),
                                hasPrev: page > 1
                            },
                            searchTerm: sanitizedSearch
                        });
                    }
                });
            });
        });
    }

    // Stream large datasets for export
    async *streamAllTracks(batchSize = 100) {
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const sql = `
                SELECT af.*, lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.id
                LIMIT ? OFFSET ?
            `;

            const rows = await new Promise((resolve, reject) => {
                this.db.all(sql, [batchSize, offset], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            });

            if (rows.length > 0) {
                yield rows;
                offset += batchSize;
            } else {
                hasMore = false;
            }
        }
    }

    // Get filter options with counts
    async getFilterOptionsWithCounts() {
        const queries = {
            genres: `
                SELECT genre, COUNT(*) as count 
                FROM (
                    SELECT DISTINCT COALESCE(lm.LLM_GENRE, af.genre) as genre
                    FROM audio_files af
                    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                    WHERE genre IS NOT NULL
                )
                GROUP BY genre
                ORDER BY count DESC
                LIMIT 50
            `,
            moods: `
                SELECT AI_MOOD as mood, COUNT(*) as count
                FROM llm_metadata
                WHERE AI_MOOD IS NOT NULL
                GROUP BY AI_MOOD
                ORDER BY count DESC
                LIMIT 20
            `,
            years: `
                SELECT MIN(year) as minYear, MAX(year) as maxYear
                FROM audio_files
                WHERE year IS NOT NULL
            `,
            stats: `
                SELECT 
                    COUNT(*) as totalTracks,
                    COUNT(DISTINCT artist) as totalArtists,
                    COUNT(DISTINCT album) as totalAlbums,
                    AVG(lm.AI_BPM) as avgBPM,
                    AVG(lm.AI_ENERGY) as avgEnergy
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            `
        };

        const results = {};

        for (const [key, sql] of Object.entries(queries)) {
            results[key] = await new Promise((resolve, reject) => {
                if (key === 'genres' || key === 'moods') {
                    this.db.all(sql, (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows || []);
                        }
                    });
                } else {
                    this.db.get(sql, (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                }
            });
        }

        return results;
    }

    // Batch operations for performance
    async batchUpdate(updates) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION`);

                const stmt = this.db.prepare(`
                    UPDATE audio_files 
                    SET title = ?, artist = ?, album = ?, genre = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `);

                let successCount = 0;
                let errorCount = 0;

                for (const update of updates) {
                    stmt.run(
                        update.title,
                        update.artist,
                        update.album,
                        update.genre,
                        update.id,
                        err => {
                            if (err) {
                                errorCount++;
                            } else {
                                successCount++;
                            }
                        }
                    );
                }

                stmt.finalize();

                this.db.run('COMMIT', err => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                    } else {
                        resolve({ successCount, errorCount });
                    }
                });
            });
        });
    }

    // Validate and limit page size
    validatePageSize(pageSize) {
        if (!pageSize || pageSize <= 0) {
            return this.defaultPageSize;
        }
        return Math.min(pageSize, this.maxPageSize);
    }

    // Create optimized indexes for 10k+ performance
    async createOptimizedIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_artist_title ON audio_files(artist, title)',
            'CREATE INDEX IF NOT EXISTS idx_genre_bpm ON llm_metadata(LLM_GENRE, AI_BPM)',
            'CREATE INDEX IF NOT EXISTS idx_mood_energy ON llm_metadata(AI_MOOD, AI_ENERGY)',
            'CREATE INDEX IF NOT EXISTS idx_file_updated ON audio_files(updated_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_search_text ON audio_files(title, artist, album)',
            'CREATE INDEX IF NOT EXISTS idx_ai_features ON llm_metadata(AI_ENERGY, AI_DANCEABILITY, AI_VALENCE)'
        ];

        for (const indexSql of indexes) {
            await new Promise((resolve, reject) => {
                this.db.run(indexSql, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // Analyze tables for query optimization
        await new Promise(resolve => {
            this.db.run('ANALYZE`, resolve);
        });
    }

    // Get database statistics
    async getDatabaseStats() {
        const stats = await new Promise((resolve, reject) => {
            this.db.get(
                `
                SELECT 
                    (SELECT COUNT(*) FROM audio_files) as totalFiles,
                    (SELECT COUNT(*) FROM llm_metadata) as analyzedFiles,
                    (SELECT COUNT(DISTINCT artist) FROM audio_files) as uniqueArtists,
                    (SELECT COUNT(DISTINCT album) FROM audio_files) as uniqueAlbums,
                    (SELECT COUNT(DISTINCT genre) FROM audio_files) as uniqueGenres,
                    (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as dbSize
            `,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

        return {
            ...stats,
            dbSizeMB: (stats.dbSize / 1048576).toFixed(2),
            cacheHitRate: this.getCacheHitRate()
        };
    }

    getCacheHitRate() {
        // Implementation would track cache hits/misses
        return 0.85; // Placeholder
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: dbPath => {
        if (!instance) {
            instance = new DatabaseServicePaginated();
            if (dbPath) {
                instance.connect(dbPath);
            }
        }
        return instance;
    },
    DatabaseServicePaginated
};
