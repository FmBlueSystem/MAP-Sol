// Simple Audio Fix - Direct approach for Electron audio playback
// This bypasses complex streaming and uses Electron's webview capabilities

(function () {
    // Store original functions
    const originalPlayTrack = window.playTrack;

    // Simple play function that works with Electron
    window.playTrackSimple = function (track) {
        logDebug('🎵 Playing track:', track);

        if (!track) {
            logError('No track provided');
            return false;
        }

        // Ensure AudioContext is initialized
        if (!window.AudioContext && !window.webkitAudioContext) {
            logError('AudioContext not supported');
            return false;
        }

        try {
            // Stop current audio if playing
            if (window.currentAudio) {
                window.currentAudio.pause();
                window.currentAudio.src = '';
                window.currentAudio = null;
            }

            // Get the file path
            let audioPath = track.file_path || track.path;

            if (!audioPath) {
                logError('No file path found for track');
                return false;
            }

            // Clean the path
            audioPath = audioPath.replace(/^file:\/\//, '');

            // Create audio element
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';

            // Set up event handlers BEFORE setting src
            audio.onerror = function (e) {
                logError('Audio error:', e);
                logError('Failed to load:', audioPath);

                // Try alternative approach
                if (window.electronAPI) {
                    window.electronAPI
                        .invoke('play-audio-file', audioPath)
                        .then((result) => {
                            if (result.success) {
                            } else {
                                logError('IPC failed:', result.error);
                                showErrorMessage('Cannot play this file');
                            }
                        })
                        .catch((err) => {
                            logError('IPC error:', err);
                        });
                }
            };

            audio.onloadedmetadata = function () {
                // Update UI
                if (window.AppState) {
                    window.AppState.currentTrack = track;
                    window.AppState.isPlaying = true;
                }

                if (window.updatePlayerUI) {
                    window.updatePlayerUI();
                }
            };

            audio.oncanplay = function () {
                audio
                    .play()
                    .then(() => {})
                    .catch((err) => {
                        logError('Play failed:', err);

                        // User interaction might be needed
                        if (err.name === 'NotAllowedError') {
                            // Create a play button if needed
                            createPlayButton(audio);
                        }
                    });
            };

            audio.onended = function () {
                if (window.handleTrackEnd) {
                    window.handleTrackEnd();
                }
            };

            // Try different path formats
            const pathVariations = [
                'file://' + audioPath, // With file protocol (preferred)
                audioPath, // Original path
                'file:///' + audioPath, // Windows style
                'file://' + encodeURI(audioPath).replace(/#/g, '%23'), // Encoded with protocol
                encodeURI(audioPath).replace(/#/g, '%23'), // Encoded
            ];

            let loaded = false;
            let currentVariation = 0;

            function tryNextPath() {
                if (currentVariation >= pathVariations.length) {
                    logError('All path variations failed');
                    showErrorMessage('Cannot load audio file');
                    return;
                }

                const testPath = pathVariations[currentVariation];

                audio.src = testPath;

                // Set a timeout to try next variation if this one doesn't work
                setTimeout(() => {
                    if (!loaded && audio.readyState < 2) {
                        currentVariation++;
                        tryNextPath();
                    }
                }, 1000);
            }

            audio.onloadeddata = function () {
                loaded = true;
            };

            // Start trying paths
            tryNextPath();

            // Store reference
            window.currentAudio = audio;

            // Also store in AppState if available
            if (window.AppState) {
                window.AppState.currentAudio = audio;
            }

            return true;
        } catch (error) {
            logError('Play error:', error);
            showErrorMessage('Error: ' + error.message);
            return false;
        }
    };

    // Helper function to show error messages
    function showErrorMessage(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            logError(message);
        }
    }

    // Create a play button for user interaction
    function createPlayButton(audio) {
        const existingBtn = document.getElementById('manual-play-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const btn = document.createElement('button');
        btn.id = 'manual-play-btn';
        btn.textContent = '▶️ Click to Play';
        btn.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            font-size: 18px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        `;

        btn.onclick = function () {
            audio
                .play()
                .then(() => {
                    btn.remove();
                })
                .catch((err) => {
                    logError('Manual play failed:', err);
                });
        };

        document.body.appendChild(btn);
    }

    // Override the playTrack function
    window.playTrack = window.playTrackSimple;

    // Also try to fix the existing playTrack in app-production.js
    if (window.AppState && typeof window.AppState.playTrack === 'function') {
        window.AppState.playTrackOriginal = window.AppState.playTrack;
        window.AppState.playTrack = window.playTrackSimple;
    }

    // Initialize AudioContext on first click
    document.addEventListener(
        'click',
        function initAudioContext() {
            if (!window.audioContext) {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                logInfo('✅ AudioContext initialized');
            }
            if (window.audioContext && window.audioContext.state === 'suspended') {
                window.audioContext.resume();
                logInfo('✅ AudioContext resumed');
            }
            document.removeEventListener('click', initAudioContext);
        },
        { once: true }
    );

    logDebug('SimpleAudioFix - Click any track to play');

    // Export for debugging
    window.SimpleAudioFix = {
        play: window.playTrackSimple,
        original: originalPlayTrack,
    };
})();
