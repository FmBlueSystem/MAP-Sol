# CLAUDE.md - Music Analyzer Pro (MAP) v3.0

> **Versión**: 3.0.0 - Integración con Estándares Archon
> **Última actualización**: 2025-01-19
> **Estado**: Producción con Estándares de Calidad Enforced

---

## 🚨 CONTEXTO CRÍTICO - LEER PRIMERO

### 📚 DOCUMENTOS OBLIGATORIOS DE ARCHON

**ANTES de escribir CUALQUIER línea de código, DEBES leer:**

1. **ESTÁNDARES DE CALIDAD** ⚠️ CRÍTICO

    ```
    Ubicación: /Users/freddymolina/Desktop/Archon V2/Archon/CODE_QUALITY_STANDARDS.md
    Aplicar: TODOS los principios, métricas y ejemplos
    ```

2. **ARQUITECTURA Y PATRONES**

    ```
    Ubicación: /Users/freddymolina/Desktop/Archon V2/Archon/CLAUDE.md
    Consultar: Arquitectura existente, no reinventar
    ```

3. **INTEGRACIÓN ARCHON MCP**

    ```
    Ubicación: /Users/freddymolina/Desktop/Archon V2/Archon/CLAUDE-ARCHON.md
    Usar: Para task management y documentación
    ```

4. **ESPECIFICACIONES TÉCNICAS**
    ```
    VU Meter: /Users/freddymolina/Desktop/Archon V2/Archon/VU_METER_TECHNICAL_SPECS.md
    Player: /Users/freddymolina/Desktop/Archon V2/Archon/MAP_PLAYER_PANEL_BRAINSTORM.md
    UI Planning: /Users/freddymolina/Desktop/Archon V2/Archon/MAP_UI_FIRST_PLANNING.md
    ```

---

## ⛔ REGLAS DE ORO - NO NEGOCIABLES

### 1. FUNCIONAL PRIMERO, BONITO DESPUÉS

```javascript
// ❌ INCORRECTO
<Button onClick={() => {}} className="beautiful-gradient">
  Analyze  // No hace nada real
</Button>

// ✅ CORRECTO
<Button onClick={analyzeAudio} disabled={!audioFile}>
  Analyze  // Funcionalidad real implementada
</Button>
```

### 2. VALIDACIÓN ANTES DE DECLARAR "COMPLETADO"

```markdown
✅ Checklist obligatorio:

- [ ] Backend implementado y probado
- [ ] Frontend conectado con IPC handlers
- [ ] Errores manejados con feedback al usuario
- [ ] Tests escritos y pasando
- [ ] Documentación actualizada
- [ ] Usuario confirmó que funciona
```

### 3. ESTÁNDARES DE CÓDIGO (desde CODE_QUALITY_STANDARDS.md)

```javascript
// Aplicar SIEMPRE:
- ESLint configurado según estándares
- Nomenclatura: camelCase para funciones, PascalCase para clases
- Funciones: máximo 50 líneas
- Archivos: máximo 400 líneas
- Complejidad ciclomática: máximo 15
- Tests: mínimo 60% cobertura
```

---

## 🏗️ ARQUITECTURA DEL PROYECTO

### Stack Tecnológico Actual

```yaml
Frontend:
    - Framework: Vanilla JS (ES6+) + Módulos
    - UI Library: HTML5 + CSS3 (Glassmorphism)
    - Audio: Web Audio API + Howler.js
    - Estado: Sin framework (considerar React para v4)

Backend:
    - Runtime: Node.js + Electron
    - Database: SQLite3 (music_analyzer.db)
    - IPC: Electron IPC para comunicación
    - Cache: LRU con TTL 5 minutos

Análisis:
    - Metadata: MixedInKey (embebido)
    - Features: Essentia + Librosa
    - AI: OpenAI GPT-4 (opcional)
    - Pipeline: Bash + Python scripts
```

### Estructura de Carpetas (OBLIGATORIA)

```
music-app-clean/
├── src/                    # NUEVO: Migrar código aquí
│   ├── components/         # Componentes UI reutilizables
│   ├── services/          # Lógica de negocio
│   ├── utils/             # Helpers y utilities
│   ├── hooks/             # Custom hooks (cuando migre a React)
│   ├── types/             # TypeScript types (futuro)
│   └── constants/         # Constantes globales
├── js/                    # ACTUAL: Código legacy
│   ├── audio-player.js
│   ├── performance-optimizer.js
│   └── database-optimizer.js
├── handlers/              # IPC handlers
├── tests/                 # NUEVO: Tests organizados
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                  # Documentación del proyecto
└── scripts/               # Scripts de análisis
    ├── analyze_complete.sh
    └── python/
```

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### ✅ Completado (95%)

- [x] Base de datos con 3,808 archivos
- [x] Sistema HAMMS de 7 dimensiones
- [x] Pipeline de análisis híbrido
- [x] Player básico funcional
- [x] Menú contextual completo
- [x] Sistema de optimización
- [x] 15 índices SQLite optimizados

### 🔄 En Progreso (Sprint 0 - UI First)

- [ ] Track Info Panel Completo (Task #1)
- [ ] Sistema HAMMS Visible (Task #2)
- [ ] Smart Playlist UI (Task #3-4)
- [ ] Energy Flow Visualization (Task #5)
- [ ] Export Functions UI (Task #6)
- [ ] VU Meter Integration (Proyecto separado)

### 🚀 Pendiente (5%)

- [ ] Migración a estructura src/
- [ ] Tests automatizados (0% → 60%)
- [ ] TypeScript migration
- [ ] React migration (v4.0)

---

## 🔌 IPC HANDLERS - ESTADO ACTUAL

### ✅ Funcionando

```javascript
// Implementados y probados
'get-files-with-cached-artwork'; // Obtiene archivos con artwork
'search-tracks'; // Búsqueda con filtros
'show-in-folder'; // Abre en Finder/Explorer
'extract-metadata'; // Extrae con music-metadata
```

### ⚠️ Parcialmente Implementados

```javascript
'play-track'; // Frontend-only, falta integración Electron
'pause-track'; // Frontend-only, falta integración Electron
'export-json'; // Funciona pero podría usar workers
'export-csv'; // Funciona pero podría optimizarse
```

### ❌ Pendientes

```javascript
'update-metadata'; // Actualizar en BD
'delete-track'; // Eliminar de BD
'create-playlist'; // Crear playlist
'add-to-playlist'; // Agregar a playlist
'import-music'; // Importar nuevos archivos
```

---

## 💾 BASE DE DATOS

### Esquema Principal

```sql
-- Tabla principal con metadata
CREATE TABLE audio_files (
    id INTEGER PRIMARY KEY,
    file_path TEXT UNIQUE,
    title TEXT,
    artist TEXT,
    album TEXT,
    genre TEXT,
    artwork_path TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Tabla de análisis AI/ML
CREATE TABLE llm_metadata (
    file_id INTEGER PRIMARY KEY,
    AI_BPM INTEGER,           -- MixedInKey
    AI_KEY TEXT,              -- MixedInKey
    AI_ENERGY REAL,           -- MixedInKey
    AI_DANCEABILITY REAL,     -- Essentia
    AI_VALENCE REAL,          -- Essentia
    AI_ACOUSTICNESS REAL,     -- Essentia
    AI_INSTRUMENTALNESS REAL, -- Essentia
    AI_TEMPO_CONFIDENCE REAL, -- Confianza
    FOREIGN KEY (file_id) REFERENCES audio_files(id)
);

-- Índices optimizados (15 total)
CREATE INDEX idx_artist ON audio_files(artist);
CREATE INDEX idx_ai_bpm ON llm_metadata(AI_BPM);
-- ... más índices
```

---

## 🚀 COMANDOS Y SCRIPTS

### Desarrollo

```bash
# Iniciar aplicación
npm start

# Análisis completo de música
./analyze_complete.sh /path/to/music

# Solo análisis de features
./analyze_step3_only.sh

# Enriquecimiento con AI (requiere OPENAI_API_KEY)
./analyze_step4_ai_enrichment.sh

# Linting y calidad
npm run lint
npm run test
```

### Base de Datos

```bash
# Consultas útiles
sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files"
sqlite3 music_analyzer.db "SELECT * FROM llm_metadata LIMIT 5"
sqlite3 music_analyzer.db "VACUUM"  # Optimizar
```

---

## 📈 MÉTRICAS DE CALIDAD (desde CODE_QUALITY_STANDARDS.md)

### Objetivos Actuales

```yaml
Cobertura de Tests:
  Actual: 0%
  Objetivo: 60%
  Crítico: 90% para audio pipeline

Complejidad:
  Máximo permitido: 15
  Promedio actual: 8

Tamaño de Archivos:
  Máximo: 400 líneas
  Promedio actual: 250 líneas

Performance:
  Tiempo de carga: < 2 segundos
  Búsqueda: < 100ms
  Cache hit rate: > 70%
```

---

## 🐛 ISSUES CONOCIDOS

### Críticos (P1)

1. **Player controls**: Solo frontend, falta integración con Electron
2. **Memory leak**: En visualizaciones después de 2+ horas

### Importantes (P2)

3. **Export large files**: Bloquea UI con >1000 tracks
4. **Duplicate detection**: Implementado parcialmente
5. **Playlist persistence**: No se guardan en DB

### Menores (P3)

6. **UI responsiveness**: Algunos componentes no son mobile-friendly
7. **Dark mode**: Inconsistente en modales

---

## 🎯 WORKFLOW DE DESARROLLO

### Para Nueva Feature

```bash
1. Leer CODE_QUALITY_STANDARDS.md
2. Crear branch: feature/nombre-descriptivo
3. Implementar backend primero
4. Tests para backend
5. Implementar frontend
6. Conectar con IPC
7. Tests de integración
8. Documentar cambios
9. Code review según checklist
10. Merge cuando todo esté verde
```

### Para Bug Fix

```bash
1. Reproducir el bug
2. Escribir test que falle
3. Fix mínimo necesario
4. Verificar test pasa
5. Verificar no rompe otros tests
6. Documentar en CHANGELOG
```

---

## 📝 DOCUMENTACIÓN RELACIONADA

### En Este Proyecto

- `README.md` - Documentación de usuario
- `CLAUDE.md` - Este archivo (brain)
- `CMD_COMMANDS.md` - Comandos disponibles
- `LESSONS-LEARNED-SYNTAX-ERRORS.md` - Errores comunes

### En Archon (OBLIGATORIO CONSULTAR)

- `CODE_QUALITY_STANDARDS.md` - Estándares de código
- `MAP_UI_FIRST_PLANNING.md` - Plan de desarrollo UI
- `MAP_COMPLETE_TASK_LIST.md` - Todas las tareas pendientes
- `VU_METER_TECHNICAL_SPECS.md` - Especificaciones VU meter

---

## ⚠️ RECORDATORIOS CRÍTICOS

### ANTES de Codear

1. ¿Leíste CODE_QUALITY_STANDARDS.md?
2. ¿Entiendes qué espera el usuario?
3. ¿Existe código similar que puedas reutilizar?
4. ¿El approach es el más simple posible?

### DURANTE el Desarrollo

1. ¿Estás siguiendo los estándares?
2. ¿Los nombres son descriptivos?
3. ¿Estás manejando errores?
4. ¿Hay feedback al usuario?

### ANTES de Declarar "Completado"

1. ¿Funciona end-to-end?
2. ¿Hay tests?
3. ¿Está documentado?
4. ¿El usuario lo probó?

---

## 🔄 PROCESO DE MEJORA CONTINUA

### Métricas a Trackear

- Bugs por sprint
- Tiempo de resolución
- Cobertura de tests (trend)
- Performance metrics
- User satisfaction

### Reviews Periódicos

- **Diario**: Standup (qué hice, qué haré, blockers)
- **Semanal**: Code review de PRs
- **Sprint**: Retrospectiva técnica
- **Mensual**: Actualización de este documento

---

## 💡 DECISIONES ARQUITECTÓNICAS

### ¿Por qué Vanilla JS?

- **Decisión**: Mantener simplicidad inicial
- **Trade-off**: Menos estructura vs menos complejidad
- **Futuro**: Migrar a React en v4.0

### ¿Por qué SQLite?

- **Decisión**: Portabilidad y simplicidad
- **Trade-off**: Sin concurrencia vs sin servidor
- **Límite**: Funciona bien hasta ~100k tracks

### ¿Por qué Electron?

- **Decisión**: Cross-platform con tecnologías web
- **Trade-off**: Peso vs familiaridad
- **Alternativa considerada**: Tauri (futuro)

---

## 🎯 DEFINICIÓN DE "HECHO"

Una tarea está COMPLETA cuando:

```markdown
✅ Funcionalidad implementada y funcionando
✅ IPC handlers conectados (si aplica)
✅ Tests escritos y pasando (mínimo 60%)
✅ Documentación actualizada
✅ Code review aprobado
✅ Sin warnings del linter
✅ Performance dentro de límites
✅ Usuario verificó que funciona
✅ Merged a main
```

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### Esta Semana (Sprint 0)

1. [ ] Implementar Track Info Panel (8h)
2. [ ] Hacer visible sistema HAMMS (6h)
3. [ ] UI para Smart Playlists (10h)

### Este Mes

1. [ ] Completar Sprint 0 (40h total)
2. [ ] Comenzar Sprint 1 - UX Pro (40h)
3. [ ] Alcanzar 30% cobertura de tests

### Este Trimestre

1. [ ] Completar Sprint 0 y 1
2. [ ] 60% cobertura de tests
3. [ ] Migración a TypeScript iniciada
4. [ ] Plan para React v4.0

---

**Última actualización por Claude**: 2025-01-19
**Sesión**: Integración con Estándares Archon
**Próxima acción**: Implementar Track Info Panel siguiendo CODE_QUALITY_STANDARDS.md

---

_Este documento es la fuente de verdad para MAP. Manténlo actualizado._
