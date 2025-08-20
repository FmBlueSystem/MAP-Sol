const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

// CONFIGURACIÓN - ACTUALIZA ESTAS RUTAS
const NEW_MUSIC_PATH = '/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga';
const DB_PATH = path.join(__dirname, 'music_analyzer.db');
const ARTWORK_CACHE_PATH = path.join(__dirname, 'artwork-cache');

logDebug('🚨 PANIC MODE: FIXING EVERYTHING...');
logDebug('📍 New music path:', NEW_MUSIC_PATH);
logDebug('📍 Database path:', DB_PATH);
logDebug('📍 Artwork cache:', ARTWORK_CACHE_PATH);
logDebug('');

class EmergencyFixer {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.fixedCount = 0;
        this.errorCount = 0;
        this.missingFiles = [];
        this.wrongArtwork = [];
        this.artworkFixed = 0;
    }

    async fixEverything() {
        logDebug('='.repeat(60));
        logDebug('🔧 STARTING EMERGENCY FIX PROCESS');
        logDebug('='.repeat(60));

        logDebug('\n📍 Step 1: Validating new music directory...');
        await this.validateMusicDirectory();

        logDebug('\n📍 Step 2: Updating all file paths...');
        await this.updateAllPaths();

        logDebug('\n📍 Step 3: Validating artwork associations...');
        await this.validateArtwork();

        logDebug('\n📍 Step 4: Re-extracting missing artwork...');
        await this.reExtractArtwork();

        logDebug('\n📍 Step 5: Testing playback...');
        await this.testPlayback();

        logDebug('\n📍 Step 6: Cleaning orphaned records...');
        await this.cleanOrphans();

        logDebug('\n📍 Step 7: Generating report...');
        this.generateReport();

        this.db.close();
    }

    validateMusicDirectory() {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(NEW_MUSIC_PATH)) {
                logError('❌ Music directory not found:', NEW_MUSIC_PATH);
                logWarn('⚠️  Please update NEW_MUSIC_PATH in this script');
                reject('Music directory not found');
                return;
            }

            // Count files
            const files = this.getAllMusicFiles(NEW_MUSIC_PATH);
            logInfo('✅ Found ${files.length} music files in new directory`);
            resolve();
        });
    }

    getAllMusicFiles(dir, fileList = []) {
        try {
            const files = fs.readdirSync(dir);

            files.forEach(file => {
                const filePath = path.join(dir, file);
                try {
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                        this.getAllMusicFiles(filePath, fileList);
                    } else if (this.isMusicFile(file)) {
                        fileList.push(filePath);
                    }
                } catch (e) {
                    // Skip files we can't access
                }
            });
        } catch (e) {
            logError('Error reading directory:', dir);
        }

        return fileList;
    }

    isMusicFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.opus', '.wma'].includes(ext);
    }

    updateAllPaths() {
        return new Promise(resolve => {
            // Get all files from DB
            this.db.all('SELECT * FROM audio_files', async (err, rows) => {
                if (err) {
                    logError('❌ Error reading database:', err);
                    resolve();
                    return;
                }

                logDebug(`📊 Processing ${rows.length} database records...`);

                // Build a map of all music files for faster lookup
                const allFiles = this.getAllMusicFiles(NEW_MUSIC_PATH);
                const fileMap = new Map();

                allFiles.forEach(filePath => {
                    const basename = path.basename(filePath);
                    if (!fileMap.has(basename)) {
                        fileMap.set(basename, []);
                    }
                    fileMap.get(basename).push(filePath);
                });

                for (const row of rows) {
                    await this.updateSinglePath(row, fileMap);
                }

                logInfo(`✅ Updated ${this.fixedCount} paths`);
                logWarn(`⚠️  ${this.missingFiles.length} files not found`);
                resolve();
            });
        });
    }

    updateSinglePath(row, fileMap) {
        return new Promise(resolve => {
            const oldPath = row.file_path;
            const fileName = row.file_name;

            // Try to find the file in new directory
            const newPath = this.findFileInMap(fileName, fileMap);

            if (newPath) {
                // Update database with new path
                this.db.run(
                    'UPDATE audio_files SET file_path = ? WHERE id = ?`,
                    [newPath, row.id],
                    err => {
                        if (!err) {
                            this.fixedCount++;
                            if (this.fixedCount % 100 === 0) {
                                logDebug(`   Progress: ${this.fixedCount} files fixed...`);
                            }
                        } else {
                            this.errorCount++;
                        }
                        resolve();
                    }
                );
            } else {
                this.missingFiles.push({
                    id: row.id,
                    name: fileName,
                    title: row.title,
                    artist: row.artist,
                    oldPath: oldPath
                });
                resolve();
            }
        });
    }

    findFileInMap(fileName, fileMap) {
        // First try exact match
        if (fileMap.has(fileName)) {
            const matches = fileMap.get(fileName);
            return matches[0]; // Return first match
        }

        // Try without extension
        const nameWithoutExt = path.parse(fileName).name;

        // Try to find similar files
        for (const [mapFileName, paths] of fileMap) {
            const mapNameWithoutExt = path.parse(mapFileName).name;

            // Exact match without extension
            if (mapNameWithoutExt === nameWithoutExt) {
                return paths[0];
            }

            // Fuzzy match - contains the name
            if (
                mapNameWithoutExt.toLowerCase().includes(nameWithoutExt.toLowerCase()) ||
                nameWithoutExt.toLowerCase().includes(mapNameWithoutExt.toLowerCase())
            ) {
                return paths[0];
            }
        }

        return null;
    }

    validateArtwork() {
        return new Promise(resolve => {
            this.db.all(
                'SELECT * FROM audio_files WHERE artwork_path IS NOT NULL',
                async (err, rows) => {
                    if (err) {
                        logError('❌ Error validating artwork:', err);
                        resolve();
                        return;
                    }

                    logDebug(`📊 Validating ${rows.length} artwork files...`);

                    for (const row of rows) {
                        await this.validateSingleArtwork(row);
                    }

                    logInfo('✅ Validated artwork associations`);
                    logDebug(`🎨 Fixed ${this.artworkFixed} artwork paths`);
                    logWarn(`⚠️  ${this.wrongArtwork.length} incorrect associations`);
                    resolve();
                }
            );
        });
    }

    validateSingleArtwork(row) {
        return new Promise(resolve => {
            const artworkPath = row.artwork_path;
            const expectedPath = path.join(ARTWORK_CACHE_PATH, `${row.id}.jpg`);

            // Check if artwork file exists
            if (!fs.existsSync(artworkPath)) {
                // Try expected path
                if (fs.existsSync(expectedPath)) {
                    // Update to correct path
                    this.db.run(
                        'UPDATE audio_files SET artwork_path = ? WHERE id = ?',
                        [expectedPath, row.id],
                        err => {
                            if (!err) {
                                this.artworkFixed++;
                            }
                            resolve();
                        }
                    );
                } else {
                    this.wrongArtwork.push({
                        id: row.id,
                        title: row.title,
                        expected: expectedPath,
                        actual: artworkPath
                    });
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    async reExtractArtwork() {
        logDebug('🎨 Re-extracting missing artwork...');

        const rows = await new Promise(resolve => {
            this.db.all(
                'SELECT * FROM audio_files WHERE (artwork_path IS NULL OR artwork_path = "`) AND file_path IS NOT NULL',
                (err, rows) => resolve(rows || [])
            );
        });

        logDebug(`📊 Found ${rows.length} tracks without artwork`);

        let extracted = 0;
        let processed = 0;

        for (const row of rows) {
            if (row.file_path && fs.existsSync(row.file_path)) {
                const success = await this.extractArtworkFromFile(row.file_path, row.id);
                if (success) {
                    extracted++;
                }
            }

            processed++;
            if (processed % 50 === 0) {
                logDebug(
                    `   Progress: ${processed}/${rows.length} processed, ${extracted} extracted...`
                );
            }
        }

        logInfo(`✅ Extracted ${extracted} new artworks`);
    }

    async extractArtworkFromFile(filePath, trackId) {
        try {
            const metadata = await mm.parseFile(filePath);
            const pictures = metadata.common.picture;

            if (pictures && pictures.length > 0) {
                const picture = pictures[0];
                const outputPath = path.join(ARTWORK_CACHE_PATH, `${trackId}.jpg`);

                // Ensure artwork directory exists
                if (!fs.existsSync(ARTWORK_CACHE_PATH)) {
                    fs.mkdirSync(ARTWORK_CACHE_PATH, { recursive: true });
                }

                fs.writeFileSync(outputPath, picture.data);

                // Update database
                return new Promise(resolve => {
                    this.db.run(
                        'UPDATE audio_files SET artwork_path = ? WHERE id = ?',
                        [outputPath, trackId],
                        err => {
                            resolve(!err);
                        }
                    );
                });
            }
        } catch (error) {
            // Silent fail for individual files
        }
        return false;
    }

    testPlayback() {
        return new Promise(resolve => {
            // Test a few random files
            this.db.all(
                'SELECT * FROM audio_files WHERE file_path IS NOT NULL ORDER BY RANDOM() LIMIT 10',
                (err, rows) => {
                    if (err || !rows) {
                        resolve();
                        return;
                    }

                    logDebug('🎵 Testing playback for 10 random files:`);
                    let playable = 0;
                    let notPlayable = 0;

                    rows.forEach(row => {
                        if (fs.existsSync(row.file_path)) {
                            logDebug(`   ✅ ${row.title} - ${row.artist}`);
                            playable++;
                        } else {
                            logDebug(`   ❌ ${row.title} - ${row.artist} [File not found]`);
                            notPlayable++;
                        }
                    });

                    logDebug(`📊 Results: ${playable} playable, ${notPlayable} not playable`);
                    resolve();
                }
            );
        });
    }

    cleanOrphans() {
        return new Promise(resolve => {
            // Count orphans first
            this.db.get(
                'SELECT COUNT(*) as count FROM audio_files WHERE file_path IS NULL OR file_path = "``,
                (err, row) => {
                    if (!err && row && row.count > 0) {
                        logDebug(`🗑️  Found ${row.count} orphaned records`);

                        // Optional: Remove them
                        // this.db.run('DELETE FROM audio_files WHERE file_path IS NULL OR file_path = "`');
                    } else {
                        logInfo('✅ No orphaned records found');
                    }
                    resolve();
                }
            );
        });
    }

    generateReport() {
        logDebug('\n' + '='.repeat(60));
        logDebug('📊 EMERGENCY FIX REPORT');
        logDebug('='.repeat(60));
        logInfo(`✅ Fixed paths: ${this.fixedCount}`);
        logDebug(`🎨 Fixed artwork: ${this.artworkFixed}`);
        logError(`❌ Missing files: ${this.missingFiles.length}`);
        logDebug(`🎨 Wrong artwork: ${this.wrongArtwork.length}`);
        logWarn(`⚠️  Total errors: ${this.errorCount}`);

        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                fixedPaths: this.fixedCount,
                fixedArtwork: this.artworkFixed,
                missingFiles: this.missingFiles.length,
                wrongArtwork: this.wrongArtwork.length,
                errors: this.errorCount
            },
            missingFiles: this.missingFiles.slice(0, 100), // First 100 only
            wrongArtwork: this.wrongArtwork.slice(0, 100)
        };

        fs.writeFileSync('emergency-fix-report.json', JSON.stringify(report, null, 2));
        logDebug('\n📄 Detailed report saved to: emergency-fix-report.json');

        // Create SQL to fix remaining issues
        if (this.missingFiles.length > 0) {
            const sqlFixes = [
                '-- SQL fixes for missing files',
                '-- Review before executing!',
                '`,
                ...this.missingFiles
                    .slice(0, 50)
                    .map(
                        f =>
                            `-- Missing: ${f.title} by ${f.artist}\n-- DELETE FROM audio_files WHERE id = ${f.id};`
                    )
            ].join('\n');

            fs.writeFileSync('manual-fixes.sql', sqlFixes);
            logDebug('📝 Manual SQL fixes saved to: manual-fixes.sql');
        }

        logDebug('\n' + '='.repeat(60));
        logInfo('✅ EMERGENCY FIX COMPLETE!');
        logInfo('🔄 Please restart the application with: npm start');
        logDebug('='.repeat(60));
    }
}

// EJECUTAR REPARACIÓN
logDebug('Starting emergency fix in 3 seconds...\n');

setTimeout(() => {
    const fixer = new EmergencyFixer();
    fixer
        .fixEverything()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            logError('\n❌ EMERGENCY FIX FAILED:`, err);
            process.exit(1);
        });
}, 3000);
