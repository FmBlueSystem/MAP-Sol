#!/bin/bash
# Script para procesar archivos con el analizador calibrado

source .venv/bin/activate

echo "╔══════════════════════════════════════════════╗"
echo "║   ANÁLISIS CALIBRADO - BATCH                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

MUSIC_DIR="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks"
PROCESSED=0
MAX_FILES=${1:-10}

for file in "$MUSIC_DIR"/*.flac; do
    [ -f "$file" ] || continue
    
    if [ $PROCESSED -ge $MAX_FILES ]; then
        break
    fi
    
    echo "[$((PROCESSED+1))/$MAX_FILES] $(basename "$file")"
    python3 essentia_calibrated.py "$file" --save-db
    
    ((PROCESSED++))
    sleep 1
done

echo ""
echo "✅ Procesados: $PROCESSED archivos"