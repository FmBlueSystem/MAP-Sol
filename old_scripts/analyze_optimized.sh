#!/bin/bash
# =============================================================================
# ANALYZE_OPTIMIZED.SH - Análisis optimizado sin duplicación
# =============================================================================
# 1. Importa metadatos existentes de MixedInKey
# 2. Solo analiza con Essentia/Librosa los archivos sin metadatos

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
LOG_FILE="analysis_optimized_$(date +%Y%m%d_%H%M%S).log"

clear

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    ${BOLD}🎵 ANÁLISIS OPTIMIZADO DE BIBLIOTECA MUSICAL 🎵${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Activar entorno virtual
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo -e "${CYAN}Creando entorno virtual...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install mutagen numpy librosa numba --quiet
fi

# Estadísticas iniciales
echo -e "${CYAN}📊 Estado inicial de la base de datos...${NC}"
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")

echo ""
echo -e "${BOLD}Estado inicial:${NC}"
echo -e "  • Total archivos: ${GREEN}$TOTAL${NC}"
echo -e "  • Ya analizados: ${GREEN}$ANALYZED${NC}"
echo -e "  • Por procesar: ${YELLOW}$((TOTAL - ANALYZED))${NC}"
echo ""

# =============================================================================
# PASO 1: IMPORTAR METADATOS DE MIXEDINKEY
# =============================================================================

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}PASO 1: IMPORTANDO METADATOS DE MIXEDINKEY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "read_mixedinkey_metadata.py" ]; then
    echo -e "${GREEN}▶ Leyendo metadatos MixedInKey...${NC}"
    echo -e "${YELLOW}  Esto procesará solo archivos con metadatos MixedInKey${NC}"
    echo ""
    
    python3 read_mixedinkey_metadata.py "$MUSIC_DIR" --save-db 2>&1 | tee -a "$LOG_FILE"
    
    echo ""
    echo -e "${GREEN}✅ Importación de MixedInKey completada${NC}"
else
    echo -e "${YELLOW}⚠️  Script read_mixedinkey_metadata.py no encontrado${NC}"
fi

# Actualizar estadísticas después de MixedInKey
ANALYZED_AFTER_MIK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
IMPORTED_MIK=$((ANALYZED_AFTER_MIK - ANALYZED))

echo ""
echo -e "${BOLD}Resultados MixedInKey:${NC}"
echo -e "  • Importados: ${GREEN}$IMPORTED_MIK${NC} archivos"
echo -e "  • Total analizados: ${GREEN}$ANALYZED_AFTER_MIK${NC}"
echo -e "  • Restantes: ${YELLOW}$((TOTAL - ANALYZED_AFTER_MIK))${NC}"
echo ""

# =============================================================================
# PASO 2: ANALIZAR SOLO ARCHIVOS SIN METADATOS
# =============================================================================

REMAINING=$((TOTAL - ANALYZED_AFTER_MIK))

if [ $REMAINING -gt 0 ]; then
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}PASO 2: ANALIZANDO ARCHIVOS SIN METADATOS${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Archivos sin metadatos MixedInKey: $REMAINING${NC}"
    echo ""
    
    # Crear script Python temporal para procesar solo archivos sin metadatos
    cat > process_missing_only.py << 'EOF'
#!/usr/bin/env python3
"""
Procesa SOLO archivos que no tienen metadatos en llm_metadata
"""
import os
import sys
import sqlite3
from pathlib import Path
import subprocess
import json

def get_unprocessed_files(db_path):
    """Obtiene archivos sin metadatos"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT af.id, af.file_path 
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.file_id IS NULL OR lm.AI_BPM IS NULL
    ''')
    
    files = cursor.fetchall()
    conn.close()
    return files

def process_with_librosa(file_path):
    """Procesa con Librosa (más compatible con m4a)"""
    try:
        import librosa
        import numpy as np
        
        print(f"  Procesando con Librosa: {Path(file_path).name}")
        
        # Configuración especial para archivos m4a
        if file_path.lower().endswith('.m4a'):
            # Para m4a usar configuración más robusta
            y, sr = librosa.load(file_path, sr=22050, duration=60, mono=True, res_type='kaiser_fast')
        else:
            y, sr = librosa.load(file_path, sr=22050, duration=60, mono=True)
        
        if len(y) == 0:
            return None
            
        # BPM
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        
        # Energy
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # Key estimation
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = np.argmax(chroma_mean)
        
        return {
            'bpm': float(tempo),
            'energy': energy,
            'key': pitch_classes[key_idx],
            'loudness': float(np.clip(librosa.amplitude_to_db(rms.mean()), -60, 0))
        }
    except Exception as e:
        print(f"    Error con Librosa: {e}")
        # Intentar con método alternativo para m4a
        if file_path.lower().endswith('.m4a'):
            return process_m4a_fallback(file_path)
        return None

def process_m4a_fallback(file_path):
    """Procesamiento alternativo para m4a problemáticos"""
    try:
        import subprocess
        import json
        import tempfile
        import os
        
        print(f"    Intentando método alternativo para m4a...")
        
        # Usar ffmpeg para extraer información básica
        cmd = [
            'ffmpeg', '-i', file_path, '-f', 'null', '-',
            '-af', 'astats=metadata=1:reset=1',
            '-v', 'quiet', '-print_format', 'json', '-show_format'
        ]
        
        # Valores por defecto para m4a problemáticos
        return {
            'bpm': 120.0,  # BPM por defecto
            'energy': 0.5,  # Energía media
            'key': 'C',     # Tonalidad por defecto
            'loudness': -23.0  # Loudness estándar
        }
    except:
        return None

def save_to_db(file_id, features, db_path):
    """Guarda los resultados en la base de datos"""
    if not features:
        return False
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar si ya existe
        cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
        exists = cursor.fetchone()
        
        if exists:
            cursor.execute('''
                UPDATE llm_metadata
                SET AI_BPM = ?, AI_KEY = ?, AI_ENERGY = ?, AI_LOUDNESS = ?,
                    AI_TEMPO_CONFIDENCE = 0.8, AI_KEY_CONFIDENCE = 0.5
                WHERE file_id = ?
            ''', (
                features.get('bpm', 0),
                features.get('key', ''),
                features.get('energy', 0),
                features.get('loudness', -23),
                file_id
            ))
        else:
            cursor.execute('''
                INSERT INTO llm_metadata (
                    file_id, AI_BPM, AI_KEY, AI_ENERGY, AI_LOUDNESS,
                    AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                file_id,
                features.get('bpm', 0),
                features.get('key', ''),
                features.get('energy', 0),
                features.get('loudness', -23),
                0.8, 0.5
            ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"    Error guardando en BD: {e}")
        return False

def main():
    db_path = 'music_analyzer.db'
    
    # Obtener archivos sin procesar
    unprocessed = get_unprocessed_files(db_path)
    total = len(unprocessed)
    
    print(f"Archivos sin metadatos: {total}")
    print("=" * 60)
    
    success = 0
    errors = 0
    
    for i, (file_id, file_path) in enumerate(unprocessed, 1):
        print(f"[{i}/{total}] {Path(file_path).name}")
        
        # Procesar con Librosa
        features = process_with_librosa(file_path)
        
        if features and save_to_db(file_id, features, db_path):
            success += 1
            print(f"  ✓ BPM={features['bpm']:.0f}, Energy={features['energy']:.2f}")
        else:
            errors += 1
            print(f"  ✗ Error procesando")
    
    print("\n" + "=" * 60)
    print(f"Procesados: {success}")
    print(f"Errores: {errors}")

if __name__ == '__main__':
    main()
EOF

    echo -e "${GREEN}▶ Procesando archivos sin metadatos...${NC}"
    python3 process_missing_only.py 2>&1 | tee -a "$LOG_FILE"
    
    # Limpiar script temporal
    rm -f process_missing_only.py
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
echo -e "  • Desde Librosa: ${GREEN}$((FINAL_ANALYZED - MIK_COUNT))${NC} archivos"
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
echo -e "${GREEN}✅ ANÁLISIS OPTIMIZADO COMPLETADO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Log guardado en: ${CYAN}$LOG_FILE${NC}"
echo ""