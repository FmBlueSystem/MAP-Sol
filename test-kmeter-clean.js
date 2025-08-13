// Test script to verify K-Meter works without audio artifacts
// Run this in the browser console

console.log('🎚️ Testing K-Meter Professional (Clean Audio)...\n');

// Test 1: Check AudioChainManager is simplified
console.log('1️⃣ AudioChainManager State:');
if (audioChainManager) {
    const state = audioChainManager.getState();
    console.log('   Initialized:', state.initialized);
    console.log('   Context:', state.contextState);
    console.log('   Volume:', state.volume);
    
    // Check nodes
    const nodes = audioChainManager.nodes;
    console.log('   Nodes present:');
    console.log('     - Splitter:', !!nodes.splitter);
    console.log('     - Merger:', !!nodes.merger);
    console.log('     - AnalyzerL:', !!nodes.analyzerL);
    console.log('     - AnalyzerR:', !!nodes.analyzerR);
    console.log('     - InputGain:', !!nodes.inputGain, nodes.inputGain?.gain.value);
    console.log('     - OutputGain:', !!nodes.outputGain, nodes.outputGain?.gain.value);
    console.log('     - Compressor:', !!nodes.compressor); // Should be false
    console.log('     - Limiter:', !!nodes.limiter); // Should be false
}

// Test 2: Check K-Meter
console.log('\n2️⃣ K-Meter Status:');
if (player && player.kMeterVisualizer) {
    console.log('   K-Meter exists:', !!player.kMeterVisualizer);
    console.log('   K-Meter running:', player.kMeterVisualizer.isRunning);
    console.log('   K-System:', player.kMeterVisualizer.kSystem);
    console.log('   Reference Level:', player.kMeterVisualizer.referenceLevel);
} else {
    console.log('   ⚠️ K-Meter not initialized (play a track first)');
}

// Test 3: Check audio chain
console.log('\n3️⃣ Audio Chain:');
const analyzers = audioChainManager?.getAnalyzers();
if (analyzers) {
    console.log('   Left Analyzer:', !!analyzers.left);
    console.log('   Right Analyzer:', !!analyzers.right);
    console.log('   Context:', !!analyzers.context);
    console.log('   Sample Rate:', analyzers.context?.sampleRate);
} else {
    console.log('   ⚠️ No analyzers available');
}

// Test 4: Play test
console.log('\n4️⃣ To test clean audio:');
console.log('   1. Play any track');
console.log('   2. Check K-Meter is showing levels');
console.log('   3. Listen for any artifacts/saturation');
console.log('   4. Audio should be clean with no processing');

// Test 5: Verify no processing
console.log('\n5️⃣ Verifying NO audio processing:');
console.log('   Compression functions:', typeof toggleCompressionMode);
console.log('   Normalization functions:', typeof toggleNormalizationMode);
console.log('   Smart Volume functions:', typeof toggleSmartVolumeMode);
console.log('   These should all be "function" but do nothing');

console.log('\n✅ Test Complete!');
console.log('🎵 Play a track - audio should be CLEAN with only K-Meter visualization');
console.log('📊 K-Meter should show accurate Peak/RMS levels without affecting audio');