// Complete Player Fix - Connects frontend with IPC handlers
// This file bridges the gap between UI and Electron IPC

(function () {
    // Check if we have IPC renderer access - Try multiple methods
    const hasIPC =
        window.electronAPI || window.api || (window.electron && window.electron.ipcRenderer);
    if (!hasIPC) {
        console.warn('⚠️ No IPC access available. Player functions will be limited.');
        // Continue anyway - some functions might work without IPC
    }

    // Global player state
    window.playerState = {
        currentTrack: null,
        isPlaying: false,
        duration: 0,
        position: 0,
        volume: 0.7
    };

    // Initialize audio context on first interaction
    let audioContextInitialized = false;
    document.addEventListener(
        'click',
        async function initAudioContext() {
            if (!audioContextInitialized) {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    window.audioContext = audioContext;
                    audioContextInitialized = true;
                } catch (error) {
                    console.error('❌ AudioContext init error:', error);
                }
            }
        },
        { once: true }
    );

    // Main play function that uses IPC
    window.playTrack = async function (track) {
        if (!track) {
            console.error('No track provided');
            return false;
        }

        try {
            // Get file path
            const filePath = track.file_path || track.path || track;

            if (!filePath) {
                console.error('No file path found');
                return false;
            }

            // Ensure audio context is running
            if (window.audioContext?.state === 'suspended') {
                await window.audioContext.resume();
            }

            // Call IPC handler
            const result = await window.api.invoke('play-track', filePath);

            if (result.success) {
                // Update player state
                window.playerState.currentTrack = track;
                window.playerState.isPlaying = true;
                window.playerState.duration = result.duration || 0;

                // Update UI
                updatePlayerUI(track);

                // Start progress updates
                startProgressUpdates();

                return true;
            } else {
                console.error('❌ Play failed:', result.error);

                // Try fallback if available
                if (result.fallback === 'native') {
                    return playTrackFallback(track);
                }

                return false;
            }
        } catch (error) {
            console.error('❌ Play error:', error);
            return false;
        }
    };

    // Fallback player using HTML5 Audio
    window.playTrackFallback = function (track) {
        try {
            // Stop current audio
            if (window.currentAudio) {
                window.currentAudio.pause();
                window.currentAudio = null;
            }

            const filePath = track.file_path || track.path || track;
            const audio = new Audio(filePath);

            audio.volume = window.playerState.volume;

            audio.onloadedmetadata = () => {
                window.playerState.duration = audio.duration;
                updatePlayerUI(track);
            };

            audio.onplay = () => {
                window.playerState.isPlaying = true;
                updatePlayPauseButton(true);
            };

            audio.onpause = () => {
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
            };

            audio.onended = () => {
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
                stopProgressUpdates();
            };

            audio.onerror = e => {
                console.error('❌ Fallback audio error:', e);
            };

            audio.play().catch(err => {
                console.error('❌ Fallback play error:', err);
            });

            window.currentAudio = audio;
            window.playerState.currentTrack = track;

            startProgressUpdates();

            return true;
        } catch (error) {
            console.error('❌ Fallback failed:', error);
            return false;
        }
    };

    // Pause function
    window.pauseTrack = async function () {
        try {
            if (hasIPC) {
                const result = await window.api.invoke('pause-track');
                if (result.success) {
                    window.playerState.isPlaying = false;
                    updatePlayPauseButton(false);
                    stopProgressUpdates();
                }
                return result.success;
            } else if (window.currentAudio) {
                window.currentAudio.pause();
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
                stopProgressUpdates();
                return true;
            }
        } catch (error) {
            console.error('❌ Pause error:', error);
        }
        return false;
    };

    // Resume function
    window.resumeTrack = async function () {
        try {
            if (hasIPC) {
                const result = await window.api.invoke('resume-track');
                if (result.success) {
                    window.playerState.isPlaying = true;
                    updatePlayPauseButton(true);
                    startProgressUpdates();
                }
                return result.success;
            } else if (window.currentAudio) {
                await window.currentAudio.play();
                window.playerState.isPlaying = true;
                updatePlayPauseButton(true);
                startProgressUpdates();
                return true;
            }
        } catch (error) {
            console.error('❌ Resume error:', error);
        }
        return false;
    };

    // Stop function
    window.stopTrack = async function () {
        try {
            stopProgressUpdates();

            if (hasIPC) {
                const result = await window.api.invoke('stop-track');
                if (result.success) {
                    window.playerState.isPlaying = false;
                    window.playerState.currentTrack = null;
                    updatePlayPauseButton(false);
                    resetPlayerUI();
                }
                return result.success;
            } else if (window.currentAudio) {
                window.currentAudio.pause();
                window.currentAudio.currentTime = 0;
                window.currentAudio = null;
                window.playerState.isPlaying = false;
                window.playerState.currentTrack = null;
                updatePlayPauseButton(false);
                resetPlayerUI();
                return true;
            }
        } catch (error) {
            console.error('❌ Stop error:', error);
        }
        return false;
    };

    // Seek function
    window.seekTrack = async function (position) {
        try {
            if (hasIPC) {
                const result = await window.api.invoke('seek-track', position);
                return result.success;
            } else if (window.currentAudio) {
                window.currentAudio.currentTime = position;
                return true;
            }
        } catch (error) {
            console.error('❌ Seek error:', error);
        }
        return false;
    };

    // Volume function
    window.setVolume = async function (volume) {
        try {
            const vol = Math.max(0, Math.min(1, volume));
            window.playerState.volume = vol;

            if (hasIPC) {
                const result = await window.api.invoke('set-volume', vol);
                return result.success;
            } else if (window.currentAudio) {
                window.currentAudio.volume = vol;
                return true;
            }
        } catch (error) {
            console.error('❌ Volume error:', error);
        }
        return false;
    };

    // Progress update interval
    let progressInterval = null;

    function startProgressUpdates() {
        stopProgressUpdates();

        progressInterval = setInterval(async () => {
            try {
                if (hasIPC) {
                    const state = await window.api.invoke('get-playback-state');
                    if (state.success && state.playing) {
                        updateProgress(state.position, state.duration);
                    }
                } else if (window.currentAudio && !window.currentAudio.paused) {
                    updateProgress(window.currentAudio.currentTime, window.currentAudio.duration);
                }
            } catch (error) {
                console.error('Progress update error:', error);
            }
        }, 100);
    }

    function stopProgressUpdates() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    // UI Update functions
    function updatePlayerUI(track) {
        // Update player bar
        const playerTitle = document.getElementById('playerTitle');
        const playerArtist = document.getElementById('playerArtist');
        const playerArtwork = document.getElementById('playerArtwork');

        if (playerTitle) {
            playerTitle.textContent = track.title || track.file_name || 'Unknown';
        }
        if (playerArtist) {
            playerArtist.textContent = track.artist || 'Unknown Artist';
        }
        if (playerArtwork && track.artwork_url) {
            playerArtwork.src = track.artwork_url;
        }

        // Update minimal player
        const trackTitleMinimal = document.getElementById('track-title-minimal');
        const trackArtistMinimal = document.getElementById('track-artist-minimal');

        if (trackTitleMinimal) {
            trackTitleMinimal.textContent = track.title || track.file_name || 'Unknown';
        }
        if (trackArtistMinimal) {
            trackArtistMinimal.textContent = track.artist || 'Unknown Artist';
        }

        // Show player bar
        const playerBar = document.getElementById('playerBar');
        if (playerBar) {
            playerBar.classList.add('active');
        }

        const audioPanel = document.getElementById('audio-panel');
        if (audioPanel) {
            audioPanel.classList.add('visible');
        }
    }

    function resetPlayerUI() {
        const playerTitle = document.getElementById('playerTitle');
        const playerArtist = document.getElementById('playerArtist');

        if (playerTitle) {
            playerTitle.textContent = 'No track selected';
        }
        if (playerArtist) {
            playerArtist.textContent = '-';
        }

        const trackTitleMinimal = document.getElementById('track-title-minimal');
        const trackArtistMinimal = document.getElementById('track-artist-minimal');

        if (trackTitleMinimal) {
            trackTitleMinimal.textContent = 'No track playing';
        }
        if (trackArtistMinimal) {
            trackArtistMinimal.textContent = '--';
        }

        updateProgress(0, 0);
    }

    function updatePlayPauseButton(playing) {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playBtnPanel = document.getElementById('playBtnPanel');

        if (playPauseBtn) {
            playPauseBtn.innerHTML = playing ? '⏸' : '▶';
        }

        if (playBtnPanel) {
            const playIcon = playBtnPanel.querySelector('.play-icon');
            const pauseIcon = playBtnPanel.querySelector('.pause-icon');

            if (playIcon && pauseIcon) {
                playIcon.style.display = playing ? 'none' : 'block';
                pauseIcon.style.display = playing ? 'block' : 'none';
            }
        }
    }

    function updateProgress(position, duration) {
        // Update time displays
        const currentTime = document.getElementById('currentTime');
        const currentTimePanel = document.getElementById('currentTimePanel');
        const durationEl = document.getElementById('duration');
        const durationPanel = document.getElementById('durationPanel');

        const formatTime = seconds => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}';
        };

        const currentFormatted = formatTime(position || 0);
        const durationFormatted = formatTime(duration || 0);

        if (currentTime) {
            currentTime.textContent = currentFormatted;
        }
        if (currentTimePanel) {
            currentTimePanel.textContent = currentFormatted;
        }
        if (durationEl) {
            durationEl.textContent = durationFormatted;
        }
        if (durationPanel) {
            durationPanel.textContent = durationFormatted;
        }

        // Update progress bars
        const progressFill = document.getElementById('progressFill');
        const progressFillMinimal = document.getElementById('progressFillMinimal');

        if (duration > 0) {
            const percentage = (position / duration) * 100;

            if (progressFill) {
                progressFill.style.width = percentage + '%';
            }
            if (progressFillMinimal) {
                progressFillMinimal.style.width = percentage + '%';
            }
        }
    }

    // Set up event listeners when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (window.playerState.isPlaying) {
                    pauseTrack();
                } else if (window.playerState.currentTrack) {
                    resumeTrack();
                } else {
                }
            });
        }

        // Panel play button
        const playBtnPanel = document.getElementById('playBtnPanel');
        if (playBtnPanel) {
            playBtnPanel.addEventListener('click', () => {
                if (window.playerState.isPlaying) {
                    pauseTrack();
                } else if (window.playerState.currentTrack) {
                    resumeTrack();
                } else {
                }
            });
        }

        // Volume slider
        const volumeSlider = document.getElementById('volumeSliderInput');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', e => {
                const volume = e.target.value / 100;
                setVolume(volume);
            });
        }

        // Progress bar click for seeking
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.addEventListener('click', e => {
                if (window.playerState.duration > 0) {
                    const rect = progressBar.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    const position = percent * window.playerState.duration;
                    seekTrack(position);
                }
            });
        }

        // Listen for IPC events
        if (window.api && window.api.on) {
            window.api.on('playback-started', () => {
                window.playerState.isPlaying = true;
                updatePlayPauseButton(true);
            });

            window.api.on('playback-paused', () => {
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
            });

            window.api.on('track-ended', () => {
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
                stopProgressUpdates();

                // Auto-play next if in queue
                if (window.playNext) {
                    window.playNext();
                }
            });

            window.api.on('track-loaded', data => {
                if (data.duration) {
                    window.playerState.duration = data.duration;
                }
            });

            window.api.on('playback-error', data => {
                console.error('❌ Playback error event:', data);
                window.playerState.isPlaying = false;
                updatePlayPauseButton(false);
                stopProgressUpdates();
            });
        }
    });

    // Make play function available on track cards
    window.addEventListener('load', () => {
        // For dynamically loaded content, use event delegation
        document.addEventListener('click', e => {
            // Check if clicked on play button
            if (e.target.classList.contains('play-btn') || e.target.closest('.play-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const button = e.target.classList.contains('play-btn')
                    ? e.target
                    : e.target.closest('.play-btn');

                const card = button.closest('.track-card, .table-view tr, .compact-item');
                if (card) {
                    const trackData = card.dataset.track
                        ? JSON.parse(card.dataset.track)
                        : window.getTrackFromElement(card);

                    if (trackData) {
                        playTrack(trackData);
                    }
                }
            }
        });
    });
})();
