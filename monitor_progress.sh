#!/bin/bash

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 MONITOR DE PROGRESO - ANÁLISIS DE AUDIO${NC}"
echo "=========================================="

while true; do
    # Obtener estadísticas
    TOTAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files" 2>/dev/null)
    ANALYZED=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_CONFIDENCE >= 0.5 AND AI_LOUDNESS IS NOT NULL" 2>/dev/null)
    PENDING=$((TOTAL - ANALYZED))
    PERCENT=$((ANALYZED * 100 / TOTAL))
    
    # Mostrar estadísticas
    echo -ne "\r${GREEN}✅ Analizados: $ANALYZED${NC} | ${YELLOW}⏳ Pendientes: $PENDING${NC} | ${BLUE}📈 Progreso: ${PERCENT}%${NC}  "
    
    # Si está completo, salir
    if [ $PENDING -eq 0 ]; then
        echo -e "\n\n${GREEN}🎉 ¡PROCESAMIENTO COMPLETADO!${NC}"
        break
    fi
    
    sleep 5
done