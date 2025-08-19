const { CompleteLLMHandler } = require('./handlers/complete-llm-handler');

(async () => {
    const handler = new CompleteLLMHandler();
    await handler.init();

    logDebug('\n🧪 TEST ANALYSIS WITH CLEAN SCHEMA\n');
    logDebug('Testing 5 tracks to validate clean structure...\n');

    // Test with 5 tracks
    await handler.batchAnalyzeComplete(5);

    handler.close();

    logDebug('\n✅ Test complete! If successful, ready for full batch.\n');
})().catch(console.error);
