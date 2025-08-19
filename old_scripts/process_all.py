#!/usr/bin/env python3
"""
PROCESADOR COMPLETO DE AUDIO
Script simple y directo para procesar todos los archivos
"""

import os
import sys
import sqlite3
import numpy as np
import warnings
import tempfile
import subprocess
from datetime import datetime

# Agregar el path para importar librosa desde el entorno virtual
sys.path.insert(0, '/Users/freddymolina/venvs/aubio_env/lib/python3.13/site-packages')

try:
    import librosa
    import soundfile as sf
    print("✅ Librosa cargado correctamente")
except ImportError as e:
    print(f"❌ Error importando librosa: {e}")
    sys.exit(1)

# Suprimir warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def process_audio_file(file_path):
    """Procesar un archivo de audio y extraer características"""
    try:
        # Intentar cargar el audio
        y = None
        sr = 44100
        
        # Opción 1: Cargar directamente con librosa
        try:
            y, sr = librosa.load(file_path, sr=44100, mono=True)
        except:
            # Opción 2: Convertir con ffmpeg primero
            try:
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                    wav_file = tmp.name
                
                cmd = [
                    'ffmpeg', '-v', 'quiet', '-y',
                    '-i', file_path,
                    '-ac', '1', '-ar', '44100',
                    '-acodec', 'pcm_s16le',
                    '-f', 'wav', wav_file
                ]
                
                result = subprocess.run(cmd, capture_output=True, timeout=30)
                
                if result.returncode == 0:
                    y, sr = librosa.load(wav_file, sr=44100, mono=True)
                
                if os.path.exists(wav_file):
                    os.remove(wav_file)
            except:
                pass
        
        if y is None or len(y) == 0:
            return None
        
        duration = len(y) / sr
        
        if duration < 5:
            return None
        
        # Tomar ventana de análisis
        if duration > 60:
            analysis_window = y[:60*sr]
        else:
            analysis_window = y
        
        # Calcular características básicas
        results = {}
        
        # Loudness
        rms = librosa.feature.rms(y=analysis_window)[0]
        rms_mean = np.mean(rms)
        results['loudness'] = float(20 * np.log10(rms_mean + 1e-10))
        results['loudness'] = max(-70, min(0, results['loudness']))
        
        # Tempo
        try:
            tempo, _ = librosa.beat.beat_track(y=analysis_window, sr=sr)
            results['bpm'] = float(tempo)
            results['danceability'] = min(1.0, max(0.0, (tempo - 60) / 140))
        except:
            results['bpm'] = 120.0
            results['danceability'] = 0.5
        
        # Energy
        results['energy'] = float(min(1.0, max(0.0, rms_mean * 10)))
        
        # Valence (brightness)
        spectral_centroids = librosa.feature.spectral_centroid(y=analysis_window, sr=sr)[0]
        results['valence'] = float(min(1.0, max(0.0, (np.mean(spectral_centroids) - 500) / 3000)))
        
        # Acousticness
        spectral_rolloff = librosa.feature.spectral_rolloff(y=analysis_window, sr=sr)[0]
        rolloff_normalized = np.mean(spectral_rolloff) / (sr/2)
        results['acousticness'] = float(min(1.0, max(0.0, 1.0 - rolloff_normalized)))
        
        # Instrumentalness
        mfccs = librosa.feature.mfcc(y=analysis_window, sr=sr, n_mfcc=13)
        mfcc_var = np.var(mfccs, axis=1)
        results['instrumentalness'] = float(min(1.0, max(0.0, 1.0 - (np.mean(mfcc_var) / 100))))
        
        # Speechiness
        zcr = librosa.feature.zero_crossing_rate(analysis_window)[0]
        results['speechiness'] = float(min(1.0, max(0.0, np.mean(zcr) * 100)))
        
        # Liveness
        energy_var = np.var(rms)
        results['liveness'] = float(min(1.0, max(0.0, energy_var * 10)))
        
        # Key
        try:
            chroma = librosa.feature.chroma_cqt(y=analysis_window, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            key_idx = np.argmax(chroma_mean)
            keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            results['key'] = keys[key_idx]
        except:
            results['key'] = 'C'
        
        # Confidence
        results['confidence'] = 0.9 if duration >= 30 else 0.7
        
        return results
        
    except Exception as e:
        return None

def main():
    print("\n" + "="*60)
    print("🎵 PROCESADOR DE AUDIO - LIBROSA")
    print("   Procesando TODOS los archivos pendientes")
    print("="*60)
    
    # Conectar a la base de datos
    db_path = 'music_analyzer.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener estadísticas
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE > 0.5 
        AND AI_LOUDNESS IS NOT NULL
    """)
    analyzed = cursor.fetchone()[0]
    
    print(f"\n📊 Estadísticas iniciales:")
    print(f"   Total archivos: {total}")
    print(f"   Ya analizados: {analyzed}")
    print(f"   Por procesar: {total - analyzed}")
    
    # Obtener archivos pendientes
    cursor.execute("""
        SELECT af.id, af.file_path, af.file_name
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE af.file_path IS NOT NULL
        AND (
            lm.AI_LOUDNESS IS NULL 
            OR lm.AI_CONFIDENCE < 0.5
            OR lm.AI_DANCEABILITY > 1.0 
            OR lm.AI_DANCEABILITY < 0
        )
        ORDER BY af.id
        LIMIT 2100
    """)
    
    files = cursor.fetchall()
    print(f"\n📁 Archivos a procesar: {len(files)}")
    
    if not files:
        print("✅ No hay archivos pendientes!")
        conn.close()
        return
    
    processed = 0
    failed = 0
    
    print("\n🔄 Iniciando procesamiento...\n")
    
    for i, (file_id, file_path, file_name) in enumerate(files, 1):
        # Mostrar progreso cada 10 archivos
        if i % 10 == 0:
            print(f"\n[{i}/{len(files)}] Progreso: {i*100/len(files):.1f}%")
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            failed += 1
            continue
        
        # Procesar archivo
        results = process_audio_file(file_path)
        
        if results:
            # Guardar en la base de datos
            try:
                # Verificar si ya existe
                cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
                exists = cursor.fetchone()
                
                if exists:
                    # Actualizar
                    cursor.execute("""
                        UPDATE llm_metadata 
                        SET AI_LOUDNESS = ?, AI_DANCEABILITY = ?, AI_ENERGY = ?,
                            AI_VALENCE = ?, AI_ACOUSTICNESS = ?, AI_INSTRUMENTALNESS = ?,
                            AI_SPEECHINESS = ?, AI_LIVENESS = ?, AI_BPM = ?,
                            AI_KEY = ?, AI_CONFIDENCE = ?, AI_ANALYZED_DATE = ?
                        WHERE file_id = ?
                    """, (
                        results['loudness'], results['danceability'], results['energy'],
                        results['valence'], results['acousticness'], results['instrumentalness'],
                        results['speechiness'], results['liveness'], results['bpm'],
                        results['key'], results['confidence'], datetime.now().isoformat(),
                        file_id
                    ))
                else:
                    # Insertar
                    cursor.execute("""
                        INSERT INTO llm_metadata (
                            file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ENERGY,
                            AI_VALENCE, AI_ACOUSTICNESS, AI_INSTRUMENTALNESS,
                            AI_SPEECHINESS, AI_LIVENESS, AI_BPM, AI_KEY,
                            AI_CONFIDENCE, AI_ANALYZED_DATE
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        file_id,
                        results['loudness'], results['danceability'], results['energy'],
                        results['valence'], results['acousticness'], results['instrumentalness'],
                        results['speechiness'], results['liveness'], results['bpm'],
                        results['key'], results['confidence'], datetime.now().isoformat()
                    ))
                
                conn.commit()
                processed += 1
                
                # Mostrar detalles cada 50 archivos procesados
                if processed % 50 == 0:
                    print(f"  ✅ {processed} archivos procesados exitosamente")
                
            except Exception as e:
                failed += 1
                print(f"  ❌ Error DB para {file_name[:30]}: {str(e)[:50]}")
        else:
            failed += 1
    
    # Estadísticas finales
    print("\n" + "="*60)
    print("📈 PROCESAMIENTO COMPLETADO")
    print("="*60)
    print(f"   ✅ Procesados: {processed}")
    print(f"   ❌ Fallidos: {failed}")
    print(f"   📊 Tasa de éxito: {processed*100/(processed+failed):.1f}%")
    
    # Verificar nuevas estadísticas
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE > 0.5 
        AND AI_LOUDNESS IS NOT NULL
    """)
    new_analyzed = cursor.fetchone()[0]
    
    print(f"\n📊 Estadísticas finales:")
    print(f"   Total en BD: {total}")
    print(f"   Analizados: {new_analyzed}")
    print(f"   Incremento: +{new_analyzed - analyzed}")
    
    conn.close()
    print("\n✨ Proceso terminado exitosamente!")

if __name__ == '__main__':
    main()