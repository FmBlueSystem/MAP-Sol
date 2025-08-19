#!/usr/bin/env node

/**
 * FIX_OBJECT_FIELDS.JS
 * Corrige los campos que muestran [object Object] en la BD
 */

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./music_analyzer.db');

async function fixObjectFields() {
    logDebug('🔧 Corrigiendo campos [object Object]...\n');

    // Encontrar registros con el problema
    const getProblematic = () =>
        new Promise((resolve, reject) => {
            db.all(
                `
            SELECT file_id, LLM_OCCASIONS 
            FROM llm_metadata 
            WHERE LLM_OCCASIONS LIKE '%object%'
        ',
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

    const problematic = await getProblematic();
    logDebug(`Encontrados ${problematic.length} registros con [object Object]\n`);

    let fixed = 0;

    for (const row of problematic) {
        // Para estos registros, vamos a poner un valor por defecto basado en el análisis
        // Ya que el valor original se perdió al convertirse en [object Object]

        // Obtener info del track para determinar la ocasión apropiada
        const getTrackInfo = () =>
            new Promise((resolve, reject) => {
                db.get(
                    `
                SELECT af.title, af.artist, lm.AI_BPM, lm.AI_ENERGY, lm.AI_MOOD
                FROM audio_files af
                JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE lm.file_id = ?
            `,
                    [row.file_id],
                    (err, track) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(track);
                        }
                    }
                );
            });

        const track = await getTrackInfo();

        // Determinar ocasión basada en BPM y energía
        let occasion = 'Party'; // Default

        if (track.AI_BPM < 100) {
            occasion = 'Relaxation';
        } else if (track.AI_BPM >= 100 && track.AI_BPM < 120) {
            occasion = track.AI_ENERGY > 0.6 ? 'Workout' : 'Work';
        } else if (track.AI_BPM >= 120 && track.AI_BPM < 130) {
            occasion = 'Dancing';
        } else {
            occasion = 'Party';
        }

        // Si el mood sugiere algo específico
        if (track.AI_MOOD && track.AI_MOOD.toLowerCase().includes('romantic')) {
            occasion = 'Romantic';
        } else if (track.AI_MOOD && track.AI_MOOD.toLowerCase().includes('relaxed')) {
            occasion = 'Relaxation';
        }

        // Actualizar el registro
        const update = () =>
            new Promise((resolve, reject) => {
                db.run(
                    `
                UPDATE llm_metadata 
                SET LLM_OCCASIONS = ? 
                WHERE file_id = ?
            `,
                    [occasion, row.file_id],
                    err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });

        await update();
        fixed++;
        logInfo('✅ Fixed: ${track.artist} - ${track.title} → ${occasion}');
    }

    logDebug(`\n✅ Corregidos ${fixed} registros`);

    // Verificar resultado
    const checkResult = () =>
        new Promise((resolve, reject) => {
            db.get(
                `
            SELECT COUNT(*) as remaining 
            FROM llm_metadata 
            WHERE LLM_OCCASIONS LIKE '%object%'
        ',
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

    const result = await checkResult();
    logDebug(`\n📊 Registros con [object Object] restantes: ${result.remaining}`);

    db.close();
}

// Ejecutar
fixObjectFields().catch(console.error);
