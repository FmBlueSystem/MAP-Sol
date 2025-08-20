#!/usr/bin/env node

/**
 * RESTORE COMPLETE METADATA
 * Restaura TODOS los metadatos desde la base de datos incluyendo:
 * - Metadatos básicos: título, artista, álbum, género, año
 * - ISRC (International Standard Recording Code)
 * - Mixing Key (clave musical para DJs)
 * - BPM (beats per minute)
 * - Track number
 * - Duration, bitrate
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

class CompleteMetadataRestorer {
    constructor() {
        this.db = null;
        this.stats = {
            total: 0,
            processed: 0,
            restored: 0,
            skipped: 0,
            errors: 0,
            errorList: []
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database('./music_analyzer.db', err => {
                if (err) {
reject(err);
} else {
                    logInfo('✅ Conectado a la base de datos');
                    resolve();
                }
            });
        });
    }

    decodeMixingKey(encodedKey) {
        if (!encodedKey) {
return null;
}
        try {
            const decoded = Buffer.from(encodedKey, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            return parsed.key; // Retorna solo la clave, ej: "12B"
        } catch {
            return null;
        }
    }

    async restoreToM4A(filePath, metadata) {
        const tempFile = filePath + '.temp.m4a';

        let cmd = `ffmpeg -i "${filePath}` -codec copy`;

        // Metadatos básicos
        if (metadata.title) {
cmd += ` -metadata title="${metadata.title.replace(/"/g, '\\``)}``;
}
        if (metadata.artist) {
cmd += ` -metadata artist="${metadata.artist.replace(/"/g, '\\``)}``;
}
        if (metadata.album) {
cmd += ` -metadata album="${metadata.album.replace(/"/g, '\\``)}``;
}
        if (metadata.genre) {
cmd += ` -metadata genre="${metadata.genre.replace(/"/g, '\\``)}``;
}
        if (metadata.year) {
cmd += ` -metadata date="${metadata.year}``;
}

        // Metadatos adicionales
        if (metadata.isrc) {
cmd += ` -metadata ISRC="${metadata.isrc}``;
}
        if (metadata.bpm) {
cmd += ` -metadata BPM="${Math.round(metadata.bpm)}``;
}
        if (metadata.mixingKey) {
cmd += ` -metadata INITIALKEY="${metadata.mixingKey}``;
}
        if (metadata.track_number) {
cmd += ` -metadata track="${metadata.track_number}``;
}

        // Metadatos técnicos (informativos)
        if (metadata.duration) {
cmd += ` -metadata DURATION="${metadata.duration}``;
}
        if (metadata.bitrate) {
cmd += ` -metadata BITRATE="${metadata.bitrate}``;
}

        cmd += ` -y "${tempFile}` 2>/dev/null`;

        await execPromise(cmd);

        // Reemplazar archivo original
        fs.renameSync(tempFile, filePath);

        logInfo('✅ M4A restaurado: ${metadata.artist} - ${metadata.title} [Key: ${metadata.mixingKey || 'N/A'}, ISRC: ${metadata.isrc || 'N/A`}]`);
        return true;
    }

    async restoreToFLAC(filePath, metadata) {
        const commands = [];

        // Limpiar tags existentes que podrían estar corruptos
        commands.push(`metaflac --remove-all-tags "${filePath}``);

        // Metadatos básicos
        if (metadata.title) {
        {
commands.push(`metaflac --set-tag="TITLE=${metadata.title}" "${filePath}``);
}
        if (metadata.artist) {
        {
commands.push(`metaflac --set-tag="ARTIST=${metadata.artist}" "${filePath}``);
}
        if (metadata.album) {
        {
commands.push(`metaflac --set-tag="ALBUM=${metadata.album}" "${filePath}``);
}
        if (metadata.genre) {
        {
commands.push(`metaflac --set-tag="GENRE=${metadata.genre}" "${filePath}``);
}
        if (metadata.year) {
        {
commands.push(`metaflac --set-tag="DATE=${metadata.year}" "${filePath}``);
}

        // Metadatos adicionales
        if (metadata.isrc) {
        {
commands.push(`metaflac --set-tag="ISRC=${metadata.isrc}" "${filePath}``);
}
        if (metadata.bpm) {
        {
commands.push(`metaflac --set-tag="BPM=${Math.round(metadata.bpm)}" "${filePath}``);
}
        if (metadata.mixingKey) {
        {
commands.push(`metaflac --set-tag="INITIALKEY=${metadata.mixingKey}" "${filePath}``);
}
        if (metadata.track_number) {
        {
commands.push(
            `metaflac --set-tag="TRACKNUMBER=${metadata.track_number}" "${filePath}``);
        }

        for (const cmd of commands) {
            await execPromise(cmd);
        }

        logInfo('✅ FLAC restaurado: ${metadata.artist} - ${metadata.title} [Key: ${metadata.mixingKey || 'N/A'}, ISRC: ${metadata.isrc || 'N/A'}]');
        return true;
    }

    async restoreToMP3(filePath, metadata) {
        // Para MP3 usaremos ffmpeg que es más confiable
        const tempFile = filePath + `.temp.mp3`;

        let cmd = `ffmpeg -i "${filePath}` -codec copy`;

        // Metadatos básicos
        if (metadata.title) {
cmd += ` -metadata title="${metadata.title.replace(/"/g, '\\``)}``;
}
        if (metadata.artist) {
cmd += ` -metadata artist="${metadata.artist.replace(/"/g, '\\``)}``;
}
        if (metadata.album) {
cmd += ` -metadata album="${metadata.album.replace(/"/g, '\\``)}``;
}
        if (metadata.genre) {
cmd += ` -metadata genre="${metadata.genre.replace(/"/g, '\\``)}``;
}
        if (metadata.year) {
cmd += ` -metadata date="${metadata.year}``;
}

        // Metadatos adicionales
        if (metadata.isrc) {
cmd += ` -metadata ISRC="${metadata.isrc}``;
}
        if (metadata.bpm) {
cmd += ` -metadata TBPM="${Math.round(metadata.bpm)}``;
}
        if (metadata.mixingKey) {
cmd += ` -metadata TKEY="${metadata.mixingKey}``;
}
        if (metadata.track_number) {
cmd += ` -metadata track="${metadata.track_number}``;
}

        cmd += ` -y "${tempFile}` 2>/dev/null`;

        await execPromise(cmd);
        fs.renameSync(tempFile, filePath);

        logInfo('✅ MP3 restaurado: ${metadata.artist} - ${metadata.title} [Key: ${metadata.mixingKey || 'N/A'}, ISRC: ${metadata.isrc || 'N/A'}]');
        return true;
    }

    async restoreMetadataToFile(fileData) {
        const { file_path } = fileData;

        try {
            // Verificar si el archivo existe
            if (!fs.existsSync(file_path)) {
                logWarn('⚠️  Archivo no encontrado: ${path.basename(file_path)}');
                this.stats.skipped++;
                return false;
            }

            const ext = path.extname(file_path).toLowerCase();

            // Preparar metadata completa
            const metadata = {
                title: fileData.title,
                artist: fileData.artist,
                album: fileData.album,
                genre: fileData.genre,
                year: fileData.year,
                isrc: fileData.isrc,
                bpm: fileData.existing_bmp,
                mixingKey: this.decodeMixingKey(fileData.existing_key),
                track_number: fileData.track_number,
                duration: fileData.duration,
                bitrate: fileData.bitrate
            };

            let success = false;

            if (ext === '.mp3') {
                success = await this.restoreToMP3(file_path, metadata);
            } else if (['.m4a', '.mp4'].includes(ext)) {
                success = await this.restoreToM4A(file_path, metadata);
            } else if (ext === '.flac') {
                success = await this.restoreToFLAC(file_path, metadata);
            } else {
                logWarn(`⚠️  Formato no soportado: ${ext}`);
                this.stats.skipped++;
                return false;
            }

            if (success) {
                this.stats.restored++;
                return true;
            }
        } catch (error) {
            logError(`❌ Error: ${path.basename(file_path)}: ${error.message}`);
            this.stats.errors++;
            this.stats.errorList.push({
                file: file_path,
                error: error.message
            });
            return false;
        }
    }

    async getFilesToRestore(limit = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    file_path,
                    title,
                    artist,
                    album,
                    genre,
                    year,
                    isrc,
                    existing_bmp,
                    existing_key,
                    track_number,
                    duration,
                    bitrate
                FROM audio_files
                WHERE file_path IS NOT NULL
                ORDER BY id
            `;

            if (limit) {
                query += ` LIMIT ${limit}`;
            }

            this.db.all(query, (err, rows) => {
                if (err) {
reject(err);
} else {
resolve(rows);
}
            });
        });
    }

    async run(options = {}) {
        const { limit = null } = options;

        logDebug(`
🔧 RESTAURACIÓN COMPLETA DE METADATOS
${'='.repeat(60)}
Incluye: Título, Artista, Álbum, Género, Año, ISRC, 
         Mixing Key, BPM, Track Number, Duration, Bitrate
${'='.repeat(60)}
');

        await this.init();

        // Obtener archivos
        const files = await this.getFilesToRestore(limit);
        this.stats.total = files.length;

        logDebug('📊 Archivos a restaurar: ${this.stats.total}\n');
        logInfo(`🚀 Iniciando restauración completa...\n`);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.stats.processed++;

            process.stdout.write(
                `\r⏳ [${this.stats.processed}/${this.stats.total}] Restaurados: ${this.stats.restored} | Omitidos: ${this.stats.skipped} | Errores: ${this.stats.errors}`
            );

            await this.restoreMetadataToFile(file);
        }

        logDebug('\n');
        logDebug('='.repeat(60));
        logInfo('✅ RESTAURACIÓN COMPLETADA');
        logDebug('='.repeat(60));
        logDebug('📊 Resumen:`);
        logDebug(`   Total procesados: ${this.stats.processed}`);
        logDebug(`   Restaurados: ${this.stats.restored}`);
        logDebug(`   Omitidos: ${this.stats.skipped}`);
        logDebug(`   Errores: ${this.stats.errors}`);

        if (this.stats.errorList.length > 0) {
            logDebug('\n❌ Archivos con errores (primeros 10):`);
            this.stats.errorList.slice(0, 10).forEach(e => {
                logDebug(`   • ${path.basename(e.file)}: ${e.error}`);
            });
        }

        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        limit: null
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--help`) {
            logDebug(`
Uso: node restore-complete-metadata.js [opciones]

Opciones:
  --limit <n>   Procesar solo N archivos
  --help        Muestra esta ayuda

Este script restaura TODOS los metadatos desde la base de datos:
  • Básicos: título, artista, álbum, género, año
  • ISRC (código internacional de grabación)
  • Mixing Key (clave musical para DJs)
  • BPM (beats por minuto)
  • Track number
  • Duration, bitrate

Ejemplos:
  node restore-complete-metadata.js           # Restaura todos
  node restore-complete-metadata.js --limit 100  # Restaura primeros 100
`);
            process.exit(0);
        }
    }

    const restorer = new CompleteMetadataRestorer();
    restorer.run(options).catch(console.error);
}

module.exports = CompleteMetadataRestorer;

}
}
}
}
}
}
}
}
}