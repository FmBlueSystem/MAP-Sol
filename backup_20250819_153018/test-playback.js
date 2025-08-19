// Test Audio Playback
// Run this in the console to verify playback works

logDebug('🧪 TESTING AUDIO PLAYBACK...\n');

// Test 1: Check player exists
logDebug('1️⃣ Checking player...');
if (window.player) {
    logInfo('✅ Player exists');
    logDebug('  - Current track:', player.currentTrackId);
    logDebug('  - Is playing:', player.isPlaying);
    logDebug('  - Audio element:', !!player.currentAudio);
} else {
    logError('❌ Player not found!');
}

// Test 2: Check audio chain
logDebug('\n2️⃣ Checking audio chain...');
if (window.simpleAudio) {
    logInfo('✅ SimpleAudio available');
    if (!window.simpleAudio.audioContext) {
        window.simpleAudio.init();
        logDebug('  - Initialized SimpleAudio');
    }
} else if (window.audioChainManager) {
    logWarn('⚠️ Using AudioChainManager (not SimpleAudio)');
} else {
    logError('❌ No audio chain available!');
}

// Test 3: Try to play first track
logDebug('\n3️⃣ Attempting to play first track...');
const firstTrack = document.querySelector('[data-track-id]');
if (firstTrack) {
    const trackId = firstTrack.dataset.trackId;
    const filepath = firstTrack.getAttribute('onclick')?.match(/play\('([^']+)'/)?.[1];

    if (filepath) {
        logDebug(`🎵 Playing: ${filepath}`);
        logDebug(`   Track ID: ${trackId}`);

        // Get track data
        const trackData = window.filteredTracks?.find(t => t.id == trackId);

        // Try to play
        if (window.player) {
            window.player.play(filepath, trackId, trackData, false);

            // Check after 1 second
            setTimeout(() => {
                if (player.isPlaying) {
                    logInfo('✅ PLAYBACK WORKING!');
                    logDebug('  - Volume:', player.currentAudio?.volume);
                    logDebug('  - Duration:', player.currentAudio?.duration);
                    logDebug('  - Current time:', player.currentAudio?.currentTime);
                } else {
                    logError('❌ Playback failed');
                }
            }, 1000);
        }
    } else {
        logError('❌ Could not extract filepath');
    }
} else {
    logError('❌ No tracks found in DOM');
}

// Test 4: Direct audio test
logDebug('\n4️⃣ Testing direct audio (no processing)...');
function testDirectAudio() {
    const testAudio = new Audio();
    const firstTrack = document.querySelector('[data-track-id]');

    if (firstTrack) {
        const filepath = firstTrack.getAttribute('onclick')?.match(/play\('([^']+)'/)?.[1];
        if (filepath) {
            testAudio.src = filepath;
            testAudio.volume = 0.5;

            testAudio
                .play()
                .then(() => {
                    logInfo('✅ Direct audio playback works!');
                    logDebug('  - If this works but player doesnt, issue is in player code');

                    setTimeout(() => {
                        testAudio.pause();
                        logDebug('  - Test audio stopped');
                    }, 3000);
                })
                .catch(err => {
                    logError('❌ Direct audio failed:', err);
                });
        }
    }
}

// Run direct test after 2 seconds
setTimeout(testDirectAudio, 2000);

logDebug('\n💡 Debugging tips:');
logDebug('  - Press Alt+Shift+E for Emergency Panel');
logDebug('  - Click "FIX SATURATION" if audio is distorted');
logDebug('  - Use fixAudioSaturation() to reset audio chain');
logDebug('  - Check browser console for errors');
