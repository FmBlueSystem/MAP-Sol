// SIMPLE HANDLER QUE FUNCIONA
const sqlite3 = require('sqlite3').verbose();

function createSimpleHandler(db) {
    return async () => {
        return new Promise((resolve) => {
            // Query DIRECTA sin complicaciones
            db.all('SELECT * FROM audio_files WHERE AI_BPM IS NOT NULL LIMIT 10', (err, rows) => {
                if (err) {
                    console.error('DB Error:', err);
                    resolve({ files: [] });
                } else {
                    console.log(`✅ SIMPLE HANDLER: Found ${rows.length} tracks with metadata`);

                    // Log first track
                    if (rows[0]) {
                        console.log('First track:', {
                            id: rows[0].id,
                            title: rows[0].title,
                            AI_BPM: rows[0].AI_BPM,
                            AI_KEY: rows[0].AI_KEY,
                            AI_ENERGY: rows[0].AI_ENERGY,
                        });
                    }

                    resolve({ files: rows });
                }
            });
        });
    };
}

module.exports = { createSimpleHandler };
