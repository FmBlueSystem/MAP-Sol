#!/bin/bash
# Script para procesar archivos en lotes con guardado en BD

source .venv/bin/activate

TOTAL_TO_PROCESS=3600
PROCESSED=0

echo "🚀 Iniciando procesamiento de $TOTAL_TO_PROCESS archivos..."
echo "📊 Esto tomará aproximadamente $(($TOTAL_TO_PROCESS * 2 / 60)) minutos"

# Obtener archivos no procesados
sqlite3 music_analyzer.db "
SELECT af.file_path 
FROM audio_files af 
WHERE af.id NOT IN (
    SELECT file_id FROM llm_metadata 
    WHERE AI_BPM IS NOT NULL
)
LIMIT $TOTAL_TO_PROCESS
" | while IFS= read -r file; do
    ((PROCESSED++))
    
    # Mostrar progreso cada 10 archivos
    if [ $((PROCESSED % 10)) -eq 0 ]; then
        ANALYZED=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null)
        echo "[$PROCESSED/$TOTAL_TO_PROCESS] Analizados en BD: $ANALYZED"
    fi
    
    # Procesar archivo
    python3 essentia_enhanced_v2.py "$file" --save-db --strategy smart60 2>/dev/null
    
    # Pequeña pausa
    sleep 0.1
done

# Estadísticas finales
FINAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL")
echo ""
echo "✅ Proceso completado!"
echo "📊 Total analizados en BD: $FINAL"
