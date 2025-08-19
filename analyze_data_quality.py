#!/usr/bin/env python3
"""
ANÁLISIS DE CALIDAD DE DATOS
Busca problemas y anomalías en los datos procesados
"""

import sqlite3
import numpy as np
from collections import Counter

def analyze_data_quality():
    print("\n" + "="*60)
    print("🔍 ANÁLISIS DE CALIDAD DE DATOS")
    print("="*60)
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # 1. ESTADÍSTICAS GENERALES
    print("\n📊 ESTADÍSTICAS GENERALES:")
    print("-" * 40)
    
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total_files = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM llm_metadata")
    total_metadata = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_CONFIDENCE >= 0.5 AND AI_LOUDNESS IS NOT NULL
    """)
    analyzed = cursor.fetchone()[0]
    
    print(f"Total archivos: {total_files}")
    print(f"Registros metadata: {total_metadata}")
    print(f"Archivos analizados: {analyzed}")
    print(f"Cobertura: {analyzed*100/total_files:.1f}%")
    
    # 2. VALORES NULL O MISSING
    print("\n🚨 VALORES NULL/MISSING:")
    print("-" * 40)
    
    columns = [
        'AI_LOUDNESS', 'AI_DANCEABILITY', 'AI_ENERGY', 'AI_VALENCE',
        'AI_ACOUSTICNESS', 'AI_INSTRUMENTALNESS', 'AI_SPEECHINESS',
        'AI_LIVENESS', 'AI_BPM', 'AI_KEY', 'AI_CONFIDENCE'
    ]
    
    for col in columns:
        cursor.execute(f"""
            SELECT COUNT(*) FROM llm_metadata 
            WHERE {col} IS NULL
        """)
        null_count = cursor.fetchone()[0]
        if null_count > 0:
            print(f"⚠️  {col}: {null_count} valores NULL ({null_count*100/total_metadata:.1f}%)")
    
    # 3. VALORES FUERA DE RANGO
    print("\n⚠️  VALORES FUERA DE RANGO:")
    print("-" * 40)
    
    # Campos que deben estar entre 0 y 1
    normalized_fields = [
        'AI_DANCEABILITY', 'AI_ENERGY', 'AI_VALENCE', 'AI_ACOUSTICNESS',
        'AI_INSTRUMENTALNESS', 'AI_SPEECHINESS', 'AI_LIVENESS', 'AI_CONFIDENCE'
    ]
    
    for field in normalized_fields:
        cursor.execute(f"""
            SELECT COUNT(*) FROM llm_metadata 
            WHERE {field} < 0 OR {field} > 1
        """)
        out_range = cursor.fetchone()[0]
        if out_range > 0:
            print(f"❌ {field}: {out_range} valores fuera de [0,1]")
    
    # Loudness debe estar entre -70 y 0
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_LOUDNESS < -70 OR AI_LOUDNESS > 0
    """)
    loud_out = cursor.fetchone()[0]
    if loud_out > 0:
        print(f"❌ AI_LOUDNESS: {loud_out} valores fuera de [-70, 0] dB")
    
    # BPM debe estar entre 20 y 300
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata 
        WHERE AI_BPM < 20 OR AI_BPM > 300
    """)
    bpm_out = cursor.fetchone()[0]
    if bpm_out > 0:
        print(f"❌ AI_BPM: {bpm_out} valores fuera de [20, 300]")
    
    # 4. DISTRIBUCIÓN DE VALORES
    print("\n📈 DISTRIBUCIÓN DE VALORES:")
    print("-" * 40)
    
    for field in ['AI_LOUDNESS', 'AI_DANCEABILITY', 'AI_ENERGY', 'AI_BPM', 'AI_CONFIDENCE']:
        cursor.execute(f"""
            SELECT MIN({field}), MAX({field}), AVG({field}), 
                   COUNT(DISTINCT {field})
            FROM llm_metadata 
            WHERE {field} IS NOT NULL
        """)
        min_val, max_val, avg_val, distinct = cursor.fetchall()[0]
        print(f"\n{field}:")
        print(f"  Min: {min_val:.2f}" if min_val is not None else "  Min: NULL")
        print(f"  Max: {max_val:.2f}" if max_val is not None else "  Max: NULL")
        print(f"  Avg: {avg_val:.2f}" if avg_val is not None else "  Avg: NULL")
        print(f"  Valores únicos: {distinct}")
    
    # 5. DUPLICADOS
    print("\n🔄 ANÁLISIS DE DUPLICADOS:")
    print("-" * 40)
    
    cursor.execute("""
        SELECT file_id, COUNT(*) as cnt
        FROM llm_metadata
        GROUP BY file_id
        HAVING cnt > 1
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        print(f"❌ {len(duplicates)} file_ids duplicados en llm_metadata")
    else:
        print("✅ No hay file_ids duplicados")
    
    # 6. VALORES SOSPECHOSOS
    print("\n🤔 VALORES SOSPECHOSOS:")
    print("-" * 40)
    
    # Todos los valores iguales (indica procesamiento incorrecto)
    for field in normalized_fields:
        cursor.execute(f"""
            SELECT {field}, COUNT(*) as cnt
            FROM llm_metadata
            WHERE {field} IS NOT NULL
            GROUP BY {field}
            ORDER BY cnt DESC
            LIMIT 1
        """)
        result = cursor.fetchone()
        if result:
            value, count = result
            if count > analyzed * 0.5:  # Más del 50% con el mismo valor
                print(f"⚠️  {field}: {count} registros ({count*100/analyzed:.1f}%) con valor {value:.2f}")
    
    # 7. ARCHIVOS SIN METADATA
    print("\n📁 ARCHIVOS SIN ANÁLISIS:")
    print("-" * 40)
    
    cursor.execute("""
        SELECT COUNT(*)
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.file_id IS NULL
    """)
    no_metadata = cursor.fetchone()[0]
    print(f"Archivos sin metadata: {no_metadata}")
    
    # 8. DISTRIBUCIÓN DE KEYS
    print("\n🎹 DISTRIBUCIÓN DE TONALIDADES:")
    print("-" * 40)
    
    cursor.execute("""
        SELECT AI_KEY, COUNT(*) as cnt
        FROM llm_metadata
        WHERE AI_KEY IS NOT NULL
        GROUP BY AI_KEY
        ORDER BY cnt DESC
    """)
    keys = cursor.fetchall()
    for key, count in keys[:5]:
        print(f"  {key}: {count} ({count*100/analyzed:.1f}%)")
    
    # 9. ARCHIVOS CON ERRORES
    print("\n❌ ARCHIVOS PROBLEMÁTICOS:")
    print("-" * 40)
    
    cursor.execute("""
        SELECT af.file_name, lm.AI_CONFIDENCE
        FROM audio_files af
        JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.AI_CONFIDENCE < 0.5
        LIMIT 10
    """)
    low_confidence = cursor.fetchall()
    if low_confidence:
        print(f"Archivos con baja confianza (<0.5):")
        for name, conf in low_confidence:
            print(f"  - {name[:50]}: {conf:.2f}")
    
    # 10. RESUMEN DE PROBLEMAS
    print("\n🎯 RESUMEN DE PROBLEMAS ENCONTRADOS:")
    print("-" * 40)
    
    problems = []
    
    # Verificar si hay muchos valores por defecto
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata
        WHERE AI_DANCEABILITY = 0.5 
        AND AI_ENERGY = 0.5 
        AND AI_VALENCE = 0.5
    """)
    defaults = cursor.fetchone()[0]
    if defaults > analyzed * 0.3:
        problems.append(f"❌ {defaults} archivos ({defaults*100/analyzed:.1f}%) con valores por defecto")
    
    # Verificar si todos los BPM son iguales
    cursor.execute("""
        SELECT AI_BPM, COUNT(*) as cnt
        FROM llm_metadata
        GROUP BY AI_BPM
        ORDER BY cnt DESC
        LIMIT 1
    """)
    top_bpm = cursor.fetchone()
    if top_bpm:
        bpm, count = top_bpm
        if count > analyzed * 0.4:
            problems.append(f"❌ {count} archivos ({count*100/analyzed:.1f}%) con BPM={bpm}")
    
    # Verificar si todas las keys son C
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata
        WHERE AI_KEY = 'C'
    """)
    c_keys = cursor.fetchone()[0]
    if c_keys > analyzed * 0.8:
        problems.append(f"❌ {c_keys} archivos ({c_keys*100/analyzed:.1f}%) en tonalidad C (sospechoso)")
    
    if problems:
        print("\n⚠️  PROBLEMAS PRINCIPALES:")
        for p in problems:
            print(f"  {p}")
    else:
        print("✅ No se detectaron problemas mayores")
    
    conn.close()
    
    print("\n" + "="*60)
    print("📊 ANÁLISIS COMPLETADO")
    print("="*60)

if __name__ == '__main__':
    analyze_data_quality()