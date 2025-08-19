#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Fix all template literal issues in all JS files
 */

function fixTemplateLiterals(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        let fixCount = 0;

        // Fix all patterns of mismatched quotes/backticks
        const replacements = [
            // Fix patterns like 'text` or "text`
            [/(['"])([^'"`]*)`(?=[,;)\]}])/g, '$1$2$1'],
            // Fix patterns like `text' or `text"
            [/`([^`'"]*)(['"])(?=[,;)\]}])/g, '`$1`'],
            // Fix specific log patterns
            [/(logDebug|logInfo|logWarn|logError)\('([^']*\$\{[^}]*\}[^']*)`\)/g, '$1(`$2`)'],
            [/(logDebug|logInfo|logWarn|logError)\("([^"]*\$\{[^}]*\}[^"]*)`\)/g, '$1(`$2`)'],
            // Fix Error patterns
            [/Error\('([^']*)`\)/g, "Error('$1')"],
            [/Error\("([^"]*)`\)/g, 'Error("$1")'],
            // Fix join patterns
            [/\.join\((['"])([^'"]*)`\)/g, '.join($1$2$1)'],
            // Fix WHERE patterns
            [/WHERE\s+\w+\s*=\s*\?`/g, 'WHERE file_id = ?'],
            // Fix path.join patterns
            [/path\.join\([^)]*`\)/g, function(match) {
                return match.replace(/`\)/, "')");
            }],
            // Fix any remaining standalone backticks at end of strings
            [/(['"])([^'"`]*)`\s*(?=[,;)\]}])/g, '$1$2$1']
        ];

        replacements.forEach(([pattern, replacement]) => {
            const newContent = content.replace(pattern, replacement);
            if (newContent !== content) {
                fixCount += (content.match(pattern) || []).length;
                content = newContent;
            }
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            return fixCount;
        }
        return 0;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return 0;
    }
}

console.log('🔧 Fixing template literal issues in all JS files...\n');

// Find all JS files
const jsFiles = glob.sync('**/*.js', {
    ignore: ['node_modules/**', '.venv/**', 'dist/**', 'build/**', 'fix-*.js']
});

let totalFiles = 0;
let totalFixes = 0;

jsFiles.forEach(file => {
    const fixes = fixTemplateLiterals(file);
    if (fixes > 0) {
        console.log(`✅ Fixed ${fixes} issues in ${file}`);
        totalFiles++;
        totalFixes += fixes;
    }
});

console.log(`\n📊 Results:`);
console.log(`   Files fixed: ${totalFiles}`);
console.log(`   Total fixes: ${totalFixes}`);
console.log('✨ Template literal fixing complete!');