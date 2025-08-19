#!/usr/bin/env python3
"""
Procesador de Biblioteca Musical con Essentia
Music Analyzer Pro - Análisis masivo de características avanzadas
"""

import os
import sys
import json
import sqlite3
import time
import traceback
from datetime import datetime
from pathlib import Path
import numpy as np

# Importar el analizador avanzado
from essentia_advanced_features import AdvancedAudioAnalyzer

class LibraryProcessor:
    """Procesa toda la biblioteca musical con Essentia"""
    
    def __init__(self, db_path="music_analyzer.db", cache_file="processed_files_cache.json"):
        self.db_path = db_path
        self.cache_file = cache_file
        self.analyzer = AdvancedAudioAnalyzer()
        self.processed_count = 0
        self.error_count = 0
        self.skipped_count = 0
        self.start_time = None
        self.errors_log = []
        self.processed_cache = self.load_cache()
        
    def load_cache(self):
        """Carga el caché de archivos ya procesados"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    cache = json.load(f)
                    print(f"📂 Cache cargado: {len(cache)} archivos ya procesados")
                    return set(cache)
            except:
                return set()
        return set()
    
    def save_cache(self):
        """Guarda el caché de archivos procesados"""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(list(self.processed_cache), f)
        except Exception as e:
            print(f"⚠️ Error guardando cache: {e}")
    
    def get_audio_files(self, limit=None, offset=0):
        """Obtiene archivos de audio de la base de datos"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Primero, verificar si existen las columnas necesarias
        cursor.execute("PRAGMA table_info(llm_metadata)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Verificar si necesitamos agregar columnas
        columns_to_add = {
            'AI_LOUDNESS': 'REAL',
            'AI_DANCEABILITY': 'REAL',
            'AI_ACOUSTICNESS': 'REAL',
            'AI_INSTRUMENTALNESS': 'REAL',
            'AI_LIVENESS': 'REAL',
            'AI_SPEECHINESS': 'REAL',
            'AI_VALENCE': 'REAL',
            'ESSENTIA_PROCESSED': 'INTEGER DEFAULT 0',
            'ESSENTIA_DATE': 'TIMESTAMP'
        }
        
        for col_name, col_type in columns_to_add.items():
            if col_name not in columns:
                try:
                    cursor.execute(f"ALTER TABLE llm_metadata ADD COLUMN {col_name} {col_type}")
                    print(f"✅ Columna agregada: {col_name}")
                except:
                    pass
        
        conn.commit()
        
        # Obtener archivos para procesar
        query = """
        SELECT 
            af.id,
            af.file_path,
            af.file_name,
            af.artist,
            af.title,
            af.file_extension
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE LOWER(af.file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
        AND (lm.ESSENTIA_PROCESSED IS NULL OR lm.ESSENTIA_PROCESSED = 0)
        ORDER BY af.id
        """
        
        if limit:
            query += f" LIMIT {limit} OFFSET {offset}"
        
        cursor.execute(query)
        files = cursor.fetchall()
        
        # También obtener el total
        cursor.execute("""
            SELECT COUNT(*) 
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE LOWER(af.file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
            AND (lm.ESSENTIA_PROCESSED IS NULL OR lm.ESSENTIA_PROCESSED = 0)
        """)
        total = cursor.fetchone()[0]
        
        conn.close()
        
        return files, total
    
    def ensure_llm_metadata_exists(self, file_id):
        """Asegura que existe un registro en llm_metadata para el archivo"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
        if not cursor.fetchone():
            # Crear registro vacío
            cursor.execute("INSERT INTO llm_metadata (file_id) VALUES (?)", (file_id,))
            conn.commit()
        
        conn.close()
    
    def update_database(self, file_id, results):
        """Actualiza la base de datos con los resultados"""
        try:
            # Asegurar que existe el registro
            self.ensure_llm_metadata_exists(file_id)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Actualizar con los resultados de Essentia
            update_query = """
            UPDATE llm_metadata 
            SET 
                AI_LOUDNESS = ?,
                AI_DANCEABILITY = ?,
                AI_ACOUSTICNESS = ?,
                AI_INSTRUMENTALNESS = ?,
                AI_LIVENESS = ?,
                AI_SPEECHINESS = ?,
                AI_VALENCE = ?,
                ESSENTIA_PROCESSED = 1,
                ESSENTIA_DATE = ?
            WHERE file_id = ?
            """
            
            cursor.execute(update_query, (
                results.get('loudness', -30),
                results.get('danceability', 0),
                results.get('acousticness', 0),
                results.get('instrumentalness', 0),
                results.get('liveness', 0),
                results.get('speechiness', 0),
                results.get('valence', 0.5),
                datetime.now().isoformat(),
                file_id
            ))
            
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            print(f"  ❌ Error actualizando BD: {e}")
            return False
    
    def process_file(self, file_id, file_path, file_name):
        """Procesa un archivo individual"""
        # Verificar si ya está en cache
        cache_key = f"{file_id}_{file_name}"
        if cache_key in self.processed_cache:
            self.skipped_count += 1
            return None
        
        # Verificar si el archivo existe
        if not os.path.exists(file_path):
            # Intentar rutas alternativas
            alt_paths = [
                file_path,
                f"/Volumes/My Passport/{file_path.split('/My Passport/')[-1]}" if '/My Passport/' in file_path else None,
                f"./test_audio/{file_name}",  # Para pruebas locales
            ]
            
            file_exists = False
            for alt_path in alt_paths:
                if alt_path and os.path.exists(alt_path):
                    file_path = alt_path
                    file_exists = True
                    break
            
            if not file_exists:
                self.skipped_count += 1
                return None
        
        try:
            # Analizar con Essentia
            results = self.analyzer.analyze(file_path)
            
            if results and results.get('duration'):
                # Actualizar base de datos
                if self.update_database(file_id, results):
                    self.processed_count += 1
                    # Agregar a cache
                    self.processed_cache.add(cache_key)
                    return results
                    
        except Exception as e:
            self.error_count += 1
            error_msg = f"Error en {file_name}: {str(e)}"
            self.errors_log.append(error_msg)
            print(f"  ❌ {error_msg}")
            
        return None
    
    def process_batch(self, batch_size=10, max_files=None):
        """Procesa la biblioteca en lotes"""
        print("\n" + "="*70)
        print("🎵 PROCESAMIENTO MASIVO DE BIBLIOTECA MUSICAL")
        print("="*70)
        
        self.start_time = time.time()
        
        # Obtener archivos
        print("\n📂 Obteniendo archivos de la base de datos...")
        files, total = self.get_audio_files(limit=max_files)
        
        if not files:
            print("✅ No hay archivos pendientes de procesar")
            return
        
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"📊 Total pendientes en BD: {total}")
        print(f"📦 Tamaño de lote: {batch_size}")
        print("\n" + "-"*70)
        
        # Procesar en lotes
        for i in range(0, len(files), batch_size):
            batch = files[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(files) + batch_size - 1) // batch_size
            
            print(f"\n📦 LOTE {batch_num}/{total_batches}")
            print("-"*40)
            
            for file_id, file_path, file_name, artist, title, ext in batch:
                # Mostrar info del archivo
                display_name = f"{artist} - {title}" if artist and title else file_name
                print(f"\n🎵 [{self.processed_count + 1}/{len(files)}] {display_name}")
                
                # Procesar
                results = self.process_file(file_id, file_path, file_name)
                
                if results:
                    # Mostrar resultados clave
                    print(f"  ✓ LUFS: {results.get('loudness', 'N/A')} dB")
                    print(f"  ✓ Danceability: {results.get('danceability', 0):.1%}")
                    print(f"  ✓ Valence: {results.get('valence', 0):.1%}")
                else:
                    if not os.path.exists(file_path):
                        print(f"  ⏭️ Archivo no encontrado")
            
            # Guardar cache periódicamente
            if batch_num % 5 == 0:
                self.save_cache()
                self.print_progress()
        
        # Guardar cache final
        self.save_cache()
        
        # Mostrar resumen final
        self.print_summary()
    
    def print_progress(self):
        """Imprime el progreso actual"""
        elapsed = time.time() - self.start_time
        rate = self.processed_count / elapsed if elapsed > 0 else 0
        
        print(f"\n📊 PROGRESO:")
        print(f"  • Procesados: {self.processed_count}")
        print(f"  • Omitidos: {self.skipped_count}")
        print(f"  • Errores: {self.error_count}")
        print(f"  • Velocidad: {rate:.2f} archivos/segundo")
        print(f"  • Tiempo: {elapsed/60:.1f} minutos")
    
    def print_summary(self):
        """Imprime el resumen final"""
        elapsed = time.time() - self.start_time
        
        print("\n" + "="*70)
        print("📊 RESUMEN DE PROCESAMIENTO")
        print("="*70)
        print(f"""
  ✅ Archivos procesados:     {self.processed_count}
  ⏭️ Archivos omitidos:       {self.skipped_count}
  ❌ Errores:                 {self.error_count}
  ⏱️ Tiempo total:            {elapsed/60:.1f} minutos
  📈 Velocidad promedio:      {self.processed_count/elapsed:.2f} archivos/segundo
        """)
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'processed': self.processed_count,
            'skipped': self.skipped_count,
            'errors': self.error_count,
            'duration_minutes': round(elapsed/60, 2),
            'errors_log': self.errors_log[-10:]  # Últimos 10 errores
        }
        
        report_file = f"essentia_processing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado en: {report_file}")
        
        if self.errors_log:
            print(f"\n⚠️ Últimos errores:")
            for error in self.errors_log[-5:]:
                print(f"  • {error}")
    
    def process_specific_files(self, file_ids):
        """Procesa archivos específicos por ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for file_id in file_ids:
            cursor.execute("""
                SELECT file_path, file_name, artist, title 
                FROM audio_files 
                WHERE id = ?
            """, (file_id,))
            
            result = cursor.fetchone()
            if result:
                file_path, file_name, artist, title = result
                display_name = f"{artist} - {title}" if artist and title else file_name
                print(f"\n🎵 Procesando: {display_name}")
                
                results = self.process_file(file_id, file_path, file_name)
                if results:
                    print("  ✅ Procesado exitosamente")
            else:
                print(f"  ❌ ID {file_id} no encontrado")
        
        conn.close()
        self.save_cache()


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesar biblioteca musical con Essentia')
    parser.add_argument('--batch-size', type=int, default=10, 
                        help='Tamaño del lote de procesamiento (default: 10)')
    parser.add_argument('--max-files', type=int, default=None,
                        help='Número máximo de archivos a procesar (default: todos)')
    parser.add_argument('--file-ids', type=int, nargs='+',
                        help='IDs específicos de archivos a procesar')
    parser.add_argument('--reset-cache', action='store_true',
                        help='Reiniciar el cache de archivos procesados')
    parser.add_argument('--check-status', action='store_true',
                        help='Verificar estado del procesamiento')
    
    args = parser.parse_args()
    
    # Crear procesador
    processor = LibraryProcessor()
    
    # Reiniciar cache si se solicita
    if args.reset_cache:
        if os.path.exists(processor.cache_file):
            os.remove(processor.cache_file)
            print("✅ Cache reiniciado")
        processor.processed_cache = set()
    
    # Verificar estado
    if args.check_status:
        conn = sqlite3.connect(processor.db_path)
        cursor = conn.cursor()
        
        # Total de archivos
        cursor.execute("SELECT COUNT(*) FROM audio_files WHERE LOWER(file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')")
        total = cursor.fetchone()[0]
        
        # Procesados con Essentia
        cursor.execute("""
            SELECT COUNT(*) 
            FROM llm_metadata 
            WHERE ESSENTIA_PROCESSED = 1
        """)
        processed = cursor.fetchone()[0]
        
        conn.close()
        
        print("\n📊 ESTADO DEL PROCESAMIENTO:")
        print(f"  • Total de archivos de audio: {total}")
        print(f"  • Procesados con Essentia: {processed}")
        print(f"  • Pendientes: {total - processed}")
        print(f"  • Progreso: {processed/total*100:.1f}%")
        
        return
    
    # Procesar archivos específicos
    if args.file_ids:
        processor.process_specific_files(args.file_ids)
    else:
        # Procesar en lotes
        processor.process_batch(
            batch_size=args.batch_size,
            max_files=args.max_files
        )
    
    print("\n✅ Procesamiento completado")


if __name__ == "__main__":
    main()