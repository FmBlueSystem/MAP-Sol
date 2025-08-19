#!/usr/bin/env python3
"""
ESSENTIA SAFE VERSION
Versión a prueba de crashes que procesa archivos en subprocesos aislados
"""

import os
import sys
import sqlite3
import subprocess
import json
import tempfile
from datetime import datetime

class EssentiaSafeAnalyzer:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.processed_count = 0
        self.failed_count = 0
        self.crashed_count = 0
        
    def get_pending_files(self, limit=100):
        """Obtener archivos pendientes o con datos incorrectos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT af.id, af.file_path, af.file_name
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.file_path IS NOT NULL
            AND (
                lm.AI_LOUDNESS IS NULL 
                OR typeof(lm.AI_LOUDNESS) != 'real'
                OR lm.AI_CONFIDENCE < 0.5
                OR lm.AI_DANCEABILITY > 1.0 
                OR lm.AI_DANCEABILITY < 0
            )
            ORDER BY af.id
            LIMIT ?
        """, (limit,))
        
        files = cursor.fetchall()
        conn.close()
        return files
    
    def analyze_in_subprocess(self, file_path, file_id):
        """Analizar archivo en un subproceso aislado para evitar crashes"""
        
        # Crear script temporal para el análisis
        script = f'''
import sys
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')

import json
import numpy as np

# Suprimir completamente los warnings de Essentia
import logging
logging.getLogger().setLevel(logging.ERROR)

try:
    import essentia.standard as es
except ImportError:
    print(json.dumps({{"error": "Essentia not installed"}}))
    sys.exit(1)

file_path = {repr(file_path)}
file_id = {file_id}

try:
    # Intentar cargar el archivo
    loader = es.MonoLoader(filename=file_path, sampleRate=44100)
    audio = loader()
    
    if len(audio) < 44100 * 10:  # Mínimo 10 segundos
        print(json.dumps({{"error": "Audio too short"}}))
        sys.exit(0)
    
    # Tomar 60 segundos del medio si es posible
    duration = len(audio) / 44100
    if duration > 120:
        start = int((duration/2 - 30) * 44100)
        end = int((duration/2 + 30) * 44100)
        analysis_window = audio[start:end]
    elif duration > 60:
        analysis_window = audio[:60*44100]
    else:
        analysis_window = audio
    
    # Calcular parámetros básicos pero seguros
    results = {{}}
    
    # 1. Loudness (siempre funciona)
    rms = np.sqrt(np.mean(analysis_window**2))
    results['loudness'] = float(max(-70, min(0, 20 * np.log10(rms + 1e-10))))
    
    # 2. Danceability (con try/except)
    try:
        danceability = es.Danceability()
        d = danceability(analysis_window)
        results['danceability'] = float(min(1.0, max(0.0, d if d <= 1.0 else d/3.5)))
    except:
        results['danceability'] = 0.5
    
    # 3. Energy como proxy de acousticness
    energy = es.Energy()
    e = energy(analysis_window)
    results['acousticness'] = float(min(1.0, max(0.0, 1.0 - e)))
    
    # 4. ZCR para instrumentalness
    zcr = np.mean(np.abs(np.diff(np.sign(analysis_window))) / 2)
    results['instrumentalness'] = float(min(1.0, max(0.0, 1.0 - min(1.0, zcr / 0.1))))
    
    # 5. Speechiness basado en varianza
    frame_size = 2048
    frames = []
    for i in range(0, min(len(analysis_window), 44100*10) - frame_size, 512):
        frame = analysis_window[i:i+frame_size]
        frames.append(np.sum(frame**2))
    
    if frames:
        energy_var = np.var(frames)
        results['speechiness'] = float(min(1.0, max(0.0, energy_var * 1000)))
    else:
        results['speechiness'] = 0.1
    
    # 6. Liveness simplificado
    results['liveness'] = 0.15  # Valor conservador
    
    # 7. Valence basado en centroide espectral
    spectrum = np.abs(np.fft.rfft(analysis_window[:8192]))
    freqs = np.fft.rfftfreq(8192, 1/44100)
    if np.sum(spectrum) > 0:
        centroid = np.sum(spectrum * freqs) / np.sum(spectrum)
        results['valence'] = float(min(1.0, max(0.0, (centroid - 500) / 2500)))
    else:
        results['valence'] = 0.5
    
    # Confidence basado en duración
    if duration >= 60:
        results['confidence'] = 0.9
    elif duration >= 30:
        results['confidence'] = 0.8
    else:
        results['confidence'] = 0.6
    
    print(json.dumps(results))
    
except Exception as e:
    print(json.dumps({{"error": str(e)}}))
'''
        
        # Escribir script temporal
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(script)
            temp_script = f.name
        
        try:
            # Ejecutar en subproceso con timeout
            result = subprocess.run(
                [sys.executable, temp_script],
                capture_output=True,
                text=True,
                timeout=30  # 30 segundos máximo por archivo
            )
            
            # Limpiar archivo temporal
            os.unlink(temp_script)
            
            # Parsear resultado
            if result.returncode != 0:
                return None
            
            try:
                data = json.loads(result.stdout)
                if 'error' in data:
                    return None
                return data
            except json.JSONDecodeError:
                return None
                
        except subprocess.TimeoutExpired:
            os.unlink(temp_script)
            print(f"  ⚠️ Timeout processing file")
            return None
        except Exception as e:
            if os.path.exists(temp_script):
                os.unlink(temp_script)
            print(f"  ⚠️ Subprocess error: {str(e)}")
            return None
    
    def save_results(self, file_id, results):
        """Guardar resultados en la base de datos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Verificar si existe el registro
            cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Actualizar
                cursor.execute("""
                    UPDATE llm_metadata 
                    SET AI_LOUDNESS = ?,
                        AI_DANCEABILITY = ?,
                        AI_ACOUSTICNESS = ?,
                        AI_INSTRUMENTALNESS = ?,
                        AI_SPEECHINESS = ?,
                        AI_LIVENESS = ?,
                        AI_VALENCE = ?,
                        AI_CONFIDENCE = ?,
                        AI_ANALYZED_DATE = ?
                    WHERE file_id = ?
                """, (
                    results['loudness'],
                    results['danceability'],
                    results['acousticness'],
                    results['instrumentalness'],
                    results['speechiness'],
                    results['liveness'],
                    results['valence'],
                    results['confidence'],
                    datetime.now().isoformat(),
                    file_id
                ))
            else:
                # Insertar
                cursor.execute("""
                    INSERT INTO llm_metadata (
                        file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_SPEECHINESS, AI_LIVENESS, 
                        AI_VALENCE, AI_CONFIDENCE, AI_ANALYZED_DATE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    file_id,
                    results['loudness'],
                    results['danceability'],
                    results['acousticness'],
                    results['instrumentalness'],
                    results['speechiness'],
                    results['liveness'],
                    results['valence'],
                    results['confidence'],
                    datetime.now().isoformat()
                ))
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"  ❌ Database error: {str(e)}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def process_batch(self, batch_size=100):
        """Procesar un batch de archivos de forma segura"""
        print(f"\n{'='*60}")
        print(f"🛡️ ESSENTIA SAFE - Processing batch of {batch_size} files")
        print(f"{'='*60}")
        
        files = self.get_pending_files(batch_size)
        
        if not files:
            print("✅ No pending files to process!")
            return False
        
        print(f"📊 Found {len(files)} files to process\n")
        
        for i, (file_id, file_path, file_name) in enumerate(files, 1):
            print(f"[{i}/{len(files)}] File ID {file_id}: {file_name[:50]}...")
            
            if not os.path.exists(file_path):
                print(f"  ❌ File not found")
                self.failed_count += 1
                continue
            
            # Analizar en subproceso aislado
            results = self.analyze_in_subprocess(file_path, file_id)
            
            if results:
                if self.save_results(file_id, results):
                    self.processed_count += 1
                    print(f"  ✅ Processed successfully")
                else:
                    self.failed_count += 1
                    print(f"  ❌ Failed to save")
            else:
                self.failed_count += 1
                print(f"  ⚠️ Analysis failed (possibly crashed)")
        
        print(f"\n{'='*60}")
        print(f"📈 Batch complete:")
        print(f"   ✅ Processed: {self.processed_count}")
        print(f"   ❌ Failed: {self.failed_count}")
        print(f"{'='*60}\n")
        
        return True

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Essentia Safe Analyzer')
    parser.add_argument('--batch', type=int, default=100, help='Batch size')
    
    args = parser.parse_args()
    
    analyzer = EssentiaSafeAnalyzer()
    analyzer.process_batch(args.batch)

if __name__ == '__main__':
    main()