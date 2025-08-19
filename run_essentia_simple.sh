#!/bin/bash

# Script simple para procesar con Essentia

echo "🎵 PROCESAMIENTO CON ESSENTIA"
echo "============================"

# Activar ambiente virtual
source .venv/bin/activate

# Ejecutar procesamiento completo
python3 process_all_essentia.py "/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"

echo ""
echo "✅ Procesamiento completado"
echo ""

# Contar resultados
if [ -d "essentia_results" ]; then
    PROCESSED=$(ls essentia_results/*_essentia.json 2>/dev/null | wc -l | tr -d ' ')
    echo "📊 Total archivos procesados: $PROCESSED"
fi