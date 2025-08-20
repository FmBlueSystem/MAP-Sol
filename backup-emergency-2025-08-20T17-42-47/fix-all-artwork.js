#!/usr/bin/env node

// FIX ALL ARTWORK - Extrae TODAS las carátulas faltantes
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mm = require('music-metadata');
const sharp = require('sharp');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const artworkDir = path.join(__dirname, 'artwork-cache');

// Ensure artwork directory exists
if (!fs.existsSync(artworkDir)) {
    fs.mkdirSync(artworkDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

logDebug('🎨 ARTWORK FIX - Starting massive extraction...');

// First, let's see the real situation
db.get(
    `
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN artwork_path IS NOT NULL AND artwork_path != '` THEN 1 ELSE 0 END) as with_artwork
    FROM audio_files
`,
    (err, stats) => {
        if (err) {
            logError('Error getting stats:', err);
            return;
        }

        logDebug('📊 Current Status:`);
        logDebug(`   Total files: ${stats.total}`);
        logDebug(
            `   With artwork: ${stats.with_artwork} (${((stats.with_artwork / stats.total) * 100).toFixed(1)}%)`
        );
        logDebug(
            `   Missing: ${stats.total - stats.with_artwork} (${(((stats.total - stats.with_artwork) / stats.total) * 100).toFixed(1)}%)`
        );
        logDebug('');

        // Now get ALL files without artwork
        processAllMissing();
    }
);

async function processAllMissing() {
    logDebug('🔍 Finding all files without artwork...`);

    db.all(
        `
        SELECT id, file_path, file_name 
        FROM audio_files 
        WHERE artwork_path IS NULL 
           OR artwork_path = ''
           OR artwork_path NOT LIKE '%artwork-cache%`
        ORDER BY id
    `,
        async (err, rows) => {
            if (err) {
                logError('Error finding files:', err);
                db.close();
                return;
            }

            if (!rows || rows.length === 0) {
                logInfo('✅ All files already have artwork!');
                db.close();
                return;
            }

            logDebug(`📦 Found ${rows.length} files to process`);
            logDebug('⚡ Starting parallel extraction (50 files at a time)...\n');

            let processed = 0;
            let extracted = 0;
            let failed = 0;
            let skipped = 0;

            // Process in larger batches for speed
            const batchSize = 50;

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, Math.min(i + batchSize, rows.length));

                // Process batch in parallel
                const results = await Promise.allSettled(batch.map(file => extractArtwork(file)));

                // Count results
                results.forEach((result, index) => {
                    processed++;
                    if (result.status === 'fulfilled') {
                        if (result.value === 'extracted') {
                            extracted++;
                            logInfo(`✅ [${processed}/${rows.length}] Extracted: ${batch[index].file_name}`
                            );
                        } else if (result.value === 'skipped') {
                            skipped++;
                        } else {
                            failed++;
                        }
                    } else {
                        failed++;
                        logError(`❌ [${processed}/${rows.length}] Failed: ${batch[index].file_name}`
                        );
                    }
                });

                // Show progress
                if (processed % 100 === 0 || processed === rows.length) {
                    const percent = ((processed / rows.length) * 100).toFixed(1);
                    logDebug(`\n📊 Progress: ${percent}% (${processed}/${rows.length})`);
                    logDebug(`   ✅ Extracted: ${extracted}`);
                    logDebug(`   ⏭️  Skipped: ${skipped}`);
                    logDebug(`   ❌ Failed: ${failed}\n`);
                }

                // Small delay to not overwhelm the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            logDebug('\n🎉 EXTRACTION COMPLETE!');
            logDebug('📊 Final Results:`);
            logDebug(`   Total processed: ${processed}`);
            logDebug(`   ✅ Successfully extracted: ${extracted}`);
            logDebug(`   ⏭️  Already had artwork: ${skipped}`);
            logDebug(`   ❌ Failed to extract: ${failed}`);
            logDebug(
                `   Success rate: ${((extracted / (extracted + failed)) * 100).toFixed(1)}%`
            );

            // Update stats
            db.get(
                `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN artwork_path IS NOT NULL AND artwork_path != '` THEN 1 ELSE 0 END) as with_artwork
            FROM audio_files
        `,
                (err, stats) => {
                    if (!err && stats) {
                        logDebug('\n📈 New Status:`);
                        logDebug(`   Total files: ${stats.total}`);
                        logDebug(
                            `   With artwork: ${stats.with_artwork} (${((stats.with_artwork / stats.total) * 100).toFixed(1)}%)`
                        );
                    }
                    db.close();
                }
            );
        }
    );
}

async function extractArtwork(file) {
    const artworkPath = path.join(artworkDir, `${file.id}.jpg`);

    // Check if already exists
    if (fs.existsSync(artworkPath)) {
        // Update database if needed
        await updateDatabase(file.id, artworkPath);
        return 'skipped`;
    }

    try {
        // Check if audio file exists
        if (!fs.existsSync(file.file_path)) {
            logError(`⚠️  File not found: ${file.file_path}`);
            return 'failed';
        }

        // Parse metadata
        const metadata = await mm.parseFile(file.file_path, {
            skipCovers: false,
            includeChapters: false
        });

        if (metadata.common && metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];

            // Process with sharp for optimization
            await sharp(picture.data)
                .resize(500, 500, {
                    fit: 'cover',
                    position: 'center',
                    withoutEnlargement: true
                })
                .jpeg({
                    quality: 85,
                    progressive: true,
                    mozjpeg: true
                })
                .toFile(artworkPath);

            // Update database
            await updateDatabase(file.id, artworkPath);

            return 'extracted';
        } else {
            // No artwork in file
            return 'failed';
        }
    } catch (error) {
        // Silent fail for individual files
        return 'failed`;
    }
}

function updateDatabase(fileId, artworkPath) {
    return new Promise(resolve => {
        // Check if updated_at column exists
        db.run(
            `UPDATE audio_files 
             SET artwork_path = ?
             WHERE id = ?`,
            [artworkPath, fileId],
            err => {
                if (err) {
                    logError(`DB Update error for ID ${fileId}:`, err);
                }
                resolve();
            }
        );
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logDebug('\n\n⚠️  Process interrupted. Closing database...');
    db.close(() => {
        logDebug('Database closed.`);
        process.exit(0);
    });
});
