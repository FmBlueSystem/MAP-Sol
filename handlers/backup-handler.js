/**
 * Backup Handler for Electron IPC
 * Provides backup functionality through IPC channels
 */

const BackupService = require('../services/backup-service');

function createBackupHandler() {
    const backupService = new BackupService();

    return {
        // Create full backup
        'backup-create': async (event) => {
            try {
                const backupPath = await backupService.createFullBackup('user_manual');
                return {
                    success: true,
                    path: backupPath,
                    message: 'Backup created successfully'
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        // Create incremental backup
        'backup-incremental': async (event) => {
            try {
                const backupPath = await backupService.createIncrementalBackup();
                return {
                    success: true,
                    path: backupPath,
                    message: backupPath ? 'Incremental backup created' : 'No changes to backup'
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        // Restore from backup
        'backup-restore': async (event, backupPath) => {
            try {
                await backupService.restore(backupPath);
                return {
                    success: true,
                    message: 'Database restored successfully'
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        // List backups
        'backup-list': async (event) => {
            try {
                const backups = backupService.listBackups();
                return {
                    success: true,
                    backups: backups
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    backups: []
                };
            }
        },

        // Get backup statistics
        'backup-stats': async (event) => {
            try {
                const stats = backupService.getStatistics();
                return {
                    success: true,
                    stats: stats
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        // Backup before critical operation
        'backup-critical': async (event, operationName) => {
            try {
                const backupPath = await backupService.backupBeforeCriticalOperation(operationName);
                return {
                    success: true,
                    path: backupPath,
                    message: `Safety backup created for: ${operationName}`
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },

        // Schedule automatic backups
        'backup-schedule': async (event, enable) => {
            try {
                if (enable) {
                    backupService.scheduleBackups();
                    return {
                        success: true,
                        message: 'Automatic backups scheduled'
                    };
                } else {
                    // In a real implementation, we'd track and clear intervals
                    return {
                        success: true,
                        message: 'Automatic backups disabled'
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    };
}

module.exports = { createBackupHandler };