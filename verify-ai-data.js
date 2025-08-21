const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

console.log('Verifying AI metadata in database...\n');

// Check tracks with AI data
db.all(
    `
    SELECT 
        id, 
        title, 
        artist,
        AI_BPM, 
        AI_KEY, 
        AI_ENERGY,
        AI_MOOD
    FROM audio_files 
    WHERE AI_BPM IS NOT NULL 
       OR AI_KEY IS NOT NULL 
       OR AI_ENERGY IS NOT NULL
    ORDER BY id
`,
    (err, rows) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log(`Found ${rows.length} tracks with AI metadata:\n`);

            rows.forEach((row) => {
                console.log(`ID: ${row.id}`);
                console.log(`Title: ${row.title || 'Unknown'}`);
                console.log(`Artist: ${row.artist || 'Unknown'}`);
                console.log(`AI_BPM: ${row.AI_BPM}`);
                console.log(`AI_KEY: ${row.AI_KEY}`);
                console.log(`AI_ENERGY: ${row.AI_ENERGY}`);
                console.log(`AI_MOOD: ${row.AI_MOOD}`);
                console.log('---');
            });

            if (rows.length === 0) {
                console.log('❌ No tracks have AI metadata!');
                console.log('Run "node add-test-metadata.js" to add test data');
            }
        }

        db.close();
    }
);
