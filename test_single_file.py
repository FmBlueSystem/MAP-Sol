#!/Users/freddymolina/venvs/aubio_env/bin/python3
"""
Test single file analysis con librosa
"""

import sys
import sqlite3

# Obtener un archivo de prueba
conn = sqlite3.connect('music_analyzer.db')
cursor = conn.cursor()
cursor.execute("""
    SELECT id, file_path, file_name 
    FROM audio_files 
    WHERE id = 110
""")
file_info = cursor.fetchone()
conn.close()

if not file_info:
    print("No file found")
    sys.exit(1)

file_id, file_path, file_name = file_info
print(f"Testing file: {file_name}")
print(f"Path: {file_path}")

# Importar la función de análisis
sys.path.insert(0, '/Users/freddymolina/Desktop/music-app-clean')
from librosa_analyzer import analyze_single_file

# Analizar
result = analyze_single_file(file_info)
file_id_result, results, error = result

if results:
    print(f"\n✅ Analysis successful!")
    for key, value in results.items():
        if isinstance(value, float):
            print(f"  {key}: {value:.3f}")
        else:
            print(f"  {key}: {value}")
else:
    print(f"\n❌ Analysis failed: {error}")