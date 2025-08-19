// Playlist Database UI - Connects frontend to persistent storage
class PlaylistDatabaseUI {
    constructor() {
        this.playlists = [];
        this.currentPlaylist = null;
        this.selectedTracks = new Set();
        this.init();
    }

    async init() {
        await this.loadPlaylists();
        this.setupEventListeners();
        this.render();
    }

    async loadPlaylists() {
        try {
            const result = await window.electronAPI.invoke('get-playlists');
            this.playlists = result || [];
        } catch (error) {
            console.error('Failed to load playlists:', error);
            this.playlists = [];
        }
    }

    async createPlaylist(name, description = '') {
        try {
            const result = await window.electronAPI.invoke('create-playlist', {
                name,
                description,
                color: this.generateRandomColor()
            });

            if (result && result.id) {
                await this.loadPlaylists();
                this.showNotification('Playlist created', 'success');
                return result;
            }
        } catch (error) {
            console.error('Failed to create playlist:', error);
            this.showNotification('Failed to create playlist', 'error');
        }
    }

    async addTracksToPlaylist(playlistId, trackIds) {
        try {
            for (const trackId of trackIds) {
                await window.electronAPI.invoke('add-track-to-playlist', playlistId, trackId);
            }

            this.showNotification(`Added ${trackIds.length} tracks to playlist`, 'success');
            await this.loadPlaylistTracks(playlistId);
        } catch (error) {
            console.error('Failed to add tracks:', error);
            this.showNotification('Failed to add tracks', 'error');
        }
    }

    async removeTrackFromPlaylist(playlistId, trackId) {
        try {
            await window.electronAPI.invoke('remove-track-from-playlist', playlistId, trackId);
            this.showNotification('Track removed', 'success');
            await this.loadPlaylistTracks(playlistId);
        } catch (error) {
            console.error('Failed to remove track:', error);
            this.showNotification('Failed to remove track', 'error');
        }
    }

    async loadPlaylistTracks(playlistId) {
        try {
            const result = await window.electronAPI.invoke('get-playlist-with-tracks', playlistId);
            if (result) {
                this.currentPlaylist = result;
                this.renderPlaylistView(result);
            }
        } catch (error) {
            console.error('Failed to load playlist tracks:', error);
        }
    }

    async updatePlaylist(playlistId, updates) {
        try {
            await window.electronAPI.invoke('update-playlist', playlistId, updates);
            this.showNotification('Playlist updated', 'success');
            await this.loadPlaylists();
        } catch (error) {
            console.error('Failed to update playlist:', error);
            this.showNotification('Failed to update playlist', 'error');
        }
    }

    async deletePlaylist(playlistId) {
        if (!confirm('Are you sure you want to delete this playlist?')) {
            return;
        }

        try {
            await window.electronAPI.invoke('delete-playlist', playlistId);
            this.showNotification('Playlist deleted', 'success');
            await this.loadPlaylists();
            this.currentPlaylist = null;
            this.render();
        } catch (error) {
            console.error('Failed to delete playlist:', error);
            this.showNotification('Failed to delete playlist', 'error');
        }
    }

    async duplicatePlaylist(playlistId) {
        try {
            await window.electronAPI.invoke('duplicate-playlist', playlistId);
            this.showNotification('Playlist duplicated', 'success');
            await this.loadPlaylists();
        } catch (error) {
            console.error('Failed to duplicate playlist:', error);
            this.showNotification('Failed to duplicate playlist', 'error');
        }
    }

    async createSmartPlaylist(name, criteria) {
        try {
            const result = await window.electronAPI.invoke('create-smart-playlist', name, criteria);
            if (result) {
                await this.loadPlaylists();
                this.showNotification('Smart playlist created', 'success');
            }
        } catch (error) {
            console.error('Failed to create smart playlist:', error);
            this.showNotification('Failed to create smart playlist', 'error');
        }
    }

    async getHAMMSRecommendations(trackId, limit = 20) {
        try {
            const result = await window.electronAPI.invoke(
                'get-hamms-recommendations',
                trackId,
                limit
            );
            return result || [];
        } catch (error) {
            console.error('Failed to get recommendations:', error);
            return [];
        }
    }

    setupEventListeners() {
        // Listen for track selection
        document.addEventListener('track-selected', e => {
            this.selectedTracks.add(e.detail.trackId);
        });

        // Listen for add to playlist requests
        document.addEventListener('add-to-playlist', async e => {
            const { playlistId, trackIds } = e.detail;
            await this.addTracksToPlaylist(playlistId, trackIds);
        });

        // Listen for playlist updates from IPC
        if (window.electronAPI) {
            window.electronAPI.on('playlist-updated', () => {
                this.loadPlaylists();
            });

            window.electronAPI.on('track-added-to-playlist', data => {
                if (this.currentPlaylist && this.currentPlaylist.id === data.playlistId) {
                    this.loadPlaylistTracks(data.playlistId);
                }
            });
        }

        // Context menu for playlists
        document.addEventListener('contextmenu', e => {
            const playlistItem = e.target.closest('.playlist-item');
            if (playlistItem) {
                e.preventDefault();
                this.showPlaylistContextMenu(e, playlistItem.dataset.playlistId);
            }
        });
    }

    render() {
        const container = document.querySelector('.playlists-container');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="playlists-header">
                <h2>Playlists</h2>
                <button class="btn-create-playlist" onclick="playlistDB.showCreatePlaylistModal()">
                    + New Playlist
                </button>
            </div>
            <div class="playlists-list">
                ${this.renderPlaylistsList()}
            </div>
            <div class="playlist-content">
                ${this.currentPlaylist ? this.renderPlaylistView(this.currentPlaylist) : ''}
            </div>
        ';
    }

    renderPlaylistsList() {
        if (this.playlists.length === 0) {
            return '<p class="no-playlists">No playlists yet. Create your first playlist!</p>';
        }

        return this.playlists
            .map(
                playlist => `
            <div class="playlist-item ${this.currentPlaylist?.id === playlist.id ? 'active' : ''}" 
                 data-playlist-id="${playlist.id}"
                 onclick="playlistDB.loadPlaylistTracks(${playlist.id})">
                <div class="playlist-color" style="background: ${playlist.color || '#667eea'}"></div>
                <div class="playlist-info">
                    <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                    <div class="playlist-meta">
                        ${playlist.total_tracks || 0} tracks
                        ${playlist.is_smart ? '<span class="smart-badge">Smart</span>' : ''}
                    </div>
                </div>
                <div class="playlist-actions">
                    <button onclick="event.stopPropagation(); playlistDB.duplicatePlaylist(${playlist.id})" title="Duplicate">
                        📋
                    </button>
                    <button onclick="event.stopPropagation(); playlistDB.deletePlaylist(${playlist.id})" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        ")
            .join('');
    }

    renderPlaylistView(playlist) {
        const container = document.querySelector('.playlist-content');
        if (!container) {
            return '';
        }

        const html = `
            <div class="playlist-header">
                <h2>${this.escapeHtml(playlist.name)}</h2>
                <p>${this.escapeHtml(playlist.description || '')}</p>
                <div class="playlist-stats">
                    <span>${playlist.total_tracks || 0} tracks</span>
                    <span>${this.formatDuration(playlist.total_duration)}</span>
                    ${playlist.avg_bpm ? `<span>${Math.round(playlist.avg_bpm)} BPM avg</span>` : ''}
                    ${playlist.avg_energy ? `<span>${(playlist.avg_energy * 100).toFixed(0)}% energy</span>` : ''}
                </div>
                <div class="playlist-actions">
                    <button onclick="playlistDB.playPlaylist(${playlist.id})">▶️ Play</button>
                    <button onclick="playlistDB.shufflePlaylist(${playlist.id})">🔀 Shuffle</button>
                    <button onclick="playlistDB.analyzePlaylist(${playlist.id})">📊 Analyze</button>
                    <button onclick="playlistDB.exportPlaylist(${playlist.id})">📤 Export</button>
                </div>
            </div>
            <div class="playlist-tracks">
                ${
                    playlist.tracks && playlist.tracks.length > 0
                        ? this.renderPlaylistTracks(playlist.tracks)
                        : '<p class="no-tracks">No tracks in this playlist yet.</p>'
                }
            </div>
        ';

        container.innerHTML = html;
        return html;
    }

    renderPlaylistTracks(tracks) {
        return `
            <table class="playlist-tracks-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Album</th>
                        <th>BPM</th>
                        <th>Key</th>
                        <th>Energy</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tracks
                        .map(
                            (track, index) => `
                        <tr data-track-id="${track.id}">
                            <td>${index + 1}</td>
                            <td>${this.escapeHtml(track.title || track.file_name)}</td>
                            <td>${this.escapeHtml(track.artist || 'Unknown')}</td>
                            <td>${this.escapeHtml(track.album || '')}</td>
                            <td>${track.AI_BPM || '-'}</td>
                            <td>${track.AI_KEY || '-'}</td>
                            <td>${track.AI_ENERGY ? (track.AI_ENERGY * 100).toFixed(0) + '%' : '-'}</td>
                            <td>
                                <button onclick="playlistDB.removeTrackFromPlaylist(${this.currentPlaylist.id}, ${track.id})">
                                    ❌
                                </button>
                            </td>
                        </tr>
                    ")
                        .join('')}
                </tbody>
            </table>
        ';
    }

    async playPlaylist(playlistId) {
        const playlist = await window.electronAPI.invoke('get-playlist-with-tracks', playlistId);
        if (playlist && playlist.tracks) {
            // Set queue
            await window.electronAPI.invoke('set-queue', playlist.tracks);
            // Play first track
            if (playlist.tracks.length > 0) {
                await window.electronAPI.invoke('play-track', playlist.tracks[0].id);
            }
        }
    }

    async shufflePlaylist(playlistId) {
        const playlist = await window.electronAPI.invoke('get-playlist-with-tracks', playlistId);
        if (playlist && playlist.tracks) {
            // Shuffle tracks
            const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
            await window.electronAPI.invoke('set-queue', shuffled);
            // Play first track
            if (shuffled.length > 0) {
                await window.electronAPI.invoke('play-track', shuffled[0].id);
            }
        }
    }

    async analyzePlaylist(playlistId) {
        try {
            const analytics = await window.electronAPI.invoke('get-playlist-analytics', playlistId);
            this.showAnalyticsModal(analytics);
        } catch (error) {
            console.error('Failed to analyze playlist:', error);
        }
    }

    async exportPlaylist(playlistId) {
        const format = await this.showExportFormatDialog();
        if (!format) {
            return;
        }

        try {
            const result = await window.electronAPI.invoke(`export-${format}`, playlistId);
            if (result.success) {
                this.showNotification('Playlist exported successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to export playlist:', error);
            this.showNotification('Failed to export playlist', 'error');
        }
    }

    showCreatePlaylistModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Create New Playlist</h2>
                <input type="text" id="playlist-name" placeholder="Playlist name" autofocus>
                <textarea id="playlist-description" placeholder="Description (optional)"></textarea>
                <div class="modal-buttons">
                    <button onclick="playlistDB.closeModal(this)">Cancel</button>
                    <button onclick="playlistDB.createPlaylistFromModal(this)">Create</button>
                </div>
            </div>
        ";
        document.body.appendChild(modal);

        // Focus on input
        modal.querySelector('#playlist-name').focus();

        // Enter to submit
        modal.querySelector('#playlist-name').addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                this.createPlaylistFromModal(modal);
            }
        });
    }

    async createPlaylistFromModal(modalElement) {
        const modal = modalElement.closest('.modal');
        const name = modal.querySelector('#playlist-name').value.trim();
        const description = modal.querySelector('#playlist-description').value.trim();

        if (!name) {
            alert('Please enter a playlist name');
            return;
        }

        await this.createPlaylist(name, description);
        this.closeModal(modal);
    }

    closeModal(modalElement) {
        const modal = modalElement.closest('.modal');
        if (modal) {
            modal.remove();
        }
    }

    showPlaylistContextMenu(event, playlistId) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;

        menu.innerHTML = `
            <div class="context-menu-item" onclick="playlistDB.playPlaylist(${playlistId})">
                ▶️ Play
            </div>
            <div class="context-menu-item" onclick="playlistDB.duplicatePlaylist(${playlistId})">
                📋 Duplicate
            </div>
            <div class="context-menu-item" onclick="playlistDB.analyzePlaylist(${playlistId})">
                📊 Analyze
            </div>
            <div class="context-menu-item" onclick="playlistDB.exportPlaylist(${playlistId})">
                📤 Export
            </div>
            <hr>
            <div class="context-menu-item" onclick="playlistDB.deletePlaylist(${playlistId})">
                🗑️ Delete
            </div>
        ";

        document.body.appendChild(menu);

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 0);
    }

    showAnalyticsModal(analytics) {
        // Implementation for analytics modal
    }

    async showExportFormatDialog() {
        // Simple prompt for now, could be a modal
        const formats = ['json', 'csv', 'm3u', 'rekordbox', 'serato'];
        const format = prompt(`Export format?\n${formats.join(`, ')}');
        return formats.includes(format) ? format : null;
    }

    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
        }
    }

    formatDuration(seconds) {
        if (!seconds) {
            return '0:00';
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}';
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}';
    }

    generateRandomColor() {
        const colors = [
            '#667eea',
            '#764ba2',
            '#f093fb',
            '#fda085',
            '#84fab0',
            '#8fd3f4',
            '#a8edea',
            '#fed6e3',
            '#ffeaa7',
            '#fd79a8',
            '#fdcb6e',
            '#6c5ce7'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize playlist database UI
window.playlistDB = new PlaylistDatabaseUI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistDatabaseUI;
}
