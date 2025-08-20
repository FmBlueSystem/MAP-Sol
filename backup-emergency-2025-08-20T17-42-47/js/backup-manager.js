/**
 * Backup Manager UI Component
 * Provides frontend interface for database backup management
 */

class BackupManager {
    constructor() {
        this.isInitialized = false;
        this.backupList = [];
        this.isProcessing = false;
    }

    /**
     * Initialize the backup manager UI
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        // Add backup button to UI
        this.addBackupButton();

        // Load initial backup list
        await this.loadBackupList();

        this.isInitialized = true;
        logInfo('✅ Backup Manager initialized');
    }

    /**
     * Add backup button to the UI
     */
    addBackupButton() {
        // Find a suitable location in the UI (e.g., settings menu or toolbar)
        const toolbar = document.querySelector('.toolbar') || document.querySelector('.settings-menu');

        if (!toolbar) {
            logWarn('No suitable location found for backup button');
            return;
        }

        // Create backup button
        const backupBtn = document.createElement('button');
        backupBtn.className = 'backup-btn';
        backupBtn.innerHTML = '💾 Backup';
        backupBtn.title = 'Database Backup Management';
        backupBtn.onclick = () => this.showBackupModal();

        toolbar.appendChild(backupBtn);
    }

    /**
     * Show backup management modal
     */
    showBackupModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('backup-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'backup-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="backupManager.closeModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📦 Database Backup Management</h2>
                    <button class="modal-close" onclick="backupManager.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="backup-actions">
                        <button class="btn btn-primary" onclick="backupManager.createBackup()">
                            💾 Create Full Backup
                        </button>
                        <button class="btn btn-secondary" onclick="backupManager.createIncrementalBackup()">
                            📄 Incremental Backup
                        </button>
                        <button class="btn btn-info" onclick="backupManager.showStatistics()">
                            📊 Statistics
                        </button>
                    </div>
                    
                    <div class="backup-list-container">
                        <h3>Available Backups</h3>
                        <div id="backup-list" class="backup-list">
                            <div class="loading">Loading backups...</div>
                        </div>
                    </div>
                    
                    <div id="backup-stats" class="backup-stats" style="display: none;">
                        <!-- Statistics will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Load backup list
        this.loadBackupList();
    }

    /**
     * Close the backup modal
     */
    closeModal() {
        const modal = document.getElementById('backup-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * Load list of available backups
     */
    async loadBackupList() {
        try {
            const result = await window.electronAPI.invoke('backup-list');

            if (result.success) {
                this.backupList = result.backups;
                this.renderBackupList();
            } else {
                this.showError('Failed to load backups: ' + result.error);
            }
        } catch (error) {
            logError('Error loading backup list:', error);
            this.showError('Failed to load backup list');
        }
    }

    /**
     * Render the backup list
     */
    renderBackupList() {
        const listContainer = document.getElementById('backup-list');
        if (!listContainer) {
            return;
        }

        if (this.backupList.length === 0) {
            listContainer.innerHTML = '<div class="no-backups">No backups found</div>';
            return;
        }

        // Group backups by type
        const fullBackups = this.backupList.filter((b) => b.type === 'full');
        const incrementalBackups = this.backupList.filter((b) => b.type === 'incremental');

        let html = '';

        if (fullBackups.length > 0) {
            html += '<div class="backup-group"><h4>Full Backups</h4>';
            fullBackups.forEach((backup) => {
                const date = new Date(backup.timestamp).toLocaleString();
                const sizeMB = (backup.size / 1024 / 1024).toFixed(2);

                html += `
                    <div class="backup-item">
                        <div class="backup-info">
                            <div class="backup-name">${backup.name}</div>
                            <div class="backup-meta">
                                ${date} • ${sizeMB} MB • ${backup.reason || 'Manual'}
                            </div>
                        </div>
                        <div class="backup-actions">
                            <button class="btn btn-small" onclick="backupManager.restoreBackup('${backup.path}')">
                                Restore
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (incrementalBackups.length > 0) {
            html += '<div class="backup-group"><h4>Incremental Backups</h4>';
            incrementalBackups.forEach((backup) => {
                const date = new Date(backup.timestamp).toLocaleString();
                const sizeMB = (backup.size / 1024 / 1024).toFixed(2);

                html += `
                    <div class="backup-item">
                        <div class="backup-info">
                            <div class="backup-name">${backup.name}</div>
                            <div class="backup-meta">
                                ${date} • ${sizeMB} MB • Based on: ${backup.basedOn || 'N/A'}
                            </div>
                        </div>
                        <div class="backup-actions">
                            <button class="btn btn-small" onclick="backupManager.restoreBackup('${backup.path}')">
                                Restore
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        listContainer.innerHTML = html;
    }

    /**
     * Create a full backup
     */
    async createBackup() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.showLoading('Creating full backup...');

        try {
            const result = await window.electronAPI.invoke('backup-create');

            if (result.success) {
                this.showSuccess('Backup created successfully!');
                await this.loadBackupList();
            } else {
                this.showError('Backup failed: ' + result.error);
            }
        } catch (error) {
            logError('Error creating backup:', error);
            this.showError('Failed to create backup');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Create an incremental backup
     */
    async createIncrementalBackup() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.showLoading('Creating incremental backup...');

        try {
            const result = await window.electronAPI.invoke('backup-incremental');

            if (result.success) {
                if (result.path) {
                    this.showSuccess('Incremental backup created!');
                } else {
                    this.showInfo('No changes to backup');
                }
                await this.loadBackupList();
            } else {
                this.showError('Backup failed: ' + result.error);
            }
        } catch (error) {
            logError('Error creating incremental backup:', error);
            this.showError('Failed to create incremental backup');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Restore from a backup
     */
    async restoreBackup(backupPath) {
        if (this.isProcessing) {
            return;
        }

        // Confirm restoration
        const confirmed = confirm(
            '⚠️ Warning: This will replace the current database!\n\n' +
                'A safety backup will be created first.\n\n' +
                'Do you want to continue?'
        );

        if (!confirmed) {
            return;
        }

        this.isProcessing = true;
        this.showLoading('Restoring database...');

        try {
            const result = await window.electronAPI.invoke('backup-restore', backupPath);

            if (result.success) {
                this.showSuccess('Database restored successfully!');

                // Reload the application data
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                this.showError('Restore failed: ' + result.error);
            }
        } catch (error) {
            logError('Error restoring backup:', error);
            this.showError('Failed to restore backup');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Show backup statistics
     */
    async showStatistics() {
        const statsContainer = document.getElementById('backup-stats');
        if (!statsContainer) {
            return;
        }

        try {
            const result = await window.electronAPI.invoke('backup-stats');

            if (result.success) {
                const stats = result.stats;

                statsContainer.innerHTML = `
                    <h3>📊 Backup Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">Total Backups</div>
                            <div class="stat-value">${stats.totalBackups}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Full Backups</div>
                            <div class="stat-value">${stats.fullBackups}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Incremental</div>
                            <div class="stat-value">${stats.incrementalBackups}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Size</div>
                            <div class="stat-value">${stats.totalSizeMB} MB</div>
                        </div>
                        ${
                            stats.latestBackup
                                ? `
                        <div class="stat-item">
                            <div class="stat-label">Latest Backup</div>
                            <div class="stat-value">${new Date(stats.latestBackup).toLocaleString()}</div>
                        </div>
                        `
                                : ''
                        }
                        ${
                            stats.oldestBackup
                                ? `
                        <div class="stat-item">
                            <div class="stat-label">Oldest Backup</div>
                            <div class="stat-value">${new Date(stats.oldestBackup).toLocaleString()}</div>
                        </div>
                        `
                                : ''
                        }
                    </div>
                `;

                statsContainer.style.display = 'block';
            } else {
                this.showError('Failed to load statistics: ' + result.error);
            }
        } catch (error) {
            logError('Error loading statistics:', error);
            this.showError('Failed to load statistics');
        }
    }

    /**
     * UI Helper Methods
     */
    showLoading(message) {
        this.showNotification(message, 'loading');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to alert
            if (type === 'error') {
                alert('❌ ' + message);
            } else if (type === 'success') {
                alert('✅ ' + message);
            } else {
                alert('ℹ️ ' + message);
            }
        }
    }
}

// Add required styles
const backupStyles = `
    .backup-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: transform 0.2s;
    }

    .backup-btn:hover {
        transform: scale(1.05);
    }

    .backup-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
    }

    .backup-list-container {
        margin-top: 20px;
    }

    .backup-list {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.2);
    }

    .backup-group {
        margin-bottom: 20px;
    }

    .backup-group h4 {
        color: #667eea;
        margin-bottom: 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .backup-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        margin-bottom: 8px;
        transition: background 0.2s;
    }

    .backup-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .backup-name {
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 4px;
    }

    .backup-meta {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
    }

    .backup-stats {
        margin-top: 20px;
        padding: 15px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 8px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }

    .stat-item {
        text-align: center;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
    }

    .stat-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 5px;
    }

    .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #667eea;
    }

    .no-backups {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 40px;
        font-style: italic;
    }
`;

// Add styles to document if not already present
if (!document.getElementById('backup-manager-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'backup-manager-styles';
    styleSheet.textContent = backupStyles;
    document.head.appendChild(styleSheet);
}

// Create global instance
window.backupManager = new BackupManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.backupManager.init();
    });
} else {
    window.backupManager.init();
}

logInfo('✅ Backup Manager UI loaded');
