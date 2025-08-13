# CLAUDE.md - Documentación Técnica Music Analyzer Clean

## 🏗️ ARQUITECTURA TÉCNICA ACTUAL

### 📋 Stack Tecnológico
```
Frontend:  Vanilla JavaScript (ES6+)
Backend:   Node.js + Electron IPC
Database:  SQLite3 (music_analyzer.db)
UI:        HTML5 + CSS3 (sin frameworks)
Assets:    491 carátulas pre-extraídas (JPG)
```

### 🔄 Flujo de Datos

```
Usuario → HTML/JS → IPC → main.js → SQLite → IPC → UI Update
                           ↓
                     artwork-cache/
```

### 📁 Estructura del Proyecto

```
music-app-clean/
├── main.js                 # Backend Electron con handlers IPC
├── index-with-search.html  # Frontend con búsqueda y filtros
├── music_analyzer.db       # Base de datos SQLite (14.5 MB)
├── artwork-cache/          # 491 carátulas JPG pre-extraídas
│   ├── 1.jpg
│   ├── 2.jpg
│   └── ...
├── create-indexes.js       # Script para optimizar BD
├── extract-artwork.js      # Extractor de carátulas
├── package.json           # Dependencias mínimas
└── CLAUDE.md              # Este archivo
```

## 🔌 IPC Handlers Implementados

### 1. `get-files-with-cached-artwork`
**Propósito**: Obtener archivos con carátulas pre-cargadas
**Entrada**: Ninguna
**Salida**: Array de hasta 300 archivos con metadata y artwork_url
**SQL**: JOIN entre audio_files y llm_metadata

### 2. `search-tracks`
**Propósito**: Búsqueda y filtrado avanzado
**Entrada**: 
```javascript
{
  query: string,        // Texto de búsqueda
  filters: {
    genre: string,      // Filtro por género
    mood: string,       // Filtro por mood
    sort: string,       // Ordenamiento
    analyzedOnly: bool  // Solo analizados
  }
}
```
**Salida**: Array de hasta 500 archivos filtrados
**Optimización**: Usa 9 índices SQLite para velocidad

### 3. `get-filter-options`
**Propósito**: Obtener valores únicos para filtros
**Entrada**: Ninguna
**Salida**: 
```javascript
{
  genres: string[],  // 389 géneros únicos
  moods: string[]    // 18 moods únicos
}
```

## 📊 Esquema de Base de Datos

### Tabla: `audio_files`
```sql
- id (PRIMARY KEY)
- file_path
- file_name
- title
- artist
- album
- genre
- file_extension
- existing_bmp
- artwork_path (agregado por extractor)
```

### Tabla: `llm_metadata`
```sql
- file_id (FOREIGN KEY → audio_files.id)
- LLM_GENRE
- AI_MOOD
- LLM_MOOD
- AI_ENERGY
- AI_BPM
- (+ 15 campos adicionales de análisis)
```

### Índices Creados (Optimización)
```sql
CREATE INDEX idx_artist ON audio_files(artist);
CREATE INDEX idx_title ON audio_files(title);
CREATE INDEX idx_file_name ON audio_files(file_name);
CREATE INDEX idx_genre ON audio_files(genre);
CREATE INDEX idx_llm_genre ON llm_metadata(LLM_GENRE);
CREATE INDEX idx_ai_mood ON llm_metadata(AI_MOOD);
CREATE INDEX idx_ai_bpm ON llm_metadata(AI_BPM);
CREATE INDEX idx_ai_energy ON llm_metadata(AI_ENERGY);
CREATE INDEX idx_file_id ON llm_metadata(file_id);
```

## 🎨 Sistema de UI

### Componentes Principales

1. **Header con Búsqueda**
   - Input con debounce (300ms)
   - Icono de búsqueda y botón clear
   - Placeholder descriptivo

2. **Filtros Dinámicos**
   - Select de género (389 opciones)
   - Select de mood (18 opciones)
   - Select de ordenamiento (8 opciones)
   - Chips de filtros activos

3. **Grid de Tarjetas**
   - Display: grid responsive
   - Tarjetas de 280px min-width
   - Hover effects con transform
   - Lazy loading de imágenes

4. **Estadísticas en Tiempo Real**
   - Total de archivos
   - Archivos mostrados
   - Archivos con carátula
   - Tiempo de búsqueda (ms)

## ⚡ Optimizaciones Implementadas

### 1. Debouncing
```javascript
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
// Aplicado a búsqueda con 300ms de delay
```

### 2. Caché en Memoria
```javascript
searchCache[cacheKey] = results;
// Limpieza automática después de 5 minutos
setTimeout(() => delete searchCache[cacheKey], 5 * 60 * 1000);
```

### 3. Límites de Resultados
- Máximo 500 resultados en búsquedas
- Máximo 300 archivos en carga inicial
- Prioridad a archivos con carátulas

### 4. Carátulas Pre-extraídas
- 491 archivos JPG en `artwork-cache/`
- No extracción en tiempo real
- URLs como `file://` para carga rápida

## 🎹 Shortcuts de Teclado

- `/` - Enfocar campo de búsqueda
- `ESC` - Limpiar búsqueda y filtros

## 📦 Dependencias

```json
{
  "devDependencies": {
    "electron": "^32.2.10"
  },
  "dependencies": {
    "sqlite3": "^5.1.7",
    "music-metadata": "^7.14.0"
  }
}
```

## 🚀 Comandos

```bash
# Instalar dependencias
npm install

# Ejecutar aplicación
npm start

# Extraer más carátulas
npm run extract-artwork

# Crear índices BD (ya ejecutado)
node create-indexes.js
```

## ⚠️ Reglas de Desarrollo

### ✅ HACER
- Mantener vanilla JavaScript (sin frameworks)
- Usar IPC de Electron para comunicación
- Optimizar queries SQL con índices
- Pre-procesar assets pesados (carátulas)
- Implementar caché cuando sea posible
- Limitar resultados para mantener performance

### ❌ NO HACER
- NO agregar React, Vue, Angular
- NO usar APIs REST (usar IPC)
- NO cambiar a PostgreSQL/MongoDB
- NO extraer carátulas en tiempo real
- NO cargar más de 500 items a la vez
- NO agregar dependencias pesadas

## 🔮 Mejoras Futuras Planeadas

### Fase 1: Polish Visual
- [ ] Modo oscuro/claro
- [ ] Vista de lista alternativa
- [ ] Mejores animaciones

### Fase 2: Filtros Avanzados
- [ ] Slider de BPM (60-200)
- [ ] Slider de Energía (0-100%)
- [ ] Filtro por década

### Fase 3: Reproducción
- [ ] Integrar Howler.js
- [ ] Barra de reproducción inferior
- [ ] Play/pause/next básico

### Fase 4: Analytics
- [ ] Gráficos de distribución
- [ ] Estadísticas de biblioteca
- [ ] Exportar playlists

## 📝 Notas de Arquitectura

1. **Sin Estado Global Complejo**: Todo el estado está en variables simples de JS
2. **Sin Build Process**: No webpack, no babel, no transpilación
3. **SQL Directo**: Queries SQL escritas a mano, sin ORM
4. **IPC Síncrono**: Handlers async/await pero sin streams complejos
5. **CSS Inline**: Estilos en el mismo HTML para simplicidad

## 🔒 Seguridad

- `webSecurity: false` solo para cargar imágenes locales
- No conexiones externas
- No ejecución de código remoto
- Validación de inputs en búsqueda
- Límites en todas las queries

---

**Última actualización**: 2025-01-10
**Versión**: 1.0.0
**Autor**: Claude + Usuario
**Estado**: Producción