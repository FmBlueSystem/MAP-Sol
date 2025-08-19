#!/usr/bin/env python3
"""
Script para analizar y reprocesar archivos con errores
"""
import json
import sqlite3
import sys
from pathlib import Path
from datetime import datetime

def analyze_error_report(json_file):
    """Analiza el reporte de errores JSON"""
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        print("=" * 60)
        print("ANÁLISIS DETALLADO DE ERRORES")
        print("=" * 60)
        
        # Resumen
        summary = data['summary']
        print(f"\nRESUMEN:")
        print(f"  Total de errores: {summary['total_errors']}")
        print(f"  Archivos no encontrados: {summary['file_not_found']}")
        print(f"  Fallos con m4a: {summary['m4a_failures']}")
        print(f"  Otros errores: {summary['other_errors']}")
        
        # Agrupar por tipo de error
        errors_by_type = {}
        for error in data['files']:
            error_type = error['error_type']
            if error_type not in errors_by_type:
                errors_by_type[error_type] = []
            errors_by_type[error_type].append(error)
        
        # Mostrar archivos por tipo de error
        for error_type, files in errors_by_type.items():
            print(f"\n{error_type.upper()} ({len(files)} archivos):")
            print("-" * 40)
            for i, file_info in enumerate(files[:10], 1):  # Mostrar máximo 10
                print(f"  {i}. {file_info['file_name']}")
                if 'error_message' in file_info:
                    print(f"     → {file_info['error_message']}")
            if len(files) > 10:
                print(f"  ... y {len(files) - 10} más")
        
        # Análisis de extensiones
        extensions = {}
        for error in data['files']:
            ext = Path(error['file_path']).suffix.lower()
            extensions[ext] = extensions.get(ext, 0) + 1
        
        print("\nERRORES POR EXTENSIÓN:")
        for ext, count in sorted(extensions.items(), key=lambda x: x[1], reverse=True):
            print(f"  {ext}: {count} archivos")
        
        # Archivos con MixedInKey que fallaron
        with_mik = [f for f in data['files'] if f['had_mixedinkey']]
        if with_mik:
            print(f"\nARCHIVOS CON MIXEDINKEY QUE FALLARON: {len(with_mik)}")
            for i, file_info in enumerate(with_mik[:5], 1):
                print(f"  {i}. {file_info['file_name']}")
        
        return data
        
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo {json_file}")
        return None
    except json.JSONDecodeError:
        print(f"Error: El archivo {json_file} no es un JSON válido")
        return None

def create_retry_script(error_data, output_file="retry_errors.sh"):
    """Crea un script para reintentar archivos con errores"""
    
    # Filtrar solo archivos m4a y otros problemáticos
    m4a_files = [f for f in error_data['files'] if f['file_path'].lower().endswith('.m4a')]
    
    with open(output_file, 'w') as f:
        f.write("#!/bin/bash\n")
        f.write("# Script para reprocesar archivos con errores\n")
        f.write("# Generado: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n\n")
        
        f.write("source .venv/bin/activate\n\n")
        
        f.write("echo 'Reprocesando archivos m4a con Librosa...'\n")
        f.write("python3 << 'EOF'\n")
        f.write("import sqlite3\n")
        f.write("import librosa\n")
        f.write("import numpy as np\n")
        f.write("from pathlib import Path\n\n")
        
        f.write("files_to_retry = [\n")
        for file_info in m4a_files[:50]:  # Máximo 50 archivos
            f.write(f"    ({file_info['file_id']}, r'{file_info['file_path']}'),\n")
        f.write("]\n\n")
        
        f.write("""
for file_id, file_path in files_to_retry:
    try:
        print(f"Procesando: {Path(file_path).name}")
        
        # Cargar con configuración especial para m4a
        y, sr = librosa.load(file_path, sr=22050, duration=30, mono=True, res_type='kaiser_fast')
        
        # Análisis básico
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        rms = librosa.feature.rms(y=y)
        energy = float(np.clip(np.mean(rms) * 5, 0, 1))
        
        # Guardar en BD
        conn = sqlite3.connect('music_analyzer.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO llm_metadata (
                file_id, AI_BPM, AI_ENERGY, AI_TEMPO_CONFIDENCE
            ) VALUES (?, ?, ?, ?)
        ''', (file_id, float(tempo), energy, 0.7))
        conn.commit()
        conn.close()
        
        print(f"  ✓ OK: BPM={tempo:.0f}, Energy={energy:.2f}")
        
    except Exception as e:
        print(f"  ✗ Error: {e}")

EOF
""")
    
    print(f"Script de reintento creado: {output_file}")
    print(f"Ejecutar con: bash {output_file}")

def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analizar reportes de errores')
    parser.add_argument('error_file', nargs='?', help='Archivo JSON de errores')
    parser.add_argument('--latest', action='store_true', help='Usar el reporte más reciente')
    parser.add_argument('--retry', action='store_true', help='Crear script de reintento')
    
    args = parser.parse_args()
    
    # Encontrar archivo de errores
    if args.latest:
        from glob import glob
        error_files = sorted(glob('error_details_*.json'))
        if error_files:
            error_file = error_files[-1]
            print(f"Usando archivo más reciente: {error_file}")
        else:
            print("No se encontraron archivos de error")
            return
    elif args.error_file:
        error_file = args.error_file
    else:
        print("Uso: python3 analyze_errors.py <archivo_errores.json>")
        print("  o: python3 analyze_errors.py --latest")
        return
    
    # Analizar errores
    error_data = analyze_error_report(error_file)
    
    if error_data and args.retry:
        create_retry_script(error_data)

if __name__ == '__main__':
    main()