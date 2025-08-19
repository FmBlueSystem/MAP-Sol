#!/bin/bash
# Script seguro para ejecutar análisis con Essentia Enhanced v2

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
SCRIPT_VERSION="2.0"
ANALYZER_SCRIPT="essentia_enhanced_v2.py"
DB_PATH="music_analyzer.db"
LOG_FILE="essentia_analysis_$(date +%Y%m%d_%H%M%S).log"

# Activar entorno virtual
source .venv/bin/activate

# Verificar que estamos en el entorno correcto
if [[ "$(which python3)" != *".venv"* ]]; then
    echo -e "${RED}❌ Error: Entorno virtual no activo${NC}"
    exit 1
fi

# Verificar que el script existe
if [ ! -f "$ANALYZER_SCRIPT" ]; then
    echo -e "${RED}❌ Error: No se encuentra $ANALYZER_SCRIPT${NC}"
    echo "Descargue o cree el archivo primero"
    exit 1
fi

# Función para mostrar ayuda
show_help() {
    cat << EOF
╔══════════════════════════════════════════════╗
║   ESSENTIA ENHANCED V2 - BATCH PROCESSOR    ║
╚══════════════════════════════════════════════╝

Uso: $0 [OPCIONES]

OPCIONES:
    -n, --num NUM        Número de archivos a procesar (default: 10)
    -s, --strategy STRAT Estrategia: smart60|first60|full (default: smart60)
    -d, --dir DIR        Directorio de música (default: Consolidado2025)
    -j, --json FILE      Exportar resultados a JSON
    --no-db              No guardar en base de datos
    --no-cache           Desactivar cache
    -v, --verbose        Salida detallada
    -h, --help           Mostrar esta ayuda

EJEMPLOS:
    $0                   # Procesar 10 archivos con smart60
    $0 -n 50 -s full     # Procesar 50 archivos completos
    $0 -n 5 -v -j out.json # 5 archivos, verbose, exportar JSON

EOF
}

# Parsear argumentos
MAX_FILES=10
STRATEGY="smart60"
MUSIC_DIR="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"
JSON_OUTPUT=""
SAVE_DB="--save-db"
CACHE_OPT=""
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--num)
            MAX_FILES="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -d|--dir)
            MUSIC_DIR="$2"
            shift 2
            ;;
        -j|--json)
            JSON_OUTPUT="$2"
            shift 2
            ;;
        --no-db)
            SAVE_DB=""
            shift
            ;;
        --no-cache)
            CACHE_OPT="--no-cache"
            shift
            ;;
        -v|--verbose)
            VERBOSE="--verbose"
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

echo "╔══════════════════════════════════════════════╗"
echo "║   ESSENTIA ENHANCED V2 - BATCH PROCESSOR    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📍 Python:${NC} $(which python3)"
echo -e "${BLUE}📦 Versión:${NC} $(python3 --version)"
echo -e "${BLUE}🎯 Estrategia:${NC} $STRATEGY"
echo -e "${BLUE}📊 Base de datos:${NC} $DB_PATH"
echo -e "${BLUE}📁 Directorio:${NC} $(basename "$MUSIC_DIR")"
echo ""

# Verificar directorio
if [ ! -d "$MUSIC_DIR" ]; then
    echo -e "${RED}❌ Directorio no encontrado: $MUSIC_DIR${NC}"
    echo "Use -d para especificar otro directorio"
    exit 1
fi

# Contar archivos disponibles
TOTAL_FILES=$(find "$MUSIC_DIR" -type f \( -name "*.flac" -o -name "*.mp3" -o -name "*.m4a" \) | wc -l)
echo -e "${GREEN}📊 Archivos disponibles: $TOTAL_FILES${NC}"

if [ $TOTAL_FILES -eq 0 ]; then
    echo -e "${RED}❌ No se encontraron archivos de audio${NC}"
    exit 1
fi

# Limitar si hay menos archivos que el máximo solicitado
if [ $TOTAL_FILES -lt $MAX_FILES ]; then
    MAX_FILES=$TOTAL_FILES
fi

echo -e "${YELLOW}🎯 Procesando: $MAX_FILES archivos${NC}"
echo ""

# Función para procesar un archivo
process_file() {
    local file="$1"
    local index="$2"
    local total="$3"
    
    echo -e "${BLUE}[$index/$total]${NC} $(basename "$file")"
    
    # Construir comando
    CMD="python3 $ANALYZER_SCRIPT \"$file\" --strategy $STRATEGY"
    
    if [ -n "$SAVE_DB" ]; then
        CMD="$CMD $SAVE_DB --db $DB_PATH"
    fi
    
    if [ -n "$CACHE_OPT" ]; then
        CMD="$CMD $CACHE_OPT"
    fi
    
    if [ -n "$VERBOSE" ]; then
        CMD="$CMD $VERBOSE"
    fi
    
    # Ejecutar en un subproceso para aislar posibles crashes
    (
        eval $CMD 2>&1 | tee -a "$LOG_FILE" | grep -E "✅|❌|BPM=|Key="
    )
    
    return $?
}

# Arrays para tracking
declare -a SUCCESSFUL_FILES
declare -a FAILED_FILES
PROCESSED=0
ERRORS=0

# Crear archivo de log
echo "=== ESSENTIA ANALYSIS LOG ===" > "$LOG_FILE"
echo "Date: $(date)" >> "$LOG_FILE"
echo "Strategy: $STRATEGY" >> "$LOG_FILE"
echo "Directory: $MUSIC_DIR" >> "$LOG_FILE"
echo "===========================" >> "$LOG_FILE"

# Si se especifica JSON para batch, procesar todo y luego exportar
if [ -n "$JSON_OUTPUT" ] && [ $MAX_FILES -gt 1 ]; then
    echo -e "${YELLOW}📦 Modo batch con exportación JSON${NC}"
    
    # Crear lista temporal de archivos
    TEMP_LIST=$(mktemp)
    find "$MUSIC_DIR" -type f \( -name "*.flac" -o -name "*.mp3" -o -name "*.m4a" \) | head -n $MAX_FILES > "$TEMP_LIST"
    
    # Procesar todos de una vez
    CMD="python3 $ANALYZER_SCRIPT \"$MUSIC_DIR\" --strategy $STRATEGY"
    
    if [ -n "$SAVE_DB" ]; then
        CMD="$CMD $SAVE_DB --db $DB_PATH"
    fi
    
    if [ -n "$CACHE_OPT" ]; then
        CMD="$CMD $CACHE_OPT"
    fi
    
    CMD="$CMD --json $JSON_OUTPUT"
    
    if [ -n "$VERBOSE" ]; then
        CMD="$CMD $VERBOSE"
    fi
    
    echo -e "${YELLOW}Ejecutando análisis batch...${NC}"
    eval $CMD 2>&1 | tee -a "$LOG_FILE"
    
    rm "$TEMP_LIST"
    
    echo ""
    echo -e "${GREEN}✅ Resultados exportados a: $JSON_OUTPUT${NC}"
else
    # Procesar archivo por archivo
    COUNT=0
    for file in "$MUSIC_DIR"/*.flac "$MUSIC_DIR"/*.mp3 "$MUSIC_DIR"/*.m4a; do
        [ -f "$file" ] || continue
        
        if [ $COUNT -ge $MAX_FILES ]; then
            break
        fi
        
        ((COUNT++))
        
        process_file "$file" "$COUNT" "$MAX_FILES"
        
        if [ $? -eq 0 ]; then
            ((PROCESSED++))
            SUCCESSFUL_FILES+=("$(basename "$file")")
        else
            ((ERRORS++))
            FAILED_FILES+=("$(basename "$file")")
        fi
        
        # Progress bar
        PROGRESS=$((COUNT * 100 / MAX_FILES))
        printf "\r${GREEN}Progreso: [%-50s] %d%%${NC}" $(printf '#%.0s' $(seq 1 $((PROGRESS/2)))) $PROGRESS
        
        # Pequeña pausa entre archivos para no saturar
        sleep 0.5
    done
fi

echo ""
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            ANÁLISIS COMPLETADO               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Procesados exitosamente: $PROCESSED${NC}"
echo -e "${RED}❌ Errores: $ERRORS${NC}"

# Mostrar estadísticas de la BD si se guardó
if [ -n "$SAVE_DB" ] && [ -f "$DB_PATH" ]; then
    TOTAL_IN_DB=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
    ANALYZED_IN_DB=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
    echo ""
    echo -e "${BLUE}📊 Base de datos:${NC}"
    echo "  • Total archivos: $TOTAL_IN_DB"
    echo "  • Analizados: $ANALYZED_IN_DB"
fi

# Mostrar archivos fallidos si hay
if [ ${#FAILED_FILES[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️ Archivos con errores:${NC}"
    for failed in "${FAILED_FILES[@]}"; do
        echo "  • $failed"
    done
fi

echo ""
echo -e "${BLUE}📄 Log guardado en: $LOG_FILE${NC}"

if [ -n "$JSON_OUTPUT" ]; then
    echo -e "${BLUE}📄 JSON exportado a: $JSON_OUTPUT${NC}"
fi

# Retornar código de salida según errores
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi