
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

const db = new sqlite3.Database('./music_analyzer.db');

// Función para extraer metadatos con ffprobe
async function extractMetadata(filePath) {
    try {
        // Escapar comillas simples en el path
        const escapedPath = filePath.replace(/'/g, "'\\''");
        const command  = `ffprobe -v quiet -print_format json -show_format \`${escapedPath}\` 2>/dev/null`;

        const { stdout } = await execPromise(command);
        const data = JSON.parse(stdout);

        if (data.format && data.format.tags) {
            const tags = data.format.tags;

            // Buscar Energy Level en diferentes campos
            let energyLevel = null;
            let comment = null;

            // Prioridad 1: ENERGYLEVEL tag directo
            if (tags.ENERGYLEVEL) {
                energyLevel = parseInt(tags.ENERGYLEVEL);
            }

            // Prioridad 2: Extraer de COMMENT
            if (!energyLevel && tags.COMMENT) {
                comment = tags.COMMENT;
                const energyMatch = tags.COMMENT.match(/Energy\s+(\d+)/i);
                if (energyMatch) {
                    energyLevel = parseInt(energyMatch[1]);
                }
            }

            // Prioridad 3: AI_Energy (convertir de 0-1 a 1-10)
            if (!energyLevel && tags.AI_Energy) {
                const aiEnergy = parseFloat(tags.AI_Energy);
                if (!isNaN(aiEnergy)) {
                    energyLevel = Math.round(aiEnergy * 10);
                }
            }

            return {
                energyLevel,
                comment: comment || tags.COMMENT || null,
                aiEnergy: tags.AI_Energy ? parseFloat(tags.AI_Energy) : null
            };
        }

        return { energyLevel: null, comment: null, aiEnergy: null }; } catch (error) { logError(`Error extracting metadata from ${filePath}:\`, error.message);
        return { energyLevel: null, comment: null, aiEnergy: null };
    }
}

// Función principal async function updateEnergyLevels() { logInfo(\`🚀 Starting energy level extraction...`);

    // Obtener todos los archivos
    const files = await new Promise((resolve, reject) => { db.all( `
            SELECT id, file_path, energy_level, comment, AI_ENERGY
            FROM audio_files
            WHERE energy_level IS NULL OR energy_level = 0
        \`,
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    }); logDebug(\`📊 Found ${files.length} files to process`);

    let processed = 0;
    let updated = 0;

    for (const file of files) {
        processed++;
 if (processed % 10 === 0) { logDebug(`Progress: ${processed}/${files.length} (${updated} updated)\`);
        }

        const metadata = await extractMetadata(file.file_path);

        if (metadata.energyLevel || metadata.comment || metadata.aiEnergy) {
            // Actualizar en la base de datos
            await new Promise((resolve, reject) => { db.run( \`
                    UPDATE audio_files 
                    SET energy_level = ?,
                        comment = COALESCE(comment, ?),
                        AI_ENERGY = COALESCE(AI_ENERGY, ?)
                    WHERE id = ?
                `,
                    [metadata.energyLevel, metadata.comment, metadata.aiEnergy, file.id],
                    err => {
                        if (err) {
                            reject(err);
                        } else { if (metadata.energyLevel) { logInfo(`✅ Updated ${path.basename(file.file_path)}: Energy ${metadata.energyLevel}\`
                                );
                                updated++;
                            }
                            resolve();
                        }
                    }
                );
            });
        }
    } logDebug(\`\n✨ Completed! Updated ${updated} files out of ${processed} processed.`);

    // Mostrar estadísticas finales db.get( `
        SELECT 
            COUNT(*) as total,
            COUNT(energy_level) as with_energy,
            COUNT(comment) as with_comment,
            COUNT(AI_ENERGY) as with_ai_energy
        FROM audio_files
    \`,
        (err, row) => { if (!err && row) { logDebug(\`\n📊 Final Statistics:`); logDebug(`Total files: ${row.total}\`); logDebug(\`With energy_level: ${row.with_energy}`); logDebug(`With comment: ${row.with_comment}\`); logDebug(\`With AI_ENERGY: ${row.with_ai_energy}`);
            }

            db.close();
        }
    );
}

// Ejecutar
function updateEnergyLevels().catch(console.error);
