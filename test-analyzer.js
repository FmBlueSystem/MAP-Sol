/**
 * TEST MUSIC ANALYZER
 * Quick test script to verify the analysis system works
 */

const MusicAnalyzer = require('./music-analyzer-complete');
const path = require('path');
const fs = require('fs');

async function testAnalyzer() {
    logDebug('🧪 TESTING MUSIC ANALYZER SYSTEM\n');
    logDebug('='.repeat(60));

    // Test path - you can change this to your music folder
    const testMusicPath =
        '/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks';

    // Check if path exists
    if (!fs.existsSync(testMusicPath)) {
        logError('❌ Test path does not exist:', testMusicPath);
        logDebug('Please update the testMusicPath variable in this script');
        return;
    }

    // Get first few music files for testing
    const files = fs
        .readdirSync(testMusicPath)
        .filter(f => ['.mp3', '.flac', '.m4a'].includes(path.extname(f).toLowerCase()))
        .slice(0, 3) // Test with only 3 files
        .map(f => path.join(testMusicPath, f));

    if (files.length === 0) {
        logError('❌ No music files found in test directory');
        return;
    }

    logDebug(`📁 Found ${files.length} test files:`);
    files.forEach(f => logDebug(`   - ${path.basename(f)}`));
    logDebug('');

    // Create analyzer instance
    const analyzer = new MusicAnalyzer();

    try {
        // Initialize
        logInfo('🔄 Initializing analyzer...');
        await analyzer.initialize();
        logInfo('✅ Analyzer initialized\n');

        // Test single file analysis
        logDebug('🎵 Testing single file analysis...');
        logDebug('='.repeat(40));

        const testFile = files[0];
        logDebug(`File: ${path.basename(testFile)}\n`);

        // Test Step 1: Metadata extraction
        logDebug('📝 Testing metadata extraction...');
        const metadata = await analyzer.extractMetadata(testFile);
        logInfo('✅ Metadata extracted:');
        logDebug(`   Title: ${metadata.title}`);
        logDebug(`   Artist: ${metadata.artist}`);
        logDebug(`   Album: ${metadata.album}`);
        logDebug(`   Duration: ${Math.round(metadata.duration)}s`);
        logDebug(`   Bitrate: ${metadata.bitrate}`);
        logDebug('');

        // Save to database
        logDebug('💾 Testing database save...');
        const fileId = await analyzer.saveToDatabase(testFile, metadata);
        logInfo('✅ Saved to database with ID: ${fileId}\n');

        // Test Step 2: Artwork extraction
        logDebug('🎨 Testing artwork extraction...');
        const artworkPath = await analyzer.extractArtwork(testFile, fileId, metadata);
        if (artworkPath) {
            logInfo('✅ Artwork extracted to: ${artworkPath}\n');
        } else {
            logWarn('⚠️ No artwork found in file\n');
        }

        // Test Step 3: Feature calculation
        logDebug('🎵 Testing feature calculation...');
        const features = await analyzer.calculateFeatures(testFile, metadata);
        logInfo('✅ Features calculated:');
        logDebug(`   BPM: ${features.AI_BPM}`);
        logDebug(`   Key: ${features.AI_KEY}`);
        logDebug(`   Energy: ${features.AI_ENERGY.toFixed(2)}`);
        logDebug(`   Danceability: ${features.AI_DANCEABILITY.toFixed(2)}`);
        logDebug('');

        // Save features
        logDebug('💾 Saving features to database...');
        await analyzer.saveFeaturesDatabase(fileId, features);
        logInfo('✅ Features saved\n');

        // Test Step 4: AI enrichment (simulated)
        logDebug('🤖 Testing AI enrichment (simulated)...');
        const enrichment = await analyzer.enrichWithAI(metadata, features);
        logInfo('✅ AI enrichment generated:');
        logDebug(`   Genre: ${enrichment.LLM_GENRE}`);
        logDebug(`   Mood: ${enrichment.LLM_MOOD}`);
        logDebug(`   Description: ${enrichment.LLM_DESCRIPTION.substring(0, 50)}...`);
        logDebug('');

        // Test batch processing
        logDebug('📦 Testing batch processing...');
        logDebug('='.repeat(40));
        logDebug(`Processing ${files.length} files...\n`);

        let processed = 0;
        for (const file of files) {
            try {
                await analyzer.analyzeFile(file);
                processed++;
                logInfo('✅ Processed: ${path.basename(file)}');
            } catch (error) {
                logError('❌ Failed: ${path.basename(file)} - ${error.message}');
            }
        }

        logDebug(`\n📊 Batch complete: ${processed}/${files.length} files processed`);
    } catch (error) {
        logError('❌ Test failed:', error);
    } finally {
        // Clean up
        analyzer.close();
        logDebug('\n✅ Analyzer closed');
    }

    logDebug('\n' + '='.repeat(60));
    logDebug('🎉 TEST COMPLETE!');
    logDebug('='.repeat(60));
}

// Run test
testAnalyzer().catch(console.error);
