#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_ARTWORK_PATH = 'assets/images/default-album.png';

// Files to update (excluding backups and emergency folders)
const filesToUpdate = [
    'src/handlers/track-info-handler.js',
    'src/handlers/artwork-handler-complete.js',
    'src/handlers/artwork-handler.js',
    'src/handlers/energy-flow-handler.js',
    'src/handlers/smart-playlist-handler.js',
    'src/components/audio-player.js',
    'src/components/smart-playlist-wizard.js',
    'js/audio-player.js',
    'js/smart-playlist-wizard.js',
    'test-data-flow.js',
];

function updateFile(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Replace various forms of image.png references
    content = content.replace(/['"]image\.png['"]/g, `'${DEFAULT_ARTWORK_PATH}'`);

    // Special case for path.join references
    content = content.replace(
        /path\.join\(__dirname,\s*['"]\.\.['"],\s*['"]image\.png['"]\)/g,
        `path.join(__dirname, '..', '${DEFAULT_ARTWORK_PATH}')`
    );

    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Updated: ${filePath}`);
        return true;
    } else {
        console.log(`⏭️  No changes needed: ${filePath}`);
        return false;
    }
}

console.log('🎨 Updating default artwork references...\n');
console.log(`New default artwork path: ${DEFAULT_ARTWORK_PATH}\n`);

let updatedCount = 0;

for (const file of filesToUpdate) {
    if (updateFile(file)) {
        updatedCount++;
    }
}

console.log(`\n✅ Update complete! Modified ${updatedCount} files.`);
console.log('\n📝 Note: The following still need to be checked manually:');
console.log('   - Any dynamic references in HTML templates');
console.log('   - References in CSS files');
console.log('   - References in database entries');
