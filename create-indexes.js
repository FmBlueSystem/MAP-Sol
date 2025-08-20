const sqlite3 = require('sqlite3').verbose();
const path = require('path');

logDebug('🔧 Creando índices para optimizar búsquedas...\n');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

const indexes = [
    // Índices para búsqueda rápida
    'CREATE INDEX IF NOT EXISTS idx_artist ON audio_files(artist)',
    'CREATE INDEX IF NOT EXISTS idx_title ON audio_files(title)',
    'CREATE INDEX IF NOT EXISTS idx_file_name ON audio_files(file_name)',
    'CREATE INDEX IF NOT EXISTS idx_genre ON audio_files(genre)',

    // Índices para metadatos LLM
    'CREATE INDEX IF NOT EXISTS idx_llm_genre ON llm_metadata(LLM_GENRE)',
    'CREATE INDEX IF NOT EXISTS idx_ai_mood ON llm_metadata(AI_MOOD)',
    'CREATE INDEX IF NOT EXISTS idx_ai_bpm ON llm_metadata(AI_BPM)',
    'CREATE INDEX IF NOT EXISTS idx_ai_energy ON llm_metadata(AI_ENERGY)',

    // Índice compuesto para joins frecuentes
    'CREATE INDEX IF NOT EXISTS idx_file_id ON llm_metadata(file_id)',
];

let completed = 0;

indexes.forEach((indexSql, i) => {
    db.run(indexSql, (err) => {
        if (err) {
            logError(`❌ Error creando índice ${i + 1}:`, err.message);
        } else {
            logInfo('✅ Índice ${i + 1}/${indexes.length} creado');
        }

        completed++;
        if (completed === indexes.length) {
            logDebug('\n🎉 Todos los índices creados exitosamente');
            logDebug('📊 La búsqueda ahora será mucho más rápida\n');

            // Verificar índices creados
            db.all("SELECT name FROM sqlite_master WHERE type='index'", (err, rows) => {
                if (!err) {
                    logDebug('📋 Índices en la base de datos:');
                    rows.forEach((row) => {
                        if (!row.name.startsWith('sqlite_')) {
                            logDebug(`   - ${row.name}`);
                        }
                    });
                }
                db.close();
            });
        }
    });
});
