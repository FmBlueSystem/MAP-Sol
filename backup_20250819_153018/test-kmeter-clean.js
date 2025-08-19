// Test script to verify K-Meter works without audio artifacts
// Run this in the browser console

logDebug('🎚️ Testing K-Meter Professional (Clean Audio)...\n');

// Test 1: Check AudioChainManager is simplified
logDebug('1️⃣ AudioChainManager State:');
if (audioChainManager) {
    const state = audioChainManager.getState();
    logDebug('   Initialized:', state.initialized);
    logDebug('   Context:', state.contextState);
    logDebug('   Volume:', state.volume);

    // Check nodes
    const nodes = audioChainManager.nodes;
    logDebug('   Nodes present:');
    logDebug('     - Splitter:', !!nodes.splitter);
    logDebug('     - Merger:', !!nodes.merger);
    logDebug('     - AnalyzerL:', !!nodes.analyzerL);
    logDebug('     - AnalyzerR:', !!nodes.analyzerR);
    logDebug('     - InputGain:', !!nodes.inputGain, nodes.inputGain?.gain.value);
    logDebug('     - OutputGain:', !!nodes.outputGain, nodes.outputGain?.gain.value);
    logDebug('     - Compressor:', !!nodes.compressor); // Should be false
    logDebug('     - Limiter:', !!nodes.limiter); // Should be false
}

// Test 2: Check K-Meter
logDebug('\n2️⃣ K-Meter Status:');
if (player && player.kMeterVisualizer) {
    logDebug('   K-Meter exists:', !!player.kMeterVisualizer);
    logDebug('   K-Meter running:', player.kMeterVisualizer.isRunning);
    logDebug('   K-System:', player.kMeterVisualizer.kSystem);
    logDebug('   Reference Level:', player.kMeterVisualizer.referenceLevel);
} else {
    logDebug('   ⚠️ K-Meter not initialized (play a track first)');
}

// Test 3: Check audio chain
logDebug('\n3️⃣ Audio Chain:');
const analyzers = audioChainManager?.getAnalyzers();
if (analyzers) {
    logDebug('   Left Analyzer:', !!analyzers.left);
    logDebug('   Right Analyzer:', !!analyzers.right);
    logDebug('   Context:', !!analyzers.context);
    logDebug('   Sample Rate:', analyzers.context?.sampleRate);
} else {
    logDebug('   ⚠️ No analyzers available');
}

// Test 4: Play test
logDebug('\n4️⃣ To test clean audio:');
logDebug('   1. Play any track');
logDebug('   2. Check K-Meter is showing levels');
logDebug('   3. Listen for any artifacts/saturation');
logDebug('   4. Audio should be clean with no processing');

// Test 5: Verify no processing
logDebug('\n5️⃣ Verifying NO audio processing:');
logDebug('   Compression functions:', typeof toggleCompressionMode);
logDebug('   Normalization functions:', typeof toggleNormalizationMode);
logDebug('   Smart Volume functions:', typeof toggleSmartVolumeMode);
logDebug('   These should all be "function" but do nothing');

logDebug('\n✅ Test Complete!');
logDebug('🎵 Play a track - audio should be CLEAN with only K-Meter visualization');
logDebug('📊 K-Meter should show accurate Peak/RMS levels without affecting audio');
