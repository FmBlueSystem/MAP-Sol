#!/usr/bin/env python3
"""
ESSENTIA PROGRESS MONITOR
Monitoreo en tiempo real del análisis de Essentia
"""

import sqlite3
import time
import sys
from datetime import datetime
import os

class EssentiaMonitor:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.last_complete = 0
        
    def clear_screen(self):
        """Limpiar pantalla"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
    def get_stats(self):
        """Obtener estadísticas actuales"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Estadísticas generales
        cursor.execute('''
            SELECT 
                COUNT(DISTINCT af.id) as total_files,
                COUNT(DISTINCT CASE 
                    WHEN lm.AI_LOUDNESS IS NOT NULL 
                    AND lm.AI_DANCEABILITY IS NOT NULL 
                    AND lm.AI_ACOUSTICNESS IS NOT NULL 
                    AND lm.AI_INSTRUMENTALNESS IS NOT NULL 
                    AND lm.AI_LIVENESS IS NOT NULL 
                    AND lm.AI_SPEECHINESS IS NOT NULL 
                    AND lm.AI_VALENCE IS NOT NULL 
                    THEN lm.file_id END) as complete
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        ''')
        
        total, complete = cursor.fetchone()
        
        # Estadísticas por parámetro
        cursor.execute('''
            SELECT 
                COUNT(AI_LOUDNESS) as loudness,
                COUNT(AI_DANCEABILITY) as dance,
                COUNT(AI_ACOUSTICNESS) as acoustic,
                COUNT(AI_INSTRUMENTALNESS) as instrumental,
                COUNT(AI_LIVENESS) as liveness,
                COUNT(AI_SPEECHINESS) as speech,
                COUNT(AI_VALENCE) as valence,
                AVG(AI_LOUDNESS) as avg_loud,
                AVG(AI_DANCEABILITY) as avg_dance,
                AVG(AI_VALENCE) as avg_valence,
                AVG(AI_ENERGY) as avg_energy
            FROM llm_metadata
        ''')
        
        params = cursor.fetchone()
        
        # Últimos archivos procesados
        cursor.execute('''
            SELECT 
                af.file_name,
                lm.AI_DANCEABILITY,
                lm.AI_VALENCE,
                lm.AI_ANALYZED_DATE
            FROM llm_metadata lm
            JOIN audio_files af ON lm.file_id = af.id
            WHERE lm.AI_ANALYZED_DATE IS NOT NULL
            ORDER BY lm.AI_ANALYZED_DATE DESC
            LIMIT 5
        ''')
        
        recent = cursor.fetchall()
        
        conn.close()
        
        return {
            'total': total,
            'complete': complete,
            'params': params,
            'recent': recent
        }
    
    def display_stats(self, stats):
        """Mostrar estadísticas formateadas"""
        self.clear_screen()
        
        total = stats['total']
        complete = stats['complete']
        pending = total - complete
        percent = (complete / total * 100) if total > 0 else 0
        
        # Calcular velocidad
        if self.last_complete > 0:
            rate = complete - self.last_complete
        else:
            rate = 0
        self.last_complete = complete
        
        # Barra de progreso
        bar_length = 50
        filled = int(bar_length * percent / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║            ESSENTIA ANALYSIS MONITOR v1.0                   ║
╚══════════════════════════════════════════════════════════════╝

📊 OVERALL PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[{bar}] {percent:.1f}%

📁 Files:      {complete:,} / {total:,}
⏳ Pending:    {pending:,}
⚡ Rate:       {rate} files/min
🕐 Time:       {datetime.now().strftime('%H:%M:%S')}

📈 PARAMETER COVERAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameter         Count    Coverage    Avg Value
─────────────────────────────────────────────────────────────
Loudness          {stats['params'][0]:,}     {stats['params'][0]/total*100:5.1f}%     {stats['params'][7]:.1f} LUFS
Danceability      {stats['params'][1]:,}     {stats['params'][1]/total*100:5.1f}%     {stats['params'][8]:.3f}
Acousticness      {stats['params'][2]:,}     {stats['params'][2]/total*100:5.1f}%     
Instrumentalness  {stats['params'][3]:,}     {stats['params'][3]/total*100:5.1f}%     
Liveness          {stats['params'][4]:,}     {stats['params'][4]/total*100:5.1f}%     
Speechiness       {stats['params'][5]:,}     {stats['params'][5]/total*100:5.1f}%     
Valence           {stats['params'][6]:,}     {stats['params'][6]/total*100:5.1f}%     {stats['params'][9]:.3f}

🎵 RECENT ANALYSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━""")
        
        for file_name, dance, valence, date in stats['recent']:
            # Truncar nombre si es muy largo
            if file_name and len(file_name) > 40:
                file_name = file_name[:37] + '...'
            print(f"✓ {file_name:<40} D:{dance:.2f} V:{valence:.2f}")
        
        print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Press Ctrl+C to stop monitoring
""")
    
    def run(self, interval=5):
        """Ejecutar monitor en loop"""
        print("Starting monitor... Press Ctrl+C to stop")
        
        try:
            while True:
                stats = self.get_stats()
                self.display_stats(stats)
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n\n✅ Monitor stopped")
            
            # Mostrar resumen final
            stats = self.get_stats()
            print(f"""
Final Statistics:
─────────────────
Total files:     {stats['total']:,}
Complete:        {stats['complete']:,} ({stats['complete']/stats['total']*100:.1f}%)
Remaining:       {stats['total'] - stats['complete']:,}
""")

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Essentia Progress Monitor')
    parser.add_argument('--db', default='music_analyzer.db', help='Database path')
    parser.add_argument('--interval', type=int, default=5, help='Update interval in seconds')
    
    args = parser.parse_args()
    
    monitor = EssentiaMonitor(args.db)
    monitor.run(args.interval)

if __name__ == '__main__':
    main()