// Secure Search Handler - Refactored with DatabaseService
// No SQL injection vulnerabilities, proper async handling

const dbService = require('../services/database-service');

function createSearchHandler() {
    return async (event, searchTerm, filters = {}) => {
        try {
            // Validate inputs
            if (typeof searchTerm !== 'string' && searchTerm !== undefined) {
                throw new Error('Invalid search term');
            }

            // Sanitize search term
            const sanitizedSearch = searchTerm ? searchTerm.trim().slice(0, 100) : '';

            // Validate and sanitize filters
            const sanitizedFilters = {
                genre: filters.genre && typeof filters.genre === 'string' ? filters.genre.slice(0, 50) : null,
                mood: filters.mood && typeof filters.mood === 'string' ? filters.mood.slice(0, 50) : null,
                minBPM:
                    filters.minBPM && !isNaN(filters.minBPM)
                        ? Math.max(0, Math.min(300, Number(filters.minBPM)))
                        : null,
                maxBPM:
                    filters.maxBPM && !isNaN(filters.maxBPM)
                        ? Math.max(0, Math.min(300, Number(filters.maxBPM)))
                        : null,
                minEnergy:
                    filters.minEnergy && !isNaN(filters.minEnergy)
                        ? Math.max(0, Math.min(1, Number(filters.minEnergy)))
                        : null,
                maxEnergy:
                    filters.maxEnergy && !isNaN(filters.maxEnergy)
                        ? Math.max(0, Math.min(1, Number(filters.maxEnergy)))
                        : null,
                limit:
                    filters.limit && !isNaN(filters.limit) ? Math.max(1, Math.min(1000, Number(filters.limit))) : 500
            };

            // Use secure database service
            const results = await dbService.searchTracks(sanitizedSearch, sanitizedFilters);

            // Log search for analytics (without sensitive data)

            return {
                success: true,
                results: results,
                count: results.length,
                filters: sanitizedFilters
            };
        } catch (error) {
            console.error('Search error:', error.message);

            // Don't expose internal errors to client
            return {
                success: false,
                error: 'Search failed. Please try again.',
                results: []
            };
        }
    };
}

module.exports = { createSearchHandler };
