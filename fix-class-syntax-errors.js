#!/usr/bin/env node

/**
 * Fix class method syntax errors
 * Removes 'function' keyword from class methods
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing class method syntax errors...\n');

// Get all JS files
function getAllJSFiles() {
    try {
        const output = execSync('find . -name "*.js" -not -path "./node_modules/*" -not -path "./backup*/*" -type f', {
            encoding: 'utf8',
        });
        return output.split('\n').filter((f) => f);
    } catch (error) {
        return [];
    }
}

// Check if file has syntax errors
function hasErrors(file) {
    try {
        execSync(`node -c "${file}" 2>&1`);
        return false;
    } catch (error) {
        return true;
    }
}

// Fix class method syntax
function fixClassMethods(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const original = content;

        // Fix 1: Remove 'function' keyword from class methods
        // Match patterns like "async function methodName(" inside classes
        content = content.replace(/(\s+)(async\s+)?function\s+(\w+)\s*\(/g, (match, indent, async, name) => {
            // Check if this is inside a class by looking at indentation
            if (indent.length >= 4) {
                return `${indent}${async || ''}${name}(`;
            }
            return match;
        });

        // Fix 2: Add missing 'const' or 'let' for arrow functions
        content = content.replace(/^(\s*)(\w+)\s*=\s*\(/gm, '$1const $2 = (');
        content = content.replace(/^(\s*)(\w+)\s*=\s*async\s*\(/gm, '$1const $2 = async (');

        // Fix 3: Add missing 'function' keyword for standalone functions
        content = content.replace(/^(async\s+)?(\w+)\s*\(/gm, (match, async, name) => {
            // Skip if it's a method call or already has function keyword
            if (name === 'require' || name === 'console' || name === 'process' || name === 'module') {
                return match;
            }
            return `${async || ''}function ${name}(`;
        });

        // Fix 4: Template literal issues
        content = content.replace(/console\.log\(`([^`]*)'`\)/g, 'console.log(`$1`)');
        content = content.replace(/console\.log\(`([^`]*)"`\)/g, 'console.log(`$1`)');

        // Fix 5: Missing const/let/var for variable declarations
        content = content.replace(/^(\s*)(\w+)\s*=\s*new\s+/gm, '$1const $2 = new ');
        content = content.replace(/^(\s*)(\w+)\s*=\s*require\(/gm, '$1const $2 = require(');
        content = content.replace(/^(\s*)(\w+)\s*=\s*\{/gm, (match, indent, name) => {
            // Check if it's not already declared
            if (
                !content.includes(`const ${name}`) &&
                !content.includes(`let ${name}`) &&
                !content.includes(`var ${name}`)
            ) {
                return `${indent}const ${name} = {`;
            }
            return match;
        });

        // Fix 6: Add missing semicolons
        content = content.replace(/^(\s*)(const|let|var)\s+(\w+)\s*=\s*([^;{}\n]+)$/gm, '$1$2 $3 = $4;');
        content = content.replace(/^(\s*)(return\s+[^;{}\n]+)$/gm, '$1$2;');

        // Fix 7: Fix logger functions that might not be defined
        if (
            content.includes('logInfo') ||
            content.includes('logError') ||
            content.includes('logDebug') ||
            content.includes('logWarn')
        ) {
            if (!content.includes('const logInfo')) {
                const loggerDefs = `
// Logger functions
const logInfo = console.log;
const logError = console.error;
const logDebug = console.debug;
const logWarn = console.warn;

`;
                content = loggerDefs + content;
            }
        }

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error processing ${filePath}: ${error.message}`);
        return false;
    }
}

// Main
const files = getAllJSFiles();
let fixedCount = 0;
let errorCount = 0;

console.log(`Checking ${files.length} files...\n`);

for (const file of files) {
    if (hasErrors(file)) {
        errorCount++;
        if (fixClassMethods(file)) {
            if (!hasErrors(file)) {
                console.log(`✅ Fixed: ${path.basename(file)}`);
                fixedCount++;
            } else {
                console.log(`⚠️  Partially fixed: ${path.basename(file)}`);
            }
        }
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 Results:');
console.log(`   Files with errors: ${errorCount}`);
console.log(`   Files fixed: ${fixedCount}`);
console.log(`   Remaining errors: ${errorCount - fixedCount}`);

if (errorCount - fixedCount > 0) {
    console.log('\n💡 Run this script again or check remaining files manually');
}
