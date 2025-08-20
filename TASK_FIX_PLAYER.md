# Task: Fix Player Completamente Roto

## 🎯 Objetivo

Arreglar el sistema de reproducción de audio que está completamente roto, implementando una solución robusta que funcione con todos los formatos de audio.

## 🔴 Problema Actual

1. **Error principal**: "AudioContext was not allowed to start"
2. **Síntomas**:
    - Click en play no hace nada
    - Console muestra: "The AudioContext was not allowed to start"
    - Progress bar no se mueve
    - Algunos formatos (FLAC) no funcionan

## 📋 Análisis de Causa Raíz

```javascript
// PROBLEMA en main-secure.js:534
ipcMain.handle('play-track', async (event, filePath) => {
    // No hay validación de user gesture
    // No hay cleanup de contexto previo
    // K-Meter causa saturación
});
```

## ✅ Solución Propuesta

### Paso 1: Modificar main-secure.js

```javascript
// Línea 534 - Reemplazar handler completo
safeIpcHandle('play-track', async (event, trackPath) => {
    try {
        // 1. Validar path
        const sanitized = sanitizeInput(trackPath);
        if (!fs.existsSync(sanitized)) {
            throw new Error('File not found');
        }

        // 2. Cleanup previo
        if (global.audioManager?.currentSound) {
            global.audioManager.currentSound.unload();
            global.audioManager.currentSound = null;
        }

        // 3. Configuración sin K-Meter (CRÍTICO)
        const config = await getAudioConfig();
        config.kMeterEnabled = false; // Prevenir saturación

        // 4. Crear instancia Howler con fallbacks
        const sound = new Howl({
            src: [sanitized],
            html5: true, // Importante para archivos grandes
            volume: config.volume || 0.7,
            autoplay: false,
            preload: true,
            onload: () => {
                event.sender.send('track-loaded', { duration: sound.duration() });
            },
            onplay: () => {
                event.sender.send('playback-started');
            },
            onpause: () => {
                event.sender.send('playback-paused');
            },
            onend: () => {
                event.sender.send('track-ended');
                cleanup();
            },
            onloaderror: (id, error) => {
                console.error('Load error:', error);
                event.sender.send('playback-error', { error: 'Failed to load audio file' });
            },
            onplayerror: (id, error) => {
                console.error('Play error:', error);
                // Fallback a Audio API nativa
                fallbackToNativeAudio(sanitized);
            },
        });

        // 5. Almacenar referencia global
        if (!global.audioManager) {
            global.audioManager = {};
        }
        global.audioManager.currentSound = sound;

        // 6. Intentar reproducir
        sound.play();

        return {
            success: true,
            duration: sound.duration(),
            format: sound._format || 'unknown',
        };
    } catch (error) {
        console.error('Play error:', error);
        return {
            success: false,
            error: error.message,
            fallback: 'native',
        };
    }
});

// Función de fallback
async function fallbackToNativeAudio(filePath) {
    // Implementar reproductor nativo como backup
    const audio = new Audio(`file://${filePath}`);
    audio.volume = 0.7;
    await audio.play();
    return audio;
}

// Función de cleanup
function cleanup() {
    if (global.audioManager?.currentSound) {
        global.audioManager.currentSound.unload();
        global.audioManager.currentSound = null;
    }
}
```

### Paso 2: Modificar index.html

```javascript
// Agregar en el script principal
document.addEventListener('DOMContentLoaded', () => {
    // Request audio permission on first user interaction
    document.addEventListener(
        'click',
        async () => {
            if (window.audioContext?.state === 'suspended') {
                await window.audioContext.resume();
            }
        },
        { once: true }
    );
});

// Modificar el handler del botón play
async function playTrack(filePath) {
    try {
        // Ensure audio context is running
        if (window.audioContext?.state === 'suspended') {
            await window.audioContext.resume();
        }

        const result = await window.api.playTrack(filePath);
        if (!result.success && result.fallback === 'native') {
            // Try fallback method
            playWithFallback(filePath);
        }
    } catch (error) {
        console.error('Play failed:', error);
        showError('Failed to play track');
    }
}
```

### Paso 3: Actualizar audio-config.json

```json
{
    "kMeterEnabled": false,
    "volume": 0.7,
    "useHtml5": true,
    "preloadNext": false,
    "crossfade": false,
    "bufferSize": 4096,
    "gaplessPlayback": false
}
```

## 🧪 Plan de Testing

### Tests Manuales Requeridos:

1. **Test formato MP3**: `/Music/test.mp3`
2. **Test formato FLAC**: `/Music/test.flac`
3. **Test formato M4A**: `/Music/test.m4a`
4. **Test volumen**: Cambiar volumen durante reproducción
5. **Test seek**: Adelantar/atrasar en timeline
6. **Test memory**: Reproducir 100 tracks seguidos, verificar memoria

### Verificaciones:

- [ ] No hay error de AudioContext
- [ ] No hay saturación de audio
- [ ] Progress bar se actualiza correctamente
- [ ] Volumen responde a cambios
- [ ] No hay memory leaks
- [ ] Funciona con todos los formatos

## 📊 Criterios de Éxito

1. **Funcionalidad**: 100% de tracks reproducen sin errores
2. **Performance**: Inicio de reproducción < 500ms
3. **Memoria**: No aumenta después de 100 reproducciones
4. **UX**: Feedback visual inmediato al hacer click

## 🔗 Referencias

- CLAUDE.md línea 15: "K-Meter causa saturación"
- audio-config.json: Configuración actual
- Howler.js docs: https://howlerjs.com/
- Issue original: #player-broken-2025

## 💡 Notas Importantes

- **NUNCA** habilitar K-Meter (causa saturación confirmada)
- Siempre usar `html5: true` para archivos grandes
- Implementar cleanup en cada cambio de track
- Mantener referencia global para control
