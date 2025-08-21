const sqlite3 = require('sqlite3').verbose();
const { createArtworkHandler } = require('./handlers/artwork-handler');

const db = new sqlite3.Database('./music_analyzer.db');

console.log('🔍 Testing artwork handler directly...\n');

const handler = createArtworkHandler(db);

// Call the handler
handler()
    .then((result) => {
        console.log('✅ Handler returned:', {
            totalFiles: result.files.length,
            filesWithArtwork: result.filesWithArtwork,
        });

        // Check specific tracks
        const track3814 = result.files.find((f) => f.id === 3814);
        if (track3814) {
            console.log('\n🎯 TRACK 3814 DATA:');
            console.log('  Title:', track3814.title);
            console.log('  AI_BPM:', track3814.AI_BPM);
            console.log('  AI_KEY:', track3814.AI_KEY);
            console.log('  AI_ENERGY:', track3814.AI_ENERGY);
            console.log('  AI_MOOD:', track3814.AI_MOOD);
            console.log('  bpm (alias):', track3814.bpm);
            console.log('  key (alias):', track3814.key);
            console.log('  energy (alias):', track3814.energy);
            console.log('  mood (alias):', track3814.mood);
        } else {
            console.log('❌ Track 3814 not found in results');
        }

        db.close();
    })
    .catch((err) => {
        console.error('❌ Error:', err);
        db.close();
    });
