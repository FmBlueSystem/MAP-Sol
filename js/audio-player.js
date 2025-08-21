// Simple Audio Player for Music Analyzer Pro
class AudioPlayer {
    constructor() {
        this.currentAudio = null;
        this.currentTrackId = null;
        this.currentTrackData = null;
        this.isPlaying = false;
        this.playlist = [];
        this.currentIndex = -1;

        // Auto-play management
        this.autoPlay = true;
        this.continuousPlay = true;
        this.repeatAll = false;

        // Audio processor for advanced features
        this.processor = window.audioProcessor;
        this.isProcessorConnected = false;

        // Pre-buffering for next track
        this.nextTrackUrl = null;
        this.preBufferTimeout = null;

        // Load preferences
        const savedAutoPlay = localStorage.getItem('autoPlay');
        if (savedAutoPlay !== null) {
            this.autoPlay = savedAutoPlay === 'true';
        } else {
            this.autoPlay = true;
            localStorage.setItem('autoPlay', 'true');
        }

        // Singleton pattern
        if (AudioPlayer.instance) {
            return AudioPlayer.instance;
        }
        AudioPlayer.instance = this;
    }

    play(trackPath, trackId, trackData = null, userInitiated = true) {
        // Stop previous track
        if (this.currentAudio) {
            this.stop();
        }

        // Find track data if not provided
        const numericId = Number(trackId);
        if (!trackData || !trackData.title) {
            const foundData =
                window.filteredTracks?.find((t) => t.id === numericId || t.id === trackId) ||
                window.allTracks?.find((t) => t.id === numericId || t.id === trackId);
            if (foundData) {
                trackData = foundData;
            }
        }

        this.currentTrackId = trackId;
        this.currentTrackData = trackData;

        // Create audio element
        this.currentAudio = new Audio(trackPath);
        this.currentAudio.volume = this.getVolume();
        this.currentAudio.crossOrigin = 'anonymous'; // Enable CORS for Web Audio API

        // Connect to audio processor if available
        this.connectToProcessor();

        // Debug audio settings

        // Setup event listeners
        this.currentAudio.addEventListener('loadedmetadata', () => {
            const duration = this.currentAudio.duration;
            this.updateDurationDisplay(duration);
        });

        this.currentAudio.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
            this.updateProgressBar();
        });

        this.currentAudio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updateUI(trackId, 'stopped');

            // Auto-play next track if enabled
            if (this.autoPlay) {
                // Check if we have a pre-buffered track for gapless playback
                if (this.processor?.preBufferedTrack && window.audioConfigManager?.isGaplessEnabled()) {
                    this.processor.playPreBufferedTrack();
                    // Continue with normal playNext to update UI
                }

                this.playNext();
            }
        });

        // Start pre-buffering next track when current track is near the end
        this.currentAudio.addEventListener('timeupdate', () => {
            const timeRemaining = this.currentAudio.duration - this.currentAudio.currentTime;
            const preBufferTime = window.audioConfigManager?.getPreloadTime() || 3;

            // Start pre-buffering when we're within preBufferTime of the end
            if (timeRemaining > 0 && timeRemaining <= preBufferTime && !this.nextTrackUrl && this.autoPlay) {
                this.preBufferNextTrack();
            }

            // Check for crossfade start
            const crossfadeDuration = window.audioConfigManager?.getCrossfadeDuration() || 0;
            if (crossfadeDuration > 0 && timeRemaining > 0 && timeRemaining <= crossfadeDuration) {
                this.startCrossfade();
            }
        });

        this.currentAudio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.isPlaying = false;
            this.updateUI(trackId, 'error');
        });

        // Play the audio

        this.currentAudio
            .play()
            .then(() => {
                this.isPlaying = true;
                this.updateUI(trackId, 'playing');
                this.showMiniPlayer();

                // Connect Fixed Audio Player with K-meter
                if (window.fixedAudioPlayer) {
                    try {
                        window.fixedAudioPlayer.connectToAudio(this.currentAudio);
                        window.fixedAudioPlayer.updateTrackInfo(this.currentTrackData);
                    } catch (error) {
                        console.error('Failed to connect fixed audio player:', error);
                    }
                }

                // Professional Meter Suite temporarily disabled for audio debugging
                /*
            if (window.professionalMeterSuite) {
                try {
                    window.professionalMeterSuite.connectToAudio(this.currentAudio);

                } catch (error) {
                    console.error('Failed to connect meter suite:', error);
                }
            }
            */

                // Update queue position
                if (userInitiated && this.playlist.length > 0) {
                    const index = this.playlist.findIndex((t) => t.id === trackId);
                    if (index !== -1) {
                        this.currentIndex = index;
                    }
                }
            })
            .catch((error) => {
                console.error('Playback error:', error);
                this.isPlaying = false;
            });
    }

    pause() {
        if (this.currentAudio && this.isPlaying) {
            this.currentAudio.pause();
            this.isPlaying = false;
            this.updateUI(this.currentTrackId, 'paused');
        }
    }

    resume() {
        if (this.currentAudio && !this.isPlaying) {
            this.currentAudio.play();
            this.isPlaying = true;
            this.updateUI(this.currentTrackId, 'playing');
        }
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;

            // Clean up
            this.currentAudio.removeEventListener('ended', null);
            this.currentAudio.removeEventListener('timeupdate', null);
            this.currentAudio.removeEventListener('loadedmetadata', null);
            this.currentAudio.removeEventListener('error', null);

            // Disconnect Fixed Audio Player
            if (window.fixedAudioPlayer) {
                window.fixedAudioPlayer.stop();
            }

            // Professional Meter Suite disconnection disabled for debugging
            /*
            if (window.professionalMeterSuite) {
                window.professionalMeterSuite.disconnect();
            }
            */

            this.currentAudio = null;
        }

        this.isPlaying = false;
        if (this.currentTrackId) {
            this.updateUI(this.currentTrackId, 'stopped');
        }
    }

    setVolume(value) {
        const volume = Math.max(0, Math.min(1, value));
        localStorage.setItem('playerVolume', volume);

        if (this.currentAudio) {
            this.currentAudio.volume = volume;
        }

        // Update volume display
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeDisplay) {
            volumeDisplay.textContent = Math.round(volume * 100) + '%';
        }
    }

    getVolume() {
        const saved = localStorage.getItem('playerVolume');
        return saved ? parseFloat(saved) : 0.7;
    }

    seek(percentage) {
        if (this.currentAudio && this.currentAudio.duration) {
            const time = (percentage / 100) * this.currentAudio.duration;
            this.currentAudio.currentTime = time;
        }
    }

    // Queue management
    setPlaylist(tracks, startIndex = 0) {
        this.playlist = tracks;
        this.currentIndex = startIndex;
    }

    playNext() {
        if (this.playlist.length === 0) {
            return;
        }

        this.currentIndex++;
        if (this.currentIndex >= this.playlist.length) {
            if (this.repeatAll) {
                this.currentIndex = 0;
            } else {
                return;
            }
        }

        const nextTrack = this.playlist[this.currentIndex];
        if (nextTrack) {
            this.play(nextTrack.file_path, nextTrack.id, nextTrack, false);
        }
    }

    playPrevious() {
        if (this.playlist.length === 0) {
            return;
        }

        // If more than 3 seconds into the song, restart it
        if (this.currentAudio && this.currentAudio.currentTime > 3) {
            this.currentAudio.currentTime = 0;
            return;
        }

        this.currentIndex--;
        if (this.currentIndex < 0) {
            if (this.repeatAll) {
                this.currentIndex = this.playlist.length - 1;
            } else {
                this.currentIndex = 0;
            }
        }

        const prevTrack = this.playlist[this.currentIndex];
        if (prevTrack) {
            this.play(prevTrack.file_path, prevTrack.id, prevTrack, false);
        }
    }

    toggleAutoPlay() {
        this.autoPlay = !this.autoPlay;
        localStorage.setItem('autoPlay', this.autoPlay.toString());

        // Update UI
        const autoPlayBtn = document.getElementById('auto-play-toggle');
        if (autoPlayBtn) {
            autoPlayBtn.classList.toggle('active', this.autoPlay);
            autoPlayBtn.textContent = this.autoPlay ? '🔁' : '1️⃣';
        }

        return this.autoPlay;
    }

    toggleRepeat() {
        this.repeatAll = !this.repeatAll;
        localStorage.setItem('repeatAll', this.repeatAll.toString());

        // Update UI
        const repeatBtn = document.getElementById('repeat-toggle');
        if (repeatBtn) {
            repeatBtn.classList.toggle('active', this.repeatAll);
        }

        return this.repeatAll;
    }

    // Connect audio element to Web Audio API processor
    async connectToProcessor() {
        if (!this.processor || !this.currentAudio || this.isProcessorConnected) {
            return;
        }

        try {
            // Initialize processor if needed
            if (!this.processor.isInitialized) {
                await this.processor.initialize();
            }

            // Apply current configuration
            if (window.audioConfigManager) {
                const config = window.audioConfigManager.config;
                this.processor.applyConfiguration(config);
            }

            // Connect audio element to processor
            await this.processor.connectAudioElement(this.currentAudio);
            this.isProcessorConnected = true;
        } catch (error) {
            console.warn('Could not connect to audio processor:', error);
            // Continue without processor (fallback to normal playback)
        }
    }

    // Pre-buffer next track for gapless playback
    async preBufferNextTrack() {
        if (!this.processor || !window.audioConfigManager?.isGaplessEnabled()) {
            return;
        }

        // Get next track
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextTrack = this.playlist[nextIndex];

        if (nextTrack && nextTrack.file_path) {
            this.nextTrackUrl = nextTrack.file_path;

            // Pre-buffer in processor
            await this.processor.preBufferNextTrack(nextTrack.file_path);
        }
    }

    // Start crossfade to next track
    async startCrossfade() {
        if (!this.processor || this.processor.isCrossfading) {
            return;
        }

        const crossfadeDuration = window.audioConfigManager?.getCrossfadeDuration() || 0;
        if (crossfadeDuration <= 0) {
            return;
        }

        // Get next track
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextTrack = this.playlist[nextIndex];

        if (nextTrack && nextTrack.file_path) {
            // Create next audio element
            const nextAudio = new Audio(nextTrack.file_path);
            nextAudio.volume = this.getVolume();
            nextAudio.crossOrigin = 'anonymous';

            // Connect to processor and start crossfade
            await this.processor.connectAudioElement(nextAudio);
            await this.processor.startCrossfade(crossfadeDuration);

            // Play next audio
            nextAudio.play();

            // Update UI for next track
            setTimeout(() => {
                this.currentIndex = nextIndex;
                this.currentTrackId = nextTrack.id;
                this.currentTrackData = nextTrack;
                this.updateUI(nextTrack.id, 'playing');
                this.showMiniPlayer();
            }, crossfadeDuration * 500); // Update UI halfway through crossfade
        }
    }

    // UI Updates
    updateUI(trackId, status) {
        // Update track cards
        document.querySelectorAll('.track-card').forEach((card) => {
            if (card.dataset.trackId == trackId) {
                card.classList.remove('playing', 'paused');
                if (status === 'playing' || status === 'paused') {
                    card.classList.add(status);
                }

                // Update play button
                const playBtn = card.querySelector('.play-btn');
                if (playBtn) {
                    if (status === 'playing') {
                        playBtn.innerHTML = '<span style="font-size: 16px;">⏸</span>';
                    } else {
                        playBtn.innerHTML = '<span style="font-size: 16px;">▶</span>';
                    }
                }
            } else {
                // Reset other cards
                card.classList.remove('playing', 'paused');
                const playBtn = card.querySelector('.play-btn');
                if (playBtn) {
                    playBtn.innerHTML = '<span style="font-size: 16px;">▶</span>';
                }
            }
        });

        // Update mini player
        this.updateMiniPlayer(status);
    }

    showMiniPlayer() {
        const miniPlayer = document.getElementById('mini-player');
        const playerBar = document.getElementById('player-bar');

        // CRITICAL FIX: Show player bar even if mini-player doesn't exist
        if (playerBar) {
            playerBar.style.display = 'grid'; // Use grid for proper layout
        }

        if (miniPlayer) {
            miniPlayer.style.display = 'flex';
        }

        // Update fixed player bar info
        if (this.currentTrackData) {
            // Update title
            const titleEl = document.getElementById('current-title');
            if (titleEl) {
                titleEl.textContent = this.currentTrackData.title || 'Unknown Track';
            }

            // Update artist
            const artistEl = document.getElementById('current-artist');
            if (artistEl) {
                artistEl.textContent = this.currentTrackData.artist || 'Unknown Artist';
            }

            // Update BPM and Key
            const bpmEl = document.getElementById('current-bpm');
            if (bpmEl) {
                bpmEl.textContent = this.currentTrackData.AI_BPM
                    ? `${Math.round(this.currentTrackData.AI_BPM)} BPM`
                    : '';
            }
            const keyEl = document.getElementById('current-key');
            if (keyEl) {
                keyEl.textContent = this.currentTrackData.AI_KEY || '';
            }

            // Update artwork
            const artworkEl = document.getElementById('current-artwork');
            const placeholderEl = document.querySelector('.artwork-placeholder');

            if (artworkEl && this.currentTrackData.artwork_url) {
                artworkEl.src = this.currentTrackData.artwork_url;
                artworkEl.style.display = 'block';
                if (placeholderEl) {
                    placeholderEl.style.display = 'none';
                }

                artworkEl.onerror = () => {
                    artworkEl.style.display = 'none';
                    if (placeholderEl) {
                        placeholderEl.style.display = 'flex';
                    }
                };
            } else {
                if (artworkEl) {
                    artworkEl.style.display = 'none';
                }
                if (placeholderEl) {
                    placeholderEl.style.display = 'flex';
                }
            }
        }

        // Update mini player info ONLY if miniPlayer exists
        if (this.currentTrackData && miniPlayer) {
            const titleEl = miniPlayer.querySelector('.mini-player-title');
            const artistEl = miniPlayer.querySelector('.mini-player-artist');
            const artworkEl = miniPlayer.querySelector('.mini-player-artwork');

            if (titleEl) {
                titleEl.textContent = this.currentTrackData.title || 'Unknown';
            }
            if (artistEl) {
                artistEl.textContent = this.currentTrackData.artist || 'Unknown Artist';
            }

            if (artworkEl && this.currentTrackData.artwork_url) {
                artworkEl.src = this.currentTrackData.artwork_url;
                artworkEl.onerror = () => {
                    artworkEl.src = 'image.png';
                };
            }
        }

        // Update NOW PLAYING info in player bar
        if (this.currentTrackData && playerBar) {
            const nowPlayingTitle = document.getElementById('nowPlayingTitle');
            const nowPlayingArtist = document.getElementById('nowPlayingArtist');
            const nowPlayingArt = document.getElementById('nowPlayingArt');

            if (nowPlayingTitle) {
                nowPlayingTitle.textContent = this.currentTrackData.title || 'Unknown';
            }
            if (nowPlayingArtist) {
                nowPlayingArtist.textContent = this.currentTrackData.artist || 'Unknown Artist';
            }

            if (nowPlayingArt && this.currentTrackData.artwork_url) {
                nowPlayingArt.src = this.currentTrackData.artwork_url;
                nowPlayingArt.onerror = () => {
                    nowPlayingArt.src = './assets/images/default-album.png';
                };
            }
        }
    }

    updateMiniPlayer(status) {
        const playPauseBtn = document.querySelector('.mini-player-controls .play-pause-btn');
        if (playPauseBtn) {
            if (status === 'playing') {
                playPauseBtn.innerHTML = '⏸';
                playPauseBtn.onclick = () => this.pause();
            } else {
                playPauseBtn.innerHTML = '▶';
                playPauseBtn.onclick = () => this.resume();
            }
        }
    }

    updateTimeDisplay() {
        if (!this.currentAudio) {
            return;
        }

        const currentTime = this.currentAudio.currentTime;
        const duration = this.currentAudio.duration || 0;

        // Update current time display
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(currentTime);
        }

        // Update total time display
        const totalTimeEl = document.getElementById('totalTime');
        if (totalTimeEl) {
            totalTimeEl.textContent = this.formatTime(duration);
        }

        // Legacy time display support
        const timeDisplay = document.querySelector('.time-display');
        if (timeDisplay) {
            timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        }
    }

    updateDurationDisplay(duration) {
        // Update total time in fixed player
        const totalTimeEl = document.getElementById('totalTime');
        if (totalTimeEl) {
            totalTimeEl.textContent = this.formatTime(duration);
        }

        // Legacy duration display
        const durationDisplay = document.querySelector('.duration-display');
        if (durationDisplay) {
            durationDisplay.textContent = this.formatTime(duration);
        }
    }

    updateProgressBar() {
        if (!this.currentAudio) {
            return;
        }

        const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;

        // Update fixed player progress bar
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        // Legacy progress bar support
        const progressBar = document.querySelector('.progress-fill');
        if (progressBar && progressBar !== progressFill) {
            progressBar.style.width = `${progress}%`;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) {
            return '0:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Create global instance
const player = new AudioPlayer();

// Export for global access
window.AudioPlayer = AudioPlayer;
window.player = player;
