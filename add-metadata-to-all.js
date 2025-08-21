// Agregar metadata de prueba a TODOS los tracks que no la tienen
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Agregando metadata AI a TODOS los tracks sin datos...\n');

// Primero, ver cuántos tracks no tienen metadata
db.get(
    `
    SELECT COUNT(*) as total 
    FROM audio_files 
    WHERE AI_BPM IS NULL 
       OR AI_KEY IS NULL 
       OR AI_ENERGY IS NULL
`,
    (err, result) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        console.log(`📊 Tracks sin metadata completa: ${result.total}`);

        if (result.total === 0) {
            console.log('✅ Todos los tracks ya tienen metadata!');
            db.close();
            return;
        }

        // Generar metadata para todos los tracks que no la tienen
        const updateSql = `
        UPDATE audio_files 
        SET 
            AI_BPM = CASE 
                WHEN AI_BPM IS NULL THEN 
                    CAST(90 + (ABS(RANDOM()) % 80) AS REAL)
                ELSE AI_BPM 
            END,
            AI_KEY = CASE 
                WHEN AI_KEY IS NULL THEN 
                    CASE (ABS(RANDOM()) % 24)
                        WHEN 0 THEN '1A' WHEN 1 THEN '1B'
                        WHEN 2 THEN '2A' WHEN 3 THEN '2B'
                        WHEN 4 THEN '3A' WHEN 5 THEN '3B'
                        WHEN 6 THEN '4A' WHEN 7 THEN '4B'
                        WHEN 8 THEN '5A' WHEN 9 THEN '5B'
                        WHEN 10 THEN '6A' WHEN 11 THEN '6B'
                        WHEN 12 THEN '7A' WHEN 13 THEN '7B'
                        WHEN 14 THEN '8A' WHEN 15 THEN '8B'
                        WHEN 16 THEN '9A' WHEN 17 THEN '9B'
                        WHEN 18 THEN '10A' WHEN 19 THEN '10B'
                        WHEN 20 THEN '11A' WHEN 21 THEN '11B'
                        ELSE '12A'
                    END
                ELSE AI_KEY
            END,
            AI_ENERGY = CASE 
                WHEN AI_ENERGY IS NULL THEN 
                    CAST((30 + (ABS(RANDOM()) % 70)) / 100.0 AS REAL)
                ELSE AI_ENERGY
            END,
            AI_MOOD = CASE
                WHEN AI_MOOD IS NULL THEN
                    CASE (ABS(RANDOM()) % 5)
                        WHEN 0 THEN 'Energetic'
                        WHEN 1 THEN 'Chill'
                        WHEN 2 THEN 'Intense'
                        WHEN 3 THEN 'Happy'
                        ELSE 'Groovy'
                    END
                ELSE AI_MOOD
            END
        WHERE AI_BPM IS NULL 
           OR AI_KEY IS NULL 
           OR AI_ENERGY IS NULL
           OR AI_MOOD IS NULL
    `;

        db.run(updateSql, function (err) {
            if (err) {
                console.error('Error actualizando:', err);
            } else {
                console.log(`✅ Metadata agregada a ${this.changes} tracks!`);

                // Verificar algunos ejemplos
                db.all(
                    `
                SELECT id, title, AI_BPM, AI_KEY, AI_ENERGY, AI_MOOD 
                FROM audio_files 
                LIMIT 10
            `,
                    (err, rows) => {
                        if (!err) {
                            console.log('\n📋 Primeros 10 tracks con metadata:');
                            rows.forEach((row) => {
                                console.log(`  ${row.id}: ${row.title}`);
                                console.log(
                                    `     BPM: ${row.AI_BPM}, Key: ${row.AI_KEY}, Energy: ${row.AI_ENERGY}, Mood: ${row.AI_MOOD}`
                                );
                            });
                        }

                        db.close();
                        console.log('\n🎉 LISTO! Reinicia la app para ver los cambios.');
                    }
                );
            }
        });
    }
);
