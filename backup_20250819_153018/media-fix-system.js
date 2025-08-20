// Media Fix System - Complete solution for images and audio
// Handles file:// protocol, fallbacks, and error recovery

(function () {
    // Default album artwork as base64 SVG
    const DEFAULT_ALBUM_ARTWORK =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzY2N2VlYTtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojNzY0YmEyO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9InVybCgjYmcpIi8+CiAgPGNpcmNsZSBjeD0iMjAwIiBjeT0iMjAwIiByPSIxNDAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxjaXJjbGUgY3g9IjIwMCIgY3k9IjIwMCIgcj0iNTAiIGZpbGw9InJnYmEoMCwwLDAsMC4zKSIvPgogIDxwYXRoIGQ9Ik0gMTgwIDE1MCBMIDE4MCAyNTAgTCAyNDAgMjAwIFoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC44KSIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMzUwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC42KSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tm8gQXJ0d29yazwvdGV4dD4KPC9zdmc+';

    // Get base path for the application
    function getBasePath() {
        if (window.electronAPI) {
            // In Electron, use the app path
            return '';
        } else {
            // In browser, use current location
            const pathname = window.location.pathname;
            return pathname.substring(0, pathname.lastIndexOf('/'));
        }
    }

    // Fix artwork paths to use correct protocol
    window.getArtworkPath = function (track) {
        if (!track || !track.artwork_path) {
            return DEFAULT_ALBUM_ARTWORK;
        }

        const artworkPath = track.artwork_path;

        // If it's already a data URL or http URL, return as is
        if (
            artworkPath.startsWith('data:') ||
            artworkPath.startsWith('http://') ||
            artworkPath.startsWith('https://')
        ) {
            return artworkPath;
        }

        // If it's already a file:// URL, return as is
        if (artworkPath.startsWith('file://')) {
            return artworkPath;
        }

        // Handle relative paths (artwork-cache/xxx.jpg)
        if (
            artworkPath.startsWith('artwork-cache/') ||
            artworkPath.startsWith('./artwork-cache/')
        ) {
            // For Electron, we need absolute path with file:// protocol
            if (window.electronAPI) {
                // Get the app directory path
                const basePath = window.location.href
                    .replace('file://', '')
                    .replace('/index-production.html', '');
                return `file://${basePath}/${artworkPath.replace('./', '')}`;
            } else {
                // For browser, use relative path
                return artworkPath;
            }
        }

        // If it's an absolute path without protocol
        if (artworkPath.startsWith(`/`)) {
            return `file://${artworkPath}`;
        }

        // Default: treat as relative path
        const basePath = getBasePath();
        return basePath ? `${basePath}/${artworkPath}` : artworkPath;
    };

    // Enhanced image error handler with multiple fallbacks
    window.handleImageError = function (img, track) {
        logWarn('🖼️ Image load failed:', img.src);

        // Track retry attempts
        img.dataset.retryCount = (parseInt(img.dataset.retryCount) || 0) + 1;

        if (img.dataset.retryCount >= 4) {
            // Final fallback to default
            img.src = DEFAULT_ALBUM_ARTWORK;
            return;
        }

        // Try alternative paths
        const alternatives = [
            // Try without file:// protocol
            img.src.replace('file://', '`),
            // Try with current directory
            `./artwork-cache/${track.id}.jpg`,
            // Try direct path
            `artwork-cache/${track.id}.jpg`,
            // Default artwork
            DEFAULT_ALBUM_ARTWORK
        ];

        const nextPath = alternatives[img.dataset.retryCount - 1];

        img.src = nextPath;
    };

    // Setup global image error handling
    document.addEventListener(
        'error',
        function (e) {
            if (e.target.tagName === 'IMG' && e.target.classList.contains('track-artwork')) {
                const trackId = e.target.dataset.trackId;
                const track = window.allTracks?.find(t => t.id == trackId);

                if (track) {
                    window.handleImageError(e.target, track);
                } else {
                    // No track info, use default
                    e.target.src = DEFAULT_ALBUM_ARTWORK;
                }
            }
        },
        true
    );

    // Enhanced audio playback with validation
    window.playTrackEnhanced = async function (track) {
        if (!track || !track.file_path) {
            logError('❌ Invalid track data');
            window.showToast?.('Invalid track data', 'error');
            return false;
        }

        try {
            // Check if file exists (if in Electron)
            if (window.electronAPI) {
                const checkResult = await window.electronAPI.invoke(
                    'check-audio-file',
                    track.file_path
                );

                if (!checkResult.exists) {
                    logError('❌ Audio file does not exist:', track.file_path);
                    window.showToast?.('Audio file not found', 'error');
                    return false;
                }
            }

            // Fix the audio path
            let audioPath = track.file_path;

            // Add file:// protocol if needed
            if (
                !audioPath.startsWith('file://') &&
                !audioPath.startsWith('http://') &&
                !audioPath.startsWith('https://') &&
                !audioPath.startsWith('data:') &&
                !audioPath.startsWith('blob:`)
            ) {
                audioPath = `file://${audioPath}`;
            }

            // Use existing playTrack function or create new audio
            if (window.playTrack) {
                // Call existing playTrack with fixed path
                const originalPath = track.file_path;
                track.file_path = audioPath;
                const result = await window.playTrack(track);
                track.file_path = originalPath; // Restore original
                return result;
            } else {
                // Fallback: create audio element directly
                const audio = new Audio(audioPath);

                audio.onerror = e => {
                    logError('❌ Audio playback error:', e);
                    window.showToast?.('Cannot play this audio file', 'error');
                };

                audio.oncanplay = () => {
                    audio.play().catch(err => {
                        logError('❌ Play failed:', err);
                        window.showToast?.('Playback failed: ' + err.message, 'error');
                    });
                };

                return true;
            }
        } catch (error) {
            logError('❌ Playback error:', error);
            window.showToast?.('Error: ' + error.message, 'error');
            return false;
        }
    };

    // Debug mode for diagnostics
    window.DEBUG_MEDIA = true;

    if (window.DEBUG_MEDIA) {
        window.debugTrack = function (trackId) {
            console.group('🔍 Debug Track #' + trackId);

            const track = window.allTracks?.find(t => t.id == trackId);
            if (!track) {
                logError('Track not found');
                console.groupEnd();
                return;
            }

            // Test image loading
            const testImg = new Image();
            testImg.onload = () =>
                (testImg.onerror = () => logError('❌ Artwork failed to load'));
            testImg.src = window.getArtworkPath(track);

            console.groupEnd();
        };

        window.debugAllMedia = function () {
            console.group('🔍 Debug All Media');

            // Check artwork directory
            const artworkImages = document.querySelectorAll('img.track-artwork');

            let loadedCount = 0;
            let errorCount = 0;

            artworkImages.forEach(img => {
                if (img.complete && img.naturalHeight !== 0) {
                    loadedCount++;
                } else {
                    errorCount++;
                    logWarn('Failed image:', img.src);
                }
            });

            console.groupEnd();
        };
    }

    // Export functions for global use
    window.MediaFixSystem = {
        getArtworkPath: window.getArtworkPath,
        handleImageError: window.handleImageError,
        playTrackEnhanced: window.playTrackEnhanced,
        DEFAULT_ALBUM_ARTWORK,
        debug: {
            track: window.debugTrack,
            allMedia: window.debugAllMedia
        }
    };

    // Debug helpers
    logDebug('MediaFixSystem - Debug specific track');
    logDebug('MediaFixSystem - Check all media`);
})();
