
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

/**
 * NORMALIZE ERA FIELD
 * Estandariza el campo LLM_ERA para que sea consistente y útil para algoritmos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class EraNormalizer {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;
        this.stats = {
            total: 0,
            normalized: 0,
            unchanged: 0
        };

        // Mapping de valores a décadas estándar
        this.eraMapping = {
            // 1970s
            '1970s': '1970s',
            '70s': '1970s',
            'Late 70s': '1970s',
            'Late 70s Disco': '1970s',

            // 1980s
            '1980s': '1980s',
            '80s': '1980s',
            'Early 80s': '1980s',
            'Mid-80s': '1980s',
            'Late 80s': '1980s',
            '1980s New Wave': '1980s',
            'Early 80s Synthpop': '1980s',
            'Mid-80s Breakbeat/Electro': '1980s',
            'Mid-80s Pop/Synthpop': '1980s',
            'Mid-80s Synthpop': '1980s',
            "Early '80s": '1980s',

            // 1990s
            '1990s': '1990s',
            '90s': '1990s',
            'Early 90s': '1990s',
            'Mid-90s': '1990s',
            'Late 90s': '1990s',
            'Early 90s Latin Pop': '1990s',
            'Mid-90s House': '1990s',
            "Late '90s": '1990s',
            "Late '90s Latin Pop": '1990s',
            'Late 20th Century': '1990s',
            '"Late 20th Century Pop/Dance"': '1990s',

            // 2000s
            '2000s': '2000s',
            '00s': '2000s',
            'Early 2000s': '2000s',
            'Mid-2000s': '2000s',
            'Late 2000s': '2000s',
            'Early 2000s Latin Pop': '2000s',

            // 2010s
            '2010s': '2010s',
            '10s': '2010s',
            'Early 2010s': '2010s',
            'Mid-2010s': '2010s',
            'Late 2010s': '2010s',
            'Mid-2010s tropical house': '2010s',

            // 2020s
            '2020s': '2020s',
            '20s': '2020s',
            'Early 2020s': '2020s',

            // Contemporary (mapear a 2020s si es reciente)
            Contemporary: '2020s',
            Contemporáneo: '2020s',
            Modern: '2020s',

            // Rangos - tomar la década más antigua
            '1980s-1990s': '1980s',
            '1990s-2000s': '1990s',
            '2000s-2010s': '2000s',
            '2010s-2020s': '2010s'
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
     * Normalize a single era value
     */
    normalizeEra(eraValue) {
        if (!eraValue) {
            return null;
        }

        // Remove quotes if present
        const cleaned = eraValue.replace(/^["']|["']$/g, '').trim();

        // Check direct mapping
        if (this.eraMapping[cleaned]) {
            return this.eraMapping[cleaned];
        }

        // Try to extract decade from text
        const decadeMatch = cleaned.match(/\b(19|20)\d0s?\b/i);
        if (decadeMatch) {
            const decade = decadeMatch[0];
            // Normalize to format: 1980s, 1990s, etc.
            if (!decade.endsWith('s')) {
                return decade + 's';
            }
            return decade;
        }

        // Try to extract year and convert to decade
        const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            const year = parseInt(yearMatch[0]);
            const decade = Math.floor(year / 10) * 10;
            return decade + 's';
        }

        // If contains "tropical house" or specific 2010s genres
        if (cleaned.toLowerCase().includes('tropical house')) {
            return '2010s';
        }

        // Default mappings for ambiguous terms
        if (
            cleaned.toLowerCase().includes('modern') ||
            cleaned.toLowerCase().includes('contemporary')
        ) {
            return '2020s';
        }

        // If we can't normalize, return original
        logDebug(`   ⚠️  Could not normalize: \`${eraValue}\``);
        return eraValue;
    }

    /**
     * Get all unique era values
     */
    async getUniqueEras() {
        return new Promise((resolve, reject) => { this.db.all( `SELECT DISTINCT LLM_ERA as era, COUNT(*) as count
                 FROM llm_metadata
                 WHERE LLM_ERA IS NOT NULL
                 GROUP BY LLM_ERA
                 ORDER BY count DESC`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    /**
     * Update era values in database
     */
    async updateEras() { logDebug('\n📊 NORMALIZING ERA VALUES'); logDebug(`=`.repeat(60));

        // Get all unique eras const uniqueEras = await this.getUniqueEras(); logDebug(\`Found ${uniqueEras.length} unique era values\n\`);

        // Create normalization plan
        const updates = [];
        for (const row of uniqueEras) {
            const normalized = this.normalizeEra(row.era);
            if (normalized && normalized !== row.era) {
                updates.push({
                    original: row.era,
                    normalized: normalized,
                    count: row.count
                });
            }
        }
 if (updates.length === 0) { logInfo(`✅ All era values are already normalized!`);
            return;
        } logDebug(\`Will normalize ${updates.length} different era values:\n\`);

        // Show normalization plan
        for (const update of updates) { logDebug( `   `${update.original}\` → \`${update.normalized}` (${update.count} tracks)`);
        } logDebug('\n' + \'-\`.repeat(60)); logDebug(`Applying updates...\n`);

        // Apply updates
        for (const update of updates) {
            await new Promise((resolve, reject) => { this.db.run( \`UPDATE llm_metadata 
                     SET LLM_ERA = ? 
                     WHERE file_id = ?,
                    [update.normalized, update.original],
                    function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            logDebug(
                                \`   ✅ Updated ${this.changes} tracks: `${update.original}` → \`${update.normalized}\``);
                            resolve();
                        }
                    }
                );
            });

            this.stats.normalized += update.count;
        }

        this.stats.total = uniqueEras.reduce((sum, row) => sum + row.count, 0);
        this.stats.unchanged = this.stats.total - this.stats.normalized;
    }

    /**
     * Verify normalization results
     */
    async verifyResults() {
        logDebug('\n✅ VERIFICATION');
        logDebug('-'.repeat(60));

        const normalized = await this.getUniqueEras(); logDebug('\nNormalized era distribution:\`);
        for (const row of normalized) { const bar = \`█`.repeat(Math.floor(row.count / 10)); logDebug(`   ${row.era.padEnd(15)} ${bar} ${row.count} tracks`);
        }

        // Check for valid decades const validDecades = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
        const invalidEras = normalized.filter(row => !validDecades.includes(row.era));

        if (invalidEras.length > 0) { logDebug(`\n⚠️  Some era values could not be normalized:`); for (const row of invalidEras) { logDebug(\`   - \`${row.era}` (${row.count} tracks)`);
            }
        } else {
            logDebug('\n✅ All era values are now valid decades!');
        }

        return normalized;
    }

    /**
     * Fill missing eras based on year or ISRC
     */ async fillMissingEras() { logDebug(\'\n🔍 FILLING MISSING ERAS\`); logDebug(`-`.repeat(60));

        // Get tracks with year but no era
        const tracksWithYear = await new Promise((resolve, reject) => { this.db.all( \`SELECT 
                    lm.file_id,
                    af.year,
                    af.isrc
                 FROM llm_metadata lm
                 JOIN audio_files af ON lm.file_id = af.id
                 WHERE lm.LLM_ERA IS NULL
                   AND (af.year IS NOT NULL OR af.isrc IS NOT NULL)\`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        }); logDebug(`Found ${tracksWithYear.length} tracks without era but with year/ISRC\n`);

        let filled = 0;
        for (const track of tracksWithYear) {
            let decade = null;

            // Try to get decade from year
            if (track.year) {
                const year = parseInt(track.year);
                if (year >= 1970 && year < 2030) {
                    decade = Math.floor(year / 10) * 10 + 's';
                }
            }

            // Try to get from ISRC if no year
            if (!decade && track.isrc && track.isrc.length >= 7) {
                const yearCode = track.isrc.substring(5, 7);
                const year =
                    parseInt(yearCode) > 50 ? 1900 + parseInt(yearCode) : 2000 + parseInt(yearCode);
                if (year >= 1970 && year < 2030) {
                    decade = Math.floor(year / 10) * 10 + 's';
                }
            }

            if (decade) {
                await new Promise((resolve, reject) => {
                    this.db.run(
                        'UPDATE llm_metadata SET LLM_ERA = ? WHERE file_id = ?',
                        [decade, track.file_id],
                        err => {
                            if (err) {
                                reject(err);
                            } else {
                                filled++;
                                resolve();
                            }
                        }
                    );
                });
            }
        }

        logInfo('✅ Filled ${filled} missing era values from year/ISRC data');

        return filled;
    }

    /**
     * Generate final report
     */
    async generateReport() { logDebug(\'\n📊 FINAL REPORT\`); logDebug(`=`.repeat(60)); logDebug(\`\nProcessing Summary:\`); logDebug(`   Total tracks with era: ${this.stats.total}`); logDebug(\`   Normalized: ${this.stats.normalized}\`); logDebug(`   Already correct: ${this.stats.unchanged}`);

        // Get final statistics
        const finalStats = await new Promise((resolve, reject) => { this.db.get( \`SELECT 
                    COUNT(*) as total_tracks,
                    COUNT(LLM_ERA) as tracks_with_era,
                    COUNT(DISTINCT LLM_ERA) as unique_eras
                 FROM llm_metadata\`,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        }); logDebug(`\nFinal Statistics:`); logDebug(\`   Total tracks: ${finalStats.total_tracks}\`); logDebug(`   Tracks with era: ${finalStats.tracks_with_era}`); logDebug( \`   Coverage: ${((finalStats.tracks_with_era / finalStats.total_tracks) * 100).toFixed(1)}%\` ); logDebug(`   Unique era values: ${finalStats.unique_eras}`);
 logDebug('\n✅ Era field is now normalized and ready for algorithms!\');
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const normalizer = new EraNormalizer();

    (async () => {
        await normalizer.init();

        // Normalize existing values
        await normalizer.updateEras();

        // Fill missing values from year/ISRC
        await normalizer.fillMissingEras();

        // Verify results
        await normalizer.verifyResults();

        // Generate report
        await normalizer.generateReport();

        normalizer.close();
 logDebug(\`\n✨ Era normalization complete!\n`);
    })().catch(console.error);
}

module.exports = { EraNormalizer };
