#!/usr/bin/env python3
"""
Pipeline completo de procesamiento:
1. Lee archivos de la carpeta
2. Procesa con Essentia (7 features)
3. Analiza con GPT-4 Ultimate
4. Guarda en base de datos
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import sqlite3
import traceback

# Importar procesadores
from ai_enhancer import AIEnhancer
from openai_processor_ultimate import UltimateOpenAIProcessor
from save_gpt4_complete import CompleteGPT4Saver

class CompletePipeline:
    def __init__(self, cache_dir: str = "pipeline_cache"):
        """Inicializa el pipeline completo"""
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Directorio para resultados
        self.results_dir = Path("pipeline_results")
        self.results_dir.mkdir(exist_ok=True)
        
        # Inicializar procesadores
        print("🚀 Inicializando pipeline...")
        self.ai_enhancer = AIEnhancer()
        self.gpt4_processor = UltimateOpenAIProcessor()
        self.db_saver = CompleteGPT4Saver()
        
        # Estadísticas
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'saved_to_db': 0,
            'processing_times': [],
            'total_cost': 0.0
        }
        
    def get_audio_files(self, folder: str, limit: Optional[int] = None) -> List[Path]:
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
        
        if limit:
            files = files[:limit]
        
        return files
    
    def is_cached(self, file_path: Path) -> bool:
        """Verifica si el archivo ya fue procesado (cache)"""
        
        cache_file = self.cache_dir / f"{file_path.stem}_complete.json"
        return cache_file.exists()
    
    def load_from_cache(self, file_path: Path) -> Optional[Dict]:
        """Carga resultado desde cache"""
        
        cache_file = self.cache_dir / f"{file_path.stem}_complete.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    return json.load(f)
            except:
                return None
        return None
    
    def save_to_cache(self, file_path: Path, result: Dict):
        """Guarda resultado en cache"""
        
        cache_file = self.cache_dir / f"{file_path.stem}_complete.json"
        with open(cache_file, 'w') as f:
            json.dump(result, f, indent=2)
    
    def process_single_file(self, file_path: Path) -> Optional[Dict]:
        """Procesa un archivo individual con todo el pipeline"""
        
        try:
            print(f"\n{'='*70}")
            print(f"📁 Procesando: {file_path.name}")
            print(f"{'='*70}")
            
            # Verificar cache
            if self.is_cached(file_path):
                print(f"⏭️  Cargando desde cache...")
                cached = self.load_from_cache(file_path)
                if cached:
                    self.stats['skipped'] += 1
                    return cached
            
            start_time = time.time()
            
            # PASO 1: Procesar con Essentia (AIEnhancer lo hace internamente)
            print(f"\n1️⃣ Extrayendo features con Essentia...")
            
            # PASO 2: Procesar con GPT-4
            print(f"\n2️⃣ Analizando con GPT-4...")
            result = self.gpt4_processor.process_file(str(file_path))
            
            if 'error' in result:
                print(f"❌ Error en GPT-4: {result['error']}")
                self.stats['errors'] += 1
                return None
            
            # PASO 3: Guardar en base de datos
            print(f"\n3️⃣ Guardando en base de datos...")
            saved = self.db_saver.save_gpt4_complete_result(result)
            
            if saved:
                self.stats['saved_to_db'] += 1
                print(f"✅ Guardado en BD exitosamente")
            else:
                print(f"⚠️ No se pudo guardar en BD")
            
            # Guardar en cache
            self.save_to_cache(file_path, result)
            
            # Actualizar estadísticas
            processing_time = time.time() - start_time
            self.stats['processing_times'].append(processing_time)
            self.stats['processed'] += 1
            
            if 'estimated_cost' in result:
                self.stats['total_cost'] += result['estimated_cost']
            
            # Mostrar resumen
            if 'gpt4_analysis' in result:
                analysis = result['gpt4_analysis']
                print(f"\n📊 Resultado:")
                print(f"  • Género: {analysis.get('genre', 'N/A')}")
                print(f"  • Mood: {analysis.get('mood', 'N/A')}")
                print(f"  • Era: {analysis.get('era', 'N/A')}")
                print(f"  • Año real: {analysis.get('real_year', 'N/A')}")
                print(f"  • Confianza: {analysis.get('confidence', 0):.2%}")
                print(f"  • Tiempo: {processing_time:.1f}s")
                
                # Advertir si hay campos no determinados
                if analysis.get('genre') == 'Desconocido':
                    print(f"  ⚠️ Género no determinado")
                if analysis.get('confidence', 1) < 0.5:
                    print(f"  ⚠️ Confianza baja")
            
            return result
            
        except Exception as e:
            print(f"❌ Error procesando {file_path.name}: {e}")
            traceback.print_exc()
            self.stats['errors'] += 1
            return None
    
    def process_folder(self, folder: str, limit: Optional[int] = None, 
                      start_from: int = 0, delay: float = 1.0):
        """Procesa todos los archivos de una carpeta"""
        
        print(f"\n{'='*80}")
        print(f"🚀 PIPELINE COMPLETO DE PROCESAMIENTO")
        print(f"{'='*80}")
        print(f"📂 Carpeta: {folder}")
        
        # Obtener archivos
        files = self.get_audio_files(folder, limit)
        
        if start_from > 0:
            files = files[start_from:]
            print(f"⏭️  Empezando desde archivo #{start_from}")
        
        self.stats['total'] = len(files)
        
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"💾 Cache: {self.cache_dir}")
        print(f"📝 Resultados: {self.results_dir}")
        print(f"{'='*80}\n")
        
        # Confirmar
        if len(files) > 10:
            confirm = input(f"⚠️ Procesar {len(files)} archivos? (s/n): ").strip().lower()
            if confirm != 's':
                print("❌ Cancelado")
                return
        
        # Procesar cada archivo
        results = []
        for idx, file_path in enumerate(files, start=start_from+1):
            print(f"\n[{idx}/{start_from + len(files)}] {file_path.name}")
            
            try:
                result = self.process_single_file(file_path)
                if result:
                    results.append(result)
                
                # Pausa entre archivos para no sobrecargar API
                if idx < start_from + len(files):
                    print(f"⏸️  Esperando {delay}s...")
                    time.sleep(delay)
                    
            except KeyboardInterrupt:
                print(f"\n\n⚠️ Interrumpido por usuario")
                break
            except Exception as e:
                print(f"❌ Error crítico: {e}")
                self.stats['errors'] += 1
                continue
        
        # Guardar reporte final
        self.save_final_report(results)
        
        # Mostrar estadísticas finales
        self.print_final_stats()
        
        # Cerrar conexión a BD
        self.db_saver.close()
        
        return results
    
    def save_final_report(self, results: List[Dict]):
        """Guarda reporte final del procesamiento"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = self.results_dir / f"pipeline_report_{timestamp}.json"
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'results_summary': []
        }
        
        # Resumen de cada resultado
        for result in results:
            if 'gpt4_analysis' in result:
                analysis = result['gpt4_analysis']
                summary = {
                    'file': result.get('file_name'),
                    'genre': analysis.get('genre'),
                    'mood': analysis.get('mood'),
                    'year': analysis.get('real_year'),
                    'confidence': analysis.get('confidence'),
                    'cost': result.get('estimated_cost', 0)
                }
                report['results_summary'].append(summary)
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte guardado: {report_file}")
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        
        print(f"\n{'='*80}")
        print(f"📊 ESTADÍSTICAS FINALES")
        print(f"{'='*80}")
        
        print(f"\n📈 Procesamiento:")
        print(f"  • Total archivos: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Desde cache: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        print(f"  • Guardados en BD: {self.stats['saved_to_db']}")
        
        if self.stats['processing_times']:
            avg_time = sum(self.stats['processing_times']) / len(self.stats['processing_times'])
            total_time = sum(self.stats['processing_times'])
            print(f"\n⏱️  Tiempo:")
            print(f"  • Promedio por archivo: {avg_time:.1f}s")
            print(f"  • Tiempo total: {total_time/60:.1f} minutos")
        
        print(f"\n💰 Costo:")
        print(f"  • Total: ${self.stats['total_cost']:.4f}")
        if self.stats['processed'] > 0:
            print(f"  • Promedio: ${self.stats['total_cost']/self.stats['processed']:.4f}")
        
        # Verificar BD
        conn = sqlite3.connect('music_analyzer.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM audio_files")
        total_db = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1")
        analyzed_db = cursor.fetchone()[0]
        conn.close()
        
        print(f"\n💾 Base de datos:")
        print(f"  • Total archivos en BD: {total_db}")
        print(f"  • Analizados con GPT-4: {analyzed_db}")

def main():
    """Función principal"""
    
    import argparse
    
    parser = argparse.ArgumentParser(description='Pipeline completo de procesamiento')
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks',
                       help='Carpeta a procesar')
    parser.add_argument('--limit', type=int, help='Limitar número de archivos')
    parser.add_argument('--start', type=int, default=0, help='Empezar desde archivo N')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay entre archivos (segundos)')
    parser.add_argument('--cache', default='pipeline_cache', help='Directorio de cache')
    
    args = parser.parse_args()
    
    # Crear pipeline
    pipeline = CompletePipeline(cache_dir=args.cache)
    
    try:
        # Procesar carpeta
        pipeline.process_folder(
            folder=args.folder,
            limit=args.limit,
            start_from=args.start,
            delay=args.delay
        )
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Proceso interrumpido")
        pipeline.print_final_stats()
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()