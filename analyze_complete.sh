#!/bin/bash
# =============================================================================
# ANALYZE_COMPLETE.SH - Sistema de Análisis Musical Completo
# =============================================================================
# TODO EN UN SOLO SCRIPT - SIMPLE Y DIRECTO
# 1. Limpia BD
# 2. Lee MixedInKey 
# 3. Analiza con Essentia/Librosa
# 4. Genera reporte de errores
# =============================================================================

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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="analysis_${TIMESTAMP}.log"
ERROR_FILE="errors_${TIMESTAMP}.txt"

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}       ${BOLD}🎵 ANÁLISIS MUSICAL COMPLETO 🎵${NC}              ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar directorio
if [ ! -d "$MUSIC_DIR" ]; then
    echo -e "${RED}❌ Directorio no encontrado${NC}"
    exit 1
fi

# Contar archivos
TOTAL_FILES=$(find "$MUSIC_DIR" -type f \( -name "*.mp3" -o -name "*.m4a" -o -name "*.flac" \) | wc -l)
echo -e "${BOLD}Archivos encontrados: ${GREEN}$TOTAL_FILES${NC}"
echo ""

read -p "$(echo -e ${CYAN}¿Iniciar análisis completo? [s/N]: ${NC})" confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    exit 0
fi

# Preparar entorno
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install mutagen numpy librosa numba --quiet

# =============================================================================
# PASO 1: LIMPIAR BD
# =============================================================================
echo ""
echo -e "${CYAN}PASO 1: Limpiando base de datos...${NC}"
sqlite3 "$DB_PATH" "DELETE FROM llm_metadata" 2>/dev/null
echo -e "${GREEN}✅ BD limpia${NC}"

# =============================================================================
# PASO 2: LEER MIXEDINKEY
# =============================================================================
echo ""
echo -e "${CYAN}PASO 2: Importando MixedInKey...${NC}"

python3 << 'EOF' | tee -a "$LOG_FILE"
import os
import sys
import base64
import json
import sqlite3
from pathlib import Path
from mutagen import File as MutagenFile

def decode_base64(data):
    try:
        decoded = base64.b64decode(data)
        return json.loads(decoded.decode('utf-8', errors='ignore'))
    except:
        return None

def read_mixedinkey(music_dir):
    db = sqlite3.connect('music_analyzer.db')
    cursor = db.cursor()
    
    audio_exts = ('.mp3', '.m4a', '.flac', '.wav', '.ogg')
    files = [p for p in Path(music_dir).rglob('*') if p.suffix.lower() in audio_exts]
    
    print(f"Procesando {len(files)} archivos...")
    count = 0
    
    for file_path in files:
        try:
            audio = MutagenFile(str(file_path))
            if not audio:
                continue
            
            # Buscar o crear en audio_files
            cursor.execute('SELECT id FROM audio_files WHERE file_path = ?', (str(file_path),))
            row = cursor.fetchone()
            
            if not row:
                cursor.execute('''INSERT INTO audio_files (file_path, file_name) VALUES (?, ?)''',
                             (str(file_path), file_path.name))
                file_id = cursor.lastrowid
            else:
                file_id = row[0]
            
            # Leer MixedInKey
            mik_data = {}
            
            # BPM
            if 'bpm' in audio:
                try:
                    mik_data['bpm'] = float(str(audio['bpm'][0] if isinstance(audio['bpm'], list) else audio['bpm']))
                except:
                    pass
            
            # Key
            for key_field in ['key', 'initialkey']:
                if key_field in audio:
                    key_val = audio[key_field]
                    if isinstance(key_val, list):
                        key_val = key_val[0]
                    mik_data['key'] = str(key_val)
                    break
            
            # Energy
            if 'energylevel' in audio:
                try:
                    level = audio['energylevel']
                    if isinstance(level, list):
                        level = level[0]
                    mik_data['energy'] = int(level) / 10.0
                except:
                    pass
            
            # Guardar si hay datos
            if mik_data.get('bpm') or mik_data.get('key') or mik_data.get('energy'):
                cursor.execute('''INSERT OR REPLACE INTO llm_metadata 
                    (file_id, AI_BPM, AI_KEY, AI_ENERGY, AI_TEMPO_CONFIDENCE) 
                    VALUES (?, ?, ?, ?, ?)''',
                    (file_id, mik_data.get('bpm', 0), mik_data.get('key', ''), 
                     mik_data.get('energy', 0), 1.0 if mik_data.get('bpm') else 0))
                count += 1
                
                if count % 100 == 0:
                    print(f"  {count} archivos con MixedInKey...")
                    db.commit()
        except:
            pass
    
    db.commit()
    db.close()
    print(f"✅ Total con MixedInKey: {count}")

# Ejecutar
music_dir = "/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"
read_mixedinkey(music_dir)
EOF

# =============================================================================
# PASO 3: ANALIZAR CON ESSENTIA/LIBROSA
# =============================================================================
echo ""
echo -e "${CYAN}PASO 3: Analizando con Essentia/Librosa...${NC}"

python3 << 'EOF' 2>&1 | tee -a "$LOG_FILE"
import os
import sys
import sqlite3
import subprocess
import json
import numpy as np
from pathlib import Path
from datetime import datetime

# Archivo de errores
ERROR_FILE = "errors_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".txt"

def analyze_with_essentia(file_path, mik_bpm, mik_key, mik_energy):
    """Intenta con Essentia en subprocess"""
    try:
        script = f'''
import json
import numpy as np
try:
    import essentia.standard as es
    
    loader = es.EasyLoader(filename="{file_path}", sampleRate=44100)
    audio = loader()
    
    if audio.ndim > 1:
        audio = np.mean(audio, axis=0)
    
    # Limitar a 30 segundos
    if len(audio) > 44100 * 30:
        audio = audio[:44100 * 30]
    
    # Usar MixedInKey si existe
    bpm = {mik_bpm if mik_bpm else 0}
    if bpm == 0:
        rhythm = es.RhythmExtractor2013(method="degara")
        bpm, _, _, _, _ = rhythm(audio)
    
    # Calcular features adicionales
    spectrum = es.Spectrum()(audio)
    centroid = es.Centroid()(spectrum)
    
    # Danceability basado en BPM
    if 115 <= bpm <= 135:
        danceability = 0.8
    elif 100 <= bpm <= 150:
        danceability = 0.6
    else:
        danceability = 0.4
    
    result = {{
        "bpm": float(bpm),
        "danceability": danceability,
        "valence": 0.5,
        "acousticness": 1.0 - min(centroid / 4000, 1),
        "loudness": -23.0
    }}
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
'''
        
        result = subprocess.run(['python3', '-c', script], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if 'error' not in data:
                return data
    except:
        pass
    return None

def analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy):
    """Fallback con Librosa"""
    try:
        import librosa
        
        # Cargar 30 segundos
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True)
        
        if len(y) == 0:
            return None
        
        # Usar MixedInKey o calcular
        if mik_bpm and mik_bpm > 0:
            bpm = mik_bpm
        else:
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo)
        
        # Features adicionales
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # Danceability
        if 115 <= bpm <= 135:
            danceability = 0.8 + (energy * 0.2)
        elif 100 <= bpm <= 150:
            danceability = 0.6 + (energy * 0.2)
        else:
            danceability = 0.4 + (energy * 0.1)
        
        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        
        return {
            'bpm': bpm,
            'energy': energy if not mik_energy else mik_energy,
            'danceability': float(np.clip(danceability, 0, 1)),
            'valence': energy * 0.8,
            'acousticness': float(acousticness),
            'loudness': float(librosa.amplitude_to_db(np.mean(rms)))
        }
    except Exception as e:
        return None

def main():
    db = sqlite3.connect('music_analyzer.db')
    cursor = db.cursor()
    
    # Obtener todos los archivos
    cursor.execute('''
        SELECT af.id, af.file_path, lm.AI_BPM, lm.AI_KEY, lm.AI_ENERGY
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
    ''')
    
    files = cursor.fetchall()
    total = len(files)
    
    print(f"Procesando {total} archivos...")
    print("=" * 60)
    
    success = 0
    errors = 0
    error_list = []
    
    for i, (file_id, file_path, mik_bpm, mik_key, mik_energy) in enumerate(files, 1):
        file_name = Path(file_path).name
        
        # Mostrar progreso
        if i % 50 == 0:
            print(f"[{i}/{total}] Procesados: {success}, Errores: {errors}")
        
        # Intentar análisis
        features = None
        
        # Essentia primero
        try:
            import essentia
            features = analyze_with_essentia(file_path, mik_bpm, mik_key, mik_energy)
        except ImportError:
            pass
        
        # Librosa si falla
        if not features:
            features = analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy)
        
        if features:
            # Actualizar BD
            if mik_bpm:  # Ya existe registro
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_DANCEABILITY = ?, AI_VALENCE = ?,
                        AI_ACOUSTICNESS = ?, AI_LOUDNESS = ?
                    WHERE file_id = ?
                ''', (features.get('danceability', 0), features.get('valence', 0),
                      features.get('acousticness', 0), features.get('loudness', -23),
                      file_id))
            else:  # Nuevo registro
                cursor.execute('''
                    INSERT OR REPLACE INTO llm_metadata (
                        file_id, AI_BPM, AI_ENERGY, AI_DANCEABILITY, 
                        AI_VALENCE, AI_ACOUSTICNESS, AI_LOUDNESS
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (file_id, features.get('bpm', 0), features.get('energy', 0),
                      features.get('danceability', 0), features.get('valence', 0),
                      features.get('acousticness', 0), features.get('loudness', -23)))
            
            success += 1
            
            if success % 100 == 0:
                db.commit()
        else:
            errors += 1
            error_list.append(f"{file_name} | {file_path}")
    
    db.commit()
    db.close()
    
    # Guardar errores
    if error_list:
        with open(ERROR_FILE, 'w') as f:
            f.write(f"Errores de análisis: {len(error_list)} archivos\n")
            f.write("=" * 60 + "\n")
            for error in error_list:
                f.write(error + "\n")
        print(f"\nErrores guardados en: {ERROR_FILE}")
    
    print("\n" + "=" * 60)
    print(f"RESULTADOS:")
    print(f"  • Procesados: {success}")
    print(f"  • Errores: {errors}")
    print(f"  • Total: {total}")

# Ejecutar
try:
    main()
except KeyboardInterrupt:
    print("\n\nProceso interrumpido por usuario")
    sys.exit(0)
EOF

# =============================================================================
# ESTADÍSTICAS FINALES
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}📊 ESTADÍSTICAS FINALES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audio_files" 2>/dev/null || echo "0")
ANALYZED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL" 2>/dev/null || echo "0")
WITH_MIK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM llm_metadata WHERE AI_TEMPO_CONFIDENCE = 1.0" 2>/dev/null || echo "0")

echo -e "  Total archivos:    ${GREEN}$TOTAL${NC}"
echo -e "  Analizados:        ${GREEN}$ANALYZED${NC}"
echo -e "  Con MixedInKey:    ${GREEN}$WITH_MIK${NC}"
echo -e "  Progreso:          ${GREEN}$((ANALYZED * 100 / TOTAL))%${NC}"

if [ -f "$ERROR_FILE" ]; then
    echo ""
    echo -e "  Errores en: ${YELLOW}$ERROR_FILE${NC}"
fi

echo ""
echo -e "${GREEN}✅ ANÁLISIS COMPLETADO${NC}"
echo -e "Log: ${CYAN}$LOG_FILE${NC}"
echo ""