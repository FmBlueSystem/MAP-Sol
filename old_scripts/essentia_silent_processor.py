#!/usr/bin/env python3
"""
Procesador silencioso y eficiente de Essentia para toda la librería
"""

import os
import sys
import json
import time
import warnings
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback

# Silenciar warnings
warnings.filterwarnings('ignore')

# Configurar niveles de log
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'
os.environ['PYTHONWARNINGS'] = 'ignore'

# Redirigir stderr para silenciar FFmpeg
import contextlib

@contextlib.contextmanager
def suppress_output():
    """Suprime todo el output no deseado"""
    with open(os.devnull, 'w') as devnull:
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = devnull
        sys.stderr = devnull
        try:
            yield
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

# Importar con output suprimido
with suppress_output():
    from essentia_processor_with_mik import EssentiaProcessorWithMIK
    from metadata_reader_complete import CompleteMetadataReader

class SilentEssentiaProcessor:
    def __init__(self, output_dir: str = "essentia_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Inicializar procesadores en silencio
        with suppress_output():
            self.essentia_processor = EssentiaProcessorWithMIK()
            self.metadata_reader = CompleteMetadataReader()
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'start_time': time.time(),
            'with_mik': 0
        }
        
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo individual"""
        
        # Verificar si ya existe
        output_file = self.output_dir / f"{file_path.stem}_essentia.json"
        if output_file.exists():
            self.stats['skipped'] += 1
            return True
        
        try:
            # Procesar en silencio
            with suppress_output():
                # Leer metadata
                metadata = self.metadata_reader.read_all_metadata(str(file_path))
                
                # Procesar con Essentia
                features = self.essentia_processor.process_file(str(file_path))
            
            # Verificar MIK
            if features.get('existing_bmp'):
                self.stats['with_mik'] += 1
            
            # Guardar resultado
            result = {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'timestamp': datetime.now().isoformat(),
                'metadata': {
                    'artist': metadata.get('artist'),
                    'title': metadata.get('title'),
                    'album': metadata.get('album'),
                    'year': metadata.get('year'),
                    'isrc': metadata.get('isrc')
                },
                'essentia_features': features
            }
            
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            self.stats['processed'] += 1
            return True
            
        except Exception as e:
            self.stats['errors'] += 1
            # Guardar error
            error_file = self.output_dir / f"{file_path.stem}_error.txt"
            with open(error_file, 'w') as f:
                f.write(f"Error: {str(e)}\n")
                f.write(traceback.format_exc())
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None, 
                      start_from: int = 0):
        """Procesa carpeta completa"""
        
        print("="*80)
        print("🎵 PROCESAMIENTO MASIVO CON ESSENTIA (MODO SILENCIOSO)")
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
        if limit:
            files = files[:limit]
        
        self.stats['total'] = len(files)
        
        print(f"📊 Archivos a procesar: {self.stats['total']}")
        print(f"💾 Guardando en: {self.output_dir}")
        print("="*80)
        print("\nProcesando... (actualización cada 10 archivos)\n")
        
        # Procesar archivos
        for idx, file_path in enumerate(files, start=1):
            success = self.process_file(file_path)
            
            # Actualizar progreso cada 10 archivos
            if idx % 10 == 0 or idx == self.stats['total']:
                elapsed = time.time() - self.stats['start_time']
                rate = (self.stats['processed'] + self.stats['skipped']) / elapsed if elapsed > 0 else 0
                
                print(f"[{idx}/{self.stats['total']}] {idx*100//self.stats['total']}% | "
                      f"✓ {self.stats['processed']} | "
                      f"⏭ {self.stats['skipped']} | "
                      f"✗ {self.stats['errors']} | "
                      f"{rate:.1f} archivos/seg")
                
                # Estimar tiempo restante
                if rate > 0:
                    remaining = (self.stats['total'] - idx) / rate
                    if remaining > 60:
                        print(f"    ⏱️  Tiempo estimado restante: {remaining/60:.1f} minutos")
                    else:
                        print(f"    ⏱️  Tiempo estimado restante: {remaining:.0f} segundos")
        
        self.print_final_stats()
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas:")
        print(f"  • Total archivos: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Ya existentes: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        print(f"  • Con Mixed In Key: {self.stats['with_mik']}")
        
        print(f"\n⏱️  Tiempo:")
        print(f"  • Total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.2f} segundos")
        
        # Guardar reporte
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
    
    processor = SilentEssentiaProcessor(output_dir=args.output)
    
    try:
        processor.process_folder(args.folder, args.limit, args.start)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrumpido por usuario")
        processor.print_final_stats()

if __name__ == "__main__":
    main()