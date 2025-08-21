# 🌐 GLOBAL API REGISTRY - MAP v3.0

> **CRITICAL**: Este documento es la ÚNICA fuente de verdad para funciones globales
> **Última actualización**: 2025-01-20
> **Estado**: OBLIGATORIO consultarlo antes de usar window._ o electronAPI._

---

## ⚠️ REGLA DE ORO

**ANTES de llamar CUALQUIER función global, VERIFICA aquí que existe**

---

## 📋 WINDOW GLOBAL FUNCTIONS

### Funciones de Carga de Datos

```javascript
window.loadFiles(); // Carga tracks desde la BD a la UI
// Ubicación: index-views.html:4540
// Uso: Refresca la lista de tracks en la biblioteca
// Alias interno: loadTracks()
```

### Funciones de UI/Toast

```javascript
window.showToast(message, type); // Muestra notificaciones
// Ubicación: Por definir
// Tipos: 'info', 'success', 'error', 'warning'
```

### Funciones NO EXISTENTES (NO USAR)

```javascript
❌ window.loadTracksFromDatabase()  // NO EXISTE - usar loadFiles()
❌ window.refreshLibrary()           // NO EXISTE - usar loadFiles()
❌ window.updateTracks()             // NO EXISTE - usar loadFiles()
```

---

## 🔌 ELECTRON API (IPC)

### Handlers de Importación

```javascript
electronAPI.invoke('select-music-files')    // Selecciona archivos individuales
// Returns: { filePaths: string[], fileCount: number }

electronAPI.invoke('select-music-folder')   // Selecciona carpeta
// Returns: { folderPath: string, fileCount: number }

electronAPI.invoke('import-music-files', { filePaths: string[] })
// Returns: { success: boolean, imported: number, errors: number }

electronAPI.invoke('import-music-folder', { folderPath: string })
// Returns: { success: boolean, imported: number, errors: number }
```

### Handlers de Base de Datos

```javascript
electronAPI.invoke('get-files-with-cached-artwork', limit);
// Returns: Array de tracks con metadata

electronAPI.invoke('search-tracks', searchTerm);
// Returns: Array de tracks filtrados

electronAPI.invoke('get-filter-options');
// Returns: { genres: string[], moods: string[] }

electronAPI.invoke('show-in-folder', filePath);
// Returns: { success: boolean }
```

### Handlers NO IMPLEMENTADOS (NO USAR)

```javascript
❌ electronAPI.invoke('update-metadata')   // PENDIENTE
❌ electronAPI.invoke('delete-track')      // PENDIENTE
❌ electronAPI.invoke('create-playlist')   // PENDIENTE
```

---

## 🛡️ PATRÓN DE VALIDACIÓN SEGURA

### SIEMPRE hacer esto:

```javascript
// ✅ CORRECTO - Valida antes de llamar
if (window.loadFiles && typeof window.loadFiles === 'function') {
    window.loadFiles();
} else {
    console.error('Function window.loadFiles not available');
}

// ❌ INCORRECTO - Asume que existe
window.loadTracksFromDatabase(); // BOOM! 💥
```

### Para IPC handlers:

```javascript
// ✅ CORRECTO - Maneja errores
try {
    const result = await electronAPI.invoke('import-music-files', data);
    if (result.success) {
        // Actualizar UI
        if (window.loadFiles) window.loadFiles();
    }
} catch (error) {
    console.error('IPC call failed:', error);
}
```

---

## 🔍 CÓMO VERIFICAR SI UNA FUNCIÓN EXISTE

### Método 1: Consola del navegador

```javascript
// En DevTools, ejecutar:
console.log(Object.keys(window).filter((k) => typeof window[k] === 'function'));
```

### Método 2: Script de verificación

```bash
node verify-global-functions.js
```

### Método 3: Grep en el código

```bash
grep -r "window\." --include="*.html" --include="*.js" | grep "="
```

---

## 📝 PROCESO PARA AGREGAR NUEVA FUNCIÓN GLOBAL

1. **Define la función** en el archivo correspondiente
2. **Expónla globalmente** con `window.functionName = functionName`
3. **DOCUMENTA AQUÍ** inmediatamente con:
    - Nombre exacto
    - Ubicación (archivo:línea)
    - Parámetros y return
    - Propósito
4. **Crea test** en `tests/global-functions.test.js`
5. **Actualiza** este documento

---

## 🚨 CHECKLIST ANTES DE COMMIT

- [ ] ¿Todas las funciones window.\* están en este documento?
- [ ] ¿Todas las llamadas a funciones globales tienen validación?
- [ ] ¿Los tests de integración pasan?
- [ ] ¿Este documento está actualizado?

---

## 📊 ESTADÍSTICAS ACTUALES

- **Funciones globales definidas**: 1 (`loadFiles`)
- **IPC handlers implementados**: 8
- **IPC handlers pendientes**: 4
- **Última auditoría**: 2025-01-20

---

**IMPORTANTE**: Si encuentras una función global no documentada aquí,
DETÉNTE y actualiza este documento ANTES de usarla.
