#!/bin/bash

# Script para subir documentación de Music Analyzer Pro a Archon
# Requiere que Archon esté ejecutándose en http://localhost:8181

ARCHON_API="http://localhost:8181/api"
PROJECT_DIR="/Users/freddymolina/Desktop/music-app-clean"

echo "🚀 Subiendo documentación de Music Analyzer Pro a Archon..."

# Función para subir un archivo
upload_file() {
    local file_path="$1"
    local title="$2"
    local description="$3"
    
    echo "📄 Subiendo: $title"
    
    # Crear el payload JSON con el contenido del archivo
    content=$(cat "$file_path" | jq -Rs .)
    
    curl -X POST "$ARCHON_API/knowledge/upload" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"content\": $content,
            \"type\": \"document\",
            \"metadata\": {
                \"project\": \"Music Analyzer Pro\",
                \"description\": \"$description\",
                \"file_path\": \"$file_path\"
            }
        }" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ $title subido correctamente"
    else
        echo "❌ Error subiendo $title"
    fi
}

# Subir documentación principal
echo "📚 Subiendo documentación principal..."

upload_file "$PROJECT_DIR/README.md" \
    "MAP - README Principal" \
    "Documentación principal del Music Analyzer Pro con estado actual y características"

upload_file "$PROJECT_DIR/AUDIO_CONFIG_SYSTEM.md" \
    "MAP - Sistema de Configuración de Audio" \
    "Documentación del sistema de configuración y procesamiento de audio"

upload_file "$PROJECT_DIR/PIPELINE_DOCUMENTATION.md" \
    "MAP - Pipeline de Procesamiento" \
    "Documentación completa del pipeline de análisis de audio"

upload_file "$PROJECT_DIR/UI_DESIGN_DOCUMENTATION.md" \
    "MAP - Diseño de UI" \
    "Documentación del diseño de interfaz y componentes visuales"

upload_file "$PROJECT_DIR/AUDIO_PROCESSING_COMPLETE_REPORT.md" \
    "MAP - Reporte de Procesamiento de Audio" \
    "Reporte completo del sistema de procesamiento de audio"

upload_file "$PROJECT_DIR/ESSENTIA_SETUP_COMPLETE.md" \
    "MAP - Setup de Essentia" \
    "Configuración completa de Essentia para análisis de audio"

# Subir archivos de configuración
echo "⚙️ Subiendo archivos de configuración..."

upload_file "$PROJECT_DIR/package.json" \
    "MAP - Package.json" \
    "Configuración de dependencias y scripts del proyecto"

upload_file "$PROJECT_DIR/audio-config.json" \
    "MAP - Configuración de Audio" \
    "Configuración JSON del sistema de audio"

# Subir archivos principales de código
echo "💻 Subiendo archivos de código principal..."

upload_file "$PROJECT_DIR/main-secure.js" \
    "MAP - Main Secure (Electron)" \
    "Archivo principal de Electron con configuración segura"

upload_file "$PROJECT_DIR/preload.js" \
    "MAP - Preload Script" \
    "Script de preload para el contexto de Electron"

upload_file "$PROJECT_DIR/music-analyzer-complete.js" \
    "MAP - Music Analyzer Complete" \
    "Módulo completo de análisis de música"

upload_file "$PROJECT_DIR/calculate_audio_features.py" \
    "MAP - Cálculo de Features de Audio" \
    "Script Python para calcular características de audio con Essentia"

upload_file "$PROJECT_DIR/music-tools.js" \
    "MAP - Music Tools" \
    "Herramientas y utilidades para procesamiento de música"

# Subir archivos HTML principales
echo "🎨 Subiendo interfaces HTML..."

upload_file "$PROJECT_DIR/index.html" \
    "MAP - Index HTML" \
    "Interfaz principal de la aplicación"

upload_file "$PROJECT_DIR/audio-panel-enhanced.html" \
    "MAP - Panel de Audio Mejorado" \
    "Panel de control de audio con características avanzadas"

# Subir scripts de análisis
echo "🔬 Subiendo scripts de análisis..."

upload_file "$PROJECT_DIR/essentia_full_analyzer.cpp" \
    "MAP - Analizador Completo Essentia" \
    "Código C++ para análisis completo con Essentia"

upload_file "$PROJECT_DIR/openai_processor_ultimate.py" \
    "MAP - Procesador OpenAI" \
    "Script para enriquecimiento de metadata con IA"

echo "
✨ ¡Subida completa!

Próximos pasos:
1. Ve a http://localhost:3737
2. Configura tu API key de OpenAI en Settings
3. Verifica que los documentos se subieron en Knowledge Base
4. Crea un proyecto para Music Analyzer Pro
"