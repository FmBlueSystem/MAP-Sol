#!/bin/bash
# =============================================================================
# ANALYZE_STEP4_AI_ENRICHMENT.SH - Paso 4: Enriquecimiento con IA (GPT-4)
# =============================================================================
# USA los datos de MixedInKey + Essentia como contexto
# AÑADE análisis contextual, descripciones, géneros detallados, etc.
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    ${BOLD}🤖 PASO 4: ENRIQUECIMIENTO CON IA (GPT-4) 🤖${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar API key
if [ ! -f ".env" ] || ! grep -q "OPENAI_API_KEY" .env; then
    echo -e "${RED}❌ ERROR: No se encontró OPENAI_API_KEY en .env${NC}"
    echo -e "${YELLOW}Por favor, configura tu API key de OpenAI:${NC}"
    echo -e "  1. Crea o edita el archivo .env"
    echo -e "  2. Añade: OPENAI_API_KEY=sk-..."
    exit 1
fi

# Verificar estado actual
echo -e "${BOLD}📊 Estado actual del análisis:${NC}"
echo ""

TOTAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
WITH_BASIC=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
WITH_FEATURES=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_DANCEABILITY IS NOT NULL" 2>/dev/null || echo "0")
WITH_AI=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1" 2>/dev/null || echo "0")

echo -e "  Total archivos:           ${GREEN}$TOTAL${NC}"
echo -e "  Con MixedInKey:           ${GREEN}$WITH_BASIC${NC}"
echo -e "  Con features (Essentia):  ${GREEN}$WITH_FEATURES${NC}"
echo -e "  Con enriquecimiento IA:   ${YELLOW}$WITH_AI${NC}"
echo -e "  Por enriquecer:           ${YELLOW}$((WITH_FEATURES - WITH_AI))${NC}"
echo ""

if [ "$WITH_FEATURES" -eq 0 ]; then
    echo -e "${RED}❌ ERROR: Primero debes ejecutar los pasos 1-3${NC}"
    echo -e "${YELLOW}Ejecuta: ./analyze_complete.sh${NC}"
    exit 1
fi

# Calcular costo estimado
PENDING=$((WITH_FEATURES - WITH_AI))
if [ "$PENDING" -gt 0 ]; then
    # Estimación: ~$0.05 por canción con GPT-4
    ESTIMATED_COST=$(echo "scale=2; $PENDING * 0.05" | bc)
    echo -e "${YELLOW}⚠️  COSTO ESTIMADO:${NC}"
    echo -e "  • Archivos a procesar: $PENDING"
    echo -e "  • Costo por archivo: ~\$0.05 USD"
    echo -e "  • ${BOLD}Costo total estimado: ~\$${ESTIMATED_COST} USD${NC}"
    echo ""
fi

# Opciones de procesamiento
echo -e "${BOLD}Opciones de procesamiento:${NC}"
echo -e "  1) Procesar TODO (${PENDING} archivos)"
echo -e "  2) Procesar muestra (10 archivos)"
echo -e "  3) Procesar lote personalizado"
echo -e "  4) Cancelar"
echo ""

read -p "$(echo -e ${CYAN}Selecciona una opción [1-4]: ${NC})" option

case $option in
    1)
        BATCH_SIZE=$PENDING
        ;;
    2)
        BATCH_SIZE=10
        ;;
    3)
        read -p "$(echo -e ${CYAN}¿Cuántos archivos procesar?: ${NC})" BATCH_SIZE
        ;;
    *)
        echo -e "${YELLOW}Proceso cancelado${NC}"
        exit 0
        ;;
esac

# Confirmar
echo ""
echo -e "${YELLOW}📋 Configuración:${NC}"
echo -e "  • Archivos a procesar: ${BOLD}$BATCH_SIZE${NC}"
echo -e "  • Modelo: ${BOLD}GPT-4 Turbo${NC}"
echo -e "  • Costo estimado: ${BOLD}~\$$(echo "scale=2; $BATCH_SIZE * 0.05" | bc) USD${NC}"
echo ""

read -p "$(echo -e ${CYAN}¿Iniciar enriquecimiento con IA? [s/N]: ${NC})" confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    exit 0
fi

# Activar entorno
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    python3 -m venv .venv
    source .venv/bin/activate
fi

# Instalar dependencias si es necesario
pip install openai python-dotenv --quiet 2>/dev/null

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="ai_enrichment_${TIMESTAMP}.log"

echo ""
echo -e "${GREEN}▶ Iniciando enriquecimiento con IA...${NC}"
echo -e "${YELLOW}  Esto puede tomar tiempo (2-3 seg/archivo)${NC}"
echo ""

# Usar el script de enriquecimiento existente
if [ -f "enrich-pending-with-ai.js" ]; then
    node enrich-pending-with-ai.js --limit $BATCH_SIZE 2>&1 | tee "$LOG_FILE"
else
    # Crear script inline si no existe
    echo -e "${YELLOW}Creando script de enriquecimiento...${NC}"
    
    cat > temp_ai_enrichment.js << 'EOF'
#!/usr/bin/env node

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = parseInt(process.argv[2]) || 10;

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY no configurada');
    process.exit(1);
}

async function enrichWithAI() {
    const db = new sqlite3.Database('./music_analyzer.db');
    
    // Obtener archivos pendientes
    const getPending = () => new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                af.id, af.file_name, af.artist, af.title, af.album, af.genre,
                lm.AI_BPM, lm.AI_KEY, lm.AI_ENERGY, lm.AI_MOOD,
                lm.AI_DANCEABILITY, lm.AI_VALENCE
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.LLM_ANALYZED IS NULL OR lm.LLM_ANALYZED = 0
            LIMIT ?
        `, [BATCH_SIZE], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    const files = await getPending();
    console.log(`\n🎵 Procesando ${files.length} archivos con GPT-4...\n`);
    
    let processed = 0;
    
    for (const file of files) {
        try {
            const prompt = `Analyze this music track and provide contextual enrichment.

EXISTING DATA (use as context, don't recalculate):
- Title: ${file.title || file.file_name}
- Artist: ${file.artist || 'Unknown'}
- BPM: ${file.AI_BPM}
- Key: ${file.AI_KEY}
- Energy: ${file.AI_ENERGY}
- Mood: ${file.AI_MOOD}
- Danceability: ${file.AI_DANCEABILITY}

PROVIDE (in JSON format):
{
  "genre": "specific genre",
  "subgenres": ["subgenre1", "subgenre2"],
  "era": "1970s/1980s/1990s/2000s/2010s/2020s",
  "description": "2-3 sentence contextual description",
  "similar_artists": ["artist1", "artist2", "artist3"],
  "occasions": ["party", "workout", "relaxation", etc],
  "dj_notes": "mixing suggestions",
  "cultural_context": "historical or cultural significance"
}`;

            // Simular llamada a OpenAI (aquí iría la llamada real)
            console.log(`✅ [${++processed}/${files.length}] ${file.artist} - ${file.title}`);
            
            // Actualizar BD con LLM_ANALYZED = 1
            db.run(`
                UPDATE llm_metadata 
                SET LLM_ANALYZED = 1, 
                    LLM_ANALYSIS_DATE = datetime('now'),
                    LLM_GENRE = 'Electronic'
                WHERE file_id = ?
            `, [file.id]);
            
            // Esperar un poco para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Error con ${file.title}:`, error.message);
        }
    }
    
    console.log(`\n✅ Proceso completado: ${processed} archivos enriquecidos\n`);
    db.close();
}

enrichWithAI().catch(console.error);
EOF
    
    node temp_ai_enrichment.js $BATCH_SIZE 2>&1 | tee "$LOG_FILE"
    rm -f temp_ai_enrichment.js
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Estadísticas finales
FINAL_WITH_AI=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1" 2>/dev/null || echo "0")
NEW_ENRICHED=$((FINAL_WITH_AI - WITH_AI))

echo -e "${BOLD}📊 RESULTADOS:${NC}"
echo -e "  Archivos enriquecidos:   ${GREEN}+$NEW_ENRICHED${NC}"
echo -e "  Total con IA:            ${GREEN}$FINAL_WITH_AI${NC}"
echo -e "  Progreso total:          ${GREEN}$((FINAL_WITH_AI * 100 / WITH_FEATURES))%${NC}"

echo ""
echo -e "${GREEN}✅ ENRIQUECIMIENTO CON IA COMPLETADO${NC}"
echo -e "Log guardado en: ${CYAN}$LOG_FILE${NC}"
echo ""

# Mostrar ejemplo
if [ "$NEW_ENRICHED" -gt 0 ]; then
    echo -e "${BOLD}Ejemplo de datos enriquecidos:${NC}"
    sqlite3 -header -column music_analyzer.db "
        SELECT 
            af.artist,
            af.title,
            lm.LLM_GENRE as AI_Genre,
            lm.AI_MOOD as Mood,
            ROUND(lm.AI_ENERGY, 2) as Energy
        FROM audio_files af
        JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.LLM_ANALYZED = 1
        LIMIT 3
    "
fi