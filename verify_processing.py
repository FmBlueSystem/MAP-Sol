#!/usr/bin/env python3
"""Verificar si el procesamiento está funcionando correctamente"""

import sqlite3
import numpy as np

def check_data_quality():
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    print("📊 ANÁLISIS DE CALIDAD DE DATOS ESSENTIA")
    print("="*60)
    
    # 1. Verificar valores únicos
    print("\n1️⃣ DISTRIBUCIÓN DE VALORES:")
    
    params = ['AI_LOUDNESS', 'AI_DANCEABILITY', 'AI_ACOUSTICNESS', 
              'AI_INSTRUMENTALNESS', 'AI_SPEECHINESS', 'AI_LIVENESS', 'AI_VALENCE']
    
    for param in params:
        cursor.execute(f"""
            SELECT 
                COUNT(DISTINCT {param}) as unique_vals,
                MIN({param}) as min_val,
                MAX({param}) as max_val,
                AVG({param}) as avg_val,
                COUNT(CASE WHEN {param} = 1.0 THEN 1 END) as perfect_scores,
                COUNT(CASE WHEN {param} = 0.0 THEN 1 END) as zero_scores,
                COUNT({param}) as total
            FROM llm_metadata
            WHERE {param} IS NOT NULL
        """)
        
        result = cursor.fetchone()
        unique, min_v, max_v, avg_v, perfect, zeros, total = result
        
        print(f"\n{param}:")
        print(f"  Valores únicos: {unique}")
        print(f"  Rango: [{min_v:.3f}, {max_v:.3f}]")
        print(f"  Promedio: {avg_v:.3f}")
        
        if perfect > 0:
            print(f"  ⚠️ Valores = 1.0: {perfect} ({perfect/total*100:.1f}%)")
        if zeros > 0:
            print(f"  ⚠️ Valores = 0.0: {zeros} ({zeros/total*100:.1f}%)")
    
    # 2. Verificar patrones sospechosos
    print("\n2️⃣ PATRONES SOSPECHOSOS:")
    
    # Archivos con todos los valores perfectos
    cursor.execute("""
        SELECT COUNT(*) 
        FROM llm_metadata
        WHERE AI_DANCEABILITY = 1.0 
        AND AI_ACOUSTICNESS = 1.0
        AND AI_LOUDNESS IS NOT NULL
    """)
    perfect_both = cursor.fetchone()[0]
    print(f"\n⚠️ Archivos con Dance=1.0 Y Acoustic=1.0: {perfect_both}")
    
    # Archivos procesados en los últimos batches
    cursor.execute("""
        SELECT 
            DATE(AI_ANALYZED_DATE) as date,
            COUNT(*) as files,
            AVG(AI_DANCEABILITY) as avg_dance,
            AVG(AI_ACOUSTICNESS) as avg_acoustic,
            COUNT(CASE WHEN AI_DANCEABILITY = 1.0 THEN 1 END) as perfect_dance
        FROM llm_metadata
        WHERE AI_ANALYZED_DATE IS NOT NULL
        GROUP BY DATE(AI_ANALYZED_DATE)
        ORDER BY date DESC
        LIMIT 5
    """)
    
    print("\n3️⃣ PROCESAMIENTO POR FECHA:")
    print("\nFecha       | Files | Avg Dance | Avg Acoustic | Perfect Dance")
    print("-"*65)
    
    for row in cursor.fetchall():
        date, files, avg_d, avg_a, perfect = row
        print(f"{date or 'Unknown'} | {files:5} | {avg_d:.3f}    | {avg_a:.3f}       | {perfect:5}")
    
    # 4. Verificar últimos archivos procesados
    print("\n4️⃣ ÚLTIMOS 10 ARCHIVOS PROCESADOS:")
    cursor.execute("""
        SELECT 
            af.file_name,
            lm.AI_LOUDNESS,
            lm.AI_DANCEABILITY,
            lm.AI_ACOUSTICNESS,
            lm.AI_CONFIDENCE
        FROM llm_metadata lm
        JOIN audio_files af ON lm.file_id = af.id
        WHERE lm.AI_LOUDNESS IS NOT NULL
        ORDER BY lm.file_id DESC
        LIMIT 10
    """)
    
    print("\nArchivo | Loudness | Dance | Acoustic | Conf")
    print("-"*60)
    for row in cursor.fetchall():
        name, loud, dance, acoustic, conf = row
        name_short = name[:30] if name else "Unknown"
        print(f"{name_short:30} | {loud:7.2f} | {dance:5.2f} | {acoustic:8.2f} | {conf:4.2f}")
    
    # 5. Diagnóstico
    print("\n5️⃣ DIAGNÓSTICO:")
    
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN AI_CONFIDENCE >= 0.8 THEN 1 END) as high_conf,
            COUNT(CASE WHEN AI_CONFIDENCE < 0.5 THEN 1 END) as low_conf
        FROM llm_metadata
        WHERE AI_LOUDNESS IS NOT NULL
    """)
    
    total, high, low = cursor.fetchone()
    
    if perfect_both > total * 0.3:
        print("\n❌ PROBLEMA DETECTADO:")
        print("   Muchos archivos tienen valores perfectos (1.0)")
        print("   Esto sugiere que los algoritmos están fallando")
        print("   y usando valores por defecto.")
    elif unique < 10:
        print("\n⚠️ ADVERTENCIA:")
        print("   Poca variación en los valores")
        print("   Posible problema con el análisis")
    else:
        print("\n✅ Los datos parecen correctos")
    
    print(f"\n📈 Confidence:")
    print(f"   Alta (≥0.8): {high} ({high/total*100:.1f}%)")
    print(f"   Baja (<0.5): {low} ({low/total*100:.1f}%)")
    
    conn.close()

if __name__ == "__main__":
    check_data_quality()