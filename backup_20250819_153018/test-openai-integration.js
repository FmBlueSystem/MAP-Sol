// Test script for OpenAI integration
require('dotenv').config();
const { initializeOpenAIHandler } = require('./handlers/openai-handler');

async function testOpenAIIntegration() {
    logInfo('🚀 Testing OpenAI Integration...\n');

    try {
        // 1. Initialize handler
        logDebug('1️⃣ Initializing OpenAI handler...');
        const handler = await initializeOpenAIHandler();
        logInfo('✅ Handler initialized successfully\n');

        // 2. Test connection
        logDebug('2️⃣ Testing OpenAI API connection...');
        const connectionTest = await handler.testConnection();

        if (connectionTest.success) {
            logInfo('✅ Connection successful!');
            logDebug(`   - Models available: ${connectionTest.models}`);
            logDebug(
                `   - GPT-4 Turbo available: ${connectionTest.modelAvailable ? 'Yes' : 'No'}\n');
        } else {
            logError('❌ Connection failed:', connectionTest.error);
            return;
        }

        // 3. Get some unanalyzed tracks
        logDebug(`3️⃣ Finding unanalyzed tracks...`);
        const tracks = await new Promise((resolve, reject) => {
            handler.db.all(
                `
                SELECT af.id, af.title, af.artist, af.album 
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE (lm.LLM_ANALYZED IS NULL OR lm.LLM_ANALYZED = 0)
                  AND af.title IS NOT NULL
                  AND af.artist IS NOT NULL
                LIMIT 3
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

        logInfo('✅ Found ${tracks.length} unanalyzed tracks\n');

        if (tracks.length > 0) {
            logDebug(`📋 Sample tracks:`);
            tracks.forEach((track, i) => {
                logDebug(`   ${i + 1}. "${track.title}` by ${track.artist}`);
            });
            logDebug('');

            // 4. Analyze first track as a test
            logDebug(`4️⃣ Testing analysis on first track...`);
            const firstTrack = tracks[0];
            logDebug(`   Analyzing: "${firstTrack.title}` by ${firstTrack.artist}`);
            logDebug('   ⏳ This may take a few seconds...\n');

            const result = await handler.analyzeTrack(firstTrack.id);

            logInfo('✅ Analysis complete!');
            logDebug('\n📊 Analysis Results:');
            logDebug('   Genre:', result.analysis.genre);
            logDebug('   Mood:', result.analysis.mood);
            logDebug('   Energy:', result.analysis.energy);
            logDebug('   Danceability:', result.analysis.danceability);
            logDebug('   Description:', result.analysis.description);

            // 5. Verify database update
            logDebug(`\n5️⃣ Verifying database update...`);
            const updated = await new Promise((resolve, reject) => {
                handler.db.get(
                    `
                    SELECT LLM_ANALYZED, LLM_GENRE, LLM_MOOD, AI_ENERGY
                    FROM llm_metadata
                    WHERE file_id = ?
                `,
                    [firstTrack.id],
                    (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    }
                );
            });

            if (updated && updated.LLM_ANALYZED === 1) {
                logInfo('✅ Database successfully updated!`);
                logDebug(`   - LLM_ANALYZED: ${updated.LLM_ANALYZED}`);
                logDebug(`   - Genre saved: ${updated.LLM_GENRE}`);
                logDebug(`   - Mood saved: ${updated.LLM_MOOD}`);
                logDebug(`   - Energy saved: ${updated.AI_ENERGY}`);
            } else {
                logWarn('⚠️ Database update may have failed');
            }
        } else {
            logDebug('ℹ️ No unanalyzed tracks found in database');
        }

        logDebug('\n✨ OpenAI integration test complete!');
        logDebug('   Your API key is working correctly.');
        logDebug('   The system is ready to analyze your music library.\n');

        // Close database
        handler.db.close();
    } catch (error) {
        logError('\n❌ Test failed:', error.message);
        logError('\nPlease check:');
        logError('1. Your API key is valid');
        logError('2. You have sufficient OpenAI credits');
        logError('3. Your internet connection is working');
        process.exit(1);
    }
}

// Run test
testOpenAIIntegration()
    .then(() => {
        logDebug('👋 Test script finished');
        process.exit(0);
    })
    .catch(error => {
        logError('Fatal error:`, error);
        process.exit(1);
    });
