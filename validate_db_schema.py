#!/usr/bin/env python3
"""
Script para validar que la base de datos contiene todos los campos del proceso de IA
"""

import sqlite3
import json
from pathlib import Path
from typing import Dict, List, Set

def get_db_schema() -> Dict[str, List[str]]:
    """Obtiene el esquema actual de la base de datos"""
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    schema = {}
    
    # Obtener campos de audio_files
    cursor.execute("PRAGMA table_info(audio_files)")
    audio_fields = [row[1] for row in cursor.fetchall()]
    schema['audio_files'] = audio_fields
    
    # Obtener campos de llm_metadata
    cursor.execute("PRAGMA table_info(llm_metadata)")
    llm_fields = [row[1] for row in cursor.fetchall()]
    schema['llm_metadata'] = llm_fields
    
    conn.close()
    
    return schema

def get_gpt4_output_fields() -> Dict[str, List[str]]:
    """Define todos los campos que devuelve el proceso GPT-4 Ultimate"""
    
    return {
        'main_analysis': [
            'genre',
            'subgenres',  # Array -> TEXT (JSON)
            'mood',
            'energy',
            'danceability',
            'valence',
            'acousticness',
            'instrumentalness',
            'liveness',
            'speechiness',
            'loudness',
            'era',
            'cultural_context',
            'occasions',  # Array -> TEXT (JSON)
            'musical_key',
            'camelot_key',
            'description',
            'confidence',
            'real_year',
            'year_source'
        ],
        'lyrics_analysis': [
            'lyrics_source',
            'language',
            'topic_main',
            'topics_secondary',  # Array -> TEXT (JSON)
            'coherence_score',
            'coherence_notes',  # Array -> TEXT (JSON)
            'lyric_mood',
            'sentiment',
            'emotions',  # Object -> TEXT (JSON)
            'narrative_perspective',
            'narrative_time',
            'structure',  # Array -> TEXT (JSON)
            'repeated_phrases',  # Array -> TEXT (JSON)
            'hook_candidates',  # Array -> TEXT (JSON)
            'keywords',  # Array -> TEXT (JSON)
            'named_entities',  # Object -> TEXT (JSON)
            'cultural_references',  # Array -> TEXT (JSON)
            'call_and_response',
            'contains_shouts',
            'explicitness_level',
            'content_warnings',  # Array -> TEXT (JSON)
            'singalong_index',
            'chantability',
            'justification'  # Array -> TEXT (JSON)
        ],
        'temporal_analysis': [
            'real_year',
            'metadata_year',
            'isrc_parsed',  # Object -> TEXT (JSON)
            'year_explanation'
        ],
        'precomputed_features': [
            'loudness_lufs',
            'danceability',
            'acousticness',
            'instrumentalness',
            'liveness',
            'speechiness',
            'valence',
            'energy',
            'musical_key',
            'camelot_key',
            'extract_strategy',
            'windows_used',  # Array -> TEXT (JSON)
            'notes'  # Array -> TEXT (JSON)
        ]
    }

def map_fields_to_db() -> Dict[str, str]:
    """Mapeo de campos GPT-4 a campos de base de datos"""
    
    return {
        # Main analysis -> llm_metadata
        'genre': 'LLM_GENRE',
        'subgenres': 'LLM_SUBGENRES',  # JSON array
        'mood': 'AI_MOOD',
        'energy': 'AI_ENERGY',
        'danceability': 'AI_DANCEABILITY',
        'valence': 'AI_VALENCE',
        'acousticness': 'AI_ACOUSTICNESS',
        'instrumentalness': 'AI_INSTRUMENTALNESS',
        'liveness': 'AI_LIVENESS',
        'speechiness': 'AI_SPEECHINESS',
        'loudness': 'AI_LOUDNESS',
        'era': 'LLM_ERA',
        'cultural_context': 'LLM_CONTEXT',
        'occasions': 'LLM_OCCASIONS',  # JSON array
        'musical_key': 'AI_KEY',
        'camelot_key': None,  # No existe en DB
        'description': 'LLM_DESCRIPTION',
        'confidence': 'AI_CONFIDENCE',
        
        # Lyrics analysis -> llm_metadata
        'lyrics_source': None,  # No existe
        'language': 'LLM_LYRICS_LANGUAGE',
        'topic_main': 'LLM_LYRICS_THEME',
        'lyric_mood': 'LLM_LYRICS_MOOD',
        'lyrics_analysis': 'LLM_LYRICS_ANALYSIS',  # Todo como JSON
        'explicitness_level': 'LLM_EXPLICIT_CONTENT',
        'storytelling': 'LLM_STORYTELLING',
        
        # Temporal
        'real_year': None,  # No existe, usar year en audio_files
        'year_source': None,  # No existe
        
        # DJ info
        'mixing_notes': 'LLM_MIXING_NOTES',
        'compatible_genres': 'LLM_COMPATIBLE_GENRES',
        
        # Production
        'production_style': 'LLM_PRODUCTION_STYLE',
        'instruments': 'LLM_INSTRUMENTS',
        'vocal_style': 'LLM_VOCAL_STYLE',
        
        # Relationships
        'similar_artists': 'LLM_SIMILAR_ARTISTS',
        'recommendations': 'LLM_RECOMMENDATIONS',
        'musical_influence': 'LLM_MUSICAL_INFLUENCE',
        
        # Flags
        'is_compilation': 'LLM_IS_COMPILATION',
        'is_remix': 'LLM_IS_REMIX',
        'is_cover': 'LLM_IS_COVER',
        'is_live': 'LLM_IS_LIVE',
        
        # Validation
        'validation_notes': 'LLM_VALIDATION_NOTES',
        'warnings': 'LLM_WARNINGS'
    }

def analyze_schema():
    """Analiza y reporta el estado del esquema"""
    
    print("="*80)
    print("🔍 VALIDACIÓN DE ESQUEMA DE BASE DE DATOS vs PROCESO IA")
    print("="*80)
    
    # Obtener esquemas
    db_schema = get_db_schema()
    gpt4_fields = get_gpt4_output_fields()
    field_mapping = map_fields_to_db()
    
    # Estadísticas
    print("\n📊 ESTADÍSTICAS DE CAMPOS:")
    print(f"  • Campos en audio_files: {len(db_schema['audio_files'])}")
    print(f"  • Campos en llm_metadata: {len(db_schema['llm_metadata'])}")
    
    total_gpt4 = sum(len(fields) for fields in gpt4_fields.values())
    print(f"  • Campos que genera GPT-4: {total_gpt4}")
    
    # Analizar mapeo
    all_gpt4_fields = []
    for category, fields in gpt4_fields.items():
        all_gpt4_fields.extend(fields)
    
    mapped = []
    unmapped = []
    
    for field in set(all_gpt4_fields):  # Set para eliminar duplicados
        db_field = field_mapping.get(field)
        if db_field and db_field in db_schema['llm_metadata']:
            mapped.append((field, db_field))
        else:
            unmapped.append(field)
    
    # Campos DB no usados
    used_db_fields = [m[1] for m in mapped]
    unused_db_fields = [f for f in db_schema['llm_metadata'] 
                       if f not in used_db_fields and 
                       not f.endswith('_id') and 
                       f not in ['id', 'file_id', 'analysis_timestamp', 'llm_version']]
    
    # Reporte
    print("\n✅ CAMPOS MAPEADOS CORRECTAMENTE ({}):" .format(len(mapped)))
    for gpt4_field, db_field in sorted(mapped)[:10]:
        print(f"  • {gpt4_field:25} → {db_field}")
    if len(mapped) > 10:
        print(f"  ... y {len(mapped)-10} más")
    
    print("\n❌ CAMPOS GPT-4 SIN MAPEO EN DB ({}):" .format(len(unmapped)))
    for field in sorted(unmapped)[:15]:
        print(f"  • {field}")
    if len(unmapped) > 15:
        print(f"  ... y {len(unmapped)-15} más")
    
    print("\n⚠️ CAMPOS DB NO UTILIZADOS ({}):" .format(len(unused_db_fields)))
    for field in sorted(unused_db_fields)[:10]:
        print(f"  • {field}")
    if len(unused_db_fields) > 10:
        print(f"  ... y {len(unused_db_fields)-10} más")
    
    # Sugerencias
    print("\n💡 SUGERENCIAS:")
    
    if unmapped:
        print("\n1. CAMPOS FALTANTES EN LA DB:")
        critical_missing = ['camelot_key', 'real_year', 'lyrics_source', 'emotions', 
                          'keywords', 'sentiment', 'coherence_score']
        critical = [f for f in unmapped if f in critical_missing]
        if critical:
            print("   Críticos que deberían agregarse:")
            for field in critical:
                suggested_name = f"LLM_{field.upper()}"
                print(f"   ALTER TABLE llm_metadata ADD COLUMN {suggested_name} TEXT;")
    
    print("\n2. ESTRATEGIA DE ALMACENAMIENTO:")
    print("   • Opción A: Agregar columnas faltantes individualmente")
    print("   • Opción B: Usar campo JSON único para todo lyrics_analysis")
    print("   • Opción C: Crear tabla separada 'gpt4_analysis' con todos los campos")
    
    print("\n3. CAMPOS JSON SUGERIDOS:")
    json_candidates = ['emotions', 'structure', 'keywords', 'repeated_phrases', 
                      'hook_candidates', 'cultural_references']
    for field in json_candidates:
        if field in unmapped:
            print(f"   • {field} -> Guardar como JSON en LLM_LYRICS_ANALYSIS")
    
    # Generar SQL de actualización
    print("\n📝 SQL PARA AGREGAR CAMPOS CRÍTICOS:")
    print("```sql")
    print("-- Agregar campos faltantes importantes")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_CAMELOT_KEY TEXT;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_REAL_YEAR INTEGER;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_YEAR_SOURCE TEXT;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_LYRICS_SOURCE TEXT;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_SENTIMENT REAL;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_EMOTIONS TEXT; -- JSON")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_KEYWORDS TEXT; -- JSON")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_COHERENCE_SCORE REAL;")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_TOPICS_SECONDARY TEXT; -- JSON")
    print("ALTER TABLE llm_metadata ADD COLUMN LLM_HOOK_CANDIDATES TEXT; -- JSON")
    print("```")
    
    # Guardar reporte
    report = {
        'db_fields': {
            'audio_files': len(db_schema['audio_files']),
            'llm_metadata': len(db_schema['llm_metadata'])
        },
        'gpt4_fields': total_gpt4,
        'mapped': len(mapped),
        'unmapped': unmapped,
        'unused_db_fields': unused_db_fields,
        'suggestions': {
            'add_columns': ['camelot_key', 'real_year', 'lyrics_source', 'emotions', 'keywords'],
            'json_fields': json_candidates
        }
    }
    
    with open('db_schema_validation.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n💾 Reporte completo guardado en: db_schema_validation.json")
    
    return report

def check_sample_data():
    """Verifica si hay datos de muestra en la DB"""
    
    print("\n" + "="*80)
    print("📊 VERIFICACIÓN DE DATOS EXISTENTES")
    print("="*80)
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # Contar registros
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    audio_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM llm_metadata")
    llm_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE AI_ANALYZED = 1")
    ai_analyzed = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1")
    llm_analyzed = cursor.fetchone()[0]
    
    print(f"\n📈 Registros en la base de datos:")
    print(f"  • Total archivos de audio: {audio_count}")
    print(f"  • Registros en llm_metadata: {llm_count}")
    print(f"  • Analizados con AI: {ai_analyzed}")
    print(f"  • Analizados con LLM: {llm_analyzed}")
    
    # Verificar campos populados
    if llm_count > 0:
        print("\n🔍 Campos con datos (muestra de 5 registros):")
        cursor.execute("""
            SELECT 
                LLM_GENRE,
                AI_MOOD,
                AI_ENERGY,
                LLM_ERA,
                LLM_SUBGENRES
            FROM llm_metadata 
            WHERE LLM_GENRE IS NOT NULL 
            LIMIT 5
        """)
        
        rows = cursor.fetchall()
        for i, row in enumerate(rows, 1):
            print(f"\n  Registro {i}:")
            print(f"    • Género: {row[0]}")
            print(f"    • Mood: {row[1]}")
            print(f"    • Energy: {row[2]}")
            print(f"    • Era: {row[3]}")
            print(f"    • Subgéneros: {row[4]}")
    
    conn.close()

if __name__ == "__main__":
    try:
        report = analyze_schema()
        check_sample_data()
        
        print("\n" + "="*80)
        print("✅ ANÁLISIS COMPLETADO")
        print("="*80)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()