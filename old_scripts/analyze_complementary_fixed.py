#!/usr/bin/env python3
"""
Análisis complementario con Essentia/Librosa (VERSIÓN CORREGIDA)
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
        
        # RMS para varios cálculos
        rms = librosa.feature.rms(y=y)
        
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