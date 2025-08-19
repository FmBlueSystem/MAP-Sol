#!/bin/bash
# =============================================================================
# ANALYZE_WITH_ESSENTIA_ONLY.SH - Analiza TODO con Essentia/Librosa
# =============================================================================
# Ignora MixedInKey y calcula todo desde cero con análisis de audio real

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

DB_PATH="music_analyzer.db"
MUSIC_DIR="/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"
LOG_FILE="essentia_analysis_$(date +%Y%m%d_%H%M%S).log"

clear

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}   ${BOLD}🎵 ANÁLISIS COMPLETO CON ESSENTIA/LIBROSA 🎵${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${RED}⚠️  ADVERTENCIA: Esto analizará TODOS los archivos${NC}"
echo -e "${RED}   ignorando los metadatos de MixedInKey${NC}"
echo -e "${YELLOW}   Tiempo estimado: 12-24 horas para 3,800 archivos${NC}"
echo ""

# Estadísticas actuales
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
echo -e "${BOLD}Archivos a procesar: ${GREEN}$TOTAL${NC}"
echo ""

read -p "$(echo -e ${CYAN}¿Continuar con análisis REAL de audio? [s/N]: ${NC})" confirm

if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo -e "${YELLOW}Cancelado${NC}"
    exit 0
fi

# Limpiar análisis previos
echo -e "${CYAN}Limpiando análisis previos...${NC}"
sqlite3 "$DB_PATH" "DELETE FROM llm_metadata"
echo -e "${GREEN}✅ Base de datos limpia${NC}"
echo ""

# Activar entorno virtual
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    python3 -m venv .venv
    source .venv/bin/activate
fi

# Instalar dependencias
pip install librosa numpy numba mutagen --quiet

# Crear script Python para análisis con Essentia/Librosa
cat > analyze_with_essentia.py << 'EOF'
#!/usr/bin/env python3
"""
Analiza archivos de audio con Essentia/Librosa (NO usa MixedInKey)
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path
import subprocess
import json

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)

def analyze_with_librosa(file_path):
    """Analiza archivo con Librosa"""
    try:
        import librosa
        import numpy as np
        
        logger.info(f"Analizando: {Path(file_path).name}")
        
        # Cargar audio (30 segundos para rapidez)
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True)
        
        if len(y) == 0:
            return None
        
        # BPM
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        
        # Energy (RMS)
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # Key estimation
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = np.argmax(chroma_mean)
        key = pitch_classes[key_idx]
        
        # Loudness
        db = librosa.amplitude_to_db(rms.mean())
        loudness = float(np.clip(db, -60, 0))
        
        # Danceability (basado en tempo y energía)
        tempo_score = np.clip((tempo - 60) / 80, 0, 1)
        danceability = float((tempo_score + energy) / 2)
        
        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        
        return {
            'bpm': float(tempo),
            'key': key,
            'energy': energy,
            'loudness': loudness,
            'danceability': danceability,
            'acousticness': float(acousticness),
            'valence': energy,  # Simplificado
            'instrumentalness': 0.8,  # Por defecto
            'liveness': 0.1,
            'speechiness': 0.1,
            'tempo_confidence': 0.8,
            'key_confidence': 0.5
        }
        
    except Exception as e:
        logger.error(f"Error analizando {Path(file_path).name}: {e}")
        return None

def analyze_with_essentia(file_path):
    """Intenta analizar con Essentia (con subprocess para evitar crashes)"""
    try:
        # Crear script temporal
        script = f'''
import essentia.standard as es
import numpy as np
import json

try:
    loader = es.EasyLoader(filename="{file_path}", sampleRate=44100)
    audio = loader()
    
    if audio.ndim > 1:
        audio = np.mean(audio, axis=0)
    
    # Limitar a 30 segundos
    if len(audio) > 44100 * 30:
        audio = audio[:44100 * 30]
    
    # BPM
    rhythm = es.RhythmExtractor2013(method='degara')
    bpm, beats, confidence, _, _ = rhythm(audio)
    
    # Key
    key_extractor = es.KeyExtractor()
    key, scale, strength = key_extractor(audio)
    
    # Energy
    rms = float(es.RMS()(audio))
    energy = np.clip((20 * np.log10(max(rms, 1e-10)) + 60) / 60, 0, 1)
    
    result = {{
        'bpm': float(bpm),
        'key': f"{{key}} {{scale}}",
        'energy': float(energy),
        'tempo_confidence': float(confidence),
        'key_confidence': float(strength)
    }}
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{'error': str(e)}}))
'''
        
        # Ejecutar en subprocess
        result = subprocess.run(
            ['python3', '-c', script],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if 'error' not in data:
                return data
    except:
        pass
    
    return None

def save_to_db(file_id, features, db_path='music_analyzer.db'):
    """Guarda resultados en la base de datos"""
    if not features:
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO llm_metadata (
                file_id, AI_BPM, AI_KEY, AI_ENERGY, AI_LOUDNESS,
                AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS,
                AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            file_id,
            features.get('bpm', 0),
            features.get('key', ''),
            features.get('energy', 0),
            features.get('loudness', -23),
            features.get('danceability', 0),
            features.get('valence', 0),
            features.get('acousticness', 0),
            features.get('instrumentalness', 0),
            features.get('liveness', 0),
            features.get('speechiness', 0),
            features.get('tempo_confidence', 0.8),
            features.get('key_confidence', 0.5)
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error guardando en BD: {e}")
        return False

def main():
    db_path = 'music_analyzer.db'
    
    # Obtener archivos
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT id, file_path FROM audio_files')
    files = cursor.fetchall()
    conn.close()
    
    total = len(files)
    logger.info(f"Archivos a procesar: {total}")
    logger.info("=" * 60)
    
    success = 0
    errors = 0
    
    for i, (file_id, file_path) in enumerate(files, 1):
        print(f"[{i}/{total}] {Path(file_path).name}")
        
        # Intentar con Essentia primero (si está disponible)
        features = None
        
        try:
            import essentia
            features = analyze_with_essentia(file_path)
            if features:
                logger.info(f"  ✓ Essentia: BPM={features['bpm']:.0f}")
        except ImportError:
            pass
        
        # Si falla, usar Librosa
        if not features:
            features = analyze_with_librosa(file_path)
            if features:
                logger.info(f"  ✓ Librosa: BPM={features['bpm']:.0f}, Energy={features['energy']:.2f}")
        
        # Guardar en BD
        if features and save_to_db(file_id, features, db_path):
            success += 1
        else:
            errors += 1
            logger.error(f"  ✗ Error procesando")
        
        # Mostrar progreso cada 100 archivos
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

echo -e "${GREEN}▶ Iniciando análisis con Essentia/Librosa...${NC}"
echo -e "${YELLOW}  Esto tomará varias horas...${NC}"
echo ""

# Ejecutar análisis
python3 analyze_with_essentia.py 2>&1 | tee "$LOG_FILE"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ ANÁLISIS COMPLETADO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Estadísticas finales
FINAL_ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL")
echo -e "Archivos analizados: ${GREEN}$FINAL_ANALYZED${NC}"
echo -e "Log guardado en: ${CYAN}$LOG_FILE${NC}"