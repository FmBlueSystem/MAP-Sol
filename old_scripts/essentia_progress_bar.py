#!/usr/bin/env python3
"""
ESSENTIA PROGRESS BAR
Monitor visual con barra de progreso en tiempo real
"""

import sqlite3
import time
import sys
import os
from datetime import datetime, timedelta
import shutil

class ProgressMonitor:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.last_analyzed = 0
        self.start_time = time.time()
        
    def get_terminal_width(self):
        """Obtener ancho de la terminal"""
        return shutil.get_terminal_size().columns
    
    def create_progress_bar(self, current, total, width=50):
        """Crear barra de progreso visual"""
        percent = current / total if total > 0 else 0
        filled = int(width * percent)
        
        # Colores ANSI
        GREEN = '\033[92m'
        YELLOW = '\033[93m'
        BLUE = '\033[94m'
        RESET = '\033[0m'
        BOLD = '\033[1m'
        
        # Elegir color según progreso
        if percent < 0.3:
            color = YELLOW
        elif percent < 0.7:
            color = BLUE
        else:
            color = GREEN
        
        # Crear barra
        bar = f"{color}{'█' * filled}{RESET}{'░' * (width - filled)}"
        
        return bar, percent * 100
    
    def format_time(self, seconds):
        """Formatear tiempo en formato legible"""
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            return f"{int(seconds/60)}m {int(seconds%60)}s"
        else:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"
    
    def get_stats(self):
        """Obtener estadísticas de la base de datos"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Estadísticas principales
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT af.id) as total,
                    COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed,
                    AVG(lm.AI_CONFIDENCE) as avg_conf,
                    COUNT(DISTINCT CASE WHEN lm.AI_CONFIDENCE >= 0.8 THEN lm.file_id END) as high_conf
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            ''')
            
            total, analyzed, avg_conf, high_conf = cursor.fetchone()
            
            # Archivos recientes
            cursor.execute('''
                SELECT COUNT(*) 
                FROM llm_metadata 
                WHERE AI_ANALYZED_DATE > datetime('now', '-1 minute')
            ''')
            recent = cursor.fetchone()[0]
            
            # Último archivo procesado
            cursor.execute('''
                SELECT af.file_name, lm.AI_ANALYZED_DATE
                FROM llm_metadata lm
                JOIN audio_files af ON lm.file_id = af.id
                WHERE lm.AI_ANALYZED_DATE IS NOT NULL
                ORDER BY lm.AI_ANALYZED_DATE DESC
                LIMIT 1
            ''')
            last_file = cursor.fetchone()
            
            conn.close()
            
            return {
                'total': total or 0,
                'analyzed': analyzed or 0,
                'avg_conf': avg_conf or 0,
                'high_conf': high_conf or 0,
                'recent': recent or 0,
                'last_file': last_file[0] if last_file else None
            }
        except Exception as e:
            return {
                'total': 0,
                'analyzed': 0,
                'avg_conf': 0,
                'high_conf': 0,
                'recent': 0,
                'last_file': None
            }
    
    def clear_screen(self):
        """Limpiar pantalla"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
    def display(self):
        """Mostrar barra de progreso y estadísticas"""
        stats = self.get_stats()
        
        # Calcular velocidad
        if self.last_analyzed > 0:
            rate = stats['analyzed'] - self.last_analyzed
        else:
            rate = 0
        self.last_analyzed = stats['analyzed']
        
        # Calcular tiempo restante
        elapsed = time.time() - self.start_time
        if rate > 0:
            remaining_files = stats['total'] - stats['analyzed']
            eta_seconds = remaining_files / rate * 60  # rate es por minuto
            eta = datetime.now() + timedelta(seconds=eta_seconds)
            eta_str = eta.strftime('%H:%M')
        else:
            eta_str = '--:--'
        
        # Crear barra de progreso
        term_width = self.get_terminal_width()
        bar_width = min(60, term_width - 30)
        bar, percent = self.create_progress_bar(stats['analyzed'], stats['total'], bar_width)
        
        # Colores
        CYAN = '\033[96m'
        GREEN = '\033[92m'
        YELLOW = '\033[93m'
        MAGENTA = '\033[95m'
        BOLD = '\033[1m'
        RESET = '\033[0m'
        
        # Limpiar y mostrar
        self.clear_screen()
        
        print(f"""
{CYAN}{BOLD}╔══════════════════════════════════════════════════════════════╗
║            ESSENTIA SMART-60 ANALYSIS PROGRESS              ║
╚══════════════════════════════════════════════════════════════╝{RESET}

{BOLD}📊 PROGRESO GENERAL{RESET}
[{bar}] {percent:.1f}%

{GREEN}✅ Analizados:{RESET} {stats['analyzed']:,} / {stats['total']:,}
{YELLOW}⏳ Pendientes:{RESET} {stats['total'] - stats['analyzed']:,}
{MAGENTA}⚡ Velocidad:{RESET}  {rate} archivos/min
{CYAN}🕐 ETA:{RESET}       {eta_str}

{BOLD}📈 CALIDAD{RESET}
{GREEN}⭐ Confidence:{RESET}     {stats['avg_conf']:.2f}
{GREEN}🏆 Alta calidad:{RESET}  {stats['high_conf']:,} archivos (≥0.8)

{BOLD}🎵 ÚLTIMO ARCHIVO{RESET}
{stats['last_file'][:60] if stats['last_file'] else 'Esperando...'}

{BOLD}⏱️ TIEMPO{RESET}
Transcurrido: {self.format_time(elapsed)}
Hora actual:  {datetime.now().strftime('%H:%M:%S')}

{YELLOW}[Ctrl+C para salir]{RESET}
        """)
    
    def run(self, interval=2):
        """Ejecutar monitor con actualización periódica"""
        try:
            while True:
                self.display()
                time.sleep(interval)
        except KeyboardInterrupt:
            print(f"\n\n{BOLD}✅ Monitor detenido{RESET}")
            stats = self.get_stats()
            print(f"Archivos analizados: {stats['analyzed']:,} / {stats['total']:,}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Monitor con barra de progreso')
    parser.add_argument('--interval', type=int, default=2, help='Intervalo de actualización (segundos)')
    
    args = parser.parse_args()
    
    # Verificar que hay un proceso corriendo
    import subprocess
    result = subprocess.run(['pgrep', '-f', 'essentia_smart60'], capture_output=True)
    if not result.stdout:
        print("⚠️  No hay proceso de análisis activo")
        print("Iniciando monitor de todos modos...")
    
    monitor = ProgressMonitor()
    monitor.run(args.interval)

# Variables de color para uso global
CYAN = '\033[96m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
MAGENTA = '\033[95m'
BOLD = '\033[1m'
RESET = '\033[0m'

if __name__ == '__main__':
    main()