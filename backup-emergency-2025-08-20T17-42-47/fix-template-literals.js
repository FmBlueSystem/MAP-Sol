#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fixes template literal syntax errors caused by incorrect conversion
 */

function fixTemplateLiterals(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        let fixCount = 0;

        // Pattern 1: Fix log functions with single quotes inside template literals
        // logInfo('text ${var} text`) -> logInfo(`text ${var} text`)
        const patterns = [
            // Pattern for logDebug, logInfo, logWarn, logError with mismatched quotes
            /\b(logDebug|logInfo|logWarn|logError)\('([^']*\$\{[^}]+\}[^']*)`\)/g,
            /\b(logDebug|logInfo|logWarn|logError)\("([^"]*\$\{[^}]+\}[^"]*)`\)/g,
            // Pattern for closing backtick without opening
            /\b(logDebug|logInfo|logWarn|logError)\('([^']*)`\)/g,
            /\b(logDebug|logInfo|logWarn|logError)\("([^"]*)`\)/g,
        ];

        patterns.forEach((pattern) => {
            content = content.replace(pattern, (match, func, inner) => {
                fixCount++;
                // If it contains ${}, it should be a template literal
                if (inner.includes('${')) {
                    return `${func}(\`${inner}\`)`;
                }
                // Otherwise, regular string
                return `${func}('${inner}')`;
            });
        });

        // Pattern 2: Fix cases where there's a backtick at the end but quote at start
        // 'text ${var} text` -> `text ${var} text`
        content = content.replace(/(['"])([^'"]*\$\{[^}]+\}[^'"]*)`/g, (match, quote, inner) => {
            fixCount++;
            return '`' + inner + '`';
        });

        // Pattern 3: Fix cases where template literal has wrong closing
        // `text ${var} text' -> `text ${var} text`
        content = content.replace(/`([^`]*\$\{[^}]+\}[^`]*)['"](?=[,;\)])/g, (match, inner) => {
            fixCount++;
            return '`' + inner + '`';
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

// Files to fix
const filesToFix = [
    'main-secure.js',
    'main.js',
    'handlers/artwork-handler.js',
    'handlers/filter-handler.js',
    'handlers/search-handler.js',
    'handlers/audio-handler.js',
    'js/app-production.js',
    'js/audio-player.js',
    'js/audio-panel.js',
    'js/virtual-scroller-production.js',
];

console.log('🔧 Fixing template literal syntax errors...\n');

let totalFixes = 0;

filesToFix.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const fixes = fixTemplateLiterals(filePath);
        if (fixes > 0) {
            console.log(`✅ Fixed ${fixes} issues in ${file}`);
            totalFixes += fixes;
        }
    }
});

console.log(`\n📊 Total fixes: ${totalFixes}`);
console.log('✨ Template literal syntax fixing complete!');
