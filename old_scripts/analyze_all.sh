#!/bin/bash
# =============================================================================
# ANALYZE_ALL.SH - Análisis completo de toda la biblioteca musical
# =============================================================================
# 1. Lee metadatos existentes de MixedInKey
# 2. Calcula con Essentia lo que falte
# 3. Todo automático, sin preguntas

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Configuración
DB_PATH="music_analyzer.db"
MUSIC_DIR="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"
LOG_FILE="analysis_$(date +%Y%m%d_%H%M%S).log"

clear

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}     ${BOLD}🎵 ANÁLISIS COMPLETO DE BIBLIOTECA MUSICAL 🎵${NC}      ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Activar entorno virtual
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo -e "${CYAN}Creando entorno virtual...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install mutagen numpy --quiet
fi

# Instalar dependencias necesarias
echo -e "${CYAN}Verificando dependencias...${NC}"

# Verificar/instalar librosa para archivos m4a
python3 -c "import librosa" 2>/dev/null || {
    echo -e "${YELLOW}Instalando Librosa (para archivos m4a)...${NC}"
    pip install librosa numba --quiet
}

echo -e "${GREEN}✅ Dependencias listas${NC}"

# Estadísticas iniciales
echo -e "${CYAN}📊 Obteniendo estadísticas...${NC}"
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")

echo ""
echo -e "${BOLD}Estado inicial:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED${NC}"
echo -e "  • Por procesar: ${YELLOW}$((TOTAL - ANALYZED))${NC}"
echo ""

# =============================================================================
# PASO 1: IMPORTAR TODOS LOS METADATOS DE MIXEDINKEY
# =============================================================================

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 1: IMPORTANDO METADATOS DE MIXEDINKEY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "read_mixedinkey_metadata.py" ]; then
    echo -e "${GREEN}▶ Leyendo metadatos MixedInKey de TODOS los archivos...${NC}"
    echo -e "${YELLOW}  Esto es muy rápido (~1000 archivos/minuto)${NC}"
    echo ""
    
    python3 read_mixedinkey_metadata.py "$MUSIC_DIR" --save-db 2>&1 | tee -a "$LOG_FILE"
    
    echo ""
    echo -e "${GREEN}✅ Importación de MixedInKey completada${NC}"
else
    echo -e "${YELLOW}⚠️  Script read_mixedinkey_metadata.py no encontrado${NC}"
fi

# Actualizar estadísticas
ANALYZED_AFTER_MIK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
IMPORTED_MIK=$((ANALYZED_AFTER_MIK - ANALYZED))

echo ""
echo -e "${BOLD}Resultados MixedInKey:${NC}"
echo -e "  • Importados: ${GREEN}$IMPORTED_MIK${NC} archivos"
echo -e "  • Total analizados: ${GREEN}$ANALYZED_AFTER_MIK${NC}"
echo -e "  • Restantes: ${YELLOW}$((TOTAL - ANALYZED_AFTER_MIK))${NC}"
echo ""

# =============================================================================
# PASO 2: ANALIZAR CON ESSENTIA LO QUE FALTE
# =============================================================================

REMAINING=$((TOTAL - ANALYZED_AFTER_MIK))

if [ $REMAINING -gt 0 ]; then
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}PASO 2: ANALIZANDO ARCHIVOS RESTANTES CON ESSENTIA${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Archivos sin metadatos MixedInKey: $REMAINING${NC}"
    echo ""
    
    # Usar el analizador híbrido o el wrapper seguro
    if [ -f "essentia_hybrid.py" ]; then
        echo -e "${GREEN}▶ Usando analizador híbrido...${NC}"
        echo -e "${CYAN}  Procesando TODOS los archivos (incluyendo m4a)${NC}"
        python3 essentia_hybrid.py "$MUSIC_DIR" --save-db 2>&1 | tee -a "$LOG_FILE"
    elif [ -f "process_safe.sh" ]; then
        echo -e "${GREEN}▶ Usando procesador seguro...${NC}"
        echo -e "${CYAN}  Procesando TODOS los archivos (incluyendo m4a)${NC}"
        echo -e "${YELLOW}  Los archivos m4a problemáticos usarán Librosa como fallback${NC}"
        ./process_safe.sh -n $REMAINING 2>&1 | tee -a "$LOG_FILE"
    elif [ -f "librosa_fallback.py" ]; then
        echo -e "${GREEN}▶ Usando Librosa para archivos restantes...${NC}"
        echo -e "${CYAN}  Librosa es más compatible con archivos m4a${NC}"
        
        # Obtener archivos no procesados (INCLUYENDO m4a)
        sqlite3 "$DB_PATH" "SELECT af.file_path FROM audio_files af WHERE af.id NOT IN (SELECT file_id FROM llm_metadata WHERE AI_BPM IS NOT NULL)" | \
        while IFS= read -r file_path; do
            if [ -n "$file_path" ]; then
                echo "Procesando: $(basename "$file_path")"
                # Usar Librosa que es más robusto con m4a
                python3 librosa_fallback.py "$file_path" --json /dev/null >> "$LOG_FILE" 2>&1
                
                # Si falla Librosa, intentar con el wrapper seguro
                if [ $? -ne 0 ] && [ -f "essentia_safe_wrapper.py" ]; then
                    python3 essentia_safe_wrapper.py "$file_path" --save-db >> "$LOG_FILE" 2>&1
                fi
            fi
        done
    else
        echo -e "${RED}❌ No hay analizadores disponibles${NC}"
    fi
else
    echo -e "${GREEN}✅ Todos los archivos ya están analizados!${NC}"
fi

# =============================================================================
# ESTADÍSTICAS FINALES
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}📊 ESTADÍSTICAS FINALES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Obtener estadísticas finales
FINAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
FINAL_REMAINING=$((TOTAL - FINAL_ANALYZED))

# Estadísticas detalladas
AVG_BPM=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_BPM), 1) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
AVG_ENERGY=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_ENERGY), 2) FROM llm_metadata WHERE AI_ENERGY IS NOT NULL" 2>/dev/null || echo "0")
TOP_KEY=$(sqlite3 "$DB_PATH" "SELECT AI_KEY, COUNT(*) as cnt FROM llm_metadata WHERE AI_KEY != '' GROUP BY AI_KEY ORDER BY cnt DESC LIMIT 1" 2>/dev/null | cut -d'|' -f1 || echo "N/A")
MIK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_TEMPO_CONFIDENCE = 1.0" 2>/dev/null || echo "0")

echo -e "${BOLD}Resumen:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
echo -e "  • Analizados: ${GREEN}$FINAL_ANALYZED${NC}"
echo -e "  • Sin analizar: ${YELLOW}$FINAL_REMAINING${NC}"
echo -e "  • Progreso: ${GREEN}$((FINAL_ANALYZED * 100 / TOTAL))%${NC}"
echo ""

echo -e "${BOLD}Fuentes de datos:${NC}"
echo -e "  • Desde MixedInKey: ${GREEN}$MIK_COUNT${NC} archivos"
echo -e "  • Desde Essentia: ${GREEN}$((FINAL_ANALYZED - MIK_COUNT))${NC} archivos"
echo ""

echo -e "${BOLD}Análisis musical:${NC}"
echo -e "  • BPM promedio: ${GREEN}$AVG_BPM${NC}"
echo -e "  • Energía promedio: ${GREEN}$AVG_ENERGY${NC}"
echo -e "  • Tonalidad más común: ${GREEN}$TOP_KEY${NC}"
echo ""

# Distribución de BPM
echo -e "${BOLD}Distribución de tempo:${NC}"
sqlite3 "$DB_PATH" "
    SELECT 
        CASE 
            WHEN AI_BPM < 90 THEN '  Lento    (<90 BPM)'
            WHEN AI_BPM < 120 THEN '  Medio    (90-120)'
            WHEN AI_BPM < 140 THEN '  Rápido   (120-140)'
            ELSE '  Muy Rápido (>140)'
        END as rango,
        COUNT(*) as cantidad
    FROM llm_metadata 
    WHERE AI_BPM > 0
    GROUP BY rango
    ORDER BY MIN(AI_BPM)
" | column -t -s '|'

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ ANÁLISIS COMPLETO FINALIZADO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Log guardado en: ${CYAN}$LOG_FILE${NC}"
echo ""

# Exportar resultados
echo -e "${CYAN}Exportando resultados a JSON...${NC}"
EXPORT_FILE="analysis_results_$(date +%Y%m%d_%H%M%S).json"

sqlite3 "$DB_PATH" "
    SELECT json_object(
        'file_name', af.file_name,
        'file_path', af.file_path,
        'artist', af.artist,
        'title', af.title,
        'album', af.album,
        'genre', af.genre,
        'bpm', lm.AI_BPM,
        'key', lm.AI_KEY,
        'energy', lm.AI_ENERGY,
        'danceability', lm.AI_DANCEABILITY,
        'valence', lm.AI_VALENCE,
        'loudness', lm.AI_LOUDNESS
    )
    FROM audio_files af
    LEFT JOIN llm_metadata lm ON af.id = lm.file_id
    WHERE lm.AI_BPM IS NOT NULL
" | jq -s '.' > "$EXPORT_FILE" 2>/dev/null

if [ -f "$EXPORT_FILE" ]; then
    EXPORT_COUNT=$(jq length "$EXPORT_FILE" 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ Exportados $EXPORT_COUNT registros a: $EXPORT_FILE${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Proceso completado exitosamente!${NC}"
echo ""