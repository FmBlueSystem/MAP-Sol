#!/usr/bin/env python3
"""
Análisis complementario con ESSENTIA + Librosa como fallback
USA los valores de MixedInKey como referencia
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path
import numpy as np
import subprocess
import json
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)

# Archivo de reporte de errores
ERROR_REPORT_FILE = f"error_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
DETAILED_ERROR_FILE = f"error_details_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

# Diccionario para almacenar errores
error_details = {
    'summary': {
        'total_errors': 0,
        'essentia_failures': 0,
        'librosa_failures': 0,
        'file_not_found': 0,
        'corrupt_files': 0,
        'm4a_failures': 0,
        'other_errors': 0
    },
    'files': []
}

def analyze_with_essentia(file_path, mik_bpm=None, mik_key=None, mik_energy=None):
    """
    Analiza con Essentia USANDO valores de MixedInKey como referencia
    Ejecuta en subprocess para evitar segmentation faults
    """
    try:
        # Crear script temporal para ejecutar en subprocess
        script = f'''
import sys
import json
import numpy as np
try:
    import essentia
    import essentia.standard as es
    
    # Cargar audio
    loader = es.EasyLoader(filename="{file_path}", sampleRate=44100)
    audio = loader()
    
    # Si es stereo, convertir a mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=0)
    
    # Limitar a 30 segundos
    if len(audio) > 44100 * 30:
        audio = audio[:44100 * 30]
    
    # === USAR VALORES DE MIXEDINKEY SI EXISTEN ===
    mik_bpm = {mik_bpm if mik_bpm else 'None'}
    mik_key = "{mik_key if mik_key else ''}"
    mik_energy = {mik_energy if mik_energy else 'None'}
    
    # BPM - usar MixedInKey si existe
    if mik_bpm and mik_bpm > 0:
        bpm = float(mik_bpm)
        tempo_confidence = 1.0
    else:
        rhythm = es.RhythmExtractor2013(method='degara')
        bpm, beats, tempo_confidence, _, _ = rhythm(audio)
        bpm = float(bpm)
        tempo_confidence = float(tempo_confidence)
    
    # Key - usar MixedInKey si existe
    if mik_key:
        key = mik_key
        key_confidence = 1.0
    else:
        key_extractor = es.KeyExtractor()
        key, scale, key_confidence = key_extractor(audio)
        key = f"{{key}} {{scale}}"
        key_confidence = float(key_confidence)
    
    # Energy - usar MixedInKey si existe
    if mik_energy and mik_energy > 0:
        energy = float(mik_energy)
    else:
        rms = float(es.RMS()(audio))
        energy = np.clip((20 * np.log10(max(rms, 1e-10)) + 60) / 60, 0, 1)
        energy = float(energy)
    
    # === CALCULAR FEATURES ADICIONALES ===
    
    # Danceability (basado en BPM y energy)
    if 115 <= bpm <= 135:
        danceability = 0.8 + (energy * 0.2)
    elif 100 <= bpm <= 150:
        danceability = 0.6 + (energy * 0.2)
    else:
        danceability = 0.4 + (energy * 0.1)
    danceability = float(np.clip(danceability, 0, 1))
    
    # Spectral features
    spectrum = es.Spectrum()(audio)
    centroid = es.Centroid()(spectrum)
    
    # Acousticness
    acousticness = 1.0 - np.clip(centroid / 4000, 0, 1)
    
    # Valence (positividad)
    if 'major' in key.lower():
        valence = 0.6 + (energy * 0.3)
    else:
        valence = 0.3 + (energy * 0.2)
    valence = float(np.clip(valence, 0, 1))
    
    # Loudness
    loudness_calc = es.Loudness()(audio)
    loudness = float(np.clip(20 * np.log10(max(loudness_calc, 1e-10)), -60, 0))
    
    # Zero crossing rate para speechiness/instrumentalness
    zcr = es.ZeroCrossingRate()(audio)
    instrumentalness = 1.0 - np.clip(zcr * 2, 0, 1)
    speechiness = np.clip(zcr * 0.5, 0, 0.3)
    
    # Liveness (basado en varianza espectral)
    spectral_flux = es.SpectralFlux()(spectrum)
    liveness = np.clip(spectral_flux * 0.1, 0, 0.5)
    
    result = {{
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
    }}
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({{'error': str(e)}}))
'''
        
        # Ejecutar en subprocess para evitar segmentation faults
        result = subprocess.run(
            ['python3', '-c', script],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if 'error' not in data:
                logger.info(f"✓ Essentia OK: {Path(file_path).name}")
                return data
        
        return None
        
    except subprocess.TimeoutExpired:
        logger.debug(f"Essentia timeout: {Path(file_path).name}")
        return None
    except Exception as e:
        logger.debug(f"Essentia falló: {e}")
        return None

def analyze_with_librosa(file_path, mik_bpm=None, mik_key=None, mik_energy=None):
    """
    Analiza con Librosa como FALLBACK cuando Essentia falla
    """
    try:
        import librosa
        
        logger.info(f"Usando Librosa (fallback): {Path(file_path).name}")
        
        # Cargar solo 30 segundos
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True)
        
        if len(y) == 0:
            return None
        
        # === USAR VALORES DE MIXEDINKEY ===
        
        # BPM
        if mik_bpm and mik_bpm > 0:
            bpm = mik_bpm
            tempo_confidence = 1.0
        else:
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo)
            tempo_confidence = 0.8
        
        # Key
        if mik_key:
            key = mik_key
            key_confidence = 1.0
        else:
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            key_idx = np.argmax(chroma_mean)
            key = pitch_classes[key_idx]
            key_confidence = 0.5
        
        # Energy
        if mik_energy is not None and mik_energy > 0:
            energy = mik_energy
        else:
            rms = librosa.feature.rms(y=y)
            energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # === CALCULAR FEATURES ADICIONALES ===
        
        # RMS para varios cálculos
        rms = librosa.feature.rms(y=y)
        
        # Danceability
        if 115 <= bpm <= 135:
            danceability = 0.8 + (energy * 0.2)
        elif 100 <= bpm <= 150:
            danceability = 0.6 + (energy * 0.2)
        else:
            danceability = 0.4 + (energy * 0.1)
        danceability = float(np.clip(danceability, 0, 1))
        
        # Valence
        if 'major' in str(key).lower() or 'A' in str(key):
            valence = 0.6 + (energy * 0.3)
        else:
            valence = 0.3 + (energy * 0.2)
        valence = float(np.clip(valence, 0, 1))
        
        # Acousticness
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        acousticness = 1.0 - np.clip(np.mean(spectral_centroids) / 4000, 0, 1)
        
        # Instrumentalness
        zcr = librosa.feature.zero_crossing_rate(y)
        instrumentalness = 1.0 - np.clip(np.mean(zcr) * 2, 0, 1)
        
        # Speechiness
        speechiness = np.clip(np.mean(zcr) * 0.5, 0, 0.3)
        
        # Liveness
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
        logger.error(f"Error con Librosa: {e}")
        return None

def main():
    db_path = 'music_analyzer.db'
    
    # Verificar si Essentia está disponible
    try:
        import essentia
        ESSENTIA_AVAILABLE = True
        logger.info("✅ Essentia disponible - será el método principal")
    except ImportError:
        ESSENTIA_AVAILABLE = False
        logger.warning("⚠️ Essentia no disponible - usando solo Librosa")
    
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
    essentia_count = 0
    librosa_count = 0
    
    for i, (file_id, file_path, mik_bpm, mik_key, mik_energy) in enumerate(files, 1):
        file_name = Path(file_path).name
        
        # Mostrar datos de MixedInKey
        if mik_bpm:
            print(f"[{i}/{total}] {file_name}")
            print(f"  MixedInKey: BPM={mik_bpm}, Key={mik_key}, Energy={mik_energy:.2f}")
        else:
            print(f"[{i}/{total}] {file_name} (sin MixedInKey)")
        
        features = None
        
        # Intentar con Essentia primero (si está disponible)
        if ESSENTIA_AVAILABLE:
            features = analyze_with_essentia(file_path, mik_bpm, mik_key, mik_energy)
            if features:
                essentia_count += 1
        
        # Si Essentia falla o no está disponible, usar Librosa
        if not features:
            features = analyze_with_librosa(file_path, mik_bpm, mik_key, mik_energy)
            if features:
                librosa_count += 1
        
        if features:
            # Actualizar BD
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            if mik_bpm:  # Actualizar registro existente
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
            else:  # Insertar nuevo registro
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
            
            # Registrar error detallado
            error_entry = {
                'file_id': file_id,
                'file_path': file_path,
                'file_name': file_name,
                'timestamp': datetime.now().isoformat(),
                'had_mixedinkey': bool(mik_bpm),
                'error_type': 'unknown'
            }
            
            # Determinar tipo de error
            if not os.path.exists(file_path):
                error_entry['error_type'] = 'file_not_found'
                error_entry['error_message'] = 'File does not exist'
                error_details['summary']['file_not_found'] += 1
            elif file_path.lower().endswith('.m4a'):
                error_entry['error_type'] = 'm4a_failure'
                error_entry['error_message'] = 'Failed to process m4a file'
                error_details['summary']['m4a_failures'] += 1
            else:
                error_entry['error_type'] = 'processing_failure'
                error_entry['error_message'] = 'Both Essentia and Librosa failed'
                error_details['summary']['other_errors'] += 1
            
            error_details['files'].append(error_entry)
            error_details['summary']['total_errors'] += 1
            
            # Escribir en archivo de texto simple
            with open(ERROR_REPORT_FILE, 'a') as f:
                f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | ERROR | {file_name} | {error_entry['error_type']} | {error_entry['error_message']}\n")
        
        # Progreso cada 100 archivos
        if i % 100 == 0:
            logger.info(f"Progreso: {i}/{total} ({i*100/total:.1f}%)")
            logger.info(f"  Essentia: {essentia_count}, Librosa: {librosa_count}")
    
    # Guardar reporte detallado en JSON
    if error_details['summary']['total_errors'] > 0:
        with open(DETAILED_ERROR_FILE, 'w') as f:
            json.dump(error_details, f, indent=2)
    
    print("\n" + "=" * 60)
    print(f"RESULTADOS FINALES:")
    print(f"  • Procesados: {success}")
    print(f"  • Con Essentia: {essentia_count}")
    print(f"  • Con Librosa: {librosa_count}")
    print(f"  • Errores: {errors}")
    print(f"  • Total: {total}")
    
    if errors > 0:
        print("\n" + "=" * 60)
        print(f"REPORTE DE ERRORES:")
        print(f"  • Archivos no encontrados: {error_details['summary']['file_not_found']}")
        print(f"  • Fallos con m4a: {error_details['summary']['m4a_failures']}")
        print(f"  • Otros errores: {error_details['summary']['other_errors']}")
        print(f"\nReportes guardados:")
        print(f"  • Texto simple: {ERROR_REPORT_FILE}")
        print(f"  • JSON detallado: {DETAILED_ERROR_FILE}")

if __name__ == '__main__':
    main()