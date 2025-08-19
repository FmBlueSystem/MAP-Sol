#!/usr/bin/env python3
"""
Script para guardar los resultados de GPT-4 Ultimate en la base de datos
Mapea todos los campos correctamente y guarda datos complejos como JSON
"""

import sqlite3
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

class GPT4DatabaseSaver:
    def __init__(self, db_path: str = 'music_analyzer.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        
    def ensure_file_exists(self, file_path: str) -> Optional[int]:
        """Asegura que el archivo existe en audio_files y retorna su ID"""
        
        # Buscar archivo existente
        self.cursor.execute(
            "SELECT id FROM audio_files WHERE file_path = ?",
            (file_path,)
        )
        result = self.cursor.fetchone()
        
        if result:
            return result[0]
        
        # Si no existe, crear registro
        file_name = Path(file_path).name
        self.cursor.execute("""
            INSERT INTO audio_files (file_path, file_name, file_extension, date_added)
            VALUES (?, ?, ?, ?)
        """, (
            file_path,
            file_name,
            Path(file_path).suffix,
            datetime.now().isoformat()
        ))
        
        self.conn.commit()
        return self.cursor.lastrowid
    
    def save_gpt4_result(self, result: Dict[str, Any]) -> bool:
        """Guarda el resultado completo de GPT-4 en la base de datos"""
        
        try:
            # Obtener file_id
            file_path = result.get('file_path')
            if not file_path:
                print("❌ Error: No se encontró file_path en el resultado")
                return False
            
            file_id = self.ensure_file_exists(file_path)
            print(f"📁 File ID: {file_id} para {Path(file_path).name}")
            
            # Extraer análisis GPT-4
            analysis = result.get('gpt4_analysis', {})
            lyrics = analysis.get('lyrics_analysis', {})
            temporal = result.get('temporal_analysis', {})
            precomputed = result.get('precomputed_features', {})
            
            # Verificar si ya existe registro en llm_metadata
            self.cursor.execute(
                "SELECT id FROM llm_metadata WHERE file_id = ?",
                (file_id,)
            )
            exists = self.cursor.fetchone()
            
            # Preparar datos para inserción/actualización
            data = {
                # Core flags
                'AI_ANALYZED': 1,
                'LLM_ANALYZED': 1,
                'AI_ANALYZED_DATE': datetime.now().isoformat(),
                'LLM_ANALYSIS_DATE': datetime.now().isoformat(),
                
                # Audio features de Essentia
                'AI_BPM': precomputed.get('bpm'),
                'AI_ENERGY': analysis.get('energy', precomputed.get('energy')),
                'AI_KEY': analysis.get('musical_key', precomputed.get('musical_key')),
                'AI_DANCEABILITY': analysis.get('danceability', precomputed.get('danceability')),
                'AI_VALENCE': analysis.get('valence', precomputed.get('valence')),
                'AI_ACOUSTICNESS': analysis.get('acousticness', precomputed.get('acousticness')),
                'AI_INSTRUMENTALNESS': analysis.get('instrumentalness', precomputed.get('instrumentalness')),
                'AI_LIVENESS': analysis.get('liveness', precomputed.get('liveness')),
                'AI_SPEECHINESS': analysis.get('speechiness', precomputed.get('speechiness')),
                'AI_LOUDNESS': analysis.get('loudness', precomputed.get('loudness_lufs')),
                'AI_MOOD': analysis.get('mood'),
                'AI_CONFIDENCE': analysis.get('confidence'),
                
                # LLM Classification
                'LLM_GENRE': analysis.get('genre'),
                'LLM_SUBGENRES': json.dumps(analysis.get('subgenres', [])) if analysis.get('subgenres') else None,
                'LLM_ERA': analysis.get('era'),
                'LLM_DESCRIPTION': analysis.get('description'),
                'LLM_CONTEXT': analysis.get('cultural_context'),
                'LLM_OCCASIONS': json.dumps(analysis.get('occasions', [])) if analysis.get('occasions') else None,
                
                # Lyrics Analysis (todo como JSON)
                'LLM_LYRICS_ANALYSIS': json.dumps(lyrics) if lyrics else None,
                'LLM_LYRICS_THEME': lyrics.get('topic_main'),
                'LLM_LYRICS_MOOD': lyrics.get('lyric_mood'),
                'LLM_LYRICS_LANGUAGE': lyrics.get('language'),
                'LLM_EXPLICIT_CONTENT': 1 if lyrics.get('explicitness_level') == 'explicit' else 0,
                'LLM_STORYTELLING': json.dumps(lyrics.get('structure', [])) if lyrics.get('structure') else None,
                
                # Validation
                'LLM_CONFIDENCE_SCORE': analysis.get('confidence'),
                'LLM_VALIDATION_NOTES': json.dumps(analysis.get('validation_notes', [])),
                'LLM_WARNINGS': json.dumps(analysis.get('warnings', [])) if analysis.get('warnings') else None,
                
                # System metadata
                'llm_version': result.get('version', 'ultimate_v3'),
                'analysis_timestamp': result.get('timestamp', datetime.now().isoformat()),
                
                # Essentia flags
                'ESSENTIA_PROCESSED': 1 if precomputed else 0,
                'ESSENTIA_DATE': datetime.now().isoformat() if precomputed else None
            }
            
            if exists:
                # UPDATE existente
                update_query = """
                    UPDATE llm_metadata SET
                        AI_ANALYZED = ?, LLM_ANALYZED = ?,
                        AI_ANALYZED_DATE = ?, LLM_ANALYSIS_DATE = ?,
                        AI_BPM = ?, AI_ENERGY = ?, AI_KEY = ?,
                        AI_DANCEABILITY = ?, AI_VALENCE = ?, AI_ACOUSTICNESS = ?,
                        AI_INSTRUMENTALNESS = ?, AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                        AI_LOUDNESS = ?, AI_MOOD = ?, AI_CONFIDENCE = ?,
                        LLM_GENRE = ?, LLM_SUBGENRES = ?, LLM_ERA = ?,
                        LLM_DESCRIPTION = ?, LLM_CONTEXT = ?, LLM_OCCASIONS = ?,
                        LLM_LYRICS_ANALYSIS = ?, LLM_LYRICS_THEME = ?, LLM_LYRICS_MOOD = ?,
                        LLM_LYRICS_LANGUAGE = ?, LLM_EXPLICIT_CONTENT = ?, LLM_STORYTELLING = ?,
                        LLM_CONFIDENCE_SCORE = ?, LLM_VALIDATION_NOTES = ?, LLM_WARNINGS = ?,
                        llm_version = ?, analysis_timestamp = ?,
                        ESSENTIA_PROCESSED = ?, ESSENTIA_DATE = ?
                    WHERE file_id = ?
                """
                
                values = list(data.values()) + [file_id]
                self.cursor.execute(update_query, values)
                print(f"✅ Actualizado registro existente para file_id {file_id}")
                
            else:
                # INSERT nuevo
                data['file_id'] = file_id
                
                columns = ', '.join(data.keys())
                placeholders = ', '.join(['?' for _ in data])
                insert_query = f"INSERT INTO llm_metadata ({columns}) VALUES ({placeholders})"
                
                self.cursor.execute(insert_query, list(data.values()))
                print(f"✅ Insertado nuevo registro para file_id {file_id}")
            
            # También actualizar algunos campos en audio_files
            self.cursor.execute("""
                UPDATE audio_files SET
                    AI_GENRE = ?,
                    AI_MOOD = ?,
                    AI_BPM = ?,
                    AI_ENERGY = ?,
                    AI_ANALYZED = 1,
                    genre = COALESCE(genre, ?),
                    year = COALESCE(year, ?)
                WHERE id = ?
            """, (
                analysis.get('genre'),
                analysis.get('mood'),
                precomputed.get('bpm'),
                analysis.get('energy'),
                analysis.get('genre'),  # Fallback para genre
                temporal.get('real_year'),  # Año real determinado
                file_id
            ))
            
            self.conn.commit()
            
            # Verificar guardado
            self.cursor.execute("""
                SELECT LLM_GENRE, AI_MOOD, AI_ENERGY, LLM_ERA 
                FROM llm_metadata 
                WHERE file_id = ?
            """, (file_id,))
            
            saved = self.cursor.fetchone()
            if saved:
                print(f"\n📊 Datos guardados:")
                print(f"  • Género: {saved[0]}")
                print(f"  • Mood: {saved[1]}")
                print(f"  • Energy: {saved[2]}")
                print(f"  • Era: {saved[3]}")
                
                # Verificar campos especiales
                if saved[0] == 'Desconocido' or saved[2] == -1:
                    print(f"  ⚠️ Algunos campos marcados como no determinados")
            
            return True
            
        except Exception as e:
            print(f"❌ Error guardando en BD: {e}")
            self.conn.rollback()
            import traceback
            traceback.print_exc()
            return False
    
    def close(self):
        """Cierra la conexión a la base de datos"""
        self.conn.close()

def main():
    """Función principal"""
    
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        # Buscar el archivo más reciente
        pattern = "gpt4_ultimate_*.json"
        files = sorted(Path(".").glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True)
        
        if not files:
            print(f"❌ No se encontraron archivos {pattern}")
            print(f"Uso: python save_gpt4_to_db.py <archivo.json>")
            return
        
        json_file = str(files[0])
    
    print("="*80)
    print("💾 GUARDANDO RESULTADO GPT-4 EN BASE DE DATOS")
    print("="*80)
    print(f"Archivo: {json_file}")
    
    try:
        # Cargar resultado
        with open(json_file, 'r') as f:
            result = json.load(f)
        
        # Guardar en BD
        saver = GPT4DatabaseSaver()
        success = saver.save_gpt4_result(result)
        
        if success:
            print("\n✅ GUARDADO EXITOSO EN LA BASE DE DATOS")
            
            # Estadísticas finales
            saver.cursor.execute("""
                SELECT COUNT(*) FROM llm_metadata 
                WHERE LLM_ANALYZED = 1
            """)
            total_analyzed = saver.cursor.fetchone()[0]
            
            print(f"\n📊 Estadísticas actualizadas:")
            print(f"  • Total archivos analizados con LLM: {total_analyzed}")
            
        else:
            print("\n❌ ERROR AL GUARDAR EN LA BASE DE DATOS")
        
        saver.close()
        
    except FileNotFoundError:
        print(f"❌ Archivo no encontrado: {json_file}")
    except json.JSONDecodeError:
        print(f"❌ Error al leer JSON: {json_file}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()