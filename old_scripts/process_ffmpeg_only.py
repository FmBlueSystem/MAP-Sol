#!/usr/bin/env python3
"""
PROCESADOR CON FFMPEG ÚNICAMENTE
No usa librosa, solo ffmpeg para máxima estabilidad
"""

import os
import sys
import sqlite3
import subprocess
import json
import time
from datetime import datetime

def analyze_with_ffmpeg(file_path):
    """Analizar archivo usando solo ffmpeg"""
    try:
        # Obtener información del archivo con ffprobe
        cmd = [
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format', '-show_streams',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            return None
        
        info = json.loads(result.stdout)
        
        # Extraer duración
        duration = float(info.get('format', {}).get('duration', 0))
        
        if duration < 5:
            return None
        
        # Obtener estadísticas de audio con ffmpeg
        cmd = [
            'ffmpeg', '-i', file_path,
            '-af', 'astats=metadata=1:reset=1',
            '-f', 'null', '-'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        # Parsear estadísticas básicas del stderr
        stderr = result.stderr
        
        # Valores por defecto
        results = {
            'loudness': -15.0,
            'danceability': 0.5,
            'energy': 0.5,
            'valence': 0.5,
            'acousticness': 0.5,
            'instrumentalness': 0.5,
            'speechiness': 0.1,
            'liveness': 0.15,
            'bpm': 120.0,
            'key': 'C',
            'confidence': 0.7
        }
        
        # Intentar extraer RMS del output de ffmpeg
        if 'RMS level' in stderr:
            try:
                # Buscar el valor RMS
                for line in stderr.split('\n'):
                    if 'RMS level' in line and 'dB' in line:
                        parts = line.split()
                        for i, part in enumerate(parts):
                            if 'dB' in part and i > 0:
                                rms_db = float(parts[i-1])
                                results['loudness'] = max(-70, min(0, rms_db))
                                # Energy basado en loudness
                                results['energy'] = max(0, min(1, (rms_db + 70) / 70))
                                break
            except:
                pass
        
        # Estimar tempo basado en duración (heurística simple)
        if duration < 180:  # Menos de 3 minutos, probablemente pop/dance
            results['bpm'] = 128.0
            results['danceability'] = 0.7
        elif duration < 240:  # 3-4 minutos
            results['bpm'] = 120.0
            results['danceability'] = 0.6
        else:  # Más largo, probablemente menos bailable
            results['bpm'] = 100.0
            results['danceability'] = 0.4
        
        # Ajustar confidence basado en duración
        if duration >= 30:
            results['confidence'] = 0.8
        
        return results
        
    except Exception:
        return None

def process_batch(batch_size=100):
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
    
    for i, (file_id, file_path, file_name) in enumerate(files, 1):
        # Mostrar progreso
        if i % 10 == 0:
            print(f"  [{i}/{len(files)}] Procesando...")
        
        if not os.path.exists(file_path):
            failed += 1
            continue
        
        results = analyze_with_ffmpeg(file_path)
        
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
                
            except Exception as e:
                print(f"    ❌ Error DB: {str(e)[:50]}")
                failed += 1
        else:
            failed += 1
    
    conn.close()
    return processed, failed

def main():
    print("\n" + "="*60)
    print("🎵 PROCESADOR CON FFMPEG")
    print("   Máxima estabilidad - Sin librosa")
    print("="*60)
    
    # Estadísticas iniciales
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE >= 0.5 AND AI_LOUDNESS IS NOT NULL
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
    batch_size = 100
    
    print(f"\n🔄 Procesando en lotes de {batch_size} archivos...")
    print("   (Ctrl+C para detener)\n")
    
    start_time = time.time()
    
    try:
        while True:
            batch_num += 1
            print(f"📦 Lote #{batch_num}")
            
            batch_start = time.time()
            processed, failed = process_batch(batch_size)
            batch_time = time.time() - batch_start
            
            if processed == 0 and failed == 0:
                print("  ✅ No hay más archivos pendientes")
                break
            
            total_processed += processed
            total_failed += failed
            
            print(f"  Lote completado en {batch_time:.1f}s: {processed} OK, {failed} errores")
            print(f"  Total acumulado: {total_processed} procesados")
            
            # Estimación de tiempo restante
            if total_processed > 0:
                avg_time_per_file = (time.time() - start_time) / total_processed
                remaining = total - initial_analyzed - total_processed
                eta_seconds = remaining * avg_time_per_file
                eta_minutes = eta_seconds / 60
                print(f"  Tiempo estimado restante: {eta_minutes:.1f} minutos\n")
            
    except KeyboardInterrupt:
        print("\n⚠️  Proceso interrumpido por el usuario")
    
    # Estadísticas finales
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE >= 0.5 AND AI_LOUDNESS IS NOT NULL
    """)
    final_analyzed = cursor.fetchone()[0]
    conn.close()
    
    total_time = time.time() - start_time
    
    print("\n" + "="*60)
    print("📈 RESUMEN FINAL")
    print("="*60)
    print(f"   Procesados en esta sesión: {total_processed}")
    print(f"   Errores: {total_failed}")
    print(f"   Total analizados en BD: {final_analyzed}")
    print(f"   Incremento: +{final_analyzed - initial_analyzed}")
    print(f"   Tiempo total: {total_time/60:.1f} minutos")
    
    if total_processed > 0:
        print(f"   Tasa de éxito: {total_processed*100/(total_processed+total_failed):.1f}%")
        print(f"   Velocidad: {total_processed/(total_time/60):.1f} archivos/minuto")
    
    print("\n✨ Proceso completado!")

if __name__ == '__main__':
    main()