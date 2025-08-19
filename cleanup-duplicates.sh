#!/bin/bash

echo "🧹 Limpiando archivos duplicados y no funcionales..."
echo "=================================================="

# Crear directorio de respaldo
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Creando respaldo en: $BACKUP_DIR"

# Archivos HTML duplicados (mantenemos solo index-views.html que funciona)
HTML_TO_REMOVE=(
    "index.html"
    "index-complete.html"
    "index-complete-final.html"
    "index-with-search.html"
    "index-secure.html"
    "index-production.html"
    "index-fixed.html"
    "index-views-backup.html"
    "optimize-integration.html"
    "add-views-support.html"
    "audio-panel-enhanced.html"
    "debug-player.html"
    "metadata-viewer.html"
    "metadata-viewer-fixed.html"
    "minimal-player.html"
    "playlist-manager.html"
    "screen-control-widget.html"
    "offline.html"
)

# Archivos de test HTML
TEST_HTML=(
    "test-*.html"
)

# Archivos JS con errores de sintaxis identificados
JS_WITH_ERRORS=(
    "handlers/audio-handler.js"
    "handlers/complete-llm-handler.js"
    "handlers/complete-metadata-handler.js"
    "handlers/enrichment-ai-handler.js"
    "handlers/hybrid-ai-handler.js"
    "handlers/normalized-llm-handler.js"
    "handlers/openai-handler.js"
    "handlers/playlist-advanced-handler.js"
    "handlers/playlist-handler.js"
    "handlers/track-management-handler.js"
    "handlers/export-handler.js.bak"
    "services/auto-artwork-extractor.js"
    "services/database-service-paginated.js"
    "services/dj-exporter.js"
    "services/playlist-database-service.js"
)

# Archivos JS en /js con errores
JS_DIR_ERRORS=(
    "js/ai-analyzer-real.js"
    "js/app-production.js"
    "js/artwork-extractor-ui.js"
    "js/audio-config-manager.js"
    "js/audio-init.js"
    "js/audio-ipc-bridge.js"
    "js/audio-normalization-ui.js"
    "js/audio-processor-integrated.js"
    "js/audio-processor-lite.js"
    "js/audio-processor.js"
    "js/database-optimizer.js"
    "js/energy-flow-visualizer.js"
    "js/enhanced-view-fixed.js"
    "js/enhanced-view-simple.js"
    "js/error-boundary.js"
    "js/error-handler.js"
    "js/favorites-manager.js"
    "js/logger.js"
    "js/media-fix-system.js"
    "js/metadata-card-enhanced.js"
    "js/metadata-editor-complete.js"
    "js/metadata-editor.js"
    "js/metadata-inspector.js"
    "js/modal-manager.js"
    "js/music-analyzer-main.js"
    "js/normalization-processor.js"
    "js/performance-monitor.js"
    "js/performance-optimizer.js"
    "js/playlist-analyzer.js"
    "js/playlist-manager.js"
    "js/playlist-ui.js"
    "js/queue-manager.js"
    "js/search-engine.js"
    "js/shortcuts-manager.js"
    "js/smart-playlist-manager.js"
    "js/theme-manager.js"
    "js/virtual-scroller.js"
    "js/waveform-analyzer.js"
)

# Scripts rotos en raíz
ROOT_SCRIPTS_BROKEN=(
    "safe-analyze.js"
    "setup-archon-project.js"
    "show-database-stats.js"
    "show-file-metadata.js"
    "show-updated-files.js"
    "sw-register.js"
    "test-*.js"
    "update-music-library.js"
    "update-task-status.js"
    "validate-and-fix-artwork.js"
    "validate-player-fix.js"
    "validate-ui-cleanup.js"
    "verify-updates.js"
    "webpack.config.js"
    "write-metadata-to-files.js"
)

# Archivos main.js antiguos
MAIN_FILES=(
    "main-secure.js"
    "main-modular.js"
    "main-original.js"
)

# Mover archivos HTML duplicados
echo ""
echo "📋 Moviendo archivos HTML duplicados..."
for file in "${HTML_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
    fi
done

# Mover archivos de test
echo ""
echo "🧪 Moviendo archivos de test..."
for pattern in "${TEST_HTML[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
        fi
    done
done

# Mover archivos JS con errores
echo ""
echo "❌ Moviendo archivos JS con errores de sintaxis..."
for file in "${JS_WITH_ERRORS[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
    fi
done

for file in "${JS_DIR_ERRORS[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
    fi
done

# Mover scripts rotos en raíz
echo ""
echo "🔧 Moviendo scripts rotos en raíz..."
for pattern in "${ROOT_SCRIPTS_BROKEN[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ]; then
            mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
        fi
    done
done

# Mover archivos main antiguos
echo ""
echo "📦 Moviendo archivos main.js antiguos..."
for file in "${MAIN_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ Movido: $file"
    fi
done

# Contar archivos movidos
MOVED_COUNT=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)

echo ""
echo "=================================================="
echo "✅ Limpieza completada!"
echo "📊 Archivos movidos: $MOVED_COUNT"
echo "💾 Respaldo en: $BACKUP_DIR"
echo ""
echo "ℹ️  Archivos mantenidos:"
echo "  - index-views.html (interfaz principal funcional)"
echo "  - main-minimal.js (archivo principal)"
echo "  - package.json y configuración"
echo "  - Carpetas: handlers/, services/, js/ (archivos funcionales)"
echo ""
echo "⚠️  Si necesitas recuperar algo, está en: $BACKUP_DIR"