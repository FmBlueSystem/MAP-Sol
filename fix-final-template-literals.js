#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Final comprehensive fix for all remaining template literal issues
 */

function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let fixCount = 0;
        
        // Find and fix all problematic patterns
        const lines = content.split('\n');
        const fixedLines = lines.map((line, index) => {
            let fixed = line;
            
            // Pattern 1: Fix .join(`,') type patterns
            if (line.includes(".join(`,')") || line.includes('.join(`, ")')) {
                fixed = fixed.replace(/\.join\(`,'\)/g, ".join(',')");
                fixed = fixed.replace(/\.join\(`, '\)/g, ".join(', ')");
                fixed = fixed.replace(/\.join\(`, "\)/g, '.join(", ")');
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed join() pattern`);
                    fixCount++;
                    return fixed;
                }
            }
            
            // Pattern 2: Fix SQL strings with wrong quotes
            if (line.includes("WHERE id = ?'") || line.includes("VALUES (${placeholders})'")) {
                fixed = fixed.replace(/\?'/g, "?`");
                fixed = fixed.replace(/\)'/g, ")`");
                if (fixed !== line) {
                    console.log(`  Line ${index + 1}: Fixed SQL ending`);
                    fixCount++;
                    return fixed;
                }
            }
            
            // Pattern 3: Fix HTML template literals ending with ";
            if (line.trim() === '";' && lines[index - 1] && lines[index - 1].includes('</html>')) {
                fixed = '    `;';
                console.log(`  Line ${index + 1}: Fixed HTML template literal closing`);
                fixCount++;
                return fixed;
            }
            
            // Pattern 4: Fix logInfo/logWarn/logError with mismatched quotes
            if (line.includes('logInfo(`') || line.includes('logWarn(`') || line.includes('logError(`') || line.includes('logDebug(`')) {
                // Check if line ends with '); but contains template literal syntax
                if (line.includes('${') && line.endsWith("');")) {
                    fixed = line.slice(0, -3) + '`);';
                    console.log(`  Line ${index + 1}: Fixed log function template literal`);
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

// Critical files to fix
const files = [
    'services/database-service.js',
    'main-secure.js',
    'main.js',
    'handlers/artwork-handler.js'
];

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
            console.log(`  ✓ No issues found\n`);
        }
    }
});

console.log(`\n📊 Total fixes: ${totalFixes}`);
console.log('✨ Final template literal fixing complete!');