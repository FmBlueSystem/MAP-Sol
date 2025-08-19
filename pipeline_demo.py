#!/usr/bin/env python3
"""
Demo completo del Pipeline de Análisis Musical
Muestra cada paso del proceso con resultados intermedios
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import time

# Importar todos los componentes
from metadata_reader_complete import CompleteMetadataReader
from essentia_processor_with_mik import EssentiaProcessorWithMIK
from metadata_validator import MetadataValidator
from ai_enhancer import AIEnhancer
from essentia_smart60 import Smart60Analyzer

def print_section(title):
    """Imprime un separador de sección"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def demo_pipeline(file_path: str, use_gpt4: bool = False):
    """
    Demuestra el pipeline completo paso a paso
    
    Args:
        file_path: Ruta al archivo de audio
        use_gpt4: Si True, también llama a GPT-4 (requiere API key)
    """
    
    print_section("🎵 DEMO DEL PIPELINE DE ANÁLISIS MUSICAL")
    print(f"\n📁 Archivo: {Path(file_path).name}")
    print(f"📍 Ubicación: {Path(file_path).parent}")
    
    # Verificar que el archivo existe
    if not Path(file_path).exists():
        print(f"❌ Error: El archivo no existe")
        return
    
    results = {}
    start_time = time.time()
    
    # ==========================================
    # PASO 1: LEER METADATA
    # ==========================================
    print_section("PASO 1: EXTRACCIÓN DE METADATA")
    
    reader = CompleteMetadataReader()
    metadata = reader.read_all_metadata(file_path)
    
    print(f"\n📊 Metadata Básica:")
    print(f"  • Título: {metadata.get('title', 'N/A')}")
    print(f"  • Artista: {metadata.get('artist', 'N/A')}")
    print(f"  • Álbum: {metadata.get('album', 'N/A')}")
    print(f"  • Año: {metadata.get('date', 'N/A')}")
    print(f"  • Duración: {metadata.get('duration_seconds', 0):.1f} segundos")
    
    print(f"\n🎛️ Mixed In Key Data:")
    print(f"  • BPM: {metadata.get('bpm', 'No detectado')}")
    print(f"  • Key: {metadata.get('key', 'No detectado')}")
    print(f"  • Energy: {metadata.get('energy', 'No detectado')}")
    
    print(f"\n📝 Metadata Adicional:")
    print(f"  • ISRC: {metadata.get('isrc', 'N/A')}")
    print(f"  • Tiene lyrics: {'Sí' if metadata.get('lyrics') else 'No'}")
    print(f"  • Tiene cover: {'Sí' if metadata.get('has_cover') else 'No'}")
    
    results['metadata'] = metadata
    
    # ==========================================
    # PASO 2: ANÁLISIS CON ESSENTIA
    # ==========================================
    print_section("PASO 2: ANÁLISIS CON ESSENTIA")
    
    processor = EssentiaProcessorWithMIK()
    essentia_result = processor.process_file(file_path)
    
    if essentia_result['status'] == 'success':
        features = essentia_result['essentia_features']
        
        print(f"\n🎵 Características Acústicas:")
        print(f"  • Loudness (LUFS): {features.get('loudness', 0):.2f} dB")
        print(f"  • Danceability: {features.get('danceability', 0):.3f}")
        print(f"  • Energy: {features.get('energy', 0):.3f}")
        print(f"  • Valence: {features.get('valence', 0):.3f}")
        
        print(f"\n🎤 Características de Contenido:")
        print(f"  • Acousticness: {features.get('acousticness', 0):.3f}")
        print(f"  • Instrumentalness: {features.get('instrumentalness', 0):.3f}")
        print(f"  • Liveness: {features.get('liveness', 0):.3f}")
        print(f"  • Speechiness: {features.get('speechiness', 0):.3f}")
        
        results['essentia'] = features
    else:
        print(f"❌ Error en análisis Essentia")
        results['essentia'] = {}
    
    # ==========================================
    # PASO 3: VALIDACIÓN Y NORMALIZACIÓN
    # ==========================================
    print_section("PASO 3: VALIDACIÓN DE DATOS")
    
    validator = MetadataValidator()
    combined_data = {**metadata, **results.get('essentia', {})}
    normalized = validator.validate_and_normalize(combined_data)
    
    report = normalized.get('_validation_report', {})
    print(f"\n✅ Campos válidos: {len(report.get('valid_fields', []))}")
    print(f"🔄 Campos normalizados: {len(report.get('normalized_fields', []))}")
    print(f"⚠️ Campos faltantes: {len(report.get('missing_fields', []))}")
    
    if report.get('normalized_fields'):
        print(f"\n📝 Ejemplos de normalización:")
        for item in report['normalized_fields'][:3]:
            print(f"  • {item['field']}: '{item['original']}' → '{item['normalized']}'")
    
    results['normalized'] = normalized
    
    # ==========================================
    # PASO 4: COMPARACIÓN DE ESTRATEGIAS
    # ==========================================
    print_section("PASO 4: COMPARACIÓN SMART60 vs FULL")
    
    analyzer = Smart60Analyzer()
    
    # Procesar con estrategia Smart60
    print(f"\n⏱️ Procesando con Smart60...")
    smart60_result = analyzer.process_file(file_path, strategy='smart60')
    
    if smart60_result['status'] == 'success':
        print(f"\n📊 Ventanas utilizadas:")
        for window in smart60_result['windows_used']:
            print(f"  • {window}")
        
        # Si tenemos features por ventana, mostrar diferencias
        if 'features_by_window' in smart60_result:
            print(f"\n🔍 Análisis por ventana:")
            for window, features in smart60_result['features_by_window'].items():
                print(f"  {window}:")
                print(f"    - Loudness: {features.get('loudness', 0):.1f} dB")
                print(f"    - Instrumentalness: {features.get('instrumentalness', 0):.3f}")
    
    results['smart60'] = smart60_result.get('essentia_features', {})
    
    # ==========================================
    # PASO 5: PREPARACIÓN PARA IA
    # ==========================================
    print_section("PASO 5: PREPARACIÓN DEL PROMPT")
    
    enhancer = AIEnhancer()
    prepared_data, prompt = enhancer.test_preparation(file_path)
    
    print(f"\n📝 Prompt preparado:")
    print(f"  • Tamaño: {len(prompt)} caracteres")
    print(f"  • Incluye metadata: ✅")
    print(f"  • Incluye features: ✅")
    print(f"  • Incluye lyrics: {'✅' if prepared_data.get('lyrics') else '❌'}")
    
    results['prompt_size'] = len(prompt)
    
    # ==========================================
    # PASO 6: ANÁLISIS GPT-4 (OPCIONAL)
    # ==========================================
    if use_gpt4:
        print_section("PASO 6: ANÁLISIS CON GPT-4")
        
        try:
            from openai_processor import OpenAIProcessor
            
            print(f"\n🚀 Enviando a GPT-4...")
            gpt_processor = OpenAIProcessor()
            gpt_result = gpt_processor.process_file(file_path)
            
            if 'gpt4_analysis' in gpt_result:
                analysis = gpt_result['gpt4_analysis']
                print(f"\n✅ Análisis GPT-4 completado:")
                print(f"  • Género: {analysis.get('genre', 'N/A')}")
                print(f"  • Mood: {analysis.get('mood', 'N/A')}")
                print(f"  • Era: {analysis.get('era', 'N/A')}")
                print(f"  • Confidence: {analysis.get('confidence', 0):.2f}")
                
                results['gpt4'] = analysis
            else:
                print(f"❌ Error en GPT-4: {gpt_result.get('error', 'Unknown')}")
                
        except Exception as e:
            print(f"❌ No se pudo llamar a GPT-4: {e}")
    else:
        print_section("PASO 6: GPT-4 (OMITIDO)")
        print("\nPara habilitar análisis GPT-4:")
        print("1. Configura tu API key en .env")
        print("2. Ejecuta con: --use-gpt4")
    
    # ==========================================
    # RESUMEN FINAL
    # ==========================================
    elapsed_time = time.time() - start_time
    
    print_section("📊 RESUMEN DEL PIPELINE")
    
    print(f"\n⏱️ Tiempo total: {elapsed_time:.2f} segundos")
    
    print(f"\n✅ Datos extraídos:")
    print(f"  • Campos de metadata: {len([k for k,v in metadata.items() if v is not None])}")
    print(f"  • Features de Essentia: {len(results.get('essentia', {}))}")
    print(f"  • Campos normalizados: {len(report.get('normalized_fields', []))}")
    
    if 'gpt4' in results:
        print(f"\n🤖 Enriquecimiento GPT-4:")
        print(f"  • Género detectado: {results['gpt4'].get('genre', 'N/A')}")
        print(f"  • Subgéneros: {', '.join(results['gpt4'].get('subgenres', []))}")
        print(f"  • Ocasiones: {', '.join(results['gpt4'].get('occasions', []))}")
    
    # Guardar resultados completos
    output_file = f"pipeline_demo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n💾 Resultados guardados en: {output_file}")
    
    print_section("✅ DEMO COMPLETADO")
    
    return results


def main():
    """Función principal del demo"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Demo del Pipeline de Análisis Musical',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:
  python pipeline_demo.py "song.flac"              # Sin GPT-4
  python pipeline_demo.py "song.flac" --use-gpt4   # Con GPT-4
  python pipeline_demo.py --test                   # Archivo de prueba
        """
    )
    
    parser.add_argument('file', nargs='?',
                       help='Archivo de audio a procesar')
    parser.add_argument('--use-gpt4', action='store_true',
                       help='Incluir análisis con GPT-4 (requiere API key)')
    parser.add_argument('--test', action='store_true',
                       help='Usar archivo de prueba predefinido')
    
    args = parser.parse_args()
    
    # Determinar archivo a procesar
    if args.test or not args.file:
        # Usar archivo de prueba
        test_file = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/France Joli - Come to Me.flac"
        if Path(test_file).exists():
            file_path = test_file
        else:
            print("❌ Archivo de prueba no encontrado")
            print("Por favor especifica un archivo: python pipeline_demo.py 'archivo.flac'")
            sys.exit(1)
    else:
        file_path = args.file
    
    # Ejecutar demo
    try:
        demo_pipeline(file_path, use_gpt4=args.use_gpt4)
    except KeyboardInterrupt:
        print("\n\n⚠️ Demo interrumpido por el usuario")
    except Exception as e:
        print(f"\n❌ Error en el pipeline: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()