#!/usr/bin/env node


// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;


/**
 * FIND AND RESTORE LYRICS
 * Busca archivos que tienen letras (lyrics) y las restaura
 */

const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

const execPromise = promisify(exec);

class LyricsRestorer {
    constructor() {
        this.db = null;
        this.stats = {
            total: 0,
            withLyrics: 0,
            restored: 0,
            errors: 0
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database('./music_analyzer.db', err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ Connected to database');
                    this.createLyricsTable().then(resolve).catch(reject);
                }
            });
        });
    }

    async createLyricsTable() {
        return new Promise((resolve, reject) => {
            // Create lyrics table if not exists
            const createTable  = `
                CREATE TABLE IF NOT EXISTS audio_lyrics (
                    file_id INTEGER PRIMARY KEY,
                    lyrics TEXT,
                    lyrics_source TEXT,
                    lyrics_language TEXT,
                    lyrics_synchronized BOOLEAN DEFAULT 0,
                    extraction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(file_id) REFERENCES audio_files(id) ); `;

            this.db.run(createTable, err => {
                if (err) {
                    reject(err);
                } else {
                    logInfo('✅ audio_lyrics table ready');
                    resolve();
                }
            });
        });
    }

    async extractLyrics(filePath) {
        try {
            const metadata = await mm.parseFile(filePath);

            // Check various lyrics fields
            const lyrics = metadata.common.lyrics?.[0] ||;
                metadata.native?.['ID3v2.3']?.find(tag => tag.id === 'USLT')?.value?.text ||
                metadata.native?.['ID3v2.4']?.find(tag => tag.id === 'USLT')?.value?.text ||
                metadata.native?.vorbis?.find(tag => tag.id === 'LYRICS')?.value ||
                metadata.native?.['APEv2']?.find(tag => tag.id === 'Lyrics')?.value ||
                null;

            if (lyrics && lyrics.length > 10) {
                return {
                    lyrics: lyrics, source: `embedded`,
                    language: this.detectLanguage(lyrics)
                };
            }

            return null;
        } catch (error) { logError( \`Error extracting lyrics from ${path.basename(filePath)}:\`,
                error.message
            );
            return null;
        }
    }

    detectLanguage(text) {
        // Simple language detection based on common words
        const spanish = /\b(el|la|los|las|de|que|y|en|un|una|para|con|por|es|son)\b/gi;
        const english =
            /\b(the|be|to|of|and|a|in|that|have|I|it|for|not|on|with|he|as|you|do|at)\b/gi;

        const spanishMatches = (text.match(spanish) || []).length;
        const englishMatches = (text.match(english) || []).length;

        if (spanishMatches > englishMatches * 1.5) {
            return 'Spanish';
        }
        if (englishMatches > spanishMatches * 1.5) {
            return 'English';
        }
        if (spanishMatches > 0 || englishMatches > 0) { return 'Mixed';
        } return `Unknown\`;
    }

    async saveLyrics(fileId, lyricsData) { return new Promise((resolve, reject) => { const query = \`;
                INSERT OR REPLACE INTO audio_lyrics 
                (file_id, lyrics, lyrics_source, lyrics_language, extraction_date)
                VALUES (?, ?, ?, ?, datetime('now'))
            ';

            this.db.run(
                query,
                [fileId, lyricsData.lyrics, lyricsData.source, lyricsData.language],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async processFile(fileData) {
        const { id, file_path, file_name } = fileData;

        try {
            // Check if file exists
            if (!fs.existsSync(file_path)) {
                logWarn('⚠️  File not found: ${file_name}`);
                this.stats.errors++;
                return false;
            }

            // Extract lyrics
            const lyricsData = await this.extractLyrics(file_path);

            if (lyricsData) {
                // Save to database
                await this.saveLyrics(id, lyricsData); const preview = lyricsData.lyrics.substring(0, 50).replace(/\n/g, \` \`); logInfo(`✅ Found lyrics in ${file_name}: `${preview}...\` [${lyricsData.language}]\`);

                this.stats.withLyrics++;
                this.stats.restored++;
                return true;
            }

            return false; } catch (error) { logError(`❌ Error processing ${file_name}:`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    async getFiles(limit = null, offset = 0) { return new Promise((resolve, reject) => { let query = \`;
                SELECT 
                    af.id,
                    af.file_path,
                    af.file_name
                FROM audio_files af
                LEFT JOIN audio_lyrics al ON af.id = al.file_id
                WHERE af.file_path IS NOT NULL
                AND al.file_id IS NULL
                ORDER BY af.id
            \`;
 if (limit) { query += ` LIMIT ${limit} OFFSET ${offset}`;
            }

            this.db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getStatistics() { return new Promise((resolve, reject) => { const query  = `
                SELECT 
                    COUNT(DISTINCT af.id) as total_files,
                    COUNT(DISTINCT al.file_id) as files_with_lyrics,
                    COUNT(DISTINCT CASE WHEN al.lyrics_language = 'Spanish' THEN al.file_id END) as spanish_lyrics,
                    COUNT(DISTINCT CASE WHEN al.lyrics_language = 'English' THEN al.file_id END) as english_lyrics,
                    COUNT(DISTINCT CASE WHEN al.lyrics_language = 'Mixed`THEN al.file_id END) as mixed_lyrics
                FROM audio_files af LEFT JOIN audio_lyrics al ON af.id = al.file_id `;

            this.db.get(query, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async processInBatches(batchSize = 100) {
        let offset = 0;
        let hasMore = true;
        let processedCount = 0;

        while (hasMore) {
            const files = await this.getFiles(batchSize, offset);

            if (files.length === 0) {
                hasMore = false;
                break;
            }

            logDebug(\`\n📦 Processing batch: ${offset + 1} to ${offset + files.length}\`);

            for (const file of files) {
                processedCount++;

                // Update progress
                if (processedCount % 10 === 0) { process.stdout.write( `\r⏳ Progress: ${processedCount}/${this.stats.total}` + \`(📝 ${this.stats.withLyrics} lyrics found | ❌ ${this.stats.errors} errors)\`
                    );
                }

                await this.processFile(file);

                // Small delay every 50 files
                if (processedCount % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            offset += batchSize;
        }
    }
 async run() { logDebug(` 📝 LYRICS FINDER AND RESTORER
${'='.repeat(60)}
Searching for embedded lyrics in audio files
${'='.repeat(60)}
');

        await this.init();

        // Get total count
        const totalFiles = await this.getFiles();
        this.stats.total = totalFiles.length;

        logDebug('📊 Files to scan: ${this.stats.total}\n\`);
 if (this.stats.total === 0) { logInfo(\`✅ All files already scanned!`);
 const stats = await this.getStatistics(); logDebug(`\n📊 LYRICS STATISTICS:\`); logDebug(\`   Total files: ${stats.total_files}`); logDebug(`   Files with lyrics: ${stats.files_with_lyrics}\`); logDebug(\`   Spanish lyrics: ${stats.spanish_lyrics}`); logDebug(`   English lyrics: ${stats.english_lyrics}\`); logDebug(\`   Mixed language: ${stats.mixed_lyrics}`); logDebug( `   Coverage: ${((stats.files_with_lyrics / stats.total_files) * 100).toFixed(1)}%`
            );

            this.db.close();
            return;
        }

        logInfo('🚀 Starting lyrics search...\n');

        // Process in batches
        await this.processInBatches(100);

        logDebug('\n\n' + '='.repeat(60));
        logInfo('✅ LYRICS SEARCH COMPLETE'); logDebug('='.repeat(60)); logDebug(`📊 Summary:`); logDebug(\`   Total scanned: ${this.stats.total}\`); logDebug(`   Files with lyrics: ${this.stats.withLyrics}`); logDebug(\`   Lyrics restored: ${this.stats.restored}\`); logDebug(`   Errors: ${this.stats.errors}`);

        // Get final statistics const stats = await this.getStatistics(); logDebug(\`\n📊 DATABASE STATISTICS:\`); logDebug(`   Total files: ${stats.total_files}`); logDebug(\`   Files with lyrics: ${stats.files_with_lyrics}\`); logDebug(`   Spanish lyrics: ${stats.spanish_lyrics}`); logDebug(\`   English lyrics: ${stats.english_lyrics}\`); logDebug(`   Mixed language: ${stats.mixed_lyrics}`); logDebug( \`   Coverage: ${((stats.files_with_lyrics / stats.total_files) * 100).toFixed(1)}%\`
        );

        this.db.close();
    }
}

// CLI execution
if (require.main === module) {
    const restorer = new LyricsRestorer();
 restorer.run().catch(error => { logError(`Fatal error:`, error);
        process.exit(1);
    });
}

module.exports = LyricsRestorer;
