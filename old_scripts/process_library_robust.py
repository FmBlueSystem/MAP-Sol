#!/usr/bin/env python3
"""
Procesador Robusto de Biblioteca Musical
Versión optimizada para archivos FLAC y formatos problemáticos
"""

import os
import sys
import json
import sqlite3
import time
from datetime import datetime
from pathlib import Path

# Importar el analizador robusto
from essentia_robust_analyzer import RobustAudioAnalyzer


class RobustLibraryProcessor:
    """Procesador robusto de biblioteca musical"""
    
    def __init__(self, db_path="music_analyzer.db"):
        self.db_path = db_path
        self.analyzer = RobustAudioAnalyzer()
        self.processed = 0
        self.errors = 0
        self.skipped = 0
        self.start_time = None
        
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
        """Actualiza la base de datos con los resultados"""
        try:
            self.ensure_metadata_record(file_id)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Actualizar con resultados
            if results['status'] in ['success', 'partial']:
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
    
    def process_file(self, file_id, file_path, file_name):
        """Procesa un archivo individual"""
        
        # Verificar si el archivo existe
        if not os.path.exists(file_path):
            self.skipped += 1
            return None
        
        try:
            # Analizar con el analizador robusto
            results = self.analyzer.analyze(file_path)
            
            if results['status'] in ['success', 'partial']:
                # Actualizar base de datos
                if self.update_database(file_id, results):
                    self.processed += 1
                    return results
            else:
                self.errors += 1
                
        except Exception as e:
            self.errors += 1
            print(f"  ❌ Error: {e}")
        
        return None
    
    def process_batch(self, max_files=None, show_progress=True):
        """Procesa la biblioteca en lotes"""
        
        print("\n" + "="*70)
        print("🎵 PROCESAMIENTO ROBUSTO DE BIBLIOTECA MUSICAL")
        print("="*70)
        print("ℹ️ Versión optimizada para archivos FLAC")
        print("ℹ️ Warnings de decodificación suprimidos")
        
        self.start_time = time.time()
        
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
            if show_progress:
                display_name = f"{artist} - {title}" if artist and title else file_name
                # Truncar si es muy largo
                if len(display_name) > 60:
                    display_name = display_name[:57] + "..."
                
                progress_pct = (i / len(files)) * 100
                print(f"[{i}/{len(files)}] ({progress_pct:.0f}%) {display_name}")
            
            # Procesar archivo
            results = self.process_file(file_id, file_path, file_name)
            
            if results and show_progress:
                status_icon = "✅" if results['status'] == 'success' else "⚠️"
                print(f"  {status_icon} BPM:{results.get('bpm', 0):.0f} | "
                      f"Dance:{results.get('danceability', 0):.0%} | "
                      f"Val:{results.get('valence', 0):.0%}")
            
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
        
        report_file = f"robust_processing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado en: {report_file}")


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador robusto de biblioteca musical')
    parser.add_argument('--max-files', type=int, default=None,
                       help='Número máximo de archivos a procesar')
    parser.add_argument('--quiet', action='store_true',
                       help='Modo silencioso (sin progreso detallado)')
    parser.add_argument('--check-status', action='store_true',
                       help='Ver estado del procesamiento')
    
    args = parser.parse_args()
    
    processor = RobustLibraryProcessor()
    
    if args.check_status:
        # Mostrar estado
        files, total = processor.get_pending_files()
        
        conn = sqlite3.connect(processor.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM audio_files WHERE LOWER(file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')")
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
        processor.process_batch(
            max_files=args.max_files,
            show_progress=not args.quiet
        )


if __name__ == "__main__":
    main()