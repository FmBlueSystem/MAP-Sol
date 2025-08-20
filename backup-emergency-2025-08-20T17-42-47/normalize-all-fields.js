/**
 * NORMALIZE ALL LLM FIELDS
 * Estandariza TODOS los campos LLM para consistencia y uso en algoritmos
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class CompleteNormalizer {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;
        this.stats = {
            era: { normalized: 0, filled: 0 },
            mood: { normalized: 0, filled: 0 },
            energy: { normalized: 0, filled: 0 },
            genre: { normalized: 0, filled: 0 },
            language: { normalized: 0, filled: 0 },
            storytelling: { normalized: 0, filled: 0 },
            occasions: { normalized: 0, filled: 0 }
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
     * 1. NORMALIZE ERA FIELD
     */
    async normalizeEra() {
        logDebug('\n📅 NORMALIZING ERA FIELD');
        logDebug('-'.repeat(60));

        const eraMapping = {
            // Standardize to decades
            '1970s': '1970s',
            '70s': '1970s',
            'Late 70s': '1970s',
            '1980s': '1980s',
            '80s': '1980s',
            'Early 80s': '1980s',
            'Mid-80s': '1980s',
            'Late 80s': '1980s',
            '1990s': '1990s',
            '90s': '1990s',
            'Early 90s': '1990s',
            'Mid-90s': '1990s',
            'Late 90s': '1990s',
            '2000s': '2000s',
            '00s': '2000s',
            'Early 2000s': '2000s',
            'Mid-2000s': '2000s',
            '2010s': '2010s',
            '10s': '2010s',
            'Early 2010s': '2010s',
            'Mid-2010s': '2010s',
            '2020s': '2020s',
            '20s': '2020s',
            Contemporary: '2020s',
            Modern: '2020s',
            '1980s-1990s': '1980s',
            '1990s-2000s': '1990s',
            '2000s-2010s': '2000s'
        };

        // Clean up era values
        for (const [original, normalized] of Object.entries(eraMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_ERA = ? 
                 WHERE LOWER(REPLACE(LLM_ERA, ``", "")) LIKE ?`,
                [normalized, `%${original.toLowerCase()}%`]
            );
            if (result.changes > 0) {
                this.stats.era.normalized += result.changes;
                logDebug(`   ✅ "${original}" → "${normalized}`: ${result.changes} tracks`);
            }
        }

        logDebug(`   Total normalized: ${this.stats.era.normalized} tracks`);
    }

    /**
     * 2. NORMALIZE MOOD FIELD
     */
    async normalizeMood() {
        logDebug('\n😊 NORMALIZING MOOD FIELDS');
        logDebug('-'.repeat(60));

        // Standardize mood values
        const moodMapping = {
            // Happy/Positive
            happy: 'Happy',
            joyful: 'Happy',
            alegre: 'Happy',
            feliz: 'Happy',
            uplifting: 'Uplifting',
            optimistic: 'Uplifting',
            positive: 'Uplifting',

            // Sad/Melancholic
            sad: 'Melancholic',
            melancholic: 'Melancholic',
            melancholy: 'Melancholic',
            triste: 'Melancholic',
            nostalgic: 'Nostalgic',
            nostalgia: 'Nostalgic',

            // Energetic
            energetic: 'Energetic',
            energético: 'Energetic',
            upbeat: 'Energetic',
            dynamic: 'Energetic',
            exciting: 'Energetic',

            // Relaxed
            relaxed: 'Relaxed',
            chill: 'Relaxed',
            calm: 'Relaxed',
            peaceful: 'Relaxed',
            tranquil: 'Relaxed',

            // Romantic
            romantic: 'Romantic',
            romántico: 'Romantic',
            love: 'Romantic',
            passionate: 'Romantic',
            sensual: 'Romantic',

            // Dark/Aggressive
            dark: 'Dark',
            aggressive: 'Aggressive',
            angry: 'Aggressive',
            intense: 'Intense',
            powerful: 'Intense',

            // Party/Festive
            party: 'Party',
            festive: 'Party',
            celebration: 'Party',
            festivo: 'Party',
            fun: 'Party`
        };

        // Update AI_MOOD
        for (const [original, normalized] of Object.entries(moodMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET AI_MOOD = ? 
                 WHERE LOWER(AI_MOOD) LIKE ?`,
                [normalized, `%${original}%`]
            );
            if (result.changes > 0) {
                this.stats.mood.normalized += result.changes;
            }
        }

        // Update LLM_LYRICS_MOOD
        for (const [original, normalized] of Object.entries(moodMapping)) {
            await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_LYRICS_MOOD = ? 
                 WHERE LOWER(LLM_LYRICS_MOOD) LIKE ?`,
                [normalized, `%${original}%`]
            );
        }

        logDebug(`   ✅ Normalized ${this.stats.mood.normalized} mood values`);
    }

    /**
     * 3. NORMALIZE ENERGY LEVEL
     */
    async normalizeEnergy() {
        logDebug('\n⚡ NORMALIZING ENERGY LEVELS');
        logDebug('-'.repeat(60));

        const energyMapping = {
            // Standardize to: Very Low, Low, Medium, High, Very High
            'very low': 'Very Low',
            'muy baja': 'Very Low',
            minimal: 'Very Low',
            low: 'Low',
            baja: 'Low',
            calm: 'Low',
            medium: 'Medium',
            medio: 'Medium',
            moderate: 'Medium',
            media: 'Medium',
            high: 'High',
            alta: 'High',
            energetic: 'High',
            'very high': 'Very High',
            'muy alta': 'Very High',
            extreme: 'Very High',
            máxima: 'Very High`
        };

        for (const [original, normalized] of Object.entries(energyMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_ENERGY_LEVEL = ? 
                 WHERE LOWER(LLM_ENERGY_LEVEL) = ?`,
                [normalized, original]
            );
            if (result.changes > 0) {
                this.stats.energy.normalized += result.changes;
                logDebug(`   ✅ "${original}" → "${normalized}`: ${result.changes} tracks`);
            }
        }
    }

    /**
     * 4. NORMALIZE LANGUAGE
     */
    async normalizeLanguage() {
        logDebug('\n🌍 NORMALIZING LANGUAGE FIELD');
        logDebug('-'.repeat(60));

        const languageMapping = {
            english: 'English',
            inglés: 'English',
            en: 'English',
            spanish: 'Spanish',
            español: 'Spanish',
            es: 'Spanish',
            french: 'French',
            français: 'French',
            fr: 'French',
            german: 'German',
            deutsch: 'German',
            de: 'German',
            italian: 'Italian',
            italiano: 'Italian',
            it: 'Italian',
            portuguese: 'Portuguese',
            português: 'Portuguese',
            pt: 'Portuguese',
            instrumental: 'Instrumental',
            none: 'Instrumental',
            'n/a': 'Instrumental',
            unknown: 'Unknown',
            desconocido: 'Unknown',
            '': `Unknown`
        };

        for (const [original, normalized] of Object.entries(languageMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_LYRICS_LANGUAGE = ? 
                 WHERE LOWER(LLM_LYRICS_LANGUAGE) = ? OR LLM_LYRICS_LANGUAGE IS NULL`,
                [normalized, original]
            );
            if (result.changes > 0) {
                this.stats.language.normalized += result.changes;
            }
        }

        logDebug(`   ✅ Normalized ${this.stats.language.normalized} language values`);
    }

    /**
     * 5. NORMALIZE STORYTELLING
     */
    async normalizeStorytelling() {
        logDebug('\n📖 NORMALIZING STORYTELLING FIELD');
        logDebug('-'.repeat(60));

        const storytellingMapping = {
            narrative: 'Narrative',
            story: 'Narrative',
            narrativo: 'Narrative',
            abstract: 'Abstract',
            abstracto: 'Abstract',
            conceptual: 'Abstract',
            personal: 'Personal',
            autobiographical: 'Personal',
            confessional: 'Personal',
            political: 'Political',
            social: 'Political',
            protest: 'Political',
            romantic: 'Romantic',
            love: 'Romantic',
            romántico: 'Romantic',
            party: 'Party',
            celebration: 'Party',
            festivo: 'Party',
            introspective: 'Introspective',
            reflective: 'Introspective',
            unknown: 'Unknown',
            0: 'Unknown',
            '': 'Unknown`
        };

        for (const [original, normalized] of Object.entries(storytellingMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_STORYTELLING = ? 
                 WHERE LOWER(LLM_STORYTELLING) = ? OR LLM_STORYTELLING = '0'`,
                [normalized, original]
            );
            if (result.changes > 0) {
                this.stats.storytelling.normalized += result.changes;
            }
        }

        logDebug(`   ✅ Normalized ${this.stats.storytelling.normalized} storytelling values`);
    }

    /**
     * 6. NORMALIZE OCCASIONS
     */
    async normalizeOccasions() {
        logDebug('\n🎉 NORMALIZING OCCASIONS FIELD');
        logDebug('-'.repeat(60));

        // Parse and standardize occasions (often comma-separated)
        const occasions = await this.getUniqueValues('LLM_OCCASIONS');

        const occasionMapping = {
            party: 'Party',
            fiesta: 'Party',
            celebration: 'Party',
            workout: 'Workout',
            gym: 'Workout',
            exercise: 'Workout',
            running: 'Workout',
            relaxation: 'Relaxation',
            chill: 'Relaxation',
            meditation: 'Relaxation',
            driving: 'Driving',
            'road trip': 'Driving',
            car: 'Driving',
            studying: 'Studying',
            work: 'Work',
            focus: 'Work',
            romantic: 'Romantic',
            date: 'Romantic',
            dinner: 'Romantic',
            dancing: 'Dancing',
            club: 'Dancing',
            disco: 'Dancing',
            morning: 'Morning',
            'wake up': 'Morning',
            night: 'Night',
            evening: 'Night',
            sleep: 'Night'
        };

        // Process each unique occasion value
        for (const occ of occasions) {
            if (!occ.value) {
                continue;
            }

            let normalized = occ.value;

            // Check if it contains any mappable values
            for (const [original, standard] of Object.entries(occasionMapping)) {
                if (occ.value.toLowerCase().includes(original)) {
                    normalized = standard;
                    break;
                }
            }

            if (normalized !== occ.value) {
                const result = await this.runUpdate(
                    'UPDATE llm_metadata SET LLM_OCCASIONS = ? WHERE LLM_OCCASIONS = ?`,
                    [normalized, occ.value]
                );
                if (result.changes > 0) {
                    this.stats.occasions.normalized += result.changes;
                }
            }
        }

        logDebug(`   ✅ Normalized ${this.stats.occasions.normalized} occasion values`);
    }

    /**
     * 7. NORMALIZE GENRE (ensure consistency)
     */
    async normalizeGenre() {
        logDebug('\n🎵 NORMALIZING GENRE FIELD');
        logDebug('-'.repeat(60));

        // Standardize common genre variations
        const genreMapping = {
            'hip hop': 'Hip Hop',
            'hip-hop': 'Hip Hop',
            hiphop: 'Hip Hop',
            'r&b': 'R&B',
            rnb: 'R&B',
            'rhythm and blues': 'R&B',
            'dance/electronic': 'Electronic Dance',
            edm: 'Electronic Dance',
            'rock/pop': 'Pop Rock',
            'pop/rock': 'Pop Rock',
            indie: 'Indie Rock',
            alternative: 'Alternative Rock',
            latino: 'Latin',
            latina: 'Latin',
            'latin pop': 'Latin Pop',
            clásica: 'Classical',
            classic: 'Classical`
        };

        for (const [original, normalized] of Object.entries(genreMapping)) {
            const result = await this.runUpdate(
                `UPDATE llm_metadata 
                 SET LLM_GENRE = ? 
                 WHERE LOWER(LLM_GENRE) = ?`,
                [normalized, original]
            );
            if (result.changes > 0) {
                this.stats.genre.normalized += result.changes;
            }
        }

        logDebug(`   ✅ Normalized ${this.stats.genre.normalized} genre values`);
    }

    /**
     * 8. FILL MISSING VALUES WITH DEFAULTS
     */
    async fillMissingValues() {
        logDebug('\n🔧 FILLING MISSING VALUES WITH DEFAULTS');
        logDebug('-`.repeat(60));

        // Set default language to Unknown where null
        const lang = await this.runUpdate(
            `UPDATE llm_metadata 
             SET LLM_LYRICS_LANGUAGE = 'Unknown' 
             WHERE LLM_LYRICS_LANGUAGE IS NULL OR LLM_LYRICS_LANGUAGE = ''`);
        logDebug(`   ✅ Set ${lang.changes} missing languages to 'Unknown``);

        // Set default storytelling to Unknown where null
        const story = await this.runUpdate(
            `UPDATE llm_metadata 
             SET LLM_STORYTELLING = 'Unknown' 
             WHERE LLM_STORYTELLING IS NULL OR LLM_STORYTELLING = '' OR LLM_STORYTELLING = '0'`);
        logDebug(`   ✅ Set ${story.changes} missing storytelling to 'Unknown``);

        // Fill era from year where possible
        const eraFilled = await this.fillEraFromYear();
        logDebug(`   ✅ Filled ${eraFilled} era values from year/ISRC data`);
    }

    /**
     * Fill era from year or ISRC
     */
    async fillEraFromYear() {
        const tracks = await new Promise((resolve, reject) => {
            this.db.all(
                `SELECT lm.file_id, af.year, af.isrc
                 FROM llm_metadata lm
                 JOIN audio_files af ON lm.file_id = af.id
                 WHERE lm.LLM_ERA IS NULL AND (af.year IS NOT NULL OR af.isrc IS NOT NULL)`,
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        let filled = 0;
        for (const track of tracks) {
            let decade = null;

            // From year
            if (track.year) {
                const year = parseInt(track.year);
                if (year >= 1970 && year < 2030) {
                    decade = Math.floor(year / 10) * 10 + 's';
                }
            }

            // From ISRC
            if (!decade && track.isrc && track.isrc.length >= 7) {
                const yearCode = track.isrc.substring(5, 7);
                const year =
                    parseInt(yearCode) > 50 ? 1900 + parseInt(yearCode) : 2000 + parseInt(yearCode);
                if (year >= 1970 && year < 2030) {
                    decade = Math.floor(year / 10) * 10 + 's';
                }
            }

            if (decade) {
                await this.runUpdate('UPDATE llm_metadata SET LLM_ERA = ? WHERE file_id = ?`, [
                    decade,
                    track.file_id
                ]);
                filled++;
            }
        }

        return filled;
    }

    /**
     * Helper: Run update query
     */
    async runUpdate(sql, params) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    /**
     * Helper: Get unique values for a field
     */
    async getUniqueValues(field) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT DISTINCT ${field} as value, COUNT(*) as count
                 FROM llm_metadata
                 WHERE ${field} IS NOT NULL
                 GROUP BY ${field}`,
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
     * Generate validation report
     */
    async generateReport() {
        logDebug('\n📊 NORMALIZATION REPORT');
        logDebug('='.repeat(60));

        // Get final statistics for each field
        const fields = [
            'LLM_ERA',
            'AI_MOOD',
            'LLM_ENERGY_LEVEL',
            'LLM_LYRICS_LANGUAGE',
            'LLM_STORYTELLING',
            'LLM_OCCASIONS',
            'LLM_GENRE`
        ];

        for (const field of fields) {
            const values = await this.getUniqueValues(field);
            const coverage = await new Promise((resolve, reject) => {
                this.db.get(
                    `SELECT 
                        COUNT(*) as total,
                        COUNT(${field}) as filled,
                        COUNT(DISTINCT ${field}) as unique_values
                     FROM llm_metadata`,
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    }
                );
            });

            logDebug(`\n${field}:`);
            logDebug(
                `   Coverage: ${coverage.filled}/${coverage.total} (${((coverage.filled / coverage.total) * 100).toFixed(1)}%)`
            );
            logDebug(`   Unique values: ${coverage.unique_values}`);

            if (values.length <= 10) {
                logDebug('   Values:`);
                for (const val of values) {
                    logDebug(`      - ${val.value}: ${val.count} tracks`);
                }
            }
        }

        // Summary
        logDebug('\n✅ NORMALIZATION COMPLETE');
        logDebug('-'.repeat(60));
        logDebug('All fields are now standardized and ready for:');
        logDebug('  • Machine learning algorithms');
        logDebug('  • Consistent filtering and grouping');
        logDebug('  • Statistical analysis');
        logDebug('  • Recommendation systems');

        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            fields: {}
        };

        for (const field of fields) {
            const values = await this.getUniqueValues(field);
            report.fields[field] = values;
        }

        await fs.writeFile('normalization-report.json', JSON.stringify(report, null, 2));

        logDebug('\n💾 Report saved to: normalization-report.json');
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const normalizer = new CompleteNormalizer();

    (async () => {
        await normalizer.init();

        logDebug('🔧 COMPLETE FIELD NORMALIZATION');
        logDebug('='.repeat(60));
        logDebug('This will standardize all LLM fields for consistency\n');

        // Run all normalizations
        await normalizer.normalizeEra();
        await normalizer.normalizeMood();
        await normalizer.normalizeEnergy();
        await normalizer.normalizeLanguage();
        await normalizer.normalizeStorytelling();
        await normalizer.normalizeOccasions();
        await normalizer.normalizeGenre();

        // Fill missing values
        await normalizer.fillMissingValues();

        // Generate report
        await normalizer.generateReport();

        normalizer.close();

        logDebug('\n✨ All fields normalized successfully!\n`);
    })().catch(console.error);
}

module.exports = { CompleteNormalizer };
