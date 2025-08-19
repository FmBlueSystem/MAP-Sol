#!/bin/bash

# ╔══════════════════════════════════════════════════════════════╗
# ║   ESSENTIA SMART-60 FULL PROCESSING WITH PROGRESS           ║
# ║   Análisis completo de 7 parámetros con visualización       ║
# ╚══════════════════════════════════════════════════════════════╝

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuración
BATCH_SIZE=${1:-200}  # Tamaño del batch (default: 200)
MAX_RETRIES=1000
DB_PATH="music_analyzer.db"
LOG_FILE="essentia_process_$(date +%Y%m%d_%H%M%S).log"

# Función para obtener estadísticas
get_stats() {
    sqlite3 $DB_PATH "SELECT 
        COUNT(DISTINCT af.id) as total,
        COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id" 2>/dev/null | tr '|' ' '
}

# Función para obtener archivos pendientes (incluye datos inválidos)
get_pending() {
    sqlite3 $DB_PATH "SELECT COUNT(DISTINCT af.id) 
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE af.file_path IS NOT NULL
        AND (
            lm.AI_LOUDNESS IS NULL 
            OR lm.AI_CONFIDENCE < 0.5
            OR lm.AI_DANCEABILITY > 1.0 
            OR lm.AI_DANCEABILITY < 0
            OR lm.AI_ACOUSTICNESS > 1.0
            OR lm.AI_ACOUSTICNESS < 0
            OR lm.AI_INSTRUMENTALNESS < -50
            OR lm.AI_SPEECHINESS < -50
        )" 2>/dev/null
}

# Función para mostrar barra de progreso
show_progress_bar() {
    local current=$1
    local total=$2
    local width=50
    
    if [ $total -eq 0 ]; then
        percent=0
    else
        percent=$((current * 100 / total))
    fi
    
    filled=$((width * current / total))
    
    # Crear barra
    printf "\r${BOLD}Progreso:${NC} ["
    
    # Parte llena
    if [ $percent -lt 25 ]; then
        printf "${RED}"
    elif [ $percent -lt 50 ]; then
        printf "${YELLOW}"
    elif [ $percent -lt 75 ]; then
        printf "${BLUE}"
    else
        printf "${GREEN}"
    fi
    
    for ((i=0; i<filled; i++)); do
        printf "█"
    done
    printf "${NC}"
    
    # Parte vacía
    for ((i=filled; i<width; i++)); do
        printf "░"
    done
    
    printf "] ${BOLD}%3d%%${NC} | %d/%d archivos | ⏳ %d pendientes" \
           "$percent" "$current" "$total" "$((total - current))"
}

# Función para formatear tiempo
format_time() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))
    
    if [ $hours -gt 0 ]; then
        printf "%dh %dm %ds" $hours $minutes $secs
    elif [ $minutes -gt 0 ]; then
        printf "%dm %ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

# Limpiar pantalla e imprimir header
clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${BOLD}       ESSENTIA FIXED - PROCESAMIENTO COMPLETO               ${NC}${CYAN}║${NC}"
echo -e "${CYAN}║${BOLD}          Versión corregida con validación                   ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}📊 Configuración:${NC}"
echo -e "   ${CYAN}•${NC} Batch size: ${YELLOW}$BATCH_SIZE${NC} archivos"
echo -e "   ${CYAN}•${NC} Max reintentos: ${YELLOW}$MAX_RETRIES${NC}"
echo -e "   ${CYAN}•${NC} Base de datos: ${YELLOW}$DB_PATH${NC}"
echo -e "   ${CYAN}•${NC} Log: ${YELLOW}$LOG_FILE${NC}"
echo ""

# Verificar estado inicial
echo -e "${BOLD}🔍 Verificando estado inicial...${NC}"
read total analyzed <<< $(get_stats)
pending=$(get_pending)

if [ -z "$total" ] || [ "$total" -eq 0 ]; then
    echo -e "${RED}❌ Error: No se pudo conectar a la base de datos${NC}"
    exit 1
fi

echo -e "   ${GREEN}✓${NC} Total archivos: ${BOLD}$total${NC}"
echo -e "   ${GREEN}✓${NC} Ya analizados: ${BOLD}$analyzed${NC}"
echo -e "   ${GREEN}✓${NC} Pendientes: ${BOLD}$pending${NC}"
echo ""

# Verificar si hay archivos pendientes
if [ "$pending" -eq 0 ]; then
    echo -e "${GREEN}✅ Todos los archivos ya han sido procesados!${NC}"
    exit 0
fi

# Preguntar si continuar
echo -e "${YELLOW}¿Iniciar procesamiento? (s/n):${NC} \c"
read -n 1 answer
echo ""

if [ "$answer" != "s" ] && [ "$answer" != "S" ]; then
    echo -e "${RED}Procesamiento cancelado${NC}"
    exit 0
fi

echo ""
echo -e "${BOLD}🚀 Iniciando procesamiento...${NC}"
echo ""

# Variables para tracking
START_TIME=$(date +%s)
LAST_ANALYZED=$analyzed
RETRY_COUNT=0
BATCH_COUNT=0

# Función para manejar Ctrl+C
trap 'echo -e "\n\n${YELLOW}⚠️ Procesamiento interrumpido${NC}"; show_final_stats; exit 1' INT

# Función para mostrar estadísticas finales
show_final_stats() {
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    
    read total final_analyzed <<< $(get_stats)
    PROCESSED=$((final_analyzed - LAST_ANALYZED))
    
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${BOLD}                   RESUMEN FINAL                             ${NC}${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✅ Procesamiento completado${NC}"
    echo ""
    echo -e "${BOLD}📊 Estadísticas:${NC}"
    echo -e "   ${CYAN}•${NC} Archivos procesados en esta sesión: ${BOLD}$PROCESSED${NC}"
    echo -e "   ${CYAN}•${NC} Total analizados: ${BOLD}$final_analyzed/$total${NC}"
    echo -e "   ${CYAN}•${NC} Tiempo transcurrido: ${BOLD}$(format_time $ELAPSED)${NC}"
    
    if [ $PROCESSED -gt 0 ] && [ $ELAPSED -gt 0 ]; then
        RATE=$((PROCESSED * 60 / ELAPSED))
        echo -e "   ${CYAN}•${NC} Velocidad promedio: ${BOLD}$RATE archivos/min${NC}"
    fi
    
    echo -e "   ${CYAN}•${NC} Batches ejecutados: ${BOLD}$BATCH_COUNT${NC}"
    echo -e "   ${CYAN}•${NC} Log guardado en: ${BOLD}$LOG_FILE${NC}"
    echo ""
}

# Loop principal con monitor de progreso
echo -e "${BOLD}📈 Progreso en tiempo real:${NC}"
echo ""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Obtener estado actual
    pending=$(get_pending)
    
    # Verificar si terminamos
    if [ -z "$pending" ] || [ "$pending" -eq 0 ]; then
        show_final_stats
        exit 0
    fi
    
    # Incrementar contador de batch
    ((BATCH_COUNT++))
    
    # Mostrar info del batch
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Batch #$BATCH_COUNT${NC} | $(date '+%H:%M:%S') | Pendientes: $pending"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Ejecutar procesamiento FIXED en background
    python3 essentia_fixed.py --batch $BATCH_SIZE >> $LOG_FILE 2>&1 &
    PID=$!
    
    # Monitor de progreso mientras el proceso corre
    while kill -0 $PID 2>/dev/null; do
        read total analyzed <<< $(get_stats)
        show_progress_bar $analyzed $total
        sleep 2
    done
    
    # Verificar código de salida
    wait $PID
    EXIT_CODE=$?
    
    # Actualizar progreso final del batch
    read total analyzed <<< $(get_stats)
    show_progress_bar $analyzed $total
    echo ""
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ Batch completado exitosamente${NC}"
        RETRY_COUNT=0  # Reset counter on success
    else
        echo -e "${YELLOW}⚠️ Batch falló con código $EXIT_CODE${NC}"
        ((RETRY_COUNT++))
        
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}Reintentando en 5 segundos...${NC}"
            sleep 5
        fi
    fi
    
    # Pequeña pausa entre batches
    sleep 3
done

# Si llegamos aquí, excedimos los reintentos
echo -e "${RED}❌ Máximo de reintentos alcanzado${NC}"
show_final_stats
exit 1