#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Simple logging for Node.js environment
const logInfo = (...args) => console.log(...args);
const logDebug = (...args) => console.log('\x1b[90m', ...args, '\x1b[0m');
const logWarn = (...args) => console.log('\x1b[33m', ...args, '\x1b[0m');
const logError = (...args) => console.error('\x1b[31m', ...args, '\x1b[0m');

const dbPath = path.join(__dirname, 'music_analyzer.db');
const db = new sqlite3.Database(dbPath);

logInfo('🔍 Diagnosing Failed Audio Analysis Files');
logInfo('==========================================\n');

// Read the error file
async function getFailedFiles() {
    const errorFile = path.join(__dirname, 'missing_89_errors.txt');
    if (!fs.existsSync(errorFile)) {
        logError('❌ missing_89_errors.txt not found');
        return [];
    }
    
    const content = fs.readFileSync(errorFile, 'utf8');
    const files = content.split('\n')
        .filter(line => line.includes('ANALYSIS_FAILED:'))
        .map(line => line.replace('ANALYSIS_FAILED: ', '').trim())
        .filter(f => f);
    
    return files;
}

// Check if file exists in database
async function checkInDatabase(fileName) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id, file_path FROM audio_files WHERE file_name = ?`,
            [fileName],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Check if file exists on disk
async function checkOnDisk(filePath) {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
            exists: true,
            size: stats.size,
            readable: true
        };
    }
    return { exists: false };
}

// Check file format with ffprobe
async function checkWithFFprobe(filePath) {
    try {
        const { stdout } = await execPromise(`ffprobe -v error -show_format -show_streams -print_format json "${filePath}"`);
        const data = JSON.parse(stdout);
        return {
            success: true,
            format: data.format?.format_name,
            duration: data.format?.duration,
            bitrate: data.format?.bit_rate,
            codec: data.streams?.[0]?.codec_name
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Main diagnostic function
async function diagnoseFiles() {
    const failedFiles = await getFailedFiles();
    logInfo(`📊 Total failed files: ${failedFiles.length}\n`);
    
    const diagnostics = {
        total: failedFiles.length,
        notInDB: [],
        notOnDisk: [],
        formatIssues: [],
        flacFiles: [],
        m4aFiles: [],
        fixable: []
    };
    
    for (const fileName of failedFiles) {
        logDebug(`\nChecking: ${fileName}`);
        
        // Check in database
        const dbRecord = await checkInDatabase(fileName);
        if (!dbRecord) {
            logWarn(`  ❌ Not in database`);
            diagnostics.notInDB.push(fileName);
            continue;
        }
        
        // Check on disk
        const diskCheck = await checkOnDisk(dbRecord.file_path);
        if (!diskCheck.exists) {
            logWarn(`  ❌ File not found on disk: ${dbRecord.file_path}`);
            diagnostics.notOnDisk.push(fileName);
            continue;
        }
        
        logDebug(`  ✅ File exists (${(diskCheck.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Check file format
        const extension = path.extname(fileName).toLowerCase();
        if (extension === '.flac') {
            diagnostics.flacFiles.push(fileName);
        } else if (extension === '.m4a') {
            diagnostics.m4aFiles.push(fileName);
        }
        
        // Check with ffprobe
        const ffprobeCheck = await checkWithFFprobe(dbRecord.file_path);
        if (!ffprobeCheck.success) {
            logWarn(`  ⚠️ FFprobe failed: ${ffprobeCheck.error}`);
            diagnostics.formatIssues.push({
                file: fileName,
                error: ffprobeCheck.error
            });
        } else {
            logDebug(`  ✅ Format: ${ffprobeCheck.format}, Codec: ${ffprobeCheck.codec}`);
            diagnostics.fixable.push({
                fileName,
                filePath: dbRecord.file_path,
                format: ffprobeCheck.format,
                codec: ffprobeCheck.codec
            });
        }
    }
    
    // Summary
    logInfo('\n📊 DIAGNOSTIC SUMMARY');
    logInfo('====================');
    logInfo(`Total failed files: ${diagnostics.total}`);
    logInfo(`FLAC files: ${diagnostics.flacFiles.length}`);
    logInfo(`M4A files: ${diagnostics.m4aFiles.length}`);
    logInfo(`Not in database: ${diagnostics.notInDB.length}`);
    logInfo(`Not on disk: ${diagnostics.notOnDisk.length}`);
    logInfo(`Format issues: ${diagnostics.formatIssues.length}`);
    logInfo(`Potentially fixable: ${diagnostics.fixable.length}`);
    
    // Recommendations
    logInfo('\n💡 RECOMMENDATIONS');
    logInfo('==================');
    
    if (diagnostics.flacFiles.length > 0) {
        logInfo('• FLAC files may need special handling or updated decoder');
    }
    
    if (diagnostics.m4aFiles.length > 0) {
        logInfo('• M4A files may need AAC codec support');
    }
    
    if (diagnostics.notInDB.length > 0) {
        logInfo(`• ${diagnostics.notInDB.length} files need to be re-imported to database`);
    }
    
    if (diagnostics.notOnDisk.length > 0) {
        logInfo(`• ${diagnostics.notOnDisk.length} files are missing from disk`);
    }
    
    if (diagnostics.fixable.length > 0) {
        logInfo(`• ${diagnostics.fixable.length} files can potentially be re-analyzed`);
        
        // Save fixable files list
        const fixableList = diagnostics.fixable.map(f => f.filePath).join('\n');
        fs.writeFileSync('fixable_files.txt', fixableList);
        logInfo('• List of fixable files saved to fixable_files.txt');
    }
    
    db.close();
    
    return diagnostics;
}

// Run diagnostics
diagnoseFiles()
    .then(results => {
        logInfo('\n✅ Diagnostic complete');
        
        // Save full diagnostic report
        fs.writeFileSync('diagnostic_report.json', JSON.stringify(results, null, 2));
        logInfo('📄 Full report saved to diagnostic_report.json');
    })
    .catch(error => {
        logError('❌ Diagnostic failed:', error);
        db.close();
    });