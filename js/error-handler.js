// TASK_030: Error Boundaries & Global Error Handler
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.errorListeners = [];
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        // Error global
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
                timestamp: new Date().toISOString()
            });
            
            // Prevenir default solo si manejamos el error
            if (this.shouldHandleError(event.error)) {
                event.preventDefault();
            }
        });
        
        // Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || event.reason,
                error: event.reason,
                timestamp: new Date().toISOString()
            });
            
            event.preventDefault();
        });
    }
    
    handleError(errorInfo) {
        // Agregar a lista
        this.errors.unshift(errorInfo);
        if (this.errors.length > this.maxErrors) {
            this.errors.pop();
        }
        
        // Log
        console.error('🔴 Error capturado:', errorInfo);
        
        // Clasificar error
        const severity = this.classifyError(errorInfo);
        
        // Notificar según severidad
        switch (severity) {
            case 'critical':
                this.showCriticalError(errorInfo);
                break;
            case 'warning':
                this.showWarning(errorInfo);
                break;
            case 'info':
                // Solo log, no mostrar
                break;
        }
        
        // Notificar listeners
        this.errorListeners.forEach(listener => {
            try {
                listener(errorInfo, severity);
            } catch (e) {
                console.error('Error en listener:', e);
            }
        });
        
        // Auto-recovery si es posible
        this.attemptRecovery(errorInfo);
    }
    
    classifyError(errorInfo) {
        const message = errorInfo.message?.toLowerCase() || '';
        
        // Críticos
        if (message.includes('database') || message.includes('sqlite')) {
            return 'critical';
        }
        if (message.includes('cannot read') || message.includes('undefined')) {
            return 'warning';
        }
        if (message.includes('network') || message.includes('fetch')) {
            return 'warning';
        }
        
        // Info
        if (message.includes('canceled') || message.includes('aborted')) {
            return 'info';
        }
        
        return 'warning';
    }
    
    shouldHandleError(error) {
        if (!error) return false;
        
        const message = error.message?.toLowerCase() || '';
        
        // Ignorar errores conocidos no críticos
        if (message.includes('resizeobserver')) return false;
        if (message.includes('non-error')) return false;
        
        return true;
    }
    
    showCriticalError(errorInfo) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff4444, #cc0000);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
                <strong>Error Crítico</strong>
            </div>
            <div style="margin-bottom: 10px;">${this.sanitizeMessage(errorInfo.message)}</div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.location.reload()" style="
                    background: white;
                    color: #cc0000;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                ">Recargar</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                ">Cerrar</button>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Auto-remover después de 10s
        setTimeout(() => {
            container.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => container.remove(), 300);
        }, 10000);
    }
    
    showWarning(errorInfo) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff9800, #f57c00);
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 350px;
            animation: slideUp 0.3s ease;
        `;
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>⚡ Advertencia</strong>
                    <div style="font-size: 14px; margin-top: 5px;">
                        ${this.sanitizeMessage(errorInfo.message)}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: transparent;
                    color: white;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 10px;
                ">✕</button>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Auto-remover después de 5s
        setTimeout(() => {
            container.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => container.remove(), 300);
        }, 5000);
    }
    
    sanitizeMessage(message) {
        if (!message) return 'Error desconocido';
        
        // Limpiar mensajes técnicos
        return message
            .replace(/^Uncaught /, '')
            .replace(/^Error: /, '')
            .replace(/\bat line \d+:\d+/, '')
            .substring(0, 200);
    }
    
    attemptRecovery(errorInfo) {
        const message = errorInfo.message?.toLowerCase() || '';
        
        // Recovery para errores específicos
        if (message.includes('localStorage')) {
            console.log('🔧 Intentando limpiar localStorage...');
            try {
                localStorage.clear();
                console.log('✅ localStorage limpiado');
            } catch (e) {
                console.error('No se pudo limpiar localStorage:', e);
            }
        }
        
        if (message.includes('memory')) {
            console.log('🔧 Liberando memoria...');
            // Limpiar caches si existen
            if (window.searchCache) window.searchCache = {};
            if (window.virtualScroll) window.virtualScroll.clear && window.virtualScroll.clear();
        }
    }
    
    addListener(callback) {
        this.errorListeners.push(callback);
    }
    
    removeListener(callback) {
        const index = this.errorListeners.indexOf(callback);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }
    
    getErrors(type = null) {
        if (!type) return this.errors;
        return this.errors.filter(e => e.type === type);
    }
    
    clearErrors() {
        this.errors = [];
    }
    
    // Wrapper para funciones async
    wrapAsync(fn) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError({
                    type: 'async',
                    message: error.message,
                    error: error,
                    function: fn.name,
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        };
    }
    
    // Wrapper para event handlers
    wrapHandler(fn) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError({
                    type: 'handler',
                    message: error.message,
                    error: error,
                    function: fn.name,
                    timestamp: new Date().toISOString()
                });
            }
        };
    }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes slideUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Auto-inicializar
window.errorHandler = new ErrorHandler();