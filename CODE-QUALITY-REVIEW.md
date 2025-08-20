# 📊 Code Quality Review Template - Music Analyzer Pro (MAP)

**Proyecto**: Music Analyzer Pro v2.0.0
**Fecha**: ${DATE}
**Revisado por**: ${REVIEWER}
**Branch/Commit**: ${BRANCH_OR_COMMIT}

## 🎯 Evaluación General

| Categoría         | Estado       | Score (1-10) | Notas |
| ----------------- | ------------ | ------------ | ----- |
| **Funcionalidad** | ⚠️ / ✅ / ❌ | \_/10        |       |
| **Performance**   | ⚠️ / ✅ / ❌ | \_/10        |       |
| **Seguridad**     | ⚠️ / ✅ / ❌ | \_/10        |       |
| **Código Limpio** | ⚠️ / ✅ / ❌ | \_/10        |       |
| **Testing**       | ⚠️ / ✅ / ❌ | \_/10        |       |
| **Documentación** | ⚠️ / ✅ / ❌ | \_/10        |       |

**Score Total**: \_/60

## 🔍 Checklist de Calidad

### 1. Arquitectura Electron

- [ ] **Main Process (main-secure.js)**
    - [ ] IPC handlers registrados correctamente
    - [ ] Sin memory leaks en event listeners
    - [ ] Validación de inputs en todos los handlers
    - [ ] Manejo de errores apropiado
    - [ ] Sin exposición de APIs inseguras

- [ ] **Renderer Process**
    - [ ] Context isolation habilitado
    - [ ] No hay nodeIntegration directa
    - [ ] Preload script seguro
    - [ ] CSP headers configurados

- [ ] **Base de Datos (SQLite)**
    - [ ] Queries parametrizadas (sin SQL injection)
    - [ ] Índices creados para queries frecuentes
    - [ ] Transacciones para operaciones múltiples
    - [ ] Backup strategy implementada

### 2. Audio Processing

- [ ] **Reproducción (Howler.js)**
    - [ ] AudioContext manejado correctamente
    - [ ] Cleanup de recursos audio
    - [ ] Formatos soportados: MP3, FLAC, M4A, WAV
    - [ ] Control de volumen funcional
    - [ ] Sin saturación (K-Meter deshabilitado)

- [ ] **Análisis (Essentia/Python)**
    - [ ] Pipeline funcional
    - [ ] Manejo de errores en análisis
    - [ ] Campos AI/LLM populados
    - [ ] Extracción de features correcta

### 3. Performance

- [ ] **Memoria**
    - [ ] No hay memory leaks detectados
    - [ ] Event listeners removidos apropiadamente
    - [ ] DOM cleanup en componentes dinámicos
    - [ ] Límite de elementos DOM (< 1000 simultáneos)

- [ ] **Carga de Datos**
    - [ ] Virtual scrolling implementado (6000+ tracks)
    - [ ] Lazy loading de imágenes
    - [ ] Pagination o infinite scroll
    - [ ] Debouncing en búsquedas

- [ ] **Optimización**
    - [ ] Bundle size < 5MB
    - [ ] First paint < 2s
    - [ ] Time to interactive < 3s
    - [ ] Lighthouse score > 80

### 4. Código JavaScript/TypeScript

- [ ] **Estilo y Convenciones**
    - [ ] ESLint sin errores
    - [ ] Prettier aplicado
    - [ ] Naming conventions consistentes
    - [ ] No hay console.log en producción

- [ ] **Manejo de Errores**

    ```javascript
    // ❌ MALO
    try {
        result = operation();
    } catch (e) {
        // Silencioso
    }

    // ✅ BUENO
    try {
        result = operation();
    } catch (error) {
        console.error('Operation failed:', error);
        showUserError(`Failed: ${error.message}`);
    }
    ```

- [ ] **Async/Await**
    - [ ] Promises manejadas correctamente
    - [ ] No hay callbacks anidados (callback hell)
    - [ ] Error handling en async functions

### 5. UI/UX

- [ ] **Interfaz**
    - [ ] Responsive design
    - [ ] Feedback visual en acciones
    - [ ] Loading states implementados
    - [ ] Error messages claros
    - [ ] Animaciones smooth (60fps)

- [ ] **Metadata Inspector (143 campos)**
    - [ ] Modal funcional
    - [ ] Búsqueda en tiempo real
    - [ ] Categorización de campos
    - [ ] Edición inline
    - [ ] Export multi-formato

### 6. Seguridad

- [ ] **Validación**
    - [ ] Input sanitization
    - [ ] Path traversal prevention
    - [ ] XSS prevention
    - [ ] CSRF protection

- [ ] **Credenciales**
    - [ ] No API keys en código
    - [ ] .env.example actualizado
    - [ ] Secrets en variables de entorno

### 7. Testing

- [ ] **Coverage**
    - [ ] Unit tests > 60%
    - [ ] Integration tests para flujos críticos
    - [ ] E2E tests para user journeys

- [ ] **Casos de Prueba**
    - [ ] Player functionality
    - [ ] Database operations
    - [ ] File handling
    - [ ] Error scenarios

### 8. Documentación

- [ ] **Código**
    - [ ] JSDoc en funciones complejas
    - [ ] README.md actualizado
    - [ ] CHANGELOG.md mantenido
    - [ ] API documentation

- [ ] **Usuario**
    - [ ] Guía de instalación
    - [ ] Manual de usuario
    - [ ] Troubleshooting guide
    - [ ] FAQ actualizado

## 🔴 Issues Críticos (Must Fix)

| #   | Archivo | Línea | Descripción | Prioridad | Asignado |
| --- | ------- | ----- | ----------- | --------- | -------- |
| 1   |         |       |             | 🔴 Alta   |          |
| 2   |         |       |             | 🔴 Alta   |          |

## 🟡 Issues Importantes (Should Fix)

| #   | Archivo | Línea | Descripción | Prioridad | Asignado |
| --- | ------- | ----- | ----------- | --------- | -------- |
| 1   |         |       |             | 🟡 Media  |          |
| 2   |         |       |             | 🟡 Media  |          |

## 🟢 Sugerencias (Nice to Have)

| #   | Archivo | Línea | Descripción | Prioridad | Asignado |
| --- | ------- | ----- | ----------- | --------- | -------- |
| 1   |         |       |             | 🟢 Baja   |          |
| 2   |         |       |             | 🟢 Baja   |          |

## ✅ Lo que Funciona Bien

- [ ] Feature 1: Descripción
- [ ] Feature 2: Descripción
- [ ] Feature 3: Descripción

## 📈 Métricas de Calidad

```bash
# Análisis de código
npm run lint
npm run typecheck

# Complejidad ciclomática
npx complexity-report-html src/

# Bundle size
npm run build:analyze

# Test coverage
npm run test:coverage

# Performance
lighthouse http://localhost:3737 --view

# Seguridad
npm audit
```

## 📊 Comparación con Versión Anterior

| Métrica           | v1.0.0 | v2.0.0 | Cambio |
| ----------------- | ------ | ------ | ------ |
| Bundle Size       | - MB   | - MB   | ↑↓     |
| Load Time         | - s    | - s    | ↑↓     |
| Test Coverage     | -%     | -%     | ↑↓     |
| Bugs Conocidos    | -      | -      | ↑↓     |
| Performance Score | -      | -      | ↑↓     |

## 🚀 Recomendaciones de Mejora

### Inmediatas (Sprint Actual)

1.
2.
3.

### Corto Plazo (Próximo Sprint)

1.
2.
3.

### Largo Plazo (Backlog)

1.
2.
3.

## 📝 Notas Adicionales

```markdown
[Cualquier observación adicional, contexto importante, o decisiones técnicas tomadas]
```

## ✔️ Sign-off

- [ ] **Desarrollo**: Código completo y probado
- [ ] **QA**: Tests pasados y casos de uso verificados
- [ ] **Product Owner**: Funcionalidad aprobada
- [ ] **DevOps**: Listo para deployment

---

## 🛠️ Comandos Útiles para Review

```bash
# Ver cambios recientes
git log --oneline -10
git diff main...HEAD

# Verificar calidad
npm run lint
npm run test
npm run build

# Buscar problemas comunes
grep -r "console.log" src/
grep -r "TODO" src/
grep -r "FIXME" src/

# Verificar dependencias
npm outdated
npm audit

# Análisis de complejidad
npx madge --circular src/
npx madge --image graph.svg src/

# Database check
sqlite3 music_analyzer.db "PRAGMA integrity_check;"
sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files;"

# Memory profiling
node --inspect main-secure.js
# Luego abrir chrome://inspect
```

## 📋 Checklist Pre-Release

- [ ] Todos los tests pasan
- [ ] No hay errores de lint
- [ ] Build de producción exitoso
- [ ] Performance metrics aceptables
- [ ] Documentación actualizada
- [ ] Changelog actualizado
- [ ] Version bumped en package.json
- [ ] Tag de Git creado
- [ ] Backup de base de datos

---

**Última actualización**: ${DATE}
**Próxima revisión programada**: ${NEXT_REVIEW_DATE}
