#!/bin/bash
# Script para monitorear el progreso del análisis en tiempo real

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

DB_PATH="music_analyzer.db"

# Función para obtener estadísticas
get_stats() {
    # Total de archivos
    TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
    
    # Archivos analizados
    ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
    
    # Archivos con errores (sin metadata)
    ERRORS=$(sqlite3 "$DB_PATH" "
        SELECT COUNT(*) FROM audio_files af 
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id 
        WHERE lm.file_id IS NULL
    " 2>/dev/null || echo "0")
    
    # Últimos analizados
    LAST_5=$(sqlite3 "$DB_PATH" "
        SELECT af.file_name, lm.AI_BPM, lm.AI_KEY 
        FROM audio_files af 
        JOIN llm_metadata lm ON af.id = lm.file_id 
        WHERE lm.AI_BPM > 0
        ORDER BY lm.file_id DESC 
        LIMIT 5
    " 2>/dev/null)
    
    # Estadísticas de features
    AVG_BPM=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_BPM), 1) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
    AVG_ENERGY=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_ENERGY), 3) FROM llm_metadata WHERE AI_ENERGY > 0" 2>/dev/null || echo "0")
    AVG_DANCE=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_DANCEABILITY), 3) FROM llm_metadata WHERE AI_DANCEABILITY > 0" 2>/dev/null || echo "0")
    
    # Distribución de géneros
    TOP_KEYS=$(sqlite3 "$DB_PATH" "
        SELECT AI_KEY, COUNT(*) as cnt 
        FROM llm_metadata 
        WHERE AI_KEY IS NOT NULL AND AI_KEY != ''
        GROUP BY AI_KEY 
        ORDER BY cnt DESC 
        LIMIT 3
    " 2>/dev/null)
}

# Función para dibujar barra de progreso
draw_progress_bar() {
    local percent=$1
    local width=50
    local filled=$((percent * width / 100))
    
    printf "["
    printf "%${filled}s" | tr ' ' '█'
    printf "%$((width - filled))s" | tr ' ' '░'
    printf "] %d%%" "$percent"
}

# Función principal de monitoreo
monitor() {
    while true; do
        clear
        
        # Obtener estadísticas
        get_stats
        
        # Calcular porcentajes
        PERCENT=$((ANALYZED * 100 / TOTAL))
        REMAINING=$((TOTAL - ANALYZED))
        
        # Header
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║         MONITOR DE ANÁLISIS ESSENTIA - TIEMPO REAL        ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo ""
        
        # Progreso general
        echo -e "${CYAN}📊 PROGRESO GENERAL${NC}"
        echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -ne "${GREEN}Analizados: $ANALYZED/$TOTAL ${NC}"
        draw_progress_bar $PERCENT
        echo ""
        echo -e "${YELLOW}Restantes: $REMAINING archivos${NC}"
        echo -e "${RED}Errores: $ERRORS archivos${NC}"
        echo ""
        
        # Estadísticas de features
        echo -e "${MAGENTA}🎵 ESTADÍSTICAS DE FEATURES${NC}"
        echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "BPM promedio:         ${GREEN}$AVG_BPM${NC}"
        echo -e "Energía promedio:     ${GREEN}$AVG_ENERGY${NC}"
        echo -e "Danceability promedio: ${GREEN}$AVG_DANCE${NC}"
        echo ""
        
        # Top tonalidades
        echo -e "${BLUE}🎹 TOP TONALIDADES${NC}"
        echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$TOP_KEYS" | while IFS='|' read -r key count; do
            if [ -n "$key" ]; then
                printf "%-15s %s archivos\n" "$key" "$count"
            fi
        done
        echo ""
        
        # Últimos procesados
        echo -e "${YELLOW}📝 ÚLTIMOS 5 PROCESADOS${NC}"
        echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$LAST_5" | while IFS='|' read -r name bpm key; do
            if [ -n "$name" ]; then
                # Truncar nombre si es muy largo
                if [ ${#name} -gt 40 ]; then
                    name="${name:0:37}..."
                fi
                printf "%-43s BPM:%-6.0f Key:%s\n" "$name" "$bpm" "$key"
            fi
        done
        echo ""
        
        # Velocidad de procesamiento
        if [ -f "essentia_logs/process_remaining_*.log" ]; then
            RATE=$(tail -n 100 essentia_logs/process_remaining_*.log 2>/dev/null | grep -c "✅" || echo "0")
            if [ $RATE -gt 0 ]; then
                echo -e "${CYAN}⚡ Velocidad: ~$RATE archivos/minuto${NC}"
            fi
        fi
        
        # Footer
        echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${CYAN}Actualizado: $(date '+%H:%M:%S')${NC}"
        echo -e "${YELLOW}Presiona Ctrl+C para salir${NC}"
        
        # Actualizar cada 5 segundos
        sleep 5
    done
}

# Verificar que existe la BD
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ No se encuentra la base de datos: $DB_PATH${NC}"
    exit 1
fi

# Iniciar monitoreo
monitor