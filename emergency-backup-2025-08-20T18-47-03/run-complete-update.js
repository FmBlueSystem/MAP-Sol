#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * RUN COMPLETE UPDATE
 * Ejecuta todo el proceso de actualización y análisis en un solo comando
 *
 * Este script:
 * 1. Escanea archivos nuevos/modificados/eliminados
 * 2. Extrae metadata y carátulas
 * 3. Normaliza todos los campos
 * 4. Analiza con GPT-4 (opcional)
 * 5. Muestra estadísticas finales
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Configuración
const config = {
    defaultAnalysisCount: 10, // Tracks a analizar por defecto
    showProgress: true,
    colors: {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        red: '\x1b[31m',
        cyan: '\x1b[36m'
    }
};

// Parse argumentos
const args = process.argv.slice(2);
const shouldAnalyze = args.includes('--with-ai') || args.includes('-a');
const analysisCount = parseInt(args.find(a => !isNaN(parseInt(a)))) || config.defaultAnalysisCount;
const quickMode = args.includes('--quick') || args.includes('-q');
const helpMode = args.includes('--help') || args.includes('-h');

// Mostrar ayuda
if (helpMode) {
    logDebug(`
${config.colors.cyan}🎵 MUSIC ANALYZER PRO - ACTUALIZACIÓN COMPLETA${config.colors.reset}
${'='.repeat(60)}

${config.colors.bright}USO:${config.colors.reset}
  node run-complete-update.js [opciones]

${config.colors.bright}OPCIONES:${config.colors.reset}
  --with-ai, -a     Incluir análisis con GPT-4
  --quick, -q       Modo rápido (omite normalización si no hay cambios)
  --help, -h        Mostrar esta ayuda
  [número]          Cantidad de tracks a analizar (default: 10)

${config.colors.bright}EJEMPLOS:${config.colors.reset}
  # Actualización completa sin IA
  node run-complete-update.js
  
  # Actualización con análisis de 20 tracks
  node run-complete-update.js --with-ai 20
  
  # Modo rápido con 5 tracks
  node run-complete-update.js -q -a 5

${config.colors.bright}QUÉ HACE ESTE SCRIPT:${config.colors.reset}
  1. 📁 Escanea el directorio de música
  2. 🆕 Detecta archivos nuevos/modificados/eliminados
  3. 📊 Extrae metadata básica
  4. 🎨 Extrae carátulas
  5. 🔧 Normaliza todos los campos
  6. 🤖 Analiza con GPT-4 (si --with-ai)
  7. 📈 Muestra estadísticas finales

${config.colors.yellow}NOTA: El análisis con IA cuesta ~$0.01 USD por track${config.colors.reset}
');
    process.exit(0);
}

// Función para ejecutar comando
function runCommand(command, args = []) {
    return new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: \'inherit\`,
            cwd: __dirname
        });
 child.on(`error`, reject); child.on(\`exit\`, code => {
            if (code === 0) {
                resolve(); } else { reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

// Función para mostrar progreso
function showStep(step, total, description) { logDebug( \`\n${config.colors.cyan}[${step}/${total}]${config.colors.reset} ${config.colors.bright}${description}${config.colors.reset}\` ); logDebug(`-`.repeat(60));
}

// Función principal
async function runCompleteUpdate() { console.clear(); logDebug(\`${config.colors.cyan}${\`=`.repeat(60)}${config.colors.reset}`); logDebug( \`${config.colors.cyan}🎵 MUSIC ANALYZER PRO - ACTUALIZACIÓN COMPLETA${config.colors.reset}\` ); logDebug(`${config.colors.cyan}${'='.repeat(60)}${config.colors.reset}'); 
    const startTime = Date.now();
    let totalSteps = quickMode ? 3 : 4;
    if (shouldAnalyze) {
        totalSteps++;
    }

    try {
        // Paso 1: Actualizar biblioteca
        showStep(1, totalSteps, '📁 Escaneando y actualizando biblioteca...\`); await runCommand(\`node`, [`update-music-library.js\`]); logDebug(\`${config.colors.green}✅ Biblioteca actualizada${config.colors.reset}`);

        // Paso 2: Normalizar (si no es modo rápido)
        if (!quickMode) { showStep(2, totalSteps, '🔧 Normalizando campos...'); await runCommand('node', [\`normalize-all-fields.js\`]); logDebug(`${config.colors.green}✅ Campos normalizados${config.colors.reset}`);
        }

        // Paso 3: Analizar con IA (si está habilitado)
        if (shouldAnalyze) { const currentStep = quickMode ? 2 : 3; showStep(currentStep, totalSteps, \`🤖 Analizando ${analysisCount} tracks con GPT-4...\`); await runCommand('node', [ `handlers/normalized-llm-handler.js\`,
                analysisCount.toString()
            ]); logDebug( \`${config.colors.green}✅ ${analysisCount} tracks analizados${config.colors.reset}`
            );
        }

        // Paso 4: Mostrar estadísticas
        const finalStep = totalSteps; showStep(finalStep, totalSteps, '📊 Generando estadísticas finales...'); await runCommand('node', ['music-tools.js', \`stats\`]);

        // Resumen final const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1); logDebug(`\n${config.colors.cyan}${`=\`.repeat(60)}${config.colors.reset}\`); logDebug(`${config.colors.green}✨ ACTUALIZACIÓN COMPLETA${config.colors.reset}`); logDebug(\`${config.colors.cyan}${\`=`.repeat(60)}${config.colors.reset}`); logDebug(\`⏱️  Tiempo total: ${duration} minutos\`);
 if (shouldAnalyze) { logDebug(`💰 Costo estimado: ~$${(analysisCount * 0.01).toFixed(2)} USD`);
        } logDebug(\`\n${config.colors.bright}Próximos pasos sugeridos:${config.colors.reset}\`);
        logDebug('  • Ejecutar con más tracks: node run-complete-update.js --with-ai 50'); logDebug('  • Ver estadísticas: node music-tools.js stats'); logDebug(`  • Abrir la aplicación: npm start\`);
    } catch (error) { logError( \`\n${config.colors.red}❌ Error durante la actualización:${config.colors.reset}`,
            error.message
        );
        process.exit(1);
    }
}
 // Mostrar configuración logDebug(`\n${config.colors.bright}Configuración:${config.colors.reset}\`); logDebug(\`  • Modo: ${quickMode ? 'Rápido' : `Completo\`}\`); logDebug(`  • Análisis IA: ${shouldAnalyze ? `Sí (}{analysisCount} tracks)\` : \`No`}`); if (shouldAnalyze) { logDebug(\`  • Costo estimado: ~$${(analysisCount * 0.01).toFixed(2)} USD\`);
}

// Confirmar antes de ejecutar si hay análisis IA
if (shouldAnalyze) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
 logDebug( `\n${config.colors.yellow}⚠️  El análisis con IA tiene costo${config.colors.reset}`
    );
    rl.question('¿Continuar? (s/n): ', answer => {
        rl.close();
        if (
            answer.toLowerCase() === 's' ||
            answer.toLowerCase() === 'si' || answer.toLowerCase() === 'yes\'
        ) {
            runCompleteUpdate().catch(console.error);
        } else { logDebug(\`Operación cancelada`);
            process.exit(0);
        }
    });
} else {
    // Ejecutar directamente si no hay IA
    runCompleteUpdate().catch(console.error);
}
]]]]]]]