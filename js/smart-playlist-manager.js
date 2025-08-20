// Smart Playlist Manager - Gestión de playlists inteligentes
class SmartPlaylistManager {
    constructor() {
        this.playlists = [];
        this.selectedPlaylist = null;
        this.isVisible = false;
        this.init();
    }

    init() {
        this.createManager();
        this.attachEventListeners();
        this.loadPlaylists();
    }

    createManager() {
        const managerHTML = `
            <div id="smart-playlist-manager" class="manager-modal" style="display: none;">
                <div class="manager-container">
                    <div class="manager-header">
                        <h2>📚 Smart Playlists Manager</h2>
                        <div class="header-actions">
                            <button class="btn-new" onclick="smartPlaylistWizard.open()">
                                + New Smart Playlist
                            </button>
                            <button class="close-btn" onclick="smartPlaylistManager.close()">✕</button>
                        </div>
                    </div>
                    
                    <div class="manager-content">
                        <!-- Sidebar with playlist list -->
                        <div class="playlists-sidebar">
                            <div class="sidebar-header">
                                <h3>Your Smart Playlists</h3>
                                <span class="playlist-count">0 playlists</span>
                            </div>
                            <div class="playlists-list" id="smart-playlists-list">
                                <div class="loading">Loading playlists...</div>
                            </div>
                        </div>
                        
                        <!-- Main content area -->
                        <div class="playlist-details">
                            <div id="no-playlist-selected" class="empty-state">
                                <div class="empty-icon">📋</div>
                                <h3>No Playlist Selected</h3>
                                <p>Select a playlist from the sidebar to view details</p>
                                <button class="btn-create" onclick="smartPlaylistWizard.open()">
                                    Create Your First Smart Playlist
                                </button>
                            </div>
                            
                            <div id="playlist-detail-view" style="display: none;">
                                <!-- Playlist Header -->
                                <div class="detail-header">
                                    <div class="playlist-icon">🎵</div>
                                    <div class="playlist-info">
                                        <h2 id="detail-name">--</h2>
                                        <p id="detail-description">--</p>
                                    </div>
                                    <div class="playlist-actions">
                                        <button class="action-btn" onclick="smartPlaylistManager.editPlaylist()">
                                            ✏️ Edit
                                        </button>
                                        <button class="action-btn" onclick="smartPlaylistManager.updatePlaylist()">
                                            🔄 Update
                                        </button>
                                        <button class="action-btn danger" onclick="smartPlaylistManager.deletePlaylist()">
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Statistics -->
                                <div class="playlist-stats">
                                    <div class="stat-card">
                                        <div class="stat-icon">🎵</div>
                                        <div class="stat-info">
                                            <span class="stat-value" id="stat-tracks">0</span>
                                            <span class="stat-label">Tracks</span>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⏱️</div>
                                        <div class="stat-info">
                                            <span class="stat-value" id="stat-duration">0:00</span>
                                            <span class="stat-label">Duration</span>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">🎹</div>
                                        <div class="stat-info">
                                            <span class="stat-value" id="stat-bpm">--</span>
                                            <span class="stat-label">Avg BPM</span>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⚡</div>
                                        <div class="stat-info">
                                            <span class="stat-value" id="stat-energy">--</span>
                                            <span class="stat-label">Avg Energy</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Rules Display -->
                                <div class="rules-section">
                                    <h3>Playlist Rules</h3>
                                    <div class="rules-display" id="rules-display">
                                        <!-- Rules will be displayed here -->
                                    </div>
                                </div>
                                
                                <!-- Settings -->
                                <div class="settings-section">
                                    <h3>Settings</h3>
                                    <div class="settings-list">
                                        <div class="setting-item">
                                            <label class="switch-label">
                                                <input type="checkbox" id="setting-auto-update" disabled>
                                                <span class="switch"></span>
                                                <span>Auto-update when new tracks match</span>
                                            </label>
                                        </div>
                                        <div class="setting-item">
                                            <span class="setting-label">Sort by:</span>
                                            <span class="setting-value" id="setting-sort">--</span>
                                        </div>
                                        <div class="setting-item">
                                            <span class="setting-label">Max tracks:</span>
                                            <span class="setting-value" id="setting-max">--</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Track Preview -->
                                <div class="tracks-preview">
                                    <h3>Track Preview <span class="preview-count">(showing first 20)</span></h3>
                                    <div class="preview-tracks-list" id="manager-preview-tracks">
                                        <!-- Tracks will be displayed here -->
                                    </div>
                                </div>
                                
                                <!-- Actions -->
                                <div class="detail-actions">
                                    <button class="btn-action" onclick="smartPlaylistManager.playPlaylist()">
                                        ▶️ Play All
                                    </button>
                                    <button class="btn-action" onclick="smartPlaylistManager.queuePlaylist()">
                                        ➕ Add to Queue
                                    </button>
                                    <button class="btn-action" onclick="smartPlaylistManager.exportPlaylist()">
                                        💾 Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = managerHTML;
        document.body.appendChild(container.firstElementChild);
        this.manager = document.getElementById('smart-playlist-manager');
    }

    attachEventListeners() {
        // Close on ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.isVisible) {
                this.close();
            }
        });

        // Refresh when new playlist created
        document.addEventListener('smartPlaylistCreated', () => {
            this.loadPlaylists();
        });
    }

    async loadPlaylists() {
        try {
            const response = await window.api.invoke('get-smart-playlists');
            if (response.success) {
                this.playlists = response.playlists;
                this.renderPlaylistsList();
            }
        } catch (error) {
            console.error('Error loading smart playlists:', error);
        }
    }

    renderPlaylistsList() {
        const container = document.getElementById('smart-playlists-list');
        const count = document.querySelector('.playlist-count');

        count.textContent = `${this.playlists.length} playlists`;

        if (this.playlists.length === 0) {
            container.innerHTML = `
                <div class="empty-list">
                    <p>No smart playlists yet</p>
                    <button class="btn-small" onclick="smartPlaylistWizard.open()">
                        Create One
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        this.playlists.forEach(playlist => {
            const isSelected = this.selectedPlaylist && this.selectedPlaylist.id === playlist.id;
            html += `
                <div class="playlist-item ${isSelected ? 'selected' : ''}" 
                     data-playlist-id="${playlist.id}"
                     onclick="smartPlaylistManager.selectPlaylist(${playlist.id})">
                    <span class="playlist-icon">${playlist.icon || '🎵'}</span>
                    <div class="playlist-item-info">
                        <div class="playlist-name">${playlist.name}</div>
                        <div class="playlist-meta">
                            ${playlist.rule_count || 0} rules • Updated ${this.formatDate(playlist.updated_at)}
                        </div>
                    </div>
                    <div class="playlist-status">
                        <span class="track-count">${playlist.track_count || '?'}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async selectPlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) {
            return;
        }

        this.selectedPlaylist = playlist;

        // Update selection in sidebar
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-playlist-id="${playlistId}"]`).classList.add('selected');

        // Show detail view
        document.getElementById('no-playlist-selected').style.display = 'none';
        document.getElementById('playlist-detail-view').style.display = 'block';

        // Update playlist info
        document.getElementById('detail-name').textContent = playlist.name;
        document.getElementById('detail-description').textContent = playlist.description || 'No description';
        document.querySelector('.detail-header .playlist-icon').textContent = playlist.icon || '🎵';

        // Load and display rules
        await this.loadPlaylistRules(playlistId);

        // Load preview tracks
        await this.loadPreviewTracks(playlistId);

        // Update playlist to get fresh track count
        await this.updatePlaylist(playlistId, false);
    }

    async loadPlaylistRules(playlistId) {
        // For now, display basic info
        const rulesContainer = document.getElementById('rules-display');
        rulesContainer.innerHTML = `
            <div class="rule-badge">
                <span class="rule-text">Smart rules configured</span>
            </div>
        `;
    }

    async loadPreviewTracks(playlistId) {
        const container = document.getElementById('manager-preview-tracks');
        container.innerHTML = '<div class="loading">Loading tracks...</div>';

        try {
            // Get playlist rules and preview tracks
            const response = await window.api.invoke('preview-smart-playlist', {
                playlistId: playlistId,
                limit: 20
            });

            if (response.success && response.tracks) {
                this.renderPreviewTracks(response.tracks);
                this.updateStats(response.tracks);
            }
        } catch (error) {
            console.error('Error loading preview tracks:', error);
            container.innerHTML = '<div class="error">Error loading tracks</div>';
        }
    }

    renderPreviewTracks(tracks) {
        const container = document.getElementById('manager-preview-tracks');

        if (!tracks || tracks.length === 0) {
            container.innerHTML = '<div class="no-tracks">No tracks match the criteria</div>';
            return;
        }

        let html = '';
        tracks.forEach((track, index) => {
            html += `
                <div class="preview-track-item">
                    <span class="track-num">${index + 1}</span>
                    <img src="${track.artwork_url || 'image.png'}" alt="" class="track-thumb">
                    <div class="track-info">
                        <div class="track-title">${track.title || track.file_name}</div>
                        <div class="track-artist">${track.artist || 'Unknown'}</div>
                    </div>
                    <span class="track-bpm">${track.AI_BPM || track.existing_bmp || '--'}</span>
                    <span class="track-key">${track.AI_KEY || track.existing_key || '--'}</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateStats(tracks) {
        // Update statistics
        document.getElementById('stat-tracks').textContent = tracks.length;

        // Calculate total duration
        const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        document.getElementById('stat-duration').textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        // Calculate average BPM
        const avgBpm =
            tracks.length > 0
                ? Math.round(tracks.reduce((sum, t) => sum + (t.AI_BPM || t.existing_bmp || 0), 0) / tracks.length)
                : 0;
        document.getElementById('stat-bpm').textContent = avgBpm || '--';

        // Calculate average energy
        const avgEnergy =
            tracks.length > 0
                ? ((tracks.reduce((sum, t) => sum + (t.AI_ENERGY || 0), 0) / tracks.length) * 100).toFixed(0)
                : 0;
        document.getElementById('stat-energy').textContent = avgEnergy ? `${avgEnergy}%` : '--';
    }

    async updatePlaylist(playlistId = null, showToast = true) {
        const id = playlistId || (this.selectedPlaylist ? this.selectedPlaylist.id : null);
        if (!id) {
            return;
        }

        try {
            const response = await window.api.invoke('update-smart-playlist', id);
            if (response.success) {
                if (showToast) {
                    window.showToast(`Playlist updated: ${response.trackCount} tracks`, 'success');
                }
                // Reload preview
                await this.loadPreviewTracks(id);
            }
        } catch (error) {
            console.error('Error updating playlist:', error);
            if (showToast) {
                window.showToast('Error updating playlist', 'error');
            }
        }
    }

    editPlaylist() {
        if (!this.selectedPlaylist) {
            return;
        }
        // Open wizard in edit mode (not implemented yet)
        window.showToast('Edit mode coming soon', 'info');
    }

    async deletePlaylist() {
        if (!this.selectedPlaylist) {
            return;
        }

        if (confirm(`Delete "${this.selectedPlaylist.name}"? This cannot be undone.`)) {
            try {
                // Delete playlist (handler not implemented yet)
                window.showToast('Delete functionality coming soon', 'info');
                // await window.api.invoke('delete-playlist', this.selectedPlaylist.id);
                // this.loadPlaylists();
            } catch (error) {
                console.error('Error deleting playlist:', error);
            }
        }
    }

    playPlaylist() {
        if (!this.selectedPlaylist) {
            return;
        }
        window.showToast('Playing playlist', 'success');
        // Implement play functionality
    }

    queuePlaylist() {
        if (!this.selectedPlaylist) {
            return;
        }
        window.showToast('Added to queue', 'success');
        // Implement queue functionality
    }

    exportPlaylist() {
        if (!this.selectedPlaylist) {
            return;
        }
        window.showToast('Export functionality coming soon', 'info');
        // Implement export functionality
    }

    formatDate(dateStr) {
        if (!dateStr) {
            return 'Never';
        }
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Today';
        }
        if (days === 1) {
            return 'Yesterday';
        }
        if (days < 7) {
            return `${days} days ago`;
        }
        if (days < 30) {
            return `${Math.floor(days / 7)} weeks ago`;
        }
        return date.toLocaleDateString();
    }

    open() {
        this.manager.style.display = 'flex';
        this.isVisible = true;
        this.loadPlaylists();
    }

    close() {
        this.manager.style.display = 'none';
        this.isVisible = false;
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.smartPlaylistManager = new SmartPlaylistManager();
    });
} else {
    window.smartPlaylistManager = new SmartPlaylistManager();
}
