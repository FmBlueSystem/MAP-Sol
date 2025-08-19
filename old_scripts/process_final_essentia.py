#!/usr/bin/env python3
"""
Procesador FINAL de Essentia para Music Analyzer Pro
Este SÍ funciona y suprime TODOS los warnings
"""

import os
import sys
import sqlite3
import time
from datetime import datetime
from pathlib import Path
import subprocess
import json


def analyze_file_subprocess(file_path):
    """Analiza un archivo en un subproceso para evitar warnings"""
    
    # Script que se ejecutará en el subproceso
    script = """
import sys
import os
import warnings
warnings.filterwarnings('ignore')

# Suprimir TODO output de error
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'
import io
sys.stderr = io.StringIO()

try:
    import numpy as np
    import essentia
    import essentia.standard as es
    
    # Desactivar logs
    essentia.log.warningActive = False
    essentia.log.infoActive = False
    essentia.log.errorActive = False
    
    # Cargar archivo
    file_path = sys.argv[1]
    audio = es.MonoLoader(filename=file_path, sampleRate=44100)()
    
    if len(audio) == 0:
        print('{"error": "empty"}')
        sys.exit(1)
    
    results = {}
    
    # 1. LUFS (aproximado)
    rms = es.RMS()(audio)
    lufs = 20 * np.log10(max(rms, 1e-10))
    results['loudness'] = round(max(-60, min(0, lufs)), 1)
    
    # 2. BPM y Danceability
    rhythm = es.RhythmExtractor2013(method="degara")
    bpm, beats, confidence, _, _ = rhythm(audio)
    results['bpm'] = round(bpm)
    
    energy = es.Energy()(audio)
    bpm_score = 1.0 - min(1.0, abs(bpm - 125) / 60)
    energy_norm = min(1.0, energy / 1000000) if energy > 1 else energy
    results['danceability'] = round(0.6 * bpm_score + 0.4 * energy_norm, 3)
    results['energy'] = round(energy_norm, 3)
    
    # 3. Acousticness
    spectrum = es.Spectrum()(audio[:2048] if len(audio) > 2048 else audio)
    flatness = es.Flatness()(spectrum)
    results['acousticness'] = round(1.0 - flatness, 3)
    
    # 4. Instrumentalness
    zcr = es.ZeroCrossingRate()(audio[:2048] if len(audio) > 2048 else audio)
    results['instrumentalness'] = 0.8 if (zcr < 0.05 or zcr > 0.3) else 0.3
    
    # 5. Liveness
    try:
        complexity = es.DynamicComplexity()(audio)
        if isinstance(complexity, tuple):
            complexity = complexity[0]
        results['liveness'] = round(min(1.0, float(complexity) * 2), 3)
    except:
        results['liveness'] = 0.1
    
    # 6. Speechiness
    frame_size = int(0.025 * 44100)
    hop_size = int(0.010 * 44100)
    energy_values = []
    
    for i in range(0, min(len(audio), 44100*30), hop_size):
        if i + frame_size < len(audio):
            frame = audio[i:i+frame_size]
            energy_values.append(es.Energy()(frame))
    
    if energy_values:
        threshold = np.mean(energy_values) * 0.1
        silence_ratio = sum(1 for e in energy_values if e < threshold) / len(energy_values)
        results['speechiness'] = round(min(1.0, silence_ratio * 2), 3)
    else:
        results['speechiness'] = 0.0
    
    # 7. Valence y Key
    key_extractor = es.KeyExtractor()
    key, scale, strength = key_extractor(audio)
    results['key'] = f"{key} {scale}"
    
    scale_score = 0.7 if scale == 'major' else 0.3
    tempo_score = 0.8 if 120 <= bpm <= 140 else 0.5
    results['valence'] = round(scale_score * 0.6 + tempo_score * 0.4, 3)
    
    # Imprimir JSON
    import json
    print(json.dumps(results))
    
except Exception as e:
    print('{"error": "' + str(e).replace('"', '') + '"}')
"""
    
    try:
        # Ejecutar el script en un subproceso
        result = subprocess.run(
            [sys.executable, '-c', script, file_path],
            capture_output=True,
            text=True,
            timeout=30,
            env={**os.environ, 'PYTHONWARNINGS': 'ignore'}
        )
        
        if result.stdout:
            try:
                return json.loads(result.stdout.strip())
            except:
                return None
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None
    
    return None


class FinalEssentiaProcessor:
    """Procesador final que funciona sin warnings"""
    
    def __init__(self, db_path="music_analyzer.db"):
        self.db_path = db_path
        self.processed = 0
        self.errors = 0
        self.skipped = 0
        self.start_time = time.time()
    
    def get_pending_files(self, limit=None):
        """Obtiene archivos pendientes de procesar"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = """
        SELECT 
            af.id,
            af.file_path,
            af.file_name,
            af.artist,
            af.title
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE (lm.ESSENTIA_PROCESSED IS NULL OR lm.ESSENTIA_PROCESSED = 0)
        AND LOWER(af.file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
        ORDER BY af.id
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query)
        files = cursor.fetchall()
        
        # Total pendientes
        cursor.execute("""
            SELECT COUNT(*) 
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE (lm.ESSENTIA_PROCESSED IS NULL OR lm.ESSENTIA_PROCESSED = 0)
            AND LOWER(af.file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
        """)
        total = cursor.fetchone()[0]
        
        conn.close()
        return files, total
    
    def update_database(self, file_id, results):
        """Actualiza la base de datos con los resultados"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Asegurar que existe registro en llm_metadata
            cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO llm_metadata (file_id) VALUES (?)", (file_id,))
            
            # Actualizar con resultados
            cursor.execute("""
                UPDATE llm_metadata 
                SET 
                    AI_LOUDNESS = ?,
                    AI_DANCEABILITY = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LIVENESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_VALENCE = ?,
                    AI_BPM = ?,
                    AI_ENERGY = ?,
                    AI_KEY = ?,
                    ESSENTIA_PROCESSED = 1,
                    ESSENTIA_DATE = ?
                WHERE file_id = ?
            """, (
                results.get('loudness', -23),
                results.get('danceability', 0.5),
                results.get('acousticness', 0.5),
                results.get('instrumentalness', 0.7),
                results.get('liveness', 0.1),
                results.get('speechiness', 0),
                results.get('valence', 0.5),
                results.get('bpm', 120),
                results.get('energy', 0.5),
                results.get('key', 'C major'),
                datetime.now().isoformat(),
                file_id
            ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"  ❌ Error BD: {e}")
            return False
    
    def process_batch(self, max_files=None):
        """Procesa un lote de archivos"""
        
        print("\n" + "="*70)
        print("🎵 PROCESADOR FINAL DE ESSENTIA (SIN WARNINGS)")
        print("="*70)
        
        # Obtener archivos pendientes
        print("\n📂 Obteniendo archivos pendientes...")
        files, total = self.get_pending_files(limit=max_files)
        
        if not files:
            print("✅ No hay archivos pendientes de procesar")
            return
        
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"📊 Total pendientes: {total}")
        print("\n" + "-"*70 + "\n")
        
        # Procesar archivos
        for i, (file_id, file_path, file_name, artist, title) in enumerate(files, 1):
            # Mostrar progreso
            display_name = f"{artist} - {title}" if artist and title else file_name
            if len(display_name) > 60:
                display_name = display_name[:57] + "..."
            
            progress_pct = (i / len(files)) * 100
            print(f"[{i}/{len(files)}] ({progress_pct:.0f}%) {display_name}")
            
            # Verificar si existe el archivo
            if not os.path.exists(file_path):
                print(f"  ⏭️ Archivo no encontrado")
                self.skipped += 1
                continue
            
            # Analizar archivo
            results = analyze_file_subprocess(file_path)
            
            if results and 'error' not in results:
                # Actualizar base de datos
                if self.update_database(file_id, results):
                    self.processed += 1
                    print(f"  ✅ BPM:{results.get('bpm', 0)} | "
                          f"Dance:{results.get('danceability', 0):.0%} | "
                          f"Val:{results.get('valence', 0):.0%}")
                else:
                    self.errors += 1
            else:
                self.errors += 1
                print(f"  ❌ Error en análisis")
            
            # Mostrar progreso cada 10 archivos
            if i % 10 == 0:
                self.show_progress()
        
        # Resumen final
        self.show_summary()
    
    def show_progress(self):
        """Muestra progreso actual"""
        elapsed = time.time() - self.start_time
        rate = self.processed / elapsed if elapsed > 0 else 0
        
        print(f"\n--- Progreso: {self.processed} procesados | "
              f"{self.skipped} omitidos | {self.errors} errores | "
              f"{rate:.1f} archivos/seg ---\n")
    
    def show_summary(self):
        """Muestra resumen final"""
        elapsed = time.time() - self.start_time
        
        print("\n" + "="*70)
        print("📊 RESUMEN DE PROCESAMIENTO")
        print("="*70)
        
        print(f"""
  ✅ Procesados exitosamente:  {self.processed}
  ⏭️ Archivos omitidos:        {self.skipped}
  ❌ Errores:                  {self.errors}
  ⏱️ Tiempo total:             {elapsed/60:.1f} minutos
  📈 Velocidad promedio:       {self.processed/elapsed:.2f} archivos/segundo
        """)
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'processed': self.processed,
            'skipped': self.skipped,
            'errors': self.errors,
            'duration_minutes': round(elapsed/60, 2),
            'files_per_second': round(self.processed/elapsed, 2) if elapsed > 0 else 0
        }
        
        report_file = f"final_processing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado en: {report_file}")


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador final de Essentia')
    parser.add_argument('--max-files', type=int, default=None,
                       help='Número máximo de archivos a procesar')
    parser.add_argument('--check-status', action='store_true',
                       help='Ver estado del procesamiento')
    
    args = parser.parse_args()
    
    processor = FinalEssentiaProcessor()
    
    if args.check_status:
        # Mostrar estado
        files, total = processor.get_pending_files()
        
        conn = sqlite3.connect(processor.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) 
            FROM audio_files 
            WHERE LOWER(file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
        """)
        total_files = cursor.fetchone()[0]
        conn.close()
        
        processed = total_files - total
        
        print("\n📊 ESTADO DEL PROCESAMIENTO:")
        print(f"  • Total de archivos: {total_files}")
        print(f"  • Procesados: {processed}")
        print(f"  • Pendientes: {total}")
        print(f"  • Progreso: {(processed/total_files*100):.1f}%")
    else:
        # Procesar archivos
        processor.process_batch(max_files=args.max_files)


if __name__ == "__main__":
    main()