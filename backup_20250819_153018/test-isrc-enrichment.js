/**
 * TEST: ISRC-Enhanced AI Analysis
 * Prueba el análisis enriquecido usando ISRC para contexto geográfico y temporal
 */

require('dotenv').config();
const { EnrichmentAIHandler } = require('./handlers/enrichment-ai-handler');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testISRCEnrichment() {
    logDebug('🎵 TESTING ISRC-ENHANCED ANALYSIS\n');
    logDebug('='.repeat(60));

    const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

    // Get some tracks with ISRC from different countries
    const tracks = await new Promise((resolve, reject) => {
        db.all(
            `
            SELECT 
                af.id,
                af.title,
                af.artist,
                af.year,
                af.isrc,
                SUBSTR(af.isrc, 1, 2) as country_code,
                SUBSTR(af.isrc, 6, 2) as isrc_year,
                lm.AI_ENERGY,
                lm.AI_BPM,
                lm.AI_KEY
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.isrc IS NOT NULL 
              AND af.isrc != '[object Object]'
              AND LENGTH(af.isrc) = 12
            ORDER BY RANDOM()
            LIMIT 5
        ',
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });

    logDebug('📊 Sample tracks with ISRC:\n');

    // Decode country codes
    const countries = {
        US: '🇺🇸 United States',
        GB: '🇬🇧 United Kingdom',
        NL: '🇳🇱 Netherlands',
        DE: '🇩🇪 Germany',
        FR: '🇫🇷 France',
        ES: '🇪🇸 Spain',
        IT: '🇮🇹 Italy',
        CA: '🇨🇦 Canada',
        AU: '🇦🇺 Australia',
        JP: '🇯🇵 Japan',
        BE: '🇧🇪 Belgium',
        SE: '🇸🇪 Sweden',
        NO: '🇳🇴 Norway',
        CL: '🇨🇱 Chile'
    };

    tracks.forEach((track, i) => {
        const year =
            parseInt(track.isrc_year) > 50 ? `19${track.isrc_year}` : `20${track.isrc_year}`;
        logDebug(`${i + 1}. "${track.title}" by ${track.artist}");
        logDebug(`   ISRC: ${track.isrc}`);
        logDebug(`   Origin: ${countries[track.country_code] || track.country_code} (${year})`);
        logDebug(`   Existing: BPM=${track.AI_BPM}, Energy=${track.AI_ENERGY?.toFixed(2)}\n`);
    });

    logDebug('='.repeat(60));
    logDebug('\n🔬 ANALYZING FIRST TRACK WITH ISRC CONTEXT...\n');

    const handler = new EnrichmentAIHandler();
    await handler.init();

    const testTrack = tracks[0];

    // Show the prompt that will be generated
    logDebug('📝 PROMPT PREVIEW:');
    logDebug('-'.repeat(40));
    const prompt = handler.generateEnrichmentPrompt(testTrack);
    logDebug(prompt.substring(0, 500) + '...\n');

    logDebug('🎯 KEY INSIGHTS FROM ISRC:');
    const year =
        parseInt(testTrack.isrc_year) > 50
            ? `19${testTrack.isrc_year}`
            : `20${testTrack.isrc_year}`;
    logDebug(`   • Country: ${countries[testTrack.country_code] || testTrack.country_code}`);
    logDebug(`   • Year: ${year}`);
    logDebug('   • This provides geographical and temporal context');
    logDebug('   • AI can infer regional music styles and era-specific production\n');

    try {
        logDebug('⏳ Calling OpenAI for enrichment...\n');
        const result = await handler.enrichTrack(testTrack.id);

        logInfo('✅ ENRICHMENT COMPLETE!\n');
        logDebug('📊 Results:');
        logDebug('-'.repeat(40));

        if (result.enrichment.description) {
            logDebug('\n📝 Description:');
            logDebug(result.enrichment.description);
        }

        if (result.enrichment.cultural_context) {
            logDebug('\n🌍 Cultural Context:');
            logDebug(result.enrichment.cultural_context);
        }

        if (result.enrichment.similar_artists?.length > 0) {
            logDebug('\n🎤 Similar Artists:');
            logDebug(result.enrichment.similar_artists.join(', '));
        }

        logDebug('\n💡 Notice how the ISRC helped provide:');
        logDebug('   • Accurate geographical context');
        logDebug('   • Correct time period reference');
        logDebug('   • Regional music scene understanding');
    } catch (error) {
        logError('❌ Enrichment failed:', error.message);
    }

    // Close connections
    db.close();
    handler.db.close();

    logDebug('\n' + '='.repeat(60));
    logDebug('✨ Test complete!\n');
}

// Run test
testISRCEnrichment().catch(console.error);
