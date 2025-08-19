#!/usr/bin/env python3
"""
Procesador directo sin Essentia - Solo metadata + GPT-4
Salta Essentia debido a segmentation faults y procesa directamente
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import sqlite3

# Importar procesadores
from metadata_reader_complete import CompleteMetadataReader
from openai_processor_ultimate import UltimateOpenAIProcessor
from save_gpt4_complete import save_complete_gpt4_to_db

class DirectProcessor:
    def __init__(self, db_path: str = "music_analyzer.db"):
        self.db_path = db_path
        self.metadata_reader = CompleteMetadataReader()
        self.gpt4_processor = UltimateOpenAIProcessor()
        
        # Crear carpeta de resultados
        self.results_dir = Path("gpt4_results_direct")
        self.results_dir.mkdir(exist_ok=True)
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'saved': 0,
            'errors': 0,
            'skipped': 0,
            'start_time': time.time()
        }
    
    def get_processed_files(self) -> set:
        """Obtiene archivos ya procesados en BD"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT af.file_path 
            FROM audio_files af
            JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE lm.LLM_GENRE IS NOT NULL
        """)
        
        processed = {row[0] for row in cursor.fetchall()}
        conn.close()
        
        return processed
    
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo individual"""
        
        try:
            # 1. Leer metadata completa (incluye Mixed In Key)
            print(f"  📖 Leyendo metadata...")
            metadata = self.metadata_reader.read_all_metadata(str(file_path))
            
            if not metadata:
                print(f"  ❌ Sin metadata")
                self.stats['errors'] += 1
                return False
            
            # 2. Crear datos de audio simulados (sin Essentia)
            # Usar valores de Mixed In Key si existen
            audio_features = {
                'bpm': metadata.get('existing_bmp', 0),
                'key': metadata.get('existing_key', 'Unknown'),
                'energy_mik': metadata.get('existing_energy', 0),
                # Valores placeholder para Essentia (serán recalculados por GPT-4)
                'loudness_lufs': -14.0,  # Valor estándar streaming
                'danceability': 0.5,
                'acousticness': 0.5,
                'instrumentalness': 0.5,
                'liveness': 0.1,
                'speechiness': 0.1,
                'valence': 0.5
            }
            
            # 3. Procesar con GPT-4
            print(f"  🤖 Analizando con GPT-4...")
            gpt4_result = self.gpt4_processor.process_track(
                metadata=metadata,
                audio_features=audio_features
            )
            
            if not gpt4_result:
                print(f"  ❌ GPT-4 falló")
                self.stats['errors'] += 1
                return False
            
            # 4. Guardar resultado completo
            result = {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata,
                'audio_features': audio_features,
                'gpt4_analysis': gpt4_result
            }
            
            # Guardar JSON
            output_file = self.results_dir / f"{file_path.stem}_complete.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            # 5. Guardar en base de datos
            print(f"  💾 Guardando en BD...")
            if save_complete_gpt4_to_db(self.db_path, result):
                self.stats['saved'] += 1
            
            self.stats['processed'] += 1
            print(f"  ✅ Completado")
            return True
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
            self.stats['errors'] += 1
            
            # Guardar error
            error_file = self.results_dir / f"{file_path.stem}_error.txt"
            with open(error_file, 'w') as f:
                f.write(f"Error: {str(e)}\n")
                f.write(f"File: {file_path}\n")
                f.write(f"Time: {datetime.now().isoformat()}\n")
            
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None):
        """Procesa carpeta completa"""
        
        print("="*80)
        print("🚀 PROCESAMIENTO DIRECTO (SIN ESSENTIA)")
        print("="*80)
        print(f"📂 Carpeta: {folder}")
        print("⚠️  Nota: Saltando Essentia debido a segmentation faults")
        print("🤖 Usando: Metadata + Mixed In Key + GPT-4")
        print("="*80)
        
        # Obtener archivos
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Error: Carpeta no encontrada")
            return
        
        # Obtener archivos ya procesados
        processed_files = self.get_processed_files()
        print(f"📊 Archivos ya en BD: {len(processed_files)}")
        
        # Buscar archivos de audio
        audio_extensions = ['.flac', '.m4a', '.mp3']
        files = []
        for ext in audio_extensions:
            files.extend(folder_path.glob(f'*{ext}'))
        
        files.sort(key=lambda x: x.name)
        
        # Filtrar ya procesados
        files_to_process = [f for f in files if str(f) not in processed_files]
        
        if limit:
            files_to_process = files_to_process[:limit]
        
        self.stats['total'] = len(files_to_process)
        self.stats['skipped'] = len(files) - len(files_to_process)
        
        print(f"📊 Total archivos encontrados: {len(files)}")
        print(f"⏭️  Ya procesados: {self.stats['skipped']}")
        print(f"🎯 A procesar: {self.stats['total']}")
        
        if self.stats['total'] == 0:
            print("\n✅ No hay archivos nuevos para procesar")
            return
        
        print("\n" + "="*80)
        print("Procesando...\n")
        
        # Procesar archivos
        for idx, file_path in enumerate(files_to_process, start=1):
            print(f"\n[{idx}/{self.stats['total']}] {file_path.name[:60]}...")
            
            success = self.process_file(file_path)
            
            # Mostrar progreso cada 5 archivos
            if idx % 5 == 0:
                elapsed = time.time() - self.stats['start_time']
                rate = self.stats['processed'] / elapsed if elapsed > 0 else 0
                
                print(f"\n--- Progreso: {self.stats['processed']} OK | "
                      f"{self.stats['saved']} en BD | "
                      f"{self.stats['errors']} errores | "
                      f"{rate:.2f} archivos/min ---\n")
                
                # Estimar tiempo restante
                if rate > 0:
                    remaining = (self.stats['total'] - idx) / (rate / 60)
                    if remaining > 60:
                        print(f"⏱️  Tiempo estimado restante: {remaining/60:.1f} horas\n")
                    else:
                        print(f"⏱️  Tiempo estimado restante: {remaining:.1f} minutos\n")
            
            # Pausa pequeña para no saturar API
            time.sleep(0.5)
        
        self.print_final_stats()
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas finales:")
        print(f"  • Total procesados: {self.stats['processed']}")
        print(f"  • Guardados en BD: {self.stats['saved']}")
        print(f"  • Ya existentes: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        
        print(f"\n⏱️  Tiempo:")
        print(f"  • Total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.1f} segundos")
            print(f"  • Velocidad: {self.stats['processed']*60/elapsed:.1f} archivos/minuto")
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'elapsed_time': elapsed,
            'note': 'Procesamiento sin Essentia debido a segmentation faults'
        }
        
        report_file = self.results_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado: {report_file}")
        print(f"\n📂 Resultados en: {self.results_dir}/")
        print(f"🗄️  Base de datos actualizada: {self.db_path}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador directo sin Essentia')
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks',
                       help='Carpeta de música')
    parser.add_argument('--limit', type=int, help='Limitar número de archivos')
    parser.add_argument('--db', default='music_analyzer.db', help='Base de datos')
    
    args = parser.parse_args()
    
    processor = DirectProcessor(db_path=args.db)
    
    try:
        processor.process_folder(args.folder, args.limit)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrumpido por usuario")
        processor.print_final_stats()
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()