// Test GPT-5 availability
require('dotenv').config();

async function testGPT5() {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL;

    logDebug('🔍 Testing GPT-5 availability...\n');
    logDebug('📊 Configured model: ${OPENAI_MODEL}');
    logDebug('━'.repeat(50));

    try {
        // 1. Check available models
        logDebug('\n1️⃣ Fetching available models from OpenAI...');
        const modelsResponse = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
        });

        if (!modelsResponse.ok) {
            throw new Error(`API error: ${modelsResponse.status}`);
        }

        const modelsData = await modelsResponse.json();

        // Check for GPT-5 models
        const gpt5Models = modelsData.data.filter(
            (m) => m.id.toLowerCase().includes('gpt-5') || m.id.toLowerCase().includes('gpt5')
        );

        const gpt4Models = modelsData.data.filter(
            (m) => m.id.toLowerCase().includes('gpt-4') || m.id.toLowerCase().includes('gpt4')
        );

        logDebug('\n📋 Available models summary:');
        logDebug(`   Total models: ${modelsData.data.length}`);
        logDebug(`   GPT-4 models: ${gpt4Models.length}`);
        logDebug(`   GPT-5 models: ${gpt5Models.length}`);

        if (gpt5Models.length > 0) {
            logDebug('\n✅ GPT-5 models found:');
            gpt5Models.forEach((m) => {
                logDebug(`   - ${m.id}`);
                logDebug(`     Created: ${new Date(m.created * 1000).toLocaleDateString()}`);
                logDebug(`     Owner: ${m.owned_by}`);
            });
        } else {
            logDebug('\n⚠️ No GPT-5 models found in your account');
            logDebug('\n📌 Available GPT-4 models:');
            gpt4Models.slice(0, 5).forEach((m) => {
                logDebug(`   - ${m.id}`);
            });
        }

        // 2. Try to use GPT-5
        logDebug('\n2️⃣ Attempting to use GPT-5...');
        logDebug('━'.repeat(50));

        const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-5',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant.',
                    },
                    {
                        role: 'user',
                        content: 'What model are you? Please specify your exact model name and capabilities.',
                    },
                ],
                max_tokens: 100,
            }),
        });

        if (testResponse.ok) {
            const data = await testResponse.json();
            logDebug('\n✅ GPT-5 responded successfully!');
            logDebug('Response:', data.choices[0].message.content);
            logDebug('\nModel used:', data.model);
            logDebug('Usage:', data.usage);
        } else {
            const error = await testResponse.json();
            logDebug('\n❌ GPT-5 is not available');
            logDebug('Error:', error.error?.message || 'Unknown error');

            if (error.error?.code === 'model_not_found') {
                logDebug('\n💡 GPT-5 is not yet released or not available for your account.');
                logDebug('   OpenAI has not officially released GPT-5 as of now.');
            }
        }

        // 3. Recommend best available model
        logDebug('\n3️⃣ Recommendation');
        logDebug('━'.repeat(50));

        const recommendedModels = [
            'gpt-4-turbo-preview',
            'gpt-4-turbo',
            'gpt-4-1106-preview',
            'gpt-4',
            'gpt-3.5-turbo',
        ];

        let bestModel = null;
        for (const modelId of recommendedModels) {
            if (modelsData.data.some((m) => m.id === modelId)) {
                bestModel = modelId;
                break;
            }
        }

        if (bestModel) {
            logDebug(`\n🎯 Recommended model for your use case: ${bestModel}`);
            logDebug('   This is the most advanced model available in your account.');

            // Update .env recommendation
            logDebug('\n📝 To use the best available model, update your .env:');
            logDebug(`   OPENAI_MODEL=${bestModel}`);
        }
    } catch (error) {
        logError('\n❌ Test failed:', error.message);
    }

    logDebug('\n' + '━'.repeat(50));
    logDebug('ℹ️  Note: GPT-5 has not been officially released by OpenAI.');
    logDebug('    The latest available model is GPT-4 Turbo.');
    logDebug('━'.repeat(50) + '\n');
}

// Run test
testGPT5()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        logError('Fatal error:', error);
        process.exit(1);
    });
