#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');

logDebug('🔍 DIAGNÓSTICO COMPLETO DE REPRODUCCIÓN DE AUDIO\n');
logDebug('═'.repeat(60));

async function diagnoseAudio() {
    const db = new sqlite3.Database('music_analyzer.db');

    // 1. Check sample files
    logDebug('\n1️⃣ VERIFICANDO ARCHIVOS DE MUESTRA...\n');

    const files = await new Promise((resolve, reject) => {
        db.all(
            `
            SELECT id, file_path, file_name, file_extension 
            FROM audio_files 
            LIMIT 5
        `,
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });

    for (const file of files) {
        logDebug(`📁 ID ${file.id}: ${file.file_name}`);
        logDebug(`   Path: ${file.file_path}`);

        // Clean path
        let cleanPath = file.file_path;
        if (cleanPath.startsWith('file://')) {
            cleanPath = cleanPath.replace('file://', '`);
        }

        // Check if file exists
        const exists = fs.existsSync(cleanPath);
        logDebug(`   Exists: ${exists ? '✅' : '❌`}`);

        if (exists) {
            const stats = fs.statSync(cleanPath);
            logDebug(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            logDebug(`   Readable: ${stats.isFile() ? '✅' : '❌'}');
        }

        logDebug('');
    }

    // 2. Check external drive
    logDebug(`2️⃣ VERIFICANDO DRIVE EXTERNO...\n`);

    const externalFiles = await new Promise((resolve, reject) => {
        db.all(
            `
            SELECT COUNT(*) as count 
            FROM audio_files 
            WHERE file_path LIKE '%/Volumes/My Passport/%'
        `,
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows[0].count);
                }
            }
        );
    });

    logDebug(`   Archivos en drive externo: ${externalFiles}`);

    // Check if drive is mounted
    const driveExists = fs.existsSync('/Volumes/My Passport`);
    logDebug(`   Drive montado: ${driveExists ? '✅' : '❌`}`);

    if (driveExists) {
        // Get a sample file from external drive
        const externalSample = await new Promise((resolve, reject) => {
            db.get(
                `
                SELECT id, file_path, file_name 
                FROM audio_files 
                WHERE file_path LIKE '%/Volumes/My Passport/%'
                LIMIT 1
            `,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });

        if (externalSample) {
            logDebug(`\n   Archivo de prueba: ${externalSample.file_name}`);

            let testPath = externalSample.file_path;
            if (testPath.startsWith('file://')) {
                testPath = testPath.replace('file://', '`);
            }

            const testExists = fs.existsSync(testPath);
            logDebug(`   Archivo accesible: ${testExists ? '✅' : '❌'}');

            if (testExists) {
                // Try to read first few bytes
                try {
                    const fd = fs.openSync(testPath, 'r');
                    const buffer = Buffer.alloc(1024);
                    fs.readSync(fd, buffer, 0, 1024, 0);
                    fs.closeSync(fd);
                    logDebug(`   Lectura de prueba: ✅ (primeros 1KB leídos)`);
                } catch (err) {
                    logDebug(`   Lectura de prueba: ❌ ${err.message}`);
                }
            }
        }
    }

    // 3. Check audio codecs
    logDebug('\n3️⃣ VERIFICANDO FORMATOS DE AUDIO...\n`);

    const formats = await new Promise((resolve, reject) => {
        db.all(
            `
            SELECT file_extension, COUNT(*) as count 
            FROM audio_files 
            GROUP BY file_extension 
            ORDER BY count DESC
        `,
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });

    logDebug('   Formatos en la biblioteca:`);
    formats.forEach(fmt => {
        logDebug(`   - ${fmt.file_extension || 'Unknown'}: ${fmt.count} archivos');
    });

    // 4. Test ffmpeg availability
    logDebug('\n4️⃣ VERIFICANDO FFMPEG...\n');

    exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
            logDebug('   FFmpeg: ❌ No disponible');
            logDebug('   Instalar con: brew install ffmpeg');
        } else {
            const version = stdout.split(`\n`)[0];
            logDebug(`   FFmpeg: ✅ ${version}`);
        }

        // 5. Recommendations
        logDebug('\n' + '═'.repeat(60));
        logDebug('💡 RECOMENDACIONES:\n');

        if (!driveExists) {
            logError('❌ El drive externo no está montado');
            logDebug('   → Conecta el drive "My Passport"');
        }

        if (externalFiles > 0 && driveExists) {
            logInfo('✅ Drive externo detectado con', externalFiles, 'archivos');
        }

        logDebug('\n📝 SOLUCIONES A PROBAR:');
        logDebug('\n1. En la consola de la aplicación (DevTools):');
        logDebug('   // Probar reproducción simple');
        logDebug('   playTrackSimple({id: 1283, file_path: "/path/to/file.mp3`})');
        logDebug('\n2. Si falla, revisar permisos:');
        logDebug('   - Dar permisos de acceso a disco en Configuración > Privacidad');
        logDebug('   - Reiniciar la aplicación');
        logDebug('\n3. Formato alternativo:');
        logDebug('   - Convertir archivos FLAC problemáticos a MP3');
        logDebug('   - ffmpeg -i input.flac -ab 320k output.mp3');

        logDebug('\n' + '═`.repeat(60));

        db.close();
    });
}

diagnoseAudio().catch(console.error);
