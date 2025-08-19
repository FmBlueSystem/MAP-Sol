#!/bin/bash
# Script para procesar todos los archivos restantes con Essentia Enhanced v2

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
DB_PATH="music_analyzer.db"
BATCH_SIZE=100
STRATEGY="smart60"
LOG_DIR="essentia_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="${LOG_DIR}/process_remaining_${TIMESTAMP}.log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

# Activar entorno virtual
source .venv/bin/activate

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   PROCESADOR DE ARCHIVOS RESTANTES - ESSENTIA V2        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Función para obtener estadísticas
get_stats() {
    local total=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
    local analyzed=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
    local remaining=$((total - analyzed))
    echo "${total}|${analyzed}|${remaining}"
}

# Función para mostrar progreso
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    
    printf "\r${CYAN}Progreso Global: ["
    printf "%${filled}s" | tr ' ' '█'
    printf "%$((50 - filled))s" | tr ' ' '░'
    printf "] %d%% (%d/%d)${NC}" "$percent" "$current" "$total"
}

# Obtener estadísticas iniciales
IFS='|' read -r TOTAL ANALYZED REMAINING <<< $(get_stats)

echo -e "${BLUE}📊 Estado Inicial:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED${NC}"
echo -e "  • Por procesar: ${YELLOW}$REMAINING${NC}"
echo ""

if [ $REMAINING -eq 0 ]; then
    echo -e "${GREEN}✅ Todos los archivos ya han sido analizados!${NC}"
    exit 0
fi

# Calcular número de lotes
BATCHES=$((REMAINING / BATCH_SIZE))
if [ $((REMAINING % BATCH_SIZE)) -ne 0 ]; then
    BATCHES=$((BATCHES + 1))
fi

echo -e "${YELLOW}📦 Procesando en $BATCHES lotes de hasta $BATCH_SIZE archivos${NC}"
echo -e "${YELLOW}📝 Log principal: $MAIN_LOG${NC}"
echo ""

# Inicializar log principal
echo "=== PROCESO DE ARCHIVOS RESTANTES ===" > "$MAIN_LOG"
echo "Fecha: $(date)" >> "$MAIN_LOG"
echo "Total a procesar: $REMAINING archivos" >> "$MAIN_LOG"
echo "Tamaño de lote: $BATCH_SIZE" >> "$MAIN_LOG"
echo "Estrategia: $STRATEGY" >> "$MAIN_LOG"
echo "===================================" >> "$MAIN_LOG"
echo "" >> "$MAIN_LOG"

# Variables para tracking
PROCESSED_TOTAL=0
ERRORS_TOTAL=0
START_TIME=$(date +%s)

# Función para procesar un lote
process_batch() {
    local batch_num=$1
    local batch_size=$2
    
    echo -e "\n${BLUE}═══ Lote $batch_num de $BATCHES ═══${NC}"
    
    # Obtener archivos no analizados
    UNPROCESSED_FILES=$(sqlite3 "$DB_PATH" "
        SELECT af.file_path 
        FROM audio_files af 
        WHERE af.id NOT IN (
            SELECT file_id FROM llm_metadata 
            WHERE AI_BPM IS NOT NULL AND AI_BPM > 0
        )
        LIMIT $batch_size
    " 2>/dev/null)
    
    if [ -z "$UNPROCESSED_FILES" ]; then
        echo -e "${YELLOW}No hay más archivos para procesar${NC}"
        return 1
    fi
    
    # Contador local del lote
    local count=0
    local batch_errors=0
    
    # Procesar cada archivo
    while IFS= read -r file_path; do
        if [ -z "$file_path" ]; then
            continue
        fi
        
        ((count++))
        ((PROCESSED_TOTAL++))
        
        # Mostrar progreso del lote
        echo -ne "${CYAN}  [$count/$batch_size]${NC} $(basename "$file_path")... "
        
        # Ejecutar análisis
        if python3 essentia_enhanced_v2.py "$file_path" \
            --strategy "$STRATEGY" \
            --save-db \
            --db "$DB_PATH" >> "$MAIN_LOG" 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
            ((batch_errors++))
            ((ERRORS_TOTAL++))
            echo "ERROR: $file_path" >> "$MAIN_LOG"
        fi
        
        # Actualizar progreso global cada 10 archivos
        if [ $((PROCESSED_TOTAL % 10)) -eq 0 ]; then
            show_progress $PROCESSED_TOTAL $REMAINING
        fi
        
        # Pequeña pausa para no saturar
        sleep 0.1
        
    done <<< "$UNPROCESSED_FILES"
    
    # Resumen del lote
    echo ""
    echo -e "${GREEN}  Lote $batch_num completado: $count archivos (${RED}$batch_errors errores${GREEN})${NC}"
    
    # Guardar checkpoint
    echo "Lote $batch_num: $count procesados, $batch_errors errores" >> "$MAIN_LOG"
    
    return 0
}

# Procesar todos los lotes
echo -e "${GREEN}▶ Iniciando procesamiento...${NC}\n"

for ((i=1; i<=BATCHES; i++)); do
    # Verificar espacio en disco
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 95 ]; then
        echo -e "${RED}⚠️ Espacio en disco crítico (${DISK_USAGE}%). Abortando.${NC}"
        break
    fi
    
    # Procesar lote
    if ! process_batch $i $BATCH_SIZE; then
        echo -e "${YELLOW}Todos los archivos han sido procesados${NC}"
        break
    fi
    
    # Pausa entre lotes (excepto el último)
    if [ $i -lt $BATCHES ]; then
        echo -e "${CYAN}  Pausa de 2 segundos antes del siguiente lote...${NC}"
        sleep 2
    fi
    
    # Mostrar tiempo estimado restante
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    if [ $PROCESSED_TOTAL -gt 0 ]; then
        RATE=$((ELAPSED / PROCESSED_TOTAL))
        ESTIMATED_REMAINING=$((RATE * (REMAINING - PROCESSED_TOTAL)))
        
        if [ $ESTIMATED_REMAINING -gt 0 ]; then
            HOURS=$((ESTIMATED_REMAINING / 3600))
            MINUTES=$(((ESTIMATED_REMAINING % 3600) / 60))
            echo -e "${CYAN}  Tiempo estimado restante: ${HOURS}h ${MINUTES}m${NC}"
        fi
    fi
done

echo ""
echo ""

# Obtener estadísticas finales
IFS='|' read -r TOTAL_FINAL ANALYZED_FINAL REMAINING_FINAL <<< $(get_stats)

# Calcular tiempo total
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
HOURS=$((TOTAL_TIME / 3600))
MINUTES=$(((TOTAL_TIME % 3600) / 60))
SECONDS=$((TOTAL_TIME % 60))

# Mostrar resumen final
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  PROCESO COMPLETADO                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 Estadísticas Finales:${NC}"
echo -e "  • Archivos procesados: ${GREEN}$PROCESSED_TOTAL${NC}"
echo -e "  • Errores: ${RED}$ERRORS_TOTAL${NC}"
if [ $PROCESSED_TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(( (PROCESSED_TOTAL - ERRORS_TOTAL) * 100 / PROCESSED_TOTAL ))
    echo -e "  • Tasa de éxito: ${GREEN}${SUCCESS_RATE}%${NC}"
else
    echo -e "  • Tasa de éxito: ${YELLOW}N/A${NC}"
fi
echo ""
echo -e "${BLUE}📊 Base de Datos:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL_FINAL${NC}"
echo -e "  • Analizados: ${GREEN}$ANALYZED_FINAL${NC}"
echo -e "  • Restantes: ${YELLOW}$REMAINING_FINAL${NC}"
echo ""
echo -e "${CYAN}⏱️ Tiempo total: ${HOURS}h ${MINUTES}m ${SECONDS}s${NC}"
echo -e "${CYAN}📄 Log completo: $MAIN_LOG${NC}"

# Guardar resumen en log
echo "" >> "$MAIN_LOG"
echo "=== RESUMEN FINAL ===" >> "$MAIN_LOG"
echo "Procesados: $PROCESSED_TOTAL" >> "$MAIN_LOG"
echo "Errores: $ERRORS_TOTAL" >> "$MAIN_LOG"
echo "Tiempo total: ${HOURS}h ${MINUTES}m ${SECONDS}s" >> "$MAIN_LOG"
echo "Finalizado: $(date)" >> "$MAIN_LOG"

# Crear resumen JSON
cat << EOF > "${LOG_DIR}/summary_${TIMESTAMP}.json"
{
  "timestamp": "$(date -Iseconds)",
  "processed": $PROCESSED_TOTAL,
  "errors": $ERRORS_TOTAL,
  "success_rate": $([ $PROCESSED_TOTAL -gt 0 ] && echo $(( (PROCESSED_TOTAL - ERRORS_TOTAL) * 100 / PROCESSED_TOTAL )) || echo 0),
  "total_time_seconds": $TOTAL_TIME,
  "batch_size": $BATCH_SIZE,
  "strategy": "$STRATEGY",
  "final_stats": {
    "total_files": $TOTAL_FINAL,
    "analyzed": $ANALYZED_FINAL,
    "remaining": $REMAINING_FINAL
  }
}
EOF

echo ""
echo -e "${GREEN}✅ Resumen JSON guardado: ${LOG_DIR}/summary_${TIMESTAMP}.json${NC}"

# Notificación sonora (si está disponible)
if command -v afplay &> /dev/null; then
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null
fi

exit 0