#!/usr/bin/env python3
"""
Procesador Ultra-Seguro de Biblioteca Musical
Versión que evita crashes usando subprocesos aislados
"""

import os
import sys
import json
import sqlite3
import time
import subprocess
import multiprocessing
from datetime import datetime
from pathlib import Path
import tempfile


def analyze_file_isolated(file_path, timeout=30):
    """Analiza un archivo en un proceso completamente aislado"""
    
    # Crear script temporal para análisis aislado
    script_content = '''
import sys
import os
import warnings
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

# Redirigir stderr para suprimir todo output
import io
sys.stderr = io.StringIO()

try:
    from essentia_robust_analyzer import RobustAudioAnalyzer
    analyzer = RobustAudioAnalyzer()
    results = analyzer.analyze(sys.argv[1])
    
    # Solo imprimir JSON si es exitoso
    if results and results.get('status') in ['success', 'partial']:
        import json
        print(json.dumps(results))
except:
    # Si hay cualquier error, retornar JSON vacío
    print(json.dumps({"status": "error"}))
'''
    
    # Guardar script temporal
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(script_content)
        temp_script = f.name
    
    try:
        # Ejecutar en subproceso aislado
        cmd = [sys.executable, temp_script, file_path]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, 'PYTHONWARNINGS': 'ignore'}
        )
        
        # Parsear resultado
        if result.stdout:
            try:
                return json.loads(result.stdout.strip())
            except:
                pass
                
    except subprocess.TimeoutExpired:
        return {"status": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        # Limpiar script temporal
        try:
            os.unlink(temp_script)
        except:
            pass
    
    return {"status": "error"}


class SafeLibraryProcessor:
    """Procesador ultra-seguro que evita crashes"""
    
    def __init__(self, db_path="music_analyzer.db"):
        self.db_path = db_path
        self.processed = 0
        self.errors = 0
        self.skipped = 0
        self.crashes = 0
        self.start_time = None
        
    def get_pending_files(self, limit=None):
        """Obtiene archivos pendientes"""
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
    
    def ensure_metadata_record(self, file_id):
        """Asegura que existe registro en llm_metadata"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO llm_metadata (file_id) VALUES (?)", (file_id,))
            conn.commit()
        
        conn.close()
    
    def update_database(self, file_id, results):
        """Actualiza la base de datos"""
        try:
            self.ensure_metadata_record(file_id)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
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
    
    def process_file_safe(self, file_id, file_path, file_name):
        """Procesa un archivo de forma ultra-segura"""
        
        # Verificar si existe
        if not os.path.exists(file_path):
            self.skipped += 1
            return None
        
        # Analizar en proceso aislado
        results = analyze_file_isolated(file_path, timeout=30)
        
        if results:
            status = results.get('status', 'error')
            
            if status in ['success', 'partial']:
                # Actualizar BD
                if self.update_database(file_id, results):
                    self.processed += 1
                    return results
            elif status == 'timeout':
                self.errors += 1
                print(f"  ⏱️ Timeout procesando archivo")
            else:
                self.errors += 1
        else:
            self.crashes += 1
            print(f"  💥 Crash evitado")
        
        return None
    
    def process_batch(self, max_files=None):
        """Procesa la biblioteca de forma segura"""
        
        print("\n" + "="*70)
        print("🎵 PROCESAMIENTO ULTRA-SEGURO DE BIBLIOTECA MUSICAL")
        print("="*70)
        print("ℹ️ Usando subprocesos aislados para evitar crashes")
        print("ℹ️ Cada archivo se procesa en un entorno protegido")
        
        self.start_time = time.time()
        
        # Obtener archivos
        print("\n📂 Obteniendo archivos pendientes...")
        files, total = self.get_pending_files(limit=max_files)
        
        if not files:
            print("✅ No hay archivos pendientes")
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
            
            progress = (i / len(files)) * 100
            print(f"[{i}/{len(files)}] ({progress:.0f}%) {display_name}")
            
            # Procesar de forma segura
            results = self.process_file_safe(file_id, file_path, file_name)
            
            if results:
                # Mostrar resultado básico
                print(f"  ✅ Procesado OK")
            
            # Progreso cada 10 archivos
            if i % 10 == 0:
                self.show_progress()
        
        # Resumen final
        self.show_summary()
    
    def show_progress(self):
        """Muestra progreso"""
        elapsed = time.time() - self.start_time
        rate = self.processed / elapsed if elapsed > 0 else 0
        
        print(f"\n--- Progreso: {self.processed} OK | "
              f"{self.skipped} omitidos | {self.errors} errores | "
              f"{self.crashes} crashes evitados | "
              f"{rate:.1f} archivos/seg ---\n")
    
    def show_summary(self):
        """Muestra resumen final"""
        elapsed = time.time() - self.start_time
        
        print("\n" + "="*70)
        print("📊 RESUMEN DE PROCESAMIENTO SEGURO")
        print("="*70)
        
        print(f"""
  ✅ Procesados exitosamente:  {self.processed}
  ⏭️ Archivos omitidos:        {self.skipped}
  ❌ Errores/Timeouts:         {self.errors}
  💥 Crashes evitados:         {self.crashes}
  ⏱️ Tiempo total:             {elapsed/60:.1f} minutos
  📈 Velocidad promedio:       {self.processed/elapsed:.2f} archivos/segundo
        """)
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'processed': self.processed,
            'skipped': self.skipped,
            'errors': self.errors,
            'crashes_avoided': self.crashes,
            'duration_minutes': round(elapsed/60, 2)
        }
        
        report_file = f"safe_processing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado en: {report_file}")


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador ultra-seguro de biblioteca musical')
    parser.add_argument('--max-files', type=int, default=None,
                       help='Número máximo de archivos a procesar')
    parser.add_argument('--check-status', action='store_true',
                       help='Ver estado del procesamiento')
    
    args = parser.parse_args()
    
    processor = SafeLibraryProcessor()
    
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