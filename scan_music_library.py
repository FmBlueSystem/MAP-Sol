#!/usr/bin/env python3
"""
Escáner de Biblioteca Musical
Registra todos los archivos de audio en la base de datos
"""

import os
import sqlite3
from pathlib import Path
from datetime import datetime
import mimetypes

class MusicLibraryScanner:
    def __init__(self, db_path="music_analyzer.db"):
        self.db_path = db_path
        self.audio_extensions = {'.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac', '.wma', '.opus'}
        self.files_added = 0
        self.files_skipped = 0
        
    def setup_database(self):
        """Crea las tablas si no existen"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Crear tabla audio_files si no existe
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE,
            file_name TEXT,
            title TEXT,
            artist TEXT,
            album TEXT,
            genre TEXT,
            file_extension TEXT,
            file_size INTEGER,
            artwork_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Crear tabla llm_metadata si no existe
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_metadata (
            file_id INTEGER PRIMARY KEY,
            LLM_GENRE TEXT,
            AI_MOOD TEXT,
            LLM_MOOD TEXT,
            AI_ENERGY REAL,
            AI_BPM INTEGER,
            AI_KEY TEXT,
            AI_DANCEABILITY REAL,
            AI_VALENCE REAL,
            AI_ACOUSTICNESS REAL,
            AI_INSTRUMENTALNESS REAL,
            AI_LIVENESS REAL,
            AI_SPEECHINESS REAL,
            AI_LOUDNESS REAL,
            AI_TEMPO_CONFIDENCE REAL,
            AI_KEY_CONFIDENCE REAL,
            ESSENTIA_PROCESSED INTEGER DEFAULT 0,
            ESSENTIA_DATE TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES audio_files(id)
        )
        """)
        
        conn.commit()
        conn.close()
        
    def scan_directory(self, directory_path):
        """Escanea un directorio recursivamente buscando archivos de audio"""
        directory = Path(directory_path)
        
        if not directory.exists():
            print(f"❌ El directorio no existe: {directory_path}")
            return []
        
        print(f"📂 Escaneando: {directory_path}")
        audio_files = []
        
        # Buscar archivos recursivamente
        for file_path in directory.rglob('*'):
            if file_path.is_file():
                extension = file_path.suffix.lower()
                if extension in self.audio_extensions:
                    audio_files.append(file_path)
        
        print(f"  ✓ Encontrados {len(audio_files)} archivos de audio")
        return audio_files
    
    def extract_metadata_from_filename(self, filename):
        """Extrae artista y título del nombre del archivo"""
        # Remover extensión
        name = Path(filename).stem
        
        # Intentar extraer artista - título
        if ' - ' in name:
            parts = name.split(' - ', 1)
            artist = parts[0].strip()
            title = parts[1].strip()
        else:
            artist = "Unknown Artist"
            title = name
        
        return artist, title
    
    def add_file_to_database(self, file_path):
        """Agrega un archivo a la base de datos"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Verificar si ya existe
            cursor.execute("SELECT id FROM audio_files WHERE file_path = ?", (str(file_path),))
            if cursor.fetchone():
                self.files_skipped += 1
                return False
            
            # Extraer información
            file_name = file_path.name
            extension = file_path.suffix.lower().replace('.', '').upper()
            file_size = file_path.stat().st_size
            
            # Extraer metadata del nombre
            artist, title = self.extract_metadata_from_filename(file_name)
            
            # Insertar en la base de datos
            cursor.execute("""
                INSERT INTO audio_files 
                (file_path, file_name, title, artist, file_extension, file_size, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(file_path),
                file_name,
                title,
                artist,
                extension,
                file_size,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            # Crear registro en llm_metadata
            file_id = cursor.lastrowid
            cursor.execute("""
                INSERT OR IGNORE INTO llm_metadata (file_id, ESSENTIA_PROCESSED)
                VALUES (?, 0)
            """, (file_id,))
            
            conn.commit()
            conn.close()
            
            self.files_added += 1
            return True
            
        except Exception as e:
            print(f"  ❌ Error agregando {file_name}: {e}")
            return False
    
    def scan_and_register(self, directories):
        """Escanea directorios y registra archivos en la base de datos"""
        print("\n" + "="*60)
        print("🎵 ESCÁNER DE BIBLIOTECA MUSICAL")
        print("="*60)
        
        # Setup database
        self.setup_database()
        
        all_files = []
        
        # Escanear cada directorio
        for directory in directories:
            files = self.scan_directory(directory)
            all_files.extend(files)
        
        if not all_files:
            print("\n❌ No se encontraron archivos de audio")
            return
        
        print(f"\n📊 Total de archivos encontrados: {len(all_files)}")
        print("📝 Registrando en base de datos...\n")
        
        # Registrar archivos
        for i, file_path in enumerate(all_files, 1):
            if i % 100 == 0:
                print(f"  Procesados: {i}/{len(all_files)} ({i/len(all_files)*100:.1f}%)")
            
            self.add_file_to_database(file_path)
        
        # Resumen
        print("\n" + "="*60)
        print("📊 RESUMEN")
        print("="*60)
        print(f"  ✅ Archivos agregados:    {self.files_added}")
        print(f"  ⏭️ Archivos omitidos:     {self.files_skipped}")
        print(f"  📁 Total en BD:           {self.files_added + self.files_skipped}")
        
        # Verificar estado final
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM audio_files")
        total = cursor.fetchone()[0]
        conn.close()
        
        print(f"\n✅ Base de datos actualizada: {total} archivos totales")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Escanear y registrar biblioteca musical')
    parser.add_argument('directories', nargs='*', 
                       default=["/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks"],
                       help='Directorios a escanear')
    parser.add_argument('--db', default='music_analyzer.db',
                       help='Ruta a la base de datos')
    
    args = parser.parse_args()
    
    # Crear escáner
    scanner = MusicLibraryScanner(db_path=args.db)
    
    # Escanear y registrar
    scanner.scan_and_register(args.directories)


if __name__ == "__main__":
    main()