#!/bin/bash
# =============================================================================
# ANALYZE_MASTER.SH - Script Maestro de Análisis Híbrido
# =============================================================================
# FLUJO CORRECTO:
# 1. Limpia BD completamente
# 2. Lee metadatos MixedInKey (BPM, Key, Energy)
# 3. Analiza con Essentia/Librosa para features adicionales
#    USANDO los valores de MixedInKey como referencia
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Configuración
DB_PATH="music_analyzer.db"
MUSIC_DIR="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="analysis_master_${TIMESTAMP}.log"

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    ${BOLD}🎵 ANÁLISIS MAESTRO HÍBRIDO - FLUJO COMPLETO 🎵${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}FLUJO DE ANÁLISIS:${NC}"
echo -e "1️⃣  Limpiar base de datos"
echo -e "2️⃣  Importar metadatos MixedInKey (BPM, Key, Energy)"
echo -e "3️⃣  Analizar con Essentia/Librosa (features adicionales)"
echo ""
echo -e "${YELLOW}⚠️  Este proceso analizará TODOS los archivos${NC}"
echo -e "${YELLOW}   Tiempo estimado: 12-24 horas${NC}"
echo ""

# Verificar directorio de música
if [ ! -d "$MUSIC_DIR" ]; then
    echo -e "${RED}❌ Directorio de música no encontrado:${NC}"
    echo -e "   $MUSIC_DIR"
    echo ""
    echo -e "${YELLOW}Por favor, verifica la ruta y vuelve a ejecutar${NC}"
    exit 1
fi

# Contar archivos
TOTAL_FILES=$(find "$MUSIC_DIR" -type f \( -name "*.mp3" -o -name "*.m4a" -o -name "*.flac" -o -name "*.wav" \) | wc -l)
echo -e "${BOLD}Archivos encontrados: ${GREEN}$TOTAL_FILES${NC}"
echo ""

read -p "$(echo -e ${CYAN}¿Iniciar análisis completo desde cero? [s/N]: ${NC})" confirm

if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo -e "${YELLOW}Proceso cancelado${NC}"
    exit 0
fi

# =============================================================================
# PASO 0: PREPARACIÓN
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 0: PREPARACIÓN DEL ENTORNO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Backup de la BD actual
if [ -f "$DB_PATH" ]; then
    BACKUP_FILE="backup_${TIMESTAMP}.db"
    echo -e "${CYAN}💾 Creando backup de BD actual...${NC}"
    cp "$DB_PATH" "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup guardado: $BACKUP_FILE${NC}"
fi

# Activar entorno virtual
if [ ! -d ".venv" ]; then
    echo -e "${CYAN}Creando entorno virtual...${NC}"
    python3 -m venv .venv
fi
source .venv/bin/activate

# Instalar dependencias
echo -e "${CYAN}Instalando dependencias...${NC}"
pip install mutagen numpy librosa numba essentia --quiet 2>/dev/null

echo -e "${GREEN}✅ Entorno preparado${NC}"

# =============================================================================
# PASO 1: LIMPIAR BASE DE DATOS
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 1: LIMPIANDO BASE DE DATOS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Limpiar tabla llm_metadata completamente
sqlite3 "$DB_PATH" "DELETE FROM llm_metadata" 2>/dev/null
sqlite3 "$DB_PATH" "VACUUM" 2>/dev/null

# Verificar limpieza
REMAINING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata" 2>/dev/null || echo "0")

if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ Base de datos limpia${NC}"
else
    echo -e "${RED}❌ Error: quedaron $REMAINING registros${NC}"
    echo -e "${YELLOW}Forzando limpieza...${NC}"
    sqlite3 "$DB_PATH" "DROP TABLE IF EXISTS llm_metadata"
    sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS llm_metadata (
        file_id INTEGER PRIMARY KEY,
        LLM_GENRE TEXT,
        AI_MOOD TEXT,
        LLM_MOOD TEXT,
        AI_ENERGY REAL,
        AI_BPM INTEGER,
        AI_KEY TEXT,
        AI_DANCEABILITY REAL,
        AI_VALENCE REAL,
        AI_ACOUSTICNESS REAL,
        AI_INSTRUMENTALNESS REAL,
        AI_LIVENESS REAL,
        AI_SPEECHINESS REAL,
        AI_LOUDNESS REAL,
        AI_TEMPO_CONFIDENCE REAL,
        AI_KEY_CONFIDENCE REAL,
        FOREIGN KEY (file_id) REFERENCES audio_files(id)
    )"
fi

echo -e "${GREEN}✅ Tabla llm_metadata lista${NC}"

# =============================================================================
# PASO 2: IMPORTAR METADATOS MIXEDINKEY
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 2: IMPORTANDO METADATOS MIXEDINKEY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Leyendo BPM, Key y Energy de archivos...${NC}"
echo -e "${YELLOW}   Velocidad esperada: ~1000 archivos/minuto${NC}"
echo ""

if [ -f "read_mixedinkey_metadata.py" ]; then
    START_TIME=$(date +%s)
    
    # Ejecutar importación de MixedInKey
    python3 read_mixedinkey_metadata.py "$MUSIC_DIR" --save-db 2>&1 | tee -a "$LOG_FILE"
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Estadísticas
    MIK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_TEMPO_CONFIDENCE = 1.0" 2>/dev/null || echo "0")
    
    echo ""
    echo -e "${GREEN}✅ Importación MixedInKey completada${NC}"
    echo -e "   • Archivos con MixedInKey: ${GREEN}$MIK_COUNT${NC}"
    echo -e "   • Tiempo: ${CYAN}$DURATION segundos${NC}"
else
    echo -e "${RED}❌ Script read_mixedinkey_metadata.py no encontrado${NC}"
    exit 1
fi

# =============================================================================
# PASO 3: ANÁLISIS CON ESSENTIA/LIBROSA
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 3: ANÁLISIS COMPLEMENTARIO CON ESSENTIA/LIBROSA${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Calculando features adicionales...${NC}"
echo -e "${YELLOW}   Features: danceability, valence, acousticness, etc.${NC}"
echo -e "${YELLOW}   Velocidad esperada: 2-5 archivos/minuto${NC}"
echo ""

# Usar el script con Essentia + Librosa
if [ -f "analyze_complementary_essentia.py" ]; then
    echo -e "${GREEN}▶ Usando script con Essentia + Librosa...${NC}"
    python3 analyze_complementary_essentia.py 2>&1 | tee -a "$LOG_FILE"
else
    echo -e "${YELLOW}⚠️ Creando script de análisis...${NC}"
    # Crear script de análisis complementario
    cat > analyze_complementary.py << 'EOF'
#!/usr/bin/env python3
"""
Análisis complementario con Essentia/Librosa
USA los valores de MixedInKey como referencia
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)

def analyze_with_librosa(file_path, mik_bpm=None, mik_key=None, mik_energy=None):
    """
    Analiza features adicionales USANDO valores de MixedInKey como referencia
    """
    try:
        import librosa
        
        logger.info(f"Analizando: {Path(file_path).name}")
        
        # Cargar solo 30 segundos para rapidez
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True)
        
        if len(y) == 0:
            return None
        
        # === USAR VALORES DE MIXEDINKEY ===
        
        # Si tenemos BPM de MixedInKey, úsalo
        if mik_bpm and mik_bpm > 0:
            bpm = mik_bpm  # Usar el de MixedInKey
            tempo_confidence = 1.0
        else:
            # Solo calcular si no hay de MixedInKey
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo)
            tempo_confidence = 0.8
        
        # Si tenemos Key de MixedInKey, úsalo
        if mik_key:
            key = mik_key  # Usar el de MixedInKey
            key_confidence = 1.0
        else:
            # Solo calcular si no hay de MixedInKey
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            key_idx = np.argmax(chroma_mean)
            key = pitch_classes[key_idx]
            key_confidence = 0.5
        
        # Si tenemos Energy de MixedInKey, úsalo
        if mik_energy is not None and mik_energy > 0:
            energy = mik_energy  # Usar el de MixedInKey
        else:
            # Solo calcular si no hay de MixedInKey
            rms = librosa.feature.rms(y=y)
            energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # === CALCULAR FEATURES ADICIONALES ===
        
        # Danceability (basado en el BPM de MixedInKey)
        if 115 <= bpm <= 135:  # Rango óptimo para bailar
            danceability = 0.8 + (energy * 0.2)
        elif 100 <= bpm <= 150:
            danceability = 0.6 + (energy * 0.2)
        else:
            danceability = 0.4 + (energy * 0.1)
        danceability = float(np.clip(danceability, 0, 1))
        
        # Valence (positividad) - basado en modo y energía
        if 'major' in str(key).lower() or 'A' in str(key):
            valence = 0.6 + (energy * 0.3)
        else:
            valence = 0.3 + (energy * 0.2)
        valence = float(np.clip(valence, 0, 1))
        
        # Acousticness (características espectrales)
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        
        # Instrumentalness (detección de voces)
        zcr = librosa.feature.zero_crossing_rate(y)
        instrumentalness = 1.0 - np.clip(np.mean(zcr) * 2, 0, 1)
        
        # Speechiness (detección de habla)
        speechiness = np.clip(np.mean(zcr) * 0.5, 0, 0.3)
        
        # Liveness (detección de audiencia/reverb)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        liveness = np.clip((np.std(spectral_rolloff) / 1000) * 0.2, 0, 0.5)
        
        # Loudness
        rms = librosa.feature.rms(y=y)
        rms_db = librosa.amplitude_to_db(np.mean(rms))
        loudness = float(np.clip(rms_db, -60, 0))
        
        return {
            'bpm': bpm,
            'key': key,
            'energy': energy,
            'danceability': danceability,
            'valence': valence,
            'acousticness': float(acousticness),
            'instrumentalness': float(instrumentalness),
            'speechiness': float(speechiness),
            'liveness': float(liveness),
            'loudness': loudness,
            'tempo_confidence': tempo_confidence,
            'key_confidence': key_confidence
        }
        
    except Exception as e:
        logger.error(f"Error analizando {Path(file_path).name}: {e}")
        return None

def main():
    db_path = 'music_analyzer.db'
    
    # Obtener archivos con sus metadatos MixedInKey
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT af.id, af.file_path, 
               lm.AI_BPM, lm.AI_KEY, lm.AI_ENERGY
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        ORDER BY af.id
    ''')
    
    files = cursor.fetchall()
    conn.close()
    
    total = len(files)
    logger.info(f"Archivos a procesar: {total}")
    logger.info("=" * 60)
    
    success = 0
    errors = 0
    
    for i, (file_id, file_path, mik_bpm, mik_key, mik_energy) in enumerate(files, 1):
        file_name = Path(file_path).name
        
        # Mostrar qué datos tenemos de MixedInKey
        if mik_bpm:
            print(f"[{i}/{total}] {file_name}")
            print(f"  MixedInKey: BPM={mik_bpm}, Key={mik_key}, Energy={mik_energy:.2f}")
        else:
            print(f"[{i}/{total}] {file_name} (sin MixedInKey)")
        
        # Analizar con Librosa USANDO valores de MixedInKey
        features = analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy)
        
        if features:
            # Actualizar BD con features adicionales
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            if mik_bpm:  # Si ya existe registro, actualizar
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_DANCEABILITY = ?, AI_VALENCE = ?,
                        AI_ACOUSTICNESS = ?, AI_INSTRUMENTALNESS = ?,
                        AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                        AI_LOUDNESS = ?
                    WHERE file_id = ?
                ''', (
                    features['danceability'],
                    features['valence'],
                    features['acousticness'],
                    features['instrumentalness'],
                    features['liveness'],
                    features['speechiness'],
                    features['loudness'],
                    file_id
                ))
            else:  # Si no existe, insertar completo
                cursor.execute('''
                    INSERT OR REPLACE INTO llm_metadata (
                        file_id, AI_BPM, AI_KEY, AI_ENERGY,
                        AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                        AI_LOUDNESS, AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_id,
                    features['bpm'],
                    features['key'],
                    features['energy'],
                    features['danceability'],
                    features['valence'],
                    features['acousticness'],
                    features['instrumentalness'],
                    features['liveness'],
                    features['speechiness'],
                    features['loudness'],
                    features['tempo_confidence'],
                    features['key_confidence']
                ))
            
            conn.commit()
            conn.close()
            
            print(f"  ✓ Features: Dance={features['danceability']:.2f}, Val={features['valence']:.2f}")
            success += 1
        else:
            errors += 1
            print(f"  ✗ Error procesando")
        
        # Progreso cada 100 archivos
        if i % 100 == 0:
            logger.info(f"Progreso: {i}/{total} ({i*100/total:.1f}%)")
    
    print("\n" + "=" * 60)
    print(f"RESULTADOS FINALES:")
    print(f"  • Procesados: {success}")
    print(f"  • Errores: {errors}")
    print(f"  • Total: {total}")

if __name__ == '__main__':
    main()
EOF

    echo -e "${GREEN}▶ Ejecutando análisis complementario...${NC}"
    echo -e "${YELLOW}  Esto tomará varias horas...${NC}"
    echo ""
fi

START_TIME=$(date +%s)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$((DURATION / 3600))
MINUTES=$(((DURATION % 3600) / 60))

# =============================================================================
# ESTADÍSTICAS FINALES
# =============================================================================

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}📊 ESTADÍSTICAS FINALES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Obtener estadísticas
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
WITH_FEATURES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_DANCEABILITY IS NOT NULL" 2>/dev/null || echo "0")
AVG_BPM=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_BPM), 1) FROM llm_metadata WHERE AI_BPM > 0" 2>/dev/null || echo "0")
AVG_ENERGY=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_ENERGY), 2) FROM llm_metadata WHERE AI_ENERGY IS NOT NULL" 2>/dev/null || echo "0")
AVG_DANCE=$(sqlite3 "$DB_PATH" "SELECT ROUND(AVG(AI_DANCEABILITY), 2) FROM llm_metadata WHERE AI_DANCEABILITY IS NOT NULL" 2>/dev/null || echo "0")

echo -e "${BOLD}Resumen del análisis:${NC}"
echo -e "  • Total archivos:        ${GREEN}$TOTAL${NC}"
echo -e "  • Con metadatos básicos: ${GREEN}$ANALYZED${NC}"
echo -e "  • Con features completos:${GREEN}$WITH_FEATURES${NC}"
echo -e "  • Tiempo total:          ${CYAN}${HOURS}h ${MINUTES}m${NC}"
echo ""

echo -e "${BOLD}Promedios musicales:${NC}"
echo -e "  • BPM promedio:          ${GREEN}$AVG_BPM${NC}"
echo -e "  • Energía promedio:      ${GREEN}$AVG_ENERGY${NC}"
echo -e "  • Danceability promedio: ${GREEN}$AVG_DANCE${NC}"
echo ""

# Distribución de tempo
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
echo -e "${GREEN}✅ ANÁLISIS MAESTRO COMPLETADO EXITOSAMENTE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Log completo guardado en: ${CYAN}$LOG_FILE${NC}"
echo ""

# Limpiar archivos temporales
rm -f analyze_complementary.py .last_count

echo -e "${GREEN}🎉 ¡Tu biblioteca musical está completamente analizada!${NC}"
echo ""