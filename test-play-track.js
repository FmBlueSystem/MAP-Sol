// Quick test to play track with metadata
const { ipcRenderer } = require('electron');

// Wait for app to load
setTimeout(() => {
    // Get the track with metadata
    ipcRenderer.invoke('get-files-with-cached-artwork').then((result) => {
        const tracks = result.files || result;

        // Find track 3811 which has metadata
        const trackWithMetadata = tracks.find((t) => t.id === 3811);

        if (trackWithMetadata) {
            console.log('Playing track with metadata:', {
                id: trackWithMetadata.id,
                title: trackWithMetadata.title,
                bpm: trackWithMetadata.bpm,
                key: trackWithMetadata.key,
                energy: trackWithMetadata.energy,
                mood: trackWithMetadata.mood,
            });

            // Dispatch play event
            const event = new CustomEvent('playTrack', {
                detail: trackWithMetadata,
            });
            document.dispatchEvent(event);
        } else {
            console.log('Track 3811 not found!');
        }
    });
}, 2000);
