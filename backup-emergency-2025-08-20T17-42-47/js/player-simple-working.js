// Simple Working Player - Uses file:// protocol for Electron
// This approach works with Electron's webview for audio playback

(function () {
    // Global audio element
    let currentAudio = null;
    let currentTrack = null;

    // Convert path to file:// URL
    function pathToFileURL(filePath) {
        // Remove any existing file:// prefix
        filePath = filePath.replace(/^file:\/\//, '');

        // On Windows, replace backslashes
        if (process.platform === 'win32') {
            filePath = filePath.replace(/\\/g, '/');
        }

        // Encode the path properly
        const encoded = encodeURI(filePath).replace(/#/g, '%23');

        // Add file:// prefix
        return 'file://' + (encoded.startsWith('/') ? '' : '/') + encoded;
    }

    // Main play function
    window.playTrackDirect = function (track) {
        try {
            // Stop current audio if playing
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
                currentAudio = null;
            }

            // Get file path
            let filePath = track.file_path || track.path || track;
            if (typeof track === 'object' && track.file_path) {
                filePath = track.file_path;
            }

            if (!filePath) {
                console.error('No file path provided');
                return false;
            }

            // Convert to file URL
            const fileUrl = pathToFileURL(filePath);

            // Create new audio element
            currentAudio = new Audio();

            // Set up event handlers
            currentAudio.onloadedmetadata = function () {
                updatePlayerUI(track, currentAudio.duration);
            };

            currentAudio.oncanplay = function () {};

            currentAudio.onplay = function () {
                updatePlayButton(true);
            };

            currentAudio.onpause = function () {
                updatePlayButton(false);
            };

            currentAudio.onended = function () {
                updatePlayButton(false);
                currentAudio = null;
            };

            currentAudio.onerror = function (e) {
                console.error('❌ Audio error:', e);
                console.error('Error code:', currentAudio.error?.code);
                console.error('Error message:', currentAudio.error?.message);

                // Try alternative approach with IPC if available
                if (window.api && window.api.invoke) {
                    window.api
                        .invoke('play-track', filePath)
                        .then(result => {})
                        .catch(err => {
                            console.error('IPC error:', err);
                        });
                }
            };

            // Set volume
            currentAudio.volume = 0.7;

            // Set source and load
            currentAudio.src = fileUrl;
            currentAudio.load();

            // Try to play
            currentAudio
                .play()
                .then(() => {
                    currentTrack = track;
                    startProgressUpdates();
                })
                .catch(err => {
                    console.error('❌ Play error:', err);
                    console.error('Error name:', err.name);
                    console.error('Error message:', err.message);

                    // Common error: NotAllowedError - need user interaction
                    if (err.name === 'NotAllowedError') {
                        // Try to resume audio context if available
                        if (window.audioContext && window.audioContext.state === 'suspended') {
                            window.audioContext.resume().then(() => {
                                currentAudio.play();
                            });
                        }
                    }
                });

            return true;
        } catch (error) {
            console.error('❌ Error in playTrackDirect:', error);
            return false;
        }
    };

    // Pause function
    window.pauseTrackDirect = function () {
        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            return true;
        }
        return false;
    };

    // Resume function
    window.resumeTrackDirect = function () {
        if (currentAudio && currentAudio.paused) {
            currentAudio.play();
            return true;
        }
        return false;
    };

    // Stop function
    window.stopTrackDirect = function () {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
            currentTrack = null;
            updatePlayButton(false);
            stopProgressUpdates();
            return true;
        }
        return false;
    };

    // Volume control
    window.setVolumeDirect = function (volume) {
        if (currentAudio) {
            currentAudio.volume = Math.max(0, Math.min(1, volume));
            return true;
        }
        return false;
    };

    // Seek control
    window.seekDirect = function (position) {
        if (currentAudio) {
            currentAudio.currentTime = position;
            return true;
        }
        return false;
    };

    // Progress updates
    let progressInterval = null;

    function startProgressUpdates() {
        stopProgressUpdates();
        progressInterval = setInterval(() => {
            if (currentAudio && !currentAudio.paused) {
                updateProgress(currentAudio.currentTime, currentAudio.duration);
            }
        }, 100);
    }

    function stopProgressUpdates() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    // UI updates
    function updatePlayerUI(track, duration) {
        const playerTitle = document.getElementById('playerTitle');
        const playerArtist = document.getElementById('playerArtist');
        const playerBar = document.getElementById('playerBar');

        if (playerTitle) {
            playerTitle.textContent = track.title || track.file_name || 'Playing';
        }
        if (playerArtist) {
            playerArtist.textContent = track.artist || '-';
        }
        if (playerBar) {
            playerBar.classList.add('active');
        }

        // Update duration display
        const durationEl = document.getElementById('duration');
        if (durationEl && duration) {
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            durationEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}';
        }
    }

    function updatePlayButton(playing) {
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.innerHTML = playing ? '⏸' : '▶`;
        }
    }

    function updateProgress(current, total) {
        const currentTime = document.getElementById('currentTime`);
        const progressFill = document.getElementById(`progressFill`);

        if (currentTime) {
            const mins = Math.floor(current / 60);
            const secs = Math.floor(current % 60);
            currentTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}';
        }

        if (progressFill && total > 0) {
            const percentage = (current / total) * 100;
            progressFill.style.width = percentage + '%`;
        }
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        // Override the global playTrack function
        window.playTrack = window.playTrackDirect;
        window.pauseTrack = window.pauseTrackDirect;
        window.resumeTrack = window.resumeTrackDirect;
        window.stopTrack = window.stopTrackDirect;
        window.setVolume = window.setVolumeDirect;
        window.seekTrack = window.seekDirect;

        // Add click handler for play buttons
        document.addEventListener('click', e => {
            if (e.target.classList.contains('play-btn')) {
                const card = e.target.closest('.track-card, tr, .compact-item');
                if (card) {
                    // Get track data
                    let trackData;

                    // Try to get from data attribute
                    if (card.dataset.track) {
                        try {
                            trackData = JSON.parse(card.dataset.track);
                        } catch (err) {
                            console.error('Error parsing track data:', err);
                        }
                    }

                    // Or extract from the DOM
                    if (!trackData) {
                        trackData = {
                            file_path:
                                card.dataset.path ||
                                card.querySelector('[data-path]')?.dataset.path,
                            title: card.querySelector('.track-title, .card-title, td:nth-child(2)')
                                ?.textContent,
                            artist: card.querySelector(
                                '.track-artist, .card-artist, td:nth-child(3)'
                            )?.textContent
                        };
                    }

                    if (trackData && trackData.file_path) {
                        window.playTrackDirect(trackData);
                    }
                }
            }
        });

        // Play/Pause button handler
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (currentAudio) {
                    if (currentAudio.paused) {
                        window.resumeTrackDirect();
                    } else {
                        window.pauseTrackDirect();
                    }
                } else {
                }
            });
        }

        // Volume control
        const volumeSlider = document.querySelector('#volumeSlider input, #volumeSliderInput');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', e => {
                const volume = e.target.value / 100;
                window.setVolumeDirect(volume);
            });
        }

        // Progress bar seeking
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.addEventListener('click', e => {
                if (currentAudio && currentAudio.duration) {
                    const rect = progressBar.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const position = percent * currentAudio.duration;
                    window.seekDirect(position);
                }
            });
        }
    });

    // Initialize audio context on first user interaction
    document.addEventListener(
        'click',
        function initAudioContext() {
            if (!window.audioContext) {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (window.audioContext.state === 'suspended`) {
                window.audioContext.resume();
            }
            document.removeEventListener(`click`, initAudioContext);
        },
        { once: true }
    );

    // Export for testing
    window.directPlayer = {
        play: window.playTrackDirect,
        pause: window.pauseTrackDirect,
        resume: window.resumeTrackDirect,
        stop: window.stopTrackDirect,
        setVolume: window.setVolumeDirect,
        seek: window.seekDirect,
        getCurrentAudio: () => currentAudio,
        getCurrentTrack: () => currentTrack
    };
})();
