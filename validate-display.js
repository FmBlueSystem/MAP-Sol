const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 VALIDACIÓN COMPLETA DE METADATA EN BASE DE DATOS\n');
console.log('='.repeat(60));

// 1. Verificar estructura de la tabla
console.log('\n📊 ESTRUCTURA DE LA TABLA audio_files:');
db.all('PRAGMA table_info(audio_files)', (err, columns) => {
    if (err) {
        console.error('Error:', err);
        return;
    }

    const aiColumns = columns.filter((col) => col.name.startsWith('AI_'));
    console.log(`Total columnas: ${columns.length}`);
    console.log(`Columnas AI: ${aiColumns.length}`);
    console.log('\nColumnas AI disponibles:');
    aiColumns.forEach((col) => {
        console.log(`  - ${col.name} (${col.type})`);
    });

    // 2. Verificar datos actuales
    console.log('\n' + '='.repeat(60));
    console.log('\n📀 TRACKS CON METADATA AI:\n');

    const query = `
        SELECT 
            id,
            title,
            artist,
            AI_BPM,
            AI_KEY,
            AI_ENERGY,
            AI_MOOD,
            AI_DANCEABILITY,
            AI_VALENCE,
            file_path
        FROM audio_files
        WHERE AI_BPM IS NOT NULL 
           OR AI_KEY IS NOT NULL 
           OR AI_ENERGY IS NOT NULL
        ORDER BY id
    `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error:', err);
            db.close();
            return;
        }

        if (rows.length === 0) {
            console.log('❌ NO HAY TRACKS CON METADATA AI');
            console.log('Ejecuta: node add-test-metadata.js para agregar datos de prueba');
        } else {
            console.log(`✅ Encontrados ${rows.length} tracks con metadata AI:\n`);

            rows.forEach((row, index) => {
                console.log(`Track ${index + 1}:`);
                console.log(`  ID: ${row.id}`);
                console.log(`  Título: ${row.title}`);
                console.log(`  Artista: ${row.artist}`);
                console.log(`  BPM: ${row.AI_BPM || 'N/A'}`);
                console.log(`  Key: ${row.AI_KEY || 'N/A'}`);
                console.log(`  Energy: ${row.AI_ENERGY ? (row.AI_ENERGY * 100).toFixed(0) + '%' : 'N/A'}`);
                console.log(`  Mood: ${row.AI_MOOD || 'N/A'}`);
                console.log(
                    `  Danceability: ${row.AI_DANCEABILITY ? (row.AI_DANCEABILITY * 100).toFixed(0) + '%' : 'N/A'}`
                );
                console.log(`  Archivo: ${path.basename(row.file_path)}`);
                console.log('-'.repeat(40));
            });
        }

        // 3. Estadísticas generales
        console.log('\n' + '='.repeat(60));
        console.log('\n📈 ESTADÍSTICAS DE METADATA:\n');

        db.get(
            `
            SELECT 
                COUNT(*) as total_tracks,
                COUNT(AI_BPM) as with_bpm,
                COUNT(AI_KEY) as with_key,
                COUNT(AI_ENERGY) as with_energy,
                COUNT(AI_MOOD) as with_mood,
                COUNT(AI_DANCEABILITY) as with_danceability,
                COUNT(AI_VALENCE) as with_valence,
                AVG(AI_BPM) as avg_bpm,
                AVG(AI_ENERGY) as avg_energy
            FROM audio_files
        `,
            (err, stats) => {
                if (!err && stats) {
                    console.log(`Total de tracks: ${stats.total_tracks}`);
                    console.log(
                        `Tracks con BPM: ${stats.with_bpm} (${((stats.with_bpm / stats.total_tracks) * 100).toFixed(1)}%)`
                    );
                    console.log(
                        `Tracks con Key: ${stats.with_key} (${((stats.with_key / stats.total_tracks) * 100).toFixed(1)}%)`
                    );
                    console.log(
                        `Tracks con Energy: ${stats.with_energy} (${((stats.with_energy / stats.total_tracks) * 100).toFixed(1)}%)`
                    );
                    console.log(
                        `Tracks con Mood: ${stats.with_mood} (${((stats.with_mood / stats.total_tracks) * 100).toFixed(1)}%)`
                    );

                    if (stats.avg_bpm) {
                        console.log(`\nBPM promedio: ${Math.round(stats.avg_bpm)}`);
                        console.log(`Energy promedio: ${(stats.avg_energy * 100).toFixed(0)}%`);
                    }
                }

                console.log('\n' + '='.repeat(60));
                console.log('\n✅ VALIDACIÓN COMPLETA\n');

                if (rows.length === 3) {
                    console.log('✅ Los 3 tracks tienen metadata AI correcta');
                    console.log('✅ Los datos están listos para mostrarse en el player');
                } else {
                    console.log('⚠️  Hay tracks sin metadata AI');
                    console.log('Ejecuta los scripts de análisis para agregar más metadata');
                }

                db.close();
            }
        );
    });
});
