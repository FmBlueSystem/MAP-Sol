#!/bin/bash

###############################################################################
# AUDIO ANALYSIS RUNNER FOR MAC M1
# Análisis de audio usando librosa - Compatible con Mac M1/M2/M3
# Procesa archivos FLAC, M4A, MP3 con extracción de características
###############################################################################

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
VENV_PATH="$HOME/venvs/aubio_env"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="$SCRIPT_DIR/music_analyzer.db"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/audio_analysis_$(date +%Y%m%d_%H%M%S).log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

# Función para imprimir con color
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Función para verificar requisitos
check_requirements() {
    print_color "$CYAN" "\n🔍 Verificando requisitos del sistema..."
    
    # Verificar Python 3
    if ! command -v python3 &> /dev/null; then
        print_color "$RED" "❌ Python 3 no está instalado"
        exit 1
    fi
    
    # Verificar ffmpeg
    if ! command -v ffmpeg &> /dev/null; then
        print_color "$RED" "❌ FFmpeg no está instalado"
        print_color "$YELLOW" "   Instalar con: brew install ffmpeg"
        exit 1
    fi
    
    # Verificar entorno virtual
    if [ ! -d "$VENV_PATH" ]; then
        print_color "$YELLOW" "⚠️  Entorno virtual no encontrado en $VENV_PATH"
        print_color "$YELLOW" "   Creando nuevo entorno virtual..."
        python3 -m venv "$VENV_PATH"
        source "$VENV_PATH/bin/activate"
        pip install --upgrade pip
        pip install librosa soundfile numpy scipy scikit-learn
    fi
    
    # Verificar base de datos
    if [ ! -f "$DB_PATH" ]; then
        print_color "$RED" "❌ Base de datos no encontrada: $DB_PATH"
        exit 1
    fi
    
    # Verificar script de análisis
    if [ ! -f "$SCRIPT_DIR/librosa_analyzer.py" ]; then
        print_color "$RED" "❌ Script de análisis no encontrado: librosa_analyzer.py"
        exit 1
    fi
    
    print_color "$GREEN" "✅ Todos los requisitos verificados"
}

# Función para verificar disco externo
check_external_drive() {
    local drive_path="/Volumes/My Passport"
    if [ -d "$drive_path" ]; then
        print_color "$GREEN" "✅ Disco externo detectado: $drive_path"
        return 0
    else
        print_color "$YELLOW" "⚠️  Disco externo no detectado en: $drive_path"
        print_color "$YELLOW" "   Algunos archivos podrían no estar disponibles"
        return 1
    fi
}

# Función para mostrar estadísticas de la BD
show_db_stats() {
    print_color "$CYAN" "\n📊 Estadísticas de la base de datos:"
    
    local total_files=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null)
    local analyzed=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_CONFIDENCE > 0.5" 2>/dev/null)
    local pending=$((total_files - analyzed))
    
    print_color "$BLUE" "   Total archivos: $total_files"
    print_color "$GREEN" "   Analizados: $analyzed"
    print_color "$YELLOW" "   Pendientes: $pending"
    
    if [ $pending -eq 0 ]; then
        print_color "$GREEN" "\n✅ Todos los archivos han sido analizados!"
        return 1
    fi
    return 0
}

# Función para ejecutar análisis
run_analysis() {
    local mode=$1
    local workers=${2:-4}
    local batch=${3:-100}
    
    print_color "$CYAN" "\n🚀 Iniciando análisis de audio..."
    print_color "$BLUE" "   Modo: $mode"
    print_color "$BLUE" "   Workers: $workers"
    print_color "$BLUE" "   Batch size: $batch"
    print_color "$BLUE" "   Log: $LOG_FILE"
    
    # Activar entorno virtual
    source "$VENV_PATH/bin/activate"
    
    # Usar la versión secuencial que es más estable
    local script="librosa_sequential.py"
    
    # Ejecutar según el modo
    case $mode in
        "test")
            print_color "$YELLOW" "\n🧪 Modo TEST - Procesando 5 archivos..."
            python "$SCRIPT_DIR/$script" --test 2>&1 | tee -a "$LOG_FILE"
            ;;
        "batch")
            print_color "$YELLOW" "\n📦 Modo BATCH - Procesando $batch archivos..."
            python "$SCRIPT_DIR/$script" --batch "$batch" 2>&1 | tee -a "$LOG_FILE"
            ;;
        "continuous")
            print_color "$YELLOW" "\n♾️  Modo CONTINUO - Procesando todos los archivos pendientes..."
            python "$SCRIPT_DIR/$script" --continuous 2>&1 | tee -a "$LOG_FILE"
            ;;
        "limited")
            local limit=${4:-1000}
            print_color "$YELLOW" "\n🎯 Modo LIMITADO - Procesando máximo $limit archivos..."
            python "$SCRIPT_DIR/$script" --continuous --limit "$limit" 2>&1 | tee -a "$LOG_FILE"
            ;;
        *)
            print_color "$RED" "❌ Modo no válido: $mode"
            show_usage
            exit 1
            ;;
    esac
    
    # Desactivar entorno virtual
    deactivate
}

# Función para mostrar uso
show_usage() {
    cat << EOF

$(print_color "$CYAN" "📻 AUDIO ANALYSIS RUNNER")
$(print_color "$CYAN" "========================")

$(print_color "$YELLOW" "USO:")
    $0 [COMANDO] [OPCIONES]

$(print_color "$YELLOW" "COMANDOS:")
    test                    Probar con 5 archivos
    batch [workers] [size]  Procesar un batch de archivos
    continuous [workers]    Procesar todos los archivos pendientes
    limited [workers] [max] Procesar con límite máximo
    stats                   Mostrar estadísticas de la BD
    check                   Verificar requisitos del sistema
    help                    Mostrar esta ayuda

$(print_color "$YELLOW" "EJEMPLOS:")
    $0 test                 # Prueba rápida con 5 archivos
    $0 batch 4 100         # Procesar 100 archivos con 4 workers
    $0 continuous 8        # Procesar todo con 8 workers
    $0 limited 4 500       # Procesar máximo 500 archivos
    $0 stats               # Ver estadísticas

$(print_color "$YELLOW" "OPCIONES POR DEFECTO:")
    Workers: 4
    Batch size: 100

$(print_color "$CYAN" "NOTAS:")
    - El script usa librosa (compatible con Mac M1/M2/M3)
    - Procesa archivos FLAC, M4A, MP3, WAV
    - Los logs se guardan en: $LOG_DIR
    - Base de datos: $DB_PATH

EOF
}

# Función para monitoreo en tiempo real
monitor_progress() {
    print_color "$CYAN" "\n📈 Monitoreando progreso en tiempo real..."
    
    while true; do
        clear
        print_color "$CYAN" "🎵 AUDIO ANALYSIS MONITOR"
        print_color "$CYAN" "========================="
        
        # Estadísticas actuales
        local total=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null)
        local analyzed=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_CONFIDENCE > 0.5" 2>/dev/null)
        local pending=$((total - analyzed))
        local percent=$((analyzed * 100 / total))
        
        print_color "$BLUE" "\nProgreso: [$analyzed/$total] ${percent}%"
        
        # Barra de progreso
        local bar_length=50
        local filled=$((percent * bar_length / 100))
        printf "["
        for ((i=0; i<filled; i++)); do printf "="; done
        for ((i=filled; i<bar_length; i++)); do printf " "; done
        printf "]\n"
        
        print_color "$GREEN" "✅ Analizados: $analyzed"
        print_color "$YELLOW" "⏳ Pendientes: $pending"
        
        # Últimos archivos procesados
        print_color "$CYAN" "\n📝 Últimos 5 archivos analizados:"
        sqlite3 "$DB_PATH" -column -header "
            SELECT 
                af.file_name,
                printf('%.1f', lm.AI_LOUDNESS) as Loudness,
                printf('%.2f', lm.AI_DANCEABILITY) as Dance,
                printf('%.2f', lm.AI_VALENCE) as Valence,
                printf('%.0f', lm.AI_BPM) as BPM
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.AI_CONFIDENCE > 0.5
            ORDER BY lm.AI_ANALYZED_DATE DESC
            LIMIT 5
        " 2>/dev/null | head -20
        
        print_color "$YELLOW" "\nPresiona Ctrl+C para salir"
        sleep 5
    done
}

# Función principal
main() {
    print_color "$MAGENTA" "\n╔════════════════════════════════════════╗"
    print_color "$MAGENTA" "║   🎵 AUDIO ANALYSIS RUNNER FOR MAC    ║"
    print_color "$MAGENTA" "║        Compatible con Apple Silicon     ║"
    print_color "$MAGENTA" "╚════════════════════════════════════════╝"
    
    # Procesar comandos
    case "${1:-help}" in
        "test")
            check_requirements
            check_external_drive
            run_analysis "test"
            ;;
        "batch")
            check_requirements
            check_external_drive
            show_db_stats
            run_analysis "batch" "${2:-4}" "${3:-100}"
            ;;
        "continuous")
            check_requirements
            check_external_drive
            show_db_stats
            run_analysis "continuous" "${2:-4}"
            ;;
        "limited")
            check_requirements
            check_external_drive
            show_db_stats
            run_analysis "limited" "${2:-4}" "100" "${3:-1000}"
            ;;
        "stats")
            show_db_stats
            ;;
        "check")
            check_requirements
            check_external_drive
            ;;
        "monitor")
            monitor_progress
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_color "$RED" "❌ Comando no reconocido: $1"
            show_usage
            exit 1
            ;;
    esac
    
    print_color "$GREEN" "\n✨ Proceso completado"
    
    # Mostrar ubicación del log si existe
    if [ -f "$LOG_FILE" ]; then
        print_color "$BLUE" "📄 Log guardado en: $LOG_FILE"
    fi
}

# Trap para limpieza en caso de interrupción
trap 'print_color "$YELLOW" "\n⚠️  Proceso interrumpido por el usuario"; exit 130' INT TERM

# Ejecutar función principal
main "$@"