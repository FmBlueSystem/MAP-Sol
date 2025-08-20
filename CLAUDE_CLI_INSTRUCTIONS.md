# 📋 INSTRUCCIONES PARA CLAUDE CLI - PROYECTO MAP

## 🚨 MENSAJE INICIAL OBLIGATORIO

Cuando abras este proyecto con Claude CLI, tu **PRIMER COMANDO** debe ser:

```
Por favor lee CLAUDE.md completo y los siguientes documentos de Archon ANTES de comenzar:

1. /Users/freddymolina/Desktop/Archon V2/Archon/CODE_QUALITY_STANDARDS.md
2. /Users/freddymolina/Desktop/Archon V2/Archon/MAP_UI_FIRST_PLANNING.md
3. /Users/freddymolina/Desktop/Archon V2/Archon/MAP_COMPLETE_TASK_LIST.md

Estos documentos contienen estándares obligatorios y el plan de desarrollo.
Confirma que los has leído antes de proceder con cualquier tarea.
```

---

## 🎯 COMANDOS FRECUENTES PARA CLAUDE

### Para Implementar Nueva Feature
```
Implementa [nombre de feature] siguiendo:
1. CODE_QUALITY_STANDARDS.md para estándares
2. MAP_COMPLETE_TASK_LIST.md para especificaciones
3. Funcionalidad primero, estética después
```

### Para Revisar Código
```
Revisa este código según CODE_QUALITY_STANDARDS.md:
- ¿Cumple con las métricas de complejidad?
- ¿Sigue las convenciones de nomenclatura?
- ¿Maneja errores correctamente?
```

### Para Crear Tests
```
Crea tests para [función/componente] siguiendo:
- Estructura de tests en CODE_QUALITY_STANDARDS.md
- Mínimo 60% cobertura
- Patrón Arrange-Act-Assert
```

### Para Documentar
```
Documenta [función/módulo] usando:
- Formato JSDoc de CODE_QUALITY_STANDARDS.md
- Incluir ejemplos de uso
- Explicar el "por qué", no el "qué"
```

### Para Refactorizar
```
Refactoriza [archivo/función] para:
- Reducir complejidad a máximo 15
- Funciones máximo 50 líneas
- Aplicar principios DRY y SOLID
```

---

## 📁 ESTRUCTURA DE ARCHIVOS CLAVE

### Documentación Principal (Este Proyecto)
```
CLAUDE.md                    # Brain del proyecto - LEER PRIMERO
CMD_COMMANDS.md              # Comandos disponibles
LESSONS-LEARNED-SYNTAX-ERRORS.md  # Errores comunes a evitar
```

### Documentación de Archon (Referencias)
```
/Users/freddymolina/Desktop/Archon V2/Archon/
├── CODE_QUALITY_STANDARDS.md    # Estándares obligatorios
├── MAP_UI_FIRST_PLANNING.md     # Plan de desarrollo UI
├── MAP_COMPLETE_TASK_LIST.md    # 27 tareas detalladas
├── MAP_PLAYER_PANEL_BRAINSTORM.md  # Specs del player
└── VU_METER_TECHNICAL_SPECS.md  # Specs del VU meter
```

---

## ✅ CHECKLIST ANTES DE CODEAR

```markdown
- [ ] Leí CLAUDE.md completo
- [ ] Leí CODE_QUALITY_STANDARDS.md
- [ ] Entiendo la tarea del MAP_COMPLETE_TASK_LIST.md
- [ ] Configuré ESLint según estándares
- [ ] Sé qué IPC handlers existen
- [ ] Identificé código a reutilizar
```

---

## 🔴 REGLAS NO NEGOCIABLES

1. **NO** crear UI sin backend funcional
2. **NO** declarar "completado" sin pruebas end-to-end
3. **NO** escribir funciones > 50 líneas
4. **NO** archivos > 400 líneas
5. **NO** complejidad > 15
6. **NO** commit sin tests (mínimo 60%)
7. **NO** ignorar errores (fail fast, fail loud)

---

## 🎯 TAREAS ACTUALES (Sprint 0)

Del archivo MAP_COMPLETE_TASK_LIST.md:

1. **[P10] Track Info Panel Completo** - 8h
   - Panel expandible con TODOS los datos
   - Gráfico radar HAMMS
   - Backend ya existe

2. **[P9] Sistema HAMMS Visible** - 6h
   - Top 10 tracks similares
   - Backend en similarity_searches

3. **[P9] Smart Playlist UI - Wizard** - 10h
   - Step-by-step con criterios
   - Backend en smart_playlists

---

## 💡 TIPS PARA CLAUDE CLI

### Contexto Persistente
```
Recuerda que estamos en Sprint 0: hacer visible lo oculto.
El backend ya existe, solo necesitamos UI.
```

### Validación Continua
```
¿Este código cumple con CODE_QUALITY_STANDARDS.md?
¿Estoy siguiendo el plan de MAP_UI_FIRST_PLANNING.md?
```

### Testing Incremental
```
Escribe el test primero, luego la implementación.
Verifica que funciona antes de pulir la UI.
```

---

## 📊 MÉTRICAS A MANTENER

- **Cobertura Tests**: ≥ 60%
- **Complejidad**: ≤ 15
- **Tamaño Funciones**: ≤ 50 líneas
- **Tamaño Archivos**: ≤ 400 líneas
- **Performance**: < 2s carga, < 100ms búsqueda
- **Cache Hit Rate**: > 70%

---

## 🚀 WORKFLOW RECOMENDADO

```bash
# 1. Leer documentación
claude: "Lee CLAUDE.md y documentos de Archon"

# 2. Entender la tarea
claude: "Explica Task #1 del MAP_COMPLETE_TASK_LIST.md"

# 3. Implementar backend
claude: "Implementa el IPC handler para track-info"

# 4. Crear tests
claude: "Crea tests para el handler track-info"

# 5. Implementar UI
claude: "Crea el componente Track Info Panel"

# 6. Conectar frontend-backend
claude: "Conecta el panel con el IPC handler"

# 7. Validar
claude: "Verifica que cumple con todos los estándares"
```

---

## 📝 FORMATO DE COMMITS

```
feat: Add Track Info Panel with HAMMS visualization
- Implements expandable panel showing all metadata
- Adds 7-dimension radar chart for HAMMS
- Connects to existing backend via IPC
- Tests included (65% coverage)
- Follows CODE_QUALITY_STANDARDS.md

Closes Task #1 from Sprint 0
```

---

**RECORDATORIO FINAL**: Este proyecto sigue los estándares de Archon. 
Cada línea de código debe cumplir con CODE_QUALITY_STANDARDS.md.
La funcionalidad SIEMPRE viene antes que la estética.

---

*Última actualización: 2025-01-19*
*Siguiente revisión: Al completar Sprint 0*