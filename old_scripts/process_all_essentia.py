#!/usr/bin/env python3
"""
Script para procesar TODOS los archivos con Essentia
Solo calcula los 7 features de audio, sin GPT-4
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback

# Importar procesador Essentia
from essentia_processor_with_mik import EssentiaProcessorWithMIK
from metadata_reader_complete import CompleteMetadataReader

class EssentiaBatchProcessor:
    def __init__(self, output_dir: str = "essentia_results"):
        """Inicializa el procesador batch de Essentia"""
        
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Inicializar procesadores
        print("🎵 Inicializando Essentia...")
        
        # Silenciar output de Essentia
        import os
        os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'
        
        self.essentia_processor = EssentiaProcessorWithMIK()
        self.metadata_reader = CompleteMetadataReader()
        
        # Estadísticas
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'processing_times': [],
            'with_mik': 0,
            'without_mik': 0
        }
        
    def get_audio_files(self, folder: str) -> List[Path]:
        """Obtiene lista de archivos de audio de la carpeta"""
        
        audio_extensions = ['.flac', '.m4a', '.mp3']
        files = []
        
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Carpeta no encontrada: {folder}")
            return []
        
        for ext in audio_extensions:
            files.extend(folder_path.glob(f'*{ext}'))
        
        # Ordenar por nombre
        files.sort(key=lambda x: x.name)
        
        return files
    
    def is_cached(self, file_path: Path) -> bool:
        """Verifica si el archivo ya fue procesado"""
        
        cache_file = self.output_dir / f"{file_path.stem}_essentia.json"
        return cache_file.exists()
    
    def process_single_file(self, file_path: Path) -> Optional[Dict]:
        """Procesa un archivo con Essentia"""
        
        try:
            # Verificar cache
            if self.is_cached(file_path):
                self.stats['skipped'] += 1
                return None
            
            start_time = time.time()
            
            # Leer metadata
            metadata = self.metadata_reader.read_all_metadata(str(file_path))
            
            # Procesar con Essentia
            features = self.essentia_processor.process_file(str(file_path))
            
            # Verificar si tiene MIK
            if features.get('existing_bmp'):
                self.stats['with_mik'] += 1
            else:
                self.stats['without_mik'] += 1
            
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
                'essentia_features': features,
                'processing_time': time.time() - start_time
            }
            
            # Guardar en archivo
            output_file = self.output_dir / f"{file_path.stem}_essentia.json"
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            self.stats['processed'] += 1
            self.stats['processing_times'].append(result['processing_time'])
            
            return result
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)[:100]}")
            self.stats['errors'] += 1
            return None
    
    def process_folder(self, folder: str, limit: Optional[int] = None, 
                      start_from: int = 0):
        """Procesa todos los archivos de una carpeta"""
        
        print(f"\n{'='*80}")
        print(f"🎵 PROCESAMIENTO MASIVO CON ESSENTIA")
        print(f"{'='*80}")
        print(f"📂 Carpeta: {folder}")
        
        # Obtener archivos
        files = self.get_audio_files(folder)
        
        if start_from > 0:
            files = files[start_from:]
            print(f"⏭️  Empezando desde archivo #{start_from}")
        
        if limit:
            files = files[:limit]
        
        self.stats['total'] = len(files)
        
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"📁 Resultados en: {self.output_dir}")
        print(f"{'='*80}\n")
        
        # Procesar cada archivo
        results = []
        
        print("Procesando...")
        for idx, file_path in enumerate(files, start=start_from+1):
            # Mostrar progreso cada 10 archivos
            if idx % 10 == 0 or idx == 1:
                print(f"\n[{idx}/{start_from + len(files)}] Procesando batch...")
            
            # Indicador simple de progreso
            if self.is_cached(file_path):
                print("⏭", end="", flush=True)
            else:
                print("✓", end="", flush=True)
                
            result = self.process_single_file(file_path)
            if result:
                results.append(result)
            
            # Nueva línea cada 50 archivos
            if idx % 50 == 0:
                print()
        
        print()  # Nueva línea al final
        
        # Guardar reporte final
        self.save_final_report(results)
        
        # Mostrar estadísticas finales
        self.print_final_stats()
        
        return results
    
    def save_final_report(self, results: List[Dict]):
        """Guarda reporte final del procesamiento"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = self.output_dir / f"essentia_batch_report_{timestamp}.json"
        
        # Resumen de features
        feature_summary = {
            'loudness': [],
            'danceability': [],
            'energy': [],
            'valence': [],
            'acousticness': [],
            'instrumentalness': [],
            'speechiness': []
        }
        
        for result in results:
            features = result.get('essentia_features', {})
            for key in feature_summary:
                if key in features:
                    feature_summary[key].append(features[key])
        
        # Calcular estadísticas
        stats_summary = {}
        for key, values in feature_summary.items():
            if values:
                stats_summary[key] = {
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                    'count': len(values)
                }
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'feature_statistics': stats_summary,
            'total_files_processed': len(results)
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado: {report_file}")
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        
        print(f"\n{'='*80}")
        print(f"📊 ESTADÍSTICAS FINALES - ESSENTIA")
        print(f"{'='*80}")
        
        print(f"\n📈 Procesamiento:")
        print(f"  • Total archivos: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Ya en cache: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        
        print(f"\n🎹 Mixed In Key:")
        print(f"  • Con datos MIK: {self.stats['with_mik']}")
        print(f"  • Sin datos MIK: {self.stats['without_mik']}")
        
        if self.stats['processing_times']:
            avg_time = sum(self.stats['processing_times']) / len(self.stats['processing_times'])
            total_time = sum(self.stats['processing_times'])
            print(f"\n⏱️  Tiempo:")
            print(f"  • Promedio por archivo: {avg_time:.2f}s")
            print(f"  • Tiempo total: {total_time/60:.1f} minutos")
            
            # Estimar tiempo para todos
            if self.stats['total'] > self.stats['processed']:
                remaining = self.stats['total'] - self.stats['processed'] - self.stats['skipped']
                estimated = remaining * avg_time / 60
                print(f"  • Tiempo estimado restante: {estimated:.1f} minutos")

def main():
    """Función principal"""
    
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador batch de Essentia')
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks',
                       help='Carpeta a procesar')
    parser.add_argument('--limit', type=int, help='Limitar número de archivos')
    parser.add_argument('--start', type=int, default=0, help='Empezar desde archivo N')
    parser.add_argument('--output', default='essentia_results', help='Directorio de salida')
    
    args = parser.parse_args()
    
    # Crear procesador
    processor = EssentiaBatchProcessor(output_dir=args.output)
    
    try:
        # Procesar carpeta
        processor.process_folder(
            folder=args.folder,
            limit=args.limit,
            start_from=args.start
        )
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Proceso interrumpido")
        processor.print_final_stats()
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()