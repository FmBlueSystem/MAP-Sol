#!/usr/bin/env node

/**
 * ANALYZE ALL - Analiza TODOS los archivos pendientes con IA
 * ⚠️ ADVERTENCIA: Esto puede costar ~$35 USD y tomar varias horas
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, 'music_analyzer.db');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Obtener estadísticas
async function getStats() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);

        db.get(
            `
            SELECT 
                (SELECT COUNT(*) FROM audio_files WHERE file_path NOT LIKE '%_DELETED') as total,
                (SELECT COUNT(*) FROM llm_metadata WHERE LLM_DESCRIPTION IS NOT NULL) as analyzed
        ',
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const pending = row.total - row.analyzed;
                    resolve({
                        total: row.total,
                        analyzed: row.analyzed,
                        pending: pending
                    });
                }
                db.close();
            }
        );
    });
}

// Función principal
async function analyzeAll() {
    console.clear();
    logDebug(`${colors.cyan}${'='.repeat(60)}${colors.reset}');
    logDebug(`${colors.cyan}🎵 MUSIC ANALYZER PRO - ANÁLISIS COMPLETO${colors.reset}`);
    logDebug(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n');

    // Obtener estadísticas
    const stats = await getStats();

    if (stats.pending === 0) {
        logDebug(`${colors.green}✅ No hay archivos pendientes de análisis!${colors.reset}`);
        logDebug(`   Total: ${stats.total} archivos`);
        logDebug(`   Analizados: ${stats.analyzed} archivos\n`);
        process.exit(0);
    }

    // Mostrar información
    logDebug(`${colors.bright}📊 ESTADO ACTUAL:${colors.reset}`);
    logDebug(`   Total de archivos: ${stats.total}`);
    logDebug(`   Ya analizados: ${stats.analyzed}`);
    logDebug(`   ${colors.yellow}Pendientes: ${stats.pending}${colors.reset}\n`);

    // Calcular estimaciones
    const estimatedCost = (stats.pending * 0.01).toFixed(2);
    const estimatedTime = Math.ceil((stats.pending * 3) / 60); // 3 segundos por track
    const batchSize = 50; // Procesar en lotes de 50
    const totalBatches = Math.ceil(stats.pending / batchSize);

    logDebug(`${colors.bright}💰 ESTIMACIONES:${colors.reset}`);
    logDebug(`   Costo total: ${colors.yellow}~$${estimatedCost} USD${colors.reset}`);
    logDebug(`   Tiempo estimado: ${colors.yellow}~${estimatedTime} minutos${colors.reset}`);
    logDebug(`   Procesamiento: ${totalBatches} lotes de ${batchSize} tracks\n`);

    logDebug(`${colors.red}⚠️  ADVERTENCIA:${colors.reset}`);
    logDebug(
        `   Este proceso analizará ${colors.bright}${stats.pending} archivos${colors.reset}`
    );
    logDebug(`   Costará aproximadamente ${colors.bright}$${estimatedCost} USD${colors.reset}`);
    logDebug(
        `   Tomará aproximadamente ${colors.bright}${estimatedTime} minutos${colors.reset}\n`
    );

    // Confirmar con el usuario
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(`${colors.yellow}¿Deseas continuar? (s/n): ${colors.reset}`, async answer => {
            rl.close();

            if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'si') {
                logDebug('\n❌ Operación cancelada\n');
                process.exit(0);
            }

            logDebug(`\n${colors.green}✅ Iniciando análisis completo...${colors.reset}\n`);

            const startTime = Date.now();
            let processedTotal = 0;

            // Procesar en lotes
            for (let batch = 1; batch <= totalBatches; batch++) {
                const remaining = stats.pending - processedTotal;
                const currentBatchSize = Math.min(batchSize, remaining);

                logDebug(
                    `\n${colors.cyan}[LOTE ${batch}/${totalBatches}]${colors.reset} Procesando ${currentBatchSize} tracks...`
                );
                logDebug('-'.repeat(60));

                try {
                    // Ejecutar análisis
                    execSync(`node handlers/normalized-llm-handler.js ${currentBatchSize}`, {
                        stdio: 'inherit'
                    });

                    processedTotal += currentBatchSize;

                    // Mostrar progreso
                    const progress = ((processedTotal / stats.pending) * 100).toFixed(1);
                    logDebug(
                        `\n${colors.green}Progreso: ${progress}% (${processedTotal}/${stats.pending})${colors.reset}`
                    );

                    // Pausa entre lotes para evitar rate limiting
                    if (batch < totalBatches) {
                        logDebug(
                            `${colors.yellow}Pausando 10 segundos antes del siguiente lote...${colors.reset}`
                        );
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    }
                } catch (error) {
                    logError(
                        `\n${colors.red}❌ Error en lote ${batch}: ${error.message}${colors.reset}`
                    );
                    const retry = await new Promise(resolve => {
                        const rl2 = readline.createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });
                        rl2.question('¿Reintentar? (s/n): ', answer => {
                            rl2.close();
                            resolve(answer.toLowerCase() === 's');
                        });
                    });

                    if (!retry) {
                        logDebug('Análisis interrumpido');
                        break;
                    }
                    batch--; // Reintentar el mismo lote
                }
            }

            // Resumen final
            const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            const finalCost = (processedTotal * 0.01).toFixed(2);

            logDebug(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}');
            logDebug(`${colors.green}✨ ANÁLISIS COMPLETO${colors.reset}`);
            logDebug(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n');

            logDebug('📊 RESULTADOS:');
            logDebug(`   Archivos procesados: ${processedTotal}`);
            logDebug(`   Tiempo total: ${duration} minutos`);
            logDebug(`   Costo total: ~$${finalCost} USD\n`);

            // Mostrar estadísticas finales
            logDebug(`${colors.bright}Ejecutando estadísticas finales...${colors.reset}\n`);
            execSync('node music-tools.js stats', { stdio: 'inherit' });

            resolve();
        });
    });
}

// Ejecutar
if (require.main === module) {
    analyzeAll().catch(console.error);
}
