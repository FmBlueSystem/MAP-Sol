#!/usr/bin/env python3
"""
Script para probar que todos los campos obligatorios se devuelven correctamente
"""

import json
import sys
from pathlib import Path
from openai_processor_ultimate import UltimateOpenAIProcessor

def validate_result(result: dict) -> tuple[bool, list]:
    """Valida que todos los campos obligatorios estén presentes y no sean null"""
    
    errors = []
    
    # Verificar que existe el análisis GPT-4
    if 'gpt4_analysis' not in result:
        errors.append("No se encontró 'gpt4_analysis' en el resultado")
        return False, errors
    
    analysis = result['gpt4_analysis']
    
    # Campos obligatorios que nunca deben ser null o vacíos
    required_fields = {
        'genre': (str, lambda x: x and x != ''),
        'subgenres': (list, lambda x: len(x) >= 2),
        'mood': (str, lambda x: x and x != ''),
        'energy': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'danceability': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'valence': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'acousticness': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'instrumentalness': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'liveness': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'speechiness': ((int, float), lambda x: 0.0 <= x <= 1.0),
        'loudness': ((int, float), lambda x: -60 <= x <= 0),
        'era': (str, lambda x: x and x != ''),
        'cultural_context': (str, lambda x: x and len(x) >= 50),
        'occasions': (list, lambda x: len(x) >= 2),
        'musical_key': (str, lambda x: x and x != ''),
        'camelot_key': (str, lambda x: x and x != ''),
        'description': (str, lambda x: x and len(x) >= 20),
        'confidence': ((int, float), lambda x: 0.0 <= x <= 1.0)
    }
    
    # Validar campos principales
    for field, (expected_type, validator) in required_fields.items():
        if field not in analysis:
            errors.append(f"❌ Campo obligatorio '{field}' no encontrado")
        elif analysis[field] is None:
            errors.append(f"❌ Campo '{field}' es null")
        elif not isinstance(analysis[field], expected_type):
            errors.append(f"❌ Campo '{field}' tiene tipo incorrecto: {type(analysis[field]).__name__} (esperado: {expected_type})")
        elif not validator(analysis[field]):
            errors.append(f"❌ Campo '{field}' no cumple validación: {analysis[field]}")
    
    # Validar lyrics_analysis
    if 'lyrics_analysis' not in analysis:
        errors.append("❌ Campo obligatorio 'lyrics_analysis' no encontrado")
    else:
        lyrics = analysis['lyrics_analysis']
        lyrics_required = {
            'lyrics_source': (str, lambda x: x in ['provided', 'fetched', 'missing']),
            'language': (str, lambda x: x and x != ''),
            'topic_main': (str, lambda x: x and x != ''),
            'topics_secondary': (list, lambda x: len(x) >= 1),
            'coherence_score': ((int, float), lambda x: 0.0 <= x <= 1.0),
            'lyric_mood': (str, lambda x: x and x != ''),
            'sentiment': ((int, float), lambda x: -1.0 <= x <= 1.0),
            'emotions': (dict, lambda x: all(k in x for k in ['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust'])),
            'keywords': (list, lambda x: len(x) >= 3)
        }
        
        for field, (expected_type, validator) in lyrics_required.items():
            if field not in lyrics:
                errors.append(f"❌ Campo obligatorio 'lyrics_analysis.{field}' no encontrado")
            elif lyrics[field] is None:
                errors.append(f"❌ Campo 'lyrics_analysis.{field}' es null")
            elif not isinstance(lyrics[field], expected_type):
                errors.append(f"❌ Campo 'lyrics_analysis.{field}' tiene tipo incorrecto")
            elif not validator(lyrics[field]):
                errors.append(f"❌ Campo 'lyrics_analysis.{field}' no cumple validación")
    
    return len(errors) == 0, errors

def main():
    """Función principal de prueba"""
    
    # Archivo de prueba
    test_file = sys.argv[1] if len(sys.argv) > 1 else "/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/pruebas/2 Unlimited - No Limit (Extended Mix).flac"
    
    if not Path(test_file).exists():
        print(f"❌ Archivo no encontrado: {test_file}")
        return
    
    print("="*80)
    print("🧪 PRUEBA DE CAMPOS OBLIGATORIOS")
    print("="*80)
    print(f"Archivo: {Path(test_file).name}")
    print("-"*80)
    
    try:
        # Procesar archivo
        processor = UltimateOpenAIProcessor()
        result = processor.process_file(test_file)
        
        # Validar resultado
        is_valid, errors = validate_result(result)
        
        print("\n" + "="*80)
        print("📊 RESULTADO DE VALIDACIÓN")
        print("="*80)
        
        if is_valid:
            print("✅ TODOS LOS CAMPOS OBLIGATORIOS ESTÁN PRESENTES Y VÁLIDOS")
            
            # Mostrar resumen
            analysis = result['gpt4_analysis']
            print(f"\n📋 Resumen del análisis:")
            print(f"  • Género: {analysis['genre']}")
            print(f"  • Subgéneros: {', '.join(analysis['subgenres'])}")
            print(f"  • Mood: {analysis['mood']}")
            print(f"  • Era: {analysis['era']}")
            print(f"  • Ocasiones: {', '.join(analysis['occasions'])}")
            print(f"  • Contexto: {analysis['cultural_context'][:100]}...")
            print(f"  • Letras: {analysis['lyrics_analysis']['lyrics_source']}")
            print(f"  • Idioma: {analysis['lyrics_analysis']['language']}")
            print(f"  • Confianza: {analysis['confidence']:.2f}")
            
        else:
            print(f"❌ SE ENCONTRARON {len(errors)} ERRORES DE VALIDACIÓN:\n")
            for error in errors:
                print(f"  {error}")
            
            # Guardar reporte de errores
            error_report = {
                'file': test_file,
                'errors': errors,
                'total_errors': len(errors),
                'analysis': result.get('gpt4_analysis', {})
            }
            
            error_file = "validation_errors.json"
            with open(error_file, 'w') as f:
                json.dump(error_report, f, indent=2)
            
            print(f"\n💾 Reporte de errores guardado en: {error_file}")
        
        # Guardar resultado completo
        output_file = "test_mandatory_fields_result.json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"\n💾 Resultado completo guardado en: {output_file}")
        
    except Exception as e:
        print(f"❌ Error durante el procesamiento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()