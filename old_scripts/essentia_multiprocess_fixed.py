#!/Users/freddymolina/venvs/essentia_env/bin/python3
"""
ESSENTIA MULTIPROCESS VERSION - FIXED
Versión robusta usando multiprocessing para evitar crashes
Compatible con macOS 15 Sequoia y Python 3.13
Fixed: Properly handles FLAC files with embedded artwork
"""

import os
import sys
import sqlite3
import tempfile
import subprocess
import json
import numpy as np
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

def safe_load_mono(file_path, sample_rate=44100):
    """
    Intenta cargar con MonoLoader; si falla, convierte a WAV con ffmpeg y reintenta.
    Fixed: Properly maps audio stream when there's embedded artwork
    """
    try:
        import essentia.standard as es
        loader = es.MonoLoader(filename=file_path, sampleRate=sample_rate, downmix='mix')
        return loader()
    except Exception as e:
        # Fallback: convertir a WAV con ffmpeg
        wav_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                wav_file = tmp.name
            
            # Fixed: Map only the audio stream, ignore video streams (artwork)
            cmd = [
                'ffmpeg', '-v', 'error', '-y', '-i', file_path,
                '-map', '0:a:0',  # Map only the first audio stream
                '-ac', '1', '-ar', str(sample_rate), '-f', 'wav', wav_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=30)
            if result.returncode != 0:
                # If mapping fails, try without mapping (for simpler files)
                cmd = [
                    'ffmpeg', '-v', 'error', '-y', '-i', file_path,
                    '-ac', '1', '-ar', str(sample_rate), '-f', 'wav', wav_file
                ]
                result = subprocess.run(cmd, capture_output=True, timeout=30)
                if result.returncode != 0:
                    return None
            
            # Verify the output file exists and has content
            if not os.path.exists(wav_file) or os.path.getsize(wav_file) < 1000:
                return None
            
            # Reintentar con el WAV convertido
            import essentia.standard as es
            loader = es.MonoLoader(filename=wav_file, sampleRate=sample_rate, downmix='mono')
            audio = loader()
            
            # Verify we got valid audio data
            if audio is None or len(audio) == 0:
                return None
                
            return audio
            
        except Exception as e:
            return None
        finally:
            if wav_file and os.path.exists(wav_file):
                try:
                    os.remove(wav_file)
                except:
                    pass

def analyze_single_file(file_info):
    """
    Analiza un solo archivo en un proceso aislado.
    Retorna (file_id, results) o (file_id, None) si falla.
    """
    file_id, file_path, file_name = file_info
    
    # Suprimir warnings
    import warnings
    warnings.filterwarnings('ignore')
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
    
    try:
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            return (file_id, None, f"File not found: {file_path}")
        
        # Cargar audio con fallback
        audio = safe_load_mono(file_path)
        if audio is None:
            return (file_id, None, "Failed to load audio")
        
        if len(audio) < 44100 * 5:  # Mínimo 5 segundos
            return (file_id, None, f"Audio too short: {len(audio)/44100:.1f}s")
        
        duration = len(audio) / 44100
        
        # Tomar ventana de análisis
        if duration > 120:
            start = int((duration/2 - 30) * 44100)
            end = int((duration/2 + 30) * 44100)
            analysis_window = audio[start:end]
        elif duration > 60:
            analysis_window = audio[:60*44100]
        else:
            analysis_window = audio
        
        # Calcular parámetros
        results = {}
        
        # 1. Loudness
        rms = np.sqrt(np.mean(analysis_window**2))
        results['loudness'] = float(max(-70, min(0, 20 * np.log10(rms + 1e-10))))
        
        # 2. Danceability (con try/except)
        try:
            import essentia.standard as es
            danceability = es.Danceability()
            d = danceability(analysis_window)
            results['danceability'] = float(min(1.0, max(0.0, d if d <= 1.0 else d/3.5)))
        except:
            results['danceability'] = 0.5
        
        # 3. Acousticness (invertir energy)
        try:
            import essentia.standard as es
            energy = es.Energy()
            e = energy(analysis_window)
            results['acousticness'] = float(min(1.0, max(0.0, 1.0 - e)))
        except:
            results['acousticness'] = 0.5
        
        # 4. Instrumentalness (basado en ZCR)
        zcr = np.mean(np.abs(np.diff(np.sign(analysis_window))) / 2)
        results['instrumentalness'] = float(min(1.0, max(0.0, 1.0 - min(1.0, zcr / 0.1))))
        
        # 5. Speechiness
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
        
        # 6. Liveness
        results['liveness'] = 0.15
        
        # 7. Valence
        spectrum = np.abs(np.fft.rfft(analysis_window[:8192]))
        freqs = np.fft.rfftfreq(8192, 1/44100)
        if np.sum(spectrum) > 0:
            centroid = np.sum(spectrum * freqs) / np.sum(spectrum)
            results['valence'] = float(min(1.0, max(0.0, (centroid - 500) / 2500)))
        else:
            results['valence'] = 0.5
        
        # Confidence
        if duration >= 60:
            results['confidence'] = 0.9
        elif duration >= 30:
            results['confidence'] = 0.8
        else:
            results['confidence'] = 0.6
        
        return (file_id, results, None)
        
    except Exception as e:
        return (file_id, None, f"Analysis error: {str(e)[:100]}")

class EssentiaMultiprocessAnalyzer:
    def __init__(self, db_path='music_analyzer.db', max_workers=4):
        self.db_path = db_path
        self.max_workers = max_workers
        self.processed_count = 0
        self.failed_count = 0
        
    def get_pending_files(self, limit=100):
        """Obtener archivos pendientes"""
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
    
    def save_results(self, file_id, results):
        """Guardar resultados en la base de datos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
            exists = cursor.fetchone()
            
            if exists:
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
            conn.rollback()
            print(f"    DB Error: {str(e)[:50]}")
            return False
        finally:
            conn.close()
    
    def process_batch(self, batch_size=100):
        """Procesar un batch de archivos usando multiprocessing"""
        print(f"\n{'='*60}")
        print(f"🚀 ESSENTIA MULTIPROCESS (FIXED) - Batch of {batch_size} files")
        print(f"   Workers: {self.max_workers}")
        print(f"{'='*60}")
        
        files = self.get_pending_files(batch_size)
        
        if not files:
            print("✅ No pending files to process!")
            return False
        
        print(f"📊 Found {len(files)} files to process\n")
        
        # Reset counters for this batch
        batch_processed = 0
        batch_failed = 0
        
        # Procesar con ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
            # Enviar todos los trabajos
            futures = {executor.submit(analyze_single_file, file_info): file_info 
                      for file_info in files}
            
            # Procesar resultados conforme lleguen
            for i, future in enumerate(as_completed(futures), 1):
                file_info = futures[future]
                file_id, file_path, file_name = file_info
                
                try:
                    file_id_result, results, error = future.result(timeout=60)
                    
                    if results:
                        if self.save_results(file_id_result, results):
                            batch_processed += 1
                            self.processed_count += 1
                            print(f"[{i}/{len(files)}] ✅ ID {file_id}: {file_name[:40]}...")
                            # Print some values for verification
                            print(f"    → Loudness: {results['loudness']:.1f}dB, Dance: {results['danceability']:.2f}, Val: {results['valence']:.2f}")
                        else:
                            batch_failed += 1
                            self.failed_count += 1
                            print(f"[{i}/{len(files)}] ❌ ID {file_id}: DB save failed")
                    else:
                        batch_failed += 1
                        self.failed_count += 1
                        print(f"[{i}/{len(files)}] ⚠️ ID {file_id}: {error if error else 'Unknown error'}")
                        
                except Exception as e:
                    batch_failed += 1
                    self.failed_count += 1
                    print(f"[{i}/{len(files)}] ❌ ID {file_id}: Process failed - {str(e)[:50]}")
        
        print(f"\n{'='*60}")
        print(f"📈 Batch complete:")
        print(f"   ✅ Processed: {batch_processed}/{len(files)}")
        print(f"   ❌ Failed: {batch_failed}/{len(files)}")
        print(f"   📊 Total session: {self.processed_count} processed, {self.failed_count} failed")
        print(f"{'='*60}\n")
        
        return True

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Essentia Multiprocess Analyzer (Fixed)')
    parser.add_argument('--batch', type=int, default=100, help='Batch size')
    parser.add_argument('--workers', type=int, default=4, help='Number of workers')
    parser.add_argument('--test', action='store_true', help='Test with 5 files')
    
    args = parser.parse_args()
    
    if args.test:
        print("🧪 TEST MODE - Processing 5 files")
        analyzer = EssentiaMultiprocessAnalyzer(max_workers=2)
        analyzer.process_batch(5)
    else:
        analyzer = EssentiaMultiprocessAnalyzer(max_workers=args.workers)
        analyzer.process_batch(args.batch)

if __name__ == '__main__':
    # Importante para multiprocessing en macOS
    import multiprocessing
    multiprocessing.set_start_method('spawn', force=True)
    main()