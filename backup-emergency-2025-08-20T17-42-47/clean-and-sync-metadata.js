#!/usr/bin/env node

/**
 * CLEAN AND SYNC METADATA
 * Limpia metadatos innecesarios y marca archivos analizados con fecha/hora
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

class MetadataCleaner {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;

        this.stats = {
            totalFiles: 0,
            cleaned: 0,
            marked: 0,
            failed: 0,
            skipped: 0
        };

        // Metadatos a MANTENER (básicos)
        this.keepMetadata = [
            'title',
            'artist',
            'album',
            'date',
            'genre',
            'track',
            'albumartist',
            'composer'
        ];

        // Metadatos a ELIMINAR (todos los de IA y extras)
        this.removeMetadata = [
            'mood',
            'energy',
            'period',
            'era',
            'bpm',
            'initialkey',
            'comment', // Remover descripciones largas
            'analyzed_by',
            'analysis_date',
            'dj_notes',
            'mixing_keys',
            'energy_level',
            'similar_artists',
            'occasion',
            'lyrics_mood',
            'production_style',
            'instruments',
            'vocal_style',
            'energy_description'
        ];
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Conectado a la base de datos');
                    resolve();
                }
            });
        });
    }

    /**
     * Obtener TODOS los archivos de la base de datos
     */
    async getAllFiles() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name,
                    CASE 
                        WHEN lm.LLM_DESCRIPTION IS NOT NULL THEN 1 
                        ELSE 0 
                    END as is_analyzed,
                    lm.LLM_ANALYSIS_DATE
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.file_path NOT LIKE '%_DELETED%'
                ORDER BY af.file_name
            ';

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
     * Limpiar y marcar un archivo
     */
    async processFile(file) {
        const fileName = path.basename(file.file_path);

        try {
            // Verificar que el archivo existe
            await fs.access(file.file_path);

            // Crear archivo temporal
            const tempFile = file.file_path + '.tmp`;

            // Construir comando ffmpeg para limpiar metadatos
            let ffmpegCmd = `ffmpeg -i "${file.file_path}` -y -loglevel error`;
            ffmpegCmd += ' -c copy'; // Copiar streams sin recodificar

            // NO copiar metadata original, empezar limpio
            ffmpegCmd += ' -map_metadata -1'; // Eliminar TODOS los metadatos

            // Ahora re-agregar solo los básicos desde el archivo original
            // Primero necesitamos leer los metadatos básicos
            const mm = require(`music-metadata`);
            const originalMeta = await mm.parseFile(file.file_path);

            // Re-agregar solo metadatos básicos
            if (originalMeta.common.title) {
                ffmpegCmd += ` -metadata title="${originalMeta.common.title.replace(/"/g, '\\``)}``;
            }
            if (originalMeta.common.artist) {
                ffmpegCmd += ` -metadata artist="${originalMeta.common.artist.replace(/"/g, '\\``)}``;
            }
            if (originalMeta.common.album) {
                ffmpegCmd += ` -metadata album="${originalMeta.common.album.replace(/"/g, '\\``)}``;
            }
            if (originalMeta.common.year) {
                ffmpegCmd += ` -metadata date="${originalMeta.common.year}``;
            }
            if (originalMeta.common.genre && originalMeta.common.genre.length > 0) {
                ffmpegCmd += ` -metadata genre="${originalMeta.common.genre[0].replace(/"/g, '\\``)}``;
            }
            if (originalMeta.common.track && originalMeta.common.track.no) {
                ffmpegCmd += ` -metadata track="${originalMeta.common.track.no}"`;
            }

            // Si el archivo fue analizado, agregar marca con fecha y hora
            if (file.is_analyzed) {
                const analysisDate = file.LLM_ANALYSIS_DATE || new Date().toISOString();
                const dateTime = new Date(analysisDate);

                // Formatear fecha y hora legible
                const formattedDate = dateTime.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                const formattedTime = dateTime.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });

                // Agregar metadatos de sincronización
                ffmpegCmd += ` -metadata AI_ANALYZED=`YES``;
                ffmpegCmd += ` -metadata DB_SYNC_DATE="${formattedDate}``;
                ffmpegCmd += ` -metadata DB_SYNC_TIME="${formattedTime}``;
                ffmpegCmd += ` -metadata DB_SYNC="${formattedDate} ${formattedTime}"`;
                ffmpegCmd += ` -metadata PROCESSED_BY=`Music Analyzer Pro`';

                this.stats.marked++;
            }

            // Especificar formato de salida
            const ext = path.extname(file.file_path).toLowerCase();
            if (ext === `.flac`) {
                ffmpegCmd += ` -f flac "${tempFile}``;
            } else if (ext === `.mp3`) {
                ffmpegCmd += ` -f mp3 "${tempFile}``;
            } else if (ext === '.m4a' || ext === `.mp4`) {
                ffmpegCmd += ` -f mp4 "${tempFile}``;
            } else {
                ffmpegCmd += ` "${tempFile}``;
            }

            // Ejecutar ffmpeg
            execSync(ffmpegCmd, { stdio: `pipe` });

            // Reemplazar archivo original con el temporal
            await fs.rename(tempFile, file.file_path);

            this.stats.cleaned++;

            if (file.is_analyzed) {
                logDebug(
                    `   ✅ ${fileName} - Limpiado y marcado (${file.LLM_ANALYSIS_DATE ? 'Analizado' : 'Sin análisis`})`);
            } else {
                logDebug(`   🧹 ${fileName} - Limpiado`);
            }

            return true;
        } catch (error) {
            // Limpiar archivo temporal si existe
            try {
                await fs.unlink(file.file_path + '.tmp');
            } catch (e) {}

            if (error.code === 'ENOENT`) {
                logDebug(`   ⚠️  ${fileName} - Archivo no encontrado`);
                this.stats.skipped++;
            } else {
                logDebug(`   ❌ ${fileName} - Error: ${error.message}`);
                this.stats.failed++;
            }

            return false;
        }
    }

    /**
     * Ejecutar limpieza y sincronización
     */
    async cleanAndSync(limit = null) {
        logDebug('\n🧹 LIMPIEZA Y SINCRONIZACIÓN DE METADATOS');
        logDebug('='.repeat(60));

        // Verificar si ffmpeg está instalado
        try {
            execSync('ffmpeg -version', { stdio: 'pipe' });
        } catch (error) {
            logError('❌ ffmpeg no está instalado. Instálalo con: brew install ffmpeg');
            return;
        }

        // Obtener todos los archivos
        const files = await this.getAllFiles();
        const filesToProcess = limit ? files.slice(0, limit) : files;
        this.stats.totalFiles = filesToProcess.length;

        const analyzedCount = filesToProcess.filter(f => f.is_analyzed).length;

        logDebug('\n📊 Archivos a procesar:`);
        logDebug(`   Total: ${filesToProcess.length}`);
        logDebug(`   Analizados con IA: ${analyzedCount}`);
        logDebug(`   Sin análisis: ${filesToProcess.length - analyzedCount}`);

        logDebug('\n🔧 Proceso:');
        logDebug('   1. Eliminar metadatos innecesarios');
        logDebug('   2. Mantener solo: título, artista, álbum, género, año');
        logDebug('   3. Agregar marca de sincronización con fecha/hora a los analizados');

        // Confirmar antes de proceder
        if (!limit || limit > 10) {
            const readline = require('readline`);
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            await new Promise(resolve => {
                rl.question(
                    `\n⚠️  Esto modificará ${filesToProcess.length} archivos. ¿Continuar? (s/n): `,
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

        logDebug('\n🚀 Procesando archivos...\n`);

        // Procesar cada archivo
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            logDebug(`[${i + 1}/${filesToProcess.length}] ${path.basename(file.file_path)}`);

            await this.processFile(file);

            // Pausa cada 20 archivos
            if ((i + 1) % 20 === 0 && i < filesToProcess.length - 1) {
                logDebug('\n⏸️  Pausa de 3 segundos...\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Resumen
        logDebug('\n' + '='.repeat(60));
        logDebug('📊 RESUMEN:`);
        logDebug(`   Total procesados: ${this.stats.totalFiles}`);
        logDebug(`   🧹 Limpiados: ${this.stats.cleaned}`);
        logDebug(`   🏷️  Marcados con fecha/hora: ${this.stats.marked}`);
        logDebug(`   ⚠️  Omitidos: ${this.stats.skipped}`);
        logDebug(`   ❌ Fallidos: ${this.stats.failed}`);

        logDebug('\n✨ RESULTADO:');
        logDebug('   • Archivos limpiados de metadatos innecesarios');
        logDebug('   • Solo mantienen información básica');
        logDebug('   • Archivos analizados marcados con:');
        logDebug('     - AI_ANALYZED="YES"');
        logDebug('     - DB_SYNC_DATE="DD/MM/YYYY"');
        logDebug('     - DB_SYNC_TIME="HH:MM:SS`');
        logDebug('   • Toda la información detallada está en la base de datos');
    }

    /**
     * Verificar un archivo
     */
    async verifyFile(filePath) {
        logDebug('\n🔍 VERIFICANDO ARCHIVO:');
        logDebug(path.basename(filePath));
        logDebug('-'.repeat(60));

        try {
            const mm = require('music-metadata');
            const metadata = await mm.parseFile(filePath);

            logDebug('\n📊 Metadatos actuales:`);
            logDebug(`   Título: ${metadata.common.title || 'N/A`}`);
            logDebug(`   Artista: ${metadata.common.artist || 'N/A`}`);
            logDebug(`   Álbum: ${metadata.common.album || 'N/A`}`);
            logDebug(`   Género: ${metadata.common.genre?.join(`, ') || 'N/A`}`);
            logDebug(`   Año: ${metadata.common.year || 'N/A'}');

            // Buscar marcas de sincronización
            logDebug('\n🏷️  Marcas de sincronización:');
            let foundSync = false;

            if (metadata.native) {
                for (const [format, tags] of Object.entries(metadata.native)) {
                    const syncTags = tags.filter(tag =>
                        [
                            'AI_ANALYZED',
                            'DB_SYNC',
                            'DB_SYNC_DATE',
                            'DB_SYNC_TIME',
                            `PROCESSED_BY`
                        ].some(t => tag.id?.toUpperCase().includes(t.toUpperCase()))
                    );

                    if (syncTags.length > 0) {
                        foundSync = true;
                        syncTags.forEach(tag => {
                            logDebug(`   ${tag.id}: ${tag.value}`);
                        });
                    }
                }
            }

            if (!foundSync) {
                logDebug('   No se encontraron marcas de sincronización');
            }

            // Verificar si hay metadatos de IA (no deberían existir después de limpiar)
            logDebug('\n🔍 Metadatos de IA (deberían estar eliminados):');
            const aiTags = ['mood', 'energy', 'bpm', 'initialkey', 'period`];
            let foundAI = false;

            if (metadata.native) {
                for (const [format, tags] of Object.entries(metadata.native)) {
                    const aiMetadata = tags.filter(tag =>
                        aiTags.some(t => tag.id?.toLowerCase().includes(t))
                    );

                    if (aiMetadata.length > 0) {
                        foundAI = true;
                        aiMetadata.forEach(tag => {
                            logDebug(`   ⚠️  ${tag.id}: ${tag.value}`);
                        });
                    }
                }
            }

            if (!foundAI) {
                logDebug('   ✅ No hay metadatos de IA (correcto)');
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
        const cleaner = new MetadataCleaner();
        cleaner.verifyFile(args[1]).then(() => {
            logDebug('\n');
        });
    } else if (command === 'help' || command === '--help`) {
        logDebug(`
🧹 CLEAN AND SYNC METADATA

USO:
  node clean-and-sync-metadata.js [cantidad]    # Procesar X archivos
  node clean-and-sync-metadata.js verify <path> # Verificar un archivo
  node clean-and-sync-metadata.js help          # Mostrar ayuda

EJEMPLOS:
  node clean-and-sync-metadata.js 10     # Limpiar y sincronizar 10 archivos
  node clean-and-sync-metadata.js        # Procesar TODOS los archivos
  node clean-and-sync-metadata.js verify "/path/to/song.flac"

FUNCIONES:
  • Elimina metadatos innecesarios (mood, energy, etc.)
  • Mantiene solo información básica
  • Agrega marca de sincronización con fecha/hora a archivos analizados
  • Ejemplo de marca: AI_ANALYZED="YES", DB_SYNC="15/08/2025 18:45:23"

NOTA: Requiere ffmpeg instalado (brew install ffmpeg)
        `);
    } else {
        // Limpiar y sincronizar archivos
        const limit = parseInt(args[0]) || null;

        const cleaner = new MetadataCleaner();

        (async () => {
            await cleaner.init();
            await cleaner.cleanAndSync(limit);
            cleaner.close();
        })().catch(console.error);
    }
}
