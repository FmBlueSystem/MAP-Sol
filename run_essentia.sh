#!/bin/bash

# Script para ejecutar el procesamiento con Essentia de forma eficiente

echo "=================================================="
echo "🎵 PROCESAMIENTO MASIVO CON ESSENTIA"
echo "=================================================="
echo ""

# Carpeta de música
TRACKS_FOLDER="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"

# Verificar que la carpeta existe
if [ ! -d "$TRACKS_FOLDER" ]; then
    echo "❌ Error: Carpeta no encontrada: $TRACKS_FOLDER"
    exit 1
fi

# Contar archivos totales
echo "📊 Contando archivos..."
TOTAL_FILES=$(find "$TRACKS_FOLDER" -type f \( -name "*.flac" -o -name "*.m4a" -o -name "*.mp3" \) | wc -l | tr -d ' ')
echo "   Total archivos encontrados: $TOTAL_FILES"

# Contar archivos ya procesados
PROCESSED=0
if [ -d "essentia_results" ]; then
    PROCESSED=$(ls essentia_results/*_essentia.json 2>/dev/null | wc -l | tr -d ' ')
    echo "   Archivos ya procesados: $PROCESSED"
fi

REMAINING=$((TOTAL_FILES - PROCESSED))
echo "   Archivos restantes: $REMAINING"
echo ""

# Opciones de procesamiento
echo "Selecciona opción:"
echo "  1. Procesar TODO (${REMAINING} archivos restantes)"
echo "  2. Procesar en lotes de 100"
echo "  3. Procesar en lotes de 500"
echo "  4. Procesar en lotes de 1000"
echo "  5. Prueba rápida (10 archivos)"
echo "  6. Continuar desde donde quedó"
echo "  7. Reprocesar TODO desde cero"
echo ""

read -p "Opción (1-7): " OPTION

# Activar ambiente virtual
source .venv/bin/activate

case $OPTION in
    1)
        echo ""
        echo "🚀 Procesando TODOS los archivos..."
        python3 essentia_silent_processor.py "$TRACKS_FOLDER"
        ;;
    2)
        echo ""
        BATCH_SIZE=100
        for ((i=0; i<TOTAL_FILES; i+=BATCH_SIZE)); do
            echo "📦 Procesando lote: archivos $i a $((i+BATCH_SIZE))"
            python3 essentia_silent_processor.py "$TRACKS_FOLDER" --start $i --limit $BATCH_SIZE
            echo "⏸️  Pausa de 2 segundos..."
            sleep 2
        done
        ;;
    3)
        echo ""
        BATCH_SIZE=500
        for ((i=0; i<TOTAL_FILES; i+=BATCH_SIZE)); do
            echo "📦 Procesando lote: archivos $i a $((i+BATCH_SIZE))"
            python3 essentia_silent_processor.py "$TRACKS_FOLDER" --start $i --limit $BATCH_SIZE
            echo "⏸️  Pausa de 5 segundos..."
            sleep 5
        done
        ;;
    4)
        echo ""
        BATCH_SIZE=1000
        for ((i=0; i<TOTAL_FILES; i+=BATCH_SIZE)); do
            echo "📦 Procesando lote: archivos $i a $((i+BATCH_SIZE))"
            python3 essentia_silent_processor.py "$TRACKS_FOLDER" --start $i --limit $BATCH_SIZE
            echo "⏸️  Pausa de 10 segundos..."
            sleep 10
        done
        ;;
    5)
        echo ""
        echo "🧪 Ejecutando prueba con 10 archivos..."
        python3 essentia_silent_processor.py "$TRACKS_FOLDER" --limit 10
        ;;
    6)
        echo ""
        echo "📂 Continuando desde archivo #${PROCESSED}..."
        python3 essentia_silent_processor.py "$TRACKS_FOLDER" --start $PROCESSED
        ;;
    7)
        echo ""
        echo "⚠️  ADVERTENCIA: Esto eliminará todos los resultados existentes"
        read -p "¿Estás seguro? (s/n): " CONFIRM
        if [ "$CONFIRM" = "s" ]; then
            echo "🗑️  Eliminando resultados anteriores..."
            rm -rf essentia_results
            mkdir essentia_results
            echo "🚀 Procesando desde cero..."
            python3 essentia_silent_processor.py "$TRACKS_FOLDER"
        else
            echo "Cancelado"
        fi
        ;;
    *)
        echo "Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "=================================================="
echo "✅ PROCESO FINALIZADO"
echo "=================================================="

# Mostrar estadísticas finales
if [ -d "essentia_results" ]; then
    FINAL_COUNT=$(ls essentia_results/*_essentia.json 2>/dev/null | wc -l | tr -d ' ')
    ERROR_COUNT=$(ls essentia_results/*_error.txt 2>/dev/null | wc -l | tr -d ' ')
    
    echo ""
    echo "📊 Estadísticas finales:"
    echo "   • Archivos procesados exitosamente: $FINAL_COUNT"
    echo "   • Archivos con errores: $ERROR_COUNT"
    echo "   • Archivos restantes: $((TOTAL_FILES - FINAL_COUNT))"
    
    # Mostrar último reporte
    LATEST_REPORT=$(ls -t essentia_results/report_*.json 2>/dev/null | head -1)
    if [ -n "$LATEST_REPORT" ]; then
        echo ""
        echo "📝 Último reporte: $LATEST_REPORT"
    fi
fi

echo ""
echo "💡 Próximos pasos:"
echo "   1. Revisar resultados en essentia_results/"
echo "   2. Procesar con GPT-4: python3 batch_processor.py"
echo "   3. Ver estadísticas: python3 query_analysis_data.py"