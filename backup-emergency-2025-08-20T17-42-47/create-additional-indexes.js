const sqlite3 = require('sqlite3').verbose();
const path = require('path');

logDebug('🔧 CREANDO ÍNDICES SQL ADICIONALES');
logDebug('=====================================\n');

const db = new sqlite3.Database('music_analyzer.db');

// Función para crear un índice de forma segura
function createIndex(indexName, tableName, columns, callback) {
    const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columns})`;

    db.run(sql, (err) => {
        if (err) {
            logError('❌ Error creando ${indexName}: ${err.message}');
        } else {
            logInfo('✅ Índice ${indexName} creado/verificado');
        }
        callback();
    });
}

// Lista de índices adicionales para crear
const indexes = [
    // Índices compuestos para búsquedas comunes
    {
        name: 'idx_search_composite',
        table: 'audio_files',
        columns: 'artist, title, album',
    },

    // Índice para ordenamiento por artista y título
    {
        name: 'idx_artist_title',
        table: 'audio_files',
        columns: 'artist COLLATE NOCASE, title COLLATE NOCASE',
    },

    // Índice para búsqueda por extensión de archivo
    {
        name: 'idx_file_extension',
        table: 'audio_files',
        columns: 'file_extension',
    },

    // Índice compuesto para filtros combinados
    {
        name: 'idx_genre_mood_composite',
        table: 'llm_metadata',
        columns: 'LLM_GENRE, AI_MOOD',
    },

    // Índice para búsqueda por BPM range
    {
        name: 'idx_bpm_range',
        table: 'audio_files',
        columns: 'existing_bmp',
    },

    // Índice para tracks con artwork
    {
        name: 'idx_artwork_path',
        table: 'audio_files',
        columns: 'artwork_path',
    },

    // Índice para búsqueda por década
    {
        name: 'idx_year_decade',
        table: 'audio_files',
        columns: 'year',
    },

    // Índice para búsqueda por duración
    {
        name: 'idx_duration',
        table: 'audio_files',
        columns: 'duration',
    },

    // Índice compuesto para playlist generation
    {
        name: 'idx_playlist_generation',
        table: 'llm_metadata',
        columns: 'AI_ENERGY, AI_BPM, AI_MOOD',
    },

    // Índice para búsqueda de tracks analizados
    {
        name: 'idx_analyzed_status',
        table: 'llm_metadata',
        columns: 'file_id, AI_ANALYZED',
    },

    // Índice para búsqueda por key musical
    {
        name: 'idx_musical_key',
        table: 'audio_files',
        columns: 'mixed_in_key',
    },

    // Índice para búsqueda por fecha de adición
    {
        name: 'idx_date_added',
        table: 'audio_files',
        columns: 'date_added DESC',
    },

    // Índice para búsqueda por última reproducción
    {
        name: 'idx_last_played',
        table: 'audio_files',
        columns: 'last_played DESC',
    },

    // Índice para búsqueda por play count
    {
        name: 'idx_play_count',
        table: 'audio_files',
        columns: 'play_count DESC',
    },

    // Índice para búsqueda por rating
    {
        name: 'idx_rating',
        table: 'audio_files',
        columns: 'rating DESC',
    }
];

// Crear todos los índices
let currentIndex = 0;

function createNextIndex() {
    if (currentIndex >= indexes.length) {
        // Optimizar la base de datos después de crear índices
        logDebug('\n🔄 Optimizando base de datos...');

        db.run('VACUUM', (err) => {
            if (err) {
                logError('❌ Error optimizando:', err.message);
            } else {
                logInfo('✅ Base de datos optimizada');
            }

            // Analizar estadísticas
            db.run('ANALYZE', (err) => {
                if (err) {
                    logError('❌ Error analizando:', err.message);
                } else {
                    logInfo('✅ Estadísticas actualizadas');
                }

                // Mostrar información de la base de datos
                db.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
                    if (!err) {
                        logDebug(`\n📊 Total de archivos: ${row.count}`);
                    }

                    // Mostrar tamaño de la base de datos
                    const fs = require('fs');
                    const stats = fs.statSync('music_analyzer.db');
                    const fileSizeInMB = stats.size / (1024 * 1024);
                    logDebug(`💾 Tamaño de BD: ${fileSizeInMB.toFixed(2)} MB`);

                    // Listar todos los índices
                    logDebug('\n📋 Índices disponibles:');
                    db.all(
                        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                        (err, rows) => {
                            if (!err) {
                                rows.forEach((row) => {
                                    logDebug(`   - ${row.name}`);
                                });
                                logDebug(`\n✅ Total de índices: ${rows.length}`);
                            }

                            logDebug('\n✅ Proceso completado!');
                            db.close();
                        }
                    );
                });
            });
        });
        return;
    }

    const index = indexes[currentIndex];
    currentIndex++;
    createIndex(index.name, index.table, index.columns, createNextIndex);
}

// Iniciar el proceso
createNextIndex();
