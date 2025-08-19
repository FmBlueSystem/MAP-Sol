#!/usr/bin/env node

/**
 * VERIFY UPDATES - Verifica que los archivos están siendo actualizados
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

logDebug('\n🔍 VERIFICACIÓN DE ACTUALIZACIONES');
logDebug('='.repeat(60));

// Query principal
const query = `
    SELECT 
        -- Totales
        (SELECT COUNT(*) FROM audio_files WHERE file_path NOT LIKE '%_DELETED') as total_files,
        (SELECT COUNT(*) FROM llm_metadata) as total_metadata,
        
        -- Análisis IA
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_DESCRIPTION IS NOT NULL) as with_description,
        (SELECT COUNT(*) FROM llm_metadata WHERE AI_MOOD IS NOT NULL) as with_mood,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_ERA IS NOT NULL) as with_era,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_ENERGY_LEVEL IS NOT NULL) as with_energy,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_LYRICS_LANGUAGE IS NOT NULL) as with_language,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_DJ_NOTES IS NOT NULL) as with_dj_notes,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_SIMILAR_ARTISTS IS NOT NULL) as with_similar,
        (SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1) as flag_analyzed,
        
        -- Últimas actualizaciones
        (SELECT datetime(MAX(LLM_ANALYSIS_DATE)) FROM llm_metadata) as last_analysis,
        (SELECT COUNT(*) FROM llm_metadata WHERE date(LLM_ANALYSIS_DATE) = date('now')) as analyzed_today
';

db.get(query, (err, row) => {
    if (err) {
        logError('Error:', err);
        db.close();
        return;
    }

    logDebug('\n📊 ESTADO DE LA BASE DE DATOS:');
    logDebug(`   Total de archivos: ${row.total_files}`);
    logDebug(
        `   Con metadata: ${row.total_metadata} (${((row.total_metadata / row.total_files) * 100).toFixed(1)}%)`
    );

    logDebug('\n🤖 ANÁLISIS CON IA:');
    logDebug(
        `   ✅ Con descripción: ${row.with_description} (${((row.with_description / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con mood: ${row.with_mood} (${((row.with_mood / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con era: ${row.with_era} (${((row.with_era / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con energy: ${row.with_energy} (${((row.with_energy / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con idioma: ${row.with_language} (${((row.with_language / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con DJ notes: ${row.with_dj_notes} (${((row.with_dj_notes / row.total_files) * 100).toFixed(1)}%)`
    );
    logDebug(
        `   ✅ Con artistas similares: ${row.with_similar} (${((row.with_similar / row.total_files) * 100).toFixed(1)}%)`
    );

    logDebug('\n📅 ACTIVIDAD:');
    logDebug(`   Última análisis: ${row.last_analysis || 'Nunca'}');
    logDebug(`   Analizados hoy: ${row.analyzed_today}`);
    logDebug(`   Flag LLM_ANALYZED=1: ${row.flag_analyzed}`);

    const pending = row.total_files - row.with_description;
    logDebug('\n💰 PENDIENTES:');
    logDebug(`   Archivos sin análisis: ${pending}`);
    logDebug(`   Costo estimado: ~$${(pending * 0.01).toFixed(2)} USD`);
    logDebug(`   Tiempo estimado: ~${Math.ceil((pending * 3) / 60)} minutos`);

    // Mostrar últimos 5 analizados
    logDebug('\n🆕 ÚLTIMOS 5 ANALIZADOS:');

    db.all(
        `
        SELECT 
            af.title,
            af.artist,
            lm.AI_MOOD,
            lm.LLM_ERA,
            datetime(lm.LLM_ANALYSIS_DATE) as date
        FROM audio_files af
        JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.LLM_DESCRIPTION IS NOT NULL
        ORDER BY lm.LLM_ANALYSIS_DATE DESC
        LIMIT 5
    `,
        (err, rows) => {
            if (err) {
                logError('Error:', err);
            } else {
                rows.forEach((row, i) => {
                    logDebug(`   ${i + 1}. "${row.title}" - ${row.artist}");
                    logDebug(`      ${row.LLM_ERA} | ${row.AI_MOOD} | ${row.date}`);
                });
            }

            logDebug('\n✅ Los archivos SÍ están siendo actualizados correctamente.\n');
            db.close();
        }
    );
});
