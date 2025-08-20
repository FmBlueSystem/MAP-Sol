// TASK_023: Filter handler modularizado

function createFilterHandler(db) {
    return async () => {
        return new Promise((resolve) => {
            const result = { genres: [], moods: [] };

            // Obtener géneros únicos
            db.all(
                `
                SELECT DISTINCT LLM_GENRE as genre 
                FROM llm_metadata 
                WHERE LLM_GENRE IS NOT NULL 
                ORDER BY LLM_GENRE
            `,
                [],
                (err, genreRows) => {
                    if (!err) {
                        result.genres = genreRows.map((r) => r.genre).filter((g) => g);
                    }

                    // Obtener moods únicos
                    db.all(
                        `
                    SELECT DISTINCT AI_MOOD as mood 
                    FROM llm_metadata 
                    WHERE AI_MOOD IS NOT NULL 
                    ORDER BY AI_MOOD
                `,
                        [],
                        (err, moodRows) => {
                            if (!err) {
                                result.moods = moodRows.map((r) => r.mood).filter((m) => m);
                            }

                            resolve(result);
                        }
                    );
                }
            );
        });
    };
}

module.exports = { createFilterHandler };
