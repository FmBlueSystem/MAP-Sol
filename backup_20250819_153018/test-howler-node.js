#!/usr/bin/env node

// Test Howler directly in Node.js
const { Howl } = require('howler');
const path = require('path');

logDebug('🎵 Testing Howler.js directly...');

const testFile =
    '/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/ROSALÍA, Ozuna - Yo x Ti, Tu x Mi.flac';

logDebug('Creating Howl instance...');

const sound = new Howl({
    src: [testFile],
    html5: true, // Important for large files
    volume: 0.5,
    autoplay: false,
    preload: true,
    onload: () => {
        logInfo('✅ Track loaded successfully');
        logDebug('Duration:', sound.duration(), 'seconds');
        logDebug('Format:', sound._format);

        // Try to play
        logDebug('Attempting to play...');
        sound.play();
    },
    onplay: () => {
        logDebug('▶️ Playback started');

        // Stop after 3 seconds
        setTimeout(() => {
            logDebug('Stopping playback...');
            sound.stop();
        }, 3000);
    },
    onpause: () => {
        logDebug('⏸️ Playback paused');
    },
    onend: () => {
        logDebug('⏹️ Track ended');
        process.exit(0);
    },
    onstop: () => {
        logDebug('⏹️ Track stopped');
        process.exit(0);
    },
    onloaderror: (id, error) => {
        logError('❌ Load error:', error);
        process.exit(1);
    },
    onplayerror: (id, error) => {
        logError('❌ Play error:', error);
        process.exit(1);
    }
});

// Keep process alive
setTimeout(() => {
    logDebug('Test timeout - exiting');
    process.exit(0);
}, 10000);
