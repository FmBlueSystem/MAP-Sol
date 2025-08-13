// Test script for audio processing controls
// Run this in the browser console to test functionality

console.log('🧪 Testing Audio Processing Controls...');

// Test 1: Check if AudioChainManager is initialized
console.log('1. AudioChainManager exists?', typeof audioChainManager !== 'undefined');
if (audioChainManager) {
    console.log('   State:', audioChainManager.getState());
}

// Test 2: Check Smart Volume toggle
console.log('2. Testing Smart Volume toggle...');
const smartVolumeBtn = document.getElementById('btn-smart-volume');
if (smartVolumeBtn) {
    console.log('   Button found, current state:', smartVolumeBtn.classList.contains('active'));
    // Simulate click
    smartVolumeBtn.click();
    console.log('   After click:', smartVolumeBtn.classList.contains('active'));
}

// Test 3: Check normalization mode selector
console.log('3. Testing normalization mode selector...');
const normModeSelect = document.getElementById('norm-mode');
if (normModeSelect) {
    console.log('   Current mode:', normModeSelect.value);
    // Try changing mode
    normModeSelect.value = 'aggressive';
    changeNormMode('aggressive');
    console.log('   Changed to aggressive mode');
}

// Test 4: Check gain display
console.log('4. Testing gain display...');
const gainValue = document.getElementById('gain-value');
const gainFill = document.getElementById('gain-fill-mini');
if (gainValue && gainFill) {
    console.log('   Gain value:', gainValue.textContent);
    console.log('   Gain fill width:', gainFill.style.width);
}

// Test 5: Check localStorage persistence
console.log('5. Testing persistence...');
console.log('   Smart Volume saved:', localStorage.getItem('smartVolumeEnabled'));
console.log('   Normalization mode saved:', localStorage.getItem('normalizationMode'));

// Test 6: Play a track to test real-time processing
console.log('6. To test real-time processing:');
console.log('   - Click on any track to play it');
console.log('   - Watch the gain indicator update');
console.log('   - Try different normalization modes');
console.log('   - Toggle Smart Volume on/off');

console.log('✅ Audio Processing Test Complete!');