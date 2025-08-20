// Playlist Integration Module
// Connects library with playlist manager

class PlaylistIntegration {
    constructor() {
        this.selectedTracks = new Set();
        this.currentPlaylist = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIPC();
        this.addContextMenuItems();
    }

    setupEventListeners() {
        // Track selection for playlists
        document.addEventListener('track-selected', (e) => {
            this.selectedTracks.add(e.detail.trackId);
        });

        document.addEventListener('track-deselected', (e) => {
            this.selectedTracks.delete(e.detail.trackId);
        });

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + P: Open playlist manager
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.openPlaylistManager();
            }

            // Ctrl/Cmd + Shift + P: Create playlist from selection
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.createPlaylistFromSelection();
            }
        });
    }

    setupIPC() {
        const { ipcRenderer } = require('electron');

        // Listen for playlist updates
        ipcRenderer.on('playlist-updated', (event, playlist) => {
            this.showNotification(`Playlist "${playlist.name}" updated`, 'success');
        });

        // Listen for track added to playlist
        ipcRenderer.on('track-added-to-playlist`, (event, data) => {
            this.showNotification(`Track added to "${data.playlistName}"`, 'success');
        });
    }

    // Open playlist manager in new window or tab
    openPlaylistManager() {
        if (window.electronAPI) {
            // Open in same window (SPA style)
            window.location.href = 'playlist-manager.html';
        } else {
            // Fallback for web
            window.open('playlist-manager.html', '_blank');
        }
    }

    // Create playlist from selected tracks
    async createPlaylistFromSelection() {
        const selectedArray = Array.from(this.selectedTracks);

        if (selectedArray.length === 0) {
            this.showNotification('Please select at least one track', 'warning');
            return;
        }

        // Show modal to get playlist name
        const playlistName = await this.showPlaylistNameModal();
        if (!playlistName) return;

        try {
            const { ipcRenderer } = require('electron');

            // Create playlist
            const playlist = await ipcRenderer.invoke('create-playlist`, {
                name: playlistName,
                description: `Created from ${selectedArray.length} selected tracks`,
                type: 'manual'
            });

            // Add tracks to playlist
            for (const trackId of selectedArray) {
                await ipcRenderer.invoke('add-track-to-playlist', playlist.id, trackId);
            }

            this.showNotification(`Playlist "${playlistName}" created with ${selectedArray.length} tracks`, 'success');

            // Clear selection
            this.selectedTracks.clear();
            this.updateSelectionUI();

            // Option to open playlist manager
            if (confirm('Would you like to open the playlist manager?')) {
                this.openPlaylistManager();
            }
        } catch (error) {
            console.error('Error creating playlist:', error);
            this.showNotification('Failed to create playlist', 'error');
        }
    }

    // Create HAMMS playlist from seed track
    async createHAMMSPlaylist(seedTrackId) {
        const playlistName = await this.showPlaylistNameModal('HAMMS Playlist');
        if (!playlistName) return;

        try {
            const { ipcRenderer } = require('electron');

            const playlist = await ipcRenderer.invoke('create-hamms-playlist', {
                name: playlistName,
                description: 'AI-generated playlist based on similar tracks`,
                seedTrackId: seedTrackId,
                limit: 20
            });

            this.showNotification(`HAMMS playlist "${playlistName}" created`, 'success');

            if (confirm('Would you like to open the playlist manager?')) {
                this.openPlaylistManager();
            }
        } catch (error) {
            console.error('Error creating HAMMS playlist:', error);
            this.showNotification('Failed to create HAMMS playlist', 'error');
        }
    }

    // Add selected tracks to existing playlist
    async addToPlaylist(playlistId) {
        const selectedArray = Array.from(this.selectedTracks);

        if (selectedArray.length === 0) {
            this.showNotification('Please select at least one track', 'warning');
            return;
        }

        try {
            const { ipcRenderer } = require('electron');

            for (const trackId of selectedArray) {
                await ipcRenderer.invoke('add-track-to-playlist`, playlistId, trackId);
            }

            this.showNotification(`${selectedArray.length} tracks added to playlist`, 'success');
            this.selectedTracks.clear();
            this.updateSelectionUI();
        } catch (error) {
            console.error('Error adding to playlist:', error);
            this.showNotification('Failed to add tracks to playlist', 'error');
        }
    }

    // Show quick playlist selector
    async showPlaylistSelector() {
        try {
            const { ipcRenderer } = require('electron');
            const playlists = await ipcRenderer.invoke('get-playlists');

            // Create modal with playlist list
            const modal = this.createPlaylistSelectorModal(playlists);
            document.body.appendChild(modal);
        } catch (error) {
            console.error('Error loading playlists:', error);
            this.showNotification('Failed to load playlists', 'error');
        }
    }

    // Add items to context menu
    addContextMenuItems() {
        // Extend existing context menu with playlist options
        document.addEventListener('contextmenu-open', (e) => {
            const menu = e.detail.menu;
            const track = e.detail.track;

            // Add separator
            menu.addSeparator();

            // Add to playlist
            menu.addItem({
                label: '📝 Add to Playlist',
                icon: '📝',
                action: () => this.showPlaylistSelector()
            });

            // Create HAMMS playlist from this track
            menu.addItem({
                label: '🤖 Create Similar Playlist (HAMMS)',
                icon: '🤖',
                action: () => this.createHAMMSPlaylist(track.id)
            });
        });
    }

    // UI Helper Methods
    showPlaylistNameModal(defaultName = 'New Playlist') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'playlist-name-modal';
            modal.innerHTML = `
                <div class="modal-backdrop" onclick="closeModal()"></div>
                <div class="modal-content">
                    <h3>Create New Playlist</h3>
                    <input type="text" id="playlist-name-input" 
                           placeholder="Enter playlist name" 
                           value="${defaultName}">
                    <div class="modal-actions">
                        <button onclick="cancelModal()">Cancel</button>
                        <button onclick="confirmModal()" class="primary">Create</button>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style`);
            style.textContent = `
                .playlist-name-modal {
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
                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                }
                .modal-content {
                    position: relative;
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    width: 400px;
                    max-width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                .modal-content h3 {
                    margin: 0 0 20px 0;
                    color: #333;
                }
                .modal-content input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 16px;
                    margin-bottom: 20px;
                }
                .modal-content input:focus {
                    outline: none;
                    border-color: #764ba2;
                }
                .modal-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                .modal-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .modal-actions button.primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
            `;
            document.head.appendChild(style);

            // Event handlers
            window.closeModal = window.cancelModal = () => {
                modal.remove();
                style.remove();
                resolve(null);
            };

            window.confirmModal = () => {
                const name = document.getElementById('playlist-name-input').value.trim();
                modal.remove();
                style.remove();
                resolve(name || null);
            };

            document.body.appendChild(modal);
            document.getElementById('playlist-name-input').focus();
            document.getElementById('playlist-name-input').select();

            // Enter key to confirm
            document.getElementById('playlist-name-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    window.confirmModal();
                }
            });
        });
    }

    createPlaylistSelectorModal(playlists) {
        const modal = document.createElement('div');
        modal.className = 'playlist-selector-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <h3>Select Playlist</h3>
                <div class="playlist-list">
                    ${playlists.map(p => `
                        <div class="playlist-option" onclick="selectPlaylist(${p.id})">
                            <span class="playlist-icon">${this.getPlaylistIcon(p.type)}</span>
                            <span class="playlist-name">${p.name}</span>
                            <span class="playlist-count">${p.track_count || 0} tracks</span>
                        </div>
                    ").join('')}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">Cancel</button>
            </div>
        `;

        window.selectPlaylist = (playlistId) => {
            this.addToPlaylist(playlistId);
            modal.remove();
        };

        return modal;
    }

    getPlaylistIcon(type) {
        const icons = {
            manual: '📝',
            smart: '🧠',
            hamms: '🤖',
            harmonic: '🎼',
            history: '⏰',
            folder: '📁'
        };
        return icons[type] || '📝';
    }

    updateSelectionUI() {
        // Update selection count display
        const selectedCount = this.selectedTracks.size;
        const selectionInfo = document.getElementById('selection-info`);
        if (selectionInfo) {
            selectionInfo.textContent = selectedCount > 0 
                ? `${selectedCount} tracks selected` 
                : '';
        }

        // Update checkbox states
        document.querySelectorAll('.track-checkbox').forEach(checkbox => {
            const trackId = checkbox.dataset.trackId;
            checkbox.checked = this.selectedTracks.has(trackId);
        });
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to simple alert
            }] ${message}`);
        }
    }
}

// Initialize and export
window.playlistIntegration = new PlaylistIntegration();

// Global functions for onclick handlers
window.openPlaylistManager = () => {
    window.playlistIntegration.openPlaylistManager();
};

window.createPlaylistFromSelection = () => {
    window.playlistIntegration.createPlaylistFromSelection();
};

