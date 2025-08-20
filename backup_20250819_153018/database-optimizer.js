/**
 * 🗄️ DATABASE OPTIMIZER
 * SQLite query optimization and caching for Music Analyzer Pro
 */

class DatabaseOptimizer {
    constructor(config = {}) {
        this.config = {
            cacheEnabled: config.cacheEnabled !== false,
            cacheSize: config.cacheSize || 100,
            cacheTTL: config.cacheTTL || 300000, // 5 minutes
            queryTimeout: config.queryTimeout || 30000, // 30 seconds
            batchSize: config.batchSize || 1000,
            indexCheck: config.indexCheck !== false,
            vacuumInterval: config.vacuumInterval || 86400000, // 24 hours
            debug: config.debug || false
        };

        this.cache = new Map();
        this.queryStats = new Map();
        this.pendingQueries = new Map();
        this.indexes = new Set();
        this.lastVacuum = 0;
        this.transactionQueue = [];
        this.isTransacting = false;

        this.init();
    }

    init() {

        // Check indexes
        if (this.config.indexCheck) {
            this.checkIndexes();
        }

        // Setup auto-vacuum
        this.setupAutoVacuum();

        // Setup cache cleanup
        this.setupCacheCleanup();
    }

    /**
     * QUERY OPTIMIZATION
     */
    async optimizeQuery(query, params = []) {
        const queryHash = this.hashQuery(query, params);

        // Check cache first
        if (this.config.cacheEnabled) {
            const cached = this.getFromCache(queryHash);
            if (cached) {
                this.updateStats(queryHash, 'cache_hit');
                return cached;
            }
        }

        // Check if query is already pending
        if (this.pendingQueries.has(queryHash)) {
            return this.pendingQueries.get(queryHash);
        }

        // Analyze and optimize query
        const optimized = this.analyzeQuery(query);

        // Execute optimized query
        const promise = this.executeQuery(optimized, params, queryHash);
        this.pendingQueries.set(queryHash, promise);

        try {
            const result = await promise;

            // Cache result
            if (this.config.cacheEnabled && this.shouldCache(query)) {
                this.addToCache(queryHash, result);
            }

            this.updateStats(queryHash, 'executed');
            return result;
        } finally {
            this.pendingQueries.delete(queryHash);
        }
    }

    analyzeQuery(query) {
        let optimized = query;

        // Remove unnecessary whitespace
        optimized = optimized.replace(/\s+/g, ' ').trim();

        // Optimize SELECT *
        if (optimized.match(/SELECT\s+\*/i)) {
            // Log warning but don't modify
            if (this.config.debug) {
                console.warn('SELECT * detected - consider specifying columns');
            }
        }

        // Add LIMIT if missing for SELECT without aggregation
        if (
            optimized.match(/^SELECT/i) &&
            !optimized.match(/LIMIT/i) &&
            !optimized.match(/COUNT|SUM|AVG|MAX|MIN/i)
        ) {
            optimized += ' LIMIT 10000';
        }

        // Suggest indexes for WHERE clauses
        const whereMatch = optimized.match(/WHERE\s+(\w+)/i);
        if (whereMatch) {
            const column = whereMatch[1];
            this.suggestIndex(column);
        }

        return optimized;
    }

    async executeQuery(query, params, queryHash) {
        const startTime = performance.now();

        try {
            // Simulate query execution (would use actual SQLite in production)
            const result = await this.simulateQuery(query, params);

            const duration = performance.now() - startTime;

            // Log slow queries
            if (duration > 1000) {
                console.warn(`Slow query detected (${duration.toFixed(2)}ms):`, query);
                this.optimizeSlow(query, duration);
            }

            return result;
        } catch (error) {
            console.error('Query execution failed:', error);
            throw error;
        }
    }

    async simulateQuery(query, params) {
        // Simulate database query
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    rows: [],
                    metadata: {
                        changes: 0,
                        lastInsertRowid: 0
                    }
                });
            }, Math.random() * 100);
        });
    }

    /**
     * BATCH OPERATIONS
     */
    async batchInsert(table, records) {
        const batches = this.createBatches(records, this.config.batchSize);
        const results = [];

        for (const batch of batches) {
            const result = await this.insertBatch(table, batch);
            results.push(result);
        }

        return {
            inserted: results.reduce((sum, r) => sum + r.inserted, 0),
            batches: batches.length,
            errors: results.filter(r => r.error).length
        };
    }

    createBatches(items, size) {
        const batches = [];
        for (let i = 0; i < items.length; i += size) {
            batches.push(items.slice(i, i + size));
        }
        return batches;
    }

    async insertBatch(table, records) {
        const columns = Object.keys(records[0]);
        const placeholders = columns.map(() => '?').join(', `);
        const query = `INSERT INTO ${table} (${columns.join(`, ')}) VALUES (${placeholders})';

        try {
            let inserted = 0;
            for (const record of records) {
                const values = columns.map(col => record[col]);
                await this.optimizeQuery(query, values);
                inserted++;
            }
            return { inserted, error: null };
        } catch (error) {
            return { inserted: 0, error };
        }
    }

    /**
     * TRANSACTION MANAGEMENT
     */
    async transaction(callback) {
        return new Promise((resolve, reject) => {
            this.transactionQueue.push({ callback, resolve, reject });
            this.processTransactionQueue();
        });
    }

    async processTransactionQueue() {
        if (this.isTransacting || this.transactionQueue.length === 0) {
            return;
        }

        this.isTransacting = true;
        const { callback, resolve, reject } = this.transactionQueue.shift();

        try {
            await this.beginTransaction();
            const result = await callback();
            await this.commitTransaction();
            resolve(result);
        } catch (error) {
            await this.rollbackTransaction();
            reject(error);
        } finally {
            this.isTransacting = false;
            this.processTransactionQueue();
        }
    }

    async beginTransaction() {
        return this.executeQuery('BEGIN TRANSACTION', []);
    }

    async commitTransaction() {
        return this.executeQuery('COMMIT', []);
    }

    async rollbackTransaction() {
        return this.executeQuery(`ROLLBACK`, []);
    }

    /**
     * INDEX MANAGEMENT
     */
    async checkIndexes() {
        const query = `
            SELECT name, tbl_name, sql 
            FROM sqlite_master 
            WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
        ';

        try {
            const result = await this.executeQuery(query, []);
            result.rows.forEach(row => {
                this.indexes.add(row.name);
            });

            if (this.config.debug) {

            }
        } catch (error) {
            console.error('Failed to check indexes:`, error);
        }
    }

    suggestIndex(column) {
        const indexName = `idx_${column}`;
        if (!this.indexes.has(indexName)) {
            if (this.config.debug) {
                `
                );
            }
        }
    }

    async createIndex(table, column) {
        const indexName = `idx_${table}_${column}`;
        if (this.indexes.has(indexName)) {
            return { created: false, reason: 'Index already exists` };
        }

        try {
            const query = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`;
            await this.executeQuery(query, []);
            this.indexes.add(indexName);
            return { created: true, indexName };
        } catch (error) {
            return { created: false, error };
        }
    }

    /**
     * VACUUM AND MAINTENANCE
     */
    setupAutoVacuum() {
        setInterval(() => {
            this.vacuum();
        }, this.config.vacuumInterval);
    }

    async vacuum() {
        const now = Date.now();
        if (now - this.lastVacuum < this.config.vacuumInterval) {
            return;
        }

        try {

            await this.executeQuery('VACUUM', []);
            this.lastVacuum = now;

        } catch (error) {
            console.error('Vacuum failed:', error);
        }
    }

    async analyze() {
        try {
            await this.executeQuery('ANALYZE', []);

        } catch (error) {
            console.error('Analysis failed:', error);
        }
    }

    /**
     * CACHE MANAGEMENT
     */
    setupCacheCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, 60000); // Every minute
    }

    cleanupCache() {
        const now = Date.now();
        let removed = 0;

        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp > this.config.cacheTTL) {
                this.cache.delete(key);
                removed++;
            }
        });

        if (removed > 0 && this.config.debug) {

        }

        // Enforce cache size limit
        if (this.cache.size > this.config.cacheSize) {
            const toRemove = this.cache.size - this.config.cacheSize;
            const entries = Array.from(this.cache.entries()).sort(
                (a, b) => a[1].timestamp - b[1].timestamp
            );

            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }

    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > this.config.cacheTTL) {
            this.cache.delete(key);
            return null;
        }

        entry.hits++;
        return entry.data;
    }

    addToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hits: 0
        });
    }

    shouldCache(query) {
        // Don't cache write operations
        if (query.match(/INSERT|UPDATE|DELETE|CREATE|DROP|ALTER/i)) {
            return false;
        }

        // Don't cache queries with RANDOM()
        if (query.match(/RANDOM\(\)/i)) {
            return false;
        }

        return true;
    }

    clearCache() {
        const size = this.cache.size;
        this.cache.clear();

    }

    /**
     * QUERY STATISTICS
     */
    updateStats(queryHash, type) {
        if (!this.queryStats.has(queryHash)) {
            this.queryStats.set(queryHash, {
                executions: 0,
                cacheHits: 0,
                totalTime: 0,
                avgTime: 0
            });
        }

        const stats = this.queryStats.get(queryHash);

        if (type === 'executed') {
            stats.executions++;
        } else if (type === 'cache_hit') {
            stats.cacheHits++;
        }
    }

    getStats() {
        const stats = {
            cacheSize: this.cache.size,
            cacheHitRate: 0,
            totalQueries: 0,
            totalCacheHits: 0,
            slowQueries: [],
            frequentQueries: []
        };

        this.queryStats.forEach((queryStats, hash) => {
            stats.totalQueries += queryStats.executions;
            stats.totalCacheHits += queryStats.cacheHits;

            if (queryStats.avgTime > 1000) {
                stats.slowQueries.push({
                    hash,
                    avgTime: queryStats.avgTime,
                    executions: queryStats.executions
                });
            }
        });

        if (stats.totalQueries > 0) {
            stats.cacheHitRate = (stats.totalCacheHits / stats.totalQueries) * 100;
        }

        // Sort and limit results
        stats.slowQueries.sort((a, b) => b.avgTime - a.avgTime).slice(0, 10);

        return stats;
    }

    /**
     * SLOW QUERY OPTIMIZATION
     */
    optimizeSlow(query, duration) {
        // Analyze slow query patterns
        const suggestions = [];

        if (query.match(/SELECT \*/i)) {
            suggestions.push('Specify exact columns instead of SELECT *');
        }

        if (!query.match(/LIMIT/i) && query.match(/^SELECT/i)) {
            suggestions.push('Add LIMIT clause to restrict results');
        }

        if (query.match(/LIKE '%/i)) {
            suggestions.push('Leading wildcard in LIKE prevents index usage');
        }

        if (query.match(/ORDER BY/i) && !query.match(/INDEX/i)) {
            suggestions.push('Consider adding index for ORDER BY column');
        }

        if (suggestions.length > 0) {

        }

        return suggestions;
    }

    /**
     * UTILITIES
     */
    hashQuery(query, params) {
        const str = query + JSON.stringify(params);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * PUBLIC API
     */
    async query(sql, params = []) {
        return this.optimizeQuery(sql, params);
    }

    async exec(sql) {
        return this.executeQuery(sql, []);
    }

    async prepare(sql) {
        const optimized = this.analyzeQuery(sql);
        return {
            sql: optimized,
            run: (params = []) => this.optimizeQuery(optimized, params),
            get: (params = []) => this.optimizeQuery(optimized + ' LIMIT 1', params),
            all: (params = []) => this.optimizeQuery(optimized, params)
        };
    }

    getCacheInfo() {
        return {
            size: this.cache.size,
            maxSize: this.config.cacheSize,
            ttl: this.config.cacheTTL,
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                hits: entry.hits,
                age: Date.now() - entry.timestamp
            }))
        };
    }

    getIndexes() {
        return Array.from(this.indexes);
    }

    reset() {
        this.clearCache();
        this.queryStats.clear();
        this.pendingQueries.clear();

    }
}

// Create singleton instance
const dbOptimizer = new DatabaseOptimizer({
    cacheEnabled: true,
    cacheSize: 100,
    cacheTTL: 300000,
    debug: window.location.hostname === 'localhost'
});

// Expose globally
window.dbOptimizer = dbOptimizer;

// Export
if (typeof module !== 'undefined` && module.exports) {
    module.exports = DatabaseOptimizer;
}

