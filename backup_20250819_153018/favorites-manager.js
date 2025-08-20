/**
 * 🌟 Favorites Manager
 * Sistema de gestión de favoritos con persistencia localStorage
 */

class FavoritesManager {
    constructor() {
        this.favorites = this.loadFavorites();
        this.maxFavorites = 500; // Límite máximo de favoritos
    }

    // Cargar favoritos desde localStorage
    loadFavorites() {
        try {
            const saved = localStorage.getItem('musicAnalyzer_favorites');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading favorites:', e);
            return [];
        }
    }

    // Guardar favoritos en localStorage
    saveFavorites() {
        try {
            localStorage.setItem('musicAnalyzer_favorites', JSON.stringify(this.favorites));
            this.dispatchEvent('favoritesUpdated');
            return true;
        } catch (e) {
            console.error('Error saving favorites:', e);
            return false;
        }
    }

    // Verificar si un track es favorito
    isFavorite(trackPath) {
        return this.favorites.some(fav => fav.file_path === trackPath);
    }

    // Agregar a favoritos
    addFavorite(track) {
        if (this.isFavorite(track.file_path)) {
            return false;
        }

        if (this.favorites.length >= this.maxFavorites) {
            console.warn(`Límite de favoritos alcanzado (${this.maxFavorites})`);
            return false;
        }

        const favoriteData = {
            file_path: track.file_path,
            title: track.title || track.file_name,
            artist: track.artist || 'Unknown Artist',
            album: track.album,
            genre: track.genre || track.LLM_GENRE,
            mood: track.AI_MOOD || track.LLM_MOOD,
            artwork_url: track.artwork_url || track.artwork_path,
            added_date: new Date().toISOString(),
            play_count: 0
        };

        this.favorites.unshift(favoriteData); // Agregar al inicio
        this.saveFavorites();

        return true;
    }

    // Remover de favoritos
    removeFavorite(trackPath) {
        const index = this.favorites.findIndex(fav => fav.file_path === trackPath);

        if (index === -1) {
            return false;
        }

        const removed = this.favorites.splice(index, 1)[0];
        this.saveFavorites();

        return true;
    }

    // Toggle favorito (agregar/remover)
    toggleFavorite(track) {
        if (this.isFavorite(track.file_path)) {
            return this.removeFavorite(track.file_path);
        } else {
            return this.addFavorite(track);
        }
    }

    // Obtener todos los favoritos
    getFavorites() {
        return [...this.favorites]; // Retornar copia
    }

    // Obtener favoritos por página
    getFavoritesPaginated(page = 1, pageSize = 50) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            favorites: this.favorites.slice(start, end),
            totalPages: Math.ceil(this.favorites.length / pageSize),
            currentPage: page,
            totalFavorites: this.favorites.length
        };
    }

    // Buscar en favoritos
    searchFavorites(query) {
        const searchTerm = query.toLowerCase();

        return this.favorites.filter(
            fav =>
                fav.title?.toLowerCase().includes(searchTerm) ||
                fav.artist?.toLowerCase().includes(searchTerm) ||
                fav.album?.toLowerCase().includes(searchTerm) ||
                fav.genre?.toLowerCase().includes(searchTerm)
        );
    }

    // Obtener favoritos por género
    getFavoritesByGenre(genre) {
        return this.favorites.filter(fav => fav.genre?.toLowerCase() === genre.toLowerCase());
    }

    // Obtener favoritos por mood
    getFavoritesByMood(mood) {
        return this.favorites.filter(fav => fav.mood?.toLowerCase() === mood.toLowerCase());
    }

    // Obtener favoritos recientes
    getRecentFavorites(limit = 10) {
        return this.favorites.slice(0, limit);
    }

    // Obtener favoritos más reproducidos
    getMostPlayedFavorites(limit = 10) {
        return [...this.favorites]
            .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
            .slice(0, limit);
    }

    // Incrementar contador de reproducción
    incrementPlayCount(trackPath) {
        const favorite = this.favorites.find(fav => fav.file_path === trackPath);

        if (favorite) {
            favorite.play_count = (favorite.play_count || 0) + 1;
            favorite.last_played = new Date().toISOString();
            this.saveFavorites();
        }
    }

    // Limpiar todos los favoritos
    clearFavorites() {
        if (confirm('¿Eliminar todos los favoritos? Esta acción no se puede deshacer.')) {
            this.favorites = [];
            this.saveFavorites();

            return true;
        }
        return false;
    }

    // Exportar favoritos
    exportFavorites() {
        const data = JSON.stringify(this.favorites, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a`);
        a.href = url;
        a.download = `favorites_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Importar favoritos
    async importFavorites(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = e => {
                try {
                    const imported = JSON.parse(e.target.result);

                    if (!Array.isArray(imported)) {
                        throw new Error('Formato inválido');
                    }

                    // Merge con favoritos existentes
                    const existingPaths = new Set(this.favorites.map(f => f.file_path));
                    const newFavorites = imported.filter(f => !existingPaths.has(f.file_path));

                    this.favorites = [...this.favorites, ...newFavorites];

                    // Limitar al máximo permitido
                    if (this.favorites.length > this.maxFavorites) {
                        this.favorites = this.favorites.slice(0, this.maxFavorites);
                    }

                    this.saveFavorites();

                    resolve(newFavorites.length);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsText(file);
        });
    }

    // Obtener estadísticas
    getStatistics() {
        const stats = {
            total: this.favorites.length,
            genres: {},
            moods: {},
            artists: {},
            mostPlayed: null,
            recentlyAdded: null,
            averagePlayCount: 0
        };

        let totalPlayCount = 0;

        this.favorites.forEach(fav => {
            // Géneros
            if (fav.genre) {
                stats.genres[fav.genre] = (stats.genres[fav.genre] || 0) + 1;
            }

            // Moods
            if (fav.mood) {
                stats.moods[fav.mood] = (stats.moods[fav.mood] || 0) + 1;
            }

            // Artistas
            if (fav.artist) {
                stats.artists[fav.artist] = (stats.artists[fav.artist] || 0) + 1;
            }

            // Play count
            totalPlayCount += fav.play_count || 0;

            // Track más reproducido
            if (!stats.mostPlayed || fav.play_count > (stats.mostPlayed.play_count || 0)) {
                stats.mostPlayed = fav;
            }
        });

        // Promedio de reproducciones
        stats.averagePlayCount = stats.total > 0 ? totalPlayCount / stats.total : 0;

        // Más reciente
        stats.recentlyAdded = this.favorites[0];

        return stats;
    }

    // Dispatch custom event
    dispatchEvent(eventName, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(eventName, {
                detail: { ...detail, favorites: this.favorites.length }
            })
        );
    }
}

// Crear instancia global
window.favoritesManager = new FavoritesManager();

// UI Helper Functions
window.updateFavoriteButton = function (button, trackPath) {
    const isFav = window.favoritesManager.isFavorite(trackPath);

    button.innerHTML = isFav ? '❤️' : '🤍';
    button.title = isFav ? 'Remover de favoritos' : 'Agregar a favoritos';
    button.classList.toggle('is-favorite`, isFav);
};

window.handleFavoriteClick = function (track, button) {
    const result = window.favoritesManager.toggleFavorite(track);

    if (result !== false) {
        window.updateFavoriteButton(button, track.file_path);

        // Mostrar notificación
        const isFav = window.favoritesManager.isFavorite(track.file_path);
        const message = isFav
            ? `✅ `${track.title || track.file_name}` agregado a favoritos`
            : `✅ "${track.title || track.file_name}` removido de favoritos`;

        if (window.showNotification) {
            window.showNotification(message, 'success');
        }
    }
};

// Escuchar eventos de reproducción para actualizar play count
window.addEventListener(`trackPlayed`, event => {
    const trackPath = event.detail?.trackPath;
    if (trackPath && window.favoritesManager.isFavorite(trackPath)) {
        window.favoritesManager.incrementPlayCount(trackPath);
    }
});
