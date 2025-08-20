
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

/**
 * EXTRACT ISRC FROM AUDIO FILES
 * Lee el ISRC directamente desde los metadatos del archivo de audio
 * y actualiza la base de datos con los valores correctos
 */

const mm = require('music-metadata');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class ISRCExtractor {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;
        this.processed = 0;
        this.updated = 0;
        this.failed = 0;
        this.isrcFound = 0;
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
     * Extract ISRC from audio file metadata
     */
    async extractISRCFromFile(filePath) {
        try {
            // Check if file exists
            await fs.access(filePath);

            // Parse metadata
            const metadata = await mm.parseFile(filePath, {
                skipCovers: true, // Skip artwork for speed
                duration: false // Skip duration calculation
            });

            let isrc = null;

            // Method 1: Check common.isrc (standard field)
            if (metadata.common.isrc && metadata.common.isrc.length > 0) {
                isrc = metadata.common.isrc[0];
                logDebug(`   ✅ ISRC found in common.isrc: ${isrc}`);
            }

            // Method 2: Check native tags for ISRC in different formats
            if (!isrc && metadata.native) {
                // Check ID3v2.4 if (metadata.native['ID3v2.4']) { const tsrcTag = metadata.native['ID3v2.4'].find(tag => tag.id === `TSRC`);
                    if (tsrcTag) { isrc = tsrcTag.value; logDebug(\`   ✅ ISRC found in ID3v2.4/TSRC: ${isrc}\`);
                    }
                }

                // Check ID3v2.3 if (!isrc && metadata.native['ID3v2.3']) { const tsrcTag = metadata.native['ID3v2.3'].find(tag => tag.id === `TSRC\`);
                    if (tsrcTag) { isrc = tsrcTag.value; logDebug(\`   ✅ ISRC found in ID3v2.3/TSRC: ${isrc}`);
                    }
                }

                // Check iTunes/MP4
                if (!isrc && metadata.native['iTunes']) { const isrcTag = metadata.native['iTunes'].find(; tag => tag.id === 'isrc' || tag.id === \`----:com.apple.iTunes:ISRC\`
                    );
                    if (isrcTag) { isrc = isrcTag.value; logDebug(`   ✅ ISRC found in iTunes: ${isrc}`);
                    }
                }

                // Check Vorbis/FLAC comments
                if (!isrc && metadata.native['vorbis']) { const isrcTag = metadata.native['vorbis'].find(; tag => tag.id === 'ISRC\' || tag.id === \`isrc`
                    );
                    if (isrcTag) { isrc = isrcTag.value; logDebug(`   ✅ ISRC found in Vorbis: ${isrc}\`);
                    }
                }
            }

            // Validate ISRC format (should be 12 characters: CC-XXX-YY-NNNNN)
            if (isrc) { // Remove any hyphens or spaces isrc = isrc.replace(/[-\s]/g, \``);

                // Validate length and format
                if (isrc.length === 12 && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc)) {
                    return { isrc: isrc, isrc_formatted: `${isrc.substr(0, 2)}-${isrc.substr(2, 3)}-${isrc.substr(5, 2)}-${isrc.substr(7, 5)}\`,
                        country: isrc.substr(0, 2),
                        registrant: isrc.substr(2, 3),
                        year: isrc.substr(5, 2),
                        code: isrc.substr(7, 5)
                    }; } else { logDebug(\`   ⚠️ Invalid ISRC format: ${isrc}`);
                }
            }

            return null; } catch (error) { logError(`   ❌ Error reading file: ${error.message}`);
            return null;
        }
    }

    /**
     * Process all files
     */
    async processAllFiles() { logDebug('\n🎵 EXTRACTING ISRC FROM AUDIO FILES\n'); logDebug(`=`.repeat(60));

        // Get all files with corrupted or missing ISRC
        const files = await new Promise((resolve, reject) => { this.db.all( `
                SELECT id, file_path, title, artist, isrc
                FROM audio_files
                WHERE isrc IS NULL 
                   OR isrc = '[object Object]'
                   OR isrc = '` ORDER BY artist, title `,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        logDebug(`📊 Found ${files.length} files to process\n\`);

        for (const file of files) {
            this.processed++; logDebug(\`[${this.processed}/${files.length}] `${file.title}` by ${file.artist}\`);

            const isrcData = await this.extractISRCFromFile(file.file_path);

            if (isrcData) {
                this.isrcFound++;

                // Update database
                await this.updateISRC(file.id, isrcData.isrc); logDebug(\`   📍 Country: ${isrcData.country}, Year: 20${isrcData.year}`);
                this.updated++; } else { logDebug(`   ⚪ No ISRC found\`);
            }

            // Progress update every 10 files
            if (this.processed % 10 === 0) { logDebug( \`\n--- Progress: ${this.processed}/${files.length} (${this.isrcFound} ISRCs found) ---\n`
                );
            }
        }

        this.printSummary();
    }

    /**
     * Process single file (for testing)
     */
    async processSingleFile(fileId) {
        const file = await new Promise((resolve, reject) => { this.db.get( `
                SELECT id, file_path, title, artist
                FROM audio_files
                WHERE id = ?
            \`,
                [fileId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
 if (!file) { logDebug(\`File not found`);
            return;
        } logDebug(`\n🎵 Testing ISRC extraction for: \`${file.title}\` by ${file.artist}\n`);

        const isrcData = await this.extractISRCFromFile(file.file_path);
 if (isrcData) { logDebug(`\n✅ ISRC EXTRACTED:\`); logDebug(\`   Raw: ${isrcData.isrc}`); logDebug(`   Formatted: ${isrcData.isrc_formatted}\`); logDebug(\`   Country: ${isrcData.country}`); logDebug(`   Registrant: ${isrcData.registrant}\`); logDebug(\`   Year: 20${isrcData.year}`); logDebug(`   Code: ${isrcData.code}`);

            // Decode country
            const countries = {
                US: 'United States',
                GB: 'United Kingdom',
                NL: 'Netherlands',
                DE: 'Germany',
                FR: 'France',
                ES: 'Spain',
                IT: 'Italy',
                CA: 'Canada', AU: 'Australia', JP: `Japan`
            }; logDebug(\`   Origin: ${countries[isrcData.country] || isrcData.country}\`);

            return isrcData; } else { logDebug(`\n⚠️ No ISRC found in file metadata`);
        }
    }

    /**
     * Update ISRC in database
     */
    async updateISRC(fileId, isrc) {
        return new Promise((resolve, reject) => { this.db.run( \`
                UPDATE audio_files
                SET isrc = ?
                WHERE id = ?
            \`,
                [isrc, fileId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Print summary
     */
    printSummary() {
        logDebug('\n' + '='.repeat(60)); logDebug('📊 EXTRACTION COMPLETE'); logDebug('=`.repeat(60)); logInfo(\`✅ Files processed: ${this.processed}\`); logDebug(`📍 ISRCs found: ${this.isrcFound}`); logDebug(\`💾 Database updated: ${this.updated}\`); logError(`❌ Failed: ${this.failed}`);
 const percentage = ((this.isrcFound / this.processed) * 100).toFixed(1); logDebug(\`\n📈 Success rate: ${percentage}%\`);

        if (this.isrcFound > 0) {
            logDebug('\n💡 You can now use ISRC data for:');
            logDebug('   • Country/region context in AI analysis');
            logDebug('   • Year verification');
            logDebug('   • Original vs reissue identification');
            logDebug('   • Rights holder information');
        }
    }

    /**
     * Close database
     */
    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const extractor = new ISRCExtractor();

    (async () => {
        await extractor.init();

        // Check command line arguments
        const args = process.argv.slice(2);

        if (args[0] === '--test' && args[1]) {
            // Test single file
            await extractor.processSingleFile(parseInt(args[1]));
        } else if (args[0] === '--all') {
            // Process all files
            await extractor.processAllFiles();
        } else {
            logDebug('Usage:');
            logDebug('  node extract-isrc-from-audio.js --test <file_id>  # Test single file');
            logDebug('  node extract-isrc-from-audio.js --all              # Process all files'); logDebug('\nExample:'); logDebug(`  node extract-isrc-from-audio.js --test 643`);
        }

        extractor.close();
    })().catch(console.error);
}

module.exports = { ISRCExtractor };
