/**
 * Preload Script Mejorado para Electron
 * Implementa un bridge seguro entre el proceso principal y el renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Sistema de logging mejorado
const logger = {
    debug: (...args) => console.log('[Preload Debug]', ...args),
    info: (...args) => console.log('[Preload Info]', ...args),
    warn: (...args) => console.warn('[Preload Warn]', ...args),
    error: (...args) => console.error('[Preload Error]', ...args)
};

// Canales IPC permitidos (whitelist para seguridad)
const ALLOWED_CHANNELS = {
    invoke: [
        'get-files-with-cached-artwork',
        'search-tracks',
        'get-filter-options',
        'get-track-complete-data',
        'find-similar-tracks',
        'get-track-for-player',
        'preview-smart-playlist',
        'create-smart-playlist',
        'get-smart-playlists',
        'update-smart-playlist',
        'get-queue-tracks',
        'analyze-energy-flow',
        'optimize-energy-flow',
        'get-all-tracks-for-export',
        'export-tracks',
        'get-export-formats',
        'show-in-folder',
        'import-music',
        'get-file-metadata',
        'get-audio-config',
        'get-asset-path'
    ],
    send: [
        'save-audio-config',
        'import-progress',
        'window-control'
    ],
    on: [
        'import-progress',
        'audio-config-updated',
        'playback-state-changed',
        'queue-updated'
    ]
};

// Validar canal antes de permitir comunicación
function isChannelAllowed(channel, type) {
    const allowed = ALLOWED_CHANNELS[type] || [];
    const isAllowed = allowed.includes(channel);
    
    if (!isAllowed) {
        logger.warn(`Channel "${channel}" not allowed for ${type}`);
    }
    
    return isAllowed;
}

// API expuesta al renderer con validación
const electronAPI = {
    // Invoke con validación
    invoke: async (channel, ...args) => {
        if (!isChannelAllowed(channel, 'invoke')) {
            throw new Error(`Channel "${channel}" is not allowed for invoke`);
        }
        
        logger.debug('IPC invoke:', channel);
        
        try {
            const result = await ipcRenderer.invoke(channel, ...args);
            return result;
        } catch (error) {
            logger.error(`Error in ${channel}:`, error);
            throw error;
        }
    },
    
    // Send con validación
    send: (channel, ...args) => {
        if (!isChannelAllowed(channel, 'send')) {
            throw new Error(`Channel "${channel}" is not allowed for send`);
        }
        
        logger.debug('IPC send:', channel);
        ipcRenderer.send(channel, ...args);
    },
    
    // On con validación y cleanup
    on: (channel, listener) => {
        if (!isChannelAllowed(channel, 'on')) {
            throw new Error(`Channel "${channel}" is not allowed for on`);
        }
        
        logger.debug('IPC on:', channel);
        
        const wrappedListener = (event, ...args) => {
            try {
                listener(event, ...args);
            } catch (error) {
                logger.error(`Error in listener for ${channel}:`, error);
            }
        };
        
        ipcRenderer.on(channel, wrappedListener);
        
        // Retornar función de cleanup
        return () => {
            ipcRenderer.removeListener(channel, wrappedListener);
        };
    },
    
    // Once para eventos únicos
    once: (channel, listener) => {
        if (!isChannelAllowed(channel, 'on')) {
            throw new Error(`Channel "${channel}" is not allowed for once`);
        }
        
        logger.debug('IPC once:', channel);
        
        ipcRenderer.once(channel, (event, ...args) => {
            try {
                listener(event, ...args);
            } catch (error) {
                logger.error(`Error in once listener for ${channel}:`, error);
            }
        });
    },
    
    // Remover todos los listeners de un canal
    removeAllListeners: (channel) => {
        if (channel && !isChannelAllowed(channel, 'on')) {
            throw new Error(`Channel "${channel}" is not allowed`);
        }
        
        if (channel) {
            ipcRenderer.removeAllListeners(channel);
            logger.debug('Removed all listeners for:', channel);
        } else {
            // Remover todos los listeners de todos los canales permitidos
            ALLOWED_CHANNELS.on.forEach(ch => {
                ipcRenderer.removeAllListeners(ch);
            });
            logger.debug('Removed all listeners');
        }
    },
    
    // Información del sistema
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    },
    
    // Utilidades
    getAppPath: () => __dirname,
    isDevelopment: process.env.NODE_ENV === 'development'
};

// Exponer API de forma segura
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Compatibilidad con código legacy (window.api)
contextBridge.exposeInMainWorld('api', {
    invoke: electronAPI.invoke,
    send: electronAPI.send,
    on: electronAPI.on
});

// Compatibilidad con ipcRenderer directo (deprecado pero mantenido por compatibilidad)
contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: electronAPI.invoke,
    send: electronAPI.send,
    on: electronAPI.on
});

// Para compatibilidad con require('electron')
contextBridge.exposeInMainWorld('require', (module) => {
    if (module === 'electron') {
        return {
            ipcRenderer: {
                invoke: electronAPI.invoke,
                send: electronAPI.send,
                on: electronAPI.on
            }
        };
    }
    
    // No permitir require de otros módulos por seguridad
    logger.warn(`Attempted to require module: ${module}`);
    return null;
});

// Logging inicial
logger.info('✅ Preload script loaded successfully');
logger.info('Platform:', process.platform);
logger.info('Electron version:', process.versions.electron);
logger.info('Node version:', process.versions.node);

// Manejo de errores no capturados en el preload
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in preload:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection in preload:', reason);
});

// Cleanup cuando la ventana se cierra
window.addEventListener('beforeunload', () => {
    logger.info('Window closing, cleaning up...');
    electronAPI.removeAllListeners();
});