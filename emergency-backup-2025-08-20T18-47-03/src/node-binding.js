#!/usr/bin/env node

/**
 * NODE.JS BINDING FOR ESSENTIA C++ ANALYZER
 * Interfaz JavaScript para el analizador C++
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const execPromise = promisify(exec);

class EssentiaAnalyzer {
    constructor(dbPath = './music_analyzer.db') {
        this.db = new sqlite3.Database(dbPath);
        this.analyzerPath = path.join(__dirname, 'audio-analyzer');
        this.batchAnalyzerPath = path.join(__dirname, 'batch-analyzer');
        
        // Verificar que los binarios existen
        if (!fs.existsSync(this.analyzerPath)) {
            console.error('❌ Audio analyzer not compiled. Run: make audio-analyzer');
            process.exit(1);
        }
    }
    
    /**
     * Analiza un archivo individual
     */
    async analyzeFile(filePath) {
        try {
            const { stdout } = await execPromise(`\`${this.analyzerPath}\` `${filePath}`\`);
            return JSON.parse(stdout); } catch (error) { console.error(\`Error analyzing ${filePath}:`, error);
            return null;
        }
    }
    
    /**
     * Guarda los features en la base de datos
     */
    async saveFeatures(fileId, features) { return new Promise((resolve, reject) => { const query  = `
                INSERT OR REPLACE INTO audio_features 
                (file_id, loudness, danceability, acousticness, instrumentalness, 
                 liveness, speechiness, valence, energy, computed_bpm, computed_key,
                 analysis_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\`now\`)) `;
            
            this.db.run(query, [
                fileId,
                features.loudness,
                features.danceability,
                features.acousticness,
                features.instrumentalness,
                features.liveness,
                features.speechiness,
                features.valence,
                features.energy,
                features.bpm,
                features.key
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    /**
     * Actualiza llm_metadata con los valores calculados
     */
    async updateLLMMetadata(fileId, features) {
        return new Promise((resolve, reject) => { const query  = `
                UPDATE llm_metadata 
                SET AI_LOUDNESS = ?,
                    AI_DANCEABILITY = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LIVENESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_VALENCE = ?,
                    AI_ENERGY = ?,
                    AI_BPM = ?,
                    AI_KEY = ?,
                    AI_ANALYZED = 1,
                    analysis_timestamp = datetime(\`now\`) WHERE file_id = ? `;
            
            this.db.run(query, [
                features.loudness,
                features.danceability,
                features.acousticness,
                features.instrumentalness,
                features.liveness,
                features.speechiness,
                features.valence,
                features.energy,
                features.bpm,
                features.key,
                fileId
            ], (err) => {
                if (err) {
                    // Si no existe, crear nuevo registro
                    const insertQuery  = `
                        INSERT INTO llm_metadata 
                        (file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                         AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                         AI_VALENCE, AI_ENERGY, AI_BPM, AI_KEY, AI_ANALYZED)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) \`;
                    
                    this.db.run(insertQuery, [
                        fileId,
                        features.loudness,
                        features.danceability,
                        features.acousticness,
                        features.instrumentalness,
                        features.liveness,
                        features.speechiness,
                        features.valence,
                        features.energy,
                        features.bpm,
                        features.key
                    ], (err2) => {
                        if (err2) reject(err2);
                        else resolve();
                    });
                } else {
                    resolve();
                }
            });
        });
    }
    
    /**
     * Procesa archivos pendientes
     */
    async processPendingFiles(limit = 100) {
        const query = \`;
            SELECT af.id, af.file_path 
            FROM audio_files af
            LEFT JOIN audio_features feat ON af.id = feat.file_id
            WHERE feat.file_id IS NULL
            AND af.file_path IS NOT NULL LIMIT ? `;
        
        return new Promise((resolve, reject) => {
            this.db.all(query, [limit], async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log(`📊 Processing ${rows.length} files...\`);
                
                for (const row of rows) { if (!fs.existsSync(row.file_path)) { console.log(\`⚠️ File not found : ${row.file_path}`);
                        continue;
                    } console.log(`🎵 Analyzing: ${path.basename(row.file_path)}\`);
                    const features = await this.analyzeFile(row.file_path);
                    
                    if (features) {
                        await this.saveFeatures(row.id, features);
                        await this.updateLLMMetadata(row.id, features); console.log(\`✅ Saved: BPM=${features.bpm}, Energy=${features.energy.toFixed(2)}, \` + \`Valence=${features.valence.toFixed(2)}`);
                    }
                }
                
                resolve(rows.length);
            });
        });
    }
    
    /**
     * Obtiene estadísticas
     */
    async getStatistics() { return new Promise((resolve, reject) => { const query  = `
                SELECT 
                    COUNT(*) as total_files,
                    COUNT(feat.file_id) as analyzed_files,
                    AVG(feat.energy) as avg_energy,
                    AVG(feat.danceability) as avg_danceability,
                    AVG(feat.valence) as avg_valence,
                    AVG(feat.acousticness) as avg_acousticness
                FROM audio_files af
                LEFT JOIN audio_features feat ON af.id = feat.file_id
            `;
            
            this.db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    close() {
        this.db.close();
    }
}

// CLI interface
if (require.main === module) {
    const analyzer = new EssentiaAnalyzer();
    
    const command = process.argv[2];
    
    switch(command) {
        case 'analyze':
            const filePath = process.argv[3];
            if (!filePath) { console.log('Usage: node node-binding.js analyze <file>');
                process.exit(1);
            }
            analyzer.analyzeFile(filePath).then(features => {
                console.log(JSON.stringify(features, null, 2));
                analyzer.close();
            });
            break;
             case `batch`:
            const limit = parseInt(process.argv[3]) || 100; analyzer.processPendingFiles(limit).then(count => { console.log(\`\n✅ Processed ${count} files\`);
                return analyzer.getStatistics(); }).then(stats => { console.log(`\n📊 Database Statistics:`); console.log(\`   Total files: ${stats.total_files}\`); console.log(`   Analyzed: ${stats.analyzed_files}`); console.log(\`   Average Energy: ${stats.avg_energy?.toFixed(2) || \`N/A`}`); console.log(\`   Average Danceability: ${stats.avg_danceability?.toFixed(2) || \`N/A`}`); console.log(\`   Average Valence: ${stats.avg_valence?.toFixed(2) || \`N/A`}`); console.log(`   Average Acousticness: ${stats.avg_acousticness?.toFixed(2) || 'N/A'}`);
                analyzer.close();
            });
            break; case `stats\`: analyzer.getStatistics().then(stats => { console.log(\`📊 Database Statistics:`); console.log(`   Total files: ${stats.total_files}\`); console.log(\`   Analyzed: ${stats.analyzed_files}`); console.log(`   Pending: ${stats.total_files - stats.analyzed_files}\`); console.log(\`   Average Energy: ${stats.avg_energy?.toFixed(2) || `N/A`}\`); console.log(\`   Average Danceability: ${stats.avg_danceability?.toFixed(2) || `N/A`}\`); console.log(\`   Average Valence: ${stats.avg_valence?.toFixed(2) || `N/A`}\`);
                analyzer.close();
            });
            break;
             default: console.log(\`
Essentia Audio Analyzer - Node.js Binding

Usage:
  node node-binding.js analyze <file>    Analyze single file
  node node-binding.js batch [limit]     Process pending files
  node node-binding.js stats             Show statistics

Examples:
  node node-binding.js analyze song.mp3
  node node-binding.js batch 500
  node node-binding.js stats
            `);
            analyzer.close();
    }
}

module.exports = EssentiaAnalyzer;