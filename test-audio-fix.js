// Test script for audio saturation fix
// Run this in the browser console

console.log('🧪 TESTING AUDIO SATURATION FIX...\n');

// Test 1: Check AudioChainManager state
console.log('1️⃣ AudioChainManager State:');
if (audioChainManager) {
    const state = audioChainManager.getState();
    console.log('   Initialized:', state.initialized);
    console.log('   Context:', state.contextState);
    console.log('   Volume:', state.volume);
    console.log('   Compression:', audioChainManager.compressionEnabled || false);
    console.log('   Normalization:', audioChainManager.normalizationEnabled || false);
    console.log('   Smart Volume:', audioChainManager.smartVolumeEnabled || false);
} else {
    console.error('   ❌ AudioChainManager not found!');
}

// Test 2: Reset everything
console.log('\n2️⃣ Resetting Audio Levels...');
if (audioChainManager) {
    audioChainManager.resetAudioLevels();
    console.log('   ✅ Audio reset to safe defaults');
    console.log('   Input Gain:', audioChainManager.nodes.inputGain.gain.value);
    console.log('   Output Gain:', audioChainManager.nodes.outputGain.gain.value);
    console.log('   Compressor Ratio:', audioChainManager.nodes.compressor.ratio.value);
}

// Test 3: Test individual controls
console.log('\n3️⃣ Testing Individual Controls:');

setTimeout(() => {
    console.log('   Testing Compression ON...');
    if (typeof toggleCompressionMode === 'function') {
        toggleCompressionMode();
        console.log('   Compression:', audioChainManager.compressionEnabled);
    }
}, 1000);

setTimeout(() => {
    console.log('   Testing Compression OFF...');
    if (typeof toggleCompressionMode === 'function') {
        toggleCompressionMode();
        console.log('   Compression:', audioChainManager.compressionEnabled);
    }
}, 2000);

setTimeout(() => {
    console.log('   Testing Normalization ON...');
    if (typeof toggleNormalizationMode === 'function') {
        toggleNormalizationMode();
        console.log('   Normalization:', audioChainManager.normalizationEnabled);
        console.log('   Input Gain:', audioChainManager.nodes.inputGain.gain.value);
    }
}, 3000);

setTimeout(() => {
    console.log('   Testing Normalization OFF...');
    if (typeof toggleNormalizationMode === 'function') {
        toggleNormalizationMode();
        console.log('   Normalization:', audioChainManager.normalizationEnabled);
        console.log('   Input Gain:', audioChainManager.nodes.inputGain.gain.value);
    }
}, 4000);

setTimeout(() => {
    console.log('   Testing Smart Volume ON...');
    if (typeof toggleSmartVolumeMode === 'function') {
        toggleSmartVolumeMode();
        console.log('   Smart Volume:', audioChainManager.smartVolumeEnabled);
    }
}, 5000);

setTimeout(() => {
    console.log('   Testing Smart Volume OFF...');
    if (typeof toggleSmartVolumeMode === 'function') {
        toggleSmartVolumeMode();
        console.log('   Smart Volume:', audioChainManager.smartVolumeEnabled);
    }
}, 6000);

// Test 4: Check for saturation with all enabled
setTimeout(() => {
    console.log('\n4️⃣ Testing Combined Settings:');
    console.log('   Enabling ALL (testing for saturation)...');
    
    audioChainManager.toggleCompression(true);
    audioChainManager.toggleNormalization(true);
    audioChainManager.toggleSmartVolume(true);
    
    console.log('   Compression ON');
    console.log('   Normalization ON');
    console.log('   Smart Volume ON');
    console.log('   Input Gain:', audioChainManager.nodes.inputGain.gain.value);
    console.log('   Output Gain:', audioChainManager.nodes.outputGain.gain.value);
    console.log('   Total Gain:', audioChainManager.nodes.inputGain.gain.value * audioChainManager.nodes.outputGain.gain.value);
    
    if (audioChainManager.nodes.inputGain.gain.value * audioChainManager.nodes.outputGain.gain.value > 1.0) {
        console.warn('   ⚠️ WARNING: Total gain > 1.0, may cause saturation!');
    } else {
        console.log('   ✅ Total gain is safe (< 1.0)');
    }
}, 7000);

// Test 5: Final reset
setTimeout(() => {
    console.log('\n5️⃣ Final Reset:');
    if (typeof resetAllAudioLevels === 'function') {
        resetAllAudioLevels();
        console.log('   ✅ Emergency reset completed');
        console.log('   All controls should be OFF');
        console.log('   Audio should sound clean now');
    }
    
    console.log('\n✅ TEST COMPLETE!');
    console.log('🎵 Play a track to test audio quality');
    console.log('🚨 If still saturated, click the Emergency Reset button');
}, 8000);