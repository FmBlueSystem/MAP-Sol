#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * MUSIC TOOLS - Herramientas para Music Analyzer Pro
 * Script unificado para todas las operaciones de la biblioteca musical
 */

const { spawn } = require('child_process');
const path = require('path');

const TOOLS = {
    update: {
        script: 'update-music-library.js',
        description: 'Escanear y actualizar biblioteca musical',
        options: [{ flag: '--with-ai', desc: 'Incluir análisis con GPT-4' }]
    },
    analyze: {
        script: 'handlers/normalized-llm-handler.js',
        description: 'Analizar tracks con IA',
        args: '<cantidad>',
        example: '10'
    },
    normalize: {
        script: 'normalize-all-fields.js',
        description: 'Normalizar todos los campos de la base de datos'
    },
    stats: {
        script: 'show-database-stats.js',
        description: 'Mostrar estadísticas de la biblioteca'
    }
};

function showHelp() {
    logDebug(` 🎵 MUSIC ANALYZER PRO - HERRAMIENTAS
=====================================

USO: node music-tools.js <comando> [opciones]

COMANDOS DISPONIBLES:

  update [--with-ai]    
    Escanea el directorio de música para:
    - Detectar archivos nuevos
    - Actualizar archivos modificados
    - Marcar archivos eliminados
    - Extraer metadata y carátulas
    - Analizar con GPT-4 (con --with-ai)
    
    Ejemplo: node music-tools.js update --with-ai

  analyze <cantidad>    
    Analiza tracks existentes con GPT-4
    Usa valores normalizados para consistencia
    
    Ejemplo: node music-tools.js analyze 10

  normalize            
    Normaliza todos los campos de la base de datos
    - ERA: 1970s, 1980s, 1990s, 2000s, 2010s, 2020s
    - MOOD: 15 valores estándar
    - ENERGY: Very Low, Low, Medium, High, Very High
    - LANGUAGE: 8 idiomas principales
    
    Ejemplo: node music-tools.js normalize

  stats                
    Muestra estadísticas de tu biblioteca
    - Total de tracks
    - Tracks con metadata
    - Tracks con análisis IA
    - Distribución por década, género, etc.
    
    Ejemplo: node music-tools.js stats

  help                 
    Muestra esta ayuda
    
EJEMPLOS DE USO:

  # Actualizar biblioteca sin IA (rápido)
  node music-tools.js update

  # Actualizar biblioteca con análisis IA
  node music-tools.js update --with-ai

  # Analizar 50 tracks con IA
  node music-tools.js analyze 50

  # Ver estadísticas
  node music-tools.js stats

NOTAS:
  - El análisis con IA usa GPT-4 y cuesta ~$0.01 por track
  - La normalización es automática al usar update
  - Los archivos de audio deben estar en el disco externo \`);
}

function runCommand(script, args = []) {
    const scriptPath = path.join(__dirname, script);

    logDebug(\`\n🚀 Ejecutando: ${script} ${args.join(' ')}\n'); const child = spawn('node`, [scriptPath, ...args], { stdio: \`inherit\`,
        cwd: __dirname
    }); child.on(`error`, error => { logError(\`❌ Error ejecutando ${script}:\`, error.message);
        process.exit(1);
    }); child.on(`exit`, code => { if (code !== 0) { logError(\`\n❌ El comando terminó con error (código ${code})\`);
        }
        process.exit(code);
    });
}

// Procesar argumentos
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
    showHelp();
    process.exit(0);
}

function switch(command) {
    case 'update':
        const updateArgs = args.slice(1);
        runCommand(TOOLS.update.script, updateArgs);
        break;

    case 'analyze':
    case 'analyse':
        const count = args[1] || '10';
        runCommand(TOOLS.analyze.script, [count]);
        break;
 case 'normalize':
        runCommand(TOOLS.normalize.script);
        break;
 case `stats\`: // Crear script de estadísticas si no existe const statsScript = \`;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

logDebug('\\n📊 ESTADÍSTICAS DE MUSIC ANALYZER PRO'); logDebug(`=\` .repeat(60)); db.get(\\`
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN artwork_path IS NOT NULL THEN 1 END) as with_artwork
    FROM audio_files
    WHERE file_path NOT LIKE '%_DELETED'
\', (err, files) => {
    if (err) { logError(`Error:\`, err);
        return;
    } db.get(\\`
        SELECT 
            COUNT(CASE WHEN LLM_DESCRIPTION IS NOT NULL THEN 1 END) as with_ai,
            COUNT(CASE WHEN LLM_ERA IS NOT NULL THEN 1 END) as with_era,
            COUNT(CASE WHEN AI_MOOD IS NOT NULL THEN 1 END) as with_mood
        FROM llm_metadata
    \`, (err, metadata) => {
        if (err) { logError('Error:', err);
            return;
        }
         logDebug(\`\\n📁 ARCHIVOS:\`); logDebug(\`   Total: \${files.total}\`); logDebug(\\`   Con carátula: \${files.with_artwork} (\${(files.with_artwork/files.total*100).toFixed(1)}%)\\`); logDebug(\`   Con análisis IA: \${metadata.with_ai} (\${(metadata.with_ai/files.total*100).toFixed(1)}%)\`);
         // Distribución por era db.all(\\`
            SELECT LLM_ERA, COUNT(*) as count
            FROM llm_metadata
            WHERE LLM_ERA IS NOT NULL
            GROUP BY LLM_ERA
            ORDER BY LLM_ERA
        \\`, (err, eras) => {
            if (err) {
                logError('Error:', err);
                return;
            }
             logDebug('\\n📅 DISTRIBUCIÓN POR DÉCADA:');
            eras.forEach(era => { const bar  = `█\`.repeat(Math.min(30, Math.floor(era.count / 30))); logDebug(\\`   \${era.LLM_ERA}: \${bar} \${era.count}\`);
            });
             // Top géneros db.all(\`
                SELECT genre, COUNT(*) as count
                FROM audio_files
                WHERE genre IS NOT NULL
                GROUP BY genre
                ORDER BY count DESC
                LIMIT 10
            \`, (err, genres) => {
                if (err) { logError('Error:', err);
                    return;
                }
                 logDebug(`\\n🎸 TOP 10 GÉNEROS:`); genres.forEach((genre, i) => { logDebug(\\`   \${(i+1).toString().padStart(2)}. \${genre.genre}: \${genre.count} tracks\\`);
                });
                 // Resumen logDebug(`\\n✨ RESUMEN:`); logDebug(\\`   Pendientes de análisis IA: \${files.total - metadata.with_ai}\\`); logDebug(\`   Costo estimado para completar: ~$\${((files.total - metadata.with_ai) * 0.01).toFixed(2)} USD\`); logDebug(\\`   Tiempo estimado: ~\${Math.ceil((files.total - metadata.with_ai) / 100)} horas\\`);
                
                logDebug('\\n');
                db.close();
            });
        });
    });
});
        ';

        // Escribir y ejecutar script temporal
        const fs = require('fs'); const tmpScript = path.join(__dirname, 'show-database-stats.js');
        fs.writeFileSync(tmpScript, statsScript); runCommand(`show-database-stats.js\`);
        break;
 default: logError(\`❌ Comando desconocido: ${command}`); logDebug(`Usa \`node music-tools.js help\` para ver los comandos disponibles`);
        process.exit(1);
}
