#!/bin/bash
# Script mejorado para procesar todos los archivos restantes

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuración
DB_PATH="music_analyzer.db"
BATCH_SIZE=50
STRATEGY="smart60"
LOG_DIR="essentia_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="${LOG_DIR}/process_all_${TIMESTAMP}.log"
MUSIC_DIR="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"

# Crear directorio de logs
mkdir -p "$LOG_DIR"

# Activar entorno virtual
source .venv/bin/activate

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   PROCESADOR BATCH DE ARCHIVOS - ESSENTIA V2            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Obtener estadísticas iniciales
TOTAL_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
REMAINING_FILES=$((TOTAL_FILES - ANALYZED_FILES))

echo -e "${BLUE}📊 Estado Inicial:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL_FILES${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED_FILES${NC}"
echo -e "  • Por procesar: ${YELLOW}$REMAINING_FILES${NC}"
echo ""

if [ $REMAINING_FILES -eq 0 ]; then
    echo -e "${GREEN}✅ Todos los archivos ya están analizados!${NC}"
    exit 0
fi

# Preguntar confirmación
echo -e "${YELLOW}⚠️  Se procesarán $REMAINING_FILES archivos.${NC}"
echo -e "${YELLOW}    Esto puede tomar aproximadamente $(($REMAINING_FILES * 3 / 60)) minutos.${NC}"
echo ""
read -p "¿Continuar? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${RED}Cancelado por el usuario${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}▶ Iniciando procesamiento...${NC}"
echo ""

# Inicializar log
echo "=== PROCESO BATCH DE ARCHIVOS ===" > "$MAIN_LOG"
echo "Fecha: $(date)" >> "$MAIN_LOG"
echo "Total a procesar: $REMAINING_FILES archivos" >> "$MAIN_LOG"
echo "=================================" >> "$MAIN_LOG"

# Variables de tracking
PROCESSED=0
ERRORS=0
START_TIME=$(date +%s)

# Obtener lista de archivos no procesados
echo -e "${CYAN}Obteniendo lista de archivos no procesados...${NC}"

UNPROCESSED_FILES=$(sqlite3 "$DB_PATH" << EOF
SELECT af.file_path 
FROM audio_files af 
WHERE af.id NOT IN (
    SELECT file_id FROM llm_metadata 
    WHERE AI_BPM IS NOT NULL AND AI_BPM > 0
)
EOF
)

# Contar archivos
FILE_COUNT=$(echo "$UNPROCESSED_FILES" | grep -c .)

if [ $FILE_COUNT -eq 0 ]; then
    echo -e "${YELLOW}No se encontraron archivos para procesar${NC}"
    exit 0
fi

echo -e "${GREEN}Encontrados $FILE_COUNT archivos para procesar${NC}"
echo ""

# Procesar archivos
echo "$UNPROCESSED_FILES" | while IFS= read -r file_path; do
    if [ -z "$file_path" ]; then
        continue
    fi
    
    ((PROCESSED++))
    
    # Mostrar progreso
    PERCENT=$((PROCESSED * 100 / FILE_COUNT))
    echo -ne "\r${CYAN}Progreso: [$PROCESSED/$FILE_COUNT] ${PERCENT}% - $(basename "$file_path" | cut -c1-50)...${NC}"
    
    # Ejecutar análisis
    if python3 essentia_enhanced_v2.py "$file_path" \
        --strategy "$STRATEGY" \
        --save-db \
        --db "$DB_PATH" >> "$MAIN_LOG" 2>&1; then
        echo -ne " ${GREEN}✓${NC}"
    else
        ((ERRORS++))
        echo -ne " ${RED}✗${NC}"
        echo "ERROR: $file_path" >> "$MAIN_LOG"
    fi
    
    # Mostrar estadísticas cada 25 archivos
    if [ $((PROCESSED % 25)) -eq 0 ]; then
        echo ""
        CURRENT_TIME=$(date +%s)
        ELAPSED=$((CURRENT_TIME - START_TIME))
        RATE=$((PROCESSED * 60 / ELAPSED))
        echo -e "${BLUE}  ├─ Procesados: $PROCESSED | Errores: $ERRORS | Velocidad: ~$RATE/min${NC}"
    fi
    
    # Pequeña pausa para no saturar
    sleep 0.1
    
    # Límite de prueba (quitar en producción)
    # if [ $PROCESSED -ge 10 ]; then
    #     echo -e "\n${YELLOW}Límite de prueba alcanzado (10 archivos)${NC}"
    #     break
    # fi
done

echo ""
echo ""

# Estadísticas finales
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_TIME / 60))
SECONDS=$((TOTAL_TIME % 60))

# Obtener nuevas estadísticas
FINAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
NEW_ANALYZED=$((FINAL_ANALYZED - ANALYZED_FILES))

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  PROCESO COMPLETADO                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 Resumen:${NC}"
echo -e "  • Archivos procesados: ${GREEN}$PROCESSED${NC}"
echo -e "  • Nuevos análisis exitosos: ${GREEN}$NEW_ANALYZED${NC}"
echo -e "  • Errores: ${RED}$ERRORS${NC}"
if [ $PROCESSED -gt 0 ]; then
    SUCCESS_RATE=$((NEW_ANALYZED * 100 / PROCESSED))
    echo -e "  • Tasa de éxito: ${GREEN}${SUCCESS_RATE}%${NC}"
fi
echo ""
echo -e "${CYAN}⏱️ Tiempo total: ${MINUTES}m ${SECONDS}s${NC}"
echo -e "${CYAN}📄 Log: $MAIN_LOG${NC}"

# Guardar resumen
cat << EOF > "${LOG_DIR}/summary_${TIMESTAMP}.json"
{
  "timestamp": "$(date -Iseconds)",
  "processed": $PROCESSED,
  "successful": $NEW_ANALYZED,
  "errors": $ERRORS,
  "total_time_seconds": $TOTAL_TIME,
  "files_per_minute": $((PROCESSED * 60 / (TOTAL_TIME + 1))),
  "batch_size": $BATCH_SIZE,
  "strategy": "$STRATEGY"
}
EOF

echo -e "${GREEN}📄 Resumen JSON: ${LOG_DIR}/summary_${TIMESTAMP}.json${NC}"

# Notificación sonora
if command -v afplay &> /dev/null; then
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null
fi

exit 0