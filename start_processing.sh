#!/bin/bash
# Script para iniciar el procesamiento completo de la carpeta Tracks

TRACKS_FOLDER="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"

echo "=================================================="
echo "🚀 INICIANDO PROCESAMIENTO COMPLETO"
echo "=================================================="
echo "📂 Carpeta: $TRACKS_FOLDER"
echo ""

# Verificar que la carpeta existe
if [ ! -d "$TRACKS_FOLDER" ]; then
    echo "❌ Error: Carpeta no encontrada"
    exit 1
fi

# Contar archivos
TOTAL_FILES=$(find "$TRACKS_FOLDER" -type f \( -name "*.flac" -o -name "*.m4a" -o -name "*.mp3" \) | wc -l | tr -d ' ')
echo "📊 Total archivos encontrados: $TOTAL_FILES"
echo ""

# Opciones de procesamiento
echo "Selecciona modo de procesamiento:"
echo "  1. Prueba rápida (5 archivos)"
echo "  2. Lote pequeño (20 archivos)"
echo "  3. Lote mediano (50 archivos)"
echo "  4. Lote grande (100 archivos)"
echo "  5. Procesar TODO (${TOTAL_FILES} archivos) - CUIDADO!"
echo "  6. Personalizado"
echo ""

read -p "Opción (1-6): " OPTION

case $OPTION in
    1)
        LIMIT=5
        DELAY=1
        ;;
    2)
        LIMIT=20
        DELAY=1.5
        ;;
    3)
        LIMIT=50
        DELAY=2
        ;;
    4)
        LIMIT=100
        DELAY=2
        ;;
    5)
        LIMIT=$TOTAL_FILES
        DELAY=2
        echo "⚠️  ADVERTENCIA: Procesar todos los archivos tomará mucho tiempo y costará dinero"
        read -p "¿Estás seguro? (s/n): " CONFIRM
        if [ "$CONFIRM" != "s" ]; then
            echo "Cancelado"
            exit 0
        fi
        ;;
    6)
        read -p "Número de archivos a procesar: " LIMIT
        read -p "Delay entre archivos (segundos): " DELAY
        ;;
    *)
        echo "Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "📋 Configuración:"
echo "  • Archivos a procesar: $LIMIT"
echo "  • Delay entre archivos: ${DELAY}s"
echo "  • Costo estimado: \$$(echo "$LIMIT * 0.05" | bc -l | cut -c1-6)"
echo ""

read -p "¿Iniciar procesamiento? (s/n): " START

if [ "$START" != "s" ]; then
    echo "Cancelado"
    exit 0
fi

# Ejecutar pipeline
echo ""
echo "🚀 Iniciando pipeline..."
echo ""

python3 complete_processing_pipeline.py \
    "$TRACKS_FOLDER" \
    --limit $LIMIT \
    --delay $DELAY

echo ""
echo "✅ Procesamiento completado"
echo ""

# Mostrar estadísticas de BD
echo "📊 Estadísticas de la base de datos:"
sqlite3 music_analyzer.db "SELECT 'Total archivos:', COUNT(*) FROM audio_files"
sqlite3 music_analyzer.db "SELECT 'Analizados GPT-4:', COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1"
sqlite3 music_analyzer.db "SELECT 'Con género:', COUNT(*) FROM llm_metadata WHERE LLM_GENRE IS NOT NULL AND LLM_GENRE != 'Desconocido'"