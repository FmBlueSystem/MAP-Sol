// MAP - Music Analyzer Pro
// Production Application Script with All Features

// Media Helper Functions
function getArtworkPath(file) {
    if (!file) {
        return 'image.png';
    }

    // Check if artwork_path exists
    if (file.artwork_path) {
        // If it's a relative path to artwork-cache
        if (file.artwork_path.startsWith('artwork-cache/')) {
            return file.artwork_path;
        }
        // If it`s already a full path or data URL
        return file.artwork_path;
    }

    // Try to use extracted artwork in artwork-cache
    if (file.id) {
        return `artwork-cache/${file.id}.jpg`;
    }

    // Fallback to default
    return 'image.png';
}

function handleImageError(img, track) {
    logWarn('Image failed to load:', img.src);

    // Try alternative paths
    if (track && track.id && !img.dataset.fallback) {
        img.dataset.fallback = 'true';
        img.src = `artwork-cache/${track.id}.jpg`;
    } else {
        // Final fallback
        img.src = 'image.png';
    }
}

// Global State Management
const AppState = {
    // Data
    allFiles: [],
    currentFiles: [],
    playlists: [],

    // UI State
    currentView: 'cards',
    selectedTracks: new Set(),

    // Player State
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isShuffled: false,
    repeatMode: 'off', // off, one, all

    // Audio
    howl: null,
    audioContext: null,
    analyser: null,
    volume: 0.8,

    // Panels
    audioPanelVisible: false,
    playlistPanelVisible: false,
    queuePanelVisible: false
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.electronAPI) {
        showError('Unable to connect to the music database. Please restart the application.');
        return;
    }

    try {
        await initialize();
    } catch (error) {
        logError('❌ Initialization error:', error);
        showError('Failed to initialize application: ' + error.message);
    }
});

async function initialize() {
    // Load data
    await loadFiles();
    await loadPlaylists();
    await loadFilterOptions();

    // Setup UI
    setupEventListeners();
    setupKeyboardShortcuts();
    setupAudioContext();

    // Restore preferences
    restoreUserPreferences();

    // Show initial view
    renderView();
    updateStats();
}

// Data Loading Functions
async function loadFiles() {
    const content = document.getElementById('content');
    content.innerHTML =
        '<div class="loading"><div class="spinner"></div><p>Loading your music library...</p></div>';

    try {
        logInfo('🔄 Starting to load files...');

        // Add timeout to prevent infinite waiting
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout loading files')), 5000)
        );

        const invokePromise = window.electronAPI.invoke('get-files-with-cached-artwork');

        // Race between the actual call and timeout
        const response = await Promise.race([invokePromise, timeoutPromise]);
        logDebug('📦 Response received:', response);

        if (response && response.success && response.files) {
            AppState.allFiles = response.files;
            logInfo(`✅ Loaded ${AppState.allFiles.length} files from response.files`);

            // Si no hay archivos, mostrar mensaje apropiado
            if (AppState.allFiles.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 50px; color: #666;">
                        <h2>No hay archivos en la biblioteca</h2>
                        <p>La base de datos está vacía. Usa el botón "Analyze Music` para agregar música</p>
                    </div>
                `;
                return;
            }
        } else if (response && Array.isArray(response)) {
            AppState.allFiles = response;
            logInfo(`✅ Loaded ${AppState.allFiles.length} files (direct array)`);
        } else {
            AppState.allFiles = [];
            logError('❌ No files in response. Response structure:', response);
            // Show error message to user
            content.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #ff6b6b;">
                    <h2>Error loading music library</h2>
                    <p>Unable to load files from database</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">Retry</button>
                </div>
            ";
            return;
        }

        AppState.currentFiles = [...AppState.allFiles];
        logDebug('📊 Current files set:', AppState.currentFiles.length);

        // Mostrar los archivos cargados
        displayFiles();
    } catch (error) {
        logError('❌ Error loading files:', error);
        content.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #ff6b6b;">
                <h2>Error loading music library</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">Retry</button>
            </div>
        ";
    }
}

// Función para mostrar los archivos - OPTIMIZADA con Virtual Scrolling
function displayFiles() {
    const content = document.getElementById('content');

    if (!AppState.currentFiles || AppState.currentFiles.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666;">
                <h2>No hay archivos en la biblioteca</h2>
                <p>Usa el botón "Analyze Music" para agregar música</p>
            </div>
        ";
        return;
    }

    // Limpiar el loading
    content.classList.remove('loading');

    // NUEVO: Detectar si necesitamos Virtual Scrolling (más de 100 items)
    const USE_VIRTUAL_SCROLLING = AppState.currentFiles.length > 100;

    if (USE_VIRTUAL_SCROLLING && window.VirtualScroller) {
        logInfo(`🚀 Using Virtual Scrolling for ${AppState.currentFiles.length} items`);

        // Destruir instancia previa si existe
        if (AppState.virtualScroller) {
            AppState.virtualScroller.destroy();
        }

        // Crear nueva instancia de Virtual Scroller
        AppState.virtualScroller = new VirtualScroller({
            container: content,
            items: AppState.currentFiles,
            viewType: AppState.currentView || 'cards',
            itemHeight: AppState.currentView === 'cards' ? 280 : 50,
            buffer: 5,
            columns: 'auto'
        });

        // Escuchar estadísticas de performance
        content.addEventListener('virtual-scroll-stats', e => {
            logDebug('📊 Virtual Scroll Performance:', e.detail);
        });
    } else {
        // Fallback: Renderizado tradicional para bibliotecas pequeñas
        logDebug(`📄 Using traditional rendering for ${AppState.currentFiles.length} items`);

        let html = '<div class="files-grid">';

        AppState.currentFiles.forEach((file, index) => {
            const title = file.title || file.file_name || 'Sin título';
            const artist = file.artist || 'Artista desconocido';
            const album = file.album || '';
            const artwork = file.artwork_url || 'image.png';

            html += `
                <div class="file-card" data-index="${index}">
                    <div class="file-artwork" style="background-image: url('${artwork}')">
                        ${!file.artwork_url ? '<span style="font-size: 48px;">🎵</span>' : ''}
                    </div>
                    <div class="file-info">
                        <div class="file-title">${title}</div>
                        <div class="file-artist`>${artist}</div>
                        ${album ? `<div class="file-album">${album}</div>` : ''}
                    </div>
                    <div class="file-actions">
                        <button onclick="playFile(${index})" class="play-btn">▶</button>
                    </div>
                </div>
            ";
        });

        html += '</div>';
        content.innerHTML = html;
    }

    // Hacer disponibles los archivos globalmente para Enhanced View
    window.allFiles = AppState.currentFiles;
}

async function loadPlaylists() {
    try {
        const playlists = await window.electronAPI.invoke('get-playlists');
        AppState.playlists = playlists || [];
        renderPlaylists();
    } catch (error) {
        logError('Error loading playlists:', error);
    }
}

async function loadFilterOptions() {
    try {
        const filters = await window.electronAPI.invoke('get-filter-options');

        // Populate genre filter
        const genreSelect = document.getElementById('genreFilter');
        if (filters.genres) {
            filters.genres.forEach(genre => {
                if (genre) {
                    const option = document.createElement('option');
                    option.value = genre;
                    option.textContent = genre;
                    genreSelect.appendChild(option);
                }
            });
        }

        // Populate mood filter
        const moodSelect = document.getElementById('moodFilter');
        if (filters.moods) {
            filters.moods.forEach(mood => {
                if (mood) {
                    const option = document.createElement('option');
                    option.value = mood;
                    option.textContent = mood;
                    moodSelect.appendChild(option);
                }
            });
        }
    } catch (error) {
        logError('Error loading filter options:', error);
    }
}

// View Rendering Functions
function renderView() {
    const content = document.getElementById('content');
    const filesToShow = AppState.currentFiles.slice(0, 200); // Show first 200 for performance

    switch (AppState.currentView) {
        case 'cards':
            renderCardsView(content, filesToShow);
            break;
        case 'table':
            renderTableView(content, filesToShow);
            break;
        case 'compact':
            renderCompactView(content, filesToShow);
            break;
    }

    setupTrackListeners();
}

function renderCardsView(container, files) {
    container.innerHTML = `
        <div class="cards-grid`>
            ${files.map(file => createCardElement(file)).join('')}
        </div>
    ';
}

function createCardElement(file) {
    const isSelected = AppState.selectedTracks.has(file.id);
    const isPlaying = AppState.currentTrack?.id === file.id;

    return `
        <div class="track-card ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}" 
             data-id="${file.id}"
             data-file-path="${file.file_path || ''}">
            <img src="${getArtworkPath(file)}" 
                 class="track-artwork"
                 data-track-id="${file.id}"
                 onerror="handleImageError(this, ${JSON.stringify(file).replace(/"/g, '&quot;')})"
                 alt="${file.title || file.file_name || 'Unknown'}"
                 loading="lazy">
            <div class="track-info">
                <div class="track-title">${file.title || file.file_name || 'Unknown'}</div>
                <div class="track-artist">${file.artist || 'Unknown Artist'}</div>
                <div class="track-meta">
                    <span>${file.genre || file.LLM_GENRE || ''}</span>
                    <span>${file.AI_BPM ? file.AI_BPM + ' BPM' : ''}</span>
                </div>
            </div>
        </div>
    ';
}

function renderTableView(container, files) {
    container.innerHTML = `
        <div class="table-view" style="display: block;">
            <table>
                <thead>
                    <tr>
                        <th onclick="sortBy('title')">Title ↕</th>
                        <th onclick="sortBy('artist')">Artist ↕</th>
                        <th onclick="sortBy('album')">Album ↕</th>
                        <th onclick="sortBy('genre')">Genre ↕</th>
                        <th onclick="sortBy('bpm')">BPM ↕</th>
                        <th onclick="sortBy('key')">Key ↕</th>
                        <th onclick="sortBy('energy')`>Energy ↕</th>
                    </tr>
                </thead>
                <tbody>
                    ${files.map(file => createTableRow(file)).join('')}
                </tbody>
            </table>
        </div>
    ';
}

function createTableRow(file) {
    const isSelected = AppState.selectedTracks.has(file.id);
    const isPlaying = AppState.currentTrack?.id === file.id;

    return `
        <tr class="track-row ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}" 
            data-id="${file.id}"
            data-file-path="${file.file_path || ''}">
            <td>${file.title || file.file_name || 'Unknown'}</td>
            <td>${file.artist || 'Unknown'}</td>
            <td>${file.album || '-'}</td>
            <td>${file.genre || file.LLM_GENRE || '-'}</td>
            <td>${file.AI_BPM || '-'}</td>
            <td>${file.AI_KEY || '-'}</td>
            <td>${file.AI_ENERGY ? Math.round(file.AI_ENERGY * 100) + '%' : '-'}</td>
        </tr>
    ';
}

function renderCompactView(container, files) {
    container.innerHTML = `
        <div class="compact-view" style="display: block;`>
            ${files.map(file => createCompactItem(file)).join('')}
        </div>
    ';
}

function createCompactItem(file) {
    const isSelected = AppState.selectedTracks.has(file.id);
    const isPlaying = AppState.currentTrack?.id === file.id;

    return `
        <div class="compact-item ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}" 
             data-id="${file.id}"
             data-file-path="${file.file_path || ''}">
            <img class="compact-artwork track-artwork" 
                 src="${getArtworkPath(file)}" 
                 data-track-id="${file.id}"
                 onerror="handleImageError(this, ${JSON.stringify(file).replace(/"/g, '&quot;')})"
                 alt="${file.title || file.file_name || ''}"
                 loading="lazy">
            <div class="compact-info">
                <div class="compact-title">${file.title || file.file_name || 'Unknown'}</div>
                <div class="compact-artist">${file.artist || 'Unknown Artist'}</div>
            </div>
            <div class="compact-meta">
                <span>${file.genre || ''}</span>
                <span>${file.AI_BPM ? file.AI_BPM + ' BPM' : ''}</span>
            </div>
        </div>
    ';
}

// Track Interaction Setup
function setupTrackListeners() {
    document.querySelectorAll('.track-card, .track-row, .compact-item').forEach(element => {
        // Click to select
        element.addEventListener('click', handleTrackClick);

        // Double click to play
        element.addEventListener('dblclick', handleTrackDoubleClick);

        // Right click for context menu
        element.addEventListener('contextmenu', handleTrackContextMenu);
    });
}

function handleTrackClick(e) {
    const element = e.currentTarget;
    const id = parseInt(element.dataset.id);

    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Single click - clear selection and select this
        AppState.selectedTracks.clear();
        document.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }

    if (e.shiftKey && AppState.selectedTracks.size > 0) {
        // Shift click - select range
        const lastSelected = Array.from(AppState.selectedTracks).pop();
        const startIndex = AppState.currentFiles.findIndex(f => f.id === lastSelected);
        const endIndex = AppState.currentFiles.findIndex(f => f.id === id);

        const [start, end] =
            startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

        for (let i = start; i <= end; i++) {
            AppState.selectedTracks.add(AppState.currentFiles[i].id);
        }

        document.querySelectorAll('.track-card, .track-row, .compact-item').forEach(el => {
            if (AppState.selectedTracks.has(parseInt(el.dataset.id))) {
                el.classList.add('selected');
            }
        });
    } else {
        // Toggle selection
        if (AppState.selectedTracks.has(id)) {
            AppState.selectedTracks.delete(id);
            element.classList.remove('selected');
        } else {
            AppState.selectedTracks.add(id);
            element.classList.add('selected');
        }
    }

    updateStats();
}

function handleTrackDoubleClick(e) {
    const element = e.currentTarget;
    const track = AppState.allFiles.find(f => f.id === parseInt(element.dataset.id));
    if (track) {
        playTrack(track);
    }
}

function handleTrackContextMenu(e) {
    e.preventDefault();
    const element = e.currentTarget;
    const trackId = parseInt(element.dataset.id);
    const track = AppState.allFiles.find(f => f.id === trackId);

    if (track) {
        showContextMenu(e.pageX, e.pageY, track);
    }
}

// Audio Playback Functions
function playTrack(track) {
    if (!track || !track.file_path) {
        showToast('Cannot play track: File path missing', 'error');
        return;
    }

    AppState.currentTrack = track;

    // Stop current track
    if (AppState.howl) {
        AppState.howl.stop();
        AppState.howl.unload();
    }

    // Create new Howl instance
    AppState.howl = new Howl({
        src: [track.file_path],
        html5: true,
        volume: AppState.volume,
        onplay: () => {
            AppState.isPlaying = true;
            updatePlayerUI();
            requestAnimationFrame(updateProgress);

            // Connect to Web Audio API for VU meters
            connectAudioAnalyser();
        },
        onpause: () => {
            AppState.isPlaying = false;
            updatePlayerUI();
        },
        onstop: () => {
            AppState.isPlaying = false;
            updatePlayerUI();
        },
        onend: () => {
            handleTrackEnd();
        },
        onloaderror: (id, error) => {
            logError('Load error:', error);
            showToast('Failed to load track', 'error');
        },
        onplayerror: (id, error) => {
            logError('Play error:', error);
            showToast('Failed to play track', 'error');
        }
    });

    AppState.howl.play();

    // Update queue if needed
    if (!AppState.queue.find(t => t.id === track.id)) {
        AppState.queue.push(track);
        AppState.queueIndex = AppState.queue.length - 1;
    } else {
        AppState.queueIndex = AppState.queue.findIndex(t => t.id === track.id);
    }

    // Show player bar
    document.getElementById('playerBar').classList.add('active');

    updatePlayerUI();
    updateQueueUI();
    highlightPlayingTrack();
}

function togglePlayPause() {
    if (!AppState.howl) {
        // No track loaded, play first selected or first track
        const firstSelected = AppState.selectedTracks.values().next().value;
        const track = firstSelected
            ? AppState.allFiles.find(f => f.id === firstSelected)
            : AppState.currentFiles[0];
        if (track) {
            playTrack(track);
        }
    } else {
        if (AppState.isPlaying) {
            AppState.howl.pause();
        } else {
            AppState.howl.play();
        }
    }
}

function playNext() {
    let nextTrack = null;

    if (AppState.isShuffled) {
        // Random track
        const availableTracks = AppState.currentFiles.filter(
            t => t.id !== AppState.currentTrack?.id
        );
        if (availableTracks.length > 0) {
            nextTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        }
    } else if (AppState.queue.length > 0 && AppState.queueIndex < AppState.queue.length - 1) {
        // Next in queue
        AppState.queueIndex++;
        nextTrack = AppState.queue[AppState.queueIndex];
    } else if (AppState.currentFiles.length > 0) {
        // Next in list
        const currentIndex = AppState.currentFiles.findIndex(
            f => f.id === AppState.currentTrack?.id
        );
        const nextIndex = (currentIndex + 1) % AppState.currentFiles.length;
        nextTrack = AppState.currentFiles[nextIndex];
    }

    if (nextTrack) {
        playTrack(nextTrack);
    }
}

function playPrevious() {
    let prevTrack = null;

    if (AppState.queue.length > 0 && AppState.queueIndex > 0) {
        // Previous in queue
        AppState.queueIndex--;
        prevTrack = AppState.queue[AppState.queueIndex];
    } else if (AppState.currentFiles.length > 0) {
        // Previous in list
        const currentIndex = AppState.currentFiles.findIndex(
            f => f.id === AppState.currentTrack?.id
        );
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : AppState.currentFiles.length - 1;
        prevTrack = AppState.currentFiles[prevIndex];
    }

    if (prevTrack) {
        playTrack(prevTrack);
    }
}

function handleTrackEnd() {
    if (AppState.repeatMode === 'one') {
        // Repeat current track
        AppState.howl.play();
    } else if (
        AppState.repeatMode === 'all' ||
        AppState.queueIndex < AppState.queue.length - 1 ||
        AppState.isShuffled
    ) {
        // Play next
        playNext();
    } else {
        // Stop playing
        AppState.isPlaying = false;
        updatePlayerUI();
    }
}

function toggleShuffle() {
    AppState.isShuffled = !AppState.isShuffled;
    const btn = document.getElementById('shuffleBtn');
    btn.style.opacity = AppState.isShuffled ? '1' : '0.5';
    showToast(AppState.isShuffled ? 'Shuffle enabled' : 'Shuffle disabled', 'info');
}

function toggleRepeat() {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(AppState.repeatMode);
    AppState.repeatMode = modes[(currentIndex + 1) % modes.length];

    const btn = document.getElementById('repeatBtn');
    if (AppState.repeatMode === 'off') {
        btn.style.opacity = '0.5';
        btn.textContent = '🔁';
    } else if (AppState.repeatMode === 'all') {
        btn.style.opacity = '1';
        btn.textContent = '🔁';
    } else {
        btn.style.opacity = '1';
        btn.textContent = '🔂';
    }

    showToast(`Repeat: ${AppState.repeatMode}`, 'info');
}

// UI Update Functions
function updatePlayerUI() {
    const playBtn = document.getElementById('playPauseBtn');
    playBtn.innerHTML = AppState.isPlaying ? '⏸' : '▶';

    // Update panel play button
    const panelPlayBtn = document.getElementById('playBtnPanel');
    if (panelPlayBtn) {
        const playIcon = panelPlayBtn.querySelector('.play-icon');
        const pauseIcon = panelPlayBtn.querySelector('.pause-icon');
        if (AppState.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    if (AppState.currentTrack) {
        // Update bottom player bar
        document.getElementById('playerTitle').textContent =
            AppState.currentTrack.title || AppState.currentTrack.file_name || 'Unknown';
        document.getElementById('playerArtist').textContent =
            AppState.currentTrack.artist || 'Unknown Artist';
        const playerArtwork = document.getElementById('playerArtwork');
        if (playerArtwork) {
            playerArtwork.src = getArtworkPath(AppState.currentTrack);
            playerArtwork.onerror = () => handleImageError(playerArtwork, AppState.currentTrack);
        }

        // Update audio panel info - Check if elements exist
        const trackTitleMinimal = document.getElementById('track-title-minimal');
        if (trackTitleMinimal) {
            trackTitleMinimal.textContent =
                AppState.currentTrack.title || AppState.currentTrack.file_name || 'Unknown';
        }

        const trackArtistMinimal = document.getElementById('track-artist-minimal');
        if (trackArtistMinimal) {
            trackArtistMinimal.textContent = AppState.currentTrack.artist || 'Unknown Artist';
        }

        // Update expanded panel info if they exist
        const panelTitle = document.getElementById('panel-title');
        if (panelTitle) {
            panelTitle.textContent =
                AppState.currentTrack.title || AppState.currentTrack.file_name || 'Unknown';
        }

        const panelArtist = document.getElementById('panel-artist');
        if (panelArtist) {
            panelArtist.textContent = AppState.currentTrack.artist || 'Unknown Artist';
        }

        const panelAlbum = document.getElementById('panel-album');
        if (panelAlbum) {
            panelAlbum.textContent = AppState.currentTrack.album || '--';
        }

        const panelArtwork = document.getElementById('panel-artwork');
        if (panelArtwork) {
            panelArtwork.src = getArtworkPath(AppState.currentTrack);
            panelArtwork.onerror = () => handleImageError(panelArtwork, AppState.currentTrack);
        }

        // Update format info if elements exist
        const panelFormat = document.getElementById('panel-format');
        if (panelFormat) {
            panelFormat.textContent = AppState.currentTrack.file_extension || '--';
        }

        const panelBitrate = document.getElementById('panel-bitrate');
        if (panelBitrate) {
            panelBitrate.textContent = AppState.currentTrack.bitrate
                ? AppState.currentTrack.bitrate + 'kbps'
                : '--';
        }

        const panelSamplerate = document.getElementById('panel-samplerate');
        if (panelSamplerate) {
            panelSamplerate.textContent = AppState.currentTrack.sampleRate
                ? AppState.currentTrack.sampleRate + 'Hz'
                : '--';
        }
    }
}

function updateProgress() {
    if (AppState.howl && AppState.isPlaying) {
        const seek = AppState.howl.seek() || 0;
        const duration = AppState.howl.duration() || 0;
        const percent = (seek / duration) * 100 || 0;

        // Update bottom player bar - Check if elements exist
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = percent + '%';
        }

        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(seek);
        }

        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = formatTime(duration);
        }

        // Update audio panel progress - Check if elements exist
        const progressFillPanel = document.getElementById('progressFillPanel');
        if (progressFillPanel) {
            progressFillPanel.style.width = percent + '%';
        }

        const currentTimePanel = document.getElementById('currentTimePanel');
        if (currentTimePanel) {
            currentTimePanel.textContent = formatTime(seek);
        }

        const totalTimePanel = document.getElementById('totalTimePanel');
        if (totalTimePanel) {
            totalTimePanel.textContent = formatTime(duration);
        }

        // Update VU meters
        updateVUMeters();

        requestAnimationFrame(updateProgress);
    }
}

// Peak hold tracking
let peakLeft = -40;
let peakRight = -40;
let peakHoldTimer = null;

function updateVUMeters() {
    // VU meter with -40 to +3 dB scale
    if (!AppState.howl || !AppState.isPlaying) {
        // Reset meters when not playing
        const leftBar = document.getElementById('vu-left');
        const rightBar = document.getElementById('vu-right');
        const leftVal = document.getElementById('vu-val-l');
        const rightVal = document.getElementById('vu-val-r');
        const clipLed = document.getElementById('clip-led');

        if (leftBar) {
            leftBar.style.width = '0%';
        }
        if (rightBar) {
            rightBar.style.width = '0%';
        }
        if (leftVal) {
            leftVal.textContent = '-40';
        }
        if (rightVal) {
            rightVal.textContent = '-40';
        }
        if (clipLed) {
            clipLed.classList.remove('active');
        }

        // Reset peaks
        peakLeft = -40;
        peakRight = -40;
        return;
    }

    // Simulate VU meter with random variations around volume level
    const baseLevel = AppState.howl.volume() * 0.8; // Base on actual volume
    const randomVariation = Math.random() * 0.2; // Add realistic variation
    const level = baseLevel + randomVariation;

    // Add some stereo difference for realism
    const leftLevel = level * (0.95 + Math.random() * 0.1);
    const rightLevel = level * (0.95 + Math.random() * 0.1);

    // Convert to dB scale (-40 to +3)
    const dbL = leftLevel > 0.001 ? 20 * Math.log10(leftLevel) : -40;
    const dbR = rightLevel > 0.001 ? 20 * Math.log10(rightLevel) : -40;

    // Clamp to -40 to +3 range
    const clampedDbL = Math.max(-40, Math.min(3, dbL));
    const clampedDbR = Math.max(-40, Math.min(3, dbR));

    // Convert to percentage for display (0% = -40dB, 100% = +3dB)
    const percentL = ((clampedDbL + 40) / 43) * 100;
    const percentR = ((clampedDbR + 40) / 43) * 100;

    // Update VU meter bars
    const leftBar = document.getElementById('vu-left');
    const rightBar = document.getElementById('vu-right');
    const leftVal = document.getElementById('vu-val-l');
    const rightVal = document.getElementById('vu-val-r');

    if (leftBar) {
        leftBar.style.width = percentL + '%';
        leftBar.style.transition = 'width 0.05s ease-out';
    }
    if (rightBar) {
        rightBar.style.width = percentR + '%';
        rightBar.style.transition = 'width 0.05s ease-out';
    }

    // Track peaks
    if (clampedDbL > peakLeft) {
        peakLeft = clampedDbL;
        const peakLeftEl = document.getElementById('peak-left');
        if (peakLeftEl) {
            peakLeftEl.style.left = percentL + '%';
            peakLeftEl.classList.add('active');
        }
        clearTimeout(peakHoldTimer);
        peakHoldTimer = setTimeout(() => {
            peakLeft = clampedDbL;
            if (peakLeftEl) {
                peakLeftEl.classList.remove('active');
            }
        }, 2000);
    }

    if (clampedDbR > peakRight) {
        peakRight = clampedDbR;
        const peakRightEl = document.getElementById('peak-right');
        if (peakRightEl) {
            peakRightEl.style.left = percentR + '%';
            peakRightEl.classList.add('active');
        }
    }

    // Check for clipping
    const clipLed = document.getElementById('clip-led');
    if (clipLed) {
        if (clampedDbL >= 0 || clampedDbR >= 0) {
            clipLed.classList.add('active');
            setTimeout(() => clipLed.classList.remove('active'), 500);
        }
    }

    // Display dB values with proper formatting
    if (leftVal) {
        if (clampedDbL > 0) {
            leftVal.textContent = '+' + clampedDbL.toFixed(0);
            leftVal.setAttribute('data-peak', 'true');
        } else {
            leftVal.textContent = clampedDbL.toFixed(0);
            leftVal.removeAttribute('data-peak');
        }
    }
    if (rightVal) {
        if (clampedDbR > 0) {
            rightVal.textContent = '+' + clampedDbR.toFixed(0);
            rightVal.setAttribute('data-peak', 'true');
        } else {
            rightVal.textContent = clampedDbR.toFixed(0);
            rightVal.removeAttribute('data-peak');
        }
    }

    // If we have Web Audio API working, use real data
    if (AppState.analyser) {
        try {
            const bufferLength = AppState.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            AppState.analyser.getByteTimeDomainData(dataArray);

            // Check if we're getting real audio data
            const hasSignal = dataArray.some(v => Math.abs(v - 128) > 2);

            if (hasSignal) {
                // Calculate RMS levels for accurate VU meter
                let sumL = 0,
                    sumR = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const sample = (dataArray[i] - 128) / 128.0;
                    const squaredSample = sample * sample;

                    // Simulate stereo
                    if (i % 2 === 0) {
                        sumL += squaredSample;
                    } else {
                        sumR += squaredSample;
                    }
                }

                // Calculate RMS
                const rmsL = Math.sqrt(sumL / (bufferLength / 2));
                const rmsR = Math.sqrt(sumR / (bufferLength / 2));

                // Convert to dB
                const realDbL = 20 * Math.log10(Math.max(0.001, rmsL));
                const realDbR = 20 * Math.log10(Math.max(0.001, rmsR));

                // Map to percentage
                const realPercentL = Math.max(0, Math.min(100, ((realDbL + 60) / 60) * 100));
                const realPercentR = Math.max(0, Math.min(100, ((realDbR + 60) / 60) * 100));

                // Use real data
                if (leftBar) {
                    leftBar.style.width = realPercentL + '%';
                }
                if (rightBar) {
                    rightBar.style.width = realPercentR + '%';
                }
                if (leftVal) {
                    leftVal.textContent = realDbL > -60 ? realDbL.toFixed(1) : '-∞';
                }
                if (rightVal) {
                    rightVal.textContent = realDbR > -60 ? realDbR.toFixed(1) : '-∞';
                }
            }
        } catch (error) {
            // Fall back to simulated meters
        }
    }
}

function updateStats() {
    document.getElementById('totalCount').textContent = AppState.allFiles.length;
    document.getElementById('showingCount').textContent = AppState.currentFiles.length;
    document.getElementById('selectedCount').textContent = AppState.selectedTracks.size;
    document.getElementById('artworkCount').textContent = AppState.allFiles.filter(
        f => f.artwork_path
    ).length;
    document.getElementById('queueCount').textContent = AppState.queue.length;
}

function highlightPlayingTrack() {
    // Remove previous playing highlight
    document.querySelectorAll('.playing').forEach(el => {
        el.classList.remove('playing');
    });

    // Add playing highlight to current track
    if (AppState.currentTrack) {
        document.querySelectorAll(`[data-id="${AppState.currentTrack.id}"]").forEach(el => {
            el.classList.add('playing');
        });
    }
}

// Context Menu Functions
function showContextMenu(x, y, track) {
    const menu = document.getElementById('contextMenu');

    // Update menu header with track info
    document.getElementById('contextTitle').textContent =
        track.title || track.file_name || 'Unknown';
    document.getElementById('contextArtist').textContent = track.artist || 'Unknown Artist';
    const contextArtwork = document.getElementById('contextArtwork');
    if (contextArtwork) {
        contextArtwork.src = getArtworkPath(track);
        contextArtwork.onerror = () => handleImageError(contextArtwork, track);
    }

    // Position menu
    menu.style.left = Math.min(x, window.innerWidth - 250) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 400) + 'px';
    menu.style.display = 'block';
    menu.dataset.trackId = track.id;
}

function hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
}

async function handleContextAction(action) {
    const trackId = parseInt(document.getElementById('contextMenu').dataset.trackId);
    const track = AppState.allFiles.find(f => f.id === trackId);

    if (!track) {
        return;
    }

    hideContextMenu();

    switch (action) {
        case 'play':
            playTrack(track);
            break;

        case 'queue':
            addToQueue(track);
            break;

        case 'next':
            addToQueueNext(track);
            break;

        case 'playlist':
            showPlaylistSelector(track);
            break;

        case 'favorite':
            addToFavorites(track);
            break;

        case 'edit':
            showEditModal(track);
            break;

        case 'analyze':
            analyzeTrack(track);
            break;

        case 'export':
            exportTracks([track]);
            break;

        case 'finder':
            if (window.electronAPI) {
                await window.electronAPI.invoke('show-in-folder', track.file_path);
            }
            break;

        case 'delete':
            if (confirm(`Delete "${track.title || track.file_name}"?")) {
                deleteTrack(track);
            }
            break;
    }
}

// Queue Management
function addToQueue(track) {
    if (!AppState.queue.find(t => t.id === track.id)) {
        AppState.queue.push(track);
        updateQueueUI();
        showToast('Added to queue', 'success');
    } else {
        showToast('Already in queue', 'info');
    }
}

function addToQueueNext(track) {
    if (!AppState.queue.find(t => t.id === track.id)) {
        AppState.queue.splice(AppState.queueIndex + 1, 0, track);
        updateQueueUI();
        showToast('Will play next', 'success');
    }
}

function clearQueue() {
    AppState.queue = AppState.currentTrack ? [AppState.currentTrack] : [];
    AppState.queueIndex = 0;
    updateQueueUI();
    showToast('Queue cleared', 'info');
}

function updateQueueUI() {
    const queueList = document.getElementById('queueList');
    if (!queueList) {
        return;
    }

    queueList.innerHTML = AppState.queue
        .map(
            (track, index) => `
        <div class="queue-item ${index === AppState.queueIndex ? 'playing' : ''}" 
             data-queue-index="${index}">
            <img class="queue-item-artwork track-artwork" 
                 src="${getArtworkPath(track)}" 
                 data-track-id="${track.id}"
                 onerror="handleImageError(this, ${JSON.stringify(track).replace(/"/g, '&quot;')})">
            <div class="queue-item-info">
                <div class="queue-item-title">${track.title || track.file_name || 'Unknown'}</div>
                <div class="queue-item-artist`>${track.artist || 'Unknown Artist'}</div>
            </div>
        </div>
    ')
        .join('');

    // Add click handlers
    queueList.querySelectorAll('.queue-item').forEach(item => {
        item.addEventListener('dblclick', () => {
            const index = parseInt(item.dataset.queueIndex);
            AppState.queueIndex = index;
            playTrack(AppState.queue[index]);
        });
    });

    updateStats();
}

// Playlist Management
function renderPlaylists() {
    const playlistList = document.getElementById('playlistList');
    if (!playlistList) {
        return;
    }

    playlistList.innerHTML = AppState.playlists
        .map(
            playlist => `
        <div class="playlist-item" data-playlist-id="${playlist.id}">
            <span>${playlist.name}</span>
            <small style="color: #666;`>${playlist.track_count || 0} tracks</small>
        </div>
    `
        )
        .join('');

    // Add click handlers
    playlistList.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = parseInt(item.dataset.playlistId);
            loadPlaylistTracks(playlistId);
        });
    });
}

async function loadPlaylistTracks(playlistId) {
    try {
        const playlist = await window.electronAPI.invoke('get-playlist-with-tracks', playlistId);
        if (playlist && playlist.tracks) {
            AppState.currentFiles = playlist.tracks;
            renderView();
            showToast(`Loaded playlist: ${playlist.name}`, 'success');
        }
    } catch (error) {
        logError('Error loading playlist:', error);
        showToast('Failed to load playlist', 'error');
    }
}

// Filter Functions
function applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const genre = document.getElementById('genreFilter').value;
    const mood = document.getElementById('moodFilter').value;
    const bpm = document.getElementById('bpmFilter').value;
    const energy = document.getElementById('energyFilter').value;

    AppState.currentFiles = AppState.allFiles.filter(file => {
        // Search filter
        if (searchQuery) {
            const matchesSearch =
                (file.title && file.title.toLowerCase().includes(searchQuery)) ||
                (file.artist && file.artist.toLowerCase().includes(searchQuery)) ||
                (file.album && file.album.toLowerCase().includes(searchQuery)) ||
                (file.genre && file.genre.toLowerCase().includes(searchQuery)) ||
                (file.file_name && file.file_name.toLowerCase().includes(searchQuery));

            if (!matchesSearch) {
                return false;
            }
        }

        // Genre filter
        if (genre && file.genre !== genre && file.LLM_GENRE !== genre) {
            return false;
        }

        // Mood filter
        if (mood && file.AI_MOOD !== mood && file.LLM_MOOD !== mood) {
            return false;
        }

        // BPM filter
        if (bpm) {
            const fileBpm = parseInt(file.AI_BPM);
            if (!fileBpm) {
                return false;
            }

            if (bpm === '0-100' && fileBpm > 100) {
                return false;
            }
            if (bpm === '100-120' && (fileBpm < 100 || fileBpm > 120)) {
                return false;
            }
            if (bpm === '120-140' && (fileBpm < 120 || fileBpm > 140)) {
                return false;
            }
            if (bpm === '140+' && fileBpm < 140) {
                return false;
            }
        }

        // Energy filter
        if (energy) {
            const fileEnergy = file.AI_ENERGY;
            if (!fileEnergy) {
                return false;
            }

            if (energy === 'low' && fileEnergy > 0.33) {
                return false;
            }
            if (energy === 'medium' && (fileEnergy < 0.33 || fileEnergy > 0.66)) {
                return false;
            }
            if (energy === 'high' && fileEnergy < 0.66) {
                return false;
            }
        }

        return true;
    });

    updateStats();
    renderView();
}

// Sort Functions
function sortBy(field) {
    AppState.currentFiles.sort((a, b) => {
        let aVal, bVal;

        switch (field) {
            case 'title':
                aVal = a.title || a.file_name || '';
                bVal = b.title || b.file_name || '';
                break;
            case 'artist':
                aVal = a.artist || '';
                bVal = b.artist || '';
                break;
            case 'album':
                aVal = a.album || '';
                bVal = b.album || '';
                break;
            case 'genre':
                aVal = a.genre || a.LLM_GENRE || '';
                bVal = b.genre || b.LLM_GENRE || '';
                break;
            case 'bpm':
                aVal = parseInt(a.AI_BPM) || 0;
                bVal = parseInt(b.AI_BPM) || 0;
                return aVal - bVal;
            case 'key':
                aVal = a.AI_KEY || '';
                bVal = b.AI_KEY || '';
                break;
            case 'energy':
                aVal = a.AI_ENERGY || 0;
                bVal = b.AI_ENERGY || 0;
                return aVal - bVal;
            default:
                return 0;
        }

        return aVal.toString().localeCompare(bVal.toString());
    });

    renderView();
}

// Modal Functions
function showEditModal(track) {
    const modal = document.getElementById('editModal');

    // Populate form
    document.getElementById('editTitle').value = track.title || '';
    document.getElementById('editArtist').value = track.artist || '';
    document.getElementById('editAlbum').value = track.album || '';
    document.getElementById('editGenre').value = track.genre || '';

    modal.classList.add('active');
    modal.dataset.trackId = track.id;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function saveEditedMetadata(e) {
    e.preventDefault();

    const modal = document.getElementById('editModal');
    const trackId = parseInt(modal.dataset.trackId);

    const metadata = {
        title: document.getElementById('editTitle').value,
        artist: document.getElementById('editArtist').value,
        album: document.getElementById('editAlbum').value,
        genre: document.getElementById('editGenre').value
    };

    try {
        const result = await window.electronAPI.invoke('update-track-metadata', trackId, metadata);
        if (result.success) {
            // Update local data
            const track = AppState.allFiles.find(f => f.id === trackId);
            if (track) {
                Object.assign(track, metadata);
                renderView();
            }

            showToast('Metadata updated', 'success');
            closeModal('editModal');
        } else {
            showToast('Failed to update metadata', 'error');
        }
    } catch (error) {
        logError('Error updating metadata:', error);
        showToast('Error updating metadata', 'error');
    }
}

// Audio Visualization
function setupAudioContext() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        AppState.audioContext = new AudioContext();
        AppState.analyser = AppState.audioContext.createAnalyser();
        AppState.analyser.fftSize = 256;
        AppState.analyser.smoothingTimeConstant = 0.8;
    } catch (error) {
        logError('Error setting up audio context:', error);
    }
}

function connectAudioAnalyser() {
    if (!AppState.howl) {
        logError('❌ No Howl instance');
        return;
    }

    if (!AppState.audioContext) {
        logError('❌ No AudioContext');
        setupAudioContext();
        if (!AppState.audioContext) {
            return;
        }
    }

    // Resume context if suspended
    if (AppState.audioContext.state === 'suspended') {
        AppState.audioContext.resume().then(() => {});
    }

    try {
        // Get the audio element from Howler
        const sound = AppState.howl._sounds[0];
        if (!sound || !sound._node) {
            logError('❌ No audio node found in Howler');
            return;
        }

        const audioElement = sound._node;

        // Check if source already exists for this element
        if (AppState.sourceNode && AppState.currentAudioElement === audioElement) {
            return;
        }

        // Disconnect previous source if exists
        if (AppState.sourceNode) {
            try {
                AppState.sourceNode.disconnect();
            } catch (e) {}
        }

        // Create media element source
        try {
            AppState.sourceNode = AppState.audioContext.createMediaElementSource(audioElement);
            AppState.sourceNode.connect(AppState.analyser);
            AppState.analyser.connect(AppState.audioContext.destination);
            AppState.currentAudioElement = audioElement;

            // Test the analyser
            setTimeout(() => {
                const testArray = new Uint8Array(AppState.analyser.frequencyBinCount);
                AppState.analyser.getByteTimeDomainData(testArray);
                const hasSignal = testArray.some(v => v !== 128);
            }, 500);
        } catch (e) {
            if (e.name === 'InvalidStateError') {
            } else {
                logError('❌ Error creating audio source:', e);
            }
        }
    } catch (error) {
        logError('❌ Error connecting audio analyser:', error);
    }
}

function updateVisualization() {
    if (!AppState.analyser || !AppState.isPlaying) {
        return;
    }

    // Update spectrum analyzer
    const spectrumCanvas = document.getElementById('spectrum-canvas');
    if (spectrumCanvas) {
        const ctx = spectrumCanvas.getContext('2d');
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;

        const bufferLength = AppState.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!AppState.isPlaying) {
                return;
            }
            requestAnimationFrame(draw);

            AppState.analyser.getByteFrequencyData(dataArray);

            // Clear canvas with fade effect
            ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
            ctx.fillRect(0, 0, width, height);

            // Create professional gradient
            const spectrumGradient = ctx.createLinearGradient(0, height, 0, 0);
            spectrumGradient.addColorStop(0.0, '#003d82'); // Deep blue
            spectrumGradient.addColorStop(0.3, '#0066cc'); // Medium blue
            spectrumGradient.addColorStop(0.5, '#00a2ff'); // Bright blue
            spectrumGradient.addColorStop(0.7, '#00ff88'); // Cyan green
            spectrumGradient.addColorStop(0.85, '#ffff00'); // Yellow
            spectrumGradient.addColorStop(0.95, '#ff8800'); // Orange
            spectrumGradient.addColorStop(1.0, '#ff0000'); // Red

            // Draw spectrum bars
            const barWidth = (width / bufferLength) * 2.5;
            const barSpacing = 1;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height * 0.9;

                ctx.fillStyle = spectrumGradient;
                ctx.fillRect(x, height - barHeight, barWidth - barSpacing, barHeight);

                // Reflection effect
                ctx.fillStyle = 'rgba(0, 162, 255, 0.1)';
                ctx.fillRect(x, height - barHeight - 2, barWidth - barSpacing, 2);

                // Peak indicator
                if (barHeight > height * 0.8) {
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(x, height - barHeight - 4, barWidth - barSpacing, 2);
                }

                x += barWidth;
                if (x > width) {
                    break;
                }
            }

            // Grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= 6; i++) {
                const y = (height / 6) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Update LUFS meters
            updateLUFSMeters(dataArray, bufferLength);
        };

        draw();
    }
}

function updateLUFSMeters(dataArray, bufferLength) {
    // Calculate average levels (simplified LUFS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;

    // Convert to dB scale
    const db = 20 * Math.log10(average / 255);
    const lufs = Math.max(-60, Math.min(0, db + 23));

    // Update displays with realistic variations
    const integrated = document.getElementById('lufs-integrated');
    const shortTerm = document.getElementById('lufs-short');
    const momentary = document.getElementById('lufs-momentary');

    if (integrated) {
        const currentValue = parseFloat(integrated.textContent) || -14;
        const targetValue = lufs - 14;
        integrated.textContent = (currentValue * 0.99 + targetValue * 0.01).toFixed(1);
    }

    if (shortTerm) {
        const currentValue = parseFloat(shortTerm.textContent) || -12;
        const targetValue = lufs - 12 + (Math.random() - 0.5) * 2;
        shortTerm.textContent = (currentValue * 0.9 + targetValue * 0.1).toFixed(1);
    }

    if (momentary) {
        momentary.textContent = (lufs - 10 + (Math.random() - 0.5) * 4).toFixed(1);
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));

    // View toggles
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.currentView = btn.dataset.view;
            renderView();
        });
    });

    // Filters
    document.getElementById('genreFilter').addEventListener('change', applyFilters);
    document.getElementById('moodFilter').addEventListener('change', applyFilters);
    document.getElementById('bpmFilter').addEventListener('change', applyFilters);
    document.getElementById('energyFilter').addEventListener('change', applyFilters);

    // Player controls
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.getElementById('prevBtn').addEventListener('click', playPrevious);
    document.getElementById('nextBtn').addEventListener('click', playNext);
    document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);

    // Audio panel controls - Check if elements exist
    const playBtnPanel = document.getElementById('playBtnPanel');
    if (playBtnPanel) {
        playBtnPanel.addEventListener('click', togglePlayPause);
    }

    const prevBtnPanel = document.getElementById('prevBtnPanel');
    if (prevBtnPanel) {
        prevBtnPanel.addEventListener('click', playPrevious);
    }

    const nextBtnPanel = document.getElementById('nextBtnPanel');
    if (nextBtnPanel) {
        nextBtnPanel.addEventListener('click', playNext);
    }

    // Panel progress bar
    const progressMinimal = document.getElementById('progressMinimal');
    if (progressMinimal) {
        progressMinimal.addEventListener('click', e => {
            if (AppState.howl) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                AppState.howl.seek(AppState.howl.duration() * percent);
            }
        });
    }

    // Panel volume
    const volumeSliderPanel = document.getElementById('volume-slider-panel');
    if (volumeSliderPanel) {
        volumeSliderPanel.addEventListener('input', e => {
            AppState.volume = e.target.value / 100;
            if (AppState.howl) {
                AppState.howl.volume(AppState.volume);
            }
            updateVolumeIcon();
        });
    }

    // Balance control
    const balanceSlider = document.getElementById('balance-slider');
    if (balanceSlider) {
        balanceSlider.addEventListener('input', e => {
            const balance = parseInt(e.target.value);
            // Update display
            let display = 'C';
            if (balance < 0) {
                display = `L${Math.abs(balance)}`;
            }
            if (balance > 0) {
                display = `R${balance}`;
            }
            const balanceValue = document.getElementById('balance-value');
            if (balanceValue) {
                balanceValue.textContent = display;
            }
        });
    }

    // Progress bar
    document.getElementById('progressBar').addEventListener('click', e => {
        if (AppState.howl) {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            AppState.howl.seek(AppState.howl.duration() * percent);
        }
    });

    // Volume control
    document.getElementById('volumeSlider').addEventListener('click', e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        AppState.volume = Math.max(0, Math.min(1, percent));

        if (AppState.howl) {
            AppState.howl.volume(AppState.volume);
        }

        document.getElementById('volumeFill').style.width = AppState.volume * 100 + '%';
        updateVolumeIcon();
    });

    // Context menu
    document.addEventListener('click', hideContextMenu);
    document.getElementById('contextMenu').addEventListener('click', e => {
        e.stopPropagation();
        const action = e.target.closest('.context-menu-item')?.dataset.action;
        if (action) {
            handleContextAction(action);
        }
    });

    // Panel toggles - Check if elements exist first
    const expandBtn = document.getElementById('expandBtn');
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            const panelContent = document.getElementById('panelContent');
            const expandIcon = document.querySelector('.expand-icon');

            if (panelContent && panelContent.classList.contains('collapsed')) {
                panelContent.classList.remove('collapsed');
                panelContent.classList.add('expanded');
                if (expandIcon) {
                    expandIcon.textContent = '▼';
                }
            } else if (panelContent) {
                panelContent.classList.remove('expanded');
                panelContent.classList.add('collapsed');
                if (expandIcon) {
                    expandIcon.textContent = '▲';
                }
            }
        });
    }

    const playlistToggle = document.getElementById('playlistToggle');
    if (playlistToggle) {
        playlistToggle.addEventListener('click', () => {
            AppState.playlistPanelVisible = !AppState.playlistPanelVisible;
            const playlistPanel = document.getElementById('playlistPanel');
            if (playlistPanel) {
                playlistPanel.classList.toggle('visible', AppState.playlistPanelVisible);
            }
        });
    }

    const queueToggle = document.getElementById('queueToggle');
    if (queueToggle) {
        queueToggle.addEventListener('click', () => {
            AppState.queuePanelVisible = !AppState.queuePanelVisible;
            const queuePanel = document.getElementById('queuePanel');
            if (queuePanel) {
                queuePanel.classList.toggle('visible', AppState.queuePanelVisible);
            }
        });
    }

    // Edit form
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', saveEditedMetadata);
    }
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Space - Play/Pause
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        }

        // Arrow Right - Next (with Ctrl/Cmd)
        if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            playNext();
        }

        // Arrow Left - Previous (with Ctrl/Cmd)
        if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            playPrevious();
        }

        // Arrow Up - Volume Up
        if (e.code === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            adjustVolume(0.1);
        }

        // Arrow Down - Volume Down
        if (e.code === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            adjustVolume(-0.1);
        }

        // Cmd/Ctrl + A - Select All
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            selectAll();
        }

        // Delete - Delete selected
        if (e.key === 'Delete` && AppState.selectedTracks.size > 0) {
            if (confirm(`Delete ${AppState.selectedTracks.size} tracks?`)) {
                deleteSelectedTracks();
            }
        }

        // / - Focus search
        if (e.key === '/') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }

        // Escape - Clear search/selection
        if (e.key === 'Escape') {
            if (document.getElementById('searchInput').value) {
                document.getElementById('searchInput').value = '';
                applyFilters();
            } else if (AppState.selectedTracks.size > 0) {
                AppState.selectedTracks.clear();
                document.querySelectorAll('.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                updateStats();
            }
        }

        // Number keys for views
        if (e.key === '1') {
            switchView('cards');
        } else if (e.key === '2') {
            switchView('table');
        } else if (e.key === '3') {
            switchView('compact');
        }
    });
}

// Utility Functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}';
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon =
        type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `
        <span>${icon}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    document.getElementById('content').innerHTML = `
        <div style="text-align: center; padding: 50px;`>
            <h2>⚠️ Error</h2>
            <p>${message}</p>
        </div>
    `;
}

function adjustVolume(delta) {
    AppState.volume = Math.max(0, Math.min(1, AppState.volume + delta));

    if (AppState.howl) {
        AppState.howl.volume(AppState.volume);
    }

    document.getElementById('volumeFill').style.width = AppState.volume * 100 + '%';
    updateVolumeIcon();
    showToast(`Volume: ${Math.round(AppState.volume * 100)}%`, 'info');
}

function updateVolumeIcon() {
    const btn = document.getElementById('volumeBtn');
    if (AppState.volume === 0) {
        btn.textContent = '🔇';
    } else if (AppState.volume < 0.5) {
        btn.textContent = '🔉';
    } else {
        btn.textContent = '🔊';
    }
}

function selectAll() {
    AppState.selectedTracks.clear();
    AppState.currentFiles.forEach(file => AppState.selectedTracks.add(file.id));
    document.querySelectorAll('.track-card, .track-row, .compact-item').forEach(el => {
        el.classList.add('selected');
    });
    updateStats();
}

function switchView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    AppState.currentView = view;
    renderView();
}

function restoreUserPreferences() {
    // Restore view preference
    const savedView = localStorage.getItem('preferredView');
    if (savedView) {
        switchView(savedView);
    }

    // Restore volume
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
        AppState.volume = parseFloat(savedVolume);
        document.getElementById('volumeFill').style.width = AppState.volume * 100 + '%';
        updateVolumeIcon();
    }
}

// Save preferences on change
window.addEventListener('beforeunload', () => {
    localStorage.setItem('preferredView', AppState.currentView);
    localStorage.setItem('volume', AppState.volume);
});

// Export for debugging
window.AppState = AppState;

// Debug function to validate audio chain
window.validateAudioChain = function () {
    if (AppState.audioContext) {
    }

    if (AppState.analyser) {
    }

    // Test audio signal
    if (AppState.analyser && AppState.isPlaying) {
        const dataArray = new Uint8Array(AppState.analyser.frequencyBinCount);
        AppState.analyser.getByteTimeDomainData(dataArray);
        const hasSignal = dataArray.some(v => Math.abs(v - 128) > 1);

        // Check VU meter elements
    }
};

// Auto-validate when playing
window.debugVU = function () {
    if (!AppState.isPlaying) {
        return;
    }

    validateAudioChain();

    // Force update VU meters for testing

    updateVUMeters();

    // Check values
    const leftBar = document.getElementById('vu-left');
    const rightBar = document.getElementById('vu-right');

    // VU meter elements checked
};

// Test VU meter animation
window.testVU = function () {
    let level = 0;
    let direction = 1;

    const leftBar = document.getElementById('vu-left');
    const rightBar = document.getElementById('vu-right');
    const leftVal = document.getElementById('vu-val-l');
    const rightVal = document.getElementById('vu-val-r');

    const animate = setInterval(() => {
        level += direction * 5;
        if (level >= 100) {
            direction = -1;
        }
        if (level <= 0) {
            direction = 1;
        }

        if (leftBar) {
            leftBar.style.width = level + '%';
        }
        if (rightBar) {
            rightBar.style.width = level * 0.9 + '%';
        }

        const db = level > 0 ? -60 + level * 0.6 : -60;
        if (leftVal) {
            leftVal.textContent = db.toFixed(1);
        }
        if (rightVal) {
            rightVal.textContent = (db - 2).toFixed(1);
        }

        if (!AppState.isPlaying && level === 0) {
            clearInterval(animate);
        }
    }, 50);

    // Stop after 5 seconds
    setTimeout(() => {
        clearInterval(animate);
        if (leftBar) {
            leftBar.style.width = '0%';
        }
        if (rightBar) {
            rightBar.style.width = '0%';
        }
        if (leftVal) {
            leftVal.textContent = '-∞';
        }
        if (rightVal) {
            rightVal.textContent = '-∞';
        }
    }, 5000);
};
