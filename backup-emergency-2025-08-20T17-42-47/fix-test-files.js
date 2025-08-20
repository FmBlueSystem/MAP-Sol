#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Fix template literal issues in test files
 */

function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        let fixCount = 0;

        // Fix mismatched quotes in template literals
        content = content.replace(/(['"])([^'"]*\$\{[^}]*\}[^'"]*)`/g, '`$2`');
        content = content.replace(/`([^`]*\$\{[^}]*\}[^`]*)(['"])/g, '`$1`');

        // Fix join patterns
        content = content.replace(/\.join\(`,\s*'\)/g, ".join(', ')");
        content = content.replace(/\.join\(`,'\)/g, ".join(',')");

        // Check if changes were made
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            fixCount = (originalContent.match(/[`'"]/g) || []).length - (content.match(/[`'"]/g) || []).length;
            return Math.abs(fixCount) || 1;
        }

        return 0;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return 0;
    }
}

console.log('🔧 Fixing test files...\n');

const testFiles = glob.sync('tests/**/*.js');

let totalFixes = 0;
testFiles.forEach((file) => {
    const fixes = fixFile(file);
    if (fixes > 0) {
        console.log(`✅ Fixed ${file}`);
        totalFixes += fixes;
    }
});

console.log(`\n📊 Total fixes: ${totalFixes}`);
console.log('✨ Test files fixed!');
