const fs = require('fs');

const filePath = './js/audio-panel.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the indentation issues by finding lines that should be indented
const lines = content.split('\n');
let inBlock = false;
let blockDepth = 0;
const fixedLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track block depth
    if (trimmed.startsWith('if (') || trimmed.startsWith('} else') || trimmed.startsWith('else {')) {
        fixedLines.push(' '.repeat(blockDepth * 4) + trimmed);
        if (trimmed.endsWith('{')) {
            blockDepth++;
        }
    } else if (trimmed === '}') {
        blockDepth = Math.max(0, blockDepth - 1);
        fixedLines.push(' '.repeat(blockDepth * 4) + trimmed);
    } else if (trimmed.startsWith('{')) {
        fixedLines.push(' '.repeat(blockDepth * 4) + trimmed);
        blockDepth++;
    } else if (trimmed && !line.match(/^\s/)) {
        // Line without indentation that should have it
        if (blockDepth > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
            fixedLines.push(' '.repeat(blockDepth * 4) + trimmed);
        } else {
            fixedLines.push(line);
        }
    } else {
        fixedLines.push(line);
    }
}

fs.writeFileSync(filePath, fixedLines.join('\n'));
console.log('Fixed audio-panel.js indentation');
