#!/usr/bin/env python3
"""
Script con consultas útiles para explorar los datos de análisis GPT-4
"""

import sqlite3
import json
from typing import List, Dict
from tabulate import tabulate

class AnalysisQueryTool:
    def __init__(self, db_path: str = 'music_analyzer.db'):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
    
    def find_unknown_fields(self) -> List[Dict]:
        """Encuentra todos los registros con campos marcados como desconocidos"""
        
        query = """
            SELECT 
                af.file_name,
                lm.LLM_GENRE,
                lm.AI_MOOD,
                lm.AI_ENERGY,
                lm.LLM_LYRICS_SOURCE,
                lm.AI_CONFIDENCE
            FROM llm_metadata lm
            JOIN audio_files af ON lm.file_id = af.id
            WHERE 
                lm.LLM_GENRE = 'Desconocido' OR
                lm.AI_MOOD = 'No Determinado' OR
                lm.AI_ENERGY = -1 OR
                lm.LLM_LYRICS_SOURCE = 'no_analizado' OR
                lm.AI_CONFIDENCE = 0
            LIMIT 20
        """
        
        self.cursor.execute(query)
        return [dict(row) for row in self.cursor.fetchall()]
    
    def get_genre_distribution(self) -> List[Dict]:
        """Obtiene distribución de géneros"""
        
        query = """
            SELECT 
                LLM_GENRE as genre,
                COUNT(*) as count,
                AVG(AI_ENERGY) as avg_energy,
                AVG(AI_DANCEABILITY) as avg_danceability,
                AVG(AI_VALENCE) as avg_valence
            FROM llm_metadata
            WHERE LLM_GENRE IS NOT NULL AND LLM_GENRE != 'Desconocido'
            GROUP BY LLM_GENRE
            ORDER BY count DESC
            LIMIT 30
        """
        
        self.cursor.execute(query)
        return [dict(row) for row in self.cursor.fetchall()]
    
    def get_tracks_by_year(self, year: int) -> List[Dict]:
        """Obtiene tracks de un año específico"""
        
        query = """
            SELECT 
                af.artist,
                af.title,
                lm.LLM_GENRE as genre,
                lm.LLM_REAL_YEAR as real_year,
                lm.LLM_YEAR_SOURCE as year_source,
                lm.AI_MOOD as mood
            FROM llm_metadata lm
            JOIN audio_files af ON lm.file_id = af.id
            WHERE lm.LLM_REAL_YEAR = ?
            ORDER BY af.artist
        """
        
        self.cursor.execute(query, (year,))
        return [dict(row) for row in self.cursor.fetchall()]
    
    def get_emotional_analysis(self) -> List[Dict]:
        """Analiza distribución emocional de tracks con emociones"""
        
        query = """
            SELECT 
                af.file_name,
                af.artist,
                af.title,
                lm.LLM_SENTIMENT as sentiment,
                lm.LLM_EMOTIONS as emotions,
                lm.AI_MOOD as mood
            FROM llm_metadata lm
            JOIN audio_files af ON lm.file_id = af.id
            WHERE lm.LLM_EMOTIONS IS NOT NULL
            LIMIT 20
        """
        
        self.cursor.execute(query)
        results = []
        for row in self.cursor.fetchall():
            data = dict(row)
            if data['emotions']:
                try:
                    emotions = json.loads(data['emotions'])
                    # Encontrar emoción dominante
                    if emotions and isinstance(emotions, dict):
                        valid_emotions = {k: v for k, v in emotions.items() if v != -1}
                        if valid_emotions:
                            dominant = max(valid_emotions.items(), key=lambda x: x[1])
                            data['dominant_emotion'] = f"{dominant[0]} ({dominant[1]:.2f})"
                except:
                    data['dominant_emotion'] = 'Error parsing'
            results.append(data)
        return results
    
    def get_complete_tracks(self) -> List[Dict]:
        """Obtiene tracks con análisis completo (sin campos desconocidos)"""
        
        query = """
            SELECT 
                af.artist,
                af.title,
                lm.LLM_GENRE as genre,
                lm.AI_MOOD as mood,
                lm.LLM_REAL_YEAR as year,
                lm.LLM_CAMELOT_KEY as camelot,
                lm.AI_CONFIDENCE as confidence
            FROM llm_metadata lm
            JOIN audio_files af ON lm.file_id = af.id
            WHERE 
                lm.LLM_GENRE != 'Desconocido' AND
                lm.AI_MOOD != 'No Determinado' AND
                lm.AI_ENERGY != -1 AND
                lm.LLM_REAL_YEAR IS NOT NULL AND
                lm.AI_CONFIDENCE > 0.7
            ORDER BY lm.AI_CONFIDENCE DESC
            LIMIT 20
        """
        
        self.cursor.execute(query)
        return [dict(row) for row in self.cursor.fetchall()]
    
    def get_statistics(self) -> Dict:
        """Obtiene estadísticas generales"""
        
        stats = {}
        
        # Total de archivos
        self.cursor.execute("SELECT COUNT(*) FROM audio_files")
        stats['total_files'] = self.cursor.fetchone()[0]
        
        # Analizados
        self.cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_ANALYZED = 1")
        stats['llm_analyzed'] = self.cursor.fetchone()[0]
        
        # Con campos completos
        self.cursor.execute("""
            SELECT COUNT(*) FROM llm_metadata 
            WHERE LLM_GENRE != 'Desconocido' 
            AND AI_MOOD != 'No Determinado'
            AND AI_ENERGY != -1
        """)
        stats['complete_analysis'] = self.cursor.fetchone()[0]
        
        # Con año real
        self.cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_REAL_YEAR IS NOT NULL")
        stats['with_real_year'] = self.cursor.fetchone()[0]
        
        # Con emociones
        self.cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_EMOTIONS IS NOT NULL")
        stats['with_emotions'] = self.cursor.fetchone()[0]
        
        # Con Camelot
        self.cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE LLM_CAMELOT_KEY IS NOT NULL")
        stats['with_camelot'] = self.cursor.fetchone()[0]
        
        return stats
    
    def close(self):
        self.conn.close()

def main():
    """Función principal con menú de consultas"""
    
    print("="*80)
    print("🔍 EXPLORADOR DE DATOS DE ANÁLISIS GPT-4")
    print("="*80)
    
    tool = AnalysisQueryTool()
    
    # Estadísticas generales
    stats = tool.get_statistics()
    print("\n📊 ESTADÍSTICAS GENERALES:")
    print(f"  • Total archivos: {stats['total_files']}")
    print(f"  • Analizados con LLM: {stats['llm_analyzed']}")
    print(f"  • Análisis completo: {stats['complete_analysis']}")
    print(f"  • Con año real: {stats['with_real_year']}")
    print(f"  • Con emociones: {stats['with_emotions']}")
    print(f"  • Con Camelot key: {stats['with_camelot']}")
    
    while True:
        print("\n" + "-"*80)
        print("OPCIONES:")
        print("  1. Ver distribución de géneros")
        print("  2. Buscar campos desconocidos")
        print("  3. Ver tracks con análisis completo")
        print("  4. Ver análisis emocional")
        print("  5. Buscar tracks por año")
        print("  6. Salir")
        
        choice = input("\nSelecciona opción (1-6): ").strip()
        
        if choice == "1":
            print("\n🎵 DISTRIBUCIÓN DE GÉNEROS:")
            genres = tool.get_genre_distribution()
            if genres:
                headers = ['Género', 'Cantidad', 'Energy', 'Dance', 'Valence']
                rows = []
                for g in genres[:15]:
                    rows.append([
                        g['genre'],
                        g['count'],
                        f"{g['avg_energy']:.2f}" if g['avg_energy'] else 'N/A',
                        f"{g['avg_danceability']:.2f}" if g['avg_danceability'] else 'N/A',
                        f"{g['avg_valence']:.2f}" if g['avg_valence'] else 'N/A'
                    ])
                print(tabulate(rows, headers=headers, tablefmt='grid'))
        
        elif choice == "2":
            print("\n❌ CAMPOS DESCONOCIDOS:")
            unknown = tool.find_unknown_fields()
            if unknown:
                for u in unknown[:10]:
                    print(f"\n  📁 {u['file_name'][:50]}")
                    print(f"     Genre: {u['LLM_GENRE']}, Mood: {u['AI_MOOD']}")
                    print(f"     Energy: {u['AI_ENERGY']}, Lyrics: {u['LLM_LYRICS_SOURCE']}")
        
        elif choice == "3":
            print("\n✅ TRACKS CON ANÁLISIS COMPLETO:")
            complete = tool.get_complete_tracks()
            if complete:
                for c in complete[:10]:
                    print(f"\n  🎵 {c['artist']} - {c['title']}")
                    print(f"     {c['genre']} | {c['mood']} | {c['year']} | {c['camelot']}")
                    print(f"     Confianza: {c['confidence']:.2f}")
        
        elif choice == "4":
            print("\n😊 ANÁLISIS EMOCIONAL:")
            emotions = tool.get_emotional_analysis()
            if emotions:
                for e in emotions[:10]:
                    print(f"\n  🎵 {e['artist']} - {e['title']}")
                    print(f"     Mood: {e['mood']}, Sentiment: {e.get('sentiment', 'N/A')}")
                    if 'dominant_emotion' in e:
                        print(f"     Emoción dominante: {e['dominant_emotion']}")
        
        elif choice == "5":
            year = input("Ingresa el año a buscar: ").strip()
            if year.isdigit():
                print(f"\n📅 TRACKS DEL AÑO {year}:")
                tracks = tool.get_tracks_by_year(int(year))
                if tracks:
                    for t in tracks:
                        print(f"  • {t['artist']} - {t['title']}")
                        print(f"    {t['genre']} | {t['mood']}")
                else:
                    print(f"  No se encontraron tracks del año {year}")
        
        elif choice == "6":
            break
    
    tool.close()
    print("\n👋 Hasta luego!")

if __name__ == "__main__":
    try:
        # Intentar instalar tabulate si no está
        from tabulate import tabulate
    except ImportError:
        print("Instalando tabulate...")
        import subprocess
        subprocess.run(["pip3", "install", "tabulate"])
        from tabulate import tabulate
    
    main()