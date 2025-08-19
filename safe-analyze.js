#!/usr/bin/env node

/**
 * SAFE ANALYZE - Análisis seguro con manejo de rate limits
 * Diseñado para evitar errores 429 de OpenAI
 */

require('dotenv').config();
const { NormalizedLLMHandler } = require('./handlers/normalized-llm-handler');

// Configuración segura
const config = {
    batchSize: 5, // Tracks por lote (reducido)
    pauseBetweenTracks: 6000, // 6 segundos entre tracks
    pauseBetweenBatches: 30000, // 30 segundos entre lotes
    maxRetries: 3,
    colors: {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        cyan: '\x1b[36m'
    }
};

async function safeAnalyze(totalTracks = 10) {
    logDebug(
        `\n${config.colors.cyan}🛡️  SAFE ANALYZE - Análisis con protección anti-429${config.colors.reset}`
    );
    logDebug('='.repeat(60));
    logDebug('\nConfiguración segura:');
    logDebug(`   • Tracks a analizar: ${totalTracks}`);
    logDebug(`   • Tamaño de lote: ${config.batchSize}`);
    logDebug(`   • Pausa entre tracks: ${config.pauseBetweenTracks / 1000}s`);
    logDebug(`   • Pausa entre lotes: ${config.pauseBetweenBatches / 1000}s`);
    logDebug(
        `   • Tiempo estimado: ~${Math.ceil((totalTracks * (config.pauseBetweenTracks / 1000)) / 60)} minutos\n`
    );

    const handler = new NormalizedLLMHandler();
    await handler.init();

    let processed = 0;
    let success = 0;
    let failed = 0;
    const batches = Math.ceil(totalTracks / config.batchSize);

    for (let batch = 1; batch <= batches; batch++) {
        const remaining = totalTracks - processed;
        const currentBatchSize = Math.min(config.batchSize, remaining);

        logDebug(
            `\n${config.colors.cyan}[LOTE ${batch}/${batches}]${config.colors.reset} Procesando ${currentBatchSize} tracks`
        );
        logDebug('-'.repeat(60));

        // Obtener tracks para este lote
        const tracks = await handler.getTracksForAnalysis(currentBatchSize);

        if (tracks.length === 0) {
            logDebug('No hay más tracks pendientes');
            break;
        }

        // Procesar cada track del lote
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            processed++;

            logDebug(`\n[${processed}/${totalTracks}] "${track.title}" - ${track.artist}");

            try {
                // Analizar con reintentos automáticos
                await handler.analyzeTrack(track.id);
                success++;
                logDebug(
                    `   ${config.colors.green}✅ Análisis completado${config.colors.reset}`
                );
            } catch (error) {
                failed++;
                logDebug(
                    `   ${config.colors.red}❌ Error: ${error.message}${config.colors.reset}`
                );

                // Si es error 429, pausar más tiempo
                if (error.message.includes('429')) {
                    logDebug(
                        `   ${config.colors.yellow}⚠️  Rate limit detectado. Pausando 60 segundos...${config.colors.reset}`
                    );
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            }

            // Pausa entre tracks (excepto el último del lote)
            if (i < tracks.length - 1) {
                logDebug(
                    `   ${config.colors.yellow}⏸️  Pausa ${config.pauseBetweenTracks / 1000}s...${config.colors.reset}`
                );
                await new Promise(resolve => setTimeout(resolve, config.pauseBetweenTracks));
            }
        }

        // Pausa entre lotes (excepto el último)
        if (batch < batches && processed < totalTracks) {
            logDebug(
                `\n${config.colors.yellow}⏸️  Pausa entre lotes: ${config.pauseBetweenBatches / 1000} segundos...${config.colors.reset}`
            );

            // Mostrar cuenta regresiva
            for (let i = config.pauseBetweenBatches / 1000; i > 0; i--) {
                process.stdout.write(`\r   Continuando en ${i} segundos... `);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            logDebug('\r   ¡Continuando!                    ');
        }
    }

    // Resumen final
    logDebug('\n' + '='.repeat(60));
    logDebug(`${config.colors.cyan}📊 RESUMEN${config.colors.reset}`);
    logDebug(`   Total procesados: ${processed}`);
    logDebug(`   ${config.colors.green}✅ Exitosos: ${success}${config.colors.reset}`);
    logDebug(`   ${config.colors.red}❌ Fallidos: ${failed}${config.colors.reset}`);
    logDebug(`   Tasa de éxito: ${((success / processed) * 100).toFixed(1)}%`);

    handler.close();

    if (failed > 0) {
        logDebug(
            `\n${config.colors.yellow}💡 Tip: Si hay muchos errores 429, intenta más tarde o reduce el tamaño del lote${config.colors.reset}`
        );
    }

    logDebug('\n✨ Análisis seguro completado\n');
}

// CLI
if (require.main === module) {
    const tracks = parseInt(process.argv[2]) || 10;

    if (process.argv[2] === 'help' || process.argv[2] === '--help') {
        logDebug(`
🛡️  SAFE ANALYZE - Análisis seguro con protección anti-429

USO:
  node safe-analyze.js [cantidad]

EJEMPLOS:
  node safe-analyze.js 20    # Analizar 20 tracks de forma segura
  node safe-analyze.js       # Analizar 10 tracks (default)

CARACTERÍSTICAS:
  • Reintentos automáticos con backoff exponencial
  • Pausas inteligentes entre llamadas
  • Detección y manejo de rate limits (429)
  • Proceso por lotes con pausas largas
  • Cuenta regresiva visual entre lotes

CONFIGURACIÓN:
  • Lotes de 5 tracks
  • 6 segundos entre tracks
  • 30 segundos entre lotes
  • 3 reintentos automáticos
  • Pausa de 60s si detecta rate limit

Este script es más lento pero más confiable para análisis masivos.
        `);
        process.exit(0);
    }

    safeAnalyze(tracks).catch(console.error);
}
