/**
 * @fileoverview Database Service - Secure, singleton database handler
 * @module services/database-service
 * @description Prevents SQL injection, manages connections, handles errors properly
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Singleton database service for SQLite operations
 * @class DatabaseService
 */
class DatabaseService {
    /**
     * Creates database service instance (singleton pattern)
     * @constructor
     */
    constructor() {
        if (DatabaseService.instance) {
            return DatabaseService.instance;
        }

        /** @type {sqlite3.Database|null} */
        this.db = null;
        /** @type {Map<string, sqlite3.Statement>} */
        this.statements = new Map();
        /** @type {boolean} */
        this.isConnected = false;

        DatabaseService.instance = this;
    }

    /**
     * Initialize database connection
     * @async
     * @param {string} dbPath - Path to SQLite database file
     * @returns {Promise<sqlite3.Database>} Database connection
     * @throws {Error} Connection error
     */
    async connect(dbPath) {
        if (this.isConnected) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
                if (err) {
                    logError('Database connection failed:', err);
                    reject(err);
                } else {
                    this.isConnected = true;
                    logInfo('✅ Database connected securely');

                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');

                    // Optimize for performance
                    this.db.run('PRAGMA journal_mode = WAL');
                    this.db.run('PRAGMA synchronous = NORMAL');

                    resolve(this.db);
                }
            });
        });
    }

    /**
     * Prepare SQL statement with caching
     * @param {string} key - Cache key for statement
     * @param {string} sql - SQL query string
     * @returns {sqlite3.Statement} Prepared statement
     */
    prepareStatement(key, sql) {
        if (!this.statements.has(key)) {
            const stmt = this.db.prepare(sql);
            this.statements.set(key, stmt);
        }
        return this.statements.get(key);
    }

    /**
     * Execute query with parameterized inputs (prevents SQL injection)
     * @async
     * @param {string} sql - SQL query with placeholders
     * @param {Array} [params=[]] - Query parameters
     * @returns {Promise<Array<Object>>} Query results
     * @throws {Error} Query execution error
     * @example
     * const tracks = await db.query('SELECT * FROM tracks WHERE genre = ?', ['Jazz']);
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            // Validate parameters
            if (!Array.isArray(params)) {
                reject(new Error('Parameters must be an array'));
                return;
            }

            // Sanitize parameters
            const sanitizedParams = params.map(param => {
                if (param === null || param === undefined) {
                    return null;
                }
                if (typeof param === 'string') {
                    // Remove any SQL meta-characters
                    return param.replace(/['";\\]/g, '');
                }
                return param;
            });

            this.db.all(sql, sanitizedParams, (err, rows) => {
                if (err) {
                    logError('Query error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Execute single row query
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            const sanitizedParams = this.sanitizeParams(params);

            this.db.get(sql, sanitizedParams, (err, row) => {
                if (err) {
                    logError('Get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Execute write operation
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            const sanitizedParams = this.sanitizeParams(params);

            this.db.run(sql, sanitizedParams, function (err) {
                if (err) {
                    logError('Run error:', err);
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    // Batch insert with transaction
    async batchInsert(tableName, records) {
        if (!records || records.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                try {
                    const columns = Object.keys(records[0]);
                    const placeholders = columns.map(() => '?').join(',');
                    const sql = `INSERT INTO ${this.escapeIdentifier(tableName)} (${columns.map(c => this.escapeIdentifier(c)).join(',')}) VALUES (${placeholders})`;

                    const stmt = this.db.prepare(sql);

                    for (const record of records) {
                        const values = columns.map(col => record[col]);
                        stmt.run(values);
                    }

                    stmt.finalize();
                    this.db.run('COMMIT');
                    resolve({ success: true, count: records.length });
                } catch (error) {
                    this.db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    }

    // Search with secure parameterized query
    async searchTracks(searchTerm, filters = {}) {
        let sql = `
            SELECT DISTINCT 
                af.*,
                lm.*
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE 1=1
        `;

        const params = [];

        // Add search term safely
        if (searchTerm && searchTerm.trim()) {
            sql += ` AND (
                af.title LIKE ? OR 
                af.artist LIKE ? OR 
                af.album LIKE ? OR 
                af.file_name LIKE ?
            )`;
            const searchPattern = `%${searchTerm.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add genre filter safely
        if (filters.genre) {
            sql += ' AND (af.genre = ? OR lm.LLM_GENRE = ?)';
            params.push(filters.genre, filters.genre);
        }

        // Add mood filter safely
        if (filters.mood) {
            sql += ' AND lm.AI_MOOD = ?';
            params.push(filters.mood);
        }

        // Add BPM range safely
        if (filters.minBPM) {
            sql += ' AND CAST(lm.AI_BPM AS REAL) >= ?';
            params.push(filters.minBPM);
        }

        if (filters.maxBPM) {
            sql += ' AND CAST(lm.AI_BPM AS REAL) <= ?';
            params.push(filters.maxBPM);
        }

        // Add energy filter safely
        if (filters.minEnergy !== undefined) {
            sql += ' AND CAST(lm.AI_ENERGY AS REAL) >= ?';
            params.push(filters.minEnergy);
        }

        if (filters.maxEnergy !== undefined) {
            sql += ' AND CAST(lm.AI_ENERGY AS REAL) <= ?';
            params.push(filters.maxEnergy);
        }

        // Add limit
        sql += ' LIMIT ?';
        params.push(filters.limit || 500);

        return this.query(sql, params);
    }

    // Get files with artwork (secure) - NO LIMIT BY DEFAULT
    async getFilesWithArtwork(limit = 10000, offset = 0) {
        // Si no se pasa límite o es muy alto, obtener TODOS los archivos
        if (!limit || limit > 5000) {
            const sql = `
                SELECT 
                    af.*,
                    lm.*,
                    af.artwork_path
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                ORDER BY af.artist, af.album, af.title
            `;
            logDebug('📚 Loading ALL files without limit');
            return this.query(sql, []);
        }

        // Con límite específico
        const sql = `
            SELECT 
                af.*,
                lm.*,
                af.artwork_path
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            ORDER BY af.artist, af.album, af.title
            LIMIT ? OFFSET ?
        `;

        return this.query(sql, [limit, offset]);
    }

    // Get track by ID (secure)
    async getTrackById(trackId) {
        const sql = `
            SELECT 
                af.*,
                lm.*
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.id = ?
        `;

        return this.get(sql, [trackId]);
    }

    // Update track metadata (secure)
    async updateTrackMetadata(trackId, metadata) {
        const allowedFields = ['title', 'artist', 'album', 'genre'];
        const updates = [];
        const params = [];

        for (const [key, value] of Object.entries(metadata)) {
            if (allowedFields.includes(key)) {
                updates.push(`${this.escapeIdentifier(key)} = ?`);
                params.push(value);
            }
        }

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        params.push(trackId);
        const sql = `UPDATE audio_files SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`;

        return this.run(sql, params);
    }

    // Get filter options (secure)
    async getFilterOptions() {
        const [genres, moods] = await Promise.all([
            this.query(`
                SELECT DISTINCT genre 
                FROM audio_files 
                WHERE genre IS NOT NULL 
                ORDER BY genre
            `),
            this.query(`
                SELECT DISTINCT AI_MOOD 
                FROM llm_metadata 
                WHERE AI_MOOD IS NOT NULL 
                ORDER BY AI_MOOD
            `)
        ]);

        return {
            genres: genres.map(g => g.genre),
            moods: moods.map(m => m.AI_MOOD)
        };
    }

    // Create indexes for performance
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_title ON audio_files(title)',
            'CREATE INDEX IF NOT EXISTS idx_artist ON audio_files(artist)',
            'CREATE INDEX IF NOT EXISTS idx_album ON audio_files(album)',
            'CREATE INDEX IF NOT EXISTS idx_genre ON audio_files(genre)',
            'CREATE INDEX IF NOT EXISTS idx_file_name ON audio_files(file_name)',
            'CREATE INDEX IF NOT EXISTS idx_artwork_path ON audio_files(artwork_path)',
            'CREATE INDEX IF NOT EXISTS idx_ai_mood ON llm_metadata(AI_MOOD)',
            'CREATE INDEX IF NOT EXISTS idx_ai_energy ON llm_metadata(AI_ENERGY)',
            'CREATE INDEX IF NOT EXISTS idx_ai_bpm ON llm_metadata(AI_BPM)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }

        logInfo('✅ Database indexes created');
    }

    // Sanitize parameters
    sanitizeParams(params) {
        if (!Array.isArray(params)) {
            return [];
        }

        return params.map(param => {
            if (param === null || param === undefined) {
                return null;
            }
            if (typeof param === 'boolean') {
                return param ? 1 : 0;
            }
            if (typeof param === 'number') {
                return param;
            }
            if (typeof param === 'string') {
                // Basic sanitization - remove SQL injection attempts
                return param
                    .replace(/;/g, '') // Remove semicolons
                    .replace(/--/g, '') // Remove SQL comments
                    .replace(/\/\*/g, '') // Remove block comments
                    .replace(/\*\//g, '')
                    .replace(/xp_/gi, '') // Remove extended procedures
                    .replace(/sp_/gi, '') // Remove stored procedures
                    .trim();
            }
            return String(param);
        });
    }

    // Escape identifier for table/column names
    escapeIdentifier(identifier) {
        // Only allow alphanumeric and underscore
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
            throw new Error(`Invalid identifier: ${identifier}`);
        }
        return identifier;
    }

    // Close database connection properly
    async close() {
        return new Promise((resolve, reject) => {
            // Finalize all prepared statements
            for (const stmt of this.statements.values()) {
                stmt.finalize();
            }
            this.statements.clear();

            if (this.db) {
                this.db.close(err => {
                    if (err) {
                        logError('Error closing database:', err);
                        reject(err);
                    } else {
                        this.isConnected = false;
                        logInfo('✅ Database closed properly');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Get statistics
    async getStats() {
        const stats = await this.get(`
            SELECT 
                (SELECT COUNT(*) FROM audio_files) as total_tracks,
                (SELECT COUNT(*) FROM audio_files WHERE artwork_path IS NOT NULL) as tracks_with_artwork,
                (SELECT COUNT(DISTINCT genre) FROM audio_files) as unique_genres,
                (SELECT COUNT(DISTINCT AI_MOOD) FROM llm_metadata) as unique_moods
        `);

        return stats;
    }

    // Vacuum database for optimization
    async vacuum() {
        await this.run('VACUUM');
        await this.run('ANALYZE');
        logInfo('✅ Database optimized');
    }
}

// Export singleton instance
module.exports = new DatabaseService();
