#!/bin/bash
# =============================================================================
# ANALYZE_STEP3_ONLY.SH - Solo ejecuta el Paso 3 (Essentia/Librosa)
# =============================================================================
# Ya tienes MixedInKey importado, solo falta calcular features adicionales

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    ${BOLD}🎵 PASO 3: ANÁLISIS CON ESSENTIA/LIBROSA 🎵${NC}     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar estado actual
TOTAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files")
WITH_MIK=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_TEMPO_CONFIDENCE = 1.0")
WITH_FEATURES=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_DANCEABILITY IS NOT NULL")

echo -e "${BOLD}Estado actual:${NC}"
echo -e "  Total archivos:     ${GREEN}$TOTAL${NC}"
echo -e "  Con MixedInKey:     ${GREEN}$WITH_MIK${NC}"
echo -e "  Con features:       ${YELLOW}$WITH_FEATURES${NC}"
echo -e "  Por procesar:       ${YELLOW}$((TOTAL - WITH_FEATURES))${NC}"
echo ""

read -p "$(echo -e ${CYAN}¿Calcular features adicionales? [s/N]: ${NC})" confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    exit 0
fi

# Activar entorno
source .venv/bin/activate

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ERROR_FILE="errors_step3_${TIMESTAMP}.txt"

echo ""
echo -e "${GREEN}▶ Calculando features adicionales...${NC}"
echo -e "${YELLOW}  Velocidad: 2-5 archivos/minuto${NC}"
echo ""

python3 << 'EOF'
import sqlite3
import numpy as np
from pathlib import Path
import sys

def analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy):
    """Calcula features adicionales usando valores de MixedInKey"""
    try:
        import librosa
        
        # Cargar solo 20 segundos para ser más rápido
        y, sr = librosa.load(file_path, sr=22050, duration=20, mono=True)
        
        if len(y) == 0:
            return None
        
        # Usar valores de MixedInKey
        bpm = mik_bpm if mik_bpm else 120
        energy = mik_energy if mik_energy else 0.5
        
        # Calcular features adicionales
        
        # Danceability basado en BPM y energía
        if 115 <= bpm <= 135:
            danceability = 0.8 + (energy * 0.2)
        elif 100 <= bpm <= 150:
            danceability = 0.6 + (energy * 0.2)
        else:
            danceability = 0.4 + (energy * 0.1)
        
        # Valence (positividad)
        valence = energy * 0.8 if energy > 0.5 else energy * 0.5
        
        # Acousticness
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        
        # Instrumentalness
        zcr = librosa.feature.zero_crossing_rate(y)
        instrumentalness = 1.0 - np.clip(np.mean(zcr) * 2, 0, 1)
        
        # Speechiness
        speechiness = np.clip(np.mean(zcr) * 0.3, 0, 0.3)
        
        # Liveness
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        liveness = np.clip((np.std(spectral_rolloff) / 1000) * 0.2, 0, 0.3)
        
        # Loudness
        rms = librosa.feature.rms(y=y)
        loudness = float(librosa.amplitude_to_db(np.mean(rms)))
        
        return {
            'danceability': float(np.clip(danceability, 0, 1)),
            'valence': float(np.clip(valence, 0, 1)),
            'acousticness': float(acousticness),
            'instrumentalness': float(instrumentalness),
            'speechiness': float(speechiness),
            'liveness': float(liveness),
            'loudness': float(np.clip(loudness, -60, 0))
        }
    except Exception as e:
        return None

def main():
    db = sqlite3.connect('music_analyzer.db')
    cursor = db.cursor()
    
    # Obtener archivos que ya tienen MixedInKey pero no features
    cursor.execute('''
        SELECT af.id, af.file_path, lm.AI_BPM, lm.AI_KEY, lm.AI_ENERGY
        FROM audio_files af
        JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.AI_DANCEABILITY IS NULL
        ORDER BY af.id
    ''')
    
    files = cursor.fetchall()
    total = len(files)
    
    if total == 0:
        print("✅ Todos los archivos ya tienen features calculados")
        return
    
    print(f"Procesando {total} archivos...")
    print("=" * 60)
    
    success = 0
    errors = 0
    error_list = []
    
    for i, (file_id, file_path, mik_bpm, mik_key, mik_energy) in enumerate(files, 1):
        file_name = Path(file_path).name
        
        # Mostrar progreso
        if i % 10 == 0:
            print(f"[{i}/{total}] Procesados: {success}, Errores: {errors}")
            db.commit()  # Guardar cada 10 archivos
        
        # Analizar
        features = analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy)
        
        if features:
            # Actualizar BD con features
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
            success += 1
        else:
            errors += 1
            error_list.append(f"{file_name}")
            
    db.commit()
    db.close()
    
    # Guardar errores
    if error_list:
        with open(f'errors_step3_{total}.txt', 'w') as f:
            for error in error_list:
                f.write(error + '\n')
    
    print("\n" + "=" * 60)
    print(f"RESULTADOS:")
    print(f"  • Procesados: {success}")
    print(f"  • Errores: {errors}")
    print(f"  • Total: {total}")
    
    if errors > 0:
        print(f"\nArchivos con error guardados en: errors_step3_{total}.txt")

try:
    main()
except KeyboardInterrupt:
    print("\n\n⚠️ Proceso interrumpido")
    sys.exit(0)
EOF

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Estadísticas finales
FINAL_WITH_FEATURES=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_DANCEABILITY IS NOT NULL")
FINAL_TOTAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files")

echo -e "${BOLD}📊 ESTADÍSTICAS FINALES:${NC}"
echo -e "  Total archivos:       ${GREEN}$FINAL_TOTAL${NC}"
echo -e "  Con features:         ${GREEN}$FINAL_WITH_FEATURES${NC}"
echo -e "  Completado:           ${GREEN}$((FINAL_WITH_FEATURES * 100 / FINAL_TOTAL))%${NC}"

echo ""
echo -e "${GREEN}✅ ANÁLISIS COMPLETADO${NC}"