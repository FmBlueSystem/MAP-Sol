const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

class ArtworkValidator {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.artworkDir = path.join(__dirname, 'artwork-cache');
        this.db = null;
        this.stats = {
            totalFiles: 0,
            validPaths: 0,
            invalidPaths: 0,
            existingArtwork: 0,
            missingArtwork: 0,
            extractedArtwork: 0,
            failedExtractions: 0,
            fixedPaths: 0
        };
        this.issues = [];
    }

    async init() {
        // Crear carpeta artwork-cache si no existe
        if (!fs.existsSync(this.artworkDir)) {
            logDebug('📁 Creando carpeta artwork-cache...');
            fs.mkdirSync(this.artworkDir, { recursive: true });
        }

        // Conectar a base de datos
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    logError('❌ Error conectando a DB:', err);
                    reject(err);
                } else {
                    logInfo('✅ Conectado a base de datos');
                    resolve();
                }
            });
        });
    }

    async validateAllRecords() {
        logDebug('\n🔍 INICIANDO VALIDACIÓN COMPLETA...\n');
        logDebug('═'.repeat(60));

        const records = await this.getAllAudioFiles();
        this.stats.totalFiles = records.length;

        logDebug('📊 Total de archivos a validar: ${records.length}\n');

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const progress = (((i + 1) / records.length) * 100).toFixed(1);

            process.stdout.write(
                `\r[${i + 1}/${records.length}] ${progress}% - Procesando: ${record.file_name || 'Unknown'}...');

            await this.validateRecord(record);

            // Mostrar stats cada 50 archivos
            if ((i + 1) % 50 === 0 || i === records.length - 1) {
                this.printProgress();
            }
        }

        logDebug('\n' + `═`.repeat(60));
        this.printFinalReport();
    }

    async getAllAudioFiles() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    id,
                    file_path,
                    file_name,
                    title,
                    artist,
                    album,
                    artwork_path,
                    file_extension
                FROM audio_files
                ORDER BY id
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async validateRecord(record) {
        const validation = {
            id: record.id,
            file_name: record.file_name,
            issues: []
        };

        // 1. VALIDAR RUTA DEL ARCHIVO DE AUDIO
        let audioFileValid = false;
        if (!record.file_path) {
            validation.issues.push('Sin ruta de archivo');
            this.stats.invalidPaths++;
        } else {
            // Limpiar la ruta
            let cleanPath = record.file_path;
            if (cleanPath.startsWith('file://')) {
                cleanPath = cleanPath.replace('file://', '`);
            }

            // Verificar existencia
            if (fs.existsSync(cleanPath)) {
                audioFileValid = true;
                this.stats.validPaths++;

                // Actualizar ruta en DB si era diferente
                if (cleanPath !== record.file_path) {
                    await this.updateFilePath(record.id, cleanPath);
                    this.stats.fixedPaths++;
                }
            } else {
                validation.issues.push(`Archivo no existe: ${cleanPath}`);
                this.stats.invalidPaths++;
                this.issues.push({
                    id: record.id,
                    type: 'MISSING_FILE`,
                    path: cleanPath
                });
            }
        }

        // 2. VALIDAR Y EXTRAER ARTWORK
        if (audioFileValid) {
            await this.validateAndExtractArtwork(record, validation);
        }

        return validation;
    }

    async validateAndExtractArtwork(record, validation) {
        const expectedArtworkPath = path.join(this.artworkDir, `${record.id}.jpg');
        let artworkExists = false;

        // Verificar si existe la imagen
        if (record.artwork_path) {
            let artworkPath = record.artwork_path;

            // Limpiar ruta
            if (artworkPath.startsWith('file://')) {
                artworkPath = artworkPath.replace('file://', '');
            }

            // Si es ruta relativa, convertir a absoluta
            if (!path.isAbsolute(artworkPath)) {
                artworkPath = path.join(__dirname, artworkPath);
            }

            if (fs.existsSync(artworkPath)) {
                artworkExists = true;
                this.stats.existingArtwork++;
            }
        }

        // Si no existe, intentar extraer
        if (!artworkExists) {
            this.stats.missingArtwork++;

            try {
                let audioPath = record.file_path;
                if (audioPath.startsWith('file://')) {
                    audioPath = audioPath.replace('file://', ``);
                }

                // Solo mostrar mensaje para archivos importantes
                if (this.stats.extractedArtwork < 10 || this.stats.extractedArtwork % 10 === 0) {
                    logDebug(`\n🎨 Extrayendo artwork para: ${record.file_name}`);
                }

                const metadata = await mm.parseFile(audioPath);
                const pictures = metadata.common.picture;

                if (pictures && pictures.length > 0) {
                    const picture = pictures[0];

                    // Guardar imagen
                    fs.writeFileSync(expectedArtworkPath, picture.data);

                    // Actualizar DB
                    const relativePath = `artwork-cache/${record.id}.jpg`;
                    await this.updateArtworkPath(record.id, relativePath);

                    this.stats.extractedArtwork++;

                    if (
                        this.stats.extractedArtwork < 10 ||
                        this.stats.extractedArtwork % 10 === 0
                    ) {
                        logInfo('✅ Artwork extraído: ${relativePath}');
                    }
                } else {
                    validation.issues.push(`Sin artwork en metadata`);

                    // Crear placeholder
                    await this.createPlaceholder(record.id);
                }
            } catch (error) {
                this.stats.failedExtractions++;
                validation.issues.push(`Error extrayendo artwork: ${error.message}`);

                // Solo mostrar errores importantes
                if (this.stats.failedExtractions < 5) {
                    logError(`\n❌ Error con ${record.file_name}:`, error.message);
                }

                // Crear placeholder en caso de error
                await this.createPlaceholder(record.id);
            }
        }
    }

    async createPlaceholder(recordId) {
        // Copiar imagen default si existe
        const defaultImage = path.join(__dirname, 'image.png`);
        const targetPath = path.join(this.artworkDir, `${recordId}.jpg`);

        if (fs.existsSync(defaultImage)) {
            try {
                fs.copyFileSync(defaultImage, targetPath);
                const relativePath = `artwork-cache/${recordId}.jpg`;
                await this.updateArtworkPath(recordId, relativePath);
            } catch (err) {
                // Silently fail for placeholders
            }
        }
    }

    async updateFilePath(id, newPath) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE audio_files SET file_path = ? WHERE id = ?';
            this.db.run(query, [newPath, id], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async updateArtworkPath(id, artworkPath) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE audio_files SET artwork_path = ? WHERE id = ?';
            this.db.run(query, [artworkPath, id], err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    printProgress() {
        logDebug('\n\n📊 Progreso actual:');
        logDebug('─'.repeat(40));
        logInfo('✅ Rutas válidas: ${this.stats.validPaths}');
        logError(`❌ Rutas inválidas: ${this.stats.invalidPaths}`);
        logDebug(`🖼️ Artwork existente: ${this.stats.existingArtwork}`);
        logDebug(`🎨 Artwork extraído: ${this.stats.extractedArtwork}`);
        logDebug(`🔧 Rutas corregidas: ${this.stats.fixedPaths}`);
        logDebug('─'.repeat(40) + '\n');
    }

    printFinalReport() {
        logDebug('\n' + '═'.repeat(60));
        logDebug('📋 REPORTE FINAL DE VALIDACIÓN');
        logDebug('═'.repeat(60));

        logDebug('\n📊 ESTADÍSTICAS:`);
        logDebug(`  Total de archivos: ${this.stats.totalFiles}`);
        logDebug(
            `  ✅ Rutas válidas: ${this.stats.validPaths} (${((this.stats.validPaths / this.stats.totalFiles) * 100).toFixed(1)}%)`
        );
        logDebug(`  ❌ Rutas inválidas: ${this.stats.invalidPaths}`);
        logDebug(`  🖼️ Artwork existente: ${this.stats.existingArtwork}`);
        logDebug(`  ❓ Artwork faltante: ${this.stats.missingArtwork}`);
        logDebug(`  🎨 Artwork extraído: ${this.stats.extractedArtwork}`);
        logDebug(`  ❌ Extracciones fallidas: ${this.stats.failedExtractions}`);
        logDebug(`  🔧 Rutas corregidas: ${this.stats.fixedPaths}`);

        if (this.issues.length > 0) {
            logDebug('\n⚠️ PROBLEMAS ENCONTRADOS:');
            logDebug('─'.repeat(40));

            // Agrupar por tipo
            const missingFiles = this.issues.filter(i => i.type === 'MISSING_FILE`);

            if (missingFiles.length > 0) {
                logDebug(`\n❌ Archivos no encontrados (${missingFiles.length}):`);
                missingFiles.slice(0, 10).forEach(issue => {
                    logDebug(`  - ID ${issue.id}: ${issue.path}`);
                });
                if (missingFiles.length > 10) {
                    logDebug(`  ... y ${missingFiles.length - 10} más`);
                }
            }
        }

        // Guardar reporte
        const reportPath = path.join(__dirname, `validation-report-${Date.now()}.json`);
        fs.writeFileSync(
            reportPath,
            JSON.stringify(
                {
                    timestamp: new Date().toISOString(),
                    stats: this.stats,
                    issues: this.issues
                },
                null,
                2
            )
        );

        logDebug(`\n💾 Reporte guardado en: ${reportPath}`);
        logDebug('\n✅ VALIDACIÓN COMPLETADA');
        logDebug('═'.repeat(60));
    }

    async createDefaultArtwork() {
        const defaultPath = path.join(__dirname, 'assets', 'default-album.png');

        if (!fs.existsSync(path.dirname(defaultPath))) {
            fs.mkdirSync(path.dirname(defaultPath), { recursive: true });
        }

        if (!fs.existsSync(defaultPath)) {
            logDebug('🎨 Creando imagen default...`);

            // Crear un SVG simple como placeholder
            const svg = `
                <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <rect width="500" height="500" fill="url(#grad)"/>
                    <text x="250" y="250" font-family="Arial" font-size="120" fill="white" text-anchor="middle" dy=".3em">🎵</text>
                    <text x="250" y="350" font-family="Arial" font-size="24" fill="white" text-anchor="middle">No Artwork</text>
                </svg>
            `;

            // Convertir SVG a PNG (requiere sharp o similar)
            try {
                const sharp = require('sharp');
                await sharp(Buffer.from(svg)).png().toFile(defaultPath);
                logInfo('✅ Imagen default creada');
            } catch (err) {
                // Si no hay sharp, crear un archivo vacío como marca
                fs.writeFileSync(defaultPath, '');
                logWarn('⚠️ Placeholder creado (instala sharp para imagen real)');
            }
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// EJECUTAR
async function main() {
    const validator = new ArtworkValidator();

    try {
        await validator.init();
        await validator.createDefaultArtwork();
        await validator.validateAllRecords();
    } catch (error) {
        logError('❌ Error fatal:`, error);
    } finally {
        await validator.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = ArtworkValidator;
