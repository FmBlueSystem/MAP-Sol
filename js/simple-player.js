// Simple Player with VU Meter - Reproductor minimalista profesional
class SimplePlayer {
    constructor() {
        this.audioContext = null;
        this.audio = null;
        this.source = null;
        this.analyser = null;
        this.vuMeter = null;
        this.queue = [];
        this.currentIndex = 0;
        this.currentTrack = null;
        this.isPlaying = false;
        this.volume = 0.75;
        
        this.init();
    }

    init() {
        // Create audio context on first user interaction
        this.setupAudioContext();
        this.createPlayerBar();
        this.attachEventListeners();
        this.loadLastSession();
    }

    setupAudioContext() {
        // Will be initialized on first play
        this.audioContext = null;
    }

    createPlayerBar() {
        const playerHTML = `
            <div id="simple-player-bar" class="simple-player-bar">
                <!-- Track Info Section -->
                <div class="player-track-info">
                    <img src="image.png" id="player-artwork" class="player-artwork" alt="Album Art" />
                    <div class="track-details">
                        <div id="player-title" class="player-title">--</div>
                        <div id="player-artist" class="player-artist">--</div>
                        <div class="player-meta">
                            <span id="player-album" class="player-album">--</span>
                            <span class="separator">•</span>
                            <span id="player-bpm" class="player-bpm">-- BPM</span>
                            <span class="separator">•</span>
                            <span id="player-key" class="player-key">--</span>
                        </div>
                    </div>
                </div>
                
                <!-- VU Meter Section -->
                <div class="player-vu-section">
                    <canvas id="vu-meter-canvas" width="500" height="80"></canvas>
                </div>
                
                <!-- Controls Section -->
                <div class="player-controls-section">
                    <!-- Transport Controls -->
                    <div class="transport-controls">
                        <button id="btn-prev" class="player-btn" title="Previous (←)">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                        </button>
                        <button id="btn-play" class="player-btn player-btn-play" title="Play/Pause (Space)">
                            <svg id="play-icon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            <svg id="pause-icon" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                            </svg>
                        </button>
                        <button id="btn-next" class="player-btn" title="Next (→)">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="progress-section">
                        <span id="time-current" class="time-display">0:00</span>
                        <div class="progress-bar-container">
                            <input type="range" id="seek-bar" class="seek-bar" min="0" max="100" value="0" />
                            <div class="progress-bar-fill" id="progress-fill"></div>
                        </div>
                        <span id="time-total" class="time-display">0:00</span>
                    </div>
                    
                    <!-- Volume Control -->
                    <div class="volume-section">
                        <button id="btn-mute" class="player-btn-small" title="Mute (M)">
                            <svg id="volume-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                            <svg id="mute-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                            </svg>
                        </button>
                        <input type="range" id="volume-bar" class="volume-bar" min="0" max="100" value="75" />
                        <span id="volume-value" class="volume-value">75%</span>
                    </div>
                    
                    <!-- Queue Display -->
                    <div class="queue-display">
                        <button id="btn-queue" class="player-btn-small" title="Show Queue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                            </svg>
                            <span class="queue-count" id="queue-count">0</span>
                        </button>
                    </div>
                </div>
                
                <!-- Queue Panel (hidden by default) -->
                <div id="queue-panel" class="queue-panel" style="display: none;">
                    <div class="queue-header">
                        <h4>Queue</h4>
                        <button id="btn-clear-queue" class="btn-text">Clear</button>
                    </div>
                    <div id="queue-list" class="queue-list">
                        <!-- Queue items will be added here -->
                    </div>
                </div>
            </div>
        `;

        // Add to body
        const container = document.createElement('div');
        container.innerHTML = playerHTML;
        document.body.appendChild(container.firstElementChild);
        
        this.playerBar = document.getElementById('simple-player-bar');
    }

    attachEventListeners() {
        // Transport controls
        document.getElementById('btn-play').addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-prev').addEventListener('click', () => this.previous());
        document.getElementById('btn-next').addEventListener('click', () => this.next());
        
        // Seek bar
        const seekBar = document.getElementById('seek-bar');
        seekBar.addEventListener('input', (e) => this.seek(e.target.value));
        
        // Volume
        const volumeBar = document.getElementById('volume-bar');
        volumeBar.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
        
        // Queue
        document.getElementById('btn-queue').addEventListener('click', () => this.toggleQueue());
        document.getElementById('btn-clear-queue').addEventListener('click', () => this.clearQueue());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Listen for track selection events
        document.addEventListener('playTrack', (e) => {
            this.loadTrack(e.detail);
        });
        
        document.addEventListener('addToQueue', (e) => {
            this.addToQueue(e.detail);
        });
    }

    handleKeyboard(e) {
        // Don't handle if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.previous();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.next();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.changeVolume(0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.changeVolume(-0.05);
                break;
            case 'm':
            case 'M':
                this.toggleMute();
                break;
        }
    }

    async loadTrack(track) {
        if (!track) return;
        
        this.currentTrack = track;
        
        // Initialize audio context on first play
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Initialize VU Meter
            if (!this.vuMeter) {
                const VuMeter = window.VuMeter; // Will be loaded from vu-meter.js
                if (VuMeter) {
                    this.vuMeter = new VuMeter('vu-meter-canvas');
                }
            }
        }
        
        // Stop current audio if playing
        if (this.audio) {
            this.audio.unload();
        }
        
        // Update UI
        this.updateTrackInfo(track);
        
        // Create new Howl instance
        this.audio = new Howl({
            src: [track.file_path],
            volume: this.volume,
            html5: true, // Use HTML5 Audio for better compatibility with Web Audio API
            onplay: () => {
                this.isPlaying = true;
                this.updatePlayButton();
                this.connectAnalyser();
                this.startProgressUpdate();
            },
            onpause: () => {
                this.isPlaying = false;
                this.updatePlayButton();
                this.stopProgressUpdate();
            },
            onend: () => {
                this.next();
            },
            onload: () => {
                this.updateDuration();
            },
            onloaderror: (id, error) => {
                console.error('Error loading track:', error);
                window.showToast('Error loading track', 'error');
            }
        });
        
        // Auto-play
        this.play();
    }

    connectAnalyser() {
        if (!this.audioContext || !this.audio || !this.vuMeter) return;
        
        try {
            // Get the audio element from Howler
            const sound = this.audio._sounds[0];
            if (sound && sound._node) {
                // Create source if not exists
                if (!this.source || this.source.mediaElement !== sound._node) {
                    // Disconnect old source if exists
                    if (this.source) {
                        try { this.source.disconnect(); } catch(e) {}
                    }
                    
                    this.source = this.audioContext.createMediaElementSource(sound._node);
                    
                    // Create analyser if not exists
                    if (!this.analyser) {
                        this.analyser = this.audioContext.createAnalyser();
                        this.analyser.fftSize = 2048;
                        this.analyser.smoothingTimeConstant = 0.8;
                    }
                    
                    // Connect nodes
                    this.source.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                    
                    // Initialize VU Meter with analyser
                    this.vuMeter.init(this.analyser);
                }
            }
        } catch (error) {
            console.error('Error connecting analyser:', error);
        }
    }

    updateTrackInfo(track) {
        document.getElementById('player-title').textContent = track.title || track.file_name || 'Unknown';
        document.getElementById('player-artist').textContent = track.artist || 'Unknown Artist';
        document.getElementById('player-album').textContent = track.album || 'Unknown Album';
        document.getElementById('player-bpm').textContent = (track.AI_BPM || track.existing_bmp || '--') + ' BPM';
        document.getElementById('player-key').textContent = track.AI_KEY || track.existing_key || '--';
        
        // Update artwork
        const artwork = document.getElementById('player-artwork');
        if (track.artwork_path || track.artwork_url) {
            artwork.src = track.artwork_path || track.artwork_url;
        } else if (track.id) {
            artwork.src = `artwork-cache/${track.id}.jpg`;
        } else {
            artwork.src = 'image.png';
        }
        
        // Error fallback for artwork
        artwork.onerror = () => {
            artwork.src = 'image.png';
        };
    }

    updateDuration() {
        if (this.audio) {
            const duration = this.audio.duration();
            document.getElementById('time-total').textContent = this.formatTime(duration);
        }
    }

    updatePlayButton() {
        const playIcon = document.getElementById('play-icon');
        const pauseIcon = document.getElementById('pause-icon');
        
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    startProgressUpdate() {
        this.progressInterval = setInterval(() => {
            if (this.audio && this.isPlaying) {
                const current = this.audio.seek();
                const duration = this.audio.duration();
                const progress = (current / duration) * 100;
                
                document.getElementById('seek-bar').value = progress;
                document.getElementById('progress-fill').style.width = progress + '%';
                document.getElementById('time-current').textContent = this.formatTime(current);
            }
        }, 100);
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    play() {
        if (this.audio) {
            this.audio.play();
        }
    }

    pause() {
        if (this.audio) {
            this.audio.pause();
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    previous() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadTrack(this.queue[this.currentIndex]);
        }
    }

    next() {
        if (this.currentIndex < this.queue.length - 1) {
            this.currentIndex++;
            this.loadTrack(this.queue[this.currentIndex]);
        }
    }

    seek(percentage) {
        if (this.audio) {
            const duration = this.audio.duration();
            const seekTime = (percentage / 100) * duration;
            this.audio.seek(seekTime);
        }
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.audio) {
            this.audio.volume(this.volume);
        }
        document.getElementById('volume-bar').value = this.volume * 100;
        document.getElementById('volume-value').textContent = Math.round(this.volume * 100) + '%';
    }

    changeVolume(delta) {
        this.setVolume(this.volume + delta);
    }

    toggleMute() {
        const volumeIcon = document.getElementById('volume-icon');
        const muteIcon = document.getElementById('mute-icon');
        
        if (this.audio) {
            const isMuted = this.audio.mute();
            this.audio.mute(!isMuted);
            
            if (!isMuted) {
                volumeIcon.style.display = 'none';
                muteIcon.style.display = 'block';
            } else {
                volumeIcon.style.display = 'block';
                muteIcon.style.display = 'none';
            }
        }
    }

    addToQueue(track) {
        this.queue.push(track);
        this.updateQueueDisplay();
        window.showToast('Added to queue', 'success');
    }

    clearQueue() {
        this.queue = [];
        this.currentIndex = 0;
        this.updateQueueDisplay();
    }

    toggleQueue() {
        const queuePanel = document.getElementById('queue-panel');
        queuePanel.style.display = queuePanel.style.display === 'none' ? 'block' : 'none';
        this.updateQueueDisplay();
    }

    updateQueueDisplay() {
        const queueCount = document.getElementById('queue-count');
        const queueList = document.getElementById('queue-list');
        
        queueCount.textContent = this.queue.length;
        
        if (this.queue.length === 0) {
            queueList.innerHTML = '<div class="queue-empty">Queue is empty</div>';
        } else {
            queueList.innerHTML = this.queue.map((track, index) => `
                <div class="queue-item ${index === this.currentIndex ? 'current' : ''}" data-index="${index}">
                    <span class="queue-index">${index + 1}</span>
                    <div class="queue-track-info">
                        <div class="queue-title">${track.title || track.file_name}</div>
                        <div class="queue-artist">${track.artist || 'Unknown'}</div>
                    </div>
                    <button class="queue-remove" onclick="simplePlayer.removeFromQueue(${index})">×</button>
                </div>
            `).join('');
        }
    }

    removeFromQueue(index) {
        this.queue.splice(index, 1);
        if (index < this.currentIndex) {
            this.currentIndex--;
        }
        this.updateQueueDisplay();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === null) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    loadLastSession() {
        // Load last played track if exists
        const lastTrack = localStorage.getItem('lastPlayedTrack');
        if (lastTrack) {
            try {
                const track = JSON.parse(lastTrack);
                // Don't auto-play on load
                // this.loadTrack(track);
            } catch (e) {
                console.error('Error loading last session:', e);
            }
        }
    }

    saveSession() {
        if (this.currentTrack) {
            localStorage.setItem('lastPlayedTrack', JSON.stringify(this.currentTrack));
        }
    }
}

// Initialize player when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.simplePlayer = new SimplePlayer();
    });
} else {
    window.simplePlayer = new SimplePlayer();
}