#!/bin/bash
# Script de procesamiento robusto que maneja crashes y errores

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuración
DB_PATH="music_analyzer.db"
LOG_DIR="essentia_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/process_safe_${TIMESTAMP}.log"
ERROR_LOG="$LOG_DIR/errors_${TIMESTAMP}.log"

# Crear directorio de logs
mkdir -p "$LOG_DIR"

# Activar entorno virtual
source .venv/bin/activate

# Instalar librosa si no está instalado
echo -e "${CYAN}Verificando dependencias...${NC}"
python3 -c "import librosa" 2>/dev/null || {
    echo -e "${YELLOW}Instalando librosa como fallback...${NC}"
    pip install librosa numba --quiet
}

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     PROCESADOR ROBUSTO DE AUDIO - ESSENTIA + LIBROSA    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Función para mostrar ayuda
show_help() {
    cat << EOF
Uso: $0 [OPCIONES]

OPCIONES:
    -n NUM       Número de archivos a procesar (default: 100)
    -s STRATEGY  Estrategia: smart60|first60|full (default: smart60)
    -t TIMEOUT   Timeout por archivo en segundos (default: 30)
    --skip-m4a   Omitir archivos .m4a problemáticos
    --test       Modo prueba (procesa solo 5 archivos)
    -h           Mostrar esta ayuda

EJEMPLOS:
    $0                    # Procesar 100 archivos
    $0 -n 500            # Procesar 500 archivos
    $0 --skip-m4a -n 1000  # Procesar 1000 archivos omitiendo .m4a
    $0 --test            # Modo prueba con 5 archivos

EOF
}

# Parsear argumentos
MAX_FILES=100
STRATEGY="smart60"
TIMEOUT=30
SKIP_M4A=false
TEST_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -n)
            MAX_FILES="$2"
            shift 2
            ;;
        -s)
            STRATEGY="$2"
            shift 2
            ;;
        -t)
            TIMEOUT="$2"
            shift 2
            ;;
        --skip-m4a)
            SKIP_M4A=true
            shift
            ;;
        --test)
            TEST_MODE=true
            MAX_FILES=5
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Opción desconocida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Obtener estadísticas iniciales
TOTAL_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED_FILES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
REMAINING=$((TOTAL_FILES - ANALYZED_FILES))

echo -e "${BLUE}📊 Estado Inicial:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL_FILES${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED_FILES${NC}"
echo -e "  • Por procesar: ${YELLOW}$REMAINING${NC}"
echo ""

if [ $REMAINING -eq 0 ]; then
    echo -e "${GREEN}✅ Todos los archivos ya están analizados!${NC}"
    exit 0
fi

# Configuración de procesamiento
echo -e "${CYAN}⚙️  Configuración:${NC}"
echo -e "  • Archivos a procesar: $MAX_FILES"
echo -e "  • Estrategia: $STRATEGY"
echo -e "  • Timeout: ${TIMEOUT}s por archivo"
if [ "$SKIP_M4A" = true ]; then
    echo -e "  • ${YELLOW}Omitiendo archivos .m4a${NC}"
fi
if [ "$TEST_MODE" = true ]; then
    echo -e "  • ${YELLOW}MODO PRUEBA ACTIVADO${NC}"
fi
echo ""

# Confirmar
if [ "$TEST_MODE" = false ]; then
    read -p "¿Continuar? (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${RED}Cancelado${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}▶ Iniciando procesamiento...${NC}"
echo ""

# Inicializar logs
echo "=== PROCESAMIENTO ROBUSTO ===" > "$LOG_FILE"
echo "Fecha: $(date)" >> "$LOG_FILE"
echo "Configuración: MAX=$MAX_FILES, STRATEGY=$STRATEGY, TIMEOUT=$TIMEOUT" >> "$LOG_FILE"
echo "===========================" >> "$LOG_FILE"

# Contadores
PROCESSED=0
SUCCESS=0
ERRORS=0
SKIPPED=0
CRASHES=0
START_TIME=$(date +%s)

# Función para procesar un archivo
process_file() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    local file_ext="${file_name##*.}"
    
    # Verificar si debemos omitir .m4a
    if [ "$SKIP_M4A" = true ] && [ "$file_ext" = "m4a" ]; then
        echo -e "  ${YELLOW}⏭️ Omitido (m4a)${NC}"
        ((SKIPPED++))
        echo "SKIPPED: $file_path (m4a file)" >> "$LOG_FILE"
        return 0
    fi
    
    # Intentar procesar con wrapper seguro
    echo -ne "  Analizando... "
    
    # Crear archivo temporal para resultado
    TEMP_RESULT=$(mktemp)
    
    # Ejecutar análisis con timeout
    timeout "$TIMEOUT" python3 essentia_safe_wrapper.py "$file_path" \
        --strategy "$STRATEGY" \
        --save-db \
        --json "$TEMP_RESULT" >> "$LOG_FILE" 2>&1
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        # Verificar resultado
        if [ -f "$TEMP_RESULT" ] && grep -q '"status": "success"' "$TEMP_RESULT" 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            ((SUCCESS++))
            
            # Extraer BPM y Key si están disponibles
            BPM=$(grep -o '"bpm": [0-9.]*' "$TEMP_RESULT" | cut -d' ' -f2 | head -1)
            KEY=$(grep -o '"key": "[^"]*"' "$TEMP_RESULT" | cut -d'"' -f4 | head -1)
            
            if [ -n "$BPM" ] && [ -n "$KEY" ]; then
                echo "    BPM: $BPM, Key: $KEY" | tee -a "$LOG_FILE"
            fi
        else
            # Intentar con librosa como fallback
            echo -ne "${YELLOW}↻${NC} "
            
            timeout "$TIMEOUT" python3 librosa_fallback.py "$file_path" \
                --json "$TEMP_RESULT" >> "$LOG_FILE" 2>&1
            
            if [ $? -eq 0 ] && grep -q '"status": "success"' "$TEMP_RESULT" 2>/dev/null; then
                echo -e "${GREEN}✓ (librosa)${NC}"
                ((SUCCESS++))
                echo "SUCCESS (librosa): $file_path" >> "$LOG_FILE"
            else
                echo -e "${RED}✗${NC}"
                ((ERRORS++))
                echo "ERROR: $file_path" >> "$LOG_FILE"
                echo "$file_path" >> "$ERROR_LOG"
            fi
        fi
    elif [ $EXIT_CODE -eq 124 ]; then
        # Timeout
        echo -e "${YELLOW}⏱️ (timeout)${NC}"
        ((ERRORS++))
        echo "TIMEOUT: $file_path" >> "$LOG_FILE"
        echo "$file_path" >> "$ERROR_LOG"
    elif [ $EXIT_CODE -eq 139 ]; then
        # Segmentation fault
        echo -e "${RED}💥 (crash)${NC}"
        ((CRASHES++))
        echo "CRASH: $file_path" >> "$LOG_FILE"
        echo "$file_path" >> "$ERROR_LOG"
    else
        echo -e "${RED}✗${NC}"
        ((ERRORS++))
        echo "ERROR ($EXIT_CODE): $file_path" >> "$LOG_FILE"
        echo "$file_path" >> "$ERROR_LOG"
    fi
    
    # Limpiar archivo temporal
    rm -f "$TEMP_RESULT"
    
    return 0
}

# Obtener archivos no procesados
echo -e "${CYAN}Obteniendo lista de archivos no procesados...${NC}"

UNPROCESSED=$(sqlite3 "$DB_PATH" << EOF
SELECT af.file_path 
FROM audio_files af 
WHERE af.id NOT IN (
    SELECT file_id FROM llm_metadata 
    WHERE AI_BPM IS NOT NULL
)
LIMIT $MAX_FILES
EOF
)

FILE_COUNT=$(echo "$UNPROCESSED" | grep -c .)

if [ $FILE_COUNT -eq 0 ]; then
    echo -e "${YELLOW}No hay archivos para procesar${NC}"
    exit 0
fi

echo -e "${GREEN}Procesando $FILE_COUNT archivos...${NC}"
echo ""

# Procesar archivos
COUNTER=0
echo "$UNPROCESSED" | while IFS= read -r file_path; do
    if [ -z "$file_path" ]; then
        continue
    fi
    
    ((COUNTER++))
    ((PROCESSED++))
    
    # Mostrar progreso
    PERCENT=$((COUNTER * 100 / FILE_COUNT))
    printf "[%3d/%3d] %3d%% - %-50s" "$COUNTER" "$FILE_COUNT" "$PERCENT" "$(basename "$file_path" | cut -c1-50)"
    
    # Procesar archivo
    process_file "$file_path"
    
    # Mostrar estadísticas cada 25 archivos
    if [ $((COUNTER % 25)) -eq 0 ]; then
        echo ""
        echo -e "${BLUE}  📊 Parcial: ✅ $SUCCESS | ❌ $ERRORS | ⏭️ $SKIPPED | 💥 $CRASHES${NC}"
        echo ""
    fi
    
    # Pequeña pausa para no saturar
    sleep 0.1
done

# Estadísticas finales
echo ""
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Obtener nuevas estadísticas
FINAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
NEW_ANALYZED=$((FINAL_ANALYZED - ANALYZED_FILES))

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  PROCESO COMPLETADO                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📊 Resumen:${NC}"
echo -e "  • Archivos procesados: ${GREEN}$PROCESSED${NC}"
echo -e "  • Exitosos: ${GREEN}$SUCCESS${NC}"
echo -e "  • Errores: ${RED}$ERRORS${NC}"
echo -e "  • Omitidos: ${YELLOW}$SKIPPED${NC}"
echo -e "  • Crashes: ${RED}$CRASHES${NC}"

if [ $PROCESSED -gt 0 ]; then
    SUCCESS_RATE=$((SUCCESS * 100 / PROCESSED))
    echo -e "  • Tasa de éxito: ${GREEN}${SUCCESS_RATE}%${NC}"
fi

echo ""
echo -e "${CYAN}📊 Base de Datos:${NC}"
echo -e "  • Total analizados: ${GREEN}$FINAL_ANALYZED${NC}"
echo -e "  • Nuevos análisis: ${GREEN}$NEW_ANALYZED${NC}"
echo ""
echo -e "${CYAN}⏱️ Tiempo: ${MINUTES}m ${SECONDS}s${NC}"
echo -e "${CYAN}📄 Log: $LOG_FILE${NC}"

if [ -f "$ERROR_LOG" ] && [ -s "$ERROR_LOG" ]; then
    ERROR_COUNT=$(wc -l < "$ERROR_LOG")
    echo -e "${YELLOW}⚠️ Archivos con errores: $ERROR_COUNT (ver $ERROR_LOG)${NC}"
fi

# Guardar resumen
cat << EOF > "$LOG_DIR/summary_${TIMESTAMP}.json"
{
  "timestamp": "$(date -Iseconds)",
  "processed": $PROCESSED,
  "success": $SUCCESS,
  "errors": $ERRORS,
  "skipped": $SKIPPED,
  "crashes": $CRASHES,
  "duration_seconds": $DURATION,
  "success_rate": $((SUCCESS * 100 / (PROCESSED + 1))),
  "new_analyzed": $NEW_ANALYZED,
  "strategy": "$STRATEGY",
  "timeout": $TIMEOUT,
  "skip_m4a": $SKIP_M4A
}
EOF

echo ""
echo -e "${GREEN}✅ Proceso completado${NC}"

# Recomendaciones si hay muchos crashes
if [ $CRASHES -gt 5 ]; then
    echo ""
    echo -e "${YELLOW}⚠️ Se detectaron múltiples crashes.${NC}"
    echo -e "${YELLOW}   Recomendación: Usar --skip-m4a para omitir archivos problemáticos${NC}"
fi

exit 0