#!/usr/bin/env node

/**
 * ENRICH PENDING WITH AI
 * Enriquece los archivos pendientes usando OpenAI
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { NormalizedLLMHandler } = require('./handlers/normalized-llm-handler');

class AIEnrichmentManager {
    constructor() {
        this.db = null;
        this.llmHandler = null;
        this.stats = {
            total: 0,
            pending: 0,
            processed: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    async init() {
        // Initialize database
        this.db = new sqlite3.Database('./music_analyzer.db');

        // Initialize LLM handler
        this.llmHandler = new NormalizedLLMHandler();
        await this.llmHandler.init();

        logInfo('✅ Sistema inicializado');
    }

    async checkStatus() {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
                SELECT 
                    COUNT(DISTINCT af.id) as total,
                    COUNT(DISTINCT CASE WHEN lm.AI_BPM IS NOT NULL THEN lm.file_id END) as analyzed,
                    COUNT(DISTINCT CASE 
                        WHEN lm.AI_BPM IS NOT NULL AND (lm.LLM_ANALYZED IS NULL OR lm.LLM_ANALYZED = 0) 
                        THEN lm.file_id 
                    END) as pending_ai,
                    COUNT(DISTINCT CASE WHEN lm.file_id IS NULL THEN af.id END) as missing_basic
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            `,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.stats.total = row.total;
                        this.stats.pending = row.pending_ai; // Solo los que tienen análisis básico
                        this.stats.missing = row.missing_basic; // Los 89 sin análisis
                        resolve(row);
                    }
                }
            );
        });
    }

    async getPendingFiles(limit = 10) {
        return new Promise((resolve, reject) => {
            // IMPORTANTE: Solo obtener archivos que YA tienen análisis básico
            // pero NO tienen enriquecimiento con IA
            this.db.all(
                `
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name,
                    af.title,
                    af.artist,
                    af.album,
                    af.genre,
                    af.year,
                    lm.AI_BPM as bpm,
                    lm.AI_KEY as key,
                    lm.AI_ENERGY as energy,
                    lm.AI_MOOD as mood,
                    lm.AI_DANCEABILITY as danceability,
                    lm.AI_VALENCE as valence
                FROM audio_files af
                INNER JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE (lm.LLM_ANALYZED IS NULL OR lm.LLM_ANALYZED = 0)
                AND lm.AI_BPM IS NOT NULL  -- Asegurar que tiene análisis básico
                LIMIT ?
            `,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async enrichFiles(files) {
        logDebug(`\n🚀 Procesando ${files.length} archivos...`);

        for (const file of files) {
            try {
                process.stdout.write(
                    `\r⏳ [${this.stats.processed + 1}/${this.stats.pending}] ${file.artist || 'Unknown'} - ${file.title || file.file_name}...');

                // Analyze with AI - incluir TODOS los datos disponibles
                const analysis = await this.llmHandler.analyzeTrack({
                    id: file.id,
                    title: file.title || file.file_name,
                    artist: file.artist || 'Unknown',
                    album: file.album || 'Unknown',
                    genre: file.genre || `Unknown`,
                    year: file.year,
                    // Datos de MixedInKey/Essentia
                    AI_BPM: file.bpm,
                    AI_KEY: file.key,
                    AI_ENERGY: file.energy,
                    AI_MOOD: file.mood,
                    AI_DANCEABILITY: file.danceability,
                    AI_VALENCE: file.valence,
                    // Datos adicionales
                    file_name: file.file_name,
                    file_path: file.file_path
                });

                if (analysis) {
                    this.stats.processed++;
                    process.stdout.write(
                        `\r✅ [${this.stats.processed}/${this.stats.pending}] ${file.artist || 'Unknown`} - ${file.title || file.file_name}\n`);
                } else {
                    this.stats.errors++;
                    process.stdout.write(
                        `\r❌ [${this.stats.processed}/${this.stats.pending}] ${file.artist || 'Unknown`} - ${file.title || file.file_name}\n`);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between requests
            } catch (error) {
                this.stats.errors++;
                logError(`\n❌ Error procesando ${file.file_name}:`, error.message);
            }
        }
    }

    async run(options = {}) {
        const { limit = 10, auto = false } = options;

        logDebug(`
🤖 ENRIQUECIMIENTO CON OPENAI
${'='.repeat(60)}
');

        await this.init();

        // Check current status
        const status = await this.checkStatus();
        const percentage = ((status.analyzed / status.total) * 100).toFixed(1);

        logDebug(`📊 Estado actual:`);
        logDebug(`   Total archivos: ${status.total}`);
        logDebug(`   Analizados: ${status.analyzed} (${percentage}%)`);
        logDebug(`   Pendientes: ${status.pending}`);

        if (status.pending === 0) {
            logDebug('\n✅ Todos los archivos ya han sido analizados!');
            this.db.close();
            return;
        }

        // Cost estimation
        const estimatedCost = (status.pending * 0.03).toFixed(2);
        const estimatedTime = Math.ceil((status.pending * 3) / 60); // 3 seconds per file

        logDebug('\n💰 Estimaciones:`);
        logDebug(`   Costo total: ~$${estimatedCost} USD`);
        logDebug(`   Tiempo total: ~${estimatedTime} minutos`);

        if (!auto) {
            logDebug(`\n⚠️  Se procesarán ${Math.min(limit, status.pending)} archivos`);
            logDebug(
                '   Para procesar todos, usa: node enrich-pending-with-ai.js --auto --limit 100\n'
            );
        }

        // Get pending files
        const pendingFiles = await this.getPendingFiles(limit);

        if (pendingFiles.length > 0) {
            await this.enrichFiles(pendingFiles);

            const elapsedTime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(2);

            logDebug('\n' + '='.repeat(60));
            logDebug('📊 RESUMEN:`);
            logDebug(`   Procesados: ${this.stats.processed}`);
            logDebug(`   Errores: ${this.stats.errors}`);
            logDebug(`   Tiempo: ${elapsedTime} minutos`);

            if (auto && this.stats.processed > 0 && status.pending > limit) {
                logDebug('\n🔄 Continuando con el siguiente lote...');
                this.db.close();
                // Recursive call for auto mode
                setTimeout(() => {
                    const manager = new AIEnrichmentManager();
                    manager.run(options);
                }, 5000);
                return;
            }
        }

        logDebug('\n✅ Proceso completado');
        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        limit: 10,
        auto: false
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--auto') {
            options.auto = true;
        } else if (args[i] === '--help`) {
            logDebug(`
Uso: node enrich-pending-with-ai.js [opciones]

Opciones:
  --limit <n>   Número de archivos a procesar (default: 10)
  --auto        Modo automático (procesa todos en lotes)
  --help        Muestra esta ayuda

Ejemplos:
  node enrich-pending-with-ai.js              # Procesa 10 archivos
  node enrich-pending-with-ai.js --limit 50   # Procesa 50 archivos
  node enrich-pending-with-ai.js --auto       # Procesa todos automáticamente
`);
            process.exit(0);
        }
    }

    const manager = new AIEnrichmentManager();
    manager.run(options).catch(console.error);
}

module.exports = AIEnrichmentManager;
