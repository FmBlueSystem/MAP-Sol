#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files with syntax errors found
const filesToFix = [
    'js/audio-panel.js',
    'js/music-analyzer-ui.js',
    'js/player-fix-complete.js',
    'js/player-fix.js',
    'js/player-simple-working.js',
    'js/playlist-database-ui.js',
    'js/playlist-folders-ui.js',
    'js/playlist-integration.js',
    'js/playlist-shortcuts.js',
    'js/production-monitor.js',
    'js/professional-meter-suite.js',
    'js/shared-player-state.js',
    'js/theme-controller.js',
    'js/track-selector-modal.js',
    'js/virtual-scroller-enhanced.js',
    'js/virtual-scroller-integration.js',
    'handlers/export-handler-broken.js',
    'utils/artwork-helper.js'
];

function fixFile(filePath) {
    console.log(`Fixing: ${filePath}`);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Fix 1: Template literal with wrong closing quote
        // Pattern: `...${...}' or `...${...}"
        content = content.replace(/`([^`]*)\$\{([^}]*)\}([^`]*)'/g, '`$1\${$2}$3`');
        content = content.replace(/`([^`]*)\$\{([^}]*)\}([^`]*)"/g, '`$1\${$2}$3`');
        
        // Fix 2: Template literal in return statement with wrong quote
        content = content.replace(/return `([^`]*)'[;,]/g, 'return `$1`;');
        content = content.replace(/return `([^`]*)";/g, 'return `$1`;');
        
        // Fix 3: InnerHTML with mixed quotes
        content = content.replace(/innerHTML = `([^`]*)";/g, 'innerHTML = `$1`;');
        content = content.replace(/innerHTML = `([^`]*)';/g, 'innerHTML = `$1`;');
        
        // Fix 4: ShowNotification with unclosed quotes
        content = content.replace(/showNotification\(`([^`]*)"", /g, 'showNotification(`$1"`, ');
        content = content.replace(/showNotification\(`([^`]*)""([^)]*)\)/g, 'showNotification(`$1"$2)`');
        
        // Fix 5: Missing closing braces at end of file
        // Count opening and closing braces
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        if (openBraces > closeBraces) {
            const diff = openBraces - closeBraces;
            console.log(`  Adding ${diff} closing brace(s)`);
            for (let i = 0; i < diff; i++) {
                content += '\n}';
            }
        }
        
        // Fix 6: Remove CSS code from JS files
        if (content.includes(':root {') || content.includes('.analyzer-modal {')) {
            console.log('  Removing CSS code from JS file');
            // Remove CSS blocks
            content = content.replace(/`\s*\n?\s*\.[\w-]+\s*\{[^`]*$/gm, '`;');
            content = content.replace(/`\s*\n?\s*:root\s*\{[^`]*$/gm, '`;');
        }
        
        // Save if changed
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  ✅ Fixed and saved`);
            return true;
        } else {
            console.log(`  ℹ️ No changes needed`);
            return false;
        }
        
    } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        return false;
    }
}

// Main execution
console.log('=== Fixing Syntax Errors in JavaScript Files ===\n');

let fixedCount = 0;
let errorCount = 0;

filesToFix.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        if (fixFile(fullPath)) {
            fixedCount++;
        }
    } else {
        console.log(`  ⚠️ File not found: ${file}`);
        errorCount++;
    }
    console.log('');
});

console.log('=== Summary ===');
console.log(`✅ Fixed: ${fixedCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log('\n⚠️ Please run validation to check if all errors are fixed:');
console.log('for f in js/*.js handlers/*.js utils/*.js; do node -c "$f" 2>&1; done | grep -i error');