// Howler Path Fix - Ensures correct file:// protocol for local files
// This fixes the playback issue with Howler.js in Electron

(function () {
    // Store original Howl constructor
    const OriginalHowl = window.Howl;

    // Override Howl constructor
    window.Howl = function (options) {
        // Fix src paths if they're local files
        if (options && options.src) {
            options.src = options.src.map((src) => {
                if (typeof src === 'string') {
                    // Check if it's a local file path without protocol
                    if (
                        !src.startsWith('file://') &&
                        !src.startsWith('http://') &&
                        !src.startsWith('https://') &&
                        !src.startsWith('data:') &&
                        !src.startsWith('blob:')
                    ) {
                        // For Electron, we need to properly format the file URL
                        // Handle both absolute paths and Windows paths
                        let fixedPath = src;

                        // Windows path detection (C:\ or similar)
                        if (/^[A-Za-z]:[\\/]/.test(src)) {
                            // Windows path - needs special handling
                            fixedPath = 'file:///' + src.replace(/\\/g, '/');
                        } else if (src.startsWith('/')) {
                            // Unix/Mac absolute path
                            fixedPath = 'file://' + src;
                        } else {
                            // Relative path or already formatted - leave as is
                            return src;
                        }

                        // Properly encode the URL but preserve the slashes
                        // Split by '/', encode each part, then rejoin
                        const parts = fixedPath.split('file://')[1];
                        if (parts) {
                            const encoded = parts
                                .split('/')
                                .map((part) => encodeURIComponent(part).replace(/'/g, '%27'))
                                .join('/');
                            fixedPath = 'file://' + encoded;
                        }

                        return fixedPath;
                    }
                }
                return src;
            });

            // Add better error handling
            const originalOnloaderror = options.onloaderror;
            options.onloaderror = function (id, error) {
                console.error('❌ Howler load error:', {
                    error: error,
                    errorCode: error,
                    src: options.src[0],
                    id: id,
                });

                // Error codes:
                // 1 = fetching/decoding error
                // 2 = no audio support
                // 3 = decoding error
                // 4 = no codec support
                if (error === 3) {
                    console.error('Decoding error - file may be corrupted or unsupported format');
                } else if (error === 4) {
                    console.error('Codec not supported - check file format');
                }

                if (originalOnloaderror) {
                    originalOnloaderror(id, error);
                }
            };
        }

        // Call original constructor with fixed options
        return new OriginalHowl(options);
    };

    // Copy all static properties
    Object.keys(OriginalHowl).forEach((key) => {
        window.Howl[key] = OriginalHowl[key];
    });

    // Ensure prototype is copied
    window.Howl.prototype = OriginalHowl.prototype;
})();
