#!/Users/freddymolina/venvs/aubio_env/bin/python
"""
LIBROSA SEQUENTIAL ANALYZER
Análisis de audio secuencial (sin multiprocessing)
Compatible con Mac M1 - Más estable
"""

import os
import sys
import sqlite3
import numpy as np
import warnings
import tempfile
import subprocess
from datetime import datetime
import librosa
import soundfile as sf

# Suprimir warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

class LibrosaSequentialAnalyzer:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.processed_count = 0
        self.failed_count = 0
        
    def get_pending_files(self, limit=100):
        """Obtener archivos pendientes de análisis"""
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
    
    def analyze_file(self, file_id, file_path, file_name):
        """Analizar un archivo individual"""
        try:
            # Verificar que el archivo existe
            if not os.path.exists(file_path):
                return None, f"File not found"
            
            # Intentar cargar con librosa
            y = None
            sr = 44100
            
            try:
                # Primer intento: librosa directo
                y, sr = librosa.load(file_path, sr=44100, mono=True, duration=None)
            except:
                try:
                    # Segundo intento: soundfile
                    y, sr_orig = sf.read(file_path)
                    if len(y.shape) > 1:
                        y = np.mean(y, axis=1)
                    if sr_orig != 44100:
                        y = librosa.resample(y, orig_sr=sr_orig, target_sr=44100)
                except:
                    # Tercer intento: convertir con ffmpeg
                    wav_file = None
                    try:
                        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                            wav_file = tmp.name
                        
                        # Comando ffmpeg más robusto
                        cmd = [
                            'ffmpeg', '-v', 'quiet', '-y', 
                            '-i', file_path,
                            '-ac', '1',          # Mono
                            '-ar', '44100',      # Sample rate
                            '-acodec', 'pcm_s16le',  # PCM 16-bit
                            '-f', 'wav',         # Format WAV
                            wav_file
                        ]
                        
                        result = subprocess.run(cmd, capture_output=True, timeout=30)
                        
                        if result.returncode == 0 and os.path.exists(wav_file):
                            y, sr = librosa.load(wav_file, sr=44100, mono=True)
                        
                        if wav_file and os.path.exists(wav_file):
                            os.remove(wav_file)
                    except:
                        pass
            
            # Verificar que tenemos audio válido
            if y is None or len(y) == 0:
                return None, "Failed to load audio"
            
            duration = len(y) / sr
            
            if duration < 5:
                return None, f"Audio too short: {duration:.1f}s"
            
            # Tomar ventana de análisis
            if duration > 120:
                start = int((duration/2 - 30) * sr)
                end = int((duration/2 + 30) * sr)
                analysis_window = y[start:end]
            elif duration > 60:
                analysis_window = y[:60*sr]
            else:
                analysis_window = y
            
            # Calcular características
            results = {}
            
            # 1. Loudness
            rms = librosa.feature.rms(y=analysis_window)[0]
            rms_mean = np.mean(rms)
            results['loudness'] = float(20 * np.log10(rms_mean + 1e-10))
            results['loudness'] = max(-70, min(0, results['loudness']))
            
            # 2. Tempo y Danceability
            try:
                tempo, beats = librosa.beat.beat_track(y=analysis_window, sr=sr)
                results['danceability'] = float(min(1.0, max(0.0, (tempo - 60) / 140)))
                results['tempo'] = float(tempo)
            except:
                results['danceability'] = 0.5
                results['tempo'] = 120.0
            
            # 3. Spectral Centroid para Valence
            spectral_centroids = librosa.feature.spectral_centroid(y=analysis_window, sr=sr)[0]
            results['valence'] = float(min(1.0, max(0.0, (np.mean(spectral_centroids) - 500) / 3000)))
            
            # 4. Zero Crossing Rate para Speechiness
            zcr = librosa.feature.zero_crossing_rate(analysis_window)[0]
            results['speechiness'] = float(min(1.0, max(0.0, np.mean(zcr) * 100)))
            
            # 5. Spectral Rolloff para Acousticness
            spectral_rolloff = librosa.feature.spectral_rolloff(y=analysis_window, sr=sr, roll_percent=0.85)[0]
            rolloff_normalized = np.mean(spectral_rolloff) / (sr/2)
            results['acousticness'] = float(min(1.0, max(0.0, 1.0 - rolloff_normalized)))
            
            # 6. MFCCs para Instrumentalness
            mfccs = librosa.feature.mfcc(y=analysis_window, sr=sr, n_mfcc=13)
            mfcc_var = np.var(mfccs, axis=1)
            results['instrumentalness'] = float(min(1.0, max(0.0, 1.0 - (np.mean(mfcc_var) / 100))))
            
            # 7. Liveness
            energy = librosa.feature.rms(y=analysis_window)[0]
            energy_var = np.var(energy)
            results['liveness'] = float(min(1.0, max(0.0, energy_var * 10)))
            
            # 8. Energy
            results['energy'] = float(min(1.0, max(0.0, rms_mean * 10)))
            
            # 9. Key detection
            try:
                chroma = librosa.feature.chroma_cqt(y=analysis_window, sr=sr)
                chroma_mean = np.mean(chroma, axis=1)
                key_idx = np.argmax(chroma_mean)
                keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                results['key'] = keys[key_idx]
            except:
                results['key'] = 'C'
            
            # Confidence
            if duration >= 60:
                results['confidence'] = 0.95
            elif duration >= 30:
                results['confidence'] = 0.85
            else:
                results['confidence'] = 0.7
            
            return results, None
            
        except Exception as e:
            return None, f"Error: {str(e)[:100]}"
    
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
                        AI_ENERGY = ?,
                        AI_BPM = ?,
                        AI_KEY = ?,
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
                    results.get('energy', 0.5),
                    results.get('tempo', 120),
                    results.get('key', 'C'),
                    results['confidence'],
                    datetime.now().isoformat(),
                    file_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO llm_metadata (
                        file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_SPEECHINESS, AI_LIVENESS, 
                        AI_VALENCE, AI_ENERGY, AI_BPM, AI_KEY,
                        AI_CONFIDENCE, AI_ANALYZED_DATE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    file_id,
                    results['loudness'],
                    results['danceability'],
                    results['acousticness'],
                    results['instrumentalness'],
                    results['speechiness'],
                    results['liveness'],
                    results['valence'],
                    results.get('energy', 0.5),
                    results.get('tempo', 120),
                    results.get('key', 'C'),
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
        """Procesar un batch de archivos secuencialmente"""
        print(f"\n{'='*60}")
        print(f"🎵 LIBROSA SEQUENTIAL ANALYZER")
        print(f"   Compatible con Mac M1 - Procesamiento estable")
        print(f"   Batch size: {batch_size}")
        print(f"{'='*60}")
        
        files = self.get_pending_files(batch_size)
        
        if not files:
            print("✅ No pending files to process!")
            return False
        
        print(f"📊 Found {len(files)} files to process\n")
        
        batch_processed = 0
        batch_failed = 0
        
        for i, (file_id, file_path, file_name) in enumerate(files, 1):
            print(f"[{i}/{len(files)}] Processing: {file_name[:50]}...")
            
            results, error = self.analyze_file(file_id, file_path, file_name)
            
            if results:
                if self.save_results(file_id, results):
                    batch_processed += 1
                    self.processed_count += 1
                    print(f"    ✅ Success | Loud: {results['loudness']:.1f}dB | "
                          f"Dance: {results['danceability']:.2f} | "
                          f"Tempo: {results.get('tempo', 0):.0f}")
                else:
                    batch_failed += 1
                    self.failed_count += 1
                    print(f"    ❌ DB save failed")
            else:
                batch_failed += 1
                self.failed_count += 1
                print(f"    ⚠️  {error}")
        
        print(f"\n{'='*60}")
        print(f"📈 Batch complete:")
        print(f"   ✅ Processed: {batch_processed}/{len(files)}")
        print(f"   ❌ Failed: {batch_failed}/{len(files)}")
        print(f"   📊 Total session: {self.processed_count} processed, {self.failed_count} failed")
        success_rate = self.processed_count/(self.processed_count+self.failed_count)*100 if (self.processed_count+self.failed_count) > 0 else 0
        print(f"   📈 Success rate: {success_rate:.1f}%")
        print(f"{'='*60}\n")
        
        return True
    
    def process_continuous(self, total_files=None):
        """Procesar archivos continuamente"""
        print("\n🔄 Starting continuous sequential processing...")
        
        batch_num = 0
        while True:
            batch_num += 1
            print(f"\n📦 Processing batch #{batch_num}")
            
            if not self.process_batch(100):
                break
            
            if total_files and self.processed_count >= total_files:
                print(f"\n✅ Reached target of {total_files} files")
                break
        
        print(f"\n🎉 PROCESSING COMPLETE!")
        print(f"   Total processed: {self.processed_count}")
        print(f"   Total failed: {self.failed_count}")
        if (self.processed_count + self.failed_count) > 0:
            print(f"   Success rate: {self.processed_count/(self.processed_count+self.failed_count)*100:.1f}%")

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Librosa Sequential Analyzer for Mac M1')
    parser.add_argument('--batch', type=int, default=100, help='Batch size')
    parser.add_argument('--test', action='store_true', help='Test with 5 files')
    parser.add_argument('--continuous', action='store_true', help='Process all pending files')
    parser.add_argument('--limit', type=int, help='Limit total files to process')
    
    args = parser.parse_args()
    
    analyzer = LibrosaSequentialAnalyzer()
    
    if args.test:
        print("🧪 TEST MODE - Processing 5 files")
        analyzer.process_batch(5)
    elif args.continuous:
        analyzer.process_continuous(args.limit)
    else:
        analyzer.process_batch(args.batch)

if __name__ == '__main__':
    main()