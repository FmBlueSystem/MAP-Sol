// Shared Player State Manager
// Maintains playback state across different screens (Library, Playlists, etc.)

class SharedPlayerState {
    constructor() {
        this.state = {
            currentTrack: null,
            queue: [],
            queueIndex: -1,
            isPlaying: false,
            volume: 0.7,
            currentTime: 0,
            duration: 0,
            shuffle: false,
            repeat: 'none', // 'none', 'one', 'all'
            source: null, // 'library', 'playlist', 'search', etc.
        };

        this.listeners = new Set();
        this.init();
    }

    init() {
        // Load persisted state
        this.loadState();

        // Setup IPC communication
        this.setupIPC();

        // Setup storage listeners for cross-tab sync
        this.setupStorageSync();

        // Save state periodically
        setInterval(() => this.saveState(), 5000);
    }

    setupIPC() {
        if (!window.electronAPI) {
            return;
        }

        const { ipcRenderer } = require('electron');

        // Listen for state updates from other windows
        ipcRenderer.on('player-state-update', (event, newState) => {
            this.updateState(newState);
            this.notifyListeners();
        });

        // Listen for playback commands
        ipcRenderer.on('player-command', (event, command) => {
            this.handleCommand(command);
        });
    }

    setupStorageSync() {
        // Use localStorage for cross-tab communication
        window.addEventListener('storage', (e) => {
            if (e.key === 'playerState' && e.newValue) {
                try {
                    const newState = JSON.parse(e.newValue);
                    this.state = { ...this.state, ...newState };
                    this.notifyListeners();
                } catch (error) {
                    console.error('Error parsing player state:', error);
                }
            }
        });
    }

    // State Management
    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveState();
        this.broadcastState();
    }

    getState() {
        return { ...this.state };
    }

    saveState() {
        try {
            // Save to localStorage for persistence
            localStorage.setItem('playerState', JSON.stringify(this.state));

            // Save to session storage for current session
            sessionStorage.setItem('playerState', JSON.stringify(this.state));
        } catch (error) {
            console.error('Error saving player state:', error);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('playerState') || sessionStorage.getItem('playerState');
            if (saved) {
                this.state = { ...this.state, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Error loading player state:', error);
        }
    }

    broadcastState() {
        if (window.electronAPI) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('broadcast-player-state', this.state);
        }
    }

    // Playback Control
    play(track = null) {
        if (track) {
            this.state.currentTrack = track;
            this.state.isPlaying = true;
            this.state.currentTime = 0;
        } else if (this.state.currentTrack) {
            this.state.isPlaying = true;
        }

        this.updateState(this.state);
        this.executePlay();
    }

    pause() {
        this.state.isPlaying = false;
        this.updateState(this.state);
        this.executePause();
    }

    next() {
        if (this.state.shuffle) {
            this.playRandom();
        } else {
            this.playNext();
        }
    }

    previous() {
        if (this.state.currentTime > 3) {
            // If more than 3 seconds, restart current track
            this.seek(0);
        } else {
            this.playPrevious();
        }
    }

    playNext() {
        if (this.state.queue.length === 0) {
            return;
        }

        let nextIndex = this.state.queueIndex + 1;

        if (nextIndex >= this.state.queue.length) {
            if (this.state.repeat === 'all') {
                nextIndex = 0;
            } else {
                return; // End of queue
            }
        }

        this.state.queueIndex = nextIndex;
        this.state.currentTrack = this.state.queue[nextIndex];
        this.play(this.state.currentTrack);
    }

    playPrevious() {
        if (this.state.queue.length === 0) {
            return;
        }

        let prevIndex = this.state.queueIndex - 1;

        if (prevIndex < 0) {
            if (this.state.repeat === 'all') {
                prevIndex = this.state.queue.length - 1;
            } else {
                prevIndex = 0; // Stay at beginning
            }
        }

        this.state.queueIndex = prevIndex;
        this.state.currentTrack = this.state.queue[prevIndex];
        this.play(this.state.currentTrack);
    }

    playRandom() {
        if (this.state.queue.length === 0) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.state.queue.length);
        this.state.queueIndex = randomIndex;
        this.state.currentTrack = this.state.queue[randomIndex];
        this.play(this.state.currentTrack);
    }

    // Queue Management
    setQueue(tracks, startIndex = 0) {
        this.state.queue = tracks;
        this.state.queueIndex = startIndex;

        if (tracks.length > 0 && startIndex < tracks.length) {
            this.state.currentTrack = tracks[startIndex];
        }

        this.updateState(this.state);
    }

    addToQueue(track) {
        this.state.queue.push(track);
        this.updateState(this.state);
    }

    clearQueue() {
        this.state.queue = [];
        this.state.queueIndex = -1;
        this.updateState(this.state);
    }

    // Volume Control
    setVolume(volume) {
        this.state.volume = Math.max(0, Math.min(1, volume));
        this.updateState(this.state);
        this.executeVolumeChange();
    }

    // Seek Control
    seek(time) {
        this.state.currentTime = time;
        this.updateState(this.state);
        this.executeSeek();
    }

    // Playback Mode
    toggleShuffle() {
        this.state.shuffle = !this.state.shuffle;
        this.updateState(this.state);
    }

    cycleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.state.repeat);
        this.state.repeat = modes[(currentIndex + 1) % modes.length];
        this.updateState(this.state);
    }

    // Command Handling
    handleCommand(command) {
        switch (command.action) {
            case 'play':
                this.play(command.track);
                break;
            case 'pause':
                this.pause();
                break;
            case 'next':
                this.next();
                break;
            case 'previous':
                this.previous();
                break;
            case 'seek':
                this.seek(command.time);
                break;
            case 'volume':
                this.setVolume(command.volume);
                break;
            case 'queue':
                this.setQueue(command.tracks, command.startIndex);
                break;
            case 'shuffle':
                this.toggleShuffle();
                break;
            case 'repeat':
                this.cycleRepeat();
                break;
        }
    }

    // Execution Methods (to be implemented by actual player)
    executePlay() {
        // This will be connected to the actual audio player
        if (window.player && this.state.currentTrack) {
            window.player.playTrack(this.state.currentTrack);
        }
    }

    executePause() {
        if (window.player) {
            window.player.pause();
        }
    }

    executeVolumeChange() {
        if (window.player) {
            window.player.setVolume(this.state.volume);
        }
    }

    executeSeek() {
        if (window.player) {
            window.player.seek(this.state.currentTime);
        }
    }

    // Event System
    addListener(callback) {
        this.listeners.add(callback);
    }

    removeListener(callback) {
        this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach((callback) => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Error in player state listener:', error);
            }
        });
    }

    // Utility Methods
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) {
            return '0:00';
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getProgress() {
        if (!this.state.duration) {
            return 0;
        }
        return (this.state.currentTime / this.state.duration) * 100;
    }

    isTrackInQueue(trackId) {
        return this.state.queue.some((track) => track.id === trackId);
    }

    getCurrentTrackIndex() {
        return this.state.queueIndex;
    }

    getQueueLength() {
        return this.state.queue.length;
    }
}

// Create singleton instance
window.sharedPlayerState = new SharedPlayerState();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedPlayerState;
}
