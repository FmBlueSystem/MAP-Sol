#!/usr/bin/env node

/**
 * WRITE METADATA TO FILES
 * Escribe los metadatos analizados por IA de vuelta a los archivos de audio físicos
 * Soporta FLAC, MP3, M4A
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const mm = require('music-metadata');
const { execSync } = require('child_process');

class MetadataWriter {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;

        this.stats = {
            total: 0,
            updated: 0,
            failed: 0,
            skipped: 0
        };

        // Mapeo de campos de DB a tags de audio
        this.tagMapping = {
            // Campos básicos
            title: 'title',
            artist: 'artist',
            album: 'album',
            genre: 'genre',
            year: 'date',

            // Campos de IA - Los agregamos como comentarios o tags custom
            AI_MOOD: 'mood',
            LLM_ERA: 'period',
            LLM_ENERGY_LEVEL: 'energy',
            AI_BPM: 'bpm',
            AI_KEY: 'initialkey',
            LLM_DESCRIPTION: 'comment',
            LLM_SIMILAR_ARTISTS: 'similartists',
            LLM_DJ_NOTES: 'djnotes',
            LLM_OCCASIONS: 'occasion'
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
reject(err);
} else {
                    logInfo('✅ Connected to database');
                    resolve();
                }
            });
        });
    }

    /**
     * Obtener tracks con análisis IA
     */
    async getTracksWithAnalysis(limit = null) {
        const query = `
            SELECT 
                af.id,
                af.file_path,
                af.title,
                af.artist,
                af.album,
                af.genre,
                af.year,
                lm.AI_MOOD,
                lm.LLM_ERA,
                lm.LLM_ENERGY_LEVEL,
                lm.AI_BPM,
                lm.AI_KEY,
                lm.LLM_DESCRIPTION,
                lm.LLM_SIMILAR_ARTISTS,
                lm.LLM_DJ_NOTES,
                lm.LLM_OCCASIONS,
                lm.LLM_LYRICS_LANGUAGE,
                lm.LLM_PRODUCTION_STYLE
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.LLM_DESCRIPTION IS NOT NULL
                AND af.file_path NOT LIKE '%_DELETED%'
            ${limit ? `LIMIT ${limit}` : ''}
        ';

        return new Promise((resolve, reject) => {
            this.db.all(query, (err, rows) => {
                if (err) {
reject(err);
} else {
resolve(rows);
}
            });
        });
    }

    /**
     * Escribir metadatos usando ffmpeg (universal para todos los formatos)
     */
    async writeMetadataWithFFmpeg(filePath, metadata) {
        try {
            // Verificar que el archivo existe
            await fs.access(filePath);

            // Construir comando ffmpeg
            const tempFile = filePath + '.tmp';
            let ffmpegCmd = `ffmpeg -i "${filePath}" -y -loglevel error";

            // Agregar metadatos
            ffmpegCmd += ' -c copy'; // Copiar streams sin recodificar

            // Metadatos básicos
            if (metadata.title) {
            {
ffmpegCmd += ` -metadata title="${metadata.title.replace(/"/g, '\\"')}"";
}
            if (metadata.artist) {
            {
ffmpegCmd += ` -metadata artist="${metadata.artist.replace(/"/g, '\\"')}"";
}
            if (metadata.album) {
            {
ffmpegCmd += ` -metadata album="${metadata.album.replace(/"/g, '\\"')}"";
}
            if (metadata.genre) {
            {
ffmpegCmd += ` -metadata genre="${metadata.genre.replace(/"/g, '\\"')}"";
}
            if (metadata.year) {
ffmpegCmd += ` -metadata date="${metadata.year}"";
}

            // Metadatos de IA como comentarios o tags custom
            if (metadata.AI_MOOD) {
                ffmpegCmd += ` -metadata mood="${metadata.AI_MOOD}"";
            }

            if (metadata.LLM_ERA) {
                ffmpegCmd += ` -metadata period="${metadata.LLM_ERA}"";
            }

            if (metadata.LLM_ENERGY_LEVEL) {
                ffmpegCmd += ` -metadata energy="${metadata.LLM_ENERGY_LEVEL}"";
            }

            if (metadata.AI_BPM) {
                ffmpegCmd += ` -metadata bpm="${metadata.AI_BPM}"";
            }

            if (metadata.AI_KEY) {
                ffmpegCmd += ` -metadata initialkey="${metadata.AI_KEY}"";
            }

            // Descripción como comentario
            if (metadata.LLM_DESCRIPTION) {
                const shortDesc = metadata.LLM_DESCRIPTION.substring(0, 255);
                ffmpegCmd += ` -metadata comment="${shortDesc.replace(/"/g, '\\"')}"";
            }

            // Agregar un tag custom indicando que fue procesado con IA
            ffmpegCmd += ' -metadata analyzed_by="Music Analyzer Pro AI"';
            ffmpegCmd += ` -metadata analysis_date="${new Date().toISOString()}"";

            // Output file con formato especificado
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.flac') {
                ffmpegCmd += ` -f flac "${tempFile}"";
            } else if (ext === '.mp3') {
                ffmpegCmd += ` -f mp3 "${tempFile}"";
            } else if (ext === '.m4a' || ext === '.mp4') {
                ffmpegCmd += ` -f mp4 "${tempFile}"";
            } else {
                ffmpegCmd += ` "${tempFile}"";
            }

            // Ejecutar ffmpeg
            execSync(ffmpegCmd, { stdio: 'pipe' });

            // Reemplazar archivo original con el temporal
            await fs.rename(tempFile, filePath);

            return true;
        } catch (error) {
            // Limpiar archivo temporal si existe
            try {
                await fs.unlink(filePath + '.tmp');
            } catch (e) {}

            throw error;
        }
    }

    /**
     * Procesar un archivo
     */
    async processFile(track) {
        const fileName = path.basename(track.file_path);

        try {
            // Verificar si el archivo existe
            await fs.access(track.file_path);

            // Escribir metadatos
            await this.writeMetadataWithFFmpeg(track.file_path, track);

            logDebug(`   ✅ ${fileName}`);
            this.stats.updated++;

            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logDebug(`   ⚠️  ${fileName} - Archivo no encontrado`);
                this.stats.skipped++;
            } else {
                logDebug(`   ❌ ${fileName} - ${error.message}`);
                this.stats.failed++;
            }

            return false;
        }
    }

    /**
     * Ejecutar actualización
     */
    async updateFiles(limit = null) {
        logDebug('\n📝 ESCRIBIENDO METADATOS A ARCHIVOS FÍSICOS');
        logDebug('='.repeat(60));

        // Verificar si ffmpeg está instalado
        try {
            execSync('ffmpeg -version', { stdio: 'pipe' });
        } catch (error) {
            logError('❌ ffmpeg no está instalado. Instálalo con: brew install ffmpeg');
            return;
        }

        // Obtener tracks con análisis
        const tracks = await this.getTracksWithAnalysis(limit);
        this.stats.total = tracks.length;

        if (tracks.length === 0) {
            logDebug('No hay tracks con análisis para actualizar');
            return;
        }

        logDebug(`\nEncontrados ${tracks.length} archivos con análisis IA\n`);

        // Confirmar antes de proceder
        if (!limit || limit > 10) {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            await new Promise(resolve => {
                rl.question(
                    `⚠️  Esto modificará ${tracks.length} archivos físicos. ¿Continuar? (s/n): `,
                    answer => {
                        rl.close();
                        if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'si') {
                            logDebug('Operación cancelada');
                            process.exit(0);
                        }
                        resolve();
                    }
                );
            });
        }

        logDebug('\nActualizando archivos...\n');

        // Procesar cada archivo
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            logDebug(`[${i + 1}/${tracks.length}] ${path.basename(track.file_path)}`);

            await this.processFile(track);

            // Pausa cada 10 archivos
            if ((i + 1) % 10 === 0 && i < tracks.length - 1) {
                logDebug('\n⏸️  Pausa de 2 segundos...\n');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Resumen
        logDebug('\n' + '='.repeat(60));
        logDebug('📊 RESUMEN:');
        logDebug(`   Total procesados: ${this.stats.total}`);
        logDebug(`   ✅ Actualizados: ${this.stats.updated}`);
        logDebug(`   ⚠️  Omitidos: ${this.stats.skipped}`);
        logDebug(`   ❌ Fallidos: ${this.stats.failed}`);

        if (this.stats.updated > 0) {
            logDebug('\n✨ Los metadatos se han escrito en los archivos físicos!');
            logDebug('   Los archivos ahora contienen:');
            logDebug('   • Información básica (título, artista, álbum)');
            logDebug('   • Análisis IA (mood, era, energy)');
            logDebug('   • Descripción y notas DJ');
            logDebug('   • BPM y tonalidad musical');
        }
    }

    /**
     * Verificar un archivo
     */
    async verifyFile(filePath) {
        logDebug('\n🔍 VERIFICANDO ARCHIVO:');
        logDebug(path.basename(filePath));
        logDebug('-'.repeat(60));

        try {
            const metadata = await mm.parseFile(filePath);

            logDebug('\n📊 Metadatos actuales:');
            logDebug(`   Título: ${metadata.common.title || 'N/A'}');
            logDebug(`   Artista: ${metadata.common.artist || 'N/A'}');
            logDebug(`   Álbum: ${metadata.common.album || 'N/A'}');
            logDebug(`   Género: ${metadata.common.genre?.join(`, ') || 'N/A'}');
            logDebug(`   Año: ${metadata.common.year || 'N/A'}');
            logDebug(`   Comentario: ${metadata.common.comment?.join(' ') || 'N/A'}');

            // Buscar tags custom
            if (metadata.native) {
                logDebug('\n🏷️  Tags adicionales:');
                for (const [format, tags] of Object.entries(metadata.native)) {
                    const customTags = tags.filter(tag =>
                        ['mood', 'energy', 'period', 'bpm', 'initialkey', 'analyzed_by'].some(t =>
                            tag.id?.toLowerCase().includes(t)
                        )
                    );

                    if (customTags.length > 0) {
                        logDebug(`   Formato: ${format}`);
                        customTags.forEach(tag => {
                            logDebug(`     ${tag.id}: ${tag.value}`);
                        });
                    }
                }
            }
        } catch (error) {
            logError('❌ Error leyendo archivo:', error.message);
        }
    }

    close() {
        if (this.db) {
this.db.close();
}
    }
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'verify' && args[1]) {
        // Verificar un archivo específico
        const writer = new MetadataWriter();
        writer.verifyFile(args[1]).then(() => {
            logDebug('\n');
        });
    } else if (command === 'help' || command === '--help') {
        logDebug(`
📝 WRITE METADATA TO FILES

USO:
  node write-metadata-to-files.js [cantidad]    # Actualizar X archivos
  node write-metadata-to-files.js verify <path> # Verificar un archivo
  node write-metadata-to-files.js help          # Mostrar ayuda

EJEMPLOS:
  node write-metadata-to-files.js 5      # Actualizar 5 archivos
  node write-metadata-to-files.js        # Actualizar TODOS
  node write-metadata-to-files.js verify "/path/to/song.flac"

NOTA: Requiere ffmpeg instalado (brew install ffmpeg)
        ");
    } else {
        // Actualizar archivos
        const limit = parseInt(args[0]) || null;

        const writer = new MetadataWriter();

        (async () => {
            await writer.init();
            await writer.updateFiles(limit);
            writer.close();
        })().catch(console.error);
    }
}
