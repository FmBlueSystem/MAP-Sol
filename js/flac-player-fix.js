// FLAC Player Fix - Special handling for FLAC files
// Uses native HTML5 audio with proper MIME types

(function () {
    // Override playTrack for FLAC support
    window.playTrackFLAC = function (track) {
        logDebug('🎵 FLAC Player - Playing track:', track);

        if (!track || !track.file_path) {
            logError('Invalid track data');
            return false;
        }

        // Stop current playback
        if (window.AppState && window.AppState.howl) {
            window.AppState.howl.stop();
            window.AppState.howl.unload();
            window.AppState.howl = null;
        }

        // For non-FLAC files, use normal Howler
        const isFlac =
            track.file_path.toLowerCase().endsWith('.flac') || track.file_extension === '.flac';

        if (!isFlac) {
            return playTrackStandard(track);
        }

        // Use HTML5 Audio for FLAC
        const audio = new Audio();

        // Set crossOrigin for external files
        audio.crossOrigin = 'anonymous';

        // Setup event handlers
        audio.onerror = function (e) {
            logError('Audio error:', e);
            const error = audio.error;
            if (error) {
                switch (error.code) {
                    case 1:
                        logError('MEDIA_ERR_ABORTED');
                        break;
                    case 2:
                        logError('MEDIA_ERR_NETWORK');
                        break;
                    case 3:
                        logError('MEDIA_ERR_DECODE');
                        break;
                    case 4:
                        logError('MEDIA_ERR_SRC_NOT_SUPPORTED');
                        // Direct file path fallback

                        audio.src = track.file_path;
                        break;
                }
            }
        };

        audio.onloadedmetadata = function () {
            // Update UI
            if (window.AppState) {
                window.AppState.currentTrack = track;
                window.AppState.isPlaying = true;

                // Create a fake Howl object for compatibility
                window.AppState.howl = {
                    play: () => audio.play(),
                    pause: () => audio.pause(),
                    stop: () => {
                        audio.pause();
                        audio.currentTime = 0;
                    },
                    unload: () => {
                        audio.src = '';
                    },
                    volume: v => {
                        if (v !== undefined) {
                            audio.volume = v;
                        }
                        return audio.volume;
                    },
                    seek: s => {
                        if (s !== undefined) {
                            audio.currentTime = s;
                        }
                        return audio.currentTime;
                    },
                    duration: () => audio.duration,
                    playing: () => !audio.paused,
                    _sounds: [{ _node: audio }]
                };
            }

            if (window.updatePlayerUI) {
                window.updatePlayerUI();
            }
        };

        audio.onplay = function () {
            if (window.AppState) {
                window.AppState.isPlaying = true;
            }
            updateProgress();
        };

        audio.onpause = function () {
            if (window.AppState) {
                window.AppState.isPlaying = false;
            }
        };

        audio.onended = function () {
            if (window.handleTrackEnd) {
                window.handleTrackEnd();
            }
        };

        // Progress update
        function updateProgress() {
            if (!audio.paused && window.updateProgress) {
                window.updateProgress();
                requestAnimationFrame(updateProgress);
            }
        }

        // Try different URL formats
        let filePath = track.file_path;

        // Clean and encode the path
        if (filePath.startsWith('file://')) {
            filePath = filePath;
        } else {
            filePath = 'file://' + encodeURI(filePath).replace(/#/g, '%23');
        }

        audio.src = filePath;

        // Set volume
        audio.volume = window.AppState?.volume || 0.75;

        // Try to play
        audio
            .play()
            .then(() => {})
            .catch(err => {
                logError('Play failed:', err);

                if (err.name === 'NotAllowedError') {
                    // Need user interaction
                    createPlayButton(audio);
                } else if (err.name === 'NotSupportedError') {
                    // Try fallback to direct path

                    audio.src = track.file_path;
                    audio.play().catch(e => logError('Direct path also failed:', e));
                }
            });

        return true;
    };

    // Standard player for non-FLAC
    function playTrackStandard(track) {
        if (!window.AppState) {
            return false;
        }

        window.AppState.currentTrack = track;

        if (window.AppState.howl) {
            window.AppState.howl.stop();
            window.AppState.howl.unload();
        }

        // Use direct file path
        const src = track.file_path;

        window.AppState.howl = new Howl({
            src: [src],
            html5: true,
            volume: window.AppState.volume || 0.75,
            onplay: () => {
                window.AppState.isPlaying = true;
                if (window.updatePlayerUI) {
                    window.updatePlayerUI();
                }
                if (window.updateProgress) {
                    requestAnimationFrame(window.updateProgress);
                }
            },
            onpause: () => {
                window.AppState.isPlaying = false;
                if (window.updatePlayerUI) {
                    window.updatePlayerUI();
                }
            },
            onend: () => {
                if (window.handleTrackEnd) {
                    window.handleTrackEnd();
                }
            },
            onloaderror: (id, error) => {
                logError('Howler load error:', error);
            }
        });

        window.AppState.howl.play();
        return true;
    }

    // Helper to create play button
    function createPlayButton(audio) {
        const btn = document.createElement('button');
        btn.textContent = '▶️ Click to Play';
        btn.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            padding: 15px 30px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            z-index: 10000;
        `;

        btn.onclick = () => {
            audio.play();
            btn.remove();
        };

        document.body.appendChild(btn);

        setTimeout(() => btn.remove(), 5000);
    }

    // Override the main playTrack
    if (window.playTrack) {
        window.playTrackOriginalBeforeFLAC = window.playTrack;
    }
    window.playTrack = window.playTrackFLAC;

    // Export for debugging
    window.FLACPlayerFix = {
        play: window.playTrackFLAC,
        standard: playTrackStandard
    };
})();
