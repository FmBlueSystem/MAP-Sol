#!/usr/bin/env python3
"""
Procesador completo de metadata para toda la librería
Guarda en base de datos sin necesidad de Essentia ni GPT-4
"""

import os
import sys
import json
import sqlite3
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set

# Importar lector de metadata
from metadata_reader_complete import CompleteMetadataReader

class MetadataProcessor:
    def __init__(self, db_path: str = 'music_analyzer.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self.reader = CompleteMetadataReader()
        
        # Crear carpeta de resultados
        self.results_dir = Path('metadata_results')
        self.results_dir.mkdir(exist_ok=True)
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'saved_db': 0,
            'errors': 0,
            'skipped': 0,
            'with_isrc': 0,
            'with_mik': 0,
            'start_time': time.time()
        }
    
    def get_existing_files(self) -> Set[str]:
        """«Obtiene archivos ya en la base de datos"""
        self.cursor.execute("SELECT file_path FROM audio_files")
        return {row[0] for row in self.cursor.fetchall()}
    
    def save_to_database(self, file_path: str, metadata: Dict) -> bool:
        """Guarda metadata en la base de datos"""
        try:
            # Preparar datos
            file_name = Path(file_path).name
            file_ext = Path(file_path).suffix
            
            # Insertar en audio_files
            self.cursor.execute("""
                INSERT INTO audio_files (
                    file_path, file_name, file_extension,
                    title, artist, album, genre, year,
                    isrc, duration, file_size,
                    existing_bmp, existing_key, existing_energy,
                    date_added, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                file_path,
                file_name,
                file_ext,
                metadata.get('title'),
                metadata.get('artist'),
                metadata.get('album'),
                metadata.get('genre'),
                metadata.get('year'),
                metadata.get('isrc'),
                metadata.get('duration'),
                metadata.get('file_size'),
                metadata.get('existing_bmp'),
                metadata.get('existing_key'),
                metadata.get('existing_energy'),
                datetime.now().isoformat(),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            # Obtener el ID del archivo insertado
            file_id = self.cursor.lastrowid
            
            # Si hay datos adicionales de metadata, guardarlos en llm_metadata
            # (preparando para cuando se agregue GPT-4)
            if metadata.get('compilation'):
                self.cursor.execute("""
                    INSERT OR IGNORE INTO llm_metadata (file_id, LLM_COMPILATION)
                    VALUES (?, ?)
                """, (file_id, metadata.get('compilation')))
            
            self.conn.commit()
            return True
            
        except sqlite3.IntegrityError:
            # El archivo ya existe
            return False
        except Exception as e:
            print(f"  ❌ Error BD: {e}")
            self.conn.rollback()
            return False
    
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo individual"""
        try:
            # Leer toda la metadata
            metadata = self.reader.read_all_metadata(str(file_path))
            
            if not metadata:
                self.stats['errors'] += 1
                return False
            
            # Contar estadísticas
            if metadata.get('isrc'):
                self.stats['with_isrc'] += 1
            if metadata.get('existing_bmp'):
                self.stats['with_mik'] += 1
            
            # Guardar en base de datos
            if self.save_to_database(str(file_path), metadata):
                self.stats['saved_db'] += 1
            
            # Guardar JSON de respaldo
            output_file = self.results_dir / f"{file_path.stem}_metadata.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'file_path': str(file_path),
                    'timestamp': datetime.now().isoformat(),
                    'metadata': metadata
                }, f, indent=2, ensure_ascii=False)
            
            self.stats['processed'] += 1
            return True
            
        except Exception as e:
            self.stats['errors'] += 1
            # Guardar error
            error_file = self.results_dir / f"{file_path.stem}_error.txt"
            with open(error_file, 'w') as f:
                f.write(f"Error: {str(e)}\n")
                f.write(f"File: {file_path}\n")
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None):
        """Procesa toda la carpeta"""
        print("="*80)
        print("📂 PROCESAMIENTO DE METADATA MASIVO")
        print("="*80)
        print(f"📁 Carpeta: {folder}")
        print(f"🗄️  Base de datos: {self.db_path}")
        print("="*80)
        
        # Verificar carpeta
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Error: Carpeta no encontrada")
            return
        
        # Obtener archivos ya procesados
        existing = self.get_existing_files()
        print(f"📊 Archivos ya en BD: {len(existing)}")
        
        # Buscar archivos de audio
        extensions = ['.flac', '.m4a', '.mp3']
        all_files = []
        for ext in extensions:
            all_files.extend(folder_path.glob(f'*{ext}'))
        
        all_files.sort(key=lambda x: x.name)
        
        # Filtrar ya procesados
        files_to_process = [f for f in all_files if str(f) not in existing]
        
        if limit:
            files_to_process = files_to_process[:limit]
        
        self.stats['total'] = len(files_to_process)
        self.stats['skipped'] = len(all_files) - len(files_to_process)
        
        print(f"📊 Total archivos encontrados: {len(all_files)}")
        print(f"⏭️  Ya procesados: {self.stats['skipped']}")
        print(f"🎯 A procesar: {self.stats['total']}")
        
        if self.stats['total'] == 0:
            print("\n✅ No hay archivos nuevos para procesar")
            return
        
        print("\nProcesando... (actualización cada 50 archivos)\n")
        
        # Procesar archivos
        for idx, file_path in enumerate(files_to_process, start=1):
            # Mostrar progreso cada 50 archivos o en los primeros 10
            if idx <= 10 or idx % 50 == 0:
                print(f"[{idx}/{self.stats['total']}] {file_path.name[:60]}...")
            
            self.process_file(file_path)
            
            # Actualizar estadísticas cada 100 archivos
            if idx % 100 == 0:
                elapsed = time.time() - self.stats['start_time']
                rate = self.stats['processed'] / elapsed if elapsed > 0 else 0
                
                print(f"\n--- Progreso: {self.stats['processed']} procesados | "
                      f"{self.stats['saved_db']} en BD | "
                      f"{self.stats['errors']} errores | "
                      f"{rate:.1f} archivos/seg ---")
                
                print(f"    ISRC: {self.stats['with_isrc']} | "
                      f"MIK: {self.stats['with_mik']}")
                
                # Estimar tiempo restante
                if rate > 0:
                    remaining = (self.stats['total'] - idx) / rate
                    if remaining > 60:
                        print(f"    ⏱️  Tiempo restante: {remaining/60:.1f} minutos\n")
                    else:
                        print(f"    ⏱️  Tiempo restante: {remaining:.0f} segundos\n")
        
        self.print_final_stats()
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas finales:")
        print(f"  • Total procesados: {self.stats['processed']}")
        print(f"  • Guardados en BD: {self.stats['saved_db']}")
        print(f"  • Ya existentes: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        print(f"\n  • Con ISRC: {self.stats['with_isrc']} ({self.stats['with_isrc']*100//max(1, self.stats['processed'])}%)")
        print(f"  • Con Mixed In Key: {self.stats['with_mik']} ({self.stats['with_mik']*100//max(1, self.stats['processed'])}%)")
        
        print(f"\n⏱️  Tiempo:")
        print(f"  • Total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.2f} segundos")
            print(f"  • Velocidad: {self.stats['processed']/elapsed:.1f} archivos/seg")
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'elapsed_time': elapsed
        }
        
        report_file = self.results_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado: {report_file}")
        print(f"📂 Resultados en: {self.results_dir}/")
        print(f"🗄️  Base de datos actualizada: {self.db_path}")
        
        # Próximos pasos
        print(f"\n🔗 Próximos pasos:")
        print(f"  1. Revisar archivos sin ISRC o MIK")
        print(f"  2. Procesar con GPT-4 cuando sea posible")
        print(f"  3. Intentar Essentia con archivos que funcionen")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador de metadata masivo')
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks',
                       help='Carpeta de música')
    parser.add_argument('--limit', type=int, help='Limitar número de archivos')
    parser.add_argument('--db', default='music_analyzer.db', help='Base de datos')
    
    args = parser.parse_args()
    
    processor = MetadataProcessor(db_path=args.db)
    
    try:
        processor.process_folder(args.folder, args.limit)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrumpido por usuario")
        processor.print_final_stats()
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()
    finally:
        processor.conn.close()

if __name__ == "__main__":
    main()