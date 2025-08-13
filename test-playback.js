// Test Audio Playback
// Run this in the console to verify playback works

console.log('🧪 TESTING AUDIO PLAYBACK...\n');

// Test 1: Check player exists
console.log('1️⃣ Checking player...');
if (window.player) {
    console.log('✅ Player exists');
    console.log('  - Current track:', player.currentTrackId);
    console.log('  - Is playing:', player.isPlaying);
    console.log('  - Audio element:', !!player.currentAudio);
} else {
    console.error('❌ Player not found!');
}

// Test 2: Check audio chain
console.log('\n2️⃣ Checking audio chain...');
if (window.simpleAudio) {
    console.log('✅ SimpleAudio available');
    if (!window.simpleAudio.audioContext) {
        window.simpleAudio.init();
        console.log('  - Initialized SimpleAudio');
    }
} else if (window.audioChainManager) {
    console.log('⚠️ Using AudioChainManager (not SimpleAudio)');
} else {
    console.log('❌ No audio chain available!');
}

// Test 3: Try to play first track
console.log('\n3️⃣ Attempting to play first track...');
const firstTrack = document.querySelector('[data-track-id]');
if (firstTrack) {
    const trackId = firstTrack.dataset.trackId;
    const filepath = firstTrack.getAttribute('onclick')?.match(/play\('([^']+)'/)?.[1];
    
    if (filepath) {
        console.log(`🎵 Playing: ${filepath}`);
        console.log(`   Track ID: ${trackId}`);
        
        // Get track data
        const trackData = window.filteredTracks?.find(t => t.id == trackId);
        
        // Try to play
        if (window.player) {
            window.player.play(filepath, trackId, trackData, false);
            
            // Check after 1 second
            setTimeout(() => {
                if (player.isPlaying) {
                    console.log('✅ PLAYBACK WORKING!');
                    console.log('  - Volume:', player.currentAudio?.volume);
                    console.log('  - Duration:', player.currentAudio?.duration);
                    console.log('  - Current time:', player.currentAudio?.currentTime);
                } else {
                    console.error('❌ Playback failed');
                }
            }, 1000);
        }
    } else {
        console.error('❌ Could not extract filepath');
    }
} else {
    console.error('❌ No tracks found in DOM');
}

// Test 4: Direct audio test
console.log('\n4️⃣ Testing direct audio (no processing)...');
function testDirectAudio() {
    const testAudio = new Audio();
    const firstTrack = document.querySelector('[data-track-id]');
    
    if (firstTrack) {
        const filepath = firstTrack.getAttribute('onclick')?.match(/play\('([^']+)'/)?.[1];
        if (filepath) {
            testAudio.src = filepath;
            testAudio.volume = 0.5;
            
            testAudio.play().then(() => {
                console.log('✅ Direct audio playback works!');
                console.log('  - If this works but player doesnt, issue is in player code');
                
                setTimeout(() => {
                    testAudio.pause();
                    console.log('  - Test audio stopped');
                }, 3000);
            }).catch(err => {
                console.error('❌ Direct audio failed:', err);
            });
        }
    }
}

// Run direct test after 2 seconds
setTimeout(testDirectAudio, 2000);

console.log('\n💡 Debugging tips:');
console.log('  - Press Alt+Shift+E for Emergency Panel');
console.log('  - Click "FIX SATURATION" if audio is distorted');
console.log('  - Use fixAudioSaturation() to reset audio chain');
console.log('  - Check browser console for errors');