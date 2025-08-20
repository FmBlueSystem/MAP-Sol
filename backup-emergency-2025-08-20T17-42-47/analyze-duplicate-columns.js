/**
 * ANALYZE DUPLICATE AND REDUNDANT COLUMNS
 * Identifica columnas LLM duplicadas o que representan lo mismo
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DuplicateColumnAnalyzer {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;

        // Grupos de columnas que parecen duplicadas o relacionadas
        this.suspectedDuplicates = {
            'Genre Related': [
                'genre', // En audio_files
                'LLM_GENRE', // Género principal LLM
                'LLM_SUBGENRE', // Subgénero singular
                'LLM_SUBGENRES', // Subgéneros plural
                'subgenre', // Campo legacy
                'AI_SUBGENRES', // Subgéneros AI
                'LLM_COMPATIBLE_GENRES' // Géneros compatibles
            ],
            'Mood Related': [
                'mood', // Campo simple
                'AI_MOOD', // Mood calculado
                'LLM_MOOD', // Mood LLM
                'LLM_LYRICS_MOOD', // Mood de letras
                'AI_VALENCE' // Valencia (mood positivo/negativo)
            ],
            'Energy Related': [
                'energy', // Campo integer
                'AI_ENERGY', // Energía calculada
                'LLM_ENERGY_LEVEL', // Nivel de energía LLM
                'LLM_Energy_Description' // Descripción de energía
            ],
            'BPM Related': [
                'AI_BPM', // BPM calculado
                'bpm_llm' // BPM por LLM
            ],
            'Danceability Related': [
                'danceability', // Campo simple
                'AI_DANCEABILITY', // Calculado
                'LLM_DANCEABILITY' // LLM
            ],
            'Era/Period Related': [
                'era', // Campo simple
                'AI_ERA', // Era AI
                'LLM_ERA', // Era LLM
                'LLM_ORIGINAL_ERA', // Era original
                'LLM_RELEASE_ERA', // Era de lanzamiento
                'LLM_STYLE_PERIOD' // Período de estilo
            ],
            'Context Related': [
                'AI_CULTURAL_CONTEXT', // Contexto cultural AI
                'LLM_CONTEXT', // Contexto LLM
                'AI_CHARACTERISTICS', // Características AI
                'characteristics' // Características simple
            ],
            'Occasion Related': [
                'occasion', // Simple
                'AI_OCCASION', // AI
                'LLM_OCCASIONS' // LLM plural
            ],
            'Analysis Flags': [
                'AI_ANALYZED', // Flag AI
                'LLM_ANALYZED', // Flag LLM
                'analyzed_by' // Quién analizó
            ],
            'Valence Related': [
                'valence', // Simple
                'AI_VALENCE' // AI calculado
            ]
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
     * Get all columns from llm_metadata table
     */
    async getAllColumns() {
        return new Promise((resolve, reject) => {
            this.db.all('PRAGMA table_info(llm_metadata)', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const columns = rows.map(r => r.name);
                    resolve(columns);
                }
            });
        });
    }

    /**
     * Check data population for each column
     */
    async checkColumnPopulation(column) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT 
                    COUNT(*) as total,
                    COUNT(${column}) as populated,
                    COUNT(DISTINCT ${column}) as unique_values
                FROM llm_metadata`,
                (err, row) => {
                    if (err) {
                        resolve({ error: err.message });
                    } else {
                        resolve({
                            column,
                            populated: row.populated,
                            percentage: ((row.populated / row.total) * 100).toFixed(1),
                            unique_values: row.unique_values
                        });
                    }
                }
            );
        });
    }

    /**
     * Compare similar columns to find redundancy
     */
    async compareSimilarColumns(columns) {
        const results = [];

        for (const column of columns) {
            const stats = await this.checkColumnPopulation(column);
            if (!stats.error) {
                results.push(stats);
            }
        }

        return results;
    }

    /**
     * Analyze all duplicate groups
     */
    async analyzeDuplicates() {
        logDebug('\n🔍 ANALYZING DUPLICATE AND REDUNDANT COLUMNS');
        logDebug('=`.repeat(70));

        const allColumns = await this.getAllColumns();
        logDebug(`\nTotal columns in llm_metadata: ${allColumns.length}\n`);

        const duplicateReport = [];

        for (const [groupName, columns] of Object.entries(this.suspectedDuplicates)) {
            logDebug(`\n📊 ${groupName}`);
            logDebug('-'.repeat(70));

            // Filter columns that actually exist
            const existingColumns = columns.filter(col => allColumns.includes(col));

            if (existingColumns.length === 0) {
                logDebug('   No columns from this group exist in the table');
                continue;
            }

            const stats = await this.compareSimilarColumns(existingColumns);

            // Create comparison table
            logDebug('\n   Column Name                  | Populated | % Full | Unique Values');
            logDebug('   ' + '-'.repeat(65));

            let hasRedundancy = false;
            const groupData = [];

            for (const stat of stats) {
                const bar =
                    '█'.repeat(Math.floor(parseFloat(stat.percentage) / 10)) +
                    '░`.repeat(10 - Math.floor(parseFloat(stat.percentage) / 10));

                logDebug(
                    `   ${stat.column.padEnd(28)} | ${stat.populated.toString().padStart(9)} | ${bar} ${stat.percentage.padStart(5)}% | ${stat.unique_values}`
                );

                groupData.push(stat);

                // Check for redundancy
                if (parseFloat(stat.percentage) > 0) {
                    hasRedundancy = true;
                }
            }

            // Analyze redundancy
            if (hasRedundancy && existingColumns.length > 1) {
                logDebug('\n   ⚠️  REDUNDANCY DETECTED:`);

                // Find which columns have data
                const populatedColumns = stats.filter(s => parseFloat(s.percentage) > 0);

                if (populatedColumns.length > 1) {
                    logDebug(`   - ${populatedColumns.length} columns storing similar data`);
                    logDebug('   - Recommended: Consolidate into single column`);

                    // Suggest which to keep
                    const best = populatedColumns.sort(
                        (a, b) => parseFloat(b.percentage) - parseFloat(a.percentage)
                    )[0];

                    logDebug(`   - Keep: ${best.column} (${best.percentage}% populated)`);

                    duplicateReport.push({
                        group: groupName,
                        columns: existingColumns,
                        populated: populatedColumns.map(c => c.column),
                        recommendation: `Keep ${best.column}, migrate/remove others`
                    });
                }
            }
        }

        // Check for additional patterns
        logDebug('\n\n📋 ADDITIONAL DUPLICATE PATTERNS FOUND');
        logDebug('='.repeat(70));

        // Find columns with same prefixes
        const prefixGroups = {};

        for (const col of allColumns) {
            // Skip system columns
            if (col === 'id' || col === 'file_id`) {
                continue;
            }

            // Extract prefix (before first underscore after initial prefix)
            const match = col.match(/^(AI_|LLM_|LYRICS_)?(.+?)(_|$)/);
            if (match) {
                const baseName = match[2];
                if (!prefixGroups[baseName]) {
                    prefixGroups[baseName] = [];
                }
                prefixGroups[baseName].push(col);
            }
        }

        // Report groups with multiple columns
        for (const [baseName, cols] of Object.entries(prefixGroups)) {
            if (cols.length > 1) {
                logDebug(`\n${baseName}: ${cols.join(`, ')}');
            }
        }

        return duplicateReport;
    }

    /**
     * Generate consolidation recommendations
     */
    async generateRecommendations() {
        logDebug('\n\n💡 CONSOLIDATION RECOMMENDATIONS');
        logDebug('='.repeat(70));

        const recommendations = [
            {
                action: 'MERGE',
                columns: ['LLM_GENRE', 'genre'],
                target: 'LLM_GENRE',
                reason: 'LLM_GENRE has 99.9% coverage, genre is in different table'
            },
            {
                action: 'REMOVE',
                columns: ['LLM_SUBGENRE'],
                reason: 'Redundant with LLM_SUBGENRES (plural) which is more complete'
            },
            {
                action: 'MERGE',
                columns: ['AI_MOOD', 'LLM_MOOD', 'mood'],
                target: 'AI_MOOD',
                reason: 'AI_MOOD is calculated, others mostly empty'
            },
            {
                action: 'MERGE',
                columns: ['AI_ENERGY', 'energy', 'LLM_ENERGY_LEVEL'],
                target: 'AI_ENERGY',
                reason: 'AI_ENERGY is calculated (0-1 scale), others redundant'
            },
            {
                action: 'KEEP_SINGLE',
                columns: ['AI_BPM', 'bpm_llm'],
                target: 'AI_BPM',
                reason: 'AI_BPM from audio analysis is more accurate'
            },
            {
                action: 'REMOVE',
                columns: ['LLM_ORIGINAL_ERA', 'LLM_RELEASE_ERA'],
                reason: 'Legacy fields with 0% usage, covered by LLM_ERA'
            },
            {
                action: 'MERGE',
                columns: ['AI_CULTURAL_CONTEXT', 'LLM_CONTEXT'],
                target: 'LLM_CONTEXT',
                reason: 'Both store cultural context, consolidate to one'
            },
            {
                action: 'KEEP_BOTH',
                columns: ['AI_ANALYZED', 'LLM_ANALYZED'],
                reason: 'Track different analysis types (audio vs text)'
            }
        ];

        logDebug(`\nRecommended Schema Changes:\n`);

        for (const rec of recommendations) {
            logDebug(`${rec.action}: ${rec.columns.join(`, `)}`);
            if (rec.target) {
                logDebug(`   → Keep: ${rec.target}`);
            }
            logDebug(`   Reason: ${rec.reason}\n`);
        }

        // Calculate potential space savings
        const columnsToRemove = recommendations
            .filter(r => r.action === 'REMOVE' || r.action === 'MERGE')
            .flatMap(r => r.columns.filter(c => c !== r.target));

        logDebug('\n📉 POTENTIAL OPTIMIZATION:`);
        logDebug(`   - Columns to remove/merge: ${columnsToRemove.length}`);
        logDebug('   - Current total columns: 92`);
        logDebug(`   - After optimization: ~${92 - columnsToRemove.length} columns`);
        logDebug(`   - Reduction: ${((columnsToRemove.length / 92) * 100).toFixed(1)}%`);

        return recommendations;
    }

    /**
     * Check for naming inconsistencies
     */
    async checkNamingInconsistencies() {
        logDebug('\n\n🏷️ NAMING INCONSISTENCIES');
        logDebug('='.repeat(70));

        const allColumns = await this.getAllColumns();

        const inconsistencies = {
            'Mixed Case': [],
            'Underscore vs CamelCase': [],
            'Prefix Inconsistency': []
        };

        for (const col of allColumns) {
            // Check mixed case (some use LLM_Similar_Artists vs LLM_GENRE)
            if (col.includes('_') && /[A-Z]/.test(col.split('_').slice(1).join('_'))) {
                inconsistencies['Mixed Case'].push(col);
            }

            // Check prefix consistency
            if (col.startsWith('LLM_') || col.startsWith('AI_')) {
                const afterPrefix = col.substring(col.indexOf('_') + 1);
                if (afterPrefix.includes('_') && /[A-Z]/.test(afterPrefix)) {
                    inconsistencies['Underscore vs CamelCase`].push(col);
                }
            }
        }

        for (const [issue, columns] of Object.entries(inconsistencies)) {
            if (columns.length > 0) {
                logDebug(`\n${issue}:`);
                columns.forEach(col => logDebug(`   - ${col}`));
            }
        }

        logDebug('\n📝 Naming Convention Recommendation:');
        logDebug('   Use consistent UPPER_SNAKE_CASE for all columns');
        logDebug('   Example: LLM_SIMILAR_ARTISTS instead of LLM_Similar_Artists');
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const analyzer = new DuplicateColumnAnalyzer();

    (async () => {
        await analyzer.init();

        // Analyze duplicates
        const duplicates = await analyzer.analyzeDuplicates();

        // Generate recommendations
        await analyzer.generateRecommendations();

        // Check naming inconsistencies
        await analyzer.checkNamingInconsistencies();

        analyzer.close();

        logDebug('\n\n✨ Analysis complete!\n`);
    })().catch(console.error);
}

module.exports = { DuplicateColumnAnalyzer };
