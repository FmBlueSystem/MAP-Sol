// TASK_022: LRU Cache layer para optimizar queries
class LRUCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    get(key) {
        if (!this.cache.has(key)) return null;
        
        // Mover al final (más reciente)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        
        return value;
    }
    
    set(key, value) {
        // Si existe, actualizar
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Si está lleno, eliminar el más antiguo
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, value);
    }
    
    clear() {
        this.cache.clear();
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    size() {
        return this.cache.size;
    }
}

// Cache global para queries SQL
const queryCache = new LRUCache(50);
const filterCache = new LRUCache(20);

module.exports = { LRUCache, queryCache, filterCache };