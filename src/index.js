/**
 * 🎯 MAIN APPLICATION ENTRY POINT
 * Music Analyzer Pro v2.0.0
 */

// Global application state
window.MusicAnalyzer = {
    version: '2.0.0',
    modules: {},
    initialized: false,
    config: null
};

/**
 * Initialize all application modules
 */
async function initializeApp() {
    console.log('🚀 Initializing Music Analyzer Pro v2.0.0');
    
    try {
        // 1. Load Configuration
        if (window.APP_CONFIG) {
            window.MusicAnalyzer.config = window.APP_CONFIG;
            console.log('✅ Configuration loaded');
        }

        // 2. Initialize Error Tracking
        if (window.errorTracker) {
            window.MusicAnalyzer.modules.errorTracker = window.errorTracker;
            console.log('✅ Error tracking initialized');
        }

        // 3. Initialize Logger
        if (window.logger) {
            window.MusicAnalyzer.modules.logger = window.logger;
            logger.info('Application starting', {
                version: window.MusicAnalyzer.version,
                modules: Object.keys(window.MusicAnalyzer.modules)
            });
        }

        // 4. Initialize Performance Monitor
        if (window.performanceMonitor) {
            window.MusicAnalyzer.modules.performanceMonitor = window.performanceMonitor;
            console.log('✅ Performance monitoring initialized');
        }

        // 5. Initialize Performance Optimizer
        if (window.perfOptimizer) {
            window.MusicAnalyzer.modules.perfOptimizer = window.perfOptimizer;
            setupLazyLoading();
            console.log('✅ Performance optimizer initialized');
        }

        // 6. Initialize Database Optimizer
        if (window.dbOptimizer) {
            window.MusicAnalyzer.modules.dbOptimizer = window.dbOptimizer;
            await setupDatabaseOptimizations();
            console.log('✅ Database optimizer initialized');
        }

        // 7. Initialize Theme Controller
        if (window.themeController) {
            window.MusicAnalyzer.modules.themeController = window.themeController;
            console.log('✅ Theme controller initialized');
        }

        // 8. Register Service Worker
        if ('serviceWorker' in navigator && window.APP_CONFIG?.features?.serviceWorker) {
            await registerServiceWorker();
        }

        // 9. Initialize Virtual Scroller
        await initializeVirtualScroller();

        // 10. Setup UI Event Handlers
        setupEventHandlers();

        // 11. Load initial data
        await loadInitialData();

        // Mark as initialized
        window.MusicAnalyzer.initialized = true;
        
        // Log success
        const loadTime = performance.now();
        console.log(`✅ Music Analyzer Pro initialized in ${loadTime.toFixed(2)}ms`);
        
        // Report to performance monitor
        if (window.performanceMonitor) {
            performanceMonitor.recordMetric('app-init-time', loadTime, 'ms');
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        
        if (window.errorTracker) {
            errorTracker.captureError({
                type: 'initialization_error',
                message: error.message,
                stack: error.stack
            });
        }
        
        return false;
    }
}

/**
 * Register Service Worker for PWA support
 */
async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
        });
        
        console.log('✅ Service Worker registered');
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                    // New service worker activated
                    showUpdateNotification();
                }
            });
        });
        
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Show update notification
 */
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <span>🎉 New version available!</span>
            <button onclick="window.location.reload()">Refresh</button>
        </div>
    ";
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
}

/**
 * Setup lazy loading for images
 */
function setupLazyLoading() {
    if (!window.perfOptimizer) return;
    
    // Setup lazy loading for artwork images
    perfOptimizer.lazyLoad('img[data-src]', {
        rootMargin: '100px',
        onLoad: (img) => {
            img.classList.add('loaded');
        },
        onError: (img) => {
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBBcnR3b3JrPC90ZXh0Pjwvc3ZnPg==';
        }
    });
}

/**
 * Setup database optimizations
 */
async function setupDatabaseOptimizations() {
    if (!window.dbOptimizer || !window.ipcRenderer) return;
    
    // Intercept IPC calls for optimization
    const originalInvoke = window.ipcRenderer.invoke;
    window.ipcRenderer.invoke = async (channel, ...args) => {
        const start = performance.now();
        
        // Try to get from cache first
        const cacheKey = `${channel}:${JSON.stringify(args)}`;
        const cached = dbOptimizer.getFromCache(cacheKey);
        
        if (cached) {
            const duration = performance.now() - start;
            if (window.logger) {
                logger.debug(`Cache hit for ${channel}: ${duration.toFixed(2)}ms`);
            }
            return cached;
        }
        
        // Execute query
        const result = await originalInvoke.call(window.ipcRenderer, channel, ...args);
        
        // Cache the result
        if (channel.includes('search') || channel.includes('get')) {
            dbOptimizer.addToCache(cacheKey, result);
        }
        
        const duration = performance.now() - start;
        if (window.logger) {
            logger.debug(`IPC call ${channel}: ${duration.toFixed(2)}ms`);
        }
        
        return result;
    };
}

/**
 * Initialize Virtual Scroller for large datasets
 */
async function initializeVirtualScroller() {
    const container = document.querySelector('#tracks-container');
    
    // Virtual Scroller - LISTO pero deshabilitado por seguridad
    const ENABLE_VIRTUAL_SCROLLER = false; // Activar cuando se necesite para > 1000 items
    const MAX_ITEMS_WITHOUT_VIRTUAL = 500; // Límite seguro sin virtual scroller
    
    if (ENABLE_VIRTUAL_SCROLLER && container && window.VirtualScroller) {
        try {
            window.MusicAnalyzer.virtualScroller = new VirtualScroller({
                container: container,
                itemHeight: 100,
                bufferSize: 5,
                renderItem: (item, index) => {
                    return createTrackElement(item, index);
                },
                loadMore: async () => {
                    // Load more tracks when scrolling near bottom
                    await loadMoreTracks();
                },
                debug: window.APP_CONFIG?.dev?.debug
            });
            
            console.log('✅ Virtual scroller initialized');
        } catch (error) {
            console.error('Error inicializando Virtual Scroller:', error);
        }
    } else {
        console.log('ℹ️ Virtual Scroller deshabilitado, usando renderizado normal');
    }
}

/**
 * Create track element for virtual scroller
 */
function createTrackElement(track, index) {
    const div = document.createElement('div');
    div.className = 'track-card animate-fadeIn';
    div.dataset.trackId = track.id;
    
    div.innerHTML = `
        <div class="track-artwork">
            <img data-src="${track.artwork_url || ''}" 
                 alt="${track.title}" 
                 loading="lazy">
        </div>
        <div class="track-info">
            <div class="track-title">${track.title || 'Unknown'}</div>
            <div class="track-artist">${track.artist || 'Unknown Artist'}</div>
            <div class="track-meta">
                ${track.genre ? `<span class="genre">${track.genre}</span>` : ''}
                ${track.bpm ? `<span class="bpm">${track.bpm} BPM</span>` : ''}
            </div>
        </div>
    ';
    
    // Setup lazy loading for this image
    if (window.perfOptimizer) {
        const img = div.querySelector('img[data-src]');
        if (img && img.dataset.src) {
            perfOptimizer.lazyLoad(img);
        }
    }
    
    return div;
}

/**
 * Setup UI event handlers
 */
function setupEventHandlers() {
    // Search input with debouncing (compatible con ambos IDs)
    const searchInput = document.querySelector('#searchInput') || document.querySelector('#search-input');
    if (searchInput && window.perfOptimizer) {
        const debouncedSearch = perfOptimizer.debounce(handleSearch, 300);
        searchInput.addEventListener('input', debouncedSearch);
    }
    
    // Filter changes
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', handleFilterChange);
    });
    
    // View mode toggle
    const viewToggle = document.querySelector('#view-toggle');
    if (viewToggle) {
        viewToggle.addEventListener('click', toggleViewMode);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle search
 */
async function handleSearch(event) {
    const query = event.target.value.trim();
    
    if (query.length < 2 && query.length > 0) return;
    
    try {
        const results = await searchTracks(query);
        updateTrackDisplay(results);
    } catch (error) {
        console.error('Search failed:', error);
    }
}

/**
 * Handle filter changes
 */
async function handleFilterChange(event) {
    const filters = getActiveFilters();
    
    try {
        const results = await filterTracks(filters);
        updateTrackDisplay(results);
    } catch (error) {
        console.error('Filter failed:', error);
    }
}

/**
 * Get active filters
 */
function getActiveFilters() {
    const filters = {};
    
    document.querySelectorAll('.filter-select').forEach(select => {
        if (select.value) {
            filters[select.dataset.filter] = select.value;
        }
    });
    
    return filters;
}

/**
 * Toggle view mode
 */
function toggleViewMode() {
    const container = document.querySelector('#tracks-container');
    if (!container) return;
    
    const currentMode = container.dataset.view || 'grid';
    const newMode = currentMode === 'grid' ? 'list' : 'grid';
    
    container.dataset.view = newMode;
    container.className = `tracks-${newMode}`;
    
    // Re-render with new mode
    if (window.MusicAnalyzer.virtualScroller) {
        window.MusicAnalyzer.virtualScroller.refresh();
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
    // Focus search: /
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        const searchInput = document.querySelector('#searchInput') || document.querySelector('#search-input');
        searchInput?.focus();
    }
    
    // Clear search: Escape
    if (event.key === 'Escape') {
        const searchInput = document.querySelector('#searchInput') || document.querySelector('#search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    }
    
    // Toggle theme: Ctrl/Cmd + Shift + L
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        if (window.themeController) {
            themeController.toggleTheme();
        }
    }
}

/**
 * Load initial data
 */
async function loadInitialData() {
    try {
        showLoadingState();
        
        // Load tracks with artwork
        const tracks = await loadTracksWithArtwork();
        
        // Update display
        updateTrackDisplay(tracks);
        
        // Load filter options
        await loadFilterOptions();
        
        hideLoadingState();
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showErrorState(error.message);
    }
}

/**
 * Load tracks with artwork
 */
async function loadTracksWithArtwork() {
    if (!window.ipcRenderer) {
        // Fallback for testing
        return generateMockTracks(100);
    }
    
    try {
        const tracks = await window.ipcRenderer.invoke('get-files-with-cached-artwork');
        return tracks || [];
    } catch (error) {
        console.error('Failed to load tracks:', error);
        return [];
    }
}

/**
 * Search tracks
 */
async function searchTracks(query) {
    if (!window.ipcRenderer) {
        // Fallback for testing
        return generateMockTracks(50).filter(t => 
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.artist.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    try {
        const results = await window.ipcRenderer.invoke('search-tracks', {
            query,
            filters: getActiveFilters()
        });
        return results || [];
    } catch (error) {
        console.error('Search failed:', error);
        return [];
    }
}

/**
 * Filter tracks
 */
async function filterTracks(filters) {
    if (!window.ipcRenderer) {
        // Fallback for testing
        return generateMockTracks(50);
    }
    
    try {
        const results = await window.ipcRenderer.invoke('search-tracks', {
            query: '',
            filters
        });
        return results || [];
    } catch (error) {
        console.error('Filter failed:', error);
        return [];
    }
}

/**
 * Load filter options
 */
async function loadFilterOptions() {
    if (!window.ipcRenderer) {
        // Fallback for testing
        updateFilterOptions({
            genres: ['Rock', 'Pop', 'Jazz', 'Electronic'],
            moods: ['Happy', 'Sad', 'Energetic', 'Calm']
        });
        return;
    }
    
    try {
        const options = await window.ipcRenderer.invoke('get-filter-options');
        updateFilterOptions(options);
    } catch (error) {
        console.error('Failed to load filter options:', error);
    }
}

/**
 * Update filter options in UI
 */
function updateFilterOptions(options) {
    // Update genre filter (compatible con ambos IDs)
    const genreSelect = document.querySelector('#genreFilter') || document.querySelector('#filter-genre');
    if (genreSelect && options.genres) {
        genreSelect.innerHTML = '<option value="">Todos los géneros</option>' +
            options.genres.map(g => `<option value="${g}">${g}</option>").join('');
    }
    
    // Update mood filter (compatible con ambos IDs)
    const moodSelect = document.querySelector('#moodFilter') || document.querySelector('#filter-mood');
    if (moodSelect && options.moods) {
        moodSelect.innerHTML = '<option value="">Todos los moods</option>' +
            options.moods.map(m => `<option value="${m}">${m}</option>").join('');
    }
}

/**
 * Update track display
 */
function updateTrackDisplay(tracks) {
    const container = document.querySelector('#tracks-container');
    if (!container) {
        console.error('No se encontró #tracks-container');
        return;
    }
    
    console.log(`Mostrando ${tracks.length} tracks`);
    
    // Update stats
    updateStats(tracks);
    
    // Ocultar loading
    hideLoadingState();
    
    // Use virtual scroller if available
    if (window.MusicAnalyzer?.virtualScroller) {
        console.log('Usando Virtual Scroller');
        window.MusicAnalyzer.virtualScroller.setItems(tracks);
    } else {
        // Fallback to regular rendering
        console.log('Usando renderizado normal');
        renderTracks(tracks);
    }
}

/**
 * Render tracks (fallback when virtual scroller not available)
 */
function renderTracks(tracks) {
    const container = document.querySelector('#tracks-container');
    if (!container) {
        console.error('Container #tracks-container no encontrado');
        return;
    }
    
    // Limpiar el contenedor
    container.innerHTML = '';
    
    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div class="no-results">No se encontraron archivos</div>';
        return;
    }
    
    // Limit to prevent performance issues
    const limitedTracks = tracks.slice(0, 100);
    console.log(`Renderizando ${limitedTracks.length} de ${tracks.length} tracks`);
    
    // Usar el sistema de tarjetas existente que ya funciona
    container.className = 'container'; // Cambiar clase para usar el estilo existente
    
    container.innerHTML = limitedTracks.map((track, index) => {
        // Formatear la ruta de artwork correctamente
        let artworkUrl = track.artwork_url || track.artwork_path || '';
        if (artworkUrl && !artworkUrl.startsWith('file://') && !artworkUrl.startsWith('data:')) {
            artworkUrl = `file://${artworkUrl}`;
        }
        
        return `
            <div class="card" data-track-id="${track.id || index}">
                <div class="card-image">
                    ${artworkUrl ? 
                        `<img src="${artworkUrl}" alt="${track.title || 'Unknown'}" style="width: 100%; height: 100%; object-fit: cover;">` :
                        '🎵'
                    }
                </div>
                <div class="card-content">
                    <div class="title">${track.title || track.file_name || 'Unknown'}</div>
                    <div class="artist">${track.artist || 'Unknown Artist'}</div>
                    ${track.album ? `<div class="album">${track.album}</div>` : ''}
                    <div class="meta">
                        ${track.genre || track.LLM_GENRE ? `<span class="genre-tag">${track.genre || track.LLM_GENRE}</span>` : ''}
                        ${track.AI_MOOD || track.LLM_MOOD ? `<span class="mood-tag">${track.AI_MOOD || track.LLM_MOOD}</span>` : ''}
                        ${track.AI_BPM ? `<span class="bpm-tag">${track.AI_BPM} BPM</span>` : ''}
                    </div>
                </div>
            </div>
        ';
    }).join('');
    
    console.log('✅ Tracks renderizados');
}

/**
 * Update statistics
 */
function updateStats(tracks) {
    const statsElement = document.querySelector('#stats');
    if (!statsElement) return;
    
    const stats = {
        total: tracks.length,
        withArtwork: tracks.filter(t => t.artwork_url).length,
        analyzed: tracks.filter(t => t.ai_analyzed).length
    };
    
    statsElement.innerHTML = `
        <span>Total: ${stats.total}</span>
        <span>With Artwork: ${stats.withArtwork}</span>
        <span>Analyzed: ${stats.analyzed}</span>
    `;
}

/**
 * Load more tracks (for infinite scrolling)
 */
async function loadMoreTracks() {
    // Implement pagination logic
    console.log('Loading more tracks...');
}

/**
 * Show loading state
 */
function showLoadingState() {
    const container = document.querySelector('#tracks-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner animate-spin"></div>
            <p>Loading your music library...</p>
        </div>
    ";
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    // Remover el nuevo loading state
    const loadingState = document.querySelector('.loading-state');
    if (loadingState) {
        loadingState.remove();
    }
    
    // Remover el loading antiguo también
    const oldLoading = document.querySelector('.loading');
    if (oldLoading) {
        oldLoading.remove();
    }
}

/**
 * Show error state
 */
function showErrorState(message) {
    const container = document.querySelector('#tracks-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">❌</div>
            <p>${message}</p>
            <button onclick="window.location.reload()">Retry</button>
        </div>
    ";
}

/**
 * Generate mock tracks for testing
 */
function generateMockTracks(count) {
    const tracks = [];
    const genres = ['Rock', 'Pop', 'Jazz', 'Electronic', 'Classical'];
    const moods = ['Happy', 'Sad', 'Energetic', 'Calm', 'Melancholic'];
    
    for (let i = 0; i < count; i++) {
        tracks.push({
            id: i + 1,
            title: `Track ${i + 1}`,
            artist: `Artist ${Math.floor(i / 10) + 1}`,
            album: `Album ${Math.floor(i / 20) + 1}`,
            genre: genres[i % genres.length],
            mood: moods[i % moods.length],
            bpm: 60 + Math.floor(Math.random() * 140),
            artwork_url: `artwork-cache/${(i % 100) + 1}.jpg`,
            ai_analyzed: Math.random() > 0.5
        });
    }
    
    return tracks;
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeApp,
        MusicAnalyzer: window.MusicAnalyzer
    };
}