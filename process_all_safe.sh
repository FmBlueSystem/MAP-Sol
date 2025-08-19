#!/bin/bash

# ╔══════════════════════════════════════════════════════════════╗
# ║   PROCESAMIENTO SEGURO COMPLETO CON ESSENTIA SAFE           ║
# ║   Procesa todos los archivos sin crashes                    ║
# ╚══════════════════════════════════════════════════════════════╝

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${BOLD}       ESSENTIA SAFE - PROCESAMIENTO COMPLETO                ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar archivos pendientes
PENDING=$(sqlite3 music_analyzer.db "
SELECT COUNT(DISTINCT af.id) 
FROM audio_files af
LEFT JOIN llm_metadata lm ON af.id = lm.file_id
WHERE af.file_path IS NOT NULL
AND (
    lm.AI_LOUDNESS IS NULL 
    OR typeof(lm.AI_LOUDNESS) != 'real'
    OR lm.AI_CONFIDENCE < 0.5
)" 2>/dev/null)

echo -e "${BOLD}📊 Estado actual:${NC}"
echo -e "   Archivos pendientes: ${YELLOW}$PENDING${NC}"
echo ""

if [ "$PENDING" -eq 0 ]; then
    echo -e "${GREEN}✅ No hay archivos pendientes!${NC}"
    exit 0
fi

# Configuración
BATCH_SIZE=100
TOTAL_PROCESSED=0

echo -e "${BOLD}⚙️ Configuración:${NC}"
echo -e "   Método: ${GREEN}Essentia Safe (subprocesos aislados)${NC}"
echo -e "   Batch size: ${GREEN}$BATCH_SIZE${NC}"
echo -e "   Timeout por archivo: ${GREEN}30 segundos${NC}"
echo ""

# Procesar en loop
while [ "$PENDING" -gt 0 ]; do
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}🔄 Procesando batch (pendientes: $PENDING)${NC}"
    
    # Ejecutar batch
    python3 essentia_safe.py --batch $BATCH_SIZE
    
    # Actualizar contador
    NEW_PENDING=$(sqlite3 music_analyzer.db "
    SELECT COUNT(DISTINCT af.id) 
    FROM audio_files af
    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
    WHERE af.file_path IS NOT NULL
    AND (
        lm.AI_LOUDNESS IS NULL 
        OR typeof(lm.AI_LOUDNESS) != 'real'
        OR lm.AI_CONFIDENCE < 0.5
    )" 2>/dev/null)
    
    PROCESSED=$((PENDING - NEW_PENDING))
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
    PENDING=$NEW_PENDING
    
    echo -e "${GREEN}✅ Procesados en este batch: $PROCESSED${NC}"
    echo -e "${GREEN}✅ Total procesados: $TOTAL_PROCESSED${NC}"
    
    # Pequeña pausa entre batches
    if [ "$PENDING" -gt 0 ]; then
        sleep 2
    fi
done

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${BOLD}                   PROCESAMIENTO COMPLETO                    ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Total archivos procesados: ${BOLD}$TOTAL_PROCESSED${NC}"

# Mostrar estadísticas finales
echo ""
echo -e "${BOLD}📊 Estadísticas finales:${NC}"
sqlite3 music_analyzer.db "
SELECT 
    'Total archivos' as metric,
    COUNT(DISTINCT af.id) as value
FROM audio_files af
UNION ALL
SELECT 
    'Analizados correctamente',
    COUNT(DISTINCT lm.file_id)
FROM llm_metadata lm
WHERE lm.AI_LOUDNESS IS NOT NULL
AND typeof(lm.AI_LOUDNESS) = 'real'
AND lm.AI_CONFIDENCE >= 0.5
UNION ALL
SELECT 
    'Valores promedio',
    printf('Dance: %.2f | Acoustic: %.2f | Valence: %.2f',
        AVG(AI_DANCEABILITY), 
        AVG(AI_ACOUSTICNESS),
        AVG(AI_VALENCE))
FROM llm_metadata
WHERE AI_LOUDNESS IS NOT NULL
AND typeof(AI_LOUDNESS) = 'real'
" 2>/dev/null | column -t -s '|'

echo ""
echo -e "${GREEN}✨ Procesamiento completado exitosamente!${NC}"