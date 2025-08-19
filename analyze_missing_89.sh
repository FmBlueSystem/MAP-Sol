#!/bin/bash
# =============================================================================
# ANALYZE_MISSING_89.SH - Analiza los 89 archivos problemáticos
# =============================================================================

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    ${BOLD}🔧 ANÁLISIS DE ARCHIVOS PROBLEMÁTICOS 🔧${NC}         ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BOLD}📊 Archivos sin analizar:${NC}"
echo -e "  • 87 archivos .m4a"
echo -e "  • 2 archivos .flac"
echo -e "  • Total: 89 archivos"
echo ""

read -p "$(echo -e ${CYAN}¿Intentar analizar estos archivos? [s/N]: ${NC})" confirm
if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    exit 0
fi

# Activar entorno
source .venv/bin/activate

echo ""
echo -e "${GREEN}▶ Analizando archivos problemáticos...${NC}"
echo -e "${YELLOW}  Usando Librosa (más compatible con m4a)${NC}"
echo ""

python3 << 'EOF'
import sqlite3
import numpy as np
from pathlib import Path

def analyze_with_librosa(file_path):
    """Análisis básico con Librosa (más robusto con m4a)"""
    try:
        import librosa
        
        # Intentar cargar el archivo
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True)
        
        if len(y) == 0:
            return None
            
        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo) if tempo > 0 else 120.0
        
        # Energy
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # Key detection básica
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = np.argmax(chroma_mean)
        key = pitch_classes[key_idx]
        
        # Features adicionales
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        zcr = librosa.feature.zero_crossing_rate(y)
        
        # Calcular features
        danceability = 0.8 if 115 <= bpm <= 135 else 0.6
        valence = energy * 0.7
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        instrumentalness = 1.0 - np.clip(np.mean(zcr) * 2, 0, 1)
        speechiness = np.clip(np.mean(zcr) * 0.3, 0, 0.3)
        loudness = float(librosa.amplitude_to_db(np.mean(rms)))
        
        return {
            'bpm': bpm,
            'key': key,
            'energy': energy,
            'danceability': float(np.clip(danceability, 0, 1)),
            'valence': float(np.clip(valence, 0, 1)),
            'acousticness': float(acousticness),
            'instrumentalness': float(instrumentalness),
            'speechiness': float(speechiness),
            'loudness': float(np.clip(loudness, -60, 0))
        }
    except Exception as e:
        print(f"    Error: {e}")
        return None

def main():
    db = sqlite3.connect('music_analyzer.db')
    cursor = db.cursor()
    
    # Obtener archivos sin análisis
    cursor.execute('''
        SELECT id, file_path, file_name
        FROM audio_files
        WHERE id NOT IN (SELECT file_id FROM llm_metadata)
        ORDER BY file_extension, file_name
    ''')
    
    files = cursor.fetchall()
    total = len(files)
    
    print(f"Encontrados {total} archivos sin análisis")
    print("=" * 60)
    
    success = 0
    errors = 0
    error_list = []
    
    for i, (file_id, file_path, file_name) in enumerate(files, 1):
        print(f"[{i}/{total}] {file_name[:50]}...")
        
        # Verificar que el archivo existe
        if not Path(file_path).exists():
            print(f"    ⚠️ Archivo no encontrado")
            errors += 1
            error_list.append(f"NOT_FOUND: {file_name}")
            continue
        
        # Analizar con Librosa
        features = analyze_with_librosa(file_path)
        
        if features:
            # Insertar en llm_metadata
            cursor.execute('''
                INSERT INTO llm_metadata (
                    file_id, AI_BPM, AI_KEY, AI_ENERGY,
                    AI_DANCEABILITY, AI_VALENCE, AI_ACOUSTICNESS,
                    AI_INSTRUMENTALNESS, AI_SPEECHINESS, AI_LOUDNESS,
                    AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                file_id,
                features['bpm'],
                features['key'],
                features['energy'],
                features['danceability'],
                features['valence'],
                features['acousticness'],
                features['instrumentalness'],
                features['speechiness'],
                features['loudness'],
                0.8,  # Tempo confidence (Librosa)
                0.5   # Key confidence (básica)
            ))
            
            db.commit()
            success += 1
            print(f"    ✅ BPM={features['bpm']:.0f}, Key={features['key']}, Energy={features['energy']:.2f}")
        else:
            errors += 1
            error_list.append(f"ANALYSIS_FAILED: {file_name}")
            print(f"    ❌ Error en análisis")
    
    db.close()
    
    # Guardar errores
    if error_list:
        with open('missing_89_errors.txt', 'w') as f:
            for error in error_list:
                f.write(error + '\n')
    
    print("\n" + "=" * 60)
    print(f"RESULTADOS:")
    print(f"  • Procesados: {success}")
    print(f"  • Errores: {errors}")
    print(f"  • Total: {total}")
    
    if errors > 0:
        print(f"\nArchivos con error guardados en: missing_89_errors.txt")

try:
    main()
except KeyboardInterrupt:
    print("\n\n⚠️ Proceso interrumpido")
EOF

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Estadísticas finales
FINAL_TOTAL=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM audio_files")
FINAL_ANALYZED=$(sqlite3 music_analyzer.db "SELECT COUNT(*) FROM llm_metadata WHERE AI_BPM IS NOT NULL")

echo -e "${BOLD}📊 ESTADO FINAL:${NC}"
echo -e "  Total archivos:       ${GREEN}$FINAL_TOTAL${NC}"
echo -e "  Con análisis:         ${GREEN}$FINAL_ANALYZED${NC}"
echo -e "  Completado:           ${GREEN}$((FINAL_ANALYZED * 100 / FINAL_TOTAL))%${NC}"

echo ""
echo -e "${GREEN}✅ PROCESO COMPLETADO${NC}"