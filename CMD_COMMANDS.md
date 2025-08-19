# 📖 CMD COMMANDS - Music Analyzer Pro
> Documentación completa de comandos disponibles
> Última actualización: 2025-08-14

---

## 🎯 COMANDOS PRINCIPALES

### CMD_ANALYZE
**Propósito**: Analizar el estado actual del proyecto
**Sintaxis**: `CMD_ANALYZE [target]`
**Opciones**:
- `CMD_ANALYZE` - Análisis general del proyecto
- `CMD_ANALYZE database` - Análisis de base de datos
- `CMD_ANALYZE performance` - Métricas de rendimiento
- `CMD_ANALYZE code` - Análisis de código y complejidad

**Salida**:
```yaml
Métricas:
  - Tamaño total del proyecto
  - Número de archivos
  - Estado de optimización
  - Métricas de rendimiento
  - Cobertura de tests
```

**Ejemplo**:
```bash
CMD_ANALYZE el proyecto actual
# Retorna análisis completo con métricas
```

---

### CMD_OPTIMIZE
**Propósito**: Aplicar optimizaciones automáticas
**Sintaxis**: `CMD_OPTIMIZE [module]`
**Opciones**:
- `CMD_OPTIMIZE` - Optimización completa
- `CMD_OPTIMIZE database` - Optimizar queries y cache
- `CMD_OPTIMIZE performance` - Lazy loading y virtual scroll
- `CMD_OPTIMIZE bundle` - Minificación y tree-shaking

**Acciones**:
1. Crea módulos de optimización
2. Integra lazy loading
3. Implementa cache LRU
4. Optimiza queries SQL
5. Configura Web Workers

**Ejemplo**:
```bash
CMD_OPTIMIZE el proyecto
# Aplica todas las optimizaciones disponibles
```

---

### CMD_BUILD
**Propósito**: Construir componentes o features
**Sintaxis**: `CMD_BUILD [component] [options]`
**Componentes disponibles**:
- `complete-context-menu-actions` - Menú contextual completo
- `virtual-scroll` - Implementar scroll virtual
- `hamms-system` - Sistema de similitud musical
- `export-system` - Sistema de exportación
- `visualization` - Visualizaciones de audio

**Ejemplo**:
```bash
CMD_BUILD complete-context-menu-actions
# Construye menú contextual con todas las acciones
```

**Opciones adicionales**:
- `--professional` - Versión profesional con features avanzadas
- `--minimal` - Versión minimalista
- `--with-tests` - Incluir tests unitarios

---

### CMD_DOCUMENT
**Propósito**: Generar documentación
**Sintaxis**: `CMD_DOCUMENT [type]`
**Tipos**:
- `commands` - Esta documentación de comandos
- `api` - Documentación de API/IPC
- `roadmap` - Plan de desarrollo
- `technical` - Documentación técnica
- `user` - Manual de usuario

**Ejemplo**:
```bash
CMD_DOCUMENT comandos disponibles
# Genera este archivo de documentación
```

---

### CMD_TEST
**Propósito**: Ejecutar tests
**Sintaxis**: `CMD_TEST [suite]`
**Suites**:
- `all` - Todos los tests
- `unit` - Tests unitarios
- `integration` - Tests de integración
- `performance` - Tests de rendimiento
- `e2e` - Tests end-to-end

**Ejemplo**:
```bash
CMD_TEST performance
# Ejecuta suite de tests de rendimiento
```

---

### CMD_FIX
**Propósito**: Reparar problemas conocidos
**Sintaxis**: `CMD_FIX [issue]`
**Issues comunes**:
- `broken-ui` - Reparar interfaz rota
- `database-corruption` - Reparar BD corrupta
- `missing-dependencies` - Instalar dependencias
- `performance-issues` - Aplicar fixes de rendimiento

**Ejemplo**:
```bash
CMD_FIX broken-ui
# Repara problemas de interfaz
```

---

### CMD_DEPLOY
**Propósito**: Preparar para deployment
**Sintaxis**: `CMD_DEPLOY [platform]`
**Plataformas**:
- `mac` - Build para macOS (.dmg)
- `windows` - Build para Windows (.exe)
- `linux` - Build para Linux (.AppImage)
- `all` - Todas las plataformas

**Ejemplo**:
```bash
CMD_DEPLOY mac
# Genera build para macOS
```

---

### CMD_MIGRATE
**Propósito**: Migrar datos o versiones
**Sintaxis**: `CMD_MIGRATE [from] [to]`
**Migraciones disponibles**:
- `v1-to-v2` - Migrar de v1 a v2
- `sqlite-to-postgres` - Cambiar BD
- `electron-to-tauri` - Cambiar framework

**Ejemplo**:
```bash
CMD_MIGRATE v1-to-v2
# Migra proyecto de versión 1 a 2
```

---

### CMD_BACKUP
**Propósito**: Crear respaldo del proyecto
**Sintaxis**: `CMD_BACKUP [target]`
**Targets**:
- `database` - Solo base de datos
- `artwork` - Solo carátulas
- `full` - Respaldo completo
- `config` - Solo configuración

**Ejemplo**:
```bash
CMD_BACKUP full
# Crea respaldo completo del proyecto
```

---

### CMD_RESTORE
**Propósito**: Restaurar desde respaldo
**Sintaxis**: `CMD_RESTORE [backup-file]`

**Ejemplo**:
```bash
CMD_RESTORE backup-2025-01-10.zip
# Restaura desde archivo de respaldo
```

---

## 🔧 COMANDOS AVANZADOS

### CMD_PROFILE
**Propósito**: Profiling de rendimiento
**Sintaxis**: `CMD_PROFILE [duration]`
**Genera**:
- CPU profile
- Memory snapshots
- Flame graphs
- Performance timeline

---

### CMD_REFACTOR
**Propósito**: Refactorizar código
**Sintaxis**: `CMD_REFACTOR [pattern]`
**Patterns**:
- `to-typescript` - Convertir a TypeScript
- `to-modules` - Modularizar código
- `to-functional` - Estilo funcional
- `to-classes` - Orientado a objetos

---

### CMD_GENERATE
**Propósito**: Generar código boilerplate
**Sintaxis**: `CMD_GENERATE [template]`
**Templates**:
- `component` - Nuevo componente UI
- `handler` - Nuevo IPC handler
- `service` - Nuevo servicio
- `test` - Nuevo test suite

---

### CMD_VALIDATE
**Propósito**: Validar integridad
**Sintaxis**: `CMD_VALIDATE [target]`
**Validaciones**:
- `database` - Integridad de BD
- `files` - Archivos de audio válidos
- `metadata` - Metadata completa
- `dependencies` - Dependencias OK

---

### CMD_CLEAN
**Propósito**: Limpiar archivos temporales
**Sintaxis**: `CMD_CLEAN [target]`
**Targets**:
- `cache` - Limpiar cache
- `logs` - Limpiar logs
- `temp` - Archivos temporales
- `all` - Todo lo anterior

---

## 🎨 COMANDOS DE UI

### CMD_THEME
**Propósito**: Cambiar tema visual
**Sintaxis**: `CMD_THEME [theme-name]`
**Temas**:
- `dark` - Tema oscuro
- `light` - Tema claro
- `midnight` - Tema midnight
- `sunset` - Tema sunset gradient

---

### CMD_VIEW
**Propósito**: Cambiar vista de UI
**Sintaxis**: `CMD_VIEW [view-type]`
**Vistas**:
- `cards` - Vista de tarjetas
- `table` - Vista de tabla
- `compact` - Vista compacta
- `gallery` - Vista galería

---

## 📊 COMANDOS DE DATOS

### CMD_IMPORT
**Propósito**: Importar datos
**Sintaxis**: `CMD_IMPORT [source] [format]`
**Formatos**:
- `csv` - Archivo CSV
- `json` - Archivo JSON
- `rekordbox` - XML de Rekordbox
- `itunes` - Library de iTunes

---

### CMD_EXPORT
**Propósito**: Exportar datos
**Sintaxis**: `CMD_EXPORT [format] [destination]`
**Formatos**:
- `m3u` - Playlist M3U
- `csv` - Tabla CSV
- `json` - JSON completo
- `rekordbox` - XML para Rekordbox

---

### CMD_SYNC
**Propósito**: Sincronizar con servicios
**Sintaxis**: `CMD_SYNC [service]`
**Servicios**:
- `dropbox` - Sincronizar con Dropbox
- `google-drive` - Google Drive
- `icloud` - iCloud (macOS)
- `local` - Carpeta local

---

## 🚀 COMANDOS DE DESARROLLO

### CMD_DEV
**Propósito**: Modo desarrollo
**Sintaxis**: `CMD_DEV [options]`
**Opciones**:
- `--hot-reload` - Recarga automática
- `--debug` - Modo debug
- `--verbose` - Logs detallados
- `--mock-data` - Usar datos mock

---

### CMD_LINT
**Propósito**: Verificar código
**Sintaxis**: `CMD_LINT [target]`
**Checks**:
- ESLint para JavaScript
- Prettier para formato
- Security audit
- Complexity analysis

---

### CMD_BENCHMARK
**Propósito**: Ejecutar benchmarks
**Sintaxis**: `CMD_BENCHMARK [test]`
**Tests**:
- `search` - Benchmark de búsqueda
- `render` - Benchmark de render
- `database` - Benchmark de BD
- `all` - Todos los benchmarks

---

## 💡 COMANDOS ESPECIALES

### CMD_AI
**Propósito**: Análisis con IA
**Sintaxis**: `CMD_AI [action]`
**Acciones**:
- `analyze-tracks` - Analizar canciones
- `generate-playlists` - Crear playlists
- `find-duplicates` - Buscar duplicados
- `auto-tag` - Auto-tagging

---

### CMD_HELP
**Propósito**: Mostrar ayuda
**Sintaxis**: `CMD_HELP [command]`
**Ejemplo**:
```bash
CMD_HELP optimize
# Muestra ayuda detallada del comando optimize
```

---

## 📝 SINTAXIS Y CONVENCIONES

### Formato General
```
CMD_[ACCIÓN] [objetivo] [opciones]
```

### Modificadores
- `--force` - Forzar ejecución
- `--dry-run` - Simular sin ejecutar
- `--verbose` - Salida detallada
- `--quiet` - Salida mínima
- `--json` - Salida en JSON

### Ejemplos Combinados
```bash
# Análisis completo con salida JSON
CMD_ANALYZE el proyecto --json

# Optimización forzada con verbose
CMD_OPTIMIZE database --force --verbose

# Build profesional con tests
CMD_BUILD virtual-scroll --professional --with-tests

# Deploy dry-run para todas las plataformas
CMD_DEPLOY all --dry-run
```

---

## 🔄 WORKFLOW TÍPICO

```bash
1. CMD_ANALYZE                  # Analizar estado actual
2. CMD_FIX broken-ui            # Reparar problemas
3. CMD_OPTIMIZE performance     # Optimizar rendimiento
4. CMD_BUILD new-feature        # Construir nueva feature
5. CMD_TEST all                 # Ejecutar tests
6. CMD_DOCUMENT technical       # Actualizar documentación
7. CMD_DEPLOY mac              # Preparar para producción
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Orden de ejecución**: Algunos comandos requieren ejecutarse en orden específico
2. **Dependencias**: Verificar que las dependencias estén instaladas antes de optimizar
3. **Respaldos**: Siempre hacer CMD_BACKUP antes de cambios mayores
4. **Modo desarrollo**: Usar CMD_DEV para desarrollo activo
5. **Validación**: Ejecutar CMD_VALIDATE después de cambios importantes

---

## 🆘 TROUBLESHOOTING

### Comando no reconocido
```bash
CMD_HELP [comando]  # Ver ayuda del comando
```

### Error en ejecución
```bash
CMD_FIX [problema]  # Intentar auto-reparación
CMD_ANALYZE        # Diagnosticar problema
```

### Performance degradado
```bash
CMD_CLEAN all      # Limpiar temporales
CMD_OPTIMIZE       # Re-optimizar
CMD_PROFILE 60     # Profiling de 60 segundos
```

---

*Documentación v2.0 - Music Analyzer Pro*
*Para más información: CMD_HELP [comando]*