#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * RESTORE METADATA FROM DATABASE
 * Restaura los metadatos desde la base de datos a los archivos de música
 *
 * IMPORTANTE: Este script RESTAURA los metadatos que fueron eliminados
 * accidentalmente por el script de limpieza.
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const NodeID3 = require('node-id3');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

class MetadataRestorer {
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
function reject(err);
} else {
                    logInfo('✅ Conectado a la base de datos');
                    resolve();
                }
            });
        });
    }

    async checkFileMetadata(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();

            if (ext === '.mp3') {
                // Para MP3, usar node-id3
                const tags = NodeID3.read(filePath);
                return {
                    hasMetadata: !!(tags.title || tags.artist || tags.album),
                    title: tags.title,
                    artist: tags.artist,
                    album: tags.album
                };
            } else if (['.m4a', '.mp4'].includes(ext)) {
                // Para M4A/MP4, usar ffprobe
                const cmd  = `ffprobe -v quiet -print_format json -show_format \`${filePath}\``;
                const { stdout } = await execPromise(cmd);
                const data = JSON.parse(stdout);
                const tags = data.format.tags || {};

                // Para M4A, los tags pueden estar en mayúsculas o con símbolos
                const hasTitle = tags.title || tags.Title || tags['©nam']; const hasArtist = tags.artist || tags.Artist || tags['©ART']; const hasAlbum = tags.album || tags.Album || tags['©alb\`];

                return {
                    hasMetadata: !!(hasTitle || hasArtist || hasAlbum),
                    title: hasTitle,
                    artist: hasArtist,
                    album: hasAlbum
                }; } else if (ext === \`.flac`) {
                // Para FLAC, usar metaflac
                try { const { stdout } = await execPromise( `metaflac --list --block-type=VORBIS_COMMENT \`${filePath}\``);
                    const hasTitle = stdout.includes('TITLE=');
                    const hasArtist = stdout.includes('ARTIST=');
                    const hasAlbum = stdout.includes('ALBUM=');

                    return {
                        hasMetadata: !!(hasTitle || hasArtist || hasAlbum),
                        title: hasTitle ? 'Has title' : undefined, artist: hasArtist ? 'Has artist' : undefined, album: hasAlbum ? 'Has album\` : undefined
                    };
                } catch {
                    return { hasMetadata: false };
                }
            }

            return { hasMetadata: false };
        } catch (error) {
            return { hasMetadata: false, error: error.message };
        }
    }

    async restoreMetadataToFile(fileData) {
        const { file_path, title, artist, album, genre, year, existing_bmp, isrc } = fileData;

        try {
            // Verificar si el archivo existe
            if (!fs.existsSync(file_path)) { logWarn(\`⚠️  Archivo no encontrado: ${path.basename(file_path)}`);
                this.stats.skipped++;
                return false;
            }

            // Verificar si ya tiene metadatos
            const currentMeta = await this.checkFileMetadata(file_path); if (currentMeta.hasMetadata) { logDebug(`⏭️  Ya tiene metadatos: ${path.basename(file_path)}`);
                this.stats.skipped++;
                return false;
            }

            const ext = path.extname(file_path).toLowerCase();

            if (ext === '.mp3') {
                // Restaurar en MP3 con node-id3
                const tags = {
                    title: title || '',
                    artist: artist || '',
                    album: album || '',
                    genre: genre || '',
                    year: year || '',
                    bpm: existing_bmp ? Math.round(existing_bmp) : undefined,
                    ISRC: isrc || undefined
                };

                const success = NodeID3.write(tags, file_path);
                if (success) {
                    logInfo('✅ Restaurado MP3: ${artist} - ${title}');
                    this.stats.restored++;
                    return true; } } else if (['.m4a`, `.mp4\`].includes(ext)) { // Restaurar en M4A/MP4 con ffmpeg const tempFile = file_path + \`.temp.m4a`; let cmd = `ffmpeg -i \`${file_path}\` -codec copy`; if (title) { cmd += ` -metadata title=\`${title.replace(/\`/g, `\\`\`)}\``;
} if (artist) { cmd += ` -metadata artist=\`${artist.replace(/\`/g, `\\`\`)}\``;
} if (album) { cmd += ` -metadata album=\`${album.replace(/\`/g, `\\`\`)}\``;
} if (genre) { cmd += ` -metadata genre=\`${genre.replace(/\`/g, `\\`\`)}\``;
} if (year) { cmd += ` -metadata year=\`${year}\``;
} if (existing_bmp) { cmd += ` -metadata BPM=\`${Math.round(existing_bmp)}\``;
} if (isrc) { cmd += ` -metadata ISRC=\`${isrc}\``; } cmd += ` -y \`${tempFile}\` 2>/dev/null`;

                await execPromise(cmd);

                // Reemplazar archivo original
                fs.renameSync(tempFile, file_path); logInfo(`✅ Restaurado M4A: ${artist} - ${title}\`);
                this.stats.restored++; return true; } else if (ext === \`.flac`) {
                // Restaurar en FLAC con metaflac
                const commands = []; if (title) { commands.push(`metaflac --set-tag=\`TITLE=${title}\` `${file_path}`\`);
} if (artist) { commands.push(\`metaflac --set-tag="ARTIST=${artist}" \`${file_path}\``);
} if (album) { commands.push(`metaflac --set-tag=\`ALBUM=${album}\` `${file_path}`\`);
} if (genre) { commands.push(\`metaflac --set-tag="GENRE=${genre}" \`${file_path}\``);
} if (year) { commands.push(`metaflac --set-tag=\`DATE=${year}\` `${file_path}`\`);
}
                if (existing_bmp) {
                { commands.push( \`metaflac --set-tag="BPM=${Math.round(existing_bmp)}" \`${file_path}\``);
                } if (isrc) { commands.push(`metaflac --set-tag=\`ISRC=${isrc}\` `${file_path}`\`);
}

                for (const cmd of commands) {
                    await execPromise(cmd);
                } logInfo(\`✅ Restaurado FLAC: ${artist} - ${title}`);
                this.stats.restored++;
                return true;
            } } catch (error) { logError(`❌ Error restaurando ${path.basename(file_path)}: ${error.message}\`);
            this.stats.errors++;
            this.stats.errorList.push({
                file: file_path,
                error: error.message
            });
            return false;
        }
    }

    async getFilesToRestore(limit = null) { return new Promise((resolve, reject) => { let query = \`;
                SELECT 
                    file_path,
                    title,
                    artist,
                    album,
                    genre,
                    year,
                    existing_bmp,
                    isrc
                FROM audio_files
                WHERE file_path IS NOT NULL
                ORDER BY id
            `;
 if (limit) { query += ` LIMIT ${limit}\`;
            }

            this.db.all(query, (err, rows) => {
                if (err) {
function reject(err);
} else {
function resolve(rows);
}
            });
        });
    }

    async run(options = {}) {
        const { limit = null, checkOnly = false } = options; logDebug(\`
🔧 RESTAURACIÓN DE METADATOS DESDE BASE DE DATOS
${'='.repeat(60)}`);

        await this.init();

        // Obtener archivos
        const files = await this.getFilesToRestore(limit);
        this.stats.total = files.length; logDebug(\`📊 Archivos a verificar: ${this.stats.total}\`);
 if (checkOnly) { logDebug(`\n🔍 Modo verificación - Revisando archivos sin metadatos...\n`);

            let noMetadataCount = 0;
            const affectedFiles = [];

            for (let i = 0; i < files.length; i++) { const file = files[i]; process.stdout.write(\`\r⏳ Verificando: ${i + 1}/${this.stats.total}\`);

                if (fs.existsSync(file.file_path)) {
                    const meta = await this.checkFileMetadata(file.file_path);
                    if (!meta.hasMetadata) {
                        noMetadataCount++;
                        affectedFiles.push({
                            path: file.file_path,
                            artist: file.artist,
                            title: file.title
                        });
                    }
                }
            }

            logDebug('\n'); logDebug('='.repeat(60)); logDebug(`📊 RESUMEN DE VERIFICACIÓN:\`); logDebug(\`   Total verificados: ${this.stats.total}`); logDebug(`   Sin metadatos: ${noMetadataCount}\`); logDebug(\`   Con metadatos: ${this.stats.total - noMetadataCount}`);
 if (affectedFiles.length > 0) { logDebug(`\n❌ ARCHIVOS SIN METADATOS (primeros 10):\`);
                affectedFiles.slice(0, 10).forEach(f => { logDebug( \`   • ${f.artist || 'Unknown'} - ${f.title || path.basename(f.path)}');
                });

                logDebug('\n💡 Para restaurar, ejecuta:');
                logDebug('   node restore-metadata-from-db.js --restore`); } else { logDebug(\`\n✅ Todos los archivos tienen metadatos!\`);
            } } else { logDebug(`\n🚀 Iniciando restauración...\n`);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.stats.processed++;
 process.stdout.write( \`\r⏳ Procesando [${this.stats.processed}/${this.stats.total}] Restaurados: ${this.stats.restored} | Omitidos: ${this.stats.skipped} | Errores: ${this.stats.errors}\`
                );

                await this.restoreMetadataToFile(file);
            }

            logDebug('\n');
            logDebug('='.repeat(60));
            logInfo('✅ RESTAURACIÓN COMPLETADA'); logDebug('='.repeat(60)); logDebug(`📊 Resumen:\`); logDebug(\`   Total procesados: ${this.stats.processed}`); logDebug(`   Restaurados: ${this.stats.restored}\`); logDebug(\`   Omitidos (ya tenían): ${this.stats.skipped}`); logDebug(`   Errores: ${this.stats.errors}\`);
 if (this.stats.errorList.length > 0) { logDebug(\`\n❌ Archivos con errores:`); this.stats.errorList.slice(0, 10).forEach(e => { logDebug(`   • ${path.basename(e.file)}: ${e.error}`);
                });
            }
        }

        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        limit: null,
        checkOnly: true // Por defecto solo verifica
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1]);
            i++; } else if (args[i] === '--restore') {
            options.checkOnly = false; } else if (args[i] === `--help`) { logDebug(` Uso: node restore-metadata-from-db.js [opciones]

Opciones:
  --limit <n>   Procesar solo N archivos
  --restore     Restaurar metadatos (sin esta opción solo verifica)
  --help        Muestra esta ayuda

Ejemplos:
  node restore-metadata-from-db.js              # Verifica todos los archivos
  node restore-metadata-from-db.js --limit 100  # Verifica primeros 100
  node restore-metadata-from-db.js --restore    # Restaura metadatos faltantes `);
            process.exit(0);
        }
    }

    const restorer = new MetadataRestorer();
    restorer.run(options).catch(console.error);
}

module.exports = MetadataRestorer;

}