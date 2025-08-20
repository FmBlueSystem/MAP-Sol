// Track Selector Modal
// Provides a searchable modal for selecting tracks from library

class TrackSelectorModal {
    constructor() {
        this.selectedTrack = null;
        this.tracks = [];
        this.filteredTracks = [];
        this.onSelect = null;
        this.modal = null;
    }

    async show(options = {}) {
        const {
            title = 'Select Track',
            subtitle = 'Choose a track from your library',
            onSelect = null,
            filter = null
        } = options;

        this.onSelect = onSelect;

        // Load tracks
        await this.loadTracks();

        // Apply filter if provided
        if (filter) {
            this.filteredTracks = this.tracks.filter(filter);
        } else {
            this.filteredTracks = [...this.tracks];
        }

        // Create and show modal
        this.createModal(title, subtitle);
        this.renderTracks();

        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }

    async loadTracks() {
        try {
            const { ipcRenderer } = require('electron');
            this.tracks = await ipcRenderer.invoke('get-files-with-cached-artwork', 500);
        } catch (error) {
            console.error('Error loading tracks:', error);
            this.tracks = [];
        }
    }

    createModal(title, subtitle) {
        // Remove existing modal if any
        if (this.modal) {
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.className = 'track-selector-modal';
        this.modal.innerHTML = `
            <div class="modal-backdrop" onclick="trackSelectorModal.close()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <p>${subtitle}</p>
                    <button class="close-btn" onclick="trackSelectorModal.close()">×</button>
                </div>

                <div class="search-section">
                    <input type="text" 
                           id="track-search-input" 
                           placeholder="Search tracks..." 
                           onkeyup="trackSelectorModal.searchTracks(this.value)">
                    <div class="search-filters">
                        <select id="filter-genre" onchange="trackSelectorModal.applyFilters()">
                            <option value="">All Genres</option>
                        </select>
                        <select id="filter-mood" onchange="trackSelectorModal.applyFilters()">
                            <option value="">All Moods</option>
                        </select>
                        <select id="filter-energy" onchange="trackSelectorModal.applyFilters()">
                            <option value="">All Energy</option>
                            <option value="low">Low Energy (< 0.3)</option>
                            <option value="medium">Medium Energy (0.3-0.7)</option>
                            <option value="high">High Energy (> 0.7)</option>
                        </select>
                    </div>
                </div>

                <div class="tracks-grid" id="track-selector-grid">
                    <!-- Tracks will be rendered here -->
                </div>

                <div class="modal-footer">
                    <div class="selected-info" id="selected-track-info">
                        No track selected
                    </div>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="trackSelectorModal.close()">Cancel</button>
                        <button class="btn-select" onclick="trackSelectorModal.confirm()" disabled id="confirm-btn">
                            Select Track
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();

        // Add to body
        document.body.appendChild(this.modal);

        // Focus search input
        setTimeout(() => {
            document.getElementById('track-search-input').focus();
        }, 100);

        // Populate filter dropdowns
        this.populateFilters();
    }

    addStyles() {
        if (document.getElementById('track-selector-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'track-selector-styles`;
        style.textContent = `
            .track-selector-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .track-selector-modal .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
            }

            .track-selector-modal .modal-content {
                position: relative;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                width: 90%;
                max-width: 900px;
                height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }

            .track-selector-modal .modal-header {
                padding: 30px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }

            .track-selector-modal .modal-header h2 {
                margin: 0 0 5px 0;
                color: white;
                font-size: 28px;
            }

            .track-selector-modal .modal-header p {
                margin: 0;
                color: rgba(255, 255, 255, 0.9);
                font-size: 14px;
            }

            .track-selector-modal .close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 24px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.3s;
            }

            .track-selector-modal .close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .track-selector-modal .search-section {
                padding: 20px 30px;
                background: rgba(0, 0, 0, 0.2);
            }

            .track-selector-modal #track-search-input {
                width: 100%;
                padding: 12px 20px;
                border: none;
                border-radius: 25px;
                font-size: 16px;
                background: rgba(255, 255, 255, 0.95);
                color: #333;
                margin-bottom: 15px;
            }

            .track-selector-modal #track-search-input:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(253, 184, 19, 0.3);
            }

            .track-selector-modal .search-filters {
                display: flex;
                gap: 10px;
            }

            .track-selector-modal .search-filters select {
                flex: 1;
                padding: 8px 15px;
                border: none;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.9);
                color: #333;
                font-size: 14px;
                cursor: pointer;
            }

            .track-selector-modal .tracks-grid {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }

            .track-selector-modal .track-item {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 10px;
                cursor: pointer;
                transition: all 0.3s;
                border: 2px solid transparent;
            }

            .track-selector-modal .track-item:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-5px);
            }

            .track-selector-modal .track-item.selected {
                border-color: #FDB813;
                background: rgba(253, 184, 19, 0.2);
            }

            .track-selector-modal .track-cover {
                width: 100%;
                aspect-ratio: 1;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.3);
                margin-bottom: 10px;
                object-fit: cover;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
            }

            .track-selector-modal .track-info {
                color: white;
            }

            .track-selector-modal .track-title {
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 3px;
            }

            .track-selector-modal .track-artist {
                font-size: 11px;
                opacity: 0.8;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .track-selector-modal .track-badges {
                display: flex;
                gap: 5px;
                margin-top: 5px;
            }

            .track-selector-modal .badge {
                font-size: 10px;
                padding: 2px 6px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 10px;
            }

            .track-selector-modal .modal-footer {
                padding: 20px 30px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .track-selector-modal .selected-info {
                color: white;
                font-size: 14px;
            }

            .track-selector-modal .modal-actions {
                display: flex;
                gap: 10px;
            }

            .track-selector-modal .modal-actions button {
                padding: 10px 24px;
                border: none;
                border-radius: 25px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }

            .track-selector-modal .btn-cancel {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }

            .track-selector-modal .btn-cancel:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .track-selector-modal .btn-select {
                background: linear-gradient(135deg, #FDB813 0%, #FFAA00 100%);
                color: white;
            }

            .track-selector-modal .btn-select:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(253, 184, 19, 0.3);
            }

            .track-selector-modal .btn-select:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;

        document.head.appendChild(style);
    }

    populateFilters() {
        // Get unique genres and moods
        const genres = new Set();
        const moods = new Set();

        this.tracks.forEach(track => {
            if (track.genre) {
                genres.add(track.genre);
            }
            if (track.LLM_GENRE) {
                genres.add(track.LLM_GENRE);
            }
            if (track.AI_MOOD) {
                moods.add(track.AI_MOOD);
            }
        });

        // Populate genre dropdown
        const genreSelect = document.getElementById('filter-genre');
        Array.from(genres)
            .sort()
            .forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreSelect.appendChild(option);
            });

        // Populate mood dropdown
        const moodSelect = document.getElementById('filter-mood');
        Array.from(moods)
            .sort()
            .forEach(mood => {
                const option = document.createElement('option');
                option.value = mood;
                option.textContent = mood;
                moodSelect.appendChild(option);
            });
    }

    renderTracks() {
        const grid = document.getElementById('track-selector-grid');
        grid.innerHTML = '';

        // Limit to first 100 tracks for performance
        const tracksToShow = this.filteredTracks.slice(0, 100);

        tracksToShow.forEach(track => {
            const item = document.createElement('div');
            item.className = 'track-item';
            item.dataset.trackId = track.id;
            item.onclick = () => this.selectTrack(track);

            const energy = parseFloat(track.AI_ENERGY) || 0;
            const bpm = track.AI_BPM || track.existing_bmp || '—';

            item.innerHTML = `
                ${
                    track.artwork_path
                        ? `<img src="${track.artwork_path}" class="track-cover`>`
                        : '<div class="track-cover">🎵</div>'
                }
                <div class="track-info">
                    <div class="track-title" title="${track.title || track.file_name}">
                        ${track.title || track.file_name}
                    </div>
                    <div class="track-artist" title="${track.artist || 'Unknown'}">
                        ${track.artist || 'Unknown'}
                    </div>
                    <div class="track-badges">
                        <span class="badge">${bpm} BPM</span>
                        <span class="badge">${(energy * 100).toFixed(0)}% E</span>
                    </div>
                </div>
            ";

            grid.appendChild(item);
        });

        if (tracksToShow.length === 0) {
            grid.innerHTML =
                '<div style="color: white; text-align: center; padding: 40px;`>No tracks found</div>';
        }
    }

    searchTracks(query) {
        if (!query) {
            this.filteredTracks = [...this.tracks];
        } else {
            const searchLower = query.toLowerCase();
            this.filteredTracks = this.tracks.filter(track => {
                const title = (track.title || track.file_name || '').toLowerCase();
                const artist = (track.artist || '').toLowerCase();
                const album = (track.album || '').toLowerCase();

                return (
                    title.includes(searchLower) ||
                    artist.includes(searchLower) ||
                    album.includes(searchLower)
                );
            });
        }

        this.applyFilters();
    }

    applyFilters() {
        const genre = document.getElementById('filter-genre').value;
        const mood = document.getElementById('filter-mood').value;
        const energy = document.getElementById('filter-energy').value;

        let filtered = this.filteredTracks;

        if (genre) {
            filtered = filtered.filter(t => t.genre === genre || t.LLM_GENRE === genre);
        }

        if (mood) {
            filtered = filtered.filter(t => t.AI_MOOD === mood);
        }

        if (energy) {
            filtered = filtered.filter(t => {
                const e = parseFloat(t.AI_ENERGY) || 0;
                if (energy === 'low') {
                    return e < 0.3;
                }
                if (energy === 'medium') {
                    return e >= 0.3 && e <= 0.7;
                }
                if (energy === 'high') {
                    return e > 0.7;
                }
                return true;
            });
        }

        this.filteredTracks = filtered;
        this.renderTracks();
    }

    selectTrack(track) {
        // Remove previous selection
        document.querySelectorAll('.track-item.selected').forEach(item => {
            item.classList.remove('selected`);
        });

        // Add selection to clicked track
        const item = document.querySelector(`[data-track-id="${track.id}"]`);
        if (item) {
            item.classList.add('selected');
        }

        this.selectedTrack = track;

        // Update footer
        document.getElementById('selected-track-info`).innerHTML = `
            Selected: <strong>${track.title || track.file_name}</strong> by ${track.artist || 'Unknown'}
        `;

        // Enable confirm button
        document.getElementById('confirm-btn`).disabled = false;
    }

    confirm() {
        if (!this.selectedTrack) {
            return;
        }

        if (this.onSelect) {
            this.onSelect(this.selectedTrack);
        }

        if (this.resolvePromise) {
            this.resolvePromise(this.selectedTrack);
        }

        this.close();
    }

    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }

        if (this.resolvePromise) {
            this.resolvePromise(null);
        }

        this.selectedTrack = null;
    }
}

// Create global instance
window.trackSelectorModal = new TrackSelectorModal();
