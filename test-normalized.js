const { NormalizedLLMHandler } = require('./handlers/normalized-llm-handler');

(async () => {
    const handler = new NormalizedLLMHandler();
    await handler.init();

    logDebug('\n🧪 TESTING NORMALIZED HANDLER\n');
    logDebug('This ensures GPT-4 returns only normalized values...\n');

    // Test with 2 tracks
    await handler.batchAnalyze(2);

    handler.close();

    logInfo('✅ Test complete! Values should be normalized.\n');
})().catch(console.error);
