#!/bin/bash

# ╔══════════════════════════════════════════════════════════════╗
# ║   RESET Y PROCESAMIENTO COMPLETO CON ESSENTIA FIXED         ║
# ║   Limpia datos inválidos y reprocesa todo correctamente     ║
# ╚══════════════════════════════════════════════════════════════╝

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${BOLD}       ESSENTIA FIXED - RESET Y PROCESAMIENTO                ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Verificar estado actual
echo -e "${BOLD}📊 ESTADO ACTUAL:${NC}"
STATS=$(sqlite3 music_analyzer.db "
SELECT 
    COUNT(DISTINCT af.id) as total,
    COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed,
    COUNT(DISTINCT CASE 
        WHEN lm.AI_DANCEABILITY > 1.0 OR lm.AI_DANCEABILITY < 0
        OR lm.AI_ACOUSTICNESS > 1.0 OR lm.AI_ACOUSTICNESS < 0
        OR lm.AI_INSTRUMENTALNESS < -50 OR lm.AI_SPEECHINESS < -50
        THEN lm.file_id END) as invalid
FROM audio_files af
LEFT JOIN llm_metadata lm ON af.id = lm.file_id
" 2>/dev/null)

IFS='|' read -r total analyzed invalid <<< "$STATS"
echo -e "   Total archivos: ${BOLD}$total${NC}"
echo -e "   Ya analizados: ${BOLD}$analyzed${NC}"
echo -e "   Datos inválidos: ${BOLD}$invalid${NC}"
echo ""

# 2. Preguntar qué hacer
echo -e "${YELLOW}¿Qué deseas hacer?${NC}"
echo -e "   ${CYAN}1)${NC} Limpiar SOLO datos inválidos y reprocesar"
echo -e "   ${CYAN}2)${NC} Limpiar TODO y empezar de cero"
echo -e "   ${CYAN}3)${NC} Continuar sin limpiar"
echo -e "   ${CYAN}4)${NC} Cancelar"
echo ""
echo -n "Opción (1-4): "
read -n 1 option
echo ""
echo ""

case $option in
    1)
        echo -e "${BOLD}🧹 Limpiando datos inválidos...${NC}"
        sqlite3 music_analyzer.db "
        UPDATE llm_metadata
        SET AI_LOUDNESS = NULL,
            AI_DANCEABILITY = NULL,
            AI_ACOUSTICNESS = NULL,
            AI_INSTRUMENTALNESS = NULL,
            AI_SPEECHINESS = NULL,
            AI_LIVENESS = NULL,
            AI_VALENCE = NULL,
            AI_CONFIDENCE = NULL,
            AI_ANALYZED_DATE = NULL
        WHERE AI_DANCEABILITY > 1.0 
        OR AI_DANCEABILITY < 0
        OR AI_ACOUSTICNESS > 1.0
        OR AI_ACOUSTICNESS < 0
        OR AI_INSTRUMENTALNESS < -50
        OR AI_SPEECHINESS < -50
        OR AI_CONFIDENCE < 0.5
        " 2>/dev/null
        
        CLEANED=$(sqlite3 music_analyzer.db "SELECT changes()" 2>/dev/null)
        echo -e "${GREEN}✅ Limpiados $CLEANED registros inválidos${NC}"
        ;;
        
    2)
        echo -e "${BOLD}🗑️ Limpiando TODOS los datos de análisis...${NC}"
        echo -e "${RED}⚠️ Esto borrará todos los análisis previos${NC}"
        echo -n "¿Estás seguro? (s/n): "
        read -n 1 confirm
        echo ""
        
        if [ "$confirm" == "s" ] || [ "$confirm" == "S" ]; then
            sqlite3 music_analyzer.db "
            UPDATE llm_metadata
            SET AI_LOUDNESS = NULL,
                AI_DANCEABILITY = NULL,
                AI_ACOUSTICNESS = NULL,
                AI_INSTRUMENTALNESS = NULL,
                AI_SPEECHINESS = NULL,
                AI_LIVENESS = NULL,
                AI_VALENCE = NULL,
                AI_CONFIDENCE = NULL,
                AI_ANALYZED_DATE = NULL
            " 2>/dev/null
            
            echo -e "${GREEN}✅ Todos los datos han sido limpiados${NC}"
        else
            echo -e "${YELLOW}Operación cancelada${NC}"
            exit 0
        fi
        ;;
        
    3)
        echo -e "${BLUE}Continuando sin limpiar...${NC}"
        ;;
        
    4)
        echo -e "${YELLOW}Operación cancelada${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""

# 3. Verificar archivos pendientes
PENDING=$(sqlite3 music_analyzer.db "
SELECT COUNT(DISTINCT af.id) 
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
)" 2>/dev/null)

echo -e "${BOLD}📁 Archivos pendientes de procesar: ${YELLOW}$PENDING${NC}"
echo ""

if [ "$PENDING" -eq 0 ]; then
    echo -e "${GREEN}✅ No hay archivos pendientes!${NC}"
    exit 0
fi

# 4. Configurar procesamiento
echo -e "${BOLD}⚙️ CONFIGURACIÓN DE PROCESAMIENTO:${NC}"
echo -e "   Método: ${GREEN}Essentia Fixed (con validación)${NC}"
echo -e "   Parámetros: ${GREEN}7 (Loudness, Dance, Acoustic, Inst, Speech, Live, Valence)${NC}"
echo -e "   Validación: ${GREEN}Rangos estrictos [0-1]${NC}"
echo ""

echo -n "Tamaño del batch (default 100): "
read batch_input
BATCH_SIZE=${batch_input:-100}

echo ""
echo -e "${YELLOW}¿Iniciar procesamiento con batch de $BATCH_SIZE? (s/n):${NC} \c"
read -n 1 start
echo ""

if [ "$start" != "s" ] && [ "$start" != "S" ]; then
    echo -e "${YELLOW}Procesamiento cancelado${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Iniciando procesamiento...${NC}"
echo ""

# 5. Ejecutar procesamiento
./essentia_full_process.sh $BATCH_SIZE