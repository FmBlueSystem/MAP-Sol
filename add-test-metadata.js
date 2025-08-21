const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

// Test metadata to add
const testMetadata = [
    { bpm: 128, key: '8A', energy: 0.85, mood: 'Energetic' },
    { bpm: 95, key: '2B', energy: 0.45, mood: 'Chill' },
    { bpm: 140, key: '11A', energy: 0.92, mood: 'Intense' },
    { bpm: 110, key: '5B', energy: 0.65, mood: 'Groovy' },
    { bpm: 174, key: '6A', energy: 0.88, mood: 'Aggressive' },
    { bpm: 85, key: '9B', energy: 0.35, mood: 'Relaxed' },
    { bpm: 122, key: '4A', energy: 0.75, mood: 'Happy' },
    { bpm: 100, key: '7B', energy: 0.55, mood: 'Melancholic' },
    { bpm: 130, key: '1A', energy: 0.8, mood: 'Uplifting' },
    { bpm: 118, key: '10B', energy: 0.7, mood: 'Dark' },
];

// Update first 10 tracks with test metadata
db.serialize(() => {
    console.log('Adding test metadata to tracks...');

    // Get first 10 tracks
    db.all('SELECT id, title FROM audio_files LIMIT 10', (err, rows) => {
        if (err) {
            console.error('Error getting tracks:', err);
            return;
        }

        if (rows.length === 0) {
            console.log('No tracks found in database');
            db.close();
            return;
        }

        let updated = 0;

        rows.forEach((row, index) => {
            const metadata = testMetadata[index % testMetadata.length];

            const sql = `
                UPDATE audio_files 
                SET AI_BPM = ?, 
                    AI_KEY = ?, 
                    AI_ENERGY = ?,
                    AI_MOOD = ?,
                    AI_DANCEABILITY = ?,
                    AI_VALENCE = ?,
                    AI_ANALYZED = 1
                WHERE id = ?
            `;

            const params = [
                metadata.bpm,
                metadata.key,
                metadata.energy,
                metadata.mood,
                metadata.energy * 0.9, // Danceability similar to energy
                metadata.energy * 0.8, // Valence similar to energy
                row.id,
            ];

            db.run(sql, params, function (err) {
                if (err) {
                    console.error(`Error updating track ${row.id}:`, err);
                } else {
                    updated++;
                    console.log(`✅ Updated track ${row.id}: ${row.title || 'Unknown'}`);
                    console.log(
                        `   BPM: ${metadata.bpm}, Key: ${metadata.key}, Energy: ${Math.round(metadata.energy * 100)}%, Mood: ${metadata.mood}`
                    );

                    if (updated === rows.length) {
                        console.log(`\n✅ Successfully updated ${updated} tracks with test metadata`);

                        // Verify the update
                        db.get('SELECT COUNT(*) as count FROM audio_files WHERE AI_BPM IS NOT NULL', (err, result) => {
                            if (!err && result) {
                                console.log(`\nTotal tracks with AI metadata: ${result.count}`);
                            }
                            db.close();
                        });
                    }
                }
            });
        });
    });
});
