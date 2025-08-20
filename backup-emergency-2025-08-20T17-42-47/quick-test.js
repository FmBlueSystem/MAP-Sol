const { CompleteLLMHandler } = require('./handlers/complete-llm-handler');

(async () => {
    const handler = new CompleteLLMHandler();
    await handler.init();

    logDebug('\n🧪 QUICK TEST - 2 TRACKS\n');

    // Get just 2 tracks
    const tracks = await handler.getTracksNeedingCompleteAnalysis(2);
    logDebug(`Found ${tracks.length} tracks for testing:\n`);

    for (const track of tracks) {
        logDebug(`- "${track.title}` by ${track.artist}`);
    }

    logDebug('\nStarting analysis...\n');

    // Analyze them
    for (const track of tracks) {
        try {
            await handler.analyzeTrackComplete(track.id);
            logInfo(`✅ Track ${track.id} analyzed successfully\n`);
        } catch (error) {
            logError(`❌ Error analyzing track ${track.id}:`, error.message);
        }
    }

    handler.close();

    logInfo('✅ Quick test complete!\n`);
})().catch(console.error);
