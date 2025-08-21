/**
 * Sistema de notificaciones Toast para MAP
 * Previene errores cuando otros módulos llaman a showToast
 */

class ToastNotifications {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Crear contenedor si no existe
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }

        // Exponer globalmente
        window.showToast = this.show.bind(this);
    }

    show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Estilos según tipo
        const colors = {
            info: 'linear-gradient(135deg, #667eea, #764ba2)',
            success: 'linear-gradient(135deg, #00b09b, #96c93d)',
            error: 'linear-gradient(135deg, #f93b5c, #f9605c)',
            warning: 'linear-gradient(135deg, #ffd93d, #ffb347)',
        };

        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            pointer-events: auto;
            cursor: pointer;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            word-wrap: break-word;
        `;

        toast.textContent = message;

        // Click para cerrar
        toast.addEventListener('click', () => {
            this.remove(toast);
        });

        // Auto-cerrar después de 3 segundos
        setTimeout(() => {
            this.remove(toast);
        }, 3000);

        this.container.appendChild(toast);

        // Log en consola también
        const logType = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[logType](`[Toast ${type.toUpperCase()}]`, message);
    }

    remove(toast) {
        if (!toast || !toast.parentNode) {
            return;
        }

        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Agregar animaciones CSS
if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.toastNotifications = new ToastNotifications();
    });
} else {
    window.toastNotifications = new ToastNotifications();
}

// Función de fallback por si algo falla
if (!window.showToast) {
    window.showToast = function (message, type) {
        console.log(`[Toast ${type || 'info'}]`, message);
    };
}
