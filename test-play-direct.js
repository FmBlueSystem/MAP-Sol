#!/usr/bin/env node

// Direct test of the play-track IPC handler
const { ipcRenderer } = require('electron');

async function testPlayTrack() {
    const testFile =
        '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/ROSALÍA, Ozuna - Yo x Ti, Tu x Mi.flac';

    logDebug('🎵 Testing play-track handler...');
    logDebug('File:', testFile);

    try {
        const result = await ipcRenderer.invoke('play-track', testFile);
        logDebug('Result:', result);

        if (result.success) {
            logInfo('✅ Track playing successfully!');
            logDebug('Duration:', result.duration);
            logDebug('Format:', result.format);

            // Test playback state after 2 seconds
            setTimeout(async () => {
                const state = await ipcRenderer.invoke('get-playback-state');
                logDebug('Playback state:', state);
            }, 2000);

            // Stop after 5 seconds
            setTimeout(async () => {
                const stopResult = await ipcRenderer.invoke('stop-track');
                logDebug('Stop result:', stopResult);
            }, 5000);
        } else {
            logError('❌ Play failed:', result.error);
        }
    } catch (error) {
        logError('❌ Error:', error);
    }
}

// Run test when ready
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', testPlayTrack);
} else {
    logDebug('This script must be run in a renderer process');
}
