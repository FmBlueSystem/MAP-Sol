# 🤖 CLAUDE CLI PROMPTS - Guía de Ejecución

> Prompts específicos para ejecutar cada tarea con Claude CLI
> Última actualización: 2025-08-14

---

## 📋 CÓMO USAR ESTE DOCUMENTO

Cada sección contiene prompts exactos que puedes copiar y pegar en Claude CLI para ejecutar tareas específicas. Los prompts están diseñados para ser claros, concisos y producir resultados consistentes.

---

## 🧪 FASE 1: VALIDACIÓN Y TESTING

### 1.1 Performance Testing Completo

```bash
claude "Ejecuta un test de performance completo del proyecto music-app-clean.
Necesito:
1. Medir tiempo de carga con los 3,767 archivos
2. Analizar memory usage durante operaciones normales
3. Verificar FPS durante scroll en las 3 vistas (cards, list, compact)
4. Medir cache effectiveness con 10 búsquedas consecutivas
5. Generar reporte con métricas antes/después de optimización
Usa performance.now() y performance.memory para las mediciones"
```

### 1.2 Stress Testing

```bash
claude "Implementa stress testing para music-app-clean:
1. Crea tests/stress-test.js con:
   - 100 búsquedas rápidas consecutivas (50ms entre cada una)
   - 50 cambios de vista rápidos
   - Detección de memory leaks
2. Ejecuta los tests y documenta:
   - Puntos de quiebre
   - Memory leaks detectados
   - Performance degradation
3. Genera reporte con recomendaciones"
```

### 1.3 Benchmark Suite

```bash
claude "CMD_BUILD benchmark-suite para music-app-clean con:
1. Benchmark de carga inicial
2. Benchmark de búsqueda (5 queries diferentes)
3. Benchmark de scroll (1000 items)
4. Benchmark de cambio de vistas
5. Benchmark de operaciones de contexto menu
Exporta resultados en JSON y genera gráficos de comparación"
```

---

## 🚀 FASE 2: VIRTUAL SCROLLING

### 2.1 Implementar Virtual Scroller

```bash
claude "CMD_BUILD virtual-scroll-system para music-app-clean:
1. Crea js/virtual-scroller.js con:
   - Soporte para items de altura variable
   - Buffer de 5-10 items arriba/abajo
   - Smooth scrolling
   - Preservación de posición al filtrar
2. Integra en displayFiles() para >100 items
3. Maneja las 3 vistas: cards (280px), list (50px), compact (40px)
4. Agrega indicador de posición (ej: 'Mostrando 50-100 de 3767')
5. Performance target: <20ms render time"
```

### 2.2 Optimizar Renderizado

```bash
claude "Optimiza el renderizado en index-with-search.html:
1. Implementa requestIdleCallback para renders no críticos
2. Usa DocumentFragment para batch DOM updates
3. Agrega will-change CSS para elementos que se animan
4. Implementa content-visibility: auto para cards fuera de viewport
5. Mide y reporta mejoras de performance"
```

---

## 🔧 FASE 3: BUILD PROCESS

### 3.1 Configurar Webpack

```bash
claude "Configura Webpack para music-app-clean:
1. Crea webpack.config.js con:
   - Mode production con minificación
   - Code splitting para vendor/main/common
   - Tree shaking habilitado
   - Compression plugin (gzip)
   - Source maps para debugging
2. Configura npm scripts:
   - npm run build (production)
   - npm run dev (development con HMR)
   - npm run analyze (bundle analyzer)
3. Target: reducir bundle size en >60%"
```

### 3.2 Implementar Code Splitting

```bash
claude "Implementa code splitting dinámico:
1. Separa módulos pesados:
   - audio-analyzer → lazy load on demand
   - visualization → lazy load on demand
   - export-functions → lazy load on demand
2. Usa dynamic imports con webpack magic comments
3. Agrega loading indicators durante carga de chunks
4. Implementa prefetch para módulos probables
5. Documenta ahorro en initial bundle size"
```

---

## 🌐 FASE 4: PWA & SERVICE WORKER

### 4.1 Service Worker Completo

```bash
claude "CMD_BUILD complete-service-worker para music-app-clean:
1. Crea service-worker.js con:
   - Cache-first strategy para assets
   - Network-first para API calls
   - Background sync para acciones offline
   - Push notifications support
2. Implementa offline.html fallback
3. Cache de artwork-cache/ completo
4. Manejo de updates con skipWaiting
5. Test offline functionality completa"
```

### 4.2 PWA Manifest

```bash
claude "Configura PWA completa:
1. Crea manifest.json con:
   - Icons en múltiples tamaños (192, 512)
   - Theme colors matching app
   - Shortcuts para search y playlists
   - Display: standalone
2. Agrega meta tags para iOS
3. Implementa install prompt
4. Agrega splash screens
5. Test en Lighthouse (target: >90 PWA score)"
```

---

## 📘 FASE 5: TYPESCRIPT MIGRATION

### 5.1 Setup TypeScript

```bash
claude "Migra music-app-clean a TypeScript:
1. Instala TypeScript y tipos necesarios
2. Crea tsconfig.json con strict mode
3. Convierte archivos principales:
   - main.js → main.ts
   - Todos los js en js/ → .ts
4. Agrega interfaces para:
   - AudioFile, LLMMetadata, SearchParams
   - IPC channels types
   - Event handlers
5. Mantén compatibilidad con código existente"
```

### 5.2 Type Definitions Completas

```bash
claude "Crea type definitions exhaustivas:
1. types/models.d.ts - Modelos de datos
2. types/ipc.d.ts - IPC channels y payloads
3. types/ui.d.ts - UI state y events
4. types/global.d.ts - Window extensions
5. Agrega JSDoc comments para IntelliSense
6. Configura strict null checks
7. Genera declaration files"
```

---

## 🎨 FASE 6: UI/UX REFINEMENTS

### 6.1 Sistema de Animaciones

```bash
claude "CMD_BUILD animation-system para music-app-clean:
1. Crea css/animations.css con:
   - Entrada staggered para cards
   - Transiciones suaves entre vistas
   - Micro-interactions en botones
   - Loading skeletons
   - Success/error animations
2. Usa CSS variables para timing
3. Respeta prefers-reduced-motion
4. Performance: mantén 60 FPS"
```

### 6.2 Dark Mode Completo

```bash
claude "Implementa dark mode profesional:
1. CSS variables para todos los colores
2. Toggle con transición suave
3. Persistencia en localStorage
4. Auto-detect system preference
5. Ajusta imágenes y gráficos
6. Test contraste WCAG AA
7. Agrega tooltip explicativo"
```

---

## 📊 FASE 7: MONITORING & ANALYTICS

### 7.1 Performance Monitoring

```bash
claude "CMD_BUILD performance-monitoring para music-app-clean:
1. Implementa Web Vitals tracking:
   - LCP, FID, CLS, TTFB, FCP
2. Custom metrics:
   - Search response time
   - Image load time
   - Time to interactive
3. Crea dashboard visual en-app
4. Exporta métricas a JSON/CSV
5. Alertas para degradación >20%"
```

### 7.2 Error Tracking System

```bash
claude "Implementa error tracking completo:
1. Global error handler con context
2. Captura de promise rejections
3. Stack trace formatting
4. User action recording
5. Agrupación de errores similares
6. Reporte automático (configurable)
7. UI para ver errores en desarrollo
8. Rate limiting para evitar spam"
```

---

## 🔄 COMANDOS DE UTILIDAD

### Análisis de Estado Actual

```bash
claude "CMD_ANALYZE music-app-clean con foco en:
1. Performance bottlenecks actuales
2. Memory leaks potenciales
3. Código no utilizado (dead code)
4. Dependencias desactualizadas
5. Oportunidades de optimización
Genera reporte detallado con prioridades"
```

### Optimización Automática

```bash
claude "CMD_OPTIMIZE music-app-clean:
1. Aplica todas las optimizaciones pendientes
2. Minifica CSS/JS inline
3. Optimiza imágenes en artwork-cache/
4. Elimina console.logs en producción
5. Agrega lazy loading donde falte
6. Documenta cambios realizados"
```

### Testing Completo

```bash
claude "CMD_TEST all para music-app-clean:
1. Unit tests para funciones core
2. Integration tests para IPC
3. E2E tests para flujos principales
4. Performance tests
5. Accessibility tests
6. Genera coverage report (target >80%)"
```

### Build de Producción

```bash
claude "CMD_DEPLOY mac para music-app-clean:
1. Optimiza todo el código
2. Genera build de Electron
3. Firma la aplicación (si hay certificados)
4. Crea DMG installer
5. Genera release notes
6. Prepara assets para distribución"
```

---

## 📝 PROMPTS PARA DOCUMENTACIÓN

### Generar Documentación Técnica

```bash
claude "CMD_DOCUMENT technical para music-app-clean:
1. API documentation (JSDoc)
2. Architecture diagram
3. Data flow diagrams
4. Component hierarchy
5. Database schema
6. IPC channels reference
Formato: Markdown con diagramas Mermaid"
```

### Manual de Usuario

```bash
claude "CMD_DOCUMENT user-manual para music-app-clean:
1. Getting started guide
2. Features overview con screenshots
3. Keyboard shortcuts reference
4. Troubleshooting común
5. FAQ section
6. Video tutorials scripts
Formato: Markdown, tono amigable"
```

---

## 🎯 PROMPTS PARA FEATURES ESPECÍFICAS

### Sistema HAMMS de Similitud

```bash
claude "CMD_BUILD hamms-similarity-system:
1. Implementa algoritmo HAMMS de 7 dimensiones
2. Pre-calcula vectores para todos los tracks
3. Encuentra 20 canciones más similares
4. Cache de resultados
5. UI con % de similitud
6. Performance: <100ms para 10k tracks"
```

### Visualización BPM vs Energy

```bash
claude "CMD_BUILD bpm-energy-heatmap:
1. Canvas 2D con heatmap
2. Puntos para cada track
3. Clustering para >1000 puntos
4. Interactividad (click para filtrar)
5. Zoom/pan con mouse
6. Export como imagen
7. Responsive design"
```

### Export a Formatos DJ

```bash
claude "CMD_BUILD dj-export-system:
1. Export a Rekordbox XML
2. Export a Traktor NML
3. Export a Serato crates
4. Export a M3U8 estándar
5. Preserva toda la metadata
6. Maneja paths relativos/absolutos
7. UI con preview antes de export"
```

---

## ⚡ PROMPTS PARA SOLUCIÓN RÁPIDA

### Fix Performance Issues

```bash
claude "CMD_FIX performance-issues en music-app-clean:
Identifica y soluciona problemas de performance.
Prioridad: scroll lag, memory leaks, slow search"
```

### Fix UI Bugs

```bash
claude "CMD_FIX ui-bugs en music-app-clean:
Encuentra y repara bugs visuales.
Prioridad: layout shifts, broken animations, responsive issues"
```

### Fix Database Issues

```bash
claude "CMD_FIX database-issues:
Repara problemas de base de datos.
Incluye: índices faltantes, queries lentas, data corruption"
```

---

## 🔐 PROMPTS DE VALIDACIÓN

### Validar Optimizaciones

```bash
claude "CMD_VALIDATE optimizations en music-app-clean:
1. Verifica que todas las optimizaciones funcionen
2. Mide mejoras reales vs esperadas
3. Busca regresiones
4. Valida en diferentes scenarios
5. Genera reporte de validación"
```

### Validar Compatibilidad

```bash
claude "CMD_VALIDATE compatibility:
1. Test en Electron versions
2. Test en diferentes OS (Mac, Windows, Linux)
3. Test con diferentes tamaños de DB
4. Test offline functionality
5. Documenta issues encontrados"
```

---

## 📚 MEJORES PRÁCTICAS PARA PROMPTS

### Estructura Recomendada

```
claude "[COMANDO] [objetivo] para [proyecto]:
1. [Acción específica 1]
2. [Acción específica 2]
3. [Requisitos técnicos]
4. [Criterios de éxito]
5. [Formato de salida]
[Contexto adicional si necesario]"
```

### Tips para Mejores Resultados

1. **Sé específico**: Incluye números, métricas, archivos exactos
2. **Define el éxito**: Indica qué resultado esperas
3. **Provee contexto**: Menciona archivos relacionados
4. **Solicita documentación**: Pide que documente cambios
5. **Especifica formato**: JSON, Markdown, código, etc.

### Ejemplo de Prompt Perfecto

```bash
claude "CMD_BUILD virtual-scroll para music-app-clean en index-with-search.html:
1. Implementa virtual scrolling para la vista de cards
2. Maneja 10,000+ items sin lag
3. Mantén 60 FPS durante scroll
4. Buffer de 10 items arriba/abajo del viewport
5. Indicador de posición: 'Mostrando X-Y de Z'
6. Integra con el sistema de búsqueda existente
7. Preserva la selección al scrollear
Performance target: <20ms render, <150MB memory
Documenta con comentarios inline y actualiza CLAUDE.md"
```

---

## 🚨 PROMPTS DE EMERGENCIA

### Rollback Urgente

```bash
claude "URGENTE: Rollback últimos cambios en music-app-clean.
La aplicación no arranca. Restaura al último estado funcional conocido."
```

### Fix Crítico

```bash
claude "CRÍTICO: La base de datos está corrupta en music-app-clean.
Repara o reconstruye music_analyzer.db manteniendo los datos posibles."
```

### Recovery

```bash
claude "RECOVERY: Recupera music-app-clean desde backup.
Usa los archivos en backup/ y restaura funcionalidad completa."
```

---

_Documento de Prompts v1.0_
_Última actualización: 2025-08-14_
_Total de prompts: 40+_
