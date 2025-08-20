// Quick test for GPT-5 models
require('dotenv').config();

async function quickTestGPT5() {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL;

    logInfo('🚀 Testing ${OPENAI_MODEL}...\n');

    try {
        // Simple test prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'user',
                        content:
                            'Analyze this song: "Bohemian Rhapsody" by Queen. Return JSON with genre, mood, and energy (0-1).',
                    }
                ],
                max_completion_tokens: 200,
                temperature: 1,
                response_format: { type: 'json_object' },
            })
        });

        if (response.ok) {
            const data = await response.json();
            logInfo('✅ Success with', OPENAI_MODEL);
            logDebug('Model used:', data.model);
            logDebug('Response:', JSON.parse(data.choices[0].message.content));
            logDebug('\nTokens used:', data.usage);
        } else {
            const error = await response.json();
            logError('❌ Error:', error.error?.message);
        }
    } catch (error) {
        logError('Failed:', error.message);
    }
}

quickTestGPT5();
