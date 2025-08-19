#!/bin/bash
# =============================================================================
# START_ANALYSIS.SH - Sistema Híbrido MixedInKey + Essentia v3.0
# =============================================================================
# Usa metadatos existentes de MixedInKey, con Essentia como fallback
# Incluye manejo de segmentation faults y procesamiento robusto

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Configuración
DB_PATH="music_analyzer.db"
LOG_DIR="essentia_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/analysis_${TIMESTAMP}.log"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}🎵 MUSIC ANALYZER PRO - SISTEMA HÍBRIDO v3.0${NC}      ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar dependencias
echo -e "${CYAN}🔍 Verificando dependencias...${NC}"

# Verificar entorno virtual
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  No se encuentra el entorno virtual${NC}"
    echo -e "${CYAN}Creando entorno virtual...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install mutagen numpy
    # Intentar instalar librosa como fallback
    pip install librosa numba --quiet
else
    source .venv/bin/activate
fi

# Verificar scripts necesarios
SCRIPTS_OK=true
MISSING_SCRIPTS=""

# Scripts principales
for script in "essentia_hybrid.py" "read_mixedinkey_metadata.py" "essentia_safe_wrapper.py" "librosa_fallback.py" "process_safe.sh"; do
    if [ ! -f "$script" ]; then
        SCRIPTS_OK=false
        MISSING_SCRIPTS="$MISSING_SCRIPTS $script"
    else
        chmod +x "$script" 2>/dev/null
    fi
done

if [ "$SCRIPTS_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Scripts faltantes:${MISSING_SCRIPTS}${NC}"
    echo -e "${YELLOW}   Usando modo compatibilidad${NC}"
    SAFE_MODE=false
else
    SAFE_MODE=true
    echo -e "${GREEN}✅ Todos los scripts disponibles${NC}"
fi

# Verificar si hay metadatos de MixedInKey
MIK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_TEMPO_CONFIDENCE = 1.0" 2>/dev/null || echo "0")
if [ $MIK_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Metadatos MixedInKey detectados: $MIK_COUNT archivos${NC}"
    HAS_MIK=true
else
    HAS_MIK=false
fi

# Obtener estadísticas actuales
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
REMAINING=$((TOTAL - ANALYZED))

# Calcular progreso
if [ $TOTAL -gt 0 ]; then
    PROGRESS=$((ANALYZED * 100 / TOTAL))
else
    PROGRESS=0
fi

echo -e "${GREEN}✅ Sistema listo${NC}"
echo ""
echo -e "${BOLD}📊 Estado Actual:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED${NC}"
echo -e "  • Por procesar: ${YELLOW}$REMAINING${NC}"
echo -e "  • Progreso: ${GREEN}${PROGRESS}%${NC}"

# Barra de progreso visual
echo -ne "  ["
for ((i=0; i<50; i++)); do
    if [ $i -lt $((PROGRESS / 2)) ]; then
        echo -ne "█"
    else
        echo -ne "░"
    fi
done
echo -e "]"
echo ""

# Menú de opciones
echo -e "${BOLD}📋 MENÚ PRINCIPAL${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${BOLD}1)${NC} 🎯 Importar metadatos MixedInKey existentes"
echo -e "  ${BOLD}2)${NC} 🚀 Análisis Híbrido Rápido (100 archivos)"
echo -e "  ${BOLD}3)${NC} 📊 Análisis Híbrido Estándar (500 archivos)"
echo -e "  ${BOLD}4)${NC} 💪 Análisis Híbrido Completo (todos)"
echo -e "  ${BOLD}5)${NC} 🎨 Análisis Personalizado"
echo -e "  ${BOLD}6)${NC} 🛡️  Análisis Seguro (omitir m4a problemáticos)"
echo -e "  ${BOLD}7)${NC} 🔄 Reprocesar archivos con errores"
echo -e "  ${BOLD}8)${NC} 🔁 REANALIZAR TODO (desde cero)"
echo -e "  ${BOLD}9)${NC} 📈 Ver estadísticas detalladas"
echo -e "  ${BOLD}10)${NC} 💾 Exportar resultados"
echo -e "  ${BOLD}11)${NC} ℹ️  Información del sistema"
echo -e "  ${BOLD}0)${NC} 🚪 Salir"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

read -p "$(echo -e ${YELLOW}Selecciona una opción [0-11]: ${NC})" option

case $option in
    1)
        echo ""
        echo -e "${CYAN}🎯 IMPORTANDO METADATOS DE MIXEDINKEY${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${YELLOW}Esta opción importa TODOS los metadatos existentes${NC}"
        echo -e "${YELLOW}de MixedInKey (BPM, Key, Energy) sin recalcular.${NC}"
        echo ""
        echo -e "${GREEN}Ventajas:${NC}"
        echo -e "  • Muy rápido (~1000 archivos/minuto)"
        echo -e "  • Usa datos precisos de MixedInKey"
        echo -e "  • No consume CPU"
        echo ""
        read -p "$(echo -e ${CYAN}¿Importar metadatos MixedInKey? [s/N]: ${NC})" confirm
        
        if [[ "$confirm" =~ ^[Ss]$ ]]; then
            echo ""
            echo -e "${GREEN}▶ Importando metadatos MixedInKey...${NC}"
            
            # Usar script de lectura de MixedInKey
            if [ -f "read_mixedinkey_metadata.py" ]; then
                python3 read_mixedinkey_metadata.py "/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks" --save-db
            else
                echo -e "${RED}❌ Script read_mixedinkey_metadata.py no encontrado${NC}"
            fi
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    2)
        echo ""
        echo -e "${GREEN}▶ Iniciando análisis estándar (500 archivos)...${NC}"
        echo ""
        
        if [ "$SAFE_MODE" = true ]; then
            ./process_safe.sh -n 500
        else
            ./run_essentia_safe.sh -n 500 --strategy smart60
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    3)
        echo ""
        if [ $REMAINING -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Se procesarán $REMAINING archivos${NC}"
            echo -e "${YELLOW}   Esto puede tomar varias horas${NC}"
            echo ""
            read -p "$(echo -e ${CYAN}¿Continuar? [s/N]: ${NC})" confirm
            
            if [[ "$confirm" =~ ^[Ss]$ ]]; then
                echo ""
                echo -e "${GREEN}▶ Iniciando análisis completo...${NC}"
                
                # Abrir monitor en nueva ventana (macOS)
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    osascript -e "tell app \"Terminal\" to do script \"cd $(pwd) && watch -n 5 'sqlite3 music_analyzer.db \\\"SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL\\\"'\""
                fi
                
                if [ "$SAFE_MODE" = true ]; then
                    ./process_safe.sh -n $REMAINING
                else
                    ./process_remaining.sh
                fi
            fi
        else
            echo -e "${GREEN}✅ Todos los archivos ya están analizados!${NC}"
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    4)
        echo ""
        read -p "$(echo -e ${CYAN}¿Cuántos archivos quieres analizar? ${NC})" num
        
        if [[ "$num" =~ ^[0-9]+$ ]]; then
            echo ""
            echo -e "${GREEN}▶ Analizando $num archivos...${NC}"
            
            if [ "$SAFE_MODE" = true ]; then
                ./process_safe.sh -n "$num"
            else
                ./run_essentia_safe.sh -n "$num" --strategy smart60
            fi
        else
            echo -e "${RED}❌ Número inválido${NC}"
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    5)
        echo ""
        echo -e "${CYAN}🛡️  Modo Seguro - Omitiendo archivos m4a problemáticos${NC}"
        echo ""
        read -p "$(echo -e ${CYAN}¿Cuántos archivos procesar? [100]: ${NC})" num
        num=${num:-100}
        
        echo ""
        echo -e "${GREEN}▶ Procesando $num archivos (modo seguro)...${NC}"
        
        if [ "$SAFE_MODE" = true ]; then
            ./process_safe.sh -n "$num" --skip-m4a
        else
            echo -e "${YELLOW}⚠️  Scripts de seguridad no disponibles${NC}"
            ./run_essentia_safe.sh -n "$num" --strategy smart60
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    6)
        echo ""
        echo -e "${CYAN}🔄 Buscando archivos con errores...${NC}"
        
        # Buscar el log de errores más reciente
        ERROR_LOG=$(ls -t "$LOG_DIR"/errors_*.log 2>/dev/null | head -1)
        
        if [ -n "$ERROR_LOG" ] && [ -f "$ERROR_LOG" ]; then
            ERROR_COUNT=$(wc -l < "$ERROR_LOG")
            echo -e "${YELLOW}Encontrados $ERROR_COUNT archivos con errores${NC}"
            echo ""
            read -p "$(echo -e ${CYAN}¿Reprocesar con Librosa? [s/N]: ${NC})" confirm
            
            if [[ "$confirm" =~ ^[Ss]$ ]]; then
                while IFS= read -r file_path; do
                    if [ -n "$file_path" ]; then
                        echo -ne "  Procesando: $(basename "$file_path")... "
                        python3 librosa_fallback.py "$file_path" >> "$LOG_FILE" 2>&1
                        if [ $? -eq 0 ]; then
                            echo -e "${GREEN}✓${NC}"
                        else
                            echo -e "${RED}✗${NC}"
                        fi
                    fi
                done < "$ERROR_LOG"
            fi
        else
            echo -e "${GREEN}✅ No hay archivos con errores${NC}"
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    7)
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                    ⚠️  ADVERTENCIA ⚠️                        ║${NC}"
        echo -e "${RED}║                                                            ║${NC}"
        echo -e "${RED}║  Esta opción ELIMINARÁ todos los análisis existentes      ║${NC}"
        echo -e "${RED}║  y volverá a analizar TODOS los archivos desde cero.      ║${NC}"
        echo -e "${RED}║                                                            ║${NC}"
        echo -e "${RED}║  Archivos a reanalizar: ${YELLOW}$TOTAL${RED}                         ║${NC}"
        echo -e "${RED}║  Tiempo estimado: ${YELLOW}$(($TOTAL * 2 / 60)) horas${RED}                        ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${YELLOW}¿Estás seguro de que quieres reanalizar TODO?${NC}"
        echo -e "${YELLOW}Esta acción no se puede deshacer.${NC}"
        echo ""
        read -p "$(echo -e ${RED}Escribe 'CONFIRMAR' para continuar: ${NC})" confirm
        
        if [ "$confirm" = "CONFIRMAR" ]; then
            echo ""
            echo -e "${CYAN}🗑️  Limpiando análisis anteriores...${NC}"
            
            # Hacer backup primero
            BACKUP_FILE="backup_llm_metadata_${TIMESTAMP}.sql"
            echo -e "${CYAN}💾 Creando backup en $BACKUP_FILE...${NC}"
            sqlite3 "$DB_PATH" ".dump llm_metadata" > "$BACKUP_FILE"
            
            # Limpiar tabla llm_metadata
            sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
            
            echo -e "${GREEN}✅ Análisis anteriores eliminados${NC}"
            echo -e "${CYAN}📊 Verificando...${NC}"
            
            # Verificar que se limpió
            CLEANED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL")
            echo -e "  • Análisis restantes: ${GREEN}$CLEANED${NC} (debe ser 0)"
            echo ""
            
            echo -e "${YELLOW}Selecciona el método de reanálisis:${NC}"
            echo -e "  1) Análisis estándar (con Essentia)"
            echo -e "  2) Análisis seguro (omitir m4a problemáticos)"
            echo -e "  3) Análisis con Librosa solamente"
            echo ""
            read -p "Opción [1-3]: " reanalyze_method
            
            case $reanalyze_method in
                1)
                    echo -e "${GREEN}▶ Iniciando reanálisis completo con Essentia...${NC}"
                    if [ "$SAFE_MODE" = true ]; then
                        ./process_safe.sh -n $TOTAL
                    else
                        ./run_essentia_safe.sh -n $TOTAL --strategy smart60
                    fi
                    ;;
                2)
                    echo -e "${GREEN}▶ Iniciando reanálisis seguro (sin m4a)...${NC}"
                    if [ "$SAFE_MODE" = true ]; then
                        ./process_safe.sh -n $TOTAL --skip-m4a
                    else
                        echo -e "${YELLOW}⚠️  Modo seguro no disponible, usando estándar${NC}"
                        ./run_essentia_safe.sh -n $TOTAL --strategy smart60
                    fi
                    ;;
                3)
                    echo -e "${GREEN}▶ Iniciando reanálisis con Librosa...${NC}"
                    # Procesar todos con librosa
                    FILES=$(sqlite3 "$DB_PATH" "SELECT file_path FROM audio_files")
                    COUNTER=0
                    TOTAL_COUNT=$(echo "$FILES" | wc -l)
                    
                    echo "$FILES" | while IFS= read -r file_path; do
                        if [ -n "$file_path" ]; then
                            ((COUNTER++))
                            PERCENT=$((COUNTER * 100 / TOTAL_COUNT))
                            printf "[%4d/%4d] %3d%% - " "$COUNTER" "$TOTAL_COUNT" "$PERCENT"
                            
                            python3 librosa_fallback.py "$file_path" >> "$LOG_FILE" 2>&1
                            if [ $? -eq 0 ]; then
                                echo -e "$(basename "$file_path") ${GREEN}✓${NC}"
                            else
                                echo -e "$(basename "$file_path") ${RED}✗${NC}"
                            fi
                        fi
                    done
                    ;;
                *)
                    echo -e "${RED}Opción inválida. Cancelando...${NC}"
                    ;;
            esac
            
            echo ""
            echo -e "${GREEN}✅ Reanálisis completado${NC}"
            
            # Mostrar nuevas estadísticas
            NEW_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL")
            echo -e "${CYAN}📊 Resultados:${NC}"
            echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
            echo -e "  • Analizados: ${GREEN}$NEW_ANALYZED${NC}"
            echo -e "  • Backup guardado en: ${CYAN}$BACKUP_FILE${NC}"
        else
            echo ""
            echo -e "${YELLOW}Operación cancelada${NC}"
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    8)
        echo ""
        echo -e "${BOLD}📊 ESTADÍSTICAS DETALLADAS${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # BPM distribution
        echo -e "\n${BOLD}🎵 Distribución de BPM:${NC}"
        sqlite3 "$DB_PATH" "
            SELECT 
                CASE 
                    WHEN AI_BPM < 90 THEN '  Lento    (<90 BPM)'
                    WHEN AI_BPM < 120 THEN '  Medio    (90-120)'
                    WHEN AI_BPM < 140 THEN '  Rápido   (120-140)'
                    ELSE '  Muy Rápido (>140)'
                END as rango,
                printf('%5d', COUNT(*)) as cantidad,
                printf('%3d%%', COUNT(*) * 100 / (SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM > 0)) as porcentaje
            FROM llm_metadata 
            WHERE AI_BPM > 0
            GROUP BY rango
            ORDER BY MIN(AI_BPM)
        " | column -t -s '|'
        
        # Energy distribution
        echo -e "\n${BOLD}⚡ Distribución de Energía:${NC}"
        sqlite3 "$DB_PATH" "
            SELECT 
                CASE 
                    WHEN AI_ENERGY < 0.3 THEN '  Baja     (<0.3)'
                    WHEN AI_ENERGY < 0.6 THEN '  Media    (0.3-0.6)'
                    WHEN AI_ENERGY < 0.8 THEN '  Alta     (0.6-0.8)'
                    ELSE '  Muy Alta (>0.8)'
                END as nivel,
                printf('%5d', COUNT(*)) as cantidad,
                printf('%3d%%', COUNT(*) * 100 / (SELECT COUNT(*) FROM llm_metadata WHERE AI_ENERGY IS NOT NULL)) as porcentaje
            FROM llm_metadata 
            WHERE AI_ENERGY IS NOT NULL
            GROUP BY nivel
            ORDER BY MIN(AI_ENERGY)
        " | column -t -s '|'
        
        # Key distribution
        echo -e "\n${BOLD}🎼 Tonalidades más comunes:${NC}"
        sqlite3 "$DB_PATH" "
            SELECT 
                printf('  %-10s', AI_KEY) as tonalidad,
                printf('%5d', COUNT(*)) as cantidad,
                printf('%3d%%', COUNT(*) * 100 / (SELECT COUNT(*) FROM llm_metadata WHERE AI_KEY != '')) as porcentaje
            FROM llm_metadata 
            WHERE AI_KEY != ''
            GROUP BY AI_KEY
            ORDER BY COUNT(*) DESC
            LIMIT 10
        " | column -t -s '|'
        
        # Top 10 most energetic
        echo -e "\n${BOLD}🔥 Top 10 Más Energéticos:${NC}"
        sqlite3 "$DB_PATH" "
            SELECT 
                printf('  %2d.', ROW_NUMBER() OVER (ORDER BY lm.AI_ENERGY DESC)) as pos,
                SUBSTR(af.file_name, 1, 40) as archivo,
                printf('%.3f', lm.AI_ENERGY) as energia,
                printf('%3.0f', lm.AI_BPM) as bpm
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.AI_ENERGY IS NOT NULL
            ORDER BY lm.AI_ENERGY DESC
            LIMIT 10
        " | column -t -s '|'
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    9)
        echo ""
        EXPORT_FILE="essentia_export_${TIMESTAMP}.json"
        echo -e "${CYAN}💾 Exportando resultados a $EXPORT_FILE...${NC}"
        
        sqlite3 "$DB_PATH" "
            SELECT json_object(
                'file_name', af.file_name,
                'file_path', af.file_path,
                'artist', af.artist,
                'title', af.title,
                'album', af.album,
                'bpm', lm.AI_BPM,
                'key', lm.AI_KEY,
                'energy', lm.AI_ENERGY,
                'danceability', lm.AI_DANCEABILITY,
                'valence', lm.AI_VALENCE,
                'acousticness', lm.AI_ACOUSTICNESS,
                'instrumentalness', lm.AI_INSTRUMENTALNESS,
                'liveness', lm.AI_LIVENESS,
                'speechiness', lm.AI_SPEECHINESS,
                'loudness', lm.AI_LOUDNESS
            )
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.AI_BPM IS NOT NULL
        " | jq -s '.' > "$EXPORT_FILE" 2>/dev/null || echo "[]" > "$EXPORT_FILE"
        
        EXPORT_COUNT=$(jq length "$EXPORT_FILE" 2>/dev/null || echo "0")
        echo -e "${GREEN}✅ Exportados $EXPORT_COUNT registros a $EXPORT_FILE${NC}"
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    10)
        echo ""
        echo -e "${BOLD}ℹ️  INFORMACIÓN DEL SISTEMA${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # Python version
        PYTHON_VERSION=$(python3 --version 2>&1)
        echo -e "  🐍 Python: ${GREEN}$PYTHON_VERSION${NC}"
        
        # Check Essentia
        ESSENTIA_STATUS=$(python3 -c "import essentia; print('Instalado')" 2>/dev/null || echo "No disponible")
        echo -e "  🎵 Essentia: ${GREEN}$ESSENTIA_STATUS${NC}"
        
        # Check Librosa
        LIBROSA_VERSION=$(python3 -c "import librosa; print(f'v{librosa.__version__}')" 2>/dev/null || echo "No instalado")
        echo -e "  🎶 Librosa: ${GREEN}$LIBROSA_VERSION${NC}"
        
        # Database size
        if [ -f "$DB_PATH" ]; then
            DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
            echo -e "  💾 Base de datos: ${GREEN}$DB_SIZE${NC}"
        fi
        
        # Log files
        LOG_COUNT=$(ls "$LOG_DIR"/*.log 2>/dev/null | wc -l)
        echo -e "  📄 Archivos de log: ${GREEN}$LOG_COUNT${NC}"
        
        # Disk space
        DISK_USAGE=$(df -h . | awk 'NR==2 {print $4 " disponibles"}')
        echo -e "  💿 Espacio en disco: ${GREEN}$DISK_USAGE${NC}"
        
        echo ""
        echo -e "${BOLD}📁 Formatos de audio soportados:${NC}"
        echo -e "  ${GREEN}mp3, m4a, flac, wav, ogg, aiff, aif${NC}"
        
        if [ "$SAFE_MODE" = true ]; then
            echo ""
            echo -e "${GREEN}✅ Modo seguro disponible${NC}"
            echo -e "  • Wrapper de protección contra crashes"
            echo -e "  • Fallback a Librosa"
            echo -e "  • Procesamiento robusto"
        fi
        
        echo ""
        read -p "$(echo -e ${YELLOW}Presiona Enter para continuar...${NC})"
        exec "$0"
        ;;
        
    0|q|Q)
        echo ""
        echo -e "${GREEN}👋 ¡Hasta luego!${NC}"
        echo ""
        exit 0
        ;;
        
    *)
        echo -e "${RED}❌ Opción no válida${NC}"
        sleep 2
        exec "$0"
        ;;
esac