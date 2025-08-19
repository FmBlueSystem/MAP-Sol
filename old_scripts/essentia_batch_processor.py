#!/usr/bin/env python3
"""
ESSENTIA BATCH PROCESSOR
Procesamiento masivo optimizado con progreso visual y manejo de errores
"""

import os
import sys
import time
import sqlite3
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed
import signal

# Importar el analizador principal
from essentia_7params import Essentia7Params

class BatchProcessor:
    def __init__(self, db_path='music_analyzer.db', workers=4):
        self.db_path = db_path
        self.workers = min(workers, mp.cpu_count())
        self.start_time = time.time()
        self.processed = 0
        self.errors = 0
        self.total_pending = 0
        
        # Para manejar interrupción
        signal.signal(signal.SIGINT, self.signal_handler)
        self.interrupted = False
        
        print(f"""
╔══════════════════════════════════════════╗
║    ESSENTIA BATCH PROCESSOR v2.0        ║
╚══════════════════════════════════════════╝
        
📊 Database: {db_path}
🔧 Workers: {self.workers} parallel processes
⏰ Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """)
    
    def signal_handler(self, sig, frame):
        """Manejar Ctrl+C gracefully"""
        print("\n\n⚠️  Interruption received. Finishing current files...")
        self.interrupted = True
    
    def get_pending_files(self, limit=None):
        """Obtener archivos pendientes de análisis"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                af.id, 
                af.file_path
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.file_path IS NOT NULL
            AND af.file_path != ''
            AND (
                lm.file_id IS NULL
                OR lm.AI_LOUDNESS IS NULL 
                OR lm.AI_DANCEABILITY IS NULL
                OR lm.AI_ACOUSTICNESS IS NULL
                OR lm.AI_INSTRUMENTALNESS IS NULL
                OR lm.AI_LIVENESS IS NULL
                OR lm.AI_SPEECHINESS IS NULL
                OR lm.AI_VALENCE IS NULL
            )
            ORDER BY af.id
        '''
        
        if limit:
            query += f' LIMIT {limit}'
        
        cursor.execute(query)
        files = cursor.fetchall()
        conn.close()
        
        return files
    
    def process_single_file(self, file_data):
        """Procesar un archivo individual"""
        file_id, file_path = file_data
        
        try:
            # Verificar que el archivo existe
            if not os.path.exists(file_path):
                return file_id, 'not_found', None
            
            # Crear analizador para este proceso
            analyzer = Essentia7Params(self.db_path)
            
            # Analizar
            result = analyzer.analyze_file(file_path, file_id)
            analyzer.close()
            
            if result:
                return file_id, 'success', result
            else:
                return file_id, 'error', None
                
        except Exception as e:
            return file_id, 'error', str(e)
    
    def update_progress(self, current, total, errors):
        """Actualizar barra de progreso"""
        elapsed = time.time() - self.start_time
        rate = current / elapsed if elapsed > 0 else 0
        remaining = (total - current) / rate if rate > 0 else 0
        
        bar_length = 40
        filled = int(bar_length * current / total) if total > 0 else 0
        bar = '█' * filled + '░' * (bar_length - filled)
        
        eta = datetime.now() + timedelta(seconds=remaining)
        
        sys.stdout.write(f'\r[{bar}] {current}/{total} ({current/total*100:.1f}%) | '
                        f'Errors: {errors} | Rate: {rate:.1f}/s | '
                        f'ETA: {eta.strftime("%H:%M:%S")}')
        sys.stdout.flush()
    
    def process_batch_parallel(self, limit=None):
        """Procesar archivos en paralelo"""
        # Obtener archivos pendientes
        print("🔍 Scanning for pending files...")
        files = self.get_pending_files(limit)
        self.total_pending = len(files)
        
        if self.total_pending == 0:
            print("✅ No pending files to process!")
            return
        
        print(f"📦 Found {self.total_pending} files to process\n")
        print("Starting parallel processing...\n")
        
        # Procesar en paralelo
        with ProcessPoolExecutor(max_workers=self.workers) as executor:
            # Enviar trabajos
            futures = {executor.submit(self.process_single_file, file_data): file_data 
                      for file_data in files}
            
            # Procesar resultados conforme van llegando
            for future in as_completed(futures):
                if self.interrupted:
                    executor.shutdown(wait=False)
                    break
                
                try:
                    file_id, status, result = future.result(timeout=60)
                    
                    if status == 'success':
                        self.processed += 1
                    elif status == 'not_found':
                        self.errors += 1
                        print(f"\n⚠️  File {file_id} not found")
                    else:
                        self.errors += 1
                    
                    # Actualizar progreso
                    total_done = self.processed + self.errors
                    self.update_progress(total_done, self.total_pending, self.errors)
                    
                except Exception as e:
                    self.errors += 1
                    print(f"\n❌ Error processing file: {e}")
        
        print("\n")  # Nueva línea después de la barra de progreso
    
    def get_statistics(self):
        """Mostrar estadísticas finales"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(DISTINCT af.id) as total_files,
                COUNT(DISTINCT CASE 
                    WHEN lm.AI_LOUDNESS IS NOT NULL 
                    AND lm.AI_DANCEABILITY IS NOT NULL 
                    AND lm.AI_ACOUSTICNESS IS NOT NULL 
                    AND lm.AI_INSTRUMENTALNESS IS NOT NULL 
                    AND lm.AI_LIVENESS IS NOT NULL 
                    AND lm.AI_SPEECHINESS IS NOT NULL 
                    AND lm.AI_VALENCE IS NOT NULL 
                    THEN lm.file_id END) as complete,
                AVG(lm.AI_LOUDNESS) as avg_loudness,
                AVG(lm.AI_DANCEABILITY) as avg_dance,
                AVG(lm.AI_ENERGY) as avg_energy,
                AVG(lm.AI_VALENCE) as avg_valence,
                MIN(lm.AI_LOUDNESS) as min_loudness,
                MAX(lm.AI_LOUDNESS) as max_loudness
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        ''')
        
        stats = cursor.fetchone()
        conn.close()
        
        elapsed = time.time() - self.start_time
        elapsed_str = str(timedelta(seconds=int(elapsed)))
        
        print(f"""
╔══════════════════════════════════════════╗
║         PROCESSING COMPLETE              ║
╚══════════════════════════════════════════╝

📊 Session Results:
├─ Processed: {self.processed} files
├─ Errors: {self.errors}
├─ Time: {elapsed_str}
└─ Rate: {self.processed/elapsed:.2f} files/sec

📈 Database Statistics:
├─ Total files: {stats[0]:,}
├─ Complete (7/7): {stats[1]:,} ({stats[1]/stats[0]*100:.1f}%)
└─ Remaining: {stats[0]-stats[1]:,}

🎵 Audio Characteristics:
├─ Avg Loudness: {stats[2]:.1f} LUFS
├─ Avg Danceability: {stats[3]:.3f}
├─ Avg Energy: {stats[4]:.3f if stats[4] else 0}
├─ Avg Valence: {stats[5]:.3f}
├─ Loudness Range: [{stats[6]:.1f}, {stats[7]:.1f}] LUFS
        """)
    
    def run(self, limit=None, continuous=False):
        """Ejecutar procesamiento"""
        try:
            if continuous:
                # Modo continuo: procesar hasta que no queden archivos
                while not self.interrupted:
                    files = self.get_pending_files(100)
                    if not files:
                        print("✅ All files processed!")
                        break
                    
                    self.process_batch_parallel(100)
                    
                    if not self.interrupted:
                        print("\n🔄 Checking for more files...\n")
                        time.sleep(2)
            else:
                # Procesar una vez
                self.process_batch_parallel(limit)
            
            # Mostrar estadísticas finales
            self.get_statistics()
            
        except Exception as e:
            print(f"\n❌ Fatal error: {e}")
            import traceback
            traceback.print_exc()

def main():
    parser = argparse.ArgumentParser(description='Essentia Batch Processor')
    parser.add_argument('--db', default='music_analyzer.db', help='Database path')
    parser.add_argument('--limit', type=int, help='Limit number of files to process')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--continuous', action='store_true', help='Process continuously until done')
    
    args = parser.parse_args()
    
    processor = BatchProcessor(args.db, args.workers)
    processor.run(args.limit, args.continuous)

if __name__ == '__main__':
    main()