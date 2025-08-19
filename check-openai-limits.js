#!/usr/bin/env node

/**
 * CHECK OPENAI LIMITS
 * Verifica el estado y límites de tu API key de OpenAI
 */

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function checkLimits() {
    logDebug('\n🔍 VERIFICANDO LÍMITES DE OPENAI');
    logDebug('='.repeat(60));

    if (!OPENAI_API_KEY) {
        logError('❌ No se encontró OPENAI_API_KEY en .env');
        return;
    }

    logDebug(
        `\n📊 API Key: ${OPENAI_API_KEY.substring(0, 10)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`
    );

    // Hacer una llamada simple para verificar el estado
    logDebug('\n🧪 Probando API con llamada simple...');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'user',
                        content: 'Say "OK" in JSON format'
                    }
                ],
                max_tokens: 10,
                response_format: { type: 'json_object' }
            })
        });

        logDebug(`\n📡 Respuesta HTTP: ${response.status} ${response.statusText}`);

        // Verificar headers de rate limit
        const headers = {
            'x-ratelimit-limit-requests': response.headers.get('x-ratelimit-limit-requests'),
            'x-ratelimit-remaining-requests': response.headers.get(
                'x-ratelimit-remaining-requests'
            ),
            'x-ratelimit-reset-requests': response.headers.get('x-ratelimit-reset-requests'),
            'x-ratelimit-limit-tokens': response.headers.get('x-ratelimit-limit-tokens'),
            'x-ratelimit-remaining-tokens': response.headers.get('x-ratelimit-remaining-tokens'),
            'x-ratelimit-reset-tokens': response.headers.get('x-ratelimit-reset-tokens')
        };

        logDebug('\n📊 LÍMITES DE RATE:');
        if (headers['x-ratelimit-limit-requests']) {
            logDebug(`   Requests por minuto: ${headers['x-ratelimit-limit-requests']}');
            logDebug(`   Requests restantes: ${headers['x-ratelimit-remaining-requests']}');
            logDebug(`   Reset en: ${headers['x-ratelimit-reset-requests']}');
        }

        if (headers['x-ratelimit-limit-tokens']) {
            logDebug(`   Tokens por minuto: ${headers['x-ratelimit-limit-tokens']}');
            logDebug(`   Tokens restantes: ${headers['x-ratelimit-remaining-tokens']}');
            logDebug(`   Reset en: ${headers['x-ratelimit-reset-tokens']}');
        }

        if (response.status === 200) {
            const data = await response.json();
            logDebug('\n✅ API funcionando correctamente');
            logDebug(`   Modelo: ${data.model}`);
            logDebug(`   Tokens usados: ${data.usage?.total_tokens || 'N/A'}');
        } else if (response.status === 429) {
            logDebug('\n⚠️  RATE LIMIT ALCANZADO');
            const errorData = await response.json();
            logDebug(`   Mensaje: ${errorData.error?.message || 'Demasiadas solicitudes'}');

            // Calcular tiempo de espera recomendado
            const resetTime = headers['x-ratelimit-reset-requests'];
            if (resetTime) {
                const waitMs = new Date(resetTime) - new Date();
                const waitSeconds = Math.ceil(waitMs / 1000);
                logDebug(`   Esperar: ${waitSeconds} segundos`);
            }

            logDebug('\n💡 SOLUCIONES:');
            logDebug('   1. Esperar unos minutos antes de continuar');
            logDebug('   2. Usar el script safe-analyze.js con pausas más largas');
            logDebug('   3. Reducir el número de tracks por sesión');
            logDebug('   4. Verificar tu plan de OpenAI en platform.openai.com');
        } else if (response.status === 401) {
            logDebug('\n❌ API KEY INVÁLIDA');
            logDebug('   Verifica que tu API key sea correcta en .env');
        } else {
            logDebug('\n⚠️  Error inesperado');
            const errorData = await response.json();
            logDebug('   Error:', errorData);
        }

        // Información adicional
        logDebug('\n📝 RECOMENDACIONES PARA EVITAR 429:');
        logDebug('   • Usar pausas de 5-10 segundos entre llamadas');
        logDebug('   • Procesar en lotes pequeños (5-10 tracks)');
        logDebug('   • Usar reintentos con backoff exponencial');
        logDebug('   • Considerar upgrade de plan si es necesario');

        // Calcular costos estimados
        logDebug('\n💰 COSTOS ESTIMADOS (GPT-4 Turbo):');
        logDebug('   • Por track: ~$0.01 USD');
        logDebug('   • 100 tracks: ~$1.00 USD');
        logDebug('   • 1000 tracks: ~$10.00 USD');
        logDebug('   • Tu biblioteca (3,544 pendientes): ~$35.44 USD');
    } catch (error) {
        logError('\n❌ Error de conexión:', error.message);
        logDebug('\nPosibles causas:');
        logDebug('   • Sin conexión a internet');
        logDebug('   • API key incorrecta');
        logDebug('   • Servicio de OpenAI caído');
    }

    logDebug('\n');
}

// Ejecutar
checkLimits();
