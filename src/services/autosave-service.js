// TASK_028: Auto-save & Recovery System
const fs = require('fs');
const path = require('path');

class AutoSaveService {
    constructor(storageDir = null) {
        this.storageDir =
            storageDir || path.join(process.env.HOME || process.env.USERPROFILE, '.music-analyzer', 'recovery');
        this.saveInterval = 30000; // 30 segundos
        this.maxRecoveryFiles = 5;
        this.currentSession = null;
        this.intervalId = null;

        // Crear directorio si no existe
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    // Iniciar auto-save
    start(sessionData = {}) {
        this.currentSession = {
            id: Date.now().toString(),
            startTime: new Date().toISOString(),
            data: sessionData
        };

        // Guardar inmediatamente
        this.save();

        // Configurar intervalo
        this.intervalId = setInterval(() => {
            this.save();
        }, this.saveInterval);

        logInfo('✅ Auto-save iniciado (cada ${this.saveInterval / 1000}s)');
        return this.currentSession.id;
    }

    // Detener auto-save
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        logDebug('⏹️ Auto-save detenido');
    }

    // Guardar estado actual
    save(data = null) {
        if (!this.currentSession) {
            return;
        }

        if (data) {
            this.currentSession.data = { ...this.currentSession.data, ...data };
        }

        this.currentSession.lastSave = new Date().toISOString();

        const filename = `recovery_${this.currentSession.id}.json`;
        const filepath = path.join(this.storageDir, filename);

        try {
            fs.writeFileSync(filepath, JSON.stringify(this.currentSession, null, 2));

            // Limpiar archivos viejos
            this.cleanOldRecoveryFiles();

            return true;
        } catch (error) {
            logError('Error saving recovery file:', error);
            return false;
        }
    }

    // Actualizar datos específicos
    update(key, value) {
        if (!this.currentSession) {
            return;
        }

        if (typeof key === 'object') {
            // Actualizar múltiples valores
            Object.assign(this.currentSession.data, key);
        } else {
            // Actualizar un solo valor
            this.currentSession.data[key] = value;
        }
    }

    // Recuperar sesión más reciente
    recover() {
        const files = fs
            .readdirSync(this.storageDir)
            .filter(f => f.startsWith('recovery_') && f.endsWith('.json'))
            .map(f => ({
                file: f,
                path: path.join(this.storageDir, f),
                stats: fs.statSync(path.join(this.storageDir, f))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);

        if (files.length === 0) {
            return null;
        }

        try {
            const latestFile = files[0];
            const content = fs.readFileSync(latestFile.path, 'utf8');
            const session = JSON.parse(content);

            // Calcular tiempo desde último guardado
            const lastSaveTime = new Date(session.lastSave);
            const minutesAgo = Math.round((Date.now() - lastSaveTime) / 60000);

            return {
                ...session,
                recoveredFrom: latestFile.file,
                minutesAgo: minutesAgo
            };
        } catch (error) {
            logError('Error recovering session:', error);
            return null;
        }
    }

    // Listar todas las sesiones recuperables
    listRecoverable() {
        const files = fs
            .readdirSync(this.storageDir)
            .filter(f => f.startsWith('recovery_') && f.endsWith('.json'))
            .map(f => {
                const filepath = path.join(this.storageDir, f);
                const stats = fs.statSync(filepath);

                try {
                    const content = fs.readFileSync(filepath, 'utf8');
                    const session = JSON.parse(content);

                    return {
                        id: session.id,
                        startTime: session.startTime,
                        lastSave: session.lastSave,
                        size: stats.size,
                        file: f,
                        dataKeys: Object.keys(session.data || {})
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.lastSave) - new Date(a.lastSave));

        return files;
    }

    // Limpiar archivos de recuperación antiguos
    cleanOldRecoveryFiles() {
        const files = fs
            .readdirSync(this.storageDir)
            .filter(f => f.startsWith('recovery_') && f.endsWith('.json'))
            .map(f => ({
                file: f,
                path: path.join(this.storageDir, f),
                stats: fs.statSync(path.join(this.storageDir, f))
            }))
            .sort((a, b) => b.stats.mtime - a.stats.mtime);

        // Mantener solo los N más recientes
        if (files.length > this.maxRecoveryFiles) {
            files.slice(this.maxRecoveryFiles).forEach(f => {
                try {
                    fs.unlinkSync(f.path);
                    logDebug(`🗑️ Eliminado archivo de recuperación antiguo: ${f.file}`);
                } catch (error) {
                    logError('Error deleting old recovery file:', error);
                }
            });
        }
    }

    // Eliminar archivo de recuperación específico
    deleteRecoveryFile(sessionId) {
        const filename = `recovery_${sessionId}.json`;
        const filepath = path.join(this.storageDir, filename);

        try {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                return true;
            }
        } catch (error) {
            logError('Error deleting recovery file:', error);
        }
        return false;
    }

    // Eliminar todos los archivos de recuperación
    clearAll() {
        const files = fs.readdirSync(this.storageDir).filter(f => f.startsWith('recovery_') && f.endsWith('.json'));

        let deleted = 0;
        files.forEach(f => {
            try {
                fs.unlinkSync(path.join(this.storageDir, f));
                deleted++;
            } catch (error) {
                logError('Error deleting file:', f, error);
            }
        });

        logDebug(`🗑️ Eliminados ${deleted} archivos de recuperación`);
        return deleted;
    }
}

module.exports = { AutoSaveService };
