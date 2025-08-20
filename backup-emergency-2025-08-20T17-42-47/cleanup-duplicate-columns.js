/**
 * CLEANUP DUPLICATE COLUMNS
 * Script para limpiar y consolidar columnas duplicadas en la base de datos
 * IMPORTANTE: Hace backup antes de cualquier cambio
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseCleaner {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.backupPath = path.join(__dirname, `music_analyzer_backup_${Date.now()}.db`);
        this.db = null;
        this.changes = [];
        this.stats = {
            columnsRemoved: 0,
            columnsRenamed: 0,
            dataConsolidated: 0,
            totalColumns: 0
        };
    }

    async init() {
        logDebug('🔧 DATABASE CLEANUP TOOL');
        logDebug('='.repeat(70));
        logDebug('This will clean duplicate columns and standardize naming\n');

        // Create backup first
        await this.createBackup();

        // Connect to database
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
     * Create database backup
     */
    async createBackup() {
        logDebug('📦 Creating backup...');

        try {
            const data = await fs.readFile(this.dbPath);
            await fs.writeFile(this.backupPath, data);
            logInfo('✅ Backup created: ${this.backupPath}\n');
        } catch (error) {
            logError('❌ Backup failed:', error);
            throw error;
        }
    }

    /**
     * Step 1: Consolidate data from duplicate columns
     */
    async consolidateData() {
        logDebug('\n📊 STEP 1: CONSOLIDATING DATA FROM DUPLICATES');
        logDebug('-'.repeat(70));

        const consolidations = [
            // Mood consolidation
            {
                target: 'AI_MOOD',
                sources: ['LLM_MOOD', 'mood'],
                description: 'Consolidating mood data'
            },
            // Energy consolidation
            {
                target: 'AI_ENERGY',
                sources: ['energy'],
                description: 'Consolidating energy data'
            },
            // Era consolidation
            {
                target: 'LLM_ERA',
                sources: ['AI_ERA', 'era', 'LLM_ORIGINAL_ERA', 'LLM_RELEASE_ERA'],
                description: 'Consolidating era data'
            },
            // Context consolidation
            {
                target: 'LLM_CONTEXT',
                sources: ['AI_CULTURAL_CONTEXT'],
                description: 'Consolidating cultural context'
            },
            // Subgenres consolidation
            {
                target: 'LLM_SUBGENRES',
                sources: ['LLM_SUBGENRE', 'AI_SUBGENRES', 'subgenre'],
                description: 'Consolidating subgenres'
            },
            // Occasion consolidation
            {
                target: 'LLM_OCCASIONS',
                sources: ['AI_OCCASION', 'occasion'],
                description: 'Consolidating occasions'
            },
            // Danceability consolidation
            {
                target: 'AI_DANCEABILITY',
                sources: ['LLM_DANCEABILITY', 'danceability'],
                description: 'Consolidating danceability'
            },
            // Valence consolidation
            {
                target: 'AI_VALENCE',
                sources: ['valence'],
                description: `Consolidating valence`
            }
        ];

        for (const consolidation of consolidations) {
            logDebug(`\n${consolidation.description}:`);
            logDebug(`  Target: ${consolidation.target}`);
            logDebug(`  Sources: ${consolidation.sources.join(`, `)}`);

            for (const source of consolidation.sources) {
                // Check if source column exists
                const exists = await this.columnExists(source);
                if (!exists) {
                    logDebug(`  ⚠️  ${source} doesn`t exist, skipping`);
                    continue;
                }

                // Copy non-null data from source to target where target is null
                const sql = `
                    UPDATE llm_metadata 
                    SET ${consolidation.target} = (
                        SELECT ${source} 
                        FROM llm_metadata AS source 
                        WHERE source.file_id = llm_metadata.file_id 
                        AND source.${source} IS NOT NULL
                    )
                    WHERE ${consolidation.target} IS NULL
                    AND EXISTS (
                        SELECT 1 
                        FROM llm_metadata AS source 
                        WHERE source.file_id = llm_metadata.file_id 
                        AND source.${source} IS NOT NULL
                    )
                `;

                try {
                    const result = await this.runQuery(sql);
                    if (result.changes > 0) {
                        logDebug(`  ✅ Copied ${result.changes} values from ${source}`);
                        this.stats.dataConsolidated += result.changes;
                    } else {
                        logDebug(`  ℹ️  No new data to copy from ${source}`);
                    }
                } catch (error) {
                    logDebug(`  ⚠️  Could not consolidate from ${source}: ${error.message}`);
                }
            }
        }

        logDebug(`\n✅ Total data records consolidated: ${this.stats.dataConsolidated}`);
    }

    /**
     * Step 2: Create new schema with standardized names
     */
    async createCleanSchema() {
        logDebug('\n📐 STEP 2: CREATING CLEAN SCHEMA');
        logDebug('-`.repeat(70));

        // Define the clean schema with proper naming
        const cleanSchema = `
            CREATE TABLE IF NOT EXISTS llm_metadata_clean (
                id INTEGER PRIMARY KEY,
                file_id INTEGER UNIQUE NOT NULL,
                
                -- Core Analysis Flags
                AI_ANALYZED BOOLEAN DEFAULT 0,
                LLM_ANALYZED BOOLEAN DEFAULT 0,
                AI_ANALYZED_DATE TEXT,
                LLM_ANALYSIS_DATE TEXT,
                
                -- Audio Analysis (AI calculated)
                AI_BPM REAL,
                AI_ENERGY REAL,
                AI_KEY TEXT,
                AI_MODE TEXT,
                AI_TIME_SIGNATURE INTEGER,
                AI_DANCEABILITY REAL,
                AI_VALENCE REAL,
                AI_ACOUSTICNESS REAL,
                AI_INSTRUMENTALNESS REAL,
                AI_LIVENESS REAL,
                AI_SPEECHINESS REAL,
                AI_LOUDNESS REAL,
                AI_MOOD TEXT,
                AI_CONFIDENCE REAL,
                
                -- LLM Analysis
                LLM_GENRE TEXT,
                LLM_SUBGENRES TEXT,
                LLM_ERA TEXT,
                LLM_STYLE_PERIOD TEXT,
                LLM_DESCRIPTION TEXT,
                LLM_CONTEXT TEXT,
                LLM_ENERGY_LEVEL TEXT,
                LLM_OCCASIONS TEXT,
                
                -- Lyrics Analysis
                LLM_LYRICS_ANALYSIS TEXT,
                LLM_LYRICS_THEME TEXT,
                LLM_LYRICS_MOOD TEXT,
                LLM_LYRICS_LANGUAGE TEXT,
                LLM_EXPLICIT_CONTENT BOOLEAN DEFAULT 0,
                LLM_STORYTELLING TEXT,
                
                -- DJ & Performance
                LLM_DJ_NOTES TEXT,
                LLM_MIXING_NOTES TEXT,
                LLM_MIXING_KEYS TEXT,
                LLM_COMPATIBLE_GENRES TEXT,
                
                -- Production & Style
                LLM_PRODUCTION_STYLE TEXT,
                LLM_INSTRUMENTS TEXT,
                LLM_VOCAL_STYLE TEXT,
                LLM_ENERGY_DESCRIPTION TEXT,
                
                -- Relationships & Recommendations
                LLM_SIMILAR_ARTISTS TEXT,
                LLM_RECOMMENDATIONS TEXT,
                LLM_MUSICAL_INFLUENCE TEXT,
                
                -- Classification Flags
                LLM_IS_COMPILATION BOOLEAN DEFAULT 0,
                LLM_IS_REMIX BOOLEAN DEFAULT 0,
                LLM_IS_COVER BOOLEAN DEFAULT 0,
                LLM_IS_LIVE BOOLEAN DEFAULT 0,
                
                -- Quality & Validation
                LLM_CONFIDENCE_SCORE REAL,
                LLM_VALIDATION_NOTES TEXT,
                LLM_WARNINGS TEXT,
                
                -- System Metadata
                llm_version TEXT,
                analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (file_id) REFERENCES audio_files(id)
            )
        `;

        try {
            await this.runQuery('DROP TABLE IF EXISTS llm_metadata_clean');
            await this.runQuery(cleanSchema);
            logInfo('✅ Clean schema created');

            // Create indexes
            const indexes = [
                'CREATE INDEX idx_clean_file_id ON llm_metadata_clean(file_id)',
                'CREATE INDEX idx_clean_genre ON llm_metadata_clean(LLM_GENRE)',
                'CREATE INDEX idx_clean_era ON llm_metadata_clean(LLM_ERA)',
                'CREATE INDEX idx_clean_mood ON llm_metadata_clean(AI_MOOD)',
                'CREATE INDEX idx_clean_energy ON llm_metadata_clean(AI_ENERGY)',
                'CREATE INDEX idx_clean_bpm ON llm_metadata_clean(AI_BPM)'
            ];

            for (const index of indexes) {
                await this.runQuery(index);
            }
            logInfo('✅ Indexes created');
        } catch (error) {
            logError('❌ Schema creation failed:', error);
            throw error;
        }
    }

    /**
     * Step 3: Migrate data to clean schema
     */
    async migrateData() {
        logDebug('\n📦 STEP 3: MIGRATING DATA TO CLEAN SCHEMA');
        logDebug('-`.repeat(70));

        const migrationSQL = `
            INSERT INTO llm_metadata_clean (
                file_id,
                -- Analysis Flags
                AI_ANALYZED,
                LLM_ANALYZED,
                AI_ANALYZED_DATE,
                LLM_ANALYSIS_DATE,
                -- Audio Analysis
                AI_BPM,
                AI_ENERGY,
                AI_KEY,
                AI_MODE,
                AI_TIME_SIGNATURE,
                AI_DANCEABILITY,
                AI_VALENCE,
                AI_ACOUSTICNESS,
                AI_INSTRUMENTALNESS,
                AI_LIVENESS,
                AI_SPEECHINESS,
                AI_LOUDNESS,
                AI_MOOD,
                AI_CONFIDENCE,
                -- LLM Analysis
                LLM_GENRE,
                LLM_SUBGENRES,
                LLM_ERA,
                LLM_STYLE_PERIOD,
                LLM_DESCRIPTION,
                LLM_CONTEXT,
                LLM_ENERGY_LEVEL,
                LLM_OCCASIONS,
                -- Lyrics
                LLM_LYRICS_ANALYSIS,
                LLM_LYRICS_THEME,
                LLM_LYRICS_MOOD,
                LLM_LYRICS_LANGUAGE,
                LLM_EXPLICIT_CONTENT,
                LLM_STORYTELLING,
                -- DJ & Performance
                LLM_DJ_NOTES,
                LLM_MIXING_NOTES,
                LLM_MIXING_KEYS,
                LLM_COMPATIBLE_GENRES,
                -- Production
                LLM_PRODUCTION_STYLE,
                LLM_INSTRUMENTS,
                LLM_VOCAL_STYLE,
                LLM_ENERGY_DESCRIPTION,
                -- Relationships
                LLM_SIMILAR_ARTISTS,
                LLM_RECOMMENDATIONS,
                LLM_MUSICAL_INFLUENCE,
                -- Classification
                LLM_IS_COMPILATION,
                LLM_IS_REMIX,
                LLM_IS_COVER,
                -- Validation
                LLM_CONFIDENCE_SCORE,
                LLM_VALIDATION_NOTES,
                LLM_WARNINGS,
                -- System
                llm_version
            )
            SELECT 
                file_id,
                -- Analysis Flags
                AI_ANALYZED,
                LLM_ANALYZED,
                AI_ANALYZED_DATE,
                LLM_ANALYSIS_DATE,
                -- Audio Analysis
                AI_BPM,
                AI_ENERGY,
                AI_KEY,
                AI_MODE,
                AI_TIME_SIGNATURE,
                AI_DANCEABILITY,
                AI_VALENCE,
                AI_ACOUSTICNESS,
                AI_INSTRUMENTALNESS,
                AI_LIVENESS,
                AI_SPEECHINESS,
                AI_LOUDNESS,
                AI_MOOD,
                AI_CONFIDENCE,
                -- LLM Analysis
                LLM_GENRE,
                COALESCE(LLM_SUBGENRES, AI_SUBGENRES),
                COALESCE(LLM_ERA, AI_ERA),
                LLM_STYLE_PERIOD,
                LLM_DESCRIPTION,
                COALESCE(LLM_CONTEXT, AI_CULTURAL_CONTEXT),
                LLM_ENERGY_LEVEL,
                COALESCE(LLM_OCCASIONS, AI_OCCASION),
                -- Lyrics
                LLM_LYRICS_ANALYSIS,
                LLM_LYRICS_THEME,
                LLM_LYRICS_MOOD,
                LLM_LYRICS_LANGUAGE,
                LLM_EXPLICIT_CONTENT,
                LLM_STORYTELLING,
                -- DJ & Performance (fix naming)
                LLM_DJ_Notes,
                LLM_MIXING_NOTES,
                LLM_Mixing_Keys,
                LLM_COMPATIBLE_GENRES,
                -- Production (fix naming)
                LLM_Production_Style,
                LLM_Instruments,
                LLM_Vocal_Style,
                LLM_Energy_Description,
                -- Relationships (fix naming)
                LLM_Similar_Artists,
                LLM_RECOMMENDATIONS,
                LLM_MUSICAL_INFLUENCE,
                -- Classification
                LLM_IS_COMPILATION,
                LLM_IS_REMIX,
                LLM_IS_COVER,
                -- Validation
                LLM_CONFIDENCE_SCORE,
                LLM_VALIDATION_NOTES,
                LLM_WARNINGS,
                -- System
                llm_version
            FROM llm_metadata
        `;

        try {
            const result = await this.runQuery(migrationSQL);
            logInfo('✅ Migrated ${result.changes} records to clean schema');

            // Get statistics
            const stats = await this.getTableStats('llm_metadata_clean');
            logDebug(`\n📊 Migration Statistics:`);
            logDebug(`   Total records: ${stats.totalRecords}`);
            logDebug('   Columns in old schema: 92`);
            logDebug(`   Columns in new schema: ${stats.columnCount}`);
            logDebug(`   Reduction: ${92 - stats.columnCount} columns removed`);

            this.stats.columnsRemoved = 92 - stats.columnCount;
        } catch (error) {
            logError('❌ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Step 4: Swap tables
     */
    async swapTables() {
        logDebug('\n🔄 STEP 4: SWAPPING TABLES');
        logDebug('-'.repeat(70));

        try {
            // Rename old table to backup
            await this.runQuery('ALTER TABLE llm_metadata RENAME TO llm_metadata_old');
            logInfo('✅ Renamed old table to llm_metadata_old');

            // Rename clean table to production
            await this.runQuery('ALTER TABLE llm_metadata_clean RENAME TO llm_metadata');
            logInfo('✅ Renamed clean table to llm_metadata');

            logDebug('\n✅ Table swap complete!');
            logDebug('   Old table preserved as: llm_metadata_old');
            logDebug('   Clean table now active as: llm_metadata');
        } catch (error) {
            logError('❌ Table swap failed:', error);
            throw error;
        }
    }

    /**
     * Step 5: Verify cleanup
     */
    async verifyCleanup() {
        logDebug('\n✅ STEP 5: VERIFYING CLEANUP');
        logDebug('-'.repeat(70));

        const newStats = await this.getTableStats('llm_metadata');

        logDebug('\n📊 CLEANUP SUMMARY:`);
        logDebug(`   ✅ Columns removed: ${this.stats.columnsRemoved}`);
        logDebug(`   ✅ Data consolidated: ${this.stats.dataConsolidated} records`);
        logDebug(`   ✅ Final column count: ${newStats.columnCount}`);
        logDebug(`   ✅ Total records: ${newStats.totalRecords}`);

        // List all columns in new schema
        const columns = await this.getColumns('llm_metadata');
        logDebug('\n📋 Final Column List (all properly named):');

        const categories = {
            'Analysis Flags': columns.filter(c => c.includes('ANALYZED')),
            'Audio Analysis (AI)': columns.filter(
                c => c.startsWith('AI_') && !c.includes('ANALYZED')
            ),
            'LLM Core': columns.filter(
                c => c.startsWith('LLM_') && !c.includes('LYRICS') && !c.includes('IS_')
            ),
            'Lyrics Analysis': columns.filter(c => c.includes('LYRICS')),
            Classification: columns.filter(c => c.includes('IS_')),
            System: columns.filter(c => !c.startsWith('AI_') && !c.startsWith('LLM_`))
        };

        for (const [category, cols] of Object.entries(categories)) {
            if (cols.length > 0) {
                logDebug(`\n${category}:`);
                cols.forEach(col => logDebug(`   - ${col}`));
            }
        }
    }

    /**
     * Helper: Check if column exists
     */
    async columnExists(column) {
        return new Promise(resolve => {
            this.db.get(
                `SELECT COUNT(*) as count FROM pragma_table_info('llm_metadata`) WHERE name = ?`,
                [column],
                (err, row) => {
                    resolve(!err && row && row.count > 0);
                }
            );
        });
    }

    /**
     * Helper: Run query
     */
    async runQuery(sql, params = []) {
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
     * Helper: Get table statistics
     */
    async getTableStats(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as totalRecords FROM ${tableName}`, async (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const columns = await this.getColumns(tableName);
                    resolve({
                        totalRecords: row.totalRecords,
                        columnCount: columns.length
                    });
                }
            });
        });
    }

    /**
     * Helper: Get column list
     */
    async getColumns(tableName) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT name FROM pragma_table_info('${tableName}')', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(r => r.name));
                }
            });
        });
    }

    /**
     * Optional: Rollback
     */
    async rollback() {
        logDebug('\n⚠️  ROLLBACK PROCEDURE');
        logDebug('-'.repeat(70));
        logDebug(`To rollback changes:`);
        logDebug(`1. Restore from backup: ${this.backupPath}`);
        logDebug('2. Or rename llm_metadata_old back to llm_metadata');

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => {
            readline.question('\nDo you want to rollback? (y/N): ', answer => {
                readline.close();
                if (answer.toLowerCase() === 'y') {
                    this.db.run('DROP TABLE IF EXISTS llm_metadata', () => {
                        this.db.run('ALTER TABLE llm_metadata_old RENAME TO llm_metadata', () => {
                            logInfo('✅ Rollback complete');
                            resolve(true);
                        });
                    });
                } else {
                    logDebug('ℹ️  Keeping cleaned schema');
                    resolve(false);
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const cleaner = new DatabaseCleaner();

    logWarn('⚠️  WARNING: This will modify your database structure!');
    logDebug('A backup will be created, but please review the changes.\n');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Do you want to proceed? (y/N): ', async answer => {
        readline.close();

        if (answer.toLowerCase() !== 'y') {
            logError('❌ Cleanup cancelled');
            process.exit(0);
        }

        try {
            await cleaner.init();

            // Run cleanup steps
            await cleaner.consolidateData();
            await cleaner.createCleanSchema();
            await cleaner.migrateData();
            await cleaner.swapTables();
            await cleaner.verifyCleanup();

            cleaner.close();

            logDebug('\n\n✨ DATABASE CLEANUP COMPLETE!');
            logDebug('Your database is now optimized with:');
            logDebug('  - No duplicate columns');
            logDebug('  - Consistent naming (UPPER_SNAKE_CASE)');
            logDebug('  - Consolidated data from redundant fields`);
            logDebug(`\nBackup saved at: ${cleaner.backupPath}`);
        } catch (error) {
            logError('\n❌ Cleanup failed:', error);
            logDebug('Database has been backed up and no permanent changes were made.`);
            process.exit(1);
        }
    });
}

module.exports = { DatabaseCleaner };
