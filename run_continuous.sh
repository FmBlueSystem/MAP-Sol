#!/bin/bash

# SCRIPT DE PROCESAMIENTO CONTINUO CON AUTO-REINICIO
# Mantiene el análisis Essentia corriendo hasta completar todos los archivos

echo "╔══════════════════════════════════════════════╗"
echo "║   PROCESAMIENTO CONTINUO ESSENTIA           ║"
echo "║   Con reinicio automático en caso de falla  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Configuración
BATCH_SIZE=200
MAX_RETRIES=1000
SLEEP_TIME=10
LOG_FILE="continuous_process.log"

# Función para obtener archivos pendientes
get_pending() {
    sqlite3 music_analyzer.db "SELECT COUNT(DISTINCT af.id) FROM audio_files af LEFT JOIN llm_metadata lm ON af.id = lm.file_id WHERE af.file_path IS NOT NULL AND (lm.AI_LOUDNESS IS NULL OR lm.AI_CONFIDENCE < 0.5)" 2>/dev/null
}

# Función para obtener estadísticas
get_stats() {
    sqlite3 music_analyzer.db "SELECT COUNT(DISTINCT af.id) as total, COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed FROM audio_files af LEFT JOIN llm_metadata lm ON af.id = lm.file_id" 2>/dev/null
}

# Loop principal
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    PENDING=$(get_pending)
    
    if [ -z "$PENDING" ] || [ "$PENDING" -eq 0 ]; then
        echo "✅ Todos los archivos han sido procesados!"
        break
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 $(date '+%Y-%m-%d %H:%M:%S')"
    echo "📁 Archivos pendientes: $PENDING"
    echo "🔄 Intento: $((RETRY_COUNT + 1))/$MAX_RETRIES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Ejecutar batch
    echo "🚀 Procesando batch de $BATCH_SIZE archivos..."
    python3 essentia_smart60.py --batch $BATCH_SIZE 2>&1 | tee -a $LOG_FILE
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Batch completado exitosamente"
        RETRY_COUNT=0  # Reset counter on success
    else
        echo "⚠️ Batch falló con código $EXIT_CODE"
        ((RETRY_COUNT++))
        echo "⏳ Esperando $SLEEP_TIME segundos antes de reintentar..."
        sleep $SLEEP_TIME
    fi
    
    # Mostrar progreso
    STATS=$(get_stats)
    echo "📈 Progreso actual: $STATS"
    
    # Pequeña pausa entre batches exitosos
    sleep 5
done

# Resumen final
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            PROCESAMIENTO FINALIZADO          ║"
echo "╚══════════════════════════════════════════════╝"
FINAL_STATS=$(get_stats)
echo "📊 Estadísticas finales: $FINAL_STATS"
echo "📝 Log guardado en: $LOG_FILE"
echo "🕐 Finalizado: $(date '+%Y-%m-%d %H:%M:%S')"