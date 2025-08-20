#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Comprehensive fix for all template literal errors
 */

function fixFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let fixCount = 0;

        // Find all lines with mismatched backticks
        const lines = content.split('\n');
        const fixedLines = lines.map((line, index) => {
            // Check for patterns like 'text` or "text` at end of strings
            if (line.match(/['"][^'"]*`\s*\)/)) {
                const fixed = line.replace(/(['"])([^'"]*)`(\s*\))/g, '$1$2$1$3');
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed ending backtick`);
                    fixCount++;
                    return fixed;
                }
            }

            // Check for `text' or `text" patterns
            if (line.match(/`[^`]*['"](?=[,;\)])/)) {
                const fixed = line.replace(/`([^`]*)(['"])(?=[,;\)])/g, '`$1`');
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed closing quote`);
                    fixCount++;
                    return fixed;
                }
            }

            // Fix specific Error patterns
            if (line.includes("Error('") && line.includes('`);')) {
                const fixed = line.replace(/Error\('([^']*)`\);/g, "Error('$1');");
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed Error() statement`);
                    fixCount++;
                    return fixed;
                }
            }

            // Fix WHERE clauses
            if (line.includes('WHERE file_id = ?`')) {
                const fixed = line.replace(/WHERE file_id = \?`/g, 'WHERE file_id = ?');
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed WHERE clause`);
                    fixCount++;
                    return fixed;
                }
            }

            // Fix .join() patterns
            if (line.includes(".join(', `)")) {
                const fixed = line.replace(/\.join\(', `\)/g, ".join(', ')");
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed join() statement`);
                    fixCount++;
                    return fixed;
                }
            }

            return line;
        });

        if (fixCount > 0) {
            fs.writeFileSync(filePath, fixedLines.join('\n'));
            return fixCount;
        }

        return 0;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return 0;
    }
}

// Fix main files with issues
const files = ['main-secure.js', 'js/virtual-scroller-production.js'];

console.log('🔧 Final template literal fixes...\n');

let totalFixes = 0;
files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`Checking ${file}...`);
        const fixes = fixFile(filePath);
        if (fixes > 0) {
            console.log(`  ✅ Fixed ${fixes} issues\n`);
            totalFixes += fixes;
        } else {
            console.log('  ✓ No issues found\n');
        }
    }
});

console.log(`\n📊 Total fixes: ${totalFixes}`);
console.log('✨ Template literal fixing complete!');
