// Audio Fallback System - Uses IPC for external drives
// This provides a fallback when direct file:// URLs don't work

(function () {
    // Store reference to original Howl
    const OriginalHowl = window.Howl;

    // Enhanced Howl with fallback support
    window.Howl = function (options) {
        if (options && options.src && options.src.length > 0) {
            const originalSrc = options.src[0];
            const originalOnloaderror = options.onloaderror;
            let fallbackAttempted = false;

            // Enhanced error handler with fallback
            options.onloaderror = async function (id, error) {
                console.error('🔴 Initial load failed:', {
                    error,
                    src: originalSrc,
                    fallbackAttempted
                });

                // Try fallback only once and only for decoding errors
                if (!fallbackAttempted && (error === 3 || error === 1)) {
                    fallbackAttempted = true;

                    try {
                        // Check if file exists and get alternative URL
                        const result = await window.electronAPI.invoke('get-audio-url', originalSrc);

                        if (result.success) {
                            // Cleanup current instance
                            this.unload();

                            // Create new Howl with data URL or alternative URL
                            const fallbackHowl = new OriginalHowl({
                                ...options,
                                src: [result.url],
                                onloaderror: function (id, error) {
                                    console.error('❌ Fallback also failed:', error);
                                    if (originalOnloaderror) {
                                        originalOnloaderror.call(this, id, error);
                                    }
                                }
                            });

                            // Replace the current instance methods with fallback
                            Object.setPrototypeOf(this, fallbackHowl);
                            Object.assign(this, fallbackHowl);

                            // Try playing with fallback
                            fallbackHowl.play();
                        } else {
                            console.error('❌ Could not create fallback URL:', result.error);
                            if (originalOnloaderror) {
                                originalOnloaderror.call(this, id, error);
                            }
                        }
                    } catch (err) {
                        console.error('❌ Fallback failed:', err);
                        if (originalOnloaderror) {
                            originalOnloaderror.call(this, id, error);
                        }
                    }
                } else {
                    // Call original error handler
                    if (originalOnloaderror) {
                        originalOnloaderror.call(this, id, error);
                    }
                }
            };
        }

        // Create instance with enhanced options
        return new OriginalHowl(options);
    };

    // Copy all static properties
    Object.keys(OriginalHowl).forEach(key => {
        window.Howl[key] = OriginalHowl[key];
    });

    // Copy prototype
    window.Howl.prototype = OriginalHowl.prototype;
})();
