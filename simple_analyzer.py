#!/usr/bin/env python3
"""
SIMPLE AUDIO ANALYZER - Sin multiprocessing
Para diagnosticar problemas con archivos de audio
"""

import os
import sys
import sqlite3
import numpy as np
import warnings
import tempfile
import subprocess
from datetime import datetime

# Suprimir warnings
warnings.filterwarnings('ignore')

def analyze_file_simple(file_path):
    """Análisis simple de un archivo"""
    print(f"\n📁 Analizando: {file_path}")
    
    # Verificar que existe
    if not os.path.exists(file_path):
        print(f"❌ Archivo no existe")
        return None
    
    print(f"✅ Archivo existe")
    
    # Intentar con ffmpeg directamente
    print("🔧 Intentando conversión con ffmpeg...")
    
    try:
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            wav_file = tmp.name
        
        # Comando ffmpeg simple
        cmd = [
            'ffmpeg', '-y', '-i', file_path,
            '-ac', '1', '-ar', '44100', 
            '-f', 'wav', wav_file
        ]
        
        print(f"📝 Comando: {' '.join(cmd[:6])}...")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"❌ FFmpeg falló:")
            print(f"   Error: {result.stderr[:200]}")
            os.remove(wav_file)
            return None
        
        # Verificar el archivo WAV
        if os.path.exists(wav_file) and os.path.getsize(wav_file) > 1000:
            size_mb = os.path.getsize(wav_file) / (1024*1024)
            print(f"✅ WAV creado: {size_mb:.1f} MB")
            
            # Intentar cargar con librosa
            try:
                import librosa
                y, sr = librosa.load(wav_file, sr=44100, mono=True)
                duration = len(y) / sr
                print(f"✅ Audio cargado: {duration:.1f} segundos")
                
                # Calcular algunas métricas básicas
                rms = np.sqrt(np.mean(y**2))
                loudness = 20 * np.log10(rms + 1e-10)
                
                os.remove(wav_file)
                
                return {
                    'duration': duration,
                    'loudness': loudness,
                    'samples': len(y)
                }
                
            except Exception as e:
                print(f"❌ Error al cargar con librosa: {e}")
                os.remove(wav_file)
                return None
        else:
            print(f"❌ WAV no válido")
            if os.path.exists(wav_file):
                os.remove(wav_file)
            return None
            
    except subprocess.TimeoutExpired:
        print(f"❌ FFmpeg timeout")
        return None
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        return None

def main():
    print("="*60)
    print("🎵 SIMPLE AUDIO ANALYZER - Diagnóstico")
    print("="*60)
    
    # Conectar a la BD
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # Obtener algunos archivos de prueba
    cursor.execute("""
        SELECT id, file_path, file_name 
        FROM audio_files 
        WHERE id IN (26, 110, 111, 112, 113)
        ORDER BY id
    """)
    
    files = cursor.fetchall()
    conn.close()
    
    print(f"\n📊 Encontrados {len(files)} archivos para probar")
    
    success = 0
    failed = 0
    
    for file_id, file_path, file_name in files:
        print(f"\n{'='*60}")
        print(f"🔍 ID: {file_id}")
        print(f"📄 Nombre: {file_name}")
        
        result = analyze_file_simple(file_path)
        
        if result:
            success += 1
            print(f"✅ ÉXITO:")
            print(f"   Duración: {result['duration']:.1f}s")
            print(f"   Loudness: {result['loudness']:.1f} dB")
        else:
            failed += 1
            print(f"❌ FALLÓ")
    
    print(f"\n{'='*60}")
    print(f"📈 RESUMEN:")
    print(f"   ✅ Exitosos: {success}")
    print(f"   ❌ Fallidos: {failed}")
    print(f"{'='*60}")
    
    # Probar con un archivo local si existe
    print(f"\n🧪 Probando con archivo local de prueba...")
    
    # Crear un archivo de audio de prueba con ffmpeg
    test_file = "test_audio.wav"
    cmd = [
        'ffmpeg', '-y', '-f', 'lavfi', 
        '-i', 'sine=frequency=440:duration=5',
        '-ar', '44100', test_file
    ]
    
    print(f"📝 Creando archivo de prueba...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0 and os.path.exists(test_file):
        print(f"✅ Archivo de prueba creado")
        test_result = analyze_file_simple(test_file)
        if test_result:
            print(f"✅ Archivo de prueba analizado correctamente")
        os.remove(test_file)
    else:
        print(f"❌ No se pudo crear archivo de prueba")

if __name__ == '__main__':
    main()