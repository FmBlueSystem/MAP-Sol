#!/usr/bin/env python3
"""
Validación completa del sistema Essentia Fixed
"""

import sqlite3
import os
import sys

def validate_system():
    print("="*60)
    print("🔍 VALIDACIÓN COMPLETA DEL SISTEMA ESSENTIA")
    print("="*60)
    
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    
    # 1. Estado general
    print("\n1️⃣ ESTADO GENERAL:")
    cursor.execute("""
        SELECT 
            COUNT(DISTINCT af.id) as total,
            COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed,
            COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NULL THEN af.id END) as pending
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
    """)
    total, analyzed, pending = cursor.fetchone()
    print(f"   Total archivos: {total:,}")
    print(f"   Analizados: {analyzed:,} ({analyzed/total*100:.1f}%)")
    print(f"   Pendientes: {pending:,} ({pending/total*100:.1f}%)")
    
    # 2. Validar rangos
    print("\n2️⃣ VALIDACIÓN DE RANGOS:")
    
    # Loudness
    cursor.execute("""
        SELECT COUNT(*), MIN(AI_LOUDNESS), MAX(AI_LOUDNESS), AVG(AI_LOUDNESS)
        FROM llm_metadata WHERE AI_LOUDNESS IS NOT NULL
    """)
    count, min_v, max_v, avg_v = cursor.fetchone()
    valid_loud = -70 <= min_v <= 0 and -70 <= max_v <= 0
    print(f"   Loudness: [{min_v:.2f}, {max_v:.2f}] avg={avg_v:.2f}")
    print(f"             {'✅ Válido' if valid_loud else '❌ FUERA DE RANGO'}")
    
    # Otros parámetros
    params = ['AI_DANCEABILITY', 'AI_ACOUSTICNESS', 'AI_INSTRUMENTALNESS',
              'AI_SPEECHINESS', 'AI_LIVENESS', 'AI_VALENCE']
    
    all_valid = valid_loud
    for param in params:
        cursor.execute(f"""
            SELECT COUNT(*), MIN({param}), MAX({param}), AVG({param})
            FROM llm_metadata WHERE {param} IS NOT NULL
        """)
        count, min_v, max_v, avg_v = cursor.fetchone()
        if count > 0:
            valid = 0 <= min_v <= 1 and 0 <= max_v <= 1
            all_valid = all_valid and valid
            param_name = param.replace('AI_', '').title()
            print(f"   {param_name:15}: [{min_v:.3f}, {max_v:.3f}] avg={avg_v:.3f}")
            print(f"   {'':15}  {'✅ Válido' if valid else '❌ FUERA DE RANGO'}")
    
    # 3. Detectar valores sospechosos
    print("\n3️⃣ VALORES SOSPECHOSOS:")
    
    cursor.execute("""
        SELECT COUNT(*) FROM llm_metadata
        WHERE AI_DANCEABILITY = 1.0 AND AI_ACOUSTICNESS = 1.0
    """)
    perfect_both = cursor.fetchone()[0]
    print(f"   Archivos con Dance=1.0 Y Acoustic=1.0: {perfect_both}")
    if perfect_both > 100:
        print(f"   ⚠️ ADVERTENCIA: Muchos valores perfectos!")
    
    # 4. Últimos procesados
    print("\n4️⃣ ÚLTIMOS 3 ARCHIVOS PROCESADOS:")
    cursor.execute("""
        SELECT 
            af.file_name,
            lm.AI_LOUDNESS,
            lm.AI_DANCEABILITY,
            lm.AI_ACOUSTICNESS,
            lm.AI_CONFIDENCE,
            datetime(lm.AI_ANALYZED_DATE)
        FROM llm_metadata lm
        JOIN audio_files af ON lm.file_id = af.id
        WHERE lm.AI_ANALYZED_DATE IS NOT NULL
        ORDER BY lm.AI_ANALYZED_DATE DESC
        LIMIT 3
    """)
    
    for row in cursor.fetchall():
        name, loud, dance, acou, conf, date = row
        print(f"\n   📁 {name[:50]}")
        print(f"      Fecha: {date}")
        print(f"      Loud={loud:.2f} Dance={dance:.3f} Acou={acou:.3f} Conf={conf:.2f}")
    
    # 5. Archivos pendientes
    print("\n5️⃣ PRUEBA DE PROCESAMIENTO:")
    
    # Buscar un archivo pendiente
    cursor.execute("""
        SELECT af.id, af.file_path
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE lm.AI_LOUDNESS IS NULL
        OR lm.AI_CONFIDENCE < 0.5
        LIMIT 1
    """)
    
    result = cursor.fetchone()
    if result:
        file_id, file_path = result
        print(f"   Archivo pendiente encontrado: ID {file_id}")
        print(f"   Path: {file_path[:80]}...")
        
        if os.path.exists(file_path):
            print(f"   ✅ Archivo existe, listo para procesar")
        else:
            print(f"   ❌ Archivo no encontrado en disco!")
    else:
        print(f"   ✅ No hay archivos pendientes!")
    
    # 6. Resultado final
    print("\n" + "="*60)
    print("📊 RESULTADO DE LA VALIDACIÓN:")
    
    if all_valid and perfect_both < 100:
        print("   ✅ SISTEMA FUNCIONANDO CORRECTAMENTE")
        print("   Todos los valores están en rangos válidos")
    else:
        print("   ⚠️ HAY PROBLEMAS DETECTADOS:")
        if not all_valid:
            print("   - Algunos parámetros fuera de rango")
        if perfect_both >= 100:
            print("   - Muchos valores sospechosamente perfectos")
            print("   - Posible problema con el procesamiento")
    
    print("="*60)
    
    conn.close()

if __name__ == "__main__":
    validate_system()