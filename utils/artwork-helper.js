// Artwork Helper - Sistema centralizado de gestión de carátulas
// Maneja imagen por defecto, fallbacks y generación dinámica

class ArtworkHelper {
    constructor() {
        // Path a la imagen por defecto
        this.defaultArtwork = './assets/images/default-album.png';
        
        // Cache de placeholders generados
        this.placeholderCache = new Map();
        
        // Colores para placeholders dinámicos
        this.gradientColors = [
            ['#667eea', '#764ba2'], // Púrpura
            ['#f093fb', '#f5576c'], // Rosa
            ['#4facfe', '#00f2fe'], // Azul cyan
            ['#43e97b', '#38f9d7'], // Verde aqua
            ['#fa709a', '#fee140'], // Rosa amarillo
            ['#fccb90', '#d57eeb'], // Durazno púrpura
            ['#a8edea', '#fed6e3'], // Aqua rosa claro
            ['#ff9a9e', '#fecfef'], // Rosa claro
            ['#a1c4fd', '#c2e9fb'], // Azul claro
            ['#fbc2eb', '#a6c1ee']  // Rosa azul claro
        ];
        
        // Verificar si estamos en Electron
        this.isElectron = typeof window !== 'undefined' && 
                         window.process && 
                         window.process.type === 'renderer';
    }
    
    /**
     * Obtiene la URL del artwork para un track
     * @param {Object} track - Objeto track con metadata
     * @returns {string} URL del artwork (real o placeholder)
     */
    getArtworkUrl(track) {
        // Prioridad 1: Artwork extraído en cache
        if (track.artwork_path) {
            // Si es un ID numérico, buscar en artwork-cache
            if (/^\d+$/.test(track.artwork_path)) {
                return `./artwork-cache/${track.artwork_path}.jpg`;
            }
            // Si es una ruta completa
            return track.artwork_path;
        }
        
        // Prioridad 2: Artwork embebido (necesitaría extracción)
        if (track.has_embedded_artwork) {
            // Por ahora usar default, pero podríamos extraerlo dinámicamente
            return this.getPlaceholderUrl(track);
        }
        
        // Prioridad 3: Placeholder dinámico basado en metadata
        if (track.artist || track.title) {
            return this.getPlaceholderUrl(track);
        }
        
        // Prioridad 4: Imagen por defecto
        return this.defaultArtwork;
    }
    
    /**
     * Genera o recupera un placeholder dinámico
     * @param {Object} track - Track con artist/title
     * @returns {string} Data URL del placeholder o default
     */
    getPlaceholderUrl(track) {
        const key = `${track.artist || 'Unknown'}-${track.title || 'Track'}';
        
        // Verificar cache
        if (this.placeholderCache.has(key)) {
            return this.placeholderCache.get(key);
        }
        
        // Si no podemos generar canvas (SSR), usar default
        if (typeof document === 'undefined') {
            return this.defaultArtwork;
        }
        
        try {
            const dataUrl = this.generatePlaceholder(track.artist, track.title);
            this.placeholderCache.set(key, dataUrl);
            
            // Limpiar cache si crece mucho
            if (this.placeholderCache.size > 100) {
                const firstKey = this.placeholderCache.keys().next().value;
                this.placeholderCache.delete(firstKey);
            }
            
            return dataUrl;
        } catch (error) {
            console.warn('Error generando placeholder:', error);
            return this.defaultArtwork;
        }
    }
    
    /**
     * Genera un placeholder con canvas
     * @param {string} artist - Nombre del artista
     * @param {string} title - Título del track
     * @returns {string} Data URL de la imagen generada
     */
    generatePlaceholder(artist = 'Unknown', title = 'Track') {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        
        // Seleccionar colores basado en el string
        const hashCode = (artist + title).split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        const colorIndex = Math.abs(hashCode) % this.gradientColors.length;
        const colors = this.gradientColors[colorIndex];
        
        // Crear gradiente
        const gradient = ctx.createLinearGradient(0, 0, 300, 300);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);
        
        // Fondo con gradiente
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 300, 300);
        
        // Agregar patrón sutil
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = 'white';
        for (let i = 0; i < 300; i += 20) {
            ctx.fillRect(i, 0, 1, 300);
            ctx.fillRect(0, i, 300, 1);
        }
        ctx.globalAlpha = 1;
        
        // Sombra para el texto
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Texto - Iniciales o símbolo musical
        ctx.fillStyle = 'white';
        ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Obtener iniciales (máximo 2 caracteres)
        let initials = '';
        if (artist && artist !== 'Unknown') {
            const words = artist.split(' ');
            if (words.length >= 2) {
                initials = words[0].charAt(0) + words[1].charAt(0);
            } else {
                initials = artist.substring(0, 2);
            }
        } else {
            initials = '♪'; // Símbolo musical si no hay artista
        }
        
        ctx.fillText(initials.toUpperCase(), 150, 150);
        
        // Agregar texto pequeño con el género si existe
        if (title && title !== 'Track') {
            ctx.shadowBlur = 5;
            ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI`, sans-serif';
            ctx.globalAlpha = 0.8;
            
            // Truncar título si es muy largo
            const maxLength = 25;
            const displayTitle = title.length > maxLength ? 
                                title.substring(0, maxLength) + '...' : 
                                title;
            
            ctx.fillText(displayTitle, 150, 250);
        }
        
        return canvas.toDataURL('image/jpeg', 0.9);
    }
    
    /**
     * Verifica si un archivo existe (para Electron)
     * @param {string} path - Ruta del archivo
     * @returns {boolean} true si existe
     */
    fileExists(path) {
        if (this.isElectron && window.require) {
            try {
                const fs = window.require('fs');
                return fs.existsSync(path);
            } catch (error) {
                console.warn('No se pudo verificar archivo:', error);
            }
        }
        // En web, asumir que existe
        return true;
    }
    
    /**
     * Precarga la imagen por defecto
     */
    preloadDefaultImage() {
        const img = new Image();
        img.onload = () => {
            console.log('✅ Imagen por defecto cargada');
        };
        img.onerror = () => {
            console.warn('⚠️ No se pudo cargar imagen por defecto, usando placeholders generados');
        };
        img.src = this.defaultArtwork;
    }
    
    /**
     * Limpia el cache de placeholders
     */
    clearCache() {
        this.placeholderCache.clear();
        console.log('🗑️ Cache de placeholders limpiado');
    }
}

// Crear instancia singleton
const artworkHelper = new ArtworkHelper();

// Precargar imagen por defecto
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        artworkHelper.preloadDefaultImage();
    });
}

// Exportar para Node.js o usar en browser
if (typeof module !== 'undefined` && module.exports) {
    module.exports = ArtworkHelper;
}
// EOF