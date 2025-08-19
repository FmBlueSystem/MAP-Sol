#!/usr/bin/env python3
"""
Script simple para procesar archivos con Essentia Smart60 en batch
"""

import os
import sys
import sqlite3
import time
from pathlib import Path
from datetime import datetime

# Importar el analizador
from essentia_smart60 import Smart60Analyzer

def get_pending_files(db_path='music_analyzer.db', limit=100):
    """Obtener archivos pendientes de análisis"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            af.id, 
            af.file_path
        FROM audio_files af
        LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        WHERE af.file_path IS NOT NULL
        AND af.file_path != ''
        AND (
            lm.file_id IS NULL
            OR lm.AI_LOUDNESS IS NULL
        )
        ORDER BY af.id
        LIMIT ?
    ''', (limit,))
    
    files = cursor.fetchall()
    conn.close()
    return files

def save_to_database(file_id, features, db_path='music_analyzer.db'):
    """Guardar resultados en la base de datos"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Verificar si ya existe
        cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
        exists = cursor.fetchone()
        
        if exists:
            # Actualizar
            cursor.execute('''
                UPDATE llm_metadata
                SET AI_LOUDNESS = ?,
                    AI_DANCEABILITY = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LIVENESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_VALENCE = ?,
                    AI_ENERGY = ?,
                    AI_BPM = ?,
                    AI_KEY = ?,
                    AI_CONFIDENCE = ?
                WHERE file_id = ?
            ''', (
                features.get('loudness', 0),
                features.get('danceability', 0),
                features.get('acousticness', 0),
                features.get('instrumentalness', 0),
                features.get('liveness', 0),
                features.get('speechiness', 0),
                features.get('valence', 0),
                features.get('energy', 0),
                features.get('bpm', 0),
                features.get('key', ''),
                0.8,  # Confidence default
                file_id
            ))
        else:
            # Insertar
            cursor.execute('''
                INSERT INTO llm_metadata (
                    file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                    AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                    AI_VALENCE, AI_ENERGY, AI_BPM, AI_KEY, AI_CONFIDENCE
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                file_id,
                features.get('loudness', 0),
                features.get('danceability', 0),
                features.get('acousticness', 0),
                features.get('instrumentalness', 0),
                features.get('liveness', 0),
                features.get('speechiness', 0),
                features.get('valence', 0),
                features.get('energy', 0),
                features.get('bpm', 0),
                features.get('key', ''),
                0.8
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error guardando en BD: {e}")
        return False
    finally:
        conn.close()

def main():
    print(f"""
╔══════════════════════════════════════════════╗
║     ESSENTIA SMART60 BATCH PROCESSOR        ║
╚══════════════════════════════════════════════╝

📊 Iniciando procesamiento en batch...
⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """)
    
    analyzer = Smart60Analyzer()
    processed = 0
    errors = 0
    
    while True:
        # Obtener archivos pendientes
        files = get_pending_files(limit=50)
        
        if not files:
            print("\n✅ Todos los archivos procesados!")
            break
        
        print(f"\n📦 Procesando batch de {len(files)} archivos...")
        
        for file_id, file_path in files:
            try:
                # Verificar que el archivo existe
                if not os.path.exists(file_path):
                    print(f"⚠️ Archivo no encontrado: {Path(file_path).name}")
                    errors += 1
                    continue
                
                # Procesar archivo
                print(f"  [{processed+1}] {Path(file_path).name[:50]}...", end='')
                result = analyzer.process_file(file_path, strategy='smart60')
                
                if result['status'] == 'success':
                    # Guardar en BD
                    if save_to_database(file_id, result['essentia_features']):
                        print(" ✅")
                        processed += 1
                    else:
                        print(" ⚠️ Error BD")
                        errors += 1
                else:
                    print(" ❌")
                    errors += 1
                    
            except Exception as e:
                print(f" ❌ Error: {e}")
                errors += 1
            
            # Mostrar progreso cada 10 archivos
            if (processed + errors) % 10 == 0:
                print(f"\n📊 Progreso: {processed} procesados, {errors} errores")
        
        print(f"\n✅ Batch completado. Total: {processed} procesados, {errors} errores")
        time.sleep(2)
    
    print(f"""
╔══════════════════════════════════════════════╗
║           PROCESAMIENTO FINALIZADO           ║
╚══════════════════════════════════════════════╝

📊 Estadísticas finales:
  • Procesados exitosamente: {processed}
  • Errores: {errors}
  • Total: {processed + errors}
    """)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Procesamiento interrumpido por el usuario")
        sys.exit(0)