// Audio IPC Bridge - Connects frontend audio player with Electron backend
class AudioIPCBridge {
    constructor() {
        this.currentTrack = null;
        this.isPlaying = false;
        this.volume = 1.0;
        this.currentTime = 0;
        this.duration = 0;
        this.queue = [];
        this.queueIndex = -1;

        // Reference to Howler instance
        this.howl = null;

        this.init();
    }

    init() {
        this.setupIPCListeners();
        this.connectToSimplePlayer();
        this.setupUIEventListeners();
    }

    setupIPCListeners() {
        if (!window.electronAPI) {
            console.warn('Electron API not available');
            return;
        }

        // Listen for play commands from backend
        window.electronAPI.on('play-audio', data => {
            this.playTrack(data.track, data.filePath, data.volume, data.crossfade);
        });

        window.electronAPI.on('pause-audio', () => {
            this.pause();
        });

        window.electronAPI.on('resume-audio', () => {
            this.resume();
        });

        window.electronAPI.on('stop-audio', () => {
            this.stop();
        });

        window.electronAPI.on('set-volume', volume => {
            this.setVolume(volume);
        });

        window.electronAPI.on('seek-audio', position => {
            this.seek(position);
        });

        // State updates from backend
        window.electronAPI.on('player-state-update', state => {
            this.updatePlayerState(state);
        });

        window.electronAPI.on('queue-updated', data => {
            this.queue = data.queue;
            this.queueIndex = data.queueIndex;
            this.updateQueueUI();
        });
    }

    connectToSimplePlayer() {
        // Connect to existing simple-player.js
        if (window.simplePlayer) {
            // Override play method
            const originalPlay = window.simplePlayer.play;
            window.simplePlayer.play = async track => {
                // Send to backend
                await this.sendPlayCommand(track);
            };

            // Override pause method
            const originalPause = window.simplePlayer.pause;
            window.simplePlayer.pause = async () => {
                await this.sendPauseCommand();
            };

            // Connect volume
            const originalSetVolume = window.simplePlayer.setVolume;
            window.simplePlayer.setVolume = async volume => {
                await this.sendVolumeCommand(volume);
            };
        }
    }

    setupUIEventListeners() {
        // Play/pause button
        const playPauseBtn = document.querySelector('.play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (this.isPlaying) {
                    this.sendPauseCommand();
                } else {
                    this.sendResumeCommand();
                }
            });
        }

        // Next button
        const nextBtn = document.querySelector('.next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.sendNextCommand();
            });
        }

        // Previous button
        const prevBtn = document.querySelector('.prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.sendPreviousCommand();
            });
        }

        // Volume slider
        const volumeSlider = document.querySelector('.volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', e => {
                this.sendVolumeCommand(parseFloat(e.target.value));
            });
        }

        // Progress bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', e => {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const position = percent * this.duration;
                this.sendSeekCommand(position);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            // Don't trigger if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (this.isPlaying) {
                        this.sendPauseCommand();
                    } else {
                        this.sendResumeCommand();
                    }
                    break;
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        this.sendNextCommand();
                    } else {
                        // Seek forward 10 seconds
                        this.sendSeekCommand(Math.min(this.currentTime + 10, this.duration));
                    }
                    break;
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        this.sendPreviousCommand();
                    } else {
                        // Seek backward 10 seconds
                        this.sendSeekCommand(Math.max(this.currentTime - 10, 0));
                    }
                    break;
                case 'ArrowUp':
                    // Volume up
                    this.sendVolumeCommand(Math.min(this.volume + 0.1, 1));
                    break;
                case 'ArrowDown':
                    // Volume down
                    this.sendVolumeCommand(Math.max(this.volume - 0.1, 0));
                    break;
            }
        });
    }

    // Play track with Howler
    playTrack(track, filePath, volume, crossfade) {
        // Stop current track
        if (this.howl) {
            this.howl.unload();
        }

        this.currentTrack = track;
        this.volume = volume || 1.0;

        // Create new Howl instance
        this.howl = new Howl({
            src: [filePath],
            volume: this.volume,
            html5: true, // Enable HTML5 Audio for large files
            autoplay: true,
            preload: true,
            onload: () => {
                this.duration = this.howl.duration();
                this.updateDurationUI();
            },
            onplay: () => {
                this.isPlaying = true;
                this.updatePlayPauseUI();
                this.startProgressUpdate();
            },
            onpause: () => {
                this.isPlaying = false;
                this.updatePlayPauseUI();
                this.stopProgressUpdate();
            },
            onstop: () => {
                this.isPlaying = false;
                this.currentTime = 0;
                this.updatePlayPauseUI();
                this.stopProgressUpdate();
            },
            onend: () => {
                this.isPlaying = false;
                this.updatePlayPauseUI();
                this.stopProgressUpdate();
                // Auto-play next track
                this.sendNextCommand();
            },
            onseek: () => {
                this.currentTime = this.howl.seek();
                this.updateProgressUI();
            }
        });

        // Update UI with track info
        this.updateTrackInfoUI(track);
    }

    pause() {
        if (this.howl && this.isPlaying) {
            this.howl.pause();
        }
    }

    resume() {
        if (this.howl && !this.isPlaying) {
            this.howl.play();
        }
    }

    stop() {
        if (this.howl) {
            this.howl.stop();
        }
    }

    setVolume(volume) {
        this.volume = volume;
        if (this.howl) {
            this.howl.volume(volume);
        }
        this.updateVolumeUI();
    }

    seek(position) {
        if (this.howl) {
            this.howl.seek(position);
        }
    }

    // Send commands to backend
    async sendPlayCommand(track) {
        if (window.electronAPI) {
            if (track.id) {
                await window.electronAPI.invoke('play-track', track.id);
            } else if (track.file_path) {
                await window.electronAPI.invoke('play-file', track.file_path);
            }
        }
    }

    async sendPauseCommand() {
        if (window.electronAPI) {
            await window.electronAPI.invoke('pause');
        }
    }

    async sendResumeCommand() {
        if (window.electronAPI) {
            await window.electronAPI.invoke('resume');
        }
    }

    async sendStopCommand() {
        if (window.electronAPI) {
            await window.electronAPI.invoke('stop');
        }
    }

    async sendNextCommand() {
        if (window.electronAPI) {
            await window.electronAPI.invoke('next');
        }
    }

    async sendPreviousCommand() {
        if (window.electronAPI) {
            await window.electronAPI.invoke('previous');
        }
    }

    async sendVolumeCommand(volume) {
        if (window.electronAPI) {
            await window.electronAPI.invoke('set-volume', volume);
        }
    }

    async sendSeekCommand(position) {
        if (window.electronAPI) {
            await window.electronAPI.invoke('seek', position);
        }
    }

    // UI update methods
    updatePlayerState(state) {
        this.currentTrack = state.currentTrack;
        this.isPlaying = state.isPlaying;
        this.volume = state.volume;
        this.currentTime = state.currentTime;
        this.duration = state.duration;

        this.updateTrackInfoUI(state.currentTrack);
        this.updatePlayPauseUI();
        this.updateVolumeUI();
        this.updateProgressUI();
    }

    updateTrackInfoUI(track) {
        if (!track) {
            return;
        }

        // Update track title
        const titleEl = document.querySelector('.current-track-title');
        if (titleEl) {
            titleEl.textContent = track.title || track.file_name || 'Unknown';
        }

        // Update artist
        const artistEl = document.querySelector('.current-track-artist');
        if (artistEl) {
            artistEl.textContent = track.artist || 'Unknown Artist';
        }

        // Update album
        const albumEl = document.querySelector('.current-track-album');
        if (albumEl) {
            albumEl.textContent = track.album || '';
        }

        // Update artwork
        const artworkEl = document.querySelector('.current-track-artwork');
        if (artworkEl && track.artwork_path) {
            artworkEl.src = track.artwork_path;
        }

        // Update player bar
        const playerBar = document.querySelector('.player-bar');
        if (playerBar) {
            playerBar.classList.add('active');
        }
    }

    updatePlayPauseUI() {
        const playPauseBtn = document.querySelector('.play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = this.isPlaying ? '⏸' : '▶';
            playPauseBtn.title = this.isPlaying ? 'Pause' : 'Play';
        }
    }

    updateVolumeUI() {
        const volumeSlider = document.querySelector('.volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume;
        }

        const volumeValue = document.querySelector('.volume-value');
        if (volumeValue) {
            volumeValue.textContent = Math.round(this.volume * 100) + '%';
        }
    }

    updateProgressUI() {
        const progressBar = document.querySelector('.progress-fill');
        if (progressBar && this.duration > 0) {
            const percent = (this.currentTime / this.duration) * 100;
            progressBar.style.width = percent + '%';
        }

        const currentTimeEl = document.querySelector('.current-time');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.currentTime);
        }

        const durationEl = document.querySelector('.duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.duration);
        }
    }

    updateDurationUI() {
        const durationEl = document.querySelector('.duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.duration);
        }
    }

    updateQueueUI() {
        const queueContainer = document.querySelector('.queue-container');
        if (queueContainer) {
            queueContainer.innerHTML = this.queue
                .map(
                    (track, index) => `
                <div class="queue-item ${index === this.queueIndex ? 'active' : ''}" 
                     data-index="${index}">
                    <span class="queue-position">${index + 1}</span>
                    <span class="queue-title">${track.title || track.file_name}</span>
                    <span class="queue-artist">${track.artist || ''}</span>
                </div>
            ')
                .join('');
        }

        const queueCount = document.querySelector('.queue-count');
        if (queueCount) {
            queueCount.textContent = `${this.queueIndex + 1} / ${this.queue.length}`;
        }
    }

    startProgressUpdate() {
        this.stopProgressUpdate(); // Clear any existing interval

        this.progressInterval = setInterval(() => {
            if (this.howl && this.isPlaying) {
                this.currentTime = this.howl.seek();
                this.updateProgressUI();
            }
        }, 100); // Update every 100ms
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) {
            return '0:00';
        }

        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}';
    }
}

// Initialize audio IPC bridge
window.audioIPCBridge = new AudioIPCBridge();

// Make it globally accessible
window.audioPlayer = window.audioIPCBridge;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioIPCBridge;
}
