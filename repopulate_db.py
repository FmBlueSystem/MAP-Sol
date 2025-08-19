#!/usr/bin/env python3
"""
Script para repoblar la base de datos con las rutas correctas
"""
import os
import sqlite3
from pathlib import Path
from datetime import datetime

# Configuración
DB_PATH = "music_analyzer.db"
MUSIC_DIR = "/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks"

def main():
    # Conectar a la BD
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Crear tabla si no existe
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE,
            file_name TEXT,
            file_size INTEGER,
            file_extension TEXT,
            date_modified TEXT,
            date_added TEXT DEFAULT CURRENT_TIMESTAMP,
            folder_path TEXT,
            title TEXT,
            artist TEXT,
            album TEXT,
            genre TEXT,
            year TEXT,
            analyzed INTEGER DEFAULT 0,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """)
    
    # Buscar archivos
    music_path = Path(MUSIC_DIR)
    if not music_path.exists():
        print(f"❌ No se encuentra el directorio: {MUSIC_DIR}")
        return
    
    # Extensiones válidas
    valid_extensions = {'.flac', '.m4a', '.mp3'}
    
    # Contador
    added = 0
    skipped = 0
    
    print(f"📁 Escaneando: {MUSIC_DIR}")
    
    for file_path in music_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in valid_extensions:
            try:
                # Información del archivo
                full_path = str(file_path)
                file_name = file_path.name
                file_size = file_path.stat().st_size
                file_extension = file_path.suffix.lower()
                date_modified = datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                
                # Intentar insertar
                cursor.execute("""
                    INSERT OR IGNORE INTO audio_files 
                    (file_path, file_name, file_size, file_extension, date_modified, folder_path, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    full_path,
                    file_name,
                    file_size,
                    file_extension,
                    date_modified,
                    str(music_path),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
                
                if cursor.rowcount > 0:
                    added += 1
                    if added % 100 == 0:
                        print(f"  ✅ {added} archivos agregados...")
                else:
                    skipped += 1
                    
            except Exception as e:
                print(f"  ❌ Error con {file_path.name}: {e}")
    
    # Guardar cambios
    conn.commit()
    
    # Estadísticas finales
    cursor.execute("SELECT COUNT(*) FROM audio_files")
    total = cursor.fetchone()[0]
    
    print("\n📊 Resumen:")
    print(f"  • Nuevos archivos agregados: {added}")
    print(f"  • Archivos omitidos (ya existían): {skipped}")
    print(f"  • Total en base de datos: {total}")
    
    conn.close()

if __name__ == "__main__":
    main()