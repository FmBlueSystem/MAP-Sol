// Test script to verify metadata flow
const { ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

console.log('🔍 Testing metadata flow...\n');

// Test 1: Check database
db.get(
    `
    SELECT id, title, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD 
    FROM audio_files 
    WHERE id = 3814
`,
    (err, row) => {
        if (err) {
            console.error('❌ Database error:', err);
            return;
        }

        console.log('✅ Database has metadata for track 3814:');
        console.log('   BPM:', row.AI_BPM);
        console.log('   Key:', row.AI_KEY);
        console.log('   Energy:', row.AI_ENERGY);
        console.log('   Mood:', row.AI_MOOD);
        console.log('');
    }
);

// Test 2: Simulate IPC call
const { createArtworkHandler } = require('./handlers/artwork-handler');
const mockEvent = { reply: () => {} };

console.log('📡 Simulating IPC call to get-files-with-cached-artwork...\n');

const handler = createArtworkHandler(db);
handler(mockEvent, null, (result) => {
    const track3814 = result.files.find((f) => f.id === 3814);
    if (track3814) {
        console.log('✅ IPC handler returns track 3814 with:');
        console.log('   BPM:', track3814.bpm || track3814.AI_BPM || 'MISSING');
        console.log('   Key:', track3814.key || track3814.AI_KEY || 'MISSING');
        console.log('   Energy:', track3814.energy || track3814.AI_ENERGY || 'MISSING');
        console.log('   Mood:', track3814.mood || track3814.AI_MOOD || 'MISSING');
    } else {
        console.log('❌ Track 3814 not found in IPC response');
    }

    db.close();
});
