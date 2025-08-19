// Playlist Keyboard Shortcuts Module
// Adds keyboard shortcuts for playlist operations

class PlaylistShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        this.registerShortcuts();
        this.setupListeners();
    }

    registerShortcuts() {
        // Playlist Management
        this.shortcuts.set('ctrl+p', {
            description: 'Open playlist manager',
            action: () => this.openPlaylistManager()
        });

        this.shortcuts.set('ctrl+shift+p', {
            description: 'Create playlist from selection',
            action: () => this.createPlaylistFromSelection()
        });

        this.shortcuts.set('ctrl+n', {
            description: 'New playlist',
            action: () => this.createNewPlaylist()
        });

        this.shortcuts.set('ctrl+shift+s', {
            description: 'Save current queue as playlist',
            action: () => this.saveQueueAsPlaylist()
        });

        // Quick Playlist Actions
        this.shortcuts.set('ctrl+1', {
            description: 'Add to playlist 1',
            action: () => this.addToQuickPlaylist(1)
        });

        this.shortcuts.set('ctrl+2', {
            description: 'Add to playlist 2',
            action: () => this.addToQuickPlaylist(2)
        });

        this.shortcuts.set('ctrl+3', {
            description: 'Add to playlist 3',
            action: () => this.addToQuickPlaylist(3)
        });

        // HAMMS Actions
        this.shortcuts.set('ctrl+h', {
            description: 'Create HAMMS playlist from current track',
            action: () => this.createHAMMSFromCurrent()
        });

        this.shortcuts.set('ctrl+shift+h', {
            description: 'Find similar tracks (HAMMS)',
            action: () => this.findSimilarTracks()
        });

        // Navigation
        this.shortcuts.set('alt+1', {
            description: 'Switch to Library view',
            action: () => this.switchToLibrary()
        });

        this.shortcuts.set('alt+2', {
            description: 'Switch to Playlists view',
            action: () => this.switchToPlaylists()
        });

        // Selection
        this.shortcuts.set('ctrl+a', {
            description: 'Select all tracks',
            action: () => this.selectAll()
        });

        this.shortcuts.set('ctrl+d', {
            description: 'Deselect all',
            action: () => this.deselectAll()
        });

        this.shortcuts.set('ctrl+i', {
            description: 'Invert selection',
            action: () => this.invertSelection()
        });
    }

    setupListeners() {
        document.addEventListener('keydown', (e) => {
            // Build shortcut key
            let key = '';
            if (e.ctrlKey || e.metaKey) key += 'ctrl+';
            if (e.shiftKey) key += 'shift+';
            if (e.altKey) key += 'alt+';

            // Add the actual key (lowercase)
            if (e.key.length === 1) {
                key += e.key.toLowerCase();
            } else {
                // Special keys
                const specialKeys = {
                    'Enter': 'enter',
                    'Escape': 'esc',
                    'Delete': 'del',
                    'Backspace': 'backspace',
                    'Tab': 'tab',
                    ' ': 'space'
                };
                key += specialKeys[e.key] || e.key.toLowerCase();
            }

            // Check if shortcut exists
            if (this.shortcuts.has(key)) {
                e.preventDefault();
                const shortcut = this.shortcuts.get(key);

                try {
                    shortcut.action();
                    this.showShortcutFeedback(shortcut.description);
                } catch (error) {
                    console.error(`Error executing shortcut ${key}:`, error);
                }
            }
        });
    }

    // Playlist Actions
    openPlaylistManager() {
        if (window.playlistIntegration) {
            window.playlistIntegration.openPlaylistManager();
        } else {
            window.location.href = 'playlist-manager.html';
        }
    }

    createPlaylistFromSelection() {
        if (window.playlistIntegration) {
            window.playlistIntegration.createPlaylistFromSelection();
        }
    }

    createNewPlaylist() {
        if (window.location.pathname.includes('playlist-manager')) {
            // If in playlist manager, show create modal
            if (window.showCreateModal) {
                window.showCreateModal();
            }
        } else {
            // Otherwise, open playlist manager with create modal
            this.openPlaylistManager();
            setTimeout(() => {
                if (window.showCreateModal) {
                    window.showCreateModal();
                }
            }, 500);
        }
    }

    async saveQueueAsPlaylist() {
        if (!window.sharedPlayerState) return;

        const queue = window.sharedPlayerState.getState().queue;
        if (queue.length === 0) {
            this.showNotification('No tracks in queue', 'warning');
            return;
        }

        const name = prompt('Enter playlist name:', `Queue - ${new Date().toLocaleDateString()}`);
        if (!name) return;

        try {
            const { ipcRenderer } = require('electron');

            // Create playlist
            const playlist = await ipcRenderer.invoke('create-playlist', {
                name: name,
                description: `Saved queue with ${queue.length} tracks`,
                type: 'manual'
            });

            // Add tracks
            for (const track of queue) {
                await ipcRenderer.invoke('add-track-to-playlist', playlist.id, track.id);
            }

            this.showNotification(`Queue saved as "${name}"", 'success');
        } catch (error) {
            console.error('Error saving queue:', error);
            this.showNotification('Failed to save queue', 'error');
        }
    }

    async addToQuickPlaylist(number) {
        // Get or create quick playlist
        const playlistName = `Quick Playlist ${number}`;

        try {
            const { ipcRenderer } = require('electron');

            // Get all playlists
            const playlists = await ipcRenderer.invoke('get-playlists');
            let playlist = playlists.find(p => p.name === playlistName);

            // Create if doesn't exist
            if (!playlist) {
                playlist = await ipcRenderer.invoke('create-playlist', {
                    name: playlistName,
                    description: `Quick playlist for keyboard shortcut Ctrl+${number}`,
                    type: 'manual'
                });
            }

            // Add selected tracks
            if (window.playlistIntegration) {
                const selectedTracks = Array.from(window.playlistIntegration.selectedTracks);
                for (const trackId of selectedTracks) {
                    await ipcRenderer.invoke('add-track-to-playlist', playlist.id, trackId);
                }
                this.showNotification(`Added ${selectedTracks.length} tracks to ${playlistName}`, 'success');
            }
        } catch (error) {
            console.error('Error with quick playlist:', error);
            this.showNotification('Failed to add to quick playlist', 'error');
        }
    }

    // HAMMS Actions
    async createHAMMSFromCurrent() {
        if (!window.sharedPlayerState) return;

        const currentTrack = window.sharedPlayerState.getState().currentTrack;
        if (!currentTrack) {
            this.showNotification('No track currently playing', 'warning');
            return;
        }

        if (window.playlistIntegration) {
            window.playlistIntegration.createHAMMSPlaylist(currentTrack.id);
        }
    }

    async findSimilarTracks() {
        const currentTrack = window.sharedPlayerState?.getState().currentTrack;
        if (!currentTrack) {
            this.showNotification('No track currently playing', 'warning');
            return;
        }

        try {
            const { ipcRenderer } = require('electron');
            const similar = await ipcRenderer.invoke('get-hamms-recommendations', currentTrack.id, 10);

            // Display results (could open a modal or sidebar)

            this.showNotification(`Found ${similar.length} similar tracks`, 'success');
        } catch (error) {
            console.error('Error finding similar tracks:', error);
            this.showNotification('Failed to find similar tracks', 'error');
        }
    }

    // Navigation
    switchToLibrary() {
        if (!window.location.pathname.includes('index')) {
            window.location.href = 'index-with-search.html';
        }
    }

    switchToPlaylists() {
        if (!window.location.pathname.includes('playlist-manager')) {
            window.location.href = 'playlist-manager.html';
        }
    }

    // Selection
    selectAll() {
        document.querySelectorAll('.track-checkbox, .track-item').forEach(element => {
            if (element.type === 'checkbox') {
                element.checked = true;
            }
            element.classList.add('selected');

            // Add to selection set
            const trackId = element.dataset.trackId;
            if (trackId && window.playlistIntegration) {
                window.playlistIntegration.selectedTracks.add(trackId);
            }
        });

        if (window.playlistIntegration) {
            window.playlistIntegration.updateSelectionUI();
        }
    }

    deselectAll() {
        document.querySelectorAll('.track-checkbox, .track-item').forEach(element => {
            if (element.type === 'checkbox') {
                element.checked = false;
            }
            element.classList.remove('selected');
        });

        if (window.playlistIntegration) {
            window.playlistIntegration.selectedTracks.clear();
            window.playlistIntegration.updateSelectionUI();
        }
    }

    invertSelection() {
        document.querySelectorAll('.track-checkbox, .track-item').forEach(element => {
            const trackId = element.dataset.trackId;
            if (!trackId) return;

            if (element.type === 'checkbox') {
                element.checked = !element.checked;
            }
            element.classList.toggle('selected');

            // Toggle in selection set
            if (window.playlistIntegration) {
                if (window.playlistIntegration.selectedTracks.has(trackId)) {
                    window.playlistIntegration.selectedTracks.delete(trackId);
                } else {
                    window.playlistIntegration.selectedTracks.add(trackId);
                }
            }
        });

        if (window.playlistIntegration) {
            window.playlistIntegration.updateSelectionUI();
        }
    }

    // UI Feedback
    showShortcutFeedback(action) {
        // Create a small toast showing the action
        const toast = document.createElement('div');
        toast.className = 'shortcut-feedback';
        toast.textContent = action;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            z-index: 10000;
            animation: fadeInOut 2s ease;
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
            style.remove();
        }, 2000);
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else if (window.showToast) {
            window.showToast(message, type);
        } else {
            }] ${message}');
        }
    }

    // Help/Documentation
    showShortcutsList() {
        const shortcuts = Array.from(this.shortcuts.entries()).map(([key, value]) => {
            return `${key.toUpperCase().replace('+', ' + ')}: ${value.description}';
        });

        );

        // Could also show in a modal
        alert('Playlist Shortcuts:\n\n' + shortcuts.join('\n'));
    }
}

// Initialize
window.playlistShortcuts = new PlaylistShortcuts();

// Add help command
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + ? to show shortcuts list
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '?') {
        e.preventDefault();
        window.playlistShortcuts.showShortcutsList();
    }
});

');