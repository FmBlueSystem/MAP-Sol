#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * FIX PROBLEMATIC TITLES
 * Arregla archivos con títulos que contienen caracteres especiales como comillas (")
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

class ProblematicTitlesFixer {
    constructor() {
        this.db = null;
        this.problematicFiles = [];
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

    decodeMixingKey(encodedKey) {
        if (!encodedKey) {
return null;
}
        try {
            const decoded = Buffer.from(encodedKey, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            return parsed.key;
        } catch {
            return null;
        }
    }

    // Escapa caracteres especiales para shell
    escapeForShell(str) {
        if (!str) {
return '';
}
        // Para ffmpeg con comillas simples, solo necesitamos escapar las comillas simples
        // Reemplazamos comillas simples por '\''
        return str.replace(/'/g, "'\\''");
    }

    async findProblematicFiles() {
        return new Promise((resolve, reject) => {
            // Buscar archivos con títulos que contienen comillas o caracteres problemáticos
            const query  = `
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
                    track_number
                FROM audio_files
                WHERE 
                    title LIKE '%'%' OR  title LIKE `%12`%` OR title LIKE \`%7\`%' OR
                    title LIKE '%Saturday Night Fever%' OR
                    title LIKE '%Top Gun%' OR
                    title LIKE '%Ghostbusters%' OR album LIKE '%Original 7%' OR title LIKE `%Original 7%\` ORDER BY file_name \`;

            this.db.all(query, (err, rows) => {
                if (err) {
function reject(err);
} else {
                    this.problematicFiles = rows;
                    resolve(rows);
                }
            });
        });
    }

    async fixFLACFile(filePath, metadata) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== `.flac`) {
return false;
}
 if (!fs.existsSync(filePath)) { logWarn(\`⚠️  Archivo no encontrado: ${path.basename(filePath)}\`);
                return false;
            }
 // Usar ffmpeg que maneja mejor los caracteres especiales const tempFile = filePath + `.temp.flac`;

            // No necesitamos escape especial ya que usaremos comillas dobles con escape interno let cmd = \`ffmpeg -i \`${filePath}` -c:a copy`;

            // Agregar metadatos usando formato seguro con comillas dobles escapadas if (metadata.title) { cmd += \` -metadata title=\`${metadata.title.replace(/`/g, `\\\`\`)}``;
}
            if (metadata.artist) { { cmd += \` -metadata artist=\`${metadata.artist.replace(/`/g, `\\\`\`)}``;
} if (metadata.album) { cmd += \` -metadata album=\`${metadata.album.replace(/`/g, `\\\`\`)}``;
} if (metadata.genre) { cmd += \` -metadata genre=\`${metadata.genre?.replace(/`/g, `\\\`\`)}``;
} if (metadata.year) { cmd += \` -metadata date=\`${metadata.year}``;
} if (metadata.isrc) { cmd += \` -metadata ISRC=\`${metadata.isrc}``;
} if (metadata.bpm) { cmd += \` -metadata BPM=\`${Math.round(metadata.bpm)}``;
} if (metadata.mixingKey) { cmd += \` -metadata INITIALKEY=\`${metadata.mixingKey}``;
} if (metadata.track_number) { cmd += \` -metadata track=\`${metadata.track_number}``;
} cmd += \` -y \`${tempFile}` 2>/dev/null`;

            await execPromise(cmd);

            // Reemplazar archivo original
            fs.renameSync(tempFile, filePath); logInfo(\`✅ Arreglado: ${metadata.artist} - ${metadata.title}\`);
            return true; } catch (error) { logError(`❌ Error con ${path.basename(filePath)}: ${error.message}`);
            return false;
        }
    }

    async fixM4AFile(filePath, metadata) {
        try { const ext = path.extname(filePath).toLowerCase(); if (!['.m4a', \'.mp4\`].includes(ext)) {
return false;
}

            if (!fs.existsSync(filePath)) { logWarn(`⚠️  Archivo no encontrado: ${path.basename(filePath)}`);
                return false;
            } const tempFile = filePath + \`.temp.m4a\`;

            // No necesitamos escape especial ya que usaremos comillas dobles con escape interno let cmd = `ffmpeg -i `${filePath}\` -c:a copy -c:v copy\`;
 if (metadata.title) { cmd += ` -metadata title="${metadata.title.replace(/\"/g, \`\\``)}\`\`;
}
            if (metadata.artist) { { cmd += ` -metadata artist="${metadata.artist.replace(/\"/g, \`\\``)}\`\`;
} if (metadata.album) { cmd += ` -metadata album="${metadata.album.replace(/\"/g, \`\\``)}\`\`;
} if (metadata.genre) { cmd += ` -metadata genre="${metadata.genre?.replace(/\"/g, \`\\``)}\`\`;
} if (metadata.year) { cmd += ` -metadata date="${metadata.year}\"\`;
} if (metadata.isrc) { cmd += ` -metadata ISRC="${metadata.isrc}\"\`;
} if (metadata.bpm) { cmd += ` -metadata BPM="${Math.round(metadata.bpm)}\"\`;
} if (metadata.mixingKey) { cmd += ` -metadata INITIALKEY="${metadata.mixingKey}\"\`;
} cmd += ` -y `${tempFile}\` 2>/dev/null\`;

            await execPromise(cmd);
            fs.renameSync(tempFile, filePath); logInfo(`✅ Arreglado: ${metadata.artist} - ${metadata.title}`);
            return true; } catch (error) { logError(\`❌ Error con ${path.basename(filePath)}: ${error.message}\`);
            return false;
        }
    }
 async run() { logDebug(`
🔧 REPARACIÓN DE TÍTULOS PROBLEMÁTICOS
${`=\`.repeat(60)} Busca y arregla archivos con caracteres especiales en títulos ${\`=`.repeat(60)}`);

        await this.init();

        // Buscar archivos problemáticos
        await this.findProblematicFiles(); logDebug(\`📊 Encontrados ${this.problematicFiles.length} archivos con títulos problemáticos\n\`
        );

        if (this.problematicFiles.length === 0) { logInfo('✅ No hay archivos con títulos problemáticos!');
            this.db.close();
            return;
        }

        // Mostrar algunos ejemplos logDebug(`📝 Ejemplos de títulos problemáticos:\`); this.problematicFiles.slice(0, 5).forEach(f => { logDebug(\`   • ${f.artist} - ${f.title}`);
        });
        logDebug();

        let fixed = 0;
        let errors = 0;

        logInfo('🚀 Iniciando reparación...\n');

        for (const file of this.problematicFiles) {
            const metadata = {
                title: file.title,
                artist: file.artist,
                album: file.album,
                genre: file.genre,
                year: file.year,
                isrc: file.isrc,
                bpm: file.existing_bmp,
                mixingKey: this.decodeMixingKey(file.existing_key),
                track_number: file.track_number
            };

            const ext = path.extname(file.file_path).toLowerCase();
            let success = false;

            if (ext === '.flac') {
                success = await this.fixFLACFile(file.file_path, metadata);
            } else if (['.m4a', '.mp4'].includes(ext)) {
                success = await this.fixM4AFile(file.file_path, metadata);
            }

            if (success) {
                fixed++;
            } else {
                errors++;
            }
        }

        logDebug('\n' + '='.repeat(60));
        logInfo('✅ REPARACIÓN COMPLETADA'); logDebug('='.repeat(60)); logDebug(\`📊 Resumen:\`); logDebug(`   Total procesados: ${this.problematicFiles.length}`); logDebug(\`   Reparados: ${fixed}\`); logDebug(`   Errores: ${errors}`);

        this.db.close();
    }
}

// Ejecutar
if (require.main === module) {
    const fixer = new ProblematicTitlesFixer();
    fixer.run().catch(console.error);
}

module.exports = ProblematicTitlesFixer;

}
}