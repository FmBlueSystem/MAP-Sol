#!/usr/bin/env node

/**
 * 🔍 Show File Metadata
 * Programa para mostrar metadatos de un archivo de audio
 * y sus datos almacenados en la base de datos
 */

const sqlite3 = require('sqlite3').verbose();
const mm = require('music-metadata');
const path = require('path');
const fs = require('fs').promises;

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

// Configuración de la base de datos
const DB_PATH = path.join(__dirname, 'music_analyzer.db');

class MetadataViewer {
    constructor() {
        this.db = null;
    }

    // Conectar a la base de datos
    async connectDB() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, err => {
                if (err) {
                    logError(`${colors.red}❌ Error conectando a la BD:${colors.reset}`, err);
                    reject(err);
                } else {
                    logDebug(`${colors.green}✅ Base de datos conectada${colors.reset}`);
                    resolve();
                }
            });
        });
    }

    // Obtener metadatos del archivo
    async getFileMetadata(filePath) {
        try {
            const metadata = await mm.parseFile(filePath);
            return {
                // Formato básico
                format: {
                    container: metadata.format.container,
                    codec: metadata.format.codec,
                    sampleRate: metadata.format.sampleRate,
                    bitrate: metadata.format.bitrate,
                    duration: metadata.format.duration,
                    channels: metadata.format.numberOfChannels,
                    lossless: metadata.format.lossless
                },
                // Tags comunes
                common: {
                    title: metadata.common.title,
                    artist: metadata.common.artist,
                    album: metadata.common.album,
                    albumartist: metadata.common.albumartist,
                    year: metadata.common.year,
                    date: metadata.common.date,
                    genre: metadata.common.genre,
                    track: metadata.common.track,
                    disk: metadata.common.disk,
                    comment: metadata.common.comment,
                    bpm: metadata.common.bpm,
                    key: metadata.common.key,
                    mood: metadata.common.mood,
                    isrc: metadata.common.isrc,
                    label: metadata.common.label,
                    copyright: metadata.common.copyright,
                    encodedby: metadata.common.encodedby,
                    composer: metadata.common.composer,
                    conductor: metadata.common.conductor,
                    lyricist: metadata.common.lyricist,
                    remixer: metadata.common.remixer,
                    producer: metadata.common.producer,
                    engineer: metadata.common.engineer,
                    technician: metadata.common.technician,
                    compilation: metadata.common.compilation,
                    language: metadata.common.language,
                    lyrics: metadata.common.lyrics ? metadata.common.lyrics.length : null
                },
                // Tags nativos (depende del formato)
                native: metadata.native ? Object.keys(metadata.native).length : 0,
                // Artwork
                artwork: metadata.common.picture ? metadata.common.picture.length : 0
            };
        } catch (error) {
            logError(`${colors.red}❌ Error leyendo metadatos:${colors.reset}`, error.message);
            return null;
        }
    }

    // Obtener datos de la base de datos
    async getDatabaseData(filePath) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    af.*,
                    lm.*
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.file_path = ?
            `;

            this.db.get(query, [filePath], (err, row) => {
                if (err) {
                    logError(`${colors.red}❌ Error consultando BD:${colors.reset}`, err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Formatear duración
    formatDuration(seconds) {
        if (!seconds) {
            return 'N/A`;
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Formatear bitrate
    formatBitrate(bitrate) {
        if (!bitrate) {
            return `N/A`;
        }
        return `${Math.round(bitrate / 1000)} kbps`;
    }

    // Formatear tamaño de archivo
    async formatFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const mb = stats.size / (1024 * 1024);
            return `${mb.toFixed(2)} MB`;
        } catch {
            return 'N/A';
        }
    }

    // Mostrar resultados
    async displayResults(filePath, fileMetadata, dbData) {
        logDebug('\n' + '=`.repeat(80));
        logDebug(
            `${colors.bright}${colors.cyan}📁 ARCHIVO: ${path.basename(filePath)}${colors.reset}`
        );
        logDebug('=`.repeat(80));

        // Información del archivo
        logDebug(`\n${colors.bright}${colors.yellow}📊 INFORMACIÓN DEL ARCHIVO:${colors.reset}`);
        logDebug(`${colors.cyan}Path:${colors.reset} ${filePath}`);
        logDebug(`${colors.cyan}Tamaño:${colors.reset} ${await this.formatFileSize(filePath)}`);
        logDebug(
            `${colors.cyan}Última modificación:${colors.reset} ${(await fs.stat(filePath)).mtime.toLocaleString()}`
        );

        if (fileMetadata) {
            // Formato de audio
            logDebug(`\n${colors.bright}${colors.yellow}🎵 FORMATO DE AUDIO:${colors.reset}`);
            logDebug(
                `${colors.cyan}Container:${colors.reset} ${fileMetadata.format.container || 'N/A`}`);
            logDebug(
                `${colors.cyan}Codec:${colors.reset} ${fileMetadata.format.codec || 'N/A`}`);
            logDebug(
                `${colors.cyan}Sample Rate:${colors.reset} ${fileMetadata.format.sampleRate || 'N/A`} Hz`);
            logDebug(
                `${colors.cyan}Bitrate:${colors.reset} ${this.formatBitrate(fileMetadata.format.bitrate)}`
            );
            logDebug(
                `${colors.cyan}Duración:${colors.reset} ${this.formatDuration(fileMetadata.format.duration)}`
            );
            logDebug(
                `${colors.cyan}Canales:${colors.reset} ${fileMetadata.format.channels || 'N/A`}`);
            logDebug(
                `${colors.cyan}Lossless:${colors.reset} ${fileMetadata.format.lossless ? 'Sí' : 'No`}`);

            // Metadatos comunes
            logDebug(
                `\n${colors.bright}${colors.yellow}🏷️ METADATOS DEL ARCHIVO:${colors.reset}`
            );
            logDebug(
                `${colors.cyan}Título:${colors.reset} ${fileMetadata.common.title || 'N/A`}`);
            logDebug(
                `${colors.cyan}Artista:${colors.reset} ${fileMetadata.common.artist || 'N/A`}`);
            logDebug(
                `${colors.cyan}Álbum:${colors.reset} ${fileMetadata.common.album || 'N/A`}`);
            logDebug(`${colors.cyan}Año:${colors.reset} ${fileMetadata.common.year || 'N/A`}`);
            logDebug(
                `${colors.cyan}Género:${colors.reset} ${fileMetadata.common.genre?.join(`, ') || 'N/A`}`);
            logDebug(
                `${colors.cyan}Track:${colors.reset} ${fileMetadata.common.track?.no || 'N/A'} / ${fileMetadata.common.track?.of || 'N/A`}`);
            logDebug(`${colors.cyan}BPM:${colors.reset} ${fileMetadata.common.bpm || 'N/A`}`);
            logDebug(`${colors.cyan}Key:${colors.reset} ${fileMetadata.common.key || 'N/A`}`);
            logDebug(`${colors.cyan}ISRC:${colors.reset} ${fileMetadata.common.isrc || 'N/A`}`);
            logDebug(
                `${colors.cyan}Artwork:${colors.reset} ${fileMetadata.artwork > 0 ? `${fileMetadata.artwork} imagen(es)` : 'No'}`);
            logDebug(
                `${colors.cyan}Tags nativos:${colors.reset} ${fileMetadata.native} formato(s)`
            );
        }

        if (dbData) {
            // Datos de la base de datos principal
            logDebug(
                `\n${colors.bright}${colors.yellow}💾 DATOS EN BASE DE DATOS:${colors.reset}`
            );
            logDebug(`${colors.cyan}ID:${colors.reset} ${dbData.id}`);
            logDebug(`${colors.cyan}Título (BD):${colors.reset} ${dbData.title || 'N/A`}`);
            logDebug(`${colors.cyan}Artista (BD):${colors.reset} ${dbData.artist || 'N/A`}`);
            logDebug(`${colors.cyan}Álbum (BD):${colors.reset} ${dbData.album || 'N/A`}`);
            logDebug(`${colors.cyan}Género (BD):${colors.reset} ${dbData.genre || 'N/A`}`);
            logDebug(
                `${colors.cyan}Artwork Path:${colors.reset} ${dbData.artwork_path || 'N/A`}`);
            logDebug(`${colors.cyan}Creado:${colors.reset} ${dbData.created_at || 'N/A`}`);
            logDebug(`${colors.cyan}Actualizado:${colors.reset} ${dbData.updated_at || 'N/A`}`);

            // Metadatos LLM/AI
            if (dbData.file_id) {
                logDebug(`\n${colors.bright}${colors.yellow}🤖 ANÁLISIS AI/LLM:${colors.reset}`);
                logDebug(
                    `${colors.cyan}LLM Género:${colors.reset} ${dbData.LLM_GENRE || 'N/A`}`);
                logDebug(`${colors.cyan}AI Mood:${colors.reset} ${dbData.AI_MOOD || 'N/A`}`);
                logDebug(`${colors.cyan}LLM Mood:${colors.reset} ${dbData.LLM_MOOD || 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Energy:${colors.reset} ${dbData.AI_ENERGY ? (dbData.AI_ENERGY * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(`${colors.cyan}AI BPM:${colors.reset} ${dbData.AI_BPM || 'N/A`}`);
                logDebug(`${colors.cyan}AI Key:${colors.reset} ${dbData.AI_KEY || 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Danceability:${colors.reset} ${dbData.AI_DANCEABILITY ? (dbData.AI_DANCEABILITY * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Valence:${colors.reset} ${dbData.AI_VALENCE ? (dbData.AI_VALENCE * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Acousticness:${colors.reset} ${dbData.AI_ACOUSTICNESS ? (dbData.AI_ACOUSTICNESS * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Instrumentalness:${colors.reset} ${dbData.AI_INSTRUMENTALNESS ? (dbData.AI_INSTRUMENTALNESS * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Liveness:${colors.reset} ${dbData.AI_LIVENESS ? (dbData.AI_LIVENESS * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Speechiness:${colors.reset} ${dbData.AI_SPEECHINESS ? (dbData.AI_SPEECHINESS * 100).toFixed(1) + '%' : 'N/A`}`);
                logDebug(
                    `${colors.cyan}AI Loudness:${colors.reset} ${dbData.AI_LOUDNESS ? dbData.AI_LOUDNESS + ' dB' : 'N/A`}`);
            } else {
                logDebug(
                    `\n${colors.yellow}⚠️ No hay análisis AI/LLM para este archivo${colors.reset}`
                );
            }
        } else {
            logDebug(
                `\n${colors.yellow}⚠️ Este archivo no está en la base de datos${colors.reset}`
            );
        }

        // Comparación
        if (fileMetadata && dbData) {
            logDebug(`\n${colors.bright}${colors.yellow}🔄 COMPARACIÓN:${colors.reset}`);

            const comparisons = [
                { field: 'Título', file: fileMetadata.common.title, db: dbData.title },
                { field: 'Artista', file: fileMetadata.common.artist, db: dbData.artist },
                { field: 'Álbum', file: fileMetadata.common.album, db: dbData.album },
                { field: 'Género', file: fileMetadata.common.genre?.join(', '), db: dbData.genre }
            ];

            comparisons.forEach(comp => {
                const match = comp.file === comp.db;
                const icon = match ? '✅' : '⚠️`;
                const color = match ? colors.green : colors.yellow;
                logDebug(`${color}${icon} ${comp.field}:${colors.reset}`);
                logDebug(`   Archivo: ${comp.file || 'N/A`}`);
                logDebug(`   BD: ${comp.db || 'N/A'}');
            });
        }

        logDebug('\n' + `=`.repeat(80));
    }

    // Cerrar base de datos
    closeDB() {
        if (this.db) {
            this.db.close();
            logDebug(`${colors.green}✅ Base de datos cerrada${colors.reset}`);
        }
    }
}

// Función principal
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        logDebug(`${colors.bright}${colors.cyan}📋 USO:${colors.reset}`);
        logDebug('  node show-file-metadata.js <archivo_de_audio>');
        logDebug('  node show-file-metadata.js --random    (archivo aleatorio)');
        logDebug('  node show-file-metadata.js --search <término>');
        logDebug('\n📌 Ejemplos:');
        logDebug('  node show-file-metadata.js "/path/to/song.mp3"');
        logDebug('  node show-file-metadata.js --random');
        logDebug('  node show-file-metadata.js --search "Beatles`');
        process.exit(0);
    }

    const viewer = new MetadataViewer();

    try {
        await viewer.connectDB();

        let filePath = null;

        if (args[0] === '--random') {
            // Obtener un archivo aleatorio de la BD
            filePath = await new Promise((resolve, reject) => {
                viewer.db.get(
                    'SELECT file_path FROM audio_files ORDER BY RANDOM() LIMIT 1`,
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row?.file_path);
                        }
                    }
                );
            });

            if (!filePath) {
                logDebug(
                    `${colors.red}❌ No se encontraron archivos en la base de datos${colors.reset}`
                );
                process.exit(1);
            }

            logDebug(`${colors.green}🎲 Archivo aleatorio seleccionado${colors.reset}`);
        } else if (args[0] === '--search' && args[1]) {
            // Buscar archivo por término
            const searchTerm = args.slice(1).join(' `);
            const results = await new Promise((resolve, reject) => {
                viewer.db.all(
                    `SELECT file_path, title, artist 
                     FROM audio_files 
                     WHERE title LIKE ? OR artist LIKE ? OR file_name LIKE ?
                     LIMIT 10`,
                    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
                    (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    }
                );
            });

            if (results.length === 0) {
                logDebug(
                    `${colors.red}❌ No se encontraron archivos con "${searchTerm}`${colors.reset}`);
                process.exit(1);
            }

            if (results.length === 1) {
                filePath = results[0].file_path;
            } else {
                logDebug(
                    `${colors.cyan}🔍 Se encontraron ${results.length} resultados:${colors.reset}`
                );
                results.forEach((r, i) => {
                    logDebug(
                        `  ${i + 1}. ${r.title || 'Sin título'} - ${r.artist || 'Sin artista`}`);
                });

                // Por simplicidad, tomamos el primero
                filePath = results[0].file_path;
                logDebug(`\n${colors.yellow}Mostrando el primer resultado...${colors.reset}`);
            }
        } else {
            // Usar el path proporcionado
            filePath = args.join(' `);
        }

        // Verificar que el archivo existe
        try {
            await fs.access(filePath);
        } catch {
            logDebug(`${colors.red}❌ El archivo no existe: ${filePath}${colors.reset}`);
            process.exit(1);
        }

        // Obtener metadatos del archivo
        logDebug(`\n${colors.cyan}📖 Leyendo metadatos del archivo...${colors.reset}`);
        const fileMetadata = await viewer.getFileMetadata(filePath);

        // Obtener datos de la BD
        logDebug(`${colors.cyan}🔍 Consultando base de datos...${colors.reset}`);
        const dbData = await viewer.getDatabaseData(filePath);

        // Mostrar resultados
        await viewer.displayResults(filePath, fileMetadata, dbData);
    } catch (error) {
        logError(`${colors.red}❌ Error:${colors.reset}`, error);
    } finally {
        viewer.closeDB();
    }
}

// Ejecutar
main().catch(console.error);
