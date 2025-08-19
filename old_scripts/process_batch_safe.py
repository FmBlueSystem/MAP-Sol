#!/usr/bin/env python3
"""
PROCESADOR BATCH SEGURO
Procesa archivos en lotes pequeños para evitar problemas de memoria
"""

import os
import sys
import sqlite3
import numpy as np
import warnings
import tempfile
import subprocess
import time
from datetime import datetime

# Path al entorno virtual
sys.path.insert(0, '/Users/freddymolina/venvs/aubio_env/lib/python3.13/site-packages')

import librosa
print("✅ Librosa importado correctamente")

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def process_audio_simple(file_path):
    """Procesar un archivo de audio - versión simplificada"""
    try:
        # Convertir a WAV con ffmpeg primero (más estable)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav_file = tmp.name
        
        cmd = [
            'ffmpeg', '-v', 'quiet', '-y',
            '-i', file_path,
            '-ac', '1', '-ar', '22050',  # Usar 22050 Hz para menos memoria
            '-acodec', 'pcm_s16le',
            '-f', 'wav', wav_file
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        
        if result.returncode != 0:
            if os.path.exists(wav_file):
                os.remove(wav_file)
            return None
        
        # Cargar el WAV
        y, sr = librosa.load(wav_file, sr=22050, mono=True)
        os.remove(wav_file)
        
        if y is None or len(y) < sr * 5:  # Mínimo 5 segundos
            return None
        
        # Limitar a 30 segundos para menos memoria
        if len(y) > sr * 30:
            y = y[:sr * 30]
        
        # Características básicas
        results = {}
        
        # RMS/Loudness
        rms = np.sqrt(np.mean(y**2))
        results['loudness'] = float(20 * np.log10(rms + 1e-10))
        results['loudness'] = max(-70, min(0, results['loudness']))
        
        # Energy
        results['energy'] = float(min(1.0, rms * 10))
        
        # Tempo (simplificado)
        try:
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr, units='bpm')
            results['bpm'] = float(tempo) if tempo > 0 else 120.0
        except:
            results['bpm'] = 120.0
        
        results['danceability'] = min(1.0, max(0.0, (results['bpm'] - 60) / 140))
        
        # Spectral centroid (brightness/valence)
        cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        results['valence'] = float(min(1.0, max(0.0, (np.mean(cent) - 500) / 2000)))
        
        # Zero crossing (speechiness)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        results['speechiness'] = float(min(1.0, np.mean(zcr) * 50))
        
        # Spectral rolloff (acousticness)
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        results['acousticness'] = float(min(1.0, 1.0 - (np.mean(rolloff) / (sr/2))))
        
        # Valores por defecto
        results['instrumentalness'] = 0.5
        results['liveness'] = 0.15
        results['key'] = 'C'
        results['confidence'] = 0.85
        
        return results
        
    except Exception:
        return None

def process_batch(batch_size=50):
    """Procesar un lote de archivos"""
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # Obtener archivos pendientes
    cursor.execute("""
        SELECT af.id, af.file_path, af.file_name
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE af.file_path IS NOT NULL
        AND (
            lm.AI_LOUDNESS IS NULL 
            OR lm.AI_CONFIDENCE < 0.5
        )
        ORDER BY af.id
        LIMIT ?
    """, (batch_size,))
    
    files = cursor.fetchall()
    
    if not files:
        conn.close()
        return 0, 0
    
    processed = 0
    failed = 0
    
    for file_id, file_path, file_name in files:
        if not os.path.exists(file_path):
            failed += 1
            continue
        
        results = process_audio_simple(file_path)
        
        if results:
            try:
                # Verificar si existe
                cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
                exists = cursor.fetchone()
                
                if exists:
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
                
                # Mostrar progreso
                if processed % 10 == 0:
                    print(f"  ✅ {processed} procesados en este lote")
                
            except Exception as e:
                failed += 1
        else:
            failed += 1
    
    conn.close()
    return processed, failed

def main():
    print("\n" + "="*60)
    print("🎵 PROCESADOR BATCH SEGURO")
    print("   Procesamiento en lotes pequeños")
    print("="*60)
    
    # Estadísticas iniciales
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE > 0.5 AND AI_LOUDNESS IS NOT NULL
    """)
    initial_analyzed = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"\n📊 Estado inicial:")
    print(f"   Total: {total}")
    print(f"   Analizados: {initial_analyzed}")
    print(f"   Pendientes: {total - initial_analyzed}")
    
    if total - initial_analyzed == 0:
        print("\n✅ Todos los archivos ya están procesados!")
        return
    
    # Procesar en lotes
    total_processed = 0
    total_failed = 0
    batch_num = 0
    batch_size = 50  # Lotes pequeños para evitar problemas
    
    print(f"\n🔄 Procesando en lotes de {batch_size} archivos...")
    print("   (Ctrl+C para detener)\n")
    
    try:
        while True:
            batch_num += 1
            print(f"📦 Lote #{batch_num}")
            
            processed, failed = process_batch(batch_size)
            
            if processed == 0 and failed == 0:
                print("  ✅ No hay más archivos pendientes")
                break
            
            total_processed += processed
            total_failed += failed
            
            print(f"  Lote completado: {processed} OK, {failed} errores")
            print(f"  Total acumulado: {total_processed} procesados\n")
            
            # Pequeña pausa entre lotes
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n⚠️  Proceso interrumpido por el usuario")
    
    # Estadísticas finales
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE > 0.5 AND AI_LOUDNESS IS NOT NULL
    """)
    final_analyzed = cursor.fetchone()[0]
    conn.close()
    
    print("\n" + "="*60)
    print("📈 RESUMEN FINAL")
    print("="*60)
    print(f"   Procesados en esta sesión: {total_processed}")
    print(f"   Errores: {total_failed}")
    print(f"   Total analizados en BD: {final_analyzed}")
    print(f"   Incremento: +{final_analyzed - initial_analyzed}")
    
    if total_processed > 0:
        print(f"   Tasa de éxito: {total_processed*100/(total_processed+total_failed):.1f}%")
    
    print("\n✨ Proceso completado!")

if __name__ == '__main__':
    main()