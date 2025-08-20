/**
 * @fileoverview Event Bus Module
 * @module modules/event-bus
 * @description Centralized event management system
 */

/**
 * Event bus for application-wide event handling
 * @class EventBus
 */
export class EventBus {
    /**
     * Creates event bus instance
     * @constructor
     */
    constructor() {
        /** @type {Map<string, Set<Function>>} Event listeners */
        this.events = new Map();
        /** @type {Map<string, any>} Last event data */
        this.lastEventData = new Map();
        /** @type {boolean} Debug mode */
        this.debug = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     * @example
     * const unsubscribe = eventBus.on('track-updated', (data) => console.log(data));
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }

        this.events.get(event).add(callback);

        if (this.debug) {
            console.log(`[EventBus] Subscribed to ${event}`);
        }

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };

        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {boolean} Success status
     */
    off(event, callback) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event);
        const result = listeners.delete(callback);

        // Clean up empty sets
        if (listeners.size === 0) {
            this.events.delete(event);
        }

        if (this.debug && result) {
            console.log(`[EventBus] Unsubscribed from ${event}`);
        }

        return result;
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {any} [data] - Event data
     * @returns {number} Number of listeners called
     */
    emit(event, data) {
        if (!this.events.has(event)) {
            if (this.debug) {
                console.log(`[EventBus] No listeners for ${event}`);
            }
            return 0;
        }

        const listeners = this.events.get(event);
        let count = 0;

        // Store last event data
        this.lastEventData.set(event, data);

        // Call all listeners
        for (const callback of listeners) {
            try {
                callback(data);
                count++;
            } catch (error) {
                console.error(`[EventBus] Error in ${event} handler:`, error);
            }
        }

        if (this.debug) {
            console.log(`[EventBus] Emitted ${event} to ${count} listeners`, data);
        }

        return count;
    }

    /**
     * Emit an event asynchronously
     * @async
     * @param {string} event - Event name
     * @param {any} [data] - Event data
     * @returns {Promise<number>} Number of listeners called
     */
    async emitAsync(event, data) {
        if (!this.events.has(event)) {
            return 0;
        }

        const listeners = this.events.get(event);
        const promises = [];

        // Store last event data
        this.lastEventData.set(event, data);

        // Call all listeners
        for (const callback of listeners) {
            promises.push(
                Promise.resolve()
                    .then(() => callback(data))
                    .catch((error) => {
                        console.error(`[EventBus] Error in ${event} async handler:`, error);
                    })
            );
        }

        await Promise.all(promises);

        if (this.debug) {
            console.log(`[EventBus] Async emitted ${event} to ${promises.length} listeners`);
        }

        return promises.length;
    }

    /**
     * Clear all listeners for an event
     * @param {string} event - Event name
     * @returns {boolean} Success status
     */
    clear(event) {
        if (event) {
            return this.events.delete(event);
        }

        // Clear all events
        this.events.clear();
        this.lastEventData.clear();
        return true;
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Listener count
     */
    listenerCount(event) {
        if (!this.events.has(event)) {
            return 0;
        }

        return this.events.get(event).size;
    }

    /**
     * Get all event names
     * @returns {Array<string>} Event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Get last event data
     * @param {string} event - Event name
     * @returns {any} Last event data
     */
    getLastEventData(event) {
        return this.lastEventData.get(event);
    }

    /**
     * Enable debug mode
     * @param {boolean} [enabled=true] - Debug state
     * @returns {void}
     */
    setDebug(enabled = true) {
        this.debug = enabled;
    }

    /**
     * Get event bus statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const stats = {
            totalEvents: this.events.size,
            totalListeners: 0,
            events: {},
        };

        for (const [event, listeners] of this.events) {
            stats.totalListeners += listeners.size;
            stats.events[event] = listeners.size;
        }

        return stats;
    }
}

// Create singleton instance
const eventBus = new EventBus();

// Common events
export const Events = {
    // Track events
    TRACK_LOADED: 'track:loaded',
    TRACK_UPDATED: 'track:updated',
    TRACK_DELETED: 'track:deleted',
    TRACK_SELECTED: 'track:selected',

    // Playback events
    PLAYBACK_STARTED: 'playback:started',
    PLAYBACK_PAUSED: 'playback:paused',
    PLAYBACK_STOPPED: 'playback:stopped',
    PLAYBACK_ENDED: 'playback:ended',
    PLAYBACK_ERROR: 'playback:error',

    // UI events
    VIEW_CHANGED: 'ui:view-changed',
    THEME_CHANGED: 'ui:theme-changed',
    MODAL_OPENED: 'ui:modal-opened',
    MODAL_CLOSED: 'ui:modal-closed',

    // Data events
    DATA_LOADED: 'data:loaded',
    DATA_UPDATED: 'data:updated',
    CACHE_CLEARED: 'data:cache-cleared',

    // Search events
    SEARCH_STARTED: 'search:started',
    SEARCH_COMPLETED: 'search:completed',
    SEARCH_CLEARED: 'search:cleared',

    // Analysis events
    ANALYSIS_STARTED: 'analysis:started',
    ANALYSIS_PROGRESS: 'analysis:progress',
    ANALYSIS_COMPLETED: 'analysis:completed',
    ANALYSIS_ERROR: 'analysis:error',
};

// Export singleton
export default eventBus;
