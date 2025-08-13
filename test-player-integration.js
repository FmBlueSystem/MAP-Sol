// Test script to verify player integration
// Run this in the console of index-complete.html

console.log('Testing Player Integration...');

// Check if FixedAudioPlayer is initialized
if (typeof fixedPlayer !== 'undefined') {
    console.log('✅ FixedAudioPlayer instance found');
    
    // Check audio context
    if (fixedPlayer.audioContext) {
        console.log('✅ Audio context initialized:', fixedPlayer.audioContext.state);
    } else {
        console.log('❌ Audio context not initialized');
    }
    
    // Check analyser
    if (fixedPlayer.analyser) {
        console.log('✅ Analyser initialized with FFT size:', fixedPlayer.analyser.fftSize);
    } else {
        console.log('❌ Analyser not initialized');
    }
} else {
    console.log('❌ FixedAudioPlayer not found');
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
    'volumeSlider': 'Volume slider'
};

console.log('\nChecking UI elements:');
let missingElements = [];
for (const [id, description] of Object.entries(uiElements)) {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ ${description} (#${id})`);
    } else {
        console.log(`❌ ${description} (#${id}) - NOT FOUND`);
        missingElements.push(id);
    }
}

if (missingElements.length === 0) {
    console.log('\n🎉 All UI elements found! Player should be fully functional.');
} else {
    console.log(`\n⚠️ Missing ${missingElements.length} elements:`, missingElements);
}

// Test play function with first track
if (currentFiles && currentFiles.length > 0) {
    console.log('\n📝 First track info:', {
        title: currentFiles[0].title,
        artist: currentFiles[0].artist,
        file_path: currentFiles[0].file_path,
        artwork_url: currentFiles[0].artwork_url
    });
    console.log('\nTo test playback, run: playTrack(0)');
} else {
    console.log('\n⚠️ No tracks loaded yet');
}