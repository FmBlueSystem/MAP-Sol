/**
 * @fileoverview Data Manager Module
 * @module modules/data-manager
 * @description Manages data operations and caching
 */

/**
 * Data manager for handling application data
 * @class DataManager
 */
export class DataManager {
    /**
     * Creates data manager instance
     * @constructor
     */
    constructor() {
        /** @type {Map<string, any>} Data cache */
        this.cache = new Map();
        /** @type {number} Cache TTL in ms */
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        /** @type {Map<string, number>} Cache timestamps */
        this.cacheTimestamps = new Map();
    }

    /**
     * Fetch tracks from database
     * @async
     * @param {Object} [options={}] - Query options
     * @param {number} [options.limit] - Result limit
     * @param {number} [options.offset] - Result offset
     * @param {string} [options.sortBy] - Sort field
     * @returns {Promise<Array>} Track list
     */
    async fetchTracks(options = {}) {
        const cacheKey = `tracks_${JSON.stringify(options)}`;
        
        // Check cache
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const result = await window.api.invoke('get-files-with-cached-artwork', 
                options.limit, 
                options.offset
            );
            
            if (result.success) {
                this.setCache(cacheKey, result.files);
                return result.files;
            }
            
            throw new Error(result.error || 'Failed to fetch tracks');
        } catch (error) {
            console.error('Error fetching tracks:', error);
            return [];
        }
    }

    /**
     * Search tracks
     * @async
     * @param {string} query - Search query
     * @param {Object} [filters={}] - Search filters
     * @returns {Promise<Array>} Search results
     */
    async searchTracks(query, filters = {}) {
        const cacheKey = `search_${query}_${JSON.stringify(filters)}`;
        
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const result = await window.api.invoke('search-tracks', {
                query,
                ...filters
            });
            
            if (result.success) {
                this.setCache(cacheKey, result.tracks);
                return result.tracks;
            }
            
            return [];
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    /**
     * Update track metadata
     * @async
     * @param {number} trackId - Track ID
     * @param {Object} updates - Metadata updates
     * @returns {Promise<boolean>} Success status
     */
    async updateTrack(trackId, updates) {
        try {
            const result = await window.api.invoke('update-metadata', {
                id: trackId,
                ...updates
            });
            
            if (result.success) {
                // Invalidate cache
                this.invalidateCache('tracks');
                this.invalidateCache('search');
                
                // Emit update event
                document.dispatchEvent(new CustomEvent('track-updated', {
                    detail: { trackId, updates }
                }));
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Update error:', error);
            return false;
        }
    }

    /**
     * Get filter options
     * @async
     * @returns {Promise<Object>} Filter options
     */
    async getFilterOptions() {
        const cacheKey = 'filter_options';
        
        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const result = await window.api.invoke('get-filter-options');
            
            if (result.success) {
                const options = {
                    genres: result.genres || [],
                    moods: result.moods || [],
                    years: result.years || []
                };
                
                this.setCache(cacheKey, options);
                return options;
            }
            
            return { genres: [], moods: [], years: [] };
        } catch (error) {
            console.error('Filter options error:', error);
            return { genres: [], moods: [], years: [] };
        }
    }

    /**
     * Export data
     * @async
     * @param {Array<number>} trackIds - Track IDs to export
     * @param {string} format - Export format ('json', 'csv', 'm3u')
     * @returns {Promise<boolean>} Success status
     */
    async exportData(trackIds, format) {
        try {
            const result = await window.api.invoke(`export-${format}`, {
                trackIds,
                timestamp: Date.now()
            });
            
            return result.success;
        } catch (error) {
            console.error('Export error:', error);
            return false;
        }
    }

    /**
     * Set cache value
     * @private
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @returns {void}
     */
    setCache(key, value) {
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Check if cache is valid
     * @private
     * @param {string} key - Cache key
     * @returns {boolean} Cache validity
     */
    isCacheValid(key) {
        if (!this.cache.has(key)) {
            return false;
        }
        
        const timestamp = this.cacheTimestamps.get(key);
        return timestamp && (Date.now() - timestamp < this.cacheTTL);
    }

    /**
     * Invalidate cache entries
     * @param {string} prefix - Key prefix to invalidate
     * @returns {void}
     */
    invalidateCache(prefix) {
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => {
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
        });
    }

    /**
     * Clear all cache
     * @returns {void}
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            memoryUsage: this.estimateCacheSize(),
            ttl: this.cacheTTL,
            entries: Array.from(this.cache.keys())
        };
    }

    /**
     * Estimate cache memory size
     * @private
     * @returns {number} Estimated size in bytes
     */
    estimateCacheSize() {
        let size = 0;
        
        for (const value of this.cache.values()) {
            size += JSON.stringify(value).length * 2; // Rough estimate
        }
        
        return size;
    }
}

// Export singleton instance
export default new DataManager();