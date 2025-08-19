#!/usr/bin/env python3
"""
Script para actualizar el esquema de la base de datos con TODOS los campos del proceso GPT-4
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

def update_database_schema(db_path: str = 'music_analyzer.db'):
    """Actualiza el esquema de la base de datos agregando todos los campos faltantes"""
    
    print("="*80)
    print("🔧 ACTUALIZANDO ESQUEMA DE BASE DE DATOS")
    print("="*80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Lista de campos a agregar con sus tipos
    new_fields = [
        # Campos críticos de identificación
        ('LLM_CAMELOT_KEY', 'TEXT'),
        ('LLM_REAL_YEAR', 'INTEGER'),
        ('LLM_YEAR_SOURCE', 'TEXT'),
        ('LLM_ISRC_PARSED', 'TEXT'),  # JSON con datos parseados del ISRC
        
        # Campos de análisis de letras detallado
        ('LLM_LYRICS_SOURCE', 'TEXT'),  # provided/fetched/missing/no_analizado
        ('LLM_SENTIMENT', 'REAL'),
        ('LLM_EMOTIONS', 'TEXT'),  # JSON con 6 emociones
        ('LLM_KEYWORDS', 'TEXT'),  # JSON array
        ('LLM_COHERENCE_SCORE', 'REAL'),
        ('LLM_COHERENCE_NOTES', 'TEXT'),  # JSON array
        ('LLM_TOPICS_MAIN', 'TEXT'),
        ('LLM_TOPICS_SECONDARY', 'TEXT'),  # JSON array
        ('LLM_HOOK_CANDIDATES', 'TEXT'),  # JSON array
        ('LLM_REPEATED_PHRASES', 'TEXT'),  # JSON array
        ('LLM_CULTURAL_REFERENCES', 'TEXT'),  # JSON array
        ('LLM_NARRATIVE_PERSPECTIVE', 'TEXT'),
        ('LLM_NARRATIVE_TIME', 'TEXT'),
        ('LLM_STRUCTURE', 'TEXT'),  # JSON array con secciones
        ('LLM_NAMED_ENTITIES', 'TEXT'),  # JSON object
        ('LLM_CALL_AND_RESPONSE', 'BOOLEAN'),
        ('LLM_CONTAINS_SHOUTS', 'BOOLEAN'),
        ('LLM_EXPLICITNESS_LEVEL', 'TEXT'),
        ('LLM_CONTENT_WARNINGS', 'TEXT'),  # JSON array
        ('LLM_SINGALONG_INDEX', 'REAL'),
        ('LLM_CHANTABILITY', 'REAL'),
        ('LLM_JUSTIFICATION', 'TEXT'),  # JSON array
        
        # Campos de procesamiento Essentia
        ('ESSENTIA_LOUDNESS_LUFS', 'REAL'),
        ('ESSENTIA_EXTRACT_STRATEGY', 'TEXT'),
        ('ESSENTIA_WINDOWS_USED', 'TEXT'),  # JSON array
        ('ESSENTIA_NOTES', 'TEXT'),  # JSON array
        
        # Metadatos adicionales del procesamiento
        ('GPT4_TOKENS_USED', 'INTEGER'),
        ('GPT4_PROCESSING_TIME', 'REAL'),
        ('GPT4_ESTIMATED_COST', 'REAL'),
        ('GPT4_MODEL_VERSION', 'TEXT'),
        
        # Campo para análisis completo como respaldo
        ('GPT4_COMPLETE_ANALYSIS', 'TEXT')  # JSON completo como backup
    ]
    
    # Verificar qué campos ya existen
    cursor.execute("PRAGMA table_info(llm_metadata)")
    existing_columns = [row[1] for row in cursor.fetchall()]
    
    added_count = 0
    skipped_count = 0
    
    print("\n📋 Agregando campos faltantes...")
    
    for field_name, field_type in new_fields:
        if field_name not in existing_columns:
            try:
                # Agregar campo
                if field_type == 'BOOLEAN':
                    sql = f"ALTER TABLE llm_metadata ADD COLUMN {field_name} {field_type} DEFAULT 0"
                else:
                    sql = f"ALTER TABLE llm_metadata ADD COLUMN {field_name} {field_type}"
                
                cursor.execute(sql)
                print(f"  ✅ Agregado: {field_name} ({field_type})")
                added_count += 1
                
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"  ⏭️  Ya existe: {field_name}")
                    skipped_count += 1
                else:
                    print(f"  ❌ Error agregando {field_name}: {e}")
        else:
            print(f"  ⏭️  Ya existe: {field_name}")
            skipped_count += 1
    
    # Crear índices para mejorar performance
    print("\n📊 Creando índices adicionales...")
    
    indices = [
        ('idx_llm_real_year', 'LLM_REAL_YEAR'),
        ('idx_llm_camelot', 'LLM_CAMELOT_KEY'),
        ('idx_llm_sentiment', 'LLM_SENTIMENT'),
        ('idx_llm_coherence', 'LLM_COHERENCE_SCORE'),
        ('idx_gpt4_analyzed', 'LLM_ANALYZED, AI_ANALYZED')
    ]
    
    for index_name, columns in indices:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON llm_metadata({columns})")
            print(f"  ✅ Índice creado: {index_name}")
        except sqlite3.OperationalError as e:
            print(f"  ⏭️  Índice ya existe o error: {index_name}")
    
    # Commit cambios
    conn.commit()
    
    # Verificar el nuevo esquema
    print("\n📈 Verificando esquema actualizado...")
    cursor.execute("PRAGMA table_info(llm_metadata)")
    total_columns = len(cursor.fetchall())
    
    print(f"\n✅ ESQUEMA ACTUALIZADO:")
    print(f"  • Campos agregados: {added_count}")
    print(f"  • Campos existentes: {skipped_count}")
    print(f"  • Total columnas en llm_metadata: {total_columns}")
    
    # Crear vista unificada para facilitar queries
    print("\n🔍 Creando vista unificada...")
    
    try:
        cursor.execute("DROP VIEW IF EXISTS v_complete_analysis")
        cursor.execute("""
            CREATE VIEW v_complete_analysis AS
            SELECT 
                af.id,
                af.file_path,
                af.file_name,
                af.title,
                af.artist,
                af.album,
                af.year as metadata_year,
                
                -- Datos GPT-4
                lm.LLM_GENRE as genre,
                lm.LLM_SUBGENRES as subgenres,
                lm.AI_MOOD as mood,
                lm.LLM_ERA as era,
                lm.LLM_REAL_YEAR as real_year,
                lm.LLM_CAMELOT_KEY as camelot_key,
                lm.LLM_SENTIMENT as sentiment,
                lm.LLM_EMOTIONS as emotions,
                lm.LLM_KEYWORDS as keywords,
                lm.LLM_COHERENCE_SCORE as coherence_score,
                
                -- Features de audio
                lm.AI_ENERGY as energy,
                lm.AI_DANCEABILITY as danceability,
                lm.AI_VALENCE as valence,
                lm.AI_ACOUSTICNESS as acousticness,
                lm.AI_INSTRUMENTALNESS as instrumentalness,
                lm.AI_LIVENESS as liveness,
                lm.AI_SPEECHINESS as speechiness,
                lm.AI_LOUDNESS as loudness,
                lm.AI_BPM as bpm,
                
                -- Análisis de letras
                lm.LLM_LYRICS_SOURCE as lyrics_source,
                lm.LLM_LYRICS_LANGUAGE as language,
                lm.LLM_TOPICS_MAIN as topic_main,
                lm.LLM_TOPICS_SECONDARY as topics_secondary,
                lm.LLM_LYRICS_MOOD as lyric_mood,
                
                -- Flags y metadatos
                lm.AI_CONFIDENCE as confidence,
                lm.LLM_ANALYZED as llm_analyzed,
                lm.AI_ANALYZED as ai_analyzed,
                lm.analysis_timestamp
                
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        """)
        print("  ✅ Vista v_complete_analysis creada")
        
    except Exception as e:
        print(f"  ❌ Error creando vista: {e}")
    
    conn.close()
    
    print("\n" + "="*80)
    print("✅ ACTUALIZACIÓN COMPLETADA")
    print("="*80)
    print("\n💡 Ahora puedes:")
    print("  1. Guardar resultados GPT-4 con todos los campos")
    print("  2. Consultar usando: SELECT * FROM v_complete_analysis")
    print("  3. Filtrar por campos como: WHERE genre != 'Desconocido'")
    
    return True

def test_new_schema():
    """Prueba el nuevo esquema con una query de ejemplo"""
    
    print("\n🧪 Probando nuevo esquema...")
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # Query de prueba
    cursor.execute("""
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN LLM_GENRE != 'Desconocido' THEN 1 END) as with_genre,
               COUNT(LLM_REAL_YEAR) as with_real_year,
               COUNT(LLM_EMOTIONS) as with_emotions
        FROM llm_metadata
        WHERE LLM_ANALYZED = 1
    """)
    
    result = cursor.fetchone()
    if result:
        print(f"\n📊 Estadísticas de datos existentes:")
        print(f"  • Total analizados: {result[0]}")
        print(f"  • Con género válido: {result[1]}")
        print(f"  • Con año real: {result[2]}")
        print(f"  • Con emociones: {result[3]}")
    
    conn.close()

if __name__ == "__main__":
    try:
        # Hacer backup primero
        db_path = 'music_analyzer.db'
        backup_path = f'music_analyzer_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
        
        print(f"💾 Creando backup en: {backup_path}")
        import shutil
        shutil.copy2(db_path, backup_path)
        print(f"✅ Backup creado exitosamente")
        
        # Actualizar esquema
        if update_database_schema():
            test_new_schema()
            
            print("\n✨ Base de datos lista para recibir TODOS los campos GPT-4")
            print("   Ejecuta: python3 save_gpt4_complete.py")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()