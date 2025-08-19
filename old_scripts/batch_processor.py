#!/usr/bin/env python3
"""
Procesador en batch para analizar múltiples archivos
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
import traceback

# Importar procesador
from openai_processor_ultimate import UltimateOpenAIProcessor

class BatchProcessor:
    def __init__(self, output_dir: str = "batch_results"):
        self.processor = UltimateOpenAIProcessor()
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Estadísticas
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'genres_found': {},
            'years_found': {},
            'issues_found': [],
            'processing_times': [],
            'costs': []
        }
        
    def process_directory(self, directory: str, limit: int = None):
        """Procesa todos los archivos de audio en un directorio"""
        
        # Obtener lista de archivos
        audio_extensions = ['.flac', '.m4a', '.mp3']
        files = []
        
        for ext in audio_extensions:
            files.extend(Path(directory).glob(f'*{ext}'))
        
        # Limitar si es necesario
        if limit:
            files = files[:limit]
        
        self.stats['total'] = len(files)
        
        print(f"\n{'='*80}")
        print(f"📂 PROCESAMIENTO EN BATCH")
        print(f"{'='*80}")
        print(f"  • Directorio: {directory}")
        print(f"  • Archivos encontrados: {len(files)}")
        print(f"  • Procesando: {self.stats['total']} archivos")
        print(f"{'='*80}\n")
        
        # Archivo de resumen
        summary_file = self.output_dir / f"batch_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        results = []
        
        for idx, file_path in enumerate(files, 1):
            print(f"\n[{idx}/{self.stats['total']}] Procesando: {file_path.name}")
            print("-" * 60)
            
            # Verificar si ya fue procesado (cache simple)
            cache_file = self.output_dir / f"{file_path.stem}_result.json"
            
            if cache_file.exists():
                print(f"⏭️  Ya procesado, cargando desde cache...")
                with open(cache_file, 'r') as f:
                    result = json.load(f)
                self.stats['skipped'] += 1
            else:
                # Procesar archivo
                try:
                    start_time = time.time()
                    result = self.processor.process_file(str(file_path))
                    processing_time = time.time() - start_time
                    
                    # Guardar resultado individual
                    with open(cache_file, 'w') as f:
                        json.dump(result, f, indent=2)
                    
                    self.stats['processed'] += 1
                    self.stats['processing_times'].append(processing_time)
                    
                    if 'estimated_cost' in result:
                        self.stats['costs'].append(result['estimated_cost'])
                    
                except Exception as e:
                    print(f"❌ Error: {str(e)}")
                    result = {
                        'file_path': str(file_path),
                        'file_name': file_path.name,
                        'error': str(e),
                        'traceback': traceback.format_exc()
                    }
                    self.stats['errors'] += 1
                    self.stats['issues_found'].append({
                        'file': file_path.name,
                        'error': str(e)
                    })
            
            # Analizar resultado
            if 'gpt4_analysis' in result:
                analysis = result['gpt4_analysis']
                
                # Recopilar géneros
                genre = analysis.get('genre', 'Unknown')
                if genre:
                    self.stats['genres_found'][genre] = self.stats['genres_found'].get(genre, 0) + 1
                
                # Recopilar años
                if 'temporal_analysis' in result:
                    year = result['temporal_analysis'].get('real_year')
                    if year:
                        decade = f"{(year // 10) * 10}s"
                        self.stats['years_found'][decade] = self.stats['years_found'].get(decade, 0) + 1
                
                # Detectar problemas
                if not genre or genre == 'None':
                    self.stats['issues_found'].append({
                        'file': file_path.name,
                        'issue': 'No genre detected'
                    })
                
                if analysis.get('confidence', 0) < 0.7:
                    self.stats['issues_found'].append({
                        'file': file_path.name,
                        'issue': f"Low confidence: {analysis.get('confidence', 0)}"
                    })
                
                if analysis.get('lyrics_analysis', {}).get('lyrics_source') == 'missing':
                    self.stats['issues_found'].append({
                        'file': file_path.name,
                        'issue': 'Lyrics not found or searched'
                    })
            
            results.append(result)
            
            # Pausa breve para no sobrecargar la API
            if idx < self.stats['total']:
                time.sleep(1)
        
        # Guardar resumen
        summary = {
            'timestamp': datetime.now().isoformat(),
            'directory': directory,
            'stats': self.stats,
            'results': results
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Imprimir reporte
        self._print_report(summary_file)
        
        return summary
    
    def _print_report(self, summary_file: Path):
        """Imprime reporte final del procesamiento"""
        
        print(f"\n{'='*80}")
        print(f"📊 REPORTE DE PROCESAMIENTO EN BATCH")
        print(f"{'='*80}")
        
        print(f"\n📈 ESTADÍSTICAS:")
        print(f"  • Total archivos: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Desde cache: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        
        if self.stats['processing_times']:
            avg_time = sum(self.stats['processing_times']) / len(self.stats['processing_times'])
            print(f"  • Tiempo promedio: {avg_time:.2f}s")
        
        if self.stats['costs']:
            total_cost = sum(self.stats['costs'])
            print(f"  • Costo total: ${total_cost:.4f}")
        
        print(f"\n🎵 GÉNEROS DETECTADOS:")
        for genre, count in sorted(self.stats['genres_found'].items(), key=lambda x: x[1], reverse=True):
            print(f"  • {genre}: {count} archivos")
        
        print(f"\n📅 DISTRIBUCIÓN POR DÉCADA:")
        for decade, count in sorted(self.stats['years_found'].items()):
            print(f"  • {decade}: {count} archivos")
        
        if self.stats['issues_found']:
            print(f"\n⚠️ PROBLEMAS DETECTADOS ({len(self.stats['issues_found'])}):")
            for issue in self.stats['issues_found'][:10]:  # Mostrar máximo 10
                print(f"  • {issue['file']}: {issue.get('issue', issue.get('error', 'Unknown'))}")
            
            if len(self.stats['issues_found']) > 10:
                print(f"  • ... y {len(self.stats['issues_found']) - 10} más")
        
        print(f"\n💾 Resumen guardado en: {summary_file}")
        print(f"   Resultados individuales en: {self.output_dir}/")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador en batch')
    parser.add_argument('directory', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/pruebas',
                       help='Directorio a procesar')
    parser.add_argument('--limit', type=int, help='Limitar número de archivos')
    parser.add_argument('--output', default='batch_results', help='Directorio de salida')
    
    args = parser.parse_args()
    
    processor = BatchProcessor(args.output)
    processor.process_directory(args.directory, args.limit)


if __name__ == "__main__":
    main()