// TASK_029: Keyboard Shortcuts System
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
        this.registerDefaults();
    }

    registerDefaults() {
        // Búsqueda y navegación
        this.register('/', () => document.getElementById('searchInput').focus(), 'Enfocar búsqueda');
        this.register('Escape', () => this.clearAll(), 'Limpiar búsqueda/filtros');

        // Vistas
        this.register('1', () => window.setView && window.setView('grid'), 'Vista Grid');
        this.register('2', () => window.setView && window.setView('list'), 'Vista Lista');
        this.register('3', () => window.setView && window.setView('heatmap'), 'Vista Heatmap');

        // Reproducción
        this.register(' ', () => window.togglePlay && window.togglePlay(), 'Play/Pause', true);
        this.register('ArrowRight', () => window.nextTrack && window.nextTrack(), 'Siguiente track');
        this.register('ArrowLeft', () => window.prevTrack && window.prevTrack(), 'Track anterior');
        this.register('ArrowUp', () => this.volumeUp(), 'Subir volumen');
        this.register('ArrowDown', () => this.volumeDown(), 'Bajar volumen');

        // Acciones
        this.register('cmd+e', () => window.showExportDialog && window.showExportDialog(), 'Exportar playlist');
        this.register('cmd+s', () => window.saveState && window.saveState(), 'Guardar estado');
        this.register('cmd+f', () => document.getElementById('searchInput').focus(), 'Buscar');
        this.register('cmd+,', () => window.showSettings && window.showSettings(), 'Configuración');
        this.register('cmd+shift+t', () => window.toggleTheme && window.toggleTheme(), 'Cambiar tema');

        // Filtros rápidos
        this.register('shift+h', () => this.filterHighEnergy(), 'Filtrar alta energía');
        this.register('shift+l', () => this.filterLowEnergy(), 'Filtrar baja energía');
        this.register('shift+f', () => this.filterFastBPM(), 'Filtrar BPM rápido');
        this.register('shift+s', () => this.filterSlowBPM(), 'Filtrar BPM lento');

        // Debug/Help
        this.register('?', () => this.showHelp(), 'Mostrar ayuda');
        this.register('shift+?', () => this.showHelp(), 'Mostrar ayuda');
    }

    register(keys, callback, description = '', preventDefault = false) {
        const normalizedKeys = this.normalizeKeys(keys);
        this.shortcuts.set(normalizedKeys, { callback, description, preventDefault });
    }

    normalizeKeys(keys) {
        return keys
            .toLowerCase()
            .replace('cmd', 'meta')
            .replace('ctrl', 'control')
            .replace('opt', 'alt')
            .replace('option', 'alt')
            .split('+')
            .sort()
            .join('+');
    }

    handleKeyDown(event) {
        if (!this.enabled) {
            return;
        }

        // Ignorar si está escribiendo en input/textarea
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            // Excepto para Escape
            if (event.key !== 'Escape') {
                return;
            }
        }

        // Construir combinación de teclas
        const keys = [];
        if (event.metaKey) {
            keys.push('meta');
        }
        if (event.ctrlKey) {
            keys.push('control');
        }
        if (event.altKey) {
            keys.push('alt');
        }
        if (event.shiftKey) {
            keys.push('shift');
        }

        // Agregar tecla principal
        let key = event.key.toLowerCase();
        if (key === ' ') {
            key = ' ';
        } // Mantener espacio
        if (key !== 'meta' && key !== 'control' && key !== 'alt' && key !== 'shift') {
            keys.push(key);
        }

        const combo = keys.sort().join('+');

        // Buscar shortcut
        const shortcut = this.shortcuts.get(combo);
        if (shortcut) {
            if (shortcut.preventDefault) {
                event.preventDefault();
            }
            shortcut.callback(event);
        }
    }

    clearAll() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }

        // Reset filtros
        ['genreFilter', 'moodFilter', 'sortFilter'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.selectedIndex = 0;
                el.dispatchEvent(new Event('change'));
            }
        });

        // Reset sliders
        document.getElementById('bpmMin').value = 60;
        document.getElementById('bpmMax').value = 200;
        document.getElementById('energyMin').value = 0;
        document.getElementById('energyMax').value = 100;

        if (window.updateRangeDisplays) {
            window.updateRangeDisplays();
        }
        if (window.performSearch) {
            window.performSearch();
        }
    }

    volumeUp() {
        const slider = document.getElementById('volumeSlider');
        if (slider) {
            slider.value = Math.min(100, parseInt(slider.value) + 10);
            slider.dispatchEvent(new Event('input'));
        }
    }

    volumeDown() {
        const slider = document.getElementById('volumeSlider');
        if (slider) {
            slider.value = Math.max(0, parseInt(slider.value) - 10);
            slider.dispatchEvent(new Event('input'));
        }
    }

    filterHighEnergy() {
        document.getElementById('energyMin').value = 70;
        document.getElementById('energyMax').value = 100;
        if (window.updateEnergyRange) {
            window.updateEnergyRange();
        }
        if (window.performSearch) {
            window.performSearch();
        }
    }

    filterLowEnergy() {
        document.getElementById('energyMin').value = 0;
        document.getElementById('energyMax').value = 30;
        if (window.updateEnergyRange) {
            window.updateEnergyRange();
        }
        if (window.performSearch) {
            window.performSearch();
        }
    }

    filterFastBPM() {
        document.getElementById('bpmMin').value = 140;
        document.getElementById('bpmMax').value = 200;
        if (window.updateBPMRange) {
            window.updateBPMRange();
        }
        if (window.performSearch) {
            window.performSearch();
        }
    }

    filterSlowBPM() {
        document.getElementById('bpmMin').value = 60;
        document.getElementById('bpmMax').value = 100;
        if (window.updateBPMRange) {
            window.updateBPMRange();
        }
        if (window.performSearch) {
            window.performSearch();
        }
    }

    showHelp() {
        const shortcuts = Array.from(this.shortcuts.entries())
            .map(([keys, info]) => {
                const displayKeys = keys
                    .replace('meta', '⌘')
                    .replace('control', 'ctrl')
                    .replace('alt', '⌥')
                    .replace('shift', '⇧')
                    .replace('+', ' + ');
                return `${displayKeys.padEnd(20)} ${info.description}`;
            })
            .join('\n');

        alert(`⌨️ Keyboard Shortcuts:\n\n${shortcuts}`);
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
}

// Auto-inicializar
if (typeof window !== 'undefined') {
    window.keyboardShortcuts = new KeyboardShortcuts();
    document.addEventListener('keydown', (e) => window.keyboardShortcuts.handleKeyDown(e));
}
