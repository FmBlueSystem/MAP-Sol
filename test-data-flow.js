const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Connect to database
const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

console.log('Testing data flow for AI metadata...\n');

// 1. Test database query (same as artwork handler)
const sql = `
    SELECT 
        af.id,
        af.file_path,
        af.file_name,
        af.title,
        af.artist,
        af.album,
        af.genre,
        af.file_extension,
        af.bmp,
        af.existing_bmp,
        af.existing_key,
        af.artwork_path,
        af.duration,
        af.energy_level,
        af.comment,
        af.AI_ENERGY,
        af.AI_KEY,
        af.AI_BPM,
        af.AI_MOOD,
        af.AI_DANCEABILITY,
        af.AI_VALENCE,
        COALESCE(af.AI_BPM, af.bmp, af.existing_bmp) as BPM
    FROM audio_files af
    WHERE af.AI_BPM IS NOT NULL 
       OR af.AI_KEY IS NOT NULL 
       OR af.AI_ENERGY IS NOT NULL
    ORDER BY af.id
    LIMIT 5
`;

db.all(sql, [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log(`Found ${rows.length} tracks with AI metadata from handler query:\n`);

    rows.forEach((row) => {
        console.log('Track:', {
            id: row.id,
            title: row.title,
            AI_BPM: row.AI_BPM,
            AI_KEY: row.AI_KEY,
            AI_ENERGY: row.AI_ENERGY,
            BPM: row.BPM,
            bmp: row.bmp,
            existing_bmp: row.existing_bmp,
        });
        console.log('---');
    });

    // 2. Test what the handler would return
    const artworkDir = path.join(__dirname, 'artwork-cache');

    rows.forEach((file) => {
        const artworkPath = path.join(artworkDir, `${file.id}.jpg`);
        const defaultImagePath = path.join(__dirname, 'image.png');

        if (fs.existsSync(artworkPath)) {
            file.artwork_url = `artwork-cache/${file.id}.jpg`;
            file.has_artwork = true;
        } else {
            file.artwork_url = 'image.png';
            file.has_artwork = false;
        }
    });

    console.log('\n✅ Data structure that would be sent to frontend:');
    console.log(JSON.stringify({ files: rows.slice(0, 1) }, null, 2));

    db.close();
});
