#!/usr/bin/env python3
"""
Script completo para guardar TODOS los resultados de GPT-4 Ultimate en la base de datos actualizada
"""

import sqlite3
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

class CompleteGPT4Saver:
    def __init__(self, db_path: str = 'music_analyzer.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        
    def ensure_file_exists(self, file_path: str, metadata: Dict) -> Optional[int]:
        """Asegura que el archivo existe en audio_files y retorna su ID"""
        
        # Buscar archivo existente
        self.cursor.execute(
            "SELECT id FROM audio_files WHERE file_path = ?",
            (file_path,)
        )
        result = self.cursor.fetchone()
        
        if result:
            return result[0]
        
        # Si no existe, crear registro con metadata básica
        file_name = Path(file_path).name
        self.cursor.execute("""
            INSERT INTO audio_files (
                file_path, file_name, file_extension, 
                title, artist, album, genre, year,
                date_added
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_path,
            file_name,
            Path(file_path).suffix,
            metadata.get('title'),
            metadata.get('artist'),
            metadata.get('album'),
            metadata.get('genre'),
            metadata.get('year'),
            datetime.now().isoformat()
        ))
        
        self.conn.commit()
        return self.cursor.lastrowid
    
    def save_gpt4_complete_result(self, result: Dict[str, Any]) -> bool:
        """Guarda TODOS los campos del resultado GPT-4 en la base de datos actualizada"""
        
        try:
            # Obtener file_id
            file_path = result.get('file_path')
            if not file_path:
                print("❌ Error: No se encontró file_path en el resultado")
                return False
            
            original_metadata = result.get('original_metadata', {})
            file_id = self.ensure_file_exists(file_path, original_metadata)
            print(f"📁 File ID: {file_id} para {Path(file_path).name}")
            
            # Extraer todas las secciones
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
            
            # Preparar TODOS los datos para inserción/actualización
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
                
                # LLM Classification principal
                'LLM_GENRE': analysis.get('genre'),
                'LLM_SUBGENRES': json.dumps(analysis.get('subgenres', [])) if analysis.get('subgenres') else None,
                'LLM_ERA': analysis.get('era'),
                'LLM_DESCRIPTION': analysis.get('description'),
                'LLM_CONTEXT': analysis.get('cultural_context'),
                'LLM_OCCASIONS': json.dumps(analysis.get('occasions', [])) if analysis.get('occasions') else None,
                
                # NUEVOS CAMPOS CRÍTICOS
                'LLM_CAMELOT_KEY': analysis.get('camelot_key', precomputed.get('camelot_key')),
                'LLM_REAL_YEAR': analysis.get('real_year', temporal.get('real_year')),
                'LLM_YEAR_SOURCE': analysis.get('year_source', temporal.get('year_explanation')),
                'LLM_ISRC_PARSED': json.dumps(temporal.get('isrc_parsed', {})) if temporal.get('isrc_parsed') else None,
                
                # Análisis detallado de letras
                'LLM_LYRICS_SOURCE': lyrics.get('lyrics_source'),
                'LLM_SENTIMENT': lyrics.get('sentiment'),
                'LLM_EMOTIONS': json.dumps(lyrics.get('emotions', {})) if lyrics.get('emotions') else None,
                'LLM_KEYWORDS': json.dumps(lyrics.get('keywords', [])) if lyrics.get('keywords') else None,
                'LLM_COHERENCE_SCORE': lyrics.get('coherence_score'),
                'LLM_COHERENCE_NOTES': json.dumps(lyrics.get('coherence_notes', [])) if lyrics.get('coherence_notes') else None,
                'LLM_TOPICS_MAIN': lyrics.get('topic_main'),
                'LLM_TOPICS_SECONDARY': json.dumps(lyrics.get('topics_secondary', [])) if lyrics.get('topics_secondary') else None,
                'LLM_HOOK_CANDIDATES': json.dumps(lyrics.get('hook_candidates', [])) if lyrics.get('hook_candidates') else None,
                'LLM_REPEATED_PHRASES': json.dumps(lyrics.get('repeated_phrases', [])) if lyrics.get('repeated_phrases') else None,
                'LLM_CULTURAL_REFERENCES': json.dumps(lyrics.get('cultural_references', [])) if lyrics.get('cultural_references') else None,
                'LLM_NARRATIVE_PERSPECTIVE': lyrics.get('narrative_perspective'),
                'LLM_NARRATIVE_TIME': lyrics.get('narrative_time'),
                'LLM_STRUCTURE': json.dumps(lyrics.get('structure', [])) if lyrics.get('structure') else None,
                'LLM_NAMED_ENTITIES': json.dumps(lyrics.get('named_entities', {})) if lyrics.get('named_entities') else None,
                'LLM_CALL_AND_RESPONSE': 1 if lyrics.get('call_and_response') else 0,
                'LLM_CONTAINS_SHOUTS': 1 if lyrics.get('contains_shouts') else 0,
                'LLM_EXPLICITNESS_LEVEL': lyrics.get('explicitness_level'),
                'LLM_CONTENT_WARNINGS': json.dumps(lyrics.get('content_warnings', [])) if lyrics.get('content_warnings') else None,
                'LLM_SINGALONG_INDEX': lyrics.get('singalong_index'),
                'LLM_CHANTABILITY': lyrics.get('chantability'),
                'LLM_JUSTIFICATION': json.dumps(lyrics.get('justification', [])) if lyrics.get('justification') else None,
                
                # Campos existentes de lyrics
                'LLM_LYRICS_ANALYSIS': json.dumps(lyrics) if lyrics else None,
                'LLM_LYRICS_THEME': lyrics.get('topic_main'),
                'LLM_LYRICS_MOOD': lyrics.get('lyric_mood'),
                'LLM_LYRICS_LANGUAGE': lyrics.get('language'),
                'LLM_EXPLICIT_CONTENT': 1 if lyrics.get('explicitness_level') == 'explicit' else 0,
                'LLM_STORYTELLING': json.dumps(lyrics.get('structure', [])) if lyrics.get('structure') else None,
                
                # Datos de procesamiento Essentia
                'ESSENTIA_LOUDNESS_LUFS': precomputed.get('loudness_lufs'),
                'ESSENTIA_EXTRACT_STRATEGY': precomputed.get('extract_strategy'),
                'ESSENTIA_WINDOWS_USED': json.dumps(precomputed.get('windows_used', [])) if precomputed.get('windows_used') else None,
                'ESSENTIA_NOTES': json.dumps(precomputed.get('notes', [])) if precomputed.get('notes') else None,
                'ESSENTIA_PROCESSED': 1 if precomputed else 0,
                'ESSENTIA_DATE': datetime.now().isoformat() if precomputed else None,
                
                # Metadatos GPT-4
                'GPT4_TOKENS_USED': result.get('tokens_used'),
                'GPT4_PROCESSING_TIME': result.get('processing_time'),
                'GPT4_ESTIMATED_COST': result.get('estimated_cost'),
                'GPT4_MODEL_VERSION': result.get('version', 'ultimate_v3'),
                
                # Análisis completo como backup
                'GPT4_COMPLETE_ANALYSIS': json.dumps(result),
                
                # Validation
                'LLM_CONFIDENCE_SCORE': analysis.get('confidence'),
                'LLM_VALIDATION_NOTES': json.dumps(analysis.get('validation_notes', [])),
                'LLM_WARNINGS': json.dumps(analysis.get('warnings', [])) if analysis.get('warnings') else None,
                
                # System metadata
                'llm_version': result.get('version', 'ultimate_v3'),
                'analysis_timestamp': result.get('timestamp', datetime.now().isoformat())
            }
            
            if exists:
                # UPDATE existente
                set_clause = ', '.join([f"{k} = ?" for k in data.keys()])
                update_query = f"UPDATE llm_metadata SET {set_clause} WHERE file_id = ?"
                
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
            
            # También actualizar campos clave en audio_files
            self.cursor.execute("""
                UPDATE audio_files SET
                    AI_GENRE = ?,
                    AI_MOOD = ?,
                    AI_BPM = ?,
                    AI_ENERGY = ?,
                    AI_DANCEABILITY = ?,
                    AI_VALENCE = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LIVENESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_LOUDNESS = ?,
                    AI_ANALYZED = 1,
                    genre = COALESCE(genre, ?),
                    year = COALESCE(year, ?)
                WHERE id = ?
            """, (
                analysis.get('genre'),
                analysis.get('mood'),
                precomputed.get('bpm'),
                analysis.get('energy'),
                analysis.get('danceability'),
                analysis.get('valence'),
                analysis.get('acousticness'),
                analysis.get('instrumentalness'),
                analysis.get('liveness'),
                analysis.get('speechiness'),
                analysis.get('loudness'),
                analysis.get('genre'),  # Fallback para genre
                temporal.get('real_year'),  # Año real determinado
                file_id
            ))
            
            self.conn.commit()
            
            # Verificar guardado completo
            self.cursor.execute("""
                SELECT 
                    LLM_GENRE, AI_MOOD, AI_ENERGY, LLM_ERA,
                    LLM_REAL_YEAR, LLM_CAMELOT_KEY, LLM_SENTIMENT,
                    LLM_LYRICS_SOURCE, LLM_COHERENCE_SCORE
                FROM llm_metadata 
                WHERE file_id = ?
            """, (file_id,))
            
            saved = self.cursor.fetchone()
            if saved:
                print(f"\n📊 Datos guardados correctamente:")
                print(f"  • Género: {saved[0]}")
                print(f"  • Mood: {saved[1]}")
                print(f"  • Energy: {saved[2]}")
                print(f"  • Era: {saved[3]}")
                print(f"  • Año real: {saved[4]}")
                print(f"  • Camelot: {saved[5]}")
                print(f"  • Sentiment: {saved[6]}")
                print(f"  • Lyrics source: {saved[7]}")
                print(f"  • Coherence: {saved[8]}")
                
                # Advertir si hay campos no determinados
                problems = []
                if saved[0] == 'Desconocido':
                    problems.append("Género")
                if saved[2] == -1:
                    problems.append("Energy")
                if saved[7] == 'no_analizado':
                    problems.append("Lyrics")
                
                if problems:
                    print(f"\n  ⚠️ Campos no determinados: {', '.join(problems)}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error guardando en BD: {e}")
            self.conn.rollback()
            import traceback
            traceback.print_exc()
            return False
    
    def get_statistics(self):
        """Obtiene estadísticas de la base de datos"""
        
        self.cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN LLM_ANALYZED = 1 THEN 1 END) as llm_analyzed,
                COUNT(CASE WHEN LLM_GENRE != 'Desconocido' AND LLM_GENRE IS NOT NULL THEN 1 END) as with_genre,
                COUNT(LLM_REAL_YEAR) as with_real_year,
                COUNT(LLM_EMOTIONS) as with_emotions,
                COUNT(LLM_CAMELOT_KEY) as with_camelot,
                COUNT(CASE WHEN LLM_SENTIMENT IS NOT NULL AND LLM_SENTIMENT != -999 THEN 1 END) as with_sentiment
            FROM llm_metadata
        """)
        
        return self.cursor.fetchone()
    
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
            print(f"Uso: python3 save_gpt4_complete.py <archivo.json>")
            return
        
        json_file = str(files[0])
    
    print("="*80)
    print("💾 GUARDANDO RESULTADO COMPLETO GPT-4 EN BASE DE DATOS")
    print("="*80)
    print(f"Archivo: {json_file}")
    
    try:
        # Cargar resultado
        with open(json_file, 'r') as f:
            result = json.load(f)
        
        # Mostrar resumen del archivo
        if 'gpt4_analysis' in result:
            analysis = result['gpt4_analysis']
            print(f"\n📋 Resumen del análisis:")
            print(f"  • Género: {analysis.get('genre')}")
            print(f"  • Mood: {analysis.get('mood')}")
            print(f"  • Era: {analysis.get('era')}")
            print(f"  • Año real: {analysis.get('real_year')}")
            print(f"  • Confianza: {analysis.get('confidence', 0):.2f}")
        
        # Guardar en BD
        saver = CompleteGPT4Saver()
        success = saver.save_gpt4_complete_result(result)
        
        if success:
            print("\n✅ GUARDADO EXITOSO EN LA BASE DE DATOS")
            
            # Estadísticas finales
            stats = saver.get_statistics()
            if stats:
                print(f"\n📊 Estadísticas actualizadas de la BD:")
                print(f"  • Total registros: {stats[0]}")
                print(f"  • Analizados con LLM: {stats[1]}")
                print(f"  • Con género válido: {stats[2]}")
                print(f"  • Con año real: {stats[3]}")
                print(f"  • Con emociones: {stats[4]}")
                print(f"  • Con Camelot key: {stats[5]}")
                print(f"  • Con sentiment: {stats[6]}")
            
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