// Test script to verify player integration
// Run this in the console of index-complete.html

logDebug('Testing Player Integration...');

// Check if FixedAudioPlayer is initialized
if (typeof fixedPlayer !== 'undefined') {
    logInfo('✅ FixedAudioPlayer instance found');

    // Check audio context
    if (fixedPlayer.audioContext) {
        logInfo('✅ Audio context initialized:', fixedPlayer.audioContext.state);
    } else {
        logError('❌ Audio context not initialized');
    }

    // Check analyser
    if (fixedPlayer.analyser) {
        logInfo('✅ Analyser initialized with FFT size:', fixedPlayer.analyser.fftSize);
    } else {
        logError('❌ Analyser not initialized');
    }
} else {
    logError('❌ FixedAudioPlayer not found');
}

// Check UI elements
const uiElements = {
    'current-title': 'Track title element',
    'current-artist': 'Track artist element',
    'current-artwork': 'Track artwork element',
    'btn-play-pause': 'Play/pause button',
    'btn-previous': 'Previous button',
    'btn-next': 'Next button',
    'progress-bar': 'Progress bar',
    'current-time': 'Current time display',
    'total-time': 'Total time display',
    'level-left': 'Left channel meter',
    'level-right': 'Right channel meter',
    'value-left': 'Left channel value',
    'value-right': 'Right channel value',
    volumeSlider: 'Volume slider',
};

logDebug('\nChecking UI elements:');
const missingElements = [];
for (const [id, description] of Object.entries(uiElements)) {
    const element = document.getElementById(id);
    if (element) {
        logInfo('✅ ${description} (#${id})');
    } else {
        logError('❌ ${description} (#${id}) - NOT FOUND');
        missingElements.push(id);
    }
}

if (missingElements.length === 0) {
    logDebug('\n🎉 All UI elements found! Player should be fully functional.');
} else {
    logDebug(`\n⚠️ Missing ${missingElements.length} elements:`, missingElements);
}

// Test play function with first track
if (currentFiles && currentFiles.length > 0) {
    logDebug('\n📝 First track info:', {
        title: currentFiles[0].title,
        artist: currentFiles[0].artist,
        file_path: currentFiles[0].file_path,
        artwork_url: currentFiles[0].artwork_url,
    });
    logDebug('\nTo test playback, run: playTrack(0)');
} else {
    logDebug('\n⚠️ No tracks loaded yet');
}
