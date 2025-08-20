/**
 * Track Preloader - Sistema de precarga inteligente para el siguiente track
 * Optimiza la reproducción continua sin interrupciones
 */

class TrackPreloader {
    constructor() {
        this.preloadedTracks = new Map(); // Cache de tracks precargados
        this.maxPreloadSize = 3; // Máximo de tracks en precarga
        this.preloadQueue = []; // Cola de precarga
        this.isPreloading = false;
        this.currentPlaylist = [];
        this.currentIndex = -1;
    }

    /**
     * Inicializa el preloader con una playlist
     */
    setPlaylist(tracks, currentIndex = 0) {
        this.currentPlaylist = tracks;
        this.currentIndex = currentIndex;
        this.clearPreloadCache();

        // Precargar los siguientes tracks
        this.preloadNextTracks();
    }

    /**
     * Actualiza el índice actual y precarga siguientes
     */
    updateCurrentIndex(index) {
        this.currentIndex = index;
        this.cleanupOldPreloads();
        this.preloadNextTracks();
    }

    /**
     * Precarga los siguientes tracks en la playlist
     */
    async preloadNextTracks() {
        if (this.isPreloading || this.currentPlaylist.length === 0) {
            return;
        }

        this.isPreloading = true;

        try {
            // Determinar qué tracks precargar
            const tracksToPreload = [];
            for (let i = 1; i <= this.maxPreloadSize; i++) {
                const nextIndex = (this.currentIndex + i) % this.currentPlaylist.length;
                const track = this.currentPlaylist[nextIndex];

                if (track && !this.preloadedTracks.has(track.id)) {
                    tracksToPreload.push({
                        index: nextIndex,
                        track: track,
                    });
                }
            }

            // Precargar en paralelo pero con límite
            const preloadPromises = tracksToPreload.map((item) => this.preloadTrack(item.track, item.index));

            await Promise.allSettled(preloadPromises);
        } catch (error) {
            console.error('Error precargando tracks:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Precarga un track individual
     */
    async preloadTrack(track, index) {
        try {
            // Crear un objeto de precarga con metadatos y buffer de audio
            const preloadData = {
                id: track.id,
                index: index,
                metadata: {
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    duration: track.duration,
                    artwork_url: track.artwork_url,
                    file_path: track.file_path,
                },
                audioBuffer: null,
                preloadedAt: Date.now(),
            };

            // Si tenemos acceso a Howler, precargar el audio
            if (typeof Howl !== 'undefined') {
                preloadData.howl = new Howl({
                    src: [track.file_path],
                    preload: true,
                    html5: true, // Usar HTML5 Audio para streaming
                    volume: 0, // Silenciado durante la precarga
                    onload: () => {
                        console.log(`✅ Track precargado: ${track.title}`);
                    },
                    onloaderror: (id, error) => {
                        console.error(`❌ Error precargando ${track.title}:`, error);
                    },
                });
            } else {
                // Fallback: precargar usando Audio API nativo
                const audio = new Audio();
                audio.preload = 'auto';
                audio.src = track.file_path;
                audio.volume = 0;

                // Esperar a que se cargue metadata
                await new Promise((resolve, reject) => {
                    audio.addEventListener('loadedmetadata', resolve);
                    audio.addEventListener('error', reject);
                    setTimeout(reject, 10000); // Timeout de 10 segundos
                });

                preloadData.audioElement = audio;
            }

            // Almacenar en cache
            this.preloadedTracks.set(track.id, preloadData);

            // Mantener el cache dentro del límite
            if (this.preloadedTracks.size > this.maxPreloadSize * 2) {
                this.cleanupOldPreloads();
            }

            return preloadData;
        } catch (error) {
            console.error(`Error precargando track ${track.id}:`, error);
            return null;
        }
    }

    /**
     * Obtiene un track precargado
     */
    getPreloadedTrack(trackId) {
        const preloaded = this.preloadedTracks.get(trackId);

        if (preloaded) {
            console.log(`🎵 Usando track precargado: ${preloaded.metadata.title}`);
            return preloaded;
        }

        return null;
    }

    /**
     * Limpia tracks precargados antiguos
     */
    cleanupOldPreloads() {
        const currentTime = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutos

        // Eliminar tracks viejos o que ya pasaron
        for (const [trackId, data] of this.preloadedTracks.entries()) {
            const age = currentTime - data.preloadedAt;
            const isPast = data.index <= this.currentIndex;

            if (age > maxAge || (isPast && data.index !== this.currentIndex)) {
                // Limpiar recursos
                if (data.howl) {
                    data.howl.unload();
                }
                if (data.audioElement) {
                    data.audioElement.src = '';
                    data.audioElement = null;
                }

                this.preloadedTracks.delete(trackId);
                console.log(`🧹 Limpiando precarga antigua: ${data.metadata.title}`);
            }
        }
    }

    /**
     * Limpia toda la cache de precarga
     */
    clearPreloadCache() {
        for (const [trackId, data] of this.preloadedTracks.entries()) {
            if (data.howl) {
                data.howl.unload();
            }
            if (data.audioElement) {
                data.audioElement.src = '';
                data.audioElement = null;
            }
        }

        this.preloadedTracks.clear();
        console.log('🧹 Cache de precarga limpiada');
    }

    /**
     * Obtiene estadísticas de precarga
     */
    getStats() {
        return {
            cachedTracks: this.preloadedTracks.size,
            maxCacheSize: this.maxPreloadSize,
            currentIndex: this.currentIndex,
            playlistLength: this.currentPlaylist.length,
            isPreloading: this.isPreloading,
            cacheDetails: Array.from(this.preloadedTracks.values()).map((item) => ({
                id: item.id,
                title: item.metadata.title,
                index: item.index,
                age: Math.floor((Date.now() - item.preloadedAt) / 1000) + 's',
            })),
        };
    }

    /**
     * Configura el número máximo de tracks a precargar
     */
    setMaxPreloadSize(size) {
        this.maxPreloadSize = Math.max(1, Math.min(10, size)); // Entre 1 y 10
        this.cleanupOldPreloads();
    }
}

// Singleton para uso global
const trackPreloader = new TrackPreloader();

// Exportar para Node.js o usar en browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TrackPreloader, trackPreloader };
} else if (typeof window !== 'undefined') {
    window.TrackPreloader = TrackPreloader;
    window.trackPreloader = trackPreloader;
}
