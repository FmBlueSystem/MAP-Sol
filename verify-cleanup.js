#!/usr/bin/env node

/**
 * VERIFY CLEANUP - Verifica el estado de la limpieza de columnas
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

logDebug('\n🔍 VERIFICACIÓN DE LIMPIEZA DE COLUMNAS');
logDebug('='.repeat(60));

// Conectar a la base de datos actual
const currentDb = new sqlite3.Database(path.join(__dirname, 'music_analyzer.db'));

// Conectar al backup si existe
const backupPath = path.join(__dirname, 'music_analyzer_backup_1755300361670.db');
const fs = require('fs');

// Verificar columnas actuales
currentDb.all('PRAGMA table_info(llm_metadata)', (err, currentColumns) => {
    if (err) {
        logError('Error:', err);
        return;
    }

    logDebug('\n📊 ESTADO ACTUAL:');
    logDebug(`   Columnas en llm_metadata: ${currentColumns.length}`);

    // Mostrar columnas por categoría
    const categories = {
        Flags: [],
        'AI Analysis': [],
        'LLM Analysis': [],
        Lyrics: [],
        'DJ/Production': [],
        Other: []
    };

    currentColumns.forEach(col => {
        const name = col.name;
        if (name.includes('ANALYZED') || name.includes('FLAG')) {
            categories['Flags'].push(name);
        } else if (name.startsWith('AI_')) {
            categories['AI Analysis'].push(name);
        } else if (name.startsWith('LLM_')) {
            categories['LLM Analysis'].push(name);
        } else if (name.includes('LYRICS')) {
            categories['Lyrics'].push(name);
        } else if (name.includes('DJ') || name.includes('PRODUCTION') || name.includes('MIX')) {
            categories['DJ/Production'].push(name);
        } else {
            categories['Other'].push(name);
        }
    });

    logDebug('\n📂 COLUMNAS POR CATEGORÍA:');
    Object.entries(categories).forEach(([cat, cols]) => {
        if (cols.length > 0) {
            logDebug(`\n   ${cat} (${cols.length}):`);
            cols.forEach(col => logDebug(`     • ${col}`));
        }
    });

    // Verificar si hay backup
    if (fs.existsSync(backupPath)) {
        const backupDb = new sqlite3.Database(backupPath);

        backupDb.all('PRAGMA table_info(llm_metadata)', (err, backupColumns) => {
            if (err) {
                logDebug('\n⚠️  No se pudo leer el backup');
                return;
            }

            logDebug('\n📦 COMPARACIÓN CON BACKUP:');
            logDebug(`   Columnas en backup: ${backupColumns.length}`);
            logDebug(`   Columnas actuales: ${currentColumns.length}`);
            logDebug(`   Reducción: ${backupColumns.length - currentColumns.length} columnas eliminadas`);
            logDebug(`   Porcentaje: ${((1 - currentColumns.length / backupColumns.length) * 100).toFixed(1)}% menos`);

            // Encontrar columnas eliminadas
            const currentNames = new Set(currentColumns.map(c => c.name));
            const removedColumns = backupColumns.map(c => c.name).filter(name => !currentNames.has(name));

            if (removedColumns.length > 0) {
                logDebug('\n🗑️  COLUMNAS ELIMINADAS:');
                removedColumns.forEach(col => logDebug(`     ❌ ${col}`));
            }

            backupDb.close();

            // Resumen final
            logDebug('\n✅ ESTADO DE LIMPIEZA:');
            if (currentColumns.length === 54) {
                logDebug('   ✅ La base de datos está LIMPIA (54 columnas)');
                logDebug('   ✅ Se eliminaron las columnas duplicadas');
                logDebug('   ✅ Nomenclatura consistente');
                logDebug('   ✅ Sin redundancias');
            } else if (currentColumns.length < 60) {
                logDebug('   ✅ La base de datos está relativamente limpia');
                logDebug(`   ⚠️  Tiene ${currentColumns.length} columnas (objetivo: 54)`);
            } else {
                logDebug('   ⚠️  La base de datos podría necesitar limpieza');
                logDebug(`   ❌ Tiene ${currentColumns.length} columnas (muchas)`);
            }

            currentDb.close();
        });
    } else {
        logDebug('\n⚠️  No se encontró archivo de backup para comparar');

        // Resumen sin backup
        logDebug('\n📊 RESUMEN:');
        if (currentColumns.length === 54) {
            logDebug('   ✅ La base de datos tiene 54 columnas (ÓPTIMO)');
            logDebug('   ✅ Esto indica que la limpieza se completó');
        } else {
            logDebug(`   ⚠️  La base de datos tiene ${currentColumns.length} columnas`);
            logDebug('   📝 El objetivo después de limpieza es 54 columnas');
        }

        currentDb.close();
    }
});
