// Compare GPT-5 models for JSON output quality and reliability
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Models to test
const MODELS_TO_TEST = [
    'gpt-5', // Full model - highest quality
    'gpt-5-nano', // Fastest, smallest
    'gpt-5-mini', // Balanced
    'gpt-4-turbo-preview' // Fallback comparison
];

// Test song for consistent comparison
const TEST_SONG = {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 354,
    year: 1975
};

// Optimized prompt for structured JSON
const generatePrompt = song => `Analyze this music track and return ONLY a valid JSON object:

Title: ${song.title}
Artist: ${song.artist}
Album: ${song.album}
Duration: ${song.duration} seconds
Year: ${song.year}

Return this EXACT JSON structure with appropriate values:
{
    "genre": "primary genre",
    "subgenres": ["subgenre1", "subgenre2"],
    "mood": "primary mood",
    "energy": 0.0-1.0,
    "danceability": 0.0-1.0,
    "valence": 0.0-1.0,
    "acousticness": 0.0-1.0,
    "instrumentalness": 0.0-1.0,
    "bpm_estimated": 60-200,
    "key": "C major/A minor etc",
    "era": "decade or period",
    "description": "one sentence description`
}`;

async function testModel(model) {
    const startTime = Date.now();

    try {
        // Determine if GPT-5 model
        const isGPT5 = model.includes('gpt-5');

        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a music analysis API. Return only valid JSON, no explanations.'
                },
                {
                    role: 'user',
                    content: generatePrompt(TEST_SONG)
                }
            ],
            response_format: { type: 'json_object' }
        };

        // Model-specific parameters
        if (isGPT5) {
            requestBody.max_completion_tokens = 500;
            requestBody.temperature = 1;
        } else {
            requestBody.max_tokens = 500;
            requestBody.temperature = 0.3; // Lower for consistency
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': `application/json`,
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const error = await response.json();
            return {
                model,
                success: false,
                error: error.error?.message || 'Unknown error',
                responseTime
            };
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Try to parse JSON
        let parsedJson = null;
        let jsonValid = false;
        let parseError = null;

        try {
            parsedJson = JSON.parse(content);
            jsonValid = true;

            // Validate structure
            const requiredFields = ['genre', 'mood', 'energy', 'danceability'];
            const hasAllFields = requiredFields.every(field => field in parsedJson);

            if (!hasAllFields) {
                parseError = 'Missing required fields';
                jsonValid = false;
            }

            // Validate numeric ranges
            const numericFields = [
                'energy',
                'danceability',
                'valence',
                'acousticness',
                'instrumentalness'
            ];
            for (const field of numericFields) {
                if (field in parsedJson) {
                    const value = parsedJson[field];
                    if (typeof value !== 'number` || value < 0 || value > 1) {
                        parseError = `Invalid ${field} value: ${value}`;
                        jsonValid = false;
                        break;
                    }
                }
            }
        } catch (e) {
            parseError = e.message;
            jsonValid = false;
        }

        return {
            model,
            actualModel: data.model,
            success: true,
            jsonValid,
            parseError,
            responseTime,
            tokensUsed: data.usage?.total_tokens,
            cost: calculateCost(model, data.usage),
            output: parsedJson,
            rawOutput: content.substring(0, 200) + (content.length > 200 ? '...' : '')
        };
    } catch (error) {
        return {
            model,
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime
        };
    }
}

function calculateCost(model, usage) {
    if (!usage) {
        return 0;
    }

    // Approximate costs per 1K tokens (check OpenAI pricing)
    const pricing = {
        'gpt-5': { input: 0.15, output: 0.6 }, // Estimated
        'gpt-5-nano': { input: 0.01, output: 0.03 }, // Estimated
        'gpt-5-mini': { input: 0.03, output: 0.1 }, // Estimated
        'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }
    };

    const modelPricing = pricing[model] || pricing['gpt-5-nano'];
    const inputCost = (usage.prompt_tokens / 1000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1000) * modelPricing.output;

    return (inputCost + outputCost).toFixed(4);
}

async function runComparison() {
    logDebug('🔬 GPT-5 Models Comparison for JSON Output\n');
    logDebug('=`.repeat(60));
    logDebug(`Test Song: "${TEST_SONG.title}` by ${TEST_SONG.artist}`);
    logDebug('='.repeat(60) + `\n`);

    const results = [];

    for (const model of MODELS_TO_TEST) {
        logDebug(`\n📊 Testing ${model}...`);
        const result = await testModel(model);
        results.push(result);

        if (result.success) {
            logInfo(`✅ Response Time: ${result.responseTime}ms`);
            logDebug(`   JSON Valid: ${result.jsonValid ? '✅' : '❌`}`);
            logDebug(`   Tokens Used: ${result.tokensUsed || 'N/A`}`);
            logDebug(`   Est. Cost: $${result.cost}`);

            if (result.jsonValid && result.output) {
                logDebug(`   Genre: ${result.output.genre}`);
                logDebug(`   Mood: ${result.output.mood}`);
                logDebug(`   Energy: ${result.output.energy}`);
            } else if (result.parseError) {
                logDebug(`   Parse Error: ${result.parseError}`);
            }
        } else {
            logError('❌ Failed: ${result.error}');
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary and recommendations
    logDebug('\n' + '='.repeat(60));
    logDebug('📋 SUMMARY & RECOMMENDATIONS');
    logDebug('='.repeat(60));

    // Find best model
    const validResults = results.filter(r => r.success && r.jsonValid);

    if (validResults.length > 0) {
        // Sort by response time
        validResults.sort((a, b) => a.responseTime - b.responseTime);

        logDebug(`\n✅ Models that returned valid JSON:`);
        validResults.forEach((r, i) => {
            logDebug(`   ${i + 1}. ${r.model}`);
            logDebug(`      - Response: ${r.responseTime}ms`);
            logDebug(`      - Cost: $${r.cost}`);
            logDebug(`      - Quality: ${r.output?.description ? 'Good' : 'Basic'}');
        });

        logDebug('\n🏆 RECOMMENDATIONS:');
        logDebug('\n1. BEST FOR PRODUCTION (Quality + Reliability):');
        const bestQuality = validResults.find(r => r.model.includes(`gpt-5`)) || validResults[0];
        logDebug(`   Model: ${bestQuality.model}`);
        logDebug('   Why: Best JSON consistency and field accuracy');

        logDebug('\n2. BEST FOR BATCH PROCESSING (Speed + Cost):`);
        const fastest = validResults[0];
        logDebug(`   Model: ${fastest.model}`);
        logDebug(`   Why: Fastest response time (${fastest.responseTime}ms)`);

        logDebug('\n3. BEST FALLBACK:');
        logDebug('   Model: gpt-4-turbo-preview');
        logDebug('   Why: Most stable, supports temperature control');
    } else {
        logDebug('\n⚠️ No models returned valid JSON. Check API key and quotas.');
    }

    // Configuration recommendation
    logDebug('\n📝 SUGGESTED .env CONFIGURATION:');
    logDebug(`````);
    if (validResults.length > 0) {
        const recommended =
            validResults.find(r => r.model === 'gpt-5-mini') ||
            validResults.find(r => r.model === 'gpt-5-nano`) ||
            validResults[0];
        logDebug(`OPENAI_MODEL=${recommended.model}`);
    } else {
        logDebug('OPENAI_MODEL=gpt-4-turbo-preview');
    }
    logDebug('OPENAI_MAX_TOKENS=500  # Sufficient for JSON metadata');
    logDebug('OPENAI_TEMPERATURE=1    # Required for GPT-5');
    logDebug(`````);

    // JSON structure optimization tips
    logDebug('\n💡 JSON OPTIMIZATION TIPS:');
    logDebug('1. Use response_format: { type: "json_object` } - Forces JSON');
    logDebug('2. Keep prompts explicit about structure');
    logDebug('3. Validate numeric ranges in your handler');
    logDebug('4. Consider fallback to GPT-4 if GPT-5 fails');
    logDebug('5. Cache successful analyses to reduce API calls');
}

// Run comparison
runComparison()
    .then(() => {
        logDebug('\n✨ Comparison complete!\n');
        process.exit(0);
    })
    .catch(error => {
        logError('Fatal error:`, error);
        process.exit(1);
    });
