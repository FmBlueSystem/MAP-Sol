#!/usr/bin/env node

// GO - El comando más simple posible
// Uso: node go [tracks]

const { execSync } = require('child_process');
const n = process.argv[2] || '10';

logInfo('🚀 Actualizando todo y analizando ${n} tracks...\n');

const commands = [
    'node update-music-library.js',
    'node normalize-all-fields.js 2>/dev/null',
    `node handlers/normalized-llm-handler.js ${n}`,
    'node music-tools.js stats',
];

commands.forEach((cmd) => {
    try {
        execSync(cmd, { stdio: 'inherit', shell: true });
    } catch (e) {}
});

logDebug(`\n✅ Listo! (${n} tracks = ~$${(n * 0.01).toFixed(2)} USD)`);
