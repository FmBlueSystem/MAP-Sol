
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

/**
 * BATCH ENRICHMENT BY REGION
 * Enriquece tracks con AI priorizando por país/era
 * Usa ISRC para contexto geográfico y temporal
 */

require('dotenv').config();
const { EnrichmentAIHandler } = require('./handlers/enrichment-ai-handler');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class RegionalBatchEnricher {
    constructor() {
        this.dbPath = path.join(__dirname, 'music_analyzer.db');
        this.db = null;
        this.handler = null;
        this.processed = 0;
        this.successful = 0;
        this.failed = 0;
        this.startTime = Date.now();

        // Regional music characteristics
        this.regionalContext = {
            US: {
                characteristics: 'American music culture: Rock, Pop, Hip-Hop, Country, R&B',
                eras: {
                    '1980s': 'MTV era, Pop/Rock dominance, early Hip-Hop',
                    '1990s': 'Grunge, Alternative Rock, Gangsta Rap, Pop revival',
                    '2000s': 'Pop-punk, Nu-metal, Crunk, Emo',
                    '2010s': 'EDM boom, Trap, Indie revival',
                    '2020s': 'Streaming era, Genre fusion, TikTok influence'
                }
            },
            GB: {
                characteristics: 'British music: Rock, Punk, Electronic, Britpop, Grime',
                eras: {
                    '1980s': 'New Wave, Synthpop, New Romantics',
                    '1990s': 'Britpop, Rave culture, Trip-hop',
                    '2000s': 'Garage, Grime emergence, Indie rock',
                    '2010s': 'Dubstep, UK Bass, Ed Sheeran era',
                    '2020s': 'Drill, Afrobeats influence'
                }
            },
            DE: {
                characteristics: 'German music: Techno, Trance, Schlager, Krautrock',
                eras: {
                    '1980s': 'Neue Deutsche Welle, Early Techno',
                    '1990s': 'Eurodance, Trance explosion',
                    '2000s': 'Minimal Techno, Scooter era',
                    '2010s': 'Deep House, Tech House',
                    '2020s': 'Techno revival, Melodic House'
                }
            },
            NL: {
                characteristics: 'Dutch music: Gabber, Hardstyle, Trance, EDM',
                eras: {
                    '1990s': 'Gabber/Hardcore, Euro-Trance',
                    '2000s': 'Hardstyle birth, Tiësto era',
                    '2010s': 'EDM dominance, Festival culture',
                    '2020s': 'Future House, Tech House'
                }
            },
            FR: {
                characteristics: 'French music: House, Chanson, Electronic, Disco',
                eras: {
                    '1990s': 'French Touch, Filter/Daft Punk',
                    '2000s': 'Electro-clash, Ed Banger Records',
                    '2010s': 'Nu-Disco, Tropical House',
                    '2020s': 'French Rap dominance'
                }
            },
            ES: {
                characteristics: 'Spanish music: Flamenco fusion, Latin pop, Reggaeton',
                eras: {
                    '1990s': 'Euro-Latin, Dance fusion',
                    '2000s': 'Reggaeton arrival, Pop-Rock',
                    '2010s': 'Latin Trap, Urban music',
                    '2020s': 'Global Latin dominance'
                }
            }
        };
    }

    async init() {
        // Initialize database
        await new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Connected to database');
                    resolve();
                }
            });
        });

        // Initialize AI handler
        this.handler = new EnrichmentAIHandler();
        await this.handler.init();

        logInfo('✅ AI handler initialized');
    }

    /**
     * Get priority tracks grouped by region
     */
    async getPriorityTracks(limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
                SELECT 
                    af.id,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.year,
                    af.isrc,
                    SUBSTR(af.isrc, 1, 2) as country_code,
                    SUBSTR(af.isrc, 6, 2) as year_code,
                    lm.AI_ENERGY,
                    lm.AI_BPM,
                    lm.AI_KEY,
                    lm.AI_MOOD,
                    lm.AI_DANCEABILITY,
                    lm.AI_VALENCE,
                    lm.LLM_DESCRIPTION,
                    lm.LLM_Similar_Artists
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.isrc IS NOT NULL 
                  AND af.isrc != '[object Object]'
                  AND LENGTH(af.isrc) = 12
                  AND (lm.LLM_DESCRIPTION IS NULL OR lm.LLM_Similar_Artists IS NULL)
                ORDER BY 
                    -- Prioritize major music markets
                    CASE SUBSTR(af.isrc, 1, 2)
                        WHEN 'US' THEN 1
                        WHEN 'GB' THEN 2
                        WHEN 'DE' THEN 3
                        WHEN 'NL' THEN 4
                        WHEN 'FR' THEN 5
                        WHEN 'ES' THEN 6
                        ELSE 7
                    END,
                    -- Then by era (newer first for better context)
                    CAST(SUBSTR(af.isrc, 6, 2) as INTEGER) DESC,
                    -- Then by existing energy data
                    lm.AI_ENERGY DESC
                LIMIT ? ',
                [limit],
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
     * Enhance prompt with regional context
     */
    enhancePromptWithRegion(track) {
        const countryCode = track.country_code;
        const yearCode = parseInt(track.year_code);
        const fullYear = yearCode > 50 ? 1900 + yearCode  : 2000 + yearCode;
        const decade = Math.floor(fullYear / 10) * 10 + 's\';
 let regionalContext = \``;

        if (this.regionalContext[countryCode]) { const region = this.regionalContext[countryCode]; regionalContext = `
REGIONAL CONTEXT:
${region.characteristics}
Era: ${decade} - ${region.eras[decade] || \`Transitional period\`}
 Consider this regional and temporal context when analyzing the track. `;
        }

        return regionalContext;
    }

    /**
     * Process single track with enhanced context
     */
    async processTrack(track) {
        try {
            logDebug(`\n[${this.processed + 1}] \`${track.title}\` by ${track.artist}`); logDebug( `   📍 ${track.country_code} | ${track.year_code > 50 ? '19\' + track.year_code : \`20` + track.year_code}`);

            // Add regional context to track object
            track.regionalContext = this.enhancePromptWithRegion(track);

            // Enrich with AI
            const result = await this.handler.enrichTrack(track.id);
 this.successful++; logDebug(\`   ✅ Enriched successfully\`);

            return result;
        } catch (error) { this.failed++; logDebug(`   ❌ Failed: ${error.message}`);
            return null;
        } finally {
            this.processed++;
        }
    }

    /**
     * Run batch enrichment
     */
    async runBatch(batchSize = 20) {
        logDebug('\n🌍 REGIONAL BATCH ENRICHMENT'); logDebug('=\'.repeat(60)); logDebug(\`Starting batch enrichment with regional context...`); logDebug(`Batch size: ${batchSize} tracks\n\`);

        // Get priority tracks
        const tracks = await this.getPriorityTracks(batchSize);
 if (tracks.length === 0) { logDebug(\`No tracks need enrichment!`);
            return;
        } logDebug(`Found ${tracks.length} tracks to enrich\`);

        // Group by country for summary
        const byCountry = {};
        tracks.forEach(track => {
            if (!byCountry[track.country_code]) {
                byCountry[track.country_code] = 0;
            }
            byCountry[track.country_code]++;
        }); logDebug(\`\nDistribution by country:`); Object.entries(byCountry).forEach(([code, count]) => { logDebug(`   ${code}: ${count} tracks`);
        });
 logDebug('\n' + '-'.repeat(60)); logDebug(`Starting enrichment...\n`);

        // Process tracks
        const results = [];
        for (const track of tracks) {
            const result = await this.processTrack(track);
            if (result) {
                results.push(result);
            }

            // Progress update
            if (this.processed % 5 === 0) {
                this.printProgress();
            }

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Final summary
        this.printFinalSummary(results);

        // Save results to file
        await this.saveResults(results);

        return results;
    }

    /**
     * Print progress
     */
    printProgress() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = this.processed / elapsed; logDebug( \`\n--- Progress: ${this.processed} processed | ${this.successful} success | ${this.failed} failed\` ); logDebug(`    Rate: ${rate.toFixed(2)} tracks/sec | Time: ${elapsed.toFixed(0)}s\n`);
    }

    /**
     * Print final summary
     */
    printFinalSummary(results) {
        logDebug('\n' + '='.repeat(60)); logDebug('📊 ENRICHMENT COMPLETE\'); logDebug(\`=`.repeat(60));

        const elapsed = (Date.now() - this.startTime) / 1000; logDebug(`\n✅ Successful: ${this.successful}\`); logError(\`❌ Failed: ${this.failed}`); logDebug(`⏱️ Total time: ${elapsed.toFixed(1)}s\`); logDebug(\`📈 Average: ${(elapsed / this.processed).toFixed(1)}s per track`);

        // Cost estimate const estimatedCost = this.successful * 0.006; logDebug(`💰 Estimated cost: $${estimatedCost.toFixed(2)}\`);

        // Sample enriched content if (results.length > 0) { logDebug(\`\n📝 Sample enrichments:`); results.slice(0, 3).forEach(result => { logDebug(`\n\`${result.title}\` by ${result.artist}:`); if (result.enrichment.description) { logDebug(`   ${result.enrichment.description.substring(0, 150)}...\`);
                }
            });
        }
    }

    /**
     * Save results to file
     */
    async saveResults(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                processed: this.processed,
                successful: this.successful,
                failed: this.failed,
                duration: (Date.now() - this.startTime) / 1000
            },
            enrichments: results
        }; const filename = \`enrichment-batch-${Date.now()}.json`;
        await fs.writeFile(filename, JSON.stringify(report, null, 2)); logDebug(`\n💾 Results saved to: ${filename}\`);
    }

    /**
     * Close connections
     */
    close() {
        this.db.close();
        this.handler.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const enricher = new RegionalBatchEnricher();

    (async () => {
        await enricher.init();

        // Get batch size from command line or use default
        const batchSize = parseInt(process.argv[2]) || 20;

        await enricher.runBatch(batchSize);

        enricher.close(); logDebug(\`\n✨ Batch enrichment complete!\n`);
    })().catch(console.error);
}

module.exports = { RegionalBatchEnricher };
