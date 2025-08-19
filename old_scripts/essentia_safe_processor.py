#!/usr/bin/env python3
"""
Procesador seguro de Essentia que maneja errores y crashes
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import signal

class SafeEssentiaProcessor:
    def __init__(self, output_dir: str = "essentia_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'crashes': 0,
            'start_time': time.time()
        }
        
        # Archivo de progreso
        self.progress_file = self.output_dir / "progress.json"
        self.load_progress()
    
    def load_progress(self):
        """Carga el progreso anterior si existe"""
        if self.progress_file.exists():
            try:
                with open(self.progress_file, 'r') as f:
                    saved = json.load(f)
                    self.stats.update(saved.get('stats', {}))
                    print(f"📂 Continuando desde archivo anterior...")
                    print(f"   Procesados: {self.stats['processed']}")
                    print(f"   Errores: {self.stats['errors']}")
            except:
                pass
    
    def save_progress(self):
        """Guarda el progreso actual"""
        with open(self.progress_file, 'w') as f:
            json.dump({
                'stats': self.stats,
                'timestamp': datetime.now().isoformat()
            }, f)
    
    def process_file_isolated(self, file_path: str) -> Optional[Dict]:
        """Procesa un archivo en un subproceso aislado para evitar crashes"""
        
        # Script temporal para procesar un solo archivo
        temp_script = f"""
import sys
import json
import warnings
warnings.filterwarnings('ignore')

# Silenciar Essentia
import os
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

try:
    from essentia_processor_with_mik import EssentiaProcessorWithMIK
    from metadata_reader_complete import CompleteMetadataReader
    
    processor = EssentiaProcessorWithMIK()
    reader = CompleteMetadataReader()
    
    file_path = "{file_path}"
    
    # Leer metadata
    metadata = reader.read_all_metadata(file_path)
    
    # Procesar con Essentia
    features = processor.process_file(file_path)
    
    # Resultado
    result = {{
        'success': True,
        'features': features,
        'metadata': {{
            'artist': metadata.get('artist'),
            'title': metadata.get('title'),
            'album': metadata.get('album'),
            'year': metadata.get('year'),
            'isrc': metadata.get('isrc')
        }}
    }}
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({{'success': False, 'error': str(e)}}))
"""
        
        try:
            # Ejecutar en subproceso con timeout
            result = subprocess.run(
                [sys.executable, '-c', temp_script],
                capture_output=True,
                text=True,
                timeout=30,  # 30 segundos máximo por archivo
                env={**os.environ, 'PYTHONPATH': os.getcwd()}
            )
            
            if result.returncode == 0 and result.stdout:
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    return {'success': False, 'error': 'Invalid JSON output'}
            else:
                return {'success': False, 'error': f'Process failed with code {result.returncode}'}
                
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': 'Timeout (30s)'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo de forma segura"""
        
        # Verificar si ya existe
        output_file = self.output_dir / f"{file_path.stem}_essentia.json"
        if output_file.exists():
            self.stats['skipped'] += 1
            return True
        
        # Procesar en aislamiento
        result = self.process_file_isolated(str(file_path))
        
        if result and result.get('success'):
            # Guardar resultado exitoso
            output_data = {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'timestamp': datetime.now().isoformat(),
                'metadata': result.get('metadata', {}),
                'essentia_features': result.get('features', {})
            }
            
            with open(output_file, 'w') as f:
                json.dump(output_data, f, indent=2)
            
            self.stats['processed'] += 1
            return True
        else:
            # Guardar error
            error_file = self.output_dir / f"{file_path.stem}_error.txt"
            with open(error_file, 'w') as f:
                f.write(f"Error: {result.get('error', 'Unknown error')}\n")
                f.write(f"File: {file_path}\n")
                f.write(f"Time: {datetime.now().isoformat()}\n")
            
            self.stats['errors'] += 1
            
            # Si fue un crash (no un error normal), contarlo
            if 'Segmentation' in str(result.get('error', '')) or 'returncode' in str(result.get('error', '')):
                self.stats['crashes'] += 1
            
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None, start_from: int = 0):
        """Procesa carpeta de forma segura"""
        
        print("="*80)
        print("🛡️ PROCESAMIENTO SEGURO CON ESSENTIA")
        print("="*80)
        print(f"📂 Carpeta: {folder}")
        
        # Obtener archivos
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Error: Carpeta no encontrada")
            return
        
        audio_extensions = ['.flac', '.m4a', '.mp3']
        files = []
        for ext in audio_extensions:
            files.extend(folder_path.glob(f'*{ext}'))
        
        files.sort(key=lambda x: x.name)
        
        # Aplicar límites
        if start_from > 0:
            files = files[start_from:]
            print(f"⏭️  Continuando desde archivo #{start_from}")
        
        if limit:
            files = files[:limit]
        
        self.stats['total'] = len(files)
        
        print(f"📊 Archivos a procesar: {self.stats['total']}")
        print(f"💾 Guardando en: {self.output_dir}")
        print("="*80)
        print("\nProcesando... (Ctrl+C para pausar)\n")
        
        # Procesar archivos
        for idx, file_path in enumerate(files, start=1):
            try:
                # Mostrar archivo actual cada 10 o si hay error
                if idx % 10 == 1 or self.stats['errors'] > 0:
                    print(f"\n[{idx}/{self.stats['total']}] ({idx*100//self.stats['total']}%) {file_path.name[:50]}")
                
                success = self.process_file(file_path)
                
                # Mostrar progreso cada 10 archivos
                if idx % 10 == 0:
                    elapsed = time.time() - self.stats['start_time']
                    rate = idx / elapsed if elapsed > 0 else 0
                    
                    print(f"\n--- Progreso: {self.stats['processed']} OK | "
                          f"{self.stats['skipped']} omitidos | "
                          f"{self.stats['errors']} errores | "
                          f"{self.stats['crashes']} crashes evitados | "
                          f"{rate:.1f} archivos/seg ---")
                
                # Guardar progreso cada 50 archivos
                if idx % 50 == 0:
                    self.save_progress()
                    
            except KeyboardInterrupt:
                print("\n\n⏸️  Pausado por usuario")
                self.save_progress()
                print(f"✅ Progreso guardado. Procesados: {self.stats['processed']}")
                print(f"   Para continuar: python3 {__file__} --start {start_from + idx}")
                return
                
        self.save_progress()
        self.print_final_stats()
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas:")
        print(f"  • Total archivos: {self.stats['total']}")
        print(f"  • Procesados exitosamente: {self.stats['processed']}")
        print(f"  • Ya existentes: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        print(f"  • Crashes evitados: {self.stats['crashes']}")
        
        print(f"\n⏱️  Tiempo:")
        print(f"  • Total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.2f} segundos")
        
        # Guardar reporte final
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'elapsed_time': elapsed
        }
        
        report_file = self.output_dir / f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado: {report_file}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks')
    parser.add_argument('--limit', type=int, help='Limitar archivos')
    parser.add_argument('--start', type=int, default=0, help='Empezar desde')
    parser.add_argument('--output', default='essentia_results', help='Carpeta salida')
    
    args = parser.parse_args()
    
    processor = SafeEssentiaProcessor(output_dir=args.output)
    processor.process_folder(args.folder, args.limit, args.start)

if __name__ == "__main__":
    main()