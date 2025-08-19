// Memory Manager - Previene memory leaks
class MemoryManager {
    constructor() {
        this.animationFrames = new Set();
        this.intervals = new Set();
        this.timeouts = new Set();
        this.audioContexts = new Set();
        this.observers = new Set();
        this.eventListeners = new Map();

        // Auto-cleanup cada 5 minutos
        this.startAutoCleanup();
    }

    // Gestión de Animation Frames
    requestAnimationFrame(callback) {
        const id = window.requestAnimationFrame(time => {
            this.animationFrames.delete(id);
            callback(time);
        });
        this.animationFrames.add(id);
        return id;
    }

    cancelAnimationFrame(id) {
        window.cancelAnimationFrame(id);
        this.animationFrames.delete(id);
    }

    // Gestión de Intervals
    setInterval(callback, delay) {
        const id = window.setInterval(callback, delay);
        this.intervals.add(id);
        return id;
    }

    clearInterval(id) {
        window.clearInterval(id);
        this.intervals.delete(id);
    }

    // Gestión de Timeouts
    setTimeout(callback, delay) {
        const id = window.setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        this.timeouts.add(id);
        return id;
    }

    clearTimeout(id) {
        window.clearTimeout(id);
        this.timeouts.delete(id);
    }

    // Gestión de AudioContext
    createAudioContext() {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContexts.add(context);
        return context;
    }

    closeAudioContext(context) {
        if (context && context.state !== 'closed') {
            context.close();
        }
        this.audioContexts.delete(context);
    }

    // Gestión de Observers
    createIntersectionObserver(callback, options) {
        const observer = new IntersectionObserver(callback, options);
        this.observers.add(observer);
        return observer;
    }

    disconnectObserver(observer) {
        observer.disconnect();
        this.observers.delete(observer);
    }

    // Gestión de Event Listeners
    addEventListener(element, event, handler, options) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Map());
        }

        const elementListeners = this.eventListeners.get(element);
        if (!elementListeners.has(event)) {
            elementListeners.set(event, new Set());
        }

        elementListeners.get(event).add(handler);
        element.addEventListener(event, handler, options);
    }

    removeEventListener(element, event, handler) {
        element.removeEventListener(event, handler);

        const elementListeners = this.eventListeners.get(element);
        if (elementListeners) {
            const eventHandlers = elementListeners.get(event);
            if (eventHandlers) {
                eventHandlers.delete(handler);
                if (eventHandlers.size === 0) {
                    elementListeners.delete(event);
                }
            }
            if (elementListeners.size === 0) {
                this.eventListeners.delete(element);
            }
        }
    }

    // Limpiar todos los event listeners de un elemento
    removeAllEventListeners(element) {
        const elementListeners = this.eventListeners.get(element);
        if (elementListeners) {
            elementListeners.forEach((handlers, event) => {
                handlers.forEach(handler => {
                    element.removeEventListener(event, handler);
                });
            });
            this.eventListeners.delete(element);
        }
    }

    // Cleanup general
    cleanup() {
        // Cancelar animation frames
        this.animationFrames.forEach(id => window.cancelAnimationFrame(id));
        this.animationFrames.clear();

        // Limpiar intervals
        this.intervals.forEach(id => window.clearInterval(id));
        this.intervals.clear();

        // Limpiar timeouts
        this.timeouts.forEach(id => window.clearTimeout(id));
        this.timeouts.clear();

        // Cerrar audio contexts
        this.audioContexts.forEach(context => {
            if (context.state !== 'closed') {
                context.close();
            }
        });
        this.audioContexts.clear();

        // Desconectar observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Limpiar event listeners
        this.eventListeners.forEach((events, element) => {
            events.forEach((handlers, event) => {
                handlers.forEach(handler => {
                    element.removeEventListener(event, handler);
                });
            });
        });
        this.eventListeners.clear();
    }

    // Auto-cleanup periódico
    startAutoCleanup() {
        // Cada 5 minutos, limpiar recursos no utilizados
        setInterval(
            () => {
                this.performAutoCleanup();
            },
            5 * 60 * 1000
        );
    }

    performAutoCleanup() {
        // Verificar elementos DOM que ya no existen
        const elementsToRemove = [];
        this.eventListeners.forEach((events, element) => {
            if (!document.body.contains(element)) {
                elementsToRemove.push(element);
            }
        });

        elementsToRemove.forEach(element => {
            this.removeAllEventListeners(element);
        });

        // Cerrar AudioContexts suspendidos
        this.audioContexts.forEach(context => {
            if (context.state === 'suspended') {
                this.closeAudioContext(context);
            }
        });

        // Log de limpieza
        if (elementsToRemove.length > 0 || this.audioContexts.size > 1) {
            //
        }
    }

    // Obtener estadísticas de memoria
    getStats() {
        return {
            animationFrames: this.animationFrames.size,
            intervals: this.intervals.size,
            timeouts: this.timeouts.size,
            audioContexts: this.audioContexts.size,
            observers: this.observers.size,
            eventListeners: this.eventListeners.size,
            totalListeners: Array.from(this.eventListeners.values()).reduce(
                (total, events) =>
                    total +
                    Array.from(events.values()).reduce((sum, handlers) => sum + handlers.size, 0),
                0
            )
        };
    }
}

// Crear instancia global
window.memoryManager = new MemoryManager();

// Limpiar al cerrar/recargar página
window.addEventListener('beforeunload', () => {
    window.memoryManager.cleanup();
});
