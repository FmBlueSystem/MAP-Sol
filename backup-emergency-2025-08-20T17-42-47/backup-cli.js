#!/usr/bin/env node

/**
 * Backup CLI - Command line interface for database backup management
 */

const BackupService = require('./services/backup-service');
const path = require('path');
const fs = require('fs');

// Initialize backup service
const backupService = new BackupService();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m',
};

function printHelp() {
    console.log(`
${colors.bright}📦 Music Analyzer Database Backup Tool${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node backup-cli.js <command> [options]

${colors.yellow}Commands:${colors.reset}
  ${colors.green}backup${colors.reset}              Create a full backup
  ${colors.green}backup-incremental${colors.reset}  Create an incremental backup
  ${colors.green}restore <file>${colors.reset}      Restore from a backup file
  ${colors.green}list${colors.reset}                List all available backups
  ${colors.green}stats${colors.reset}               Show backup statistics
  ${colors.green}schedule${colors.reset}            Start automatic backup scheduler
  ${colors.green}clean${colors.reset}               Clean old backups (keep last 7 days)
  ${colors.green}help${colors.reset}                Show this help message

${colors.yellow}Examples:${colors.reset}
  node backup-cli.js backup
  node backup-cli.js restore backups/full_backup_2025-08-19_manual.db
  node backup-cli.js list
  node backup-cli.js schedule

${colors.blue}Notes:${colors.reset}
  - Full backups are created daily
  - Incremental backups are created hourly
  - Backups are stored in the 'backups' directory
  - Old backups are automatically rotated
`);
}

async function handleCommand() {
    try {
        switch (command) {
            case 'backup':
            case 'full':
                console.log(`${colors.blue}Creating full backup...${colors.reset}`);
                const fullBackupPath = await backupService.createFullBackup('manual');
                console.log(`${colors.green}✅ Backup completed: ${fullBackupPath}${colors.reset}`);
                break;

            case 'backup-incremental':
            case 'incremental':
                console.log(`${colors.blue}Creating incremental backup...${colors.reset}`);
                const incBackupPath = await backupService.createIncrementalBackup();
                if (incBackupPath) {
                    console.log(`${colors.green}✅ Incremental backup completed: ${incBackupPath}${colors.reset}`);
                } else {
                    console.log(`${colors.yellow}ℹ️ No changes to backup${colors.reset}`);
                }
                break;

            case 'restore':
                if (!options[0]) {
                    console.error(`${colors.red}❌ Please specify a backup file to restore${colors.reset}`);
                    console.log('Example: node backup-cli.js restore backups/full_backup_2025-08-19.db');
                    process.exit(1);
                }

                const backupFile = options[0];
                console.log(`${colors.blue}Restoring from: ${backupFile}...${colors.reset}`);

                // Confirm restoration
                console.log(`${colors.yellow}⚠️ Warning: This will replace the current database!${colors.reset}`);
                console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

                await new Promise((resolve) => setTimeout(resolve, 5000));

                await backupService.restore(backupFile);
                console.log(`${colors.green}✅ Database restored successfully${colors.reset}`);
                break;

            case 'list':
                const backups = backupService.listBackups();

                if (backups.length === 0) {
                    console.log(`${colors.yellow}No backups found${colors.reset}`);
                } else {
                    console.log(`\n${colors.bright}📋 Available Backups:${colors.reset}\n`);

                    // Group by type
                    const fullBackups = backups.filter((b) => b.type === 'full');
                    const incrementalBackups = backups.filter((b) => b.type === 'incremental');

                    if (fullBackups.length > 0) {
                        console.log(`${colors.green}Full Backups:${colors.reset}`);
                        fullBackups.forEach((backup) => {
                            const size = (backup.size / 1024 / 1024).toFixed(2);
                            const date = new Date(backup.timestamp).toLocaleString();
                            console.log(`  📦 ${backup.name}`);
                            console.log(`     ${colors.blue}Date:${colors.reset} ${date}`);
                            console.log(`     ${colors.blue}Size:${colors.reset} ${size} MB`);
                            console.log(`     ${colors.blue}Reason:${colors.reset} ${backup.reason || 'N/A'}`);
                            console.log();
                        });
                    }

                    if (incrementalBackups.length > 0) {
                        console.log(`${colors.yellow}Incremental Backups:${colors.reset}`);
                        incrementalBackups.forEach((backup) => {
                            const size = (backup.size / 1024 / 1024).toFixed(2);
                            const date = new Date(backup.timestamp).toLocaleString();
                            console.log(`  📄 ${backup.name}`);
                            console.log(`     ${colors.blue}Date:${colors.reset} ${date}`);
                            console.log(`     ${colors.blue}Size:${colors.reset} ${size} MB`);
                            console.log(`     ${colors.blue}Based on:${colors.reset} ${backup.basedOn || 'N/A'}`);
                            console.log(`     ${colors.blue}Changes:${colors.reset} ${backup.changeCount || 0}`);
                            console.log();
                        });
                    }
                }
                break;

            case 'stats':
            case 'statistics':
                const stats = backupService.getStatistics();
                console.log(`\n${colors.bright}📊 Backup Statistics:${colors.reset}\n`);
                console.log(`${colors.blue}Total backups:${colors.reset} ${stats.totalBackups}`);
                console.log(`${colors.blue}Full backups:${colors.reset} ${stats.fullBackups}`);
                console.log(`${colors.blue}Incremental backups:${colors.reset} ${stats.incrementalBackups}`);
                console.log(`${colors.blue}Total size:${colors.reset} ${stats.totalSizeMB} MB`);
                if (stats.latestBackup) {
                    console.log(
                        `${colors.blue}Latest backup:${colors.reset} ${new Date(stats.latestBackup).toLocaleString()}`
                    );
                }
                if (stats.oldestBackup) {
                    console.log(
                        `${colors.blue}Oldest backup:${colors.reset} ${new Date(stats.oldestBackup).toLocaleString()}`
                    );
                }
                break;

            case 'schedule':
            case 'auto':
                console.log(`${colors.blue}Starting automatic backup scheduler...${colors.reset}`);
                backupService.scheduleBackups();
                console.log(`${colors.green}✅ Scheduler started${colors.reset}`);
                console.log('Full backups: Daily at 3:00 AM');
                console.log('Incremental backups: Every hour');
                console.log('\nPress Ctrl+C to stop the scheduler');

                // Keep the process running
                process.on('SIGINT', () => {
                    console.log(`\n${colors.yellow}Scheduler stopped${colors.reset}`);
                    process.exit(0);
                });
                break;

            case 'clean':
            case 'rotate':
                console.log(`${colors.blue}Cleaning old backups...${colors.reset}`);
                await backupService.rotateBackups('full');
                await backupService.rotateBackups('incremental');
                console.log(`${colors.green}✅ Old backups cleaned${colors.reset}`);

                // Show remaining backups
                const remaining = backupService.listBackups();
                console.log(`Remaining backups: ${remaining.length}`);
                break;

            case 'help':
            case undefined:
                printHelp();
                break;

            default:
                console.error(`${colors.red}❌ Unknown command: ${command}${colors.reset}`);
                printHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Run the command
handleCommand();
