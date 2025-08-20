# 🗺️ ROADMAP - Music Analyzer Pro

> Plan de Implementación CAMINO 2 - BALANCED
> Fecha Inicio: 2025-01-10
> Duración: 4 semanas (160 horas)

---

## 📊 RESUMEN EJECUTIVO

```yaml
Objetivo: Escalar a 10,000+ tracks con features diferenciadores
Inversión: 160 horas (4 semanas, 1 desarrollador)
ROI Esperado: 278%
Riesgo: BAJO
Prioridad: Performance → Features → Polish
```

---

## 🏃 SPRINT 1 - Foundation (Semana 1: 40h)

_Foco: Resolver bottlenecks de performance_

### ✅ TASK_020: Virtual Scrolling con Intersection Observer

**Prioridad**: 🔴 CRÍTICA
**Estimación**: 12 horas
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- index-complete.html (refactor completo de displayFiles())
- Nuevo: js/virtual-scroll.js (módulo dedicado)
- styles.css (ajustes para contenedor virtual)
```

#### Implementación:

```javascript
// PATRÓN: Virtual DOM con Intersection Observer
class VirtualScroll {
    constructor(container, itemHeight, totalItems) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.totalItems = totalItems;
        this.visibleRange = { start: 0, end: 50 };
        this.buffer = 10; // Items extra arriba/abajo

        this.setupObserver();
        this.setupScrollContainer();
    }

    setupObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.updateVisibleRange();
                    }
                });
            },
            { rootMargin: '100px' }
        );
    }
}
```

#### Criterios de Aceptación:

- [ ] Solo 50 elementos en DOM simultáneamente
- [ ] Scroll suave sin saltos
- [ ] Posición preservada al filtrar
- [ ] Performance <20ms en scroll
- [ ] Funciona con 10,000+ items

#### Riesgos:

- **Complejidad alta**: Virtual scroll es complejo
- **Mitigación**: Usar librería simple como `virtual-scroll-list`
- **Fallback**: Paginación tradicional si falla

---

### ✅ TASK_021: Web Workers para Búsqueda y Filtrado

**Prioridad**: 🟡 ALTA
**Estimación**: 10 horas
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- Nuevo: workers/search-worker.js
- index-complete.html (delegar búsqueda a worker)
- main.js (handler para worker messages)
```

#### Implementación:

```javascript
// workers/search-worker.js
self.addEventListener('message', (e) => {
    const { query, filters, data } = e.data;

    // Búsqueda pesada en background thread
    const results = data.filter((item) => {
        // Lógica de filtrado compleja
        return matchesQuery(item, query) && matchesFilters(item, filters);
    });

    // Enviar resultados de vuelta
    self.postMessage({
        results,
        cacheKey: `${query}_${JSON.stringify(filters)}`,
    });
});

// index-complete.html
const searchWorker = new Worker('workers/search-worker.js');
searchWorker.postMessage({ query, filters, data: allFiles });
searchWorker.onmessage = (e) => displayFiles(e.data.results);
```

#### Criterios de Aceptación:

- [ ] UI nunca se congela durante búsqueda
- [ ] Búsquedas <30ms en 10k items
- [ ] Worker reutilizable para otros cálculos
- [ ] Fallback si Workers no disponibles

#### Riesgos:

- **Compatibilidad browser**: Algunos browsers antiguos
- **Mitigación**: Feature detection y fallback
- **Debugging complejo**: Console.log limitado en workers

---

### ✅ TASK_022: Optimización Queries SQL y Caché

**Prioridad**: 🟡 ALTA  
**Estimación**: 8 horas
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- main.js (reescribir queries con CTEs)
- Nuevo: cache-layer.js (LRU cache)
- database-init.js (más índices)
```

#### Implementación:

```javascript
// cache-layer.js - PATRÓN: LRU Cache
class LRUCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        // Mover al final (más reciente)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // Eliminar el más antiguo (primero)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
}

// main.js - Query optimizada con CTE
const optimizedQuery = `
WITH filtered_files AS (
    SELECT * FROM audio_files 
    WHERE artist LIKE ? 
    LIMIT 1000
)
SELECT f.*, l.* 
FROM filtered_files f
LEFT JOIN llm_metadata l ON f.id = l.file_id
ORDER BY f.artist, f.title
`;
```

#### Criterios de Aceptación:

- [ ] Queries <50ms para 10k registros
- [ ] Cache hit rate >85%
- [ ] Memory footprint <50MB para cache
- [ ] TTL configurable por tipo de query

#### Riesgos:

- **Cache invalidation**: El problema más difícil
- **Mitigación**: TTL corto (5 min) + invalidación manual
- **Memory leaks**: Cache sin límite
- **Mitigación**: LRU con size máximo

---

### ✅ TASK_023: Modularización del Backend

**Prioridad**: 🟢 MEDIA
**Estimación**: 6 horas
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- main.js (dividir en módulos)
- Nuevo: handlers/search-handler.js
- Nuevo: handlers/filter-handler.js
- Nuevo: handlers/artwork-handler.js
- Nuevo: services/database-service.js
```

#### Implementación:

```javascript
// main.js simplificado
const { searchHandler } = require('./handlers/search-handler');
const { filterHandler } = require('./handlers/filter-handler');
const { DatabaseService } = require('./services/database-service');

const db = new DatabaseService('./music_analyzer.db');

ipcMain.handle('search-tracks', searchHandler(db));
ipcMain.handle('get-filter-options', filterHandler(db));

// handlers/search-handler.js
module.exports.searchHandler = (db) => async (event, params) => {
    try {
        const results = await db.searchTracks(params);
        return results;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
};
```

#### Criterios de Aceptación:

- [ ] main.js < 100 líneas
- [ ] Cada handler en archivo separado
- [ ] Services reutilizables
- [ ] Tests unitarios posibles

#### Riesgos:

- **Over-engineering**: Demasiados archivos
- **Mitigación**: Max 5-6 módulos
- **Circular dependencies**: Imports cruzados
- **Mitigación**: Arquitectura en capas clara

---

### ✅ TASK_024: Tests de Performance Automatizados

**Prioridad**: 🟢 MEDIA
**Estimación**: 4 horas
**Dependencias**: TASK_020, TASK_021

#### Archivos a Crear:

```
- tests/performance.test.js
- tests/memory.test.js
- package.json (agregar script test:perf)
```

#### Implementación:

```javascript
// tests/performance.test.js
const { performance } = require('perf_hooks');

describe('Performance Tests', () => {
    test('Search 10k items < 50ms', async () => {
        const start = performance.now();
        const results = await searchTracks({
            query: 'test',
            filters: { genre: 'Rock' },
        });
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50);
        expect(results.length).toBeGreaterThan(0);
    });

    test('Virtual scroll render < 20ms', () => {
        const start = performance.now();
        virtualScroll.render(mockData);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(20);
    });
});
```

#### Criterios de Aceptación:

- [ ] 10+ tests de performance
- [ ] CI/CD integration ready
- [ ] Reportes en formato JSON
- [ ] Baseline metrics guardadas

#### Riesgos:

- **Tests flaky**: Variabilidad en tiempos
- **Mitigación**: Múltiples runs, promedios
- **False positives**: Máquina lenta
- **Mitigación**: Thresholds relativos

---

## 🚀 SPRINT 2 - Features (Semana 2: 40h)

_Foco: Agregar valor diferenciador_

### ✅ TASK_025: Sistema HAMMS de Similitud

**Prioridad**: 🔴 CRÍTICA (Diferenciador)
**Estimación**: 12 horas
**Dependencias**: Web Workers (TASK_021)

#### Archivos a Modificar:

```
- Nuevo: services/hamms-calculator.js
- Nuevo: workers/hamms-worker.js
- database.js (nueva tabla hamms_vectors)
- index-complete.html (botón "Find Similar")
```

#### Implementación:

```javascript
// services/hamms-calculator.js
class HAMMSCalculator {
    // 7 dimensiones del vector HAMMS
    calculateVector(track) {
        return {
            bpm_normalized: this.normalize(track.AI_BPM, 60, 200),
            energy: track.AI_ENERGY,
            danceability: track.AI_DANCEABILITY,
            valence: track.AI_VALENCE,
            acousticness: track.AI_ACOUSTICNESS,
            instrumentalness: track.AI_INSTRUMENTALNESS,
            key_compatibility: this.keyToNumber(track.AI_KEY),
        };
    }

    calculateSimilarity(vector1, vector2) {
        // Distancia euclidiana en 7D
        const dimensions = Object.keys(vector1);
        const sumSquares = dimensions.reduce((sum, dim) => {
            const diff = vector1[dim] - vector2[dim];
            return sum + diff * diff;
        }, 0);

        return 1 / (1 + Math.sqrt(sumSquares)); // 0-1, 1 = idéntico
    }

    findSimilar(targetTrack, allTracks, limit = 20) {
        const targetVector = this.calculateVector(targetTrack);

        return allTracks
            .map((track) => ({
                track,
                similarity: this.calculateSimilarity(targetVector, this.calculateVector(track)),
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(1, limit + 1); // Excluir el mismo track
    }
}
```

#### Criterios de Aceptación:

- [ ] Cálculo <100ms para 10k tracks
- [ ] Resultados relevantes (validación manual)
- [ ] Cache de vectores en BD
- [ ] UI muestra % de similitud
- [ ] Export de playlist similar

#### Riesgos:

- **Cálculo pesado**: O(n) para cada búsqueda
- **Mitigación**: Pre-calcular y cachear vectores
- **Relevancia cuestionable**: Algoritmo simple
- **Mitigación**: Ajustar pesos por dimensión

---

### ✅ TASK_026: Visualización Canvas BPM vs Energy

**Prioridad**: 🟡 ALTA (Wow Factor)
**Estimación**: 10 horas  
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- Nuevo: js/heatmap-viz.js
- index-complete.html (canvas container)
- styles.css (canvas styling)
```

#### Implementación:

```javascript
// js/heatmap-viz.js
class BPMEnergyHeatmap {
    constructor(canvas, data) {
        this.ctx = canvas.getContext('2d');
        this.data = data;
        this.width = canvas.width;
        this.height = canvas.height;

        this.scales = {
            x: d3.scaleLinear().domain([60, 200]).range([0, this.width]),
            y: d3.scaleLinear().domain([0, 1]).range([this.height, 0]),
        };
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Create heatmap grid
        const gridSize = 10;
        const heatGrid = this.createHeatGrid(gridSize);

        // Draw heatmap
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const intensity = heatGrid[x][y];
                const color = this.getHeatColor(intensity);

                this.ctx.fillStyle = color;
                this.ctx.fillRect(
                    x * (this.width / gridSize),
                    y * (this.height / gridSize),
                    this.width / gridSize,
                    this.height / gridSize
                );
            }
        }

        // Draw points
        this.data.forEach((track) => {
            const x = this.scales.x(track.AI_BPM);
            const y = this.scales.y(track.AI_ENERGY);

            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
            this.ctx.fill();
        });
    }

    getHeatColor(intensity) {
        // Gradient from blue (cold) to red (hot)
        const r = Math.floor(255 * intensity);
        const b = Math.floor(255 * (1 - intensity));
        return `rgba(${r}, 0, ${b}, 0.7)`;
    }
}
```

#### Criterios de Aceptación:

- [ ] Render <100ms para 5k puntos
- [ ] Interactivo (click para filtrar región)
- [ ] Zoom/pan funcional
- [ ] Export como imagen
- [ ] Responsive resize

#### Riesgos:

- **Performance con muchos puntos**: Canvas lento
- **Mitigación**: Clustering, max 1000 puntos visibles
- **UX confusa**: No intuitivo
- **Mitigación**: Tutorial/tooltips claros

---

### ✅ TASK_027: Export a Formatos DJ Pro

**Prioridad**: 🟢 MEDIA
**Estimación**: 8 horas
**Dependencias**: Ninguna

#### Archivos a Crear:

```
- services/export/m3u-exporter.js
- services/export/rekordbox-exporter.js
- services/export/traktor-exporter.js
- index-complete.html (menú export)
```

#### Implementación:

```javascript
// services/export/rekordbox-exporter.js
class RekordboxExporter {
    exportPlaylist(tracks, playlistName) {
        const xml = this.createXMLDocument();
        const collection = xml.createElement('COLLECTION');

        tracks.forEach((track, index) => {
            const trackNode = xml.createElement('TRACK');
            trackNode.setAttribute('TrackID', index + 1);
            trackNode.setAttribute('Name', track.title);
            trackNode.setAttribute('Artist', track.artist);
            trackNode.setAttribute('Album', track.album);
            trackNode.setAttribute('Genre', track.LLM_GENRE);
            trackNode.setAttribute('BPM', track.AI_BPM);
            trackNode.setAttribute('Key', this.convertKey(track.AI_KEY));
            trackNode.setAttribute('Location', `file://${track.file_path}`);

            collection.appendChild(trackNode);
        });

        const playlist = xml.createElement('PLAYLIST');
        playlist.setAttribute('Name', playlistName);

        tracks.forEach((track, index) => {
            const entry = xml.createElement('ENTRY');
            entry.setAttribute('Key', index + 1);
            playlist.appendChild(entry);
        });

        return new XMLSerializer().serializeToString(xml);
    }

    convertKey(key) {
        // Convertir a notación Camelot/Musical
        const keyMap = {
            C: '8B',
            Am: '8A',
            G: '9B',
            Em: '9A',
            // ... mapeo completo
        };
        return keyMap[key] || key;
    }
}
```

#### Criterios de Aceptación:

- [ ] Export M3U8 funcional
- [ ] Export Rekordbox XML válido
- [ ] Export Traktor NML válido
- [ ] Preservar metadata completa
- [ ] Paths relativos/absolutos configurables

#### Riesgos:

- **Formatos cambiantes**: Rekordbox updates
- **Mitigación**: Versión específica soportada
- **Validación**: Testing con software real

---

### ✅ TASK_028: Sistema de Favoritos y Ratings

**Prioridad**: 🟢 MEDIA
**Estimación**: 6 horas
**Dependencias**: Ninguna

#### Archivos a Modificar:

```
- database.js (tabla user_preferences)
- index-complete.html (stars UI)
- main.js (handlers para favoritos)
```

#### Criterios de Aceptación:

- [ ] 5-star rating system
- [ ] Favoritos con corazón
- [ ] Persistencia en BD
- [ ] Filtro por rating
- [ ] Export favoritos

---

### ✅ TASK_029: Batch de Tests Críticos

**Prioridad**: 🟡 ALTA
**Estimación**: 4 horas
**Dependencias**: Todas las anteriores

#### Archivos a Crear:

```
- tests/virtual-scroll.test.js
- tests/hamms.test.js
- tests/export.test.js
```

#### Criterios de Aceptación:

- [ ] Coverage >40%
- [ ] Tests E2E básicos
- [ ] CI ready

---

## 🎨 SPRINT 3 - Polish (Semana 3: 40h)

_Foco: UX refinements y estabilidad_

### ✅ TASK_030: Animaciones y Transiciones

**Prioridad**: 🟢 BAJA
**Estimación**: 8 horas

### ✅ TASK_031: Keyboard Shortcuts Completos

**Prioridad**: 🟢 BAJA
**Estimación**: 6 horas

### ✅ TASK_032: Sistema de Notificaciones

**Prioridad**: 🟢 BAJA
**Estimación**: 6 horas

### ✅ TASK_033: Historial de Búsquedas

**Prioridad**: 🟢 BAJA
**Estimación**: 8 horas

### ✅ TASK_034: Modo Presentación/Fullscreen

**Prioridad**: 🟢 BAJA
**Estimación**: 6 horas

### ✅ TASK_035: Backup/Restore de BD

**Prioridad**: 🟡 MEDIA
**Estimación**: 6 horas

---

## 🚢 SPRINT 4 - Release (Semana 4: 40h)

_Foco: Deployment y documentación_

### ✅ TASK_036: Build para Distribución

**Prioridad**: 🔴 CRÍTICA
**Estimación**: 10 horas

### ✅ TASK_037: Auto-updater

**Prioridad**: 🟡 ALTA
**Estimación**: 8 horas

### ✅ TASK_038: Documentación Usuario

**Prioridad**: 🟡 ALTA
**Estimación**: 8 horas

### ✅ TASK_039: Video Demos

**Prioridad**: 🟢 MEDIA
**Estimación**: 6 horas

### ✅ TASK_040: Performance Profiling Final

**Prioridad**: 🟡 ALTA
**Estimación**: 8 horas

---

## 📊 MÉTRICAS DE ÉXITO

```yaml
Sprint 1 Success:
    - Virtual scroll funcionando
    - Performance 2x mejor
    - 0 crashes con 10k items

Sprint 2 Success:
    - HAMMS system completo
    - Canvas viz impresionante
    - 3 formatos export funcionales

Sprint 3 Success:
    - UX pulida nivel comercial
    - Keyboard navigation completa
    - 0 bugs críticos

Sprint 4 Success:
    - App distribuible (.dmg/.exe)
    - Documentación completa
    - 50+ beta testers felices
```

---

## 🎯 DEFINICIÓN DE "DONE"

Para cada tarea:

- [ ] Código implementado y funcionando
- [ ] Tests escritos y pasando
- [ ] Documentación actualizada
- [ ] Code review (self o peer)
- [ ] Performance validada
- [ ] No regresiones introducidas
- [ ] Commit atómico con mensaje claro

---

## 📈 TRACKING

| Sprint | Inicio     | Fin        | Horas | Completado | Bloqueadores |
| ------ | ---------- | ---------- | ----- | ---------- | ------------ |
| 1      | 2025-01-11 | 2025-01-17 | 40h   | 0%         | -            |
| 2      | 2025-01-18 | 2025-01-24 | 40h   | 0%         | -            |
| 3      | 2025-01-25 | 2025-01-31 | 40h   | 0%         | -            |
| 4      | 2025-02-01 | 2025-02-07 | 40h   | 0%         | -            |

---

## 🚨 GESTIÓN DE RIESGOS

### Riesgos Identificados:

1. **Virtual scroll complejidad** → Mitigación: Librería existente
2. **Performance en 10k+** → Mitigación: Profiling continuo
3. **Export formats breaking** → Mitigación: Validación con software real
4. **Scope creep** → Mitigación: Sprint planning estricto

### Plan B:

- Si virtual scroll falla → Paginación tradicional
- Si HAMMS muy lento → Pre-calcular en background
- Si Canvas no performa → SVG o tabla simple
- Si export falla → Solo M3U básico

---

_Roadmap v1.0 - Music Analyzer Pro_
_Última actualización: 2025-01-10_
_Siguiente review: Fin Sprint 1_
