/**
 * 📜 History Manager
 * Sistema de gestión de historial de reproducción
 */

class HistoryManager {
    constructor() {
        this.history = this.loadHistory();
        this.maxHistoryItems = 1000; // Límite máximo de items en historial
        this.sessionHistory = []; // Historial de sesión actual
    }

    // Cargar historial desde localStorage
    loadHistory() {
        try {
            const saved = localStorage.getItem('musicAnalyzer_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading history:', e);
            return [];
        }
    }

    // Guardar historial en localStorage
    saveHistory() {
        try {
            // Limitar el tamaño del historial
            if (this.history.length > this.maxHistoryItems) {
                this.history = this.history.slice(0, this.maxHistoryItems);
            }

            localStorage.setItem('musicAnalyzer_history', JSON.stringify(this.history));
            this.dispatchEvent('historyUpdated');
            return true;
        } catch (e) {
            console.error('Error saving history:', e);
            return false;
        }
    }

    // Agregar track al historial
    addToHistory(track) {
        const historyEntry = {
            file_path: track.file_path,
            title: track.title || track.file_name,
            artist: track.artist || 'Unknown Artist',
            album: track.album,
            genre: track.genre || track.LLM_GENRE,
            mood: track.AI_MOOD || track.LLM_MOOD,
            artwork_url: track.artwork_url || track.artwork_path,
            played_at: new Date().toISOString(),
            duration_played: 0, // Se actualizará cuando termine
            completed: false
        };

        // Agregar al inicio del historial
        this.history.unshift(historyEntry);
        this.sessionHistory.unshift(historyEntry);

        // Guardar
        this.saveHistory();

        return historyEntry;
    }

    // Actualizar duración reproducida
    updatePlayDuration(trackPath, duration, completed = false) {
        const entry = this.history.find(h => h.file_path === trackPath && !h.completed);

        if (entry) {
            entry.duration_played = duration;
            entry.completed = completed;
            this.saveHistory();
        }
    }

    // Obtener historial completo
    getHistory() {
        return [...this.history]; // Retornar copia
    }

    // Obtener historial de sesión
    getSessionHistory() {
        return [...this.sessionHistory];
    }

    // Obtener historial paginado
    getHistoryPaginated(page = 1, pageSize = 50) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            history: this.history.slice(start, end),
            totalPages: Math.ceil(this.history.length / pageSize),
            currentPage: page,
            totalItems: this.history.length
        };
    }

    // Obtener historial por fecha
    getHistoryByDate(date) {
        const targetDate = new Date(date).toDateString();

        return this.history.filter(entry => {
            const entryDate = new Date(entry.played_at).toDateString();
            return entryDate === targetDate;
        });
    }

    // Obtener historial de hoy
    getTodayHistory() {
        return this.getHistoryByDate(new Date());
    }

    // Obtener historial de ayer
    getYesterdayHistory() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.getHistoryByDate(yesterday);
    }

    // Obtener historial de la última semana
    getWeekHistory() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        return this.history.filter(entry => new Date(entry.played_at) >= weekAgo);
    }

    // Obtener historial del último mes
    getMonthHistory() {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        return this.history.filter(entry => new Date(entry.played_at) >= monthAgo);
    }

    // Buscar en historial
    searchHistory(query) {
        const searchTerm = query.toLowerCase();

        return this.history.filter(
            entry =>
                entry.title?.toLowerCase().includes(searchTerm) ||
                entry.artist?.toLowerCase().includes(searchTerm) ||
                entry.album?.toLowerCase().includes(searchTerm) ||
                entry.genre?.toLowerCase().includes(searchTerm)
        );
    }

    // Obtener tracks más reproducidos
    getMostPlayed(limit = 10) {
        const playCount = {};

        // Contar reproducciones por track
        this.history.forEach(entry => {
            const key = entry.file_path;
            if (!playCount[key]) {
                playCount[key] = {
                    track: entry,
                    count: 0,
                    totalDuration: 0
                };
            }
            playCount[key].count++;
            playCount[key].totalDuration += entry.duration_played || 0;
        });

        // Ordenar por cantidad de reproducciones
        return Object.values(playCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map(item => ({
                ...item.track,
                play_count: item.count,
                total_duration: item.totalDuration
            }));
    }

    // Obtener artistas más escuchados
    getMostPlayedArtists(limit = 10) {
        const artistCount = {};

        this.history.forEach(entry => {
            const artist = entry.artist || 'Unknown Artist';
            artistCount[artist] = (artistCount[artist] || 0) + 1;
        });

        return Object.entries(artistCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([artist, count]) => ({ artist, count }));
    }

    // Obtener géneros más escuchados
    getMostPlayedGenres(limit = 10) {
        const genreCount = {};

        this.history.forEach(entry => {
            if (entry.genre) {
                genreCount[entry.genre] = (genreCount[entry.genre] || 0) + 1;
            }
        });

        return Object.entries(genreCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([genre, count]) => ({ genre, count }));
    }

    // Obtener estadísticas del historial
    getStatistics() {
        const stats = {
            totalPlays: this.history.length,
            todayPlays: this.getTodayHistory().length,
            weekPlays: this.getWeekHistory().length,
            uniqueTracks: new Set(this.history.map(h => h.file_path)).size,
            uniqueArtists: new Set(this.history.map(h => h.artist)).size,
            totalListeningTime: 0,
            averageListeningTime: 0,
            completionRate: 0,
            mostActiveHour: null,
            mostActiveDay: null
        };

        // Calcular tiempo total escuchado
        let completedCount = 0;
        this.history.forEach(entry => {
            stats.totalListeningTime += entry.duration_played || 0;
            if (entry.completed) {
                completedCount++;
            }
        });

        // Promedio de tiempo escuchado
        if (stats.totalPlays > 0) {
            stats.averageListeningTime = stats.totalListeningTime / stats.totalPlays;
            stats.completionRate = (completedCount / stats.totalPlays) * 100;
        }

        // Hora más activa
        const hourCount = {};
        this.history.forEach(entry => {
            const hour = new Date(entry.played_at).getHours();
            hourCount[hour] = (hourCount[hour] || 0) + 1;
        });

        const mostActiveHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];

        if (mostActiveHourEntry) {
            stats.mostActiveHour = parseInt(mostActiveHourEntry[0]);
        }

        // Día más activo
        const dayCount = {};
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        this.history.forEach(entry => {
            const day = new Date(entry.played_at).getDay();
            dayCount[day] = (dayCount[day] || 0) + 1;
        });

        const mostActiveDayEntry = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

        if (mostActiveDayEntry) {
            stats.mostActiveDay = days[parseInt(mostActiveDayEntry[0])];
        }

        return stats;
    }

    // Obtener gráfico de actividad (últimos 30 días)
    getActivityChart() {
        const days = 30;
        const activity = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            const dayHistory = this.getHistoryByDate(date);

            activity.push({
                date: date.toISOString().split('T')[0],
                plays: dayHistory.length,
                duration: dayHistory.reduce((sum, h) => sum + (h.duration_played || 0), 0)
            });
        }

        return activity;
    }

    // Limpiar historial antiguo
    cleanOldHistory(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const originalLength = this.history.length;
        this.history = this.history.filter(entry => new Date(entry.played_at) >= cutoffDate);

        const removed = originalLength - this.history.length;
        if (removed > 0) {
            this.saveHistory();
        }

        return removed;
    }

    // Limpiar todo el historial
    clearHistory() {
        if (confirm('¿Eliminar todo el historial? Esta acción no se puede deshacer.')) {
            this.history = [];
            this.sessionHistory = [];
            this.saveHistory();

            return true;
        }
        return false;
    }

    // Exportar historial
    exportHistory() {
        const data = JSON.stringify(this.history, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `history_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Dispatch custom event
    dispatchEvent(eventName, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(eventName, {
                detail: { ...detail, historyCount: this.history.length }
            })
        );
    }
}

// Crear instancia global
window.historyManager = new HistoryManager();

// Integración con el player
window.addEventListener('trackStarted', event => {
    const track = event.detail?.track;
    if (track) {
        window.historyManager.addToHistory(track);
    }
});

window.addEventListener('trackEnded', event => {
    const { trackPath, duration, completed } = event.detail || {};
    if (trackPath) {
        window.historyManager.updatePlayDuration(trackPath, duration, completed);
    }
});

// Limpiar historial antiguo al cargar (mantener últimos 90 días)
window.historyManager.cleanOldHistory(90);
