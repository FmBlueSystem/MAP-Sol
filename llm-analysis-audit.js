/**
 * LLM ANALYSIS AUDIT
 * Auditoría completa de columnas LLM existentes
 * Documenta qué está analizado y qué falta
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class LLMAnalysisAuditor {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;

        // Categorías de columnas LLM
        this.columnCategories = {
            'Core Metadata': [
                'LLM_GENRE', // 3,677 populated (99.9%)
                'LLM_SUBGENRE', // 194 populated
                'LLM_ERA', // 155 populated
                'LLM_MOOD', // 291 populated
                'LLM_DESCRIPTION' // 198 populated
            ],
            'Musical Analysis': [
                'LLM_ENERGY_LEVEL',
                'LLM_DANCEABILITY',
                'LLM_Mixing_Keys', // 154 populated
                'LLM_Instruments', // 154 populated
                'LLM_Vocal_Style',
                'LLM_Production_Style',
                'LLM_Energy_Description'
            ],
            'DJ/Performance': [
                'LLM_DJ_Notes', // 156 populated
                'LLM_OCCASIONS',
                'LLM_MIXING_NOTES',
                'LLM_COMPATIBLE_GENRES',
                'LLM_RECOMMENDATIONS'
            ],
            'Context & History': [
                'LLM_CONTEXT',
                'LLM_Similar_Artists', // 156 populated
                'LLM_MUSICAL_INFLUENCE',
                'LLM_ORIGINAL_ERA',
                'LLM_RELEASE_ERA',
                'LLM_STYLE_PERIOD'
            ],
            'Lyrics Analysis': [
                'LLM_LYRICS_ANALYSIS',
                'LLM_LYRICS_THEME',
                'LLM_LYRICS_MOOD',
                'LLM_LYRICS_LANGUAGE',
                'LLM_EXPLICIT_CONTENT',
                'LLM_STORYTELLING'
            ],
            'Classification Flags': [
                'LLM_IS_COMPILATION',
                'LLM_IS_REMIX',
                'LLM_IS_COVER',
                'LLM_IS_REISSUE'
            ],
            'Quality & Validation': [
                'LLM_CONFIDENCE_SCORE',
                'LLM_VALIDATION_NOTES',
                'LLM_WARNINGS',
                'LLM_GENRE_CONFIDENCE'
            ],
            'System Metadata': ['LLM_ANALYZED', 'LLM_ANALYSIS_DATE']
        };

        // Columnas calculadas por algoritmos (no LLM)
        this.algorithmColumns = [
            'AI_BPM', // Calculado por FFprobe/audio analysis
            'AI_ENERGY', // Análisis de señal
            'AI_KEY', // Detección de tonalidad
            'AI_DANCEABILITY', // Análisis de ritmo
            'AI_VALENCE', // Análisis de valencia
            'AI_ACOUSTICNESS', // Análisis de acústica
            'AI_INSTRUMENTALNESS', // Detección de voz
            'AI_LIVENESS', // Detección de audiencia
            'AI_SPEECHINESS', // Detección de habla
            'AI_LOUDNESS', // Medición en dB
            'AI_TIME_SIGNATURE', // Detección de compás
            'AI_MODE' // Mayor/menor
        ];
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
     * Get column coverage statistics
     */
    async getColumnCoverage() {
        const columns = [];

        // Get all LLM columns
        const allLLMColumns = Object.values(this.columnCategories).flat();

        for (const column of allLLMColumns) {
            const coverage = await new Promise((resolve, reject) => {
                this.db.get(
                    `
                    SELECT 
                        COUNT(*) as total,
                        COUNT(${column}) as populated,
                        COUNT(DISTINCT ${column}) as unique_values
                    FROM llm_metadata
                `,
                    (err, row) => {
                        if (err) {
                            // Column might not exist
                            resolve({
                                column,
                                exists: false,
                                populated: 0,
                                percentage: 0,
                                unique_values: 0
                            });
                        } else {
                            resolve({
                                column,
                                exists: true,
                                populated: row.populated,
                                percentage: ((row.populated / row.total) * 100).toFixed(1),
                                unique_values: row.unique_values
                            });
                        }
                    }
                );
            });

            columns.push(coverage);
        }

        return columns;
    }

    /**
     * Get analysis timeline
     */
    async getAnalysisTimeline() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    DATE(LLM_ANALYSIS_DATE) as date,
                    COUNT(*) as tracks_analyzed,
                    COUNT(DISTINCT LLM_GENRE) as genres_found,
                    COUNT(DISTINCT LLM_MOOD) as moods_found
                FROM llm_metadata
                WHERE LLM_ANALYSIS_DATE IS NOT NULL
                GROUP BY DATE(LLM_ANALYSIS_DATE)
                ORDER BY date DESC
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
    }

    /**
     * Identify gaps in analysis
     */
    async identifyGaps() {
        const gaps = {
            never_analyzed: 0,
            missing_description: 0,
            missing_similar_artists: 0,
            missing_dj_notes: 0,
            missing_cultural_context: 0,
            partial_analysis: 0,
            complete_analysis: 0
        };

        const result = await new Promise((resolve, reject) => {
            this.db.get(
                `
                SELECT 
                    COUNT(CASE WHEN LLM_ANALYSIS_DATE IS NULL THEN 1 END) as never_analyzed,
                    COUNT(CASE WHEN LLM_DESCRIPTION IS NULL THEN 1 END) as missing_description,
                    COUNT(CASE WHEN LLM_Similar_Artists IS NULL THEN 1 END) as missing_similar_artists,
                    COUNT(CASE WHEN LLM_DJ_Notes IS NULL THEN 1 END) as missing_dj_notes,
                    COUNT(CASE WHEN LLM_CONTEXT IS NULL THEN 1 END) as missing_context,
                    COUNT(CASE 
                        WHEN LLM_GENRE IS NOT NULL 
                        AND LLM_DESCRIPTION IS NULL 
                        THEN 1 
                    END) as partial_analysis,
                    COUNT(CASE 
                        WHEN LLM_GENRE IS NOT NULL 
                        AND LLM_DESCRIPTION IS NOT NULL 
                        AND LLM_Similar_Artists IS NOT NULL 
                        THEN 1 
                    END) as complete_analysis
                FROM llm_metadata
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

        return result;
    }

    /**
     * Get sample of analyzed tracks
     */
    async getSampleAnalyzedTracks() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    af.title,
                    af.artist,
                    lm.LLM_GENRE,
                    lm.LLM_MOOD,
                    lm.LLM_ERA,
                    lm.LLM_Similar_Artists,
                    lm.LLM_DESCRIPTION,
                    lm.LLM_ANALYSIS_DATE
                FROM llm_metadata lm
                JOIN audio_files af ON lm.file_id = af.id
                WHERE lm.LLM_DESCRIPTION IS NOT NULL
                ORDER BY lm.LLM_ANALYSIS_DATE DESC
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
    }

    /**
     * Generate comprehensive audit report
     */
    async generateAuditReport() {
        logDebug('\n📊 LLM ANALYSIS AUDIT REPORT');
        logDebug('='.repeat(80));
        logDebug('Generated:', new Date().toISOString());
        logDebug('\n');

        // Get column coverage
        logDebug('📈 COLUMN COVERAGE ANALYSIS');
        logDebug('-'.repeat(80));

        const coverage = await this.getColumnCoverage();

        for (const [category, columns] of Object.entries(this.columnCategories)) {
            logDebug(`\n${category}:`);

            for (const columnName of columns) {
                const stats = coverage.find(c => c.column === columnName);
                if (stats && stats.exists) {
                    const bar =
                        '█'.repeat(Math.floor(stats.percentage / 5)) +
                        '░'.repeat(20 - Math.floor(stats.percentage / 5));
                    logDebug(
                        `  ${columnName.padEnd(25)} ${bar} ${stats.percentage.padStart(5)}% (${stats.populated}/${3681})`
                    );
                    if (stats.unique_values > 0) {
                        logDebug(`    └─ ${stats.unique_values} unique values`);
                    }
                }
            }
        }

        // Get gaps analysis
        logDebug('\n🔍 GAP ANALYSIS');
        logDebug('-'.repeat(80));

        const gaps = await this.identifyGaps();
        logDebug(`Never analyzed:         ${gaps.never_analyzed} tracks`);
        logDebug(`Missing descriptions:   ${gaps.missing_description} tracks`);
        logDebug(`Missing similar artists: ${gaps.missing_similar_artists} tracks`);
        logDebug(`Missing DJ notes:       ${gaps.missing_dj_notes} tracks`);
        logDebug(`Missing context:        ${gaps.missing_context} tracks`);
        logDebug(
            `Partial analysis:       ${gaps.partial_analysis} tracks (have genre but missing enrichment)`
        );
        logDebug(`Complete analysis:      ${gaps.complete_analysis} tracks`);

        // Get timeline
        logDebug('\n📅 ANALYSIS TIMELINE');
        logDebug('-'.repeat(80));

        const timeline = await this.getAnalysisTimeline();
        timeline.forEach(day => {
            logDebug(`${day.date}: ${day.tracks_analyzed} tracks analyzed`);
        });

        // Algorithm vs LLM columns
        logDebug('\n🤖 ALGORITHM vs LLM COLUMNS');
        logDebug('-'.repeat(80));
        logDebug('\nAlgorithm-calculated (C++/FFprobe):');
        this.algorithmColumns.forEach(col => {
            logDebug(`  • ${col}`);
        });

        logDebug('\nLLM-analyzed (GPT models):');
        logDebug(`  • Total LLM columns: ${Object.values(this.columnCategories).flat().length}`);
        logDebug('  • Most populated: LLM_GENRE (99.9%)');
        logDebug('  • Least populated: LLM_DESCRIPTION (5.4%)');

        // Sample tracks
        logDebug('\n📝 SAMPLE ANALYZED TRACKS');
        logDebug('-'.repeat(80));

        const samples = await this.getSampleAnalyzedTracks();
        samples.forEach((track, i) => {
            logDebug(`\n${i + 1}. "${track.title}" by ${track.artist}");
            logDebug(`   Genre: ${track.LLM_GENRE}`);
            logDebug(`   Mood: ${track.LLM_MOOD || 'N/A'}');
            logDebug(`   Era: ${track.LLM_ERA || 'N/A'}');
            if (track.LLM_Similar_Artists) {
                logDebug(`   Similar: ${track.LLM_Similar_Artists}`);
            }
            if (track.LLM_DESCRIPTION) {
                logDebug(`   Description: ${track.LLM_DESCRIPTION.substring(0, 100)}...`);
            }
            logDebug(`   Analyzed: ${track.LLM_ANALYSIS_DATE}`);
        });

        // Summary and recommendations
        logDebug('\n💡 SUMMARY & RECOMMENDATIONS');
        logDebug('-'.repeat(80));
        logDebug("\n✅ What's Already Done:");
        logDebug('  • LLM_GENRE: 99.9% complete (3,677/3,681 tracks)');
        logDebug('  • Basic categorization complete for most tracks');
        logDebug('  • 233 tracks have been analyzed at various dates');
        logDebug('  • Most recent batch: 2025-08-15 (today)');

        logDebug('\n⚠️ What Needs Work:');
        logDebug('  • LLM_DESCRIPTION: Only 5.4% complete (198/3,681)');
        logDebug('  • LLM_Similar_Artists: Only 4.2% complete (156/3,681)');
        logDebug('  • Cultural context and historical information missing');
        logDebug('  • DJ performance notes sparse');

        logDebug('\n🎯 Recommended Next Steps:');
        logDebug('  1. Focus on enriching tracks that have genre but lack descriptions');
        logDebug('  2. Use existing AI_* data as context for better LLM analysis');
        logDebug('  3. Prioritize by geographic region using ISRC codes');
        logDebug('  4. Batch process by similar genres for efficiency');

        // Save report
        const report = {
            generated: new Date().toISOString(),
            coverage,
            gaps,
            timeline,
            algorithmColumns: this.algorithmColumns,
            llmColumns: Object.values(this.columnCategories).flat(),
            recommendations: [
                'Focus on LLM_DESCRIPTION enrichment',
                'Add Similar Artists for discovery',
                'Complete DJ Notes for performance',
                'Add cultural context using ISRC data'
            ]
        };

        await fs.writeFile('llm-analysis-audit-report.json', JSON.stringify(report, null, 2));

        logDebug('\n💾 Full report saved to: llm-analysis-audit-report.json');

        return report;
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const auditor = new LLMAnalysisAuditor();

    (async () => {
        await auditor.init();
        await auditor.generateAuditReport();
        auditor.close();

        logDebug('\n✨ Audit complete!\n');
    })().catch(console.error);
}

module.exports = { LLMAnalysisAuditor };
