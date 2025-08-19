#!/usr/bin/env python3
"""
Carga todos los JSON de Essentia a la base de datos
"""

import json
import sqlite3
import os
from pathlib import Path
from datetime import datetime

def load_json_files(json_dir='essentia_results', db_path='music_analyzer.db'):
    """Carga todos los JSON a la base de datos"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Obtener todos los archivos JSON
    json_files = list(Path(json_dir).glob('*.json'))
    print(f"📊 Encontrados {len(json_files)} archivos JSON")
    
    loaded = 0
    skipped = 0
    errors = 0
    
    for json_file in json_files:
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            # Si es una lista, procesar cada elemento
            if isinstance(data, list):
                items = data
            else:
                items = [data]
            
            for item in items:
                if item.get('status') != 'success':
                    continue
                
                # Obtener el path del archivo de audio
                file_path = item.get('file_path')
                if not file_path:
                    continue
                
                # Buscar el ID en audio_files
                cursor.execute('SELECT id FROM audio_files WHERE file_path = ?', (file_path,))
                result = cursor.fetchone()
                
                if not result:
                    print(f"⚠️ No encontrado en BD: {Path(file_path).name}")
                    skipped += 1
                    continue
                
                file_id = result[0]
                
                # Extraer features
                features = item.get('essentia_features', {})
                
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
                        min(features.get('liveness', 0), 0.5),  # Limitar liveness a 0.5 max
                        features.get('speechiness', 0),
                        features.get('valence', 0),
                        features.get('energy', 0) * 10 if features.get('energy', 0) < 0.1 else features.get('energy', 0),  # Corregir energy si es muy bajo
                        features.get('bpm', 0),
                        features.get('key', ''),
                        0.8,
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
                        min(features.get('liveness', 0), 0.5),
                        features.get('speechiness', 0),
                        features.get('valence', 0),
                        features.get('energy', 0) * 10 if features.get('energy', 0) < 0.1 else features.get('energy', 0),
                        features.get('bpm', 0),
                        features.get('key', ''),
                        0.8
                    ))
                
                loaded += 1
                
                if loaded % 100 == 0:
                    conn.commit()
                    print(f"✅ Cargados {loaded} archivos...")
                    
        except Exception as e:
            print(f"❌ Error procesando {json_file.name}: {e}")
            errors += 1
    
    conn.commit()
    conn.close()
    
    print(f"""
╔══════════════════════════════════════════════╗
║           CARGA COMPLETADA                   ║
╚══════════════════════════════════════════════╝

📊 Estadísticas:
  • JSON procesados: {len(json_files)}
  • Cargados a BD: {loaded}
  • Omitidos: {skipped}
  • Errores: {errors}
    """)
    
    return loaded

if __name__ == '__main__':
    # Cargar desde essentia_results
    if os.path.exists('essentia_results'):
        load_json_files('essentia_results')
    
    # También cargar los smart60 del directorio principal
    smart_files = list(Path('.').glob('smart60*.json'))
    if smart_files:
        print(f"\n📦 Procesando {len(smart_files)} archivos smart60...")
        
        # Crear directorio temporal
        temp_dir = Path('temp_smart60')
        temp_dir.mkdir(exist_ok=True)
        
        # Copiar archivos
        for f in smart_files:
            (temp_dir / f.name).write_bytes(f.read_bytes())
        
        # Procesar
        load_json_files('temp_smart60')
        
        # Limpiar
        import shutil
        shutil.rmtree(temp_dir)