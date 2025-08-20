// Simple Player Handler - Básico y directo
function createSimplePlayerHandlers(db) {
    // Get track basic data
    const getTrackForPlayerHandler = async (event, trackId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT af.*, lm.AI_BPM, lm.AI_KEY
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.id = ?
            `;

            db.get(sql, [trackId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    };

    return {
        getTrackForPlayerHandler,
    };
}

module.exports = { createSimplePlayerHandlers };
