const { CompleteLLMHandler } = require('./handlers/complete-llm-handler');

(async () => {
    const handler = new CompleteLLMHandler();
    await handler.init();

    logDebug('\n📊 BEFORE & AFTER ANALYSIS DEMO\n');
    logDebug('Track: "Take On Me (Kygo Remix)" by a-ha (ID: 3743)\n');

    // Analyze the track
    await handler.analyzeTrackComplete(3743);

    handler.close();
})().catch(console.error);
