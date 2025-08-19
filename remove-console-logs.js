#!/usr/bin/env node

/**
 * Script to remove console.log statements from production code
 * Preserves console.error, console.warn, and other console methods
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Directories to process
const directories = ['js/', 'handlers/'];

// Pattern to match console.log statements (including multiline)
const consoleLogPattern = /console\.log\([^)]*\);?/g;
const multilineConsoleLogPattern = /console\.log\([^)]*\n[^)]*\);?/g;

let totalRemoved = 0;
let filesProcessed = 0;

// Function to process a single file
function processFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Count console.logs before removal
        const matches = content.match(consoleLogPattern) || [];
        const multilineMatches = content.match(multilineConsoleLogPattern) || [];
        const totalMatches = matches.length + multilineMatches.length;

        if (totalMatches > 0) {
            // Remove console.log statements
            content = content.replace(consoleLogPattern, '');
            content = content.replace(multilineConsoleLogPattern, '');

            // Clean up empty lines left behind
            content = content.replace(/^\s*\n/gm, '\n');
            content = content.replace(/\n\n\n+/g, '\n\n');

            // Write back only if content changed
            if (content !== originalContent) {
                fs.writeFileSync(filePath, content, 'utf8');
                logInfo('✅ Processed ${filePath}: Removed ${totalMatches} console.log statements');
                totalRemoved += totalMatches;
                filesProcessed++;
            }
        }
    } catch (error) {
        logError(`❌ Error processing ${filePath}:`, error.message);
    }
}

// Main execution
logDebug('🧹 Starting console.log cleanup...');
logDebug('================================================');

directories.forEach(dir => {
    const pattern = path.join(dir, '**/*.js');
    const files = glob.sync(pattern);

    logDebug(`\n📁 Processing ${dir} (${files.length} files)...`);

    files.forEach(file => {
        // Skip certain files that might need console.logs
        const skipFiles = ['logger.js', 'debug-', 'test-', 'validate-'];

        const shouldSkip = skipFiles.some(skip => file.includes(skip));

        if (!shouldSkip) {
            processFile(file);
        } else {
            logDebug(`⏭️  Skipping ${file} (debug/test file)`);
        }
    });
});

logDebug('\n================================================');
logDebug('✨ Cleanup complete!');
logDebug('📊 Statistics:');
logDebug(`   - Files processed: ${filesProcessed}`);
logDebug(`   - Console.logs removed: ${totalRemoved}`);
logDebug(
    `   - Average per file: ${filesProcessed > 0 ? (totalRemoved / filesProcessed).toFixed(1) : 0}`
);

// Create a backup note
const backupNote = {
    date: new Date().toISOString(),
    filesProcessed,
    consoleLogsRemoved: totalRemoved,
    directories: directories
};

fs.writeFileSync('console-log-removal.json', JSON.stringify(backupNote, null, 2));
logDebug('\n💾 Backup note saved to console-log-removal.json');
logDebug('\n✅ Production code is now cleaner!');
