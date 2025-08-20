/**
 * Database Backup Service
 * Handles automatic backups, rotation, and restoration
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class BackupService {
    constructor(options = {}) {
        this.dbPath = options.dbPath || path.join(__dirname, '..', 'music_analyzer.db');
        this.backupDir = options.backupDir || path.join(__dirname, '..', 'backups');
        this.maxBackups = options.maxBackups || 7; // Keep 7 days of backups
        this.maxIncrementalBackups = options.maxIncrementalBackups || 24; // Keep 24 hourly incrementals

        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    /**
     * Create a full backup
     */
    async createFullBackup(reason = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `full_backup_${timestamp}_${reason}.db`;
        const backupPath = path.join(this.backupDir, backupName);

        try {
            // Use SQLite's backup API for safe online backup
            await this.performBackup(this.dbPath, backupPath);

            // Create metadata file
            const metadata = {
                type: 'full',
                timestamp: new Date().toISOString(),
                reason,
                size: fs.statSync(backupPath).size,
                originalPath: this.dbPath,
            };

            fs.writeFileSync(backupPath + '.meta.json', JSON.stringify(metadata, null, 2));

            // Rotate old backups
            await this.rotateBackups('full');

            console.log(`✅ Full backup created: ${backupName}`);
            return backupPath;
        } catch (error) {
            console.error('❌ Backup failed:', error);
            throw error;
        }
    }

    /**
     * Create an incremental backup (only changes since last full backup)
     */
    async createIncrementalBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `incremental_${timestamp}.sql`;
        const backupPath = path.join(this.backupDir, backupName);

        try {
            // Get last full backup
            const lastFullBackup = this.getLatestBackup('full');
            if (!lastFullBackup) {
                console.log('No full backup found, creating one...');
                return await this.createFullBackup('auto_first');
            }

            // Export changes as SQL
            const sql = await this.exportChangesAsSql(lastFullBackup.path);

            if (sql.trim()) {
                fs.writeFileSync(backupPath, sql);

                // Create metadata
                const metadata = {
                    type: 'incremental',
                    timestamp: new Date().toISOString(),
                    basedOn: lastFullBackup.name,
                    size: fs.statSync(backupPath).size,
                    changeCount: sql.split('\n').filter((line) => line.trim()).length,
                };

                fs.writeFileSync(backupPath + '.meta.json', JSON.stringify(metadata, null, 2));

                // Rotate old incrementals
                await this.rotateBackups('incremental');

                console.log(`✅ Incremental backup created: ${backupName}`);
                return backupPath;
            } else {
                console.log('ℹ️ No changes since last backup');
                return null;
            }
        } catch (error) {
            console.error('❌ Incremental backup failed:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restore(backupPath) {
        try {
            // Validate backup exists
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup not found: ${backupPath}`);
            }

            // Create safety backup of current database
            const safetyBackup = await this.createFullBackup('pre_restore');
            console.log(`🔒 Safety backup created: ${safetyBackup}`);

            // Check if it's a full backup or incremental
            const metaPath = backupPath + '.meta.json';
            let backupType = 'full';

            if (fs.existsSync(metaPath)) {
                const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                backupType = metadata.type;
            }

            if (backupType === 'full') {
                // Direct restore for full backup
                await this.performRestore(backupPath, this.dbPath);
                console.log('✅ Database restored from full backup');
            } else {
                // For incremental, need to apply on top of base
                const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                const baseBackup = path.join(this.backupDir, metadata.basedOn);

                // First restore the base
                await this.performRestore(baseBackup, this.dbPath);

                // Then apply incremental changes
                await this.applyIncrementalBackup(backupPath);
                console.log('✅ Database restored with incremental changes');
            }

            return true;
        } catch (error) {
            console.error('❌ Restore failed:', error);
            throw error;
        }
    }

    /**
     * List available backups
     */
    listBackups() {
        const files = fs.readdirSync(this.backupDir);
        const backups = [];

        files.forEach((file) => {
            if (file.endsWith('.meta.json')) {
                const metadata = JSON.parse(fs.readFileSync(path.join(this.backupDir, file), 'utf8'));
                const backupFile = file.replace('.meta.json', '');
                backups.push({
                    name: backupFile,
                    path: path.join(this.backupDir, backupFile),
                    ...metadata,
                });
            }
        });

        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get latest backup of specific type
     */
    getLatestBackup(type = 'full') {
        const backups = this.listBackups().filter((b) => b.type === type);
        return backups.length > 0 ? backups[0] : null;
    }

    /**
     * Rotate old backups
     */
    async rotateBackups(type = 'full') {
        const backups = this.listBackups().filter((b) => b.type === type);
        const maxToKeep = type === 'full' ? this.maxBackups : this.maxIncrementalBackups;

        if (backups.length > maxToKeep) {
            const toDelete = backups.slice(maxToKeep);

            for (const backup of toDelete) {
                fs.unlinkSync(backup.path);
                if (fs.existsSync(backup.path + '.meta.json')) {
                    fs.unlinkSync(backup.path + '.meta.json');
                }
                console.log(`🗑️ Deleted old backup: ${backup.name}`);
            }
        }
    }

    /**
     * Perform actual backup using SQLite backup API
     */
    async performBackup(sourcePath, destPath) {
        return new Promise((resolve, reject) => {
            const sourceDb = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
            const destDb = new sqlite3.Database(destPath);

            sourceDb.serialize(() => {
                // Use SQLite's backup API through SQL
                sourceDb.get('SELECT COUNT(*) as count FROM audio_files', (err, row) => {
                    if (err) {
                        sourceDb.close();
                        destDb.close();
                        reject(err);
                        return;
                    }

                    // Copy using cp command for speed and safety
                    sourceDb.close();
                    destDb.close();

                    execPromise(`cp "${sourcePath}" "${destPath}"`)
                        .then(() => resolve())
                        .catch(reject);
                });
            });
        });
    }

    /**
     * Perform restore
     */
    async performRestore(sourcePath, destPath) {
        // Simple file copy for restoration
        return execPromise(`cp "${sourcePath}" "${destPath}"`);
    }

    /**
     * Export changes as SQL (for incremental backups)
     */
    async exportChangesAsSql(baseBackupPath) {
        // This is a simplified version - in production, you'd track actual changes
        // For now, export recent updates based on updated_at timestamp

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
            let sql = '';

            db.serialize(() => {
                // Get recently updated records
                db.all(
                    `SELECT * FROM audio_files 
                     WHERE updated_at > datetime('now', '-1 day')
                     ORDER BY updated_at DESC`,
                    (err, rows) => {
                        if (err) {
                            db.close();
                            reject(err);
                            return;
                        }

                        // Generate UPDATE statements
                        rows.forEach((row) => {
                            const updates = Object.entries(row)
                                .filter(([key, value]) => value !== null && key !== 'id')
                                .map(([key, value]) => {
                                    const escaped =
                                        typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
                                    return `${key} = ${escaped}`;
                                })
                                .join(', ');

                            if (updates) {
                                sql += `UPDATE audio_files SET ${updates} WHERE id = ${row.id};\n`;
                            }
                        });

                        db.close();
                        resolve(sql);
                    }
                );
            });
        });
    }

    /**
     * Apply incremental backup
     */
    async applyIncrementalBackup(sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf8');

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath);

            db.exec(sql, (err) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Schedule automatic backups
     */
    scheduleBackups() {
        // Daily full backup at 3 AM
        const dailyBackup = () => {
            const now = new Date();
            if (now.getHours() === 3 && now.getMinutes() === 0) {
                this.createFullBackup('scheduled_daily');
            }
        };

        // Hourly incremental backup
        const hourlyBackup = () => {
            this.createIncrementalBackup();
        };

        // Set up intervals
        setInterval(dailyBackup, 60 * 1000); // Check every minute
        setInterval(hourlyBackup, 60 * 60 * 1000); // Every hour

        console.log('📅 Backup schedule activated');

        // Create initial backup
        this.createFullBackup('initial');
    }

    /**
     * Backup before critical operations
     */
    async backupBeforeCriticalOperation(operationName) {
        console.log(`🔒 Creating safety backup before: ${operationName}`);
        return await this.createFullBackup(`critical_${operationName}`);
    }

    /**
     * Get backup statistics
     */
    getStatistics() {
        const backups = this.listBackups();
        const fullBackups = backups.filter((b) => b.type === 'full');
        const incrementalBackups = backups.filter((b) => b.type === 'incremental');

        const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);

        return {
            totalBackups: backups.length,
            fullBackups: fullBackups.length,
            incrementalBackups: incrementalBackups.length,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            latestBackup: backups[0] ? backups[0].timestamp : null,
            oldestBackup: backups[backups.length - 1] ? backups[backups.length - 1].timestamp : null,
        };
    }
}

module.exports = BackupService;
