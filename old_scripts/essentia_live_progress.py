#!/usr/bin/env python3
"""
ESSENTIA LIVE PROGRESS
Barra de progreso animada en tiempo real
"""

import sqlite3
import time
import sys
from datetime import datetime, timedelta

class LiveProgress:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.last_count = 0
        self.start_time = time.time()
        self.samples = []  # Para calcular velocidad promedio
        
    def get_stats(self):
        """Obtener estadísticas actuales"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT af.id) as total,
                    COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            ''')
            total, analyzed = cursor.fetchone()
            conn.close()
            return total or 0, analyzed or 0
        except:
            return 0, 0
    
    def update(self):
        """Actualizar una línea con la barra de progreso"""
        total, analyzed = self.get_stats()
        
        if total == 0:
            return
        
        # Calcular progreso
        percent = (analyzed / total) * 100
        pending = total - analyzed
        
        # Calcular velocidad
        current_time = time.time()
        if self.last_count > 0:
            rate = (analyzed - self.last_count) / 2  # Por intervalo de 2 segundos
            self.samples.append(rate)
            if len(self.samples) > 30:  # Mantener últimos 30 samples
                self.samples.pop(0)
            avg_rate = sum(self.samples) / len(self.samples) if self.samples else 0
        else:
            avg_rate = 0
        
        self.last_count = analyzed
        
        # Estimar tiempo restante
        if avg_rate > 0:
            eta_seconds = pending / (avg_rate * 60)  # Convertir a minutos
            eta = datetime.now() + timedelta(minutes=eta_seconds)
            eta_str = eta.strftime('%H:%M')
        else:
            eta_str = 'calculando...'
        
        # Crear barra de progreso
        bar_width = 40
        filled = int(bar_width * percent / 100)
        
        # Animación de la barra
        if analyzed < total:
            # Caracteres de animación
            spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
            spin_idx = int(current_time * 4) % len(spinner)
            animation = spinner[spin_idx]
        else:
            animation = '✓'
        
        # Colores
        if percent < 25:
            color = '\033[91m'  # Rojo
        elif percent < 50:
            color = '\033[93m'  # Amarillo
        elif percent < 75:
            color = '\033[94m'  # Azul
        else:
            color = '\033[92m'  # Verde
        
        reset = '\033[0m'
        bold = '\033[1m'
        
        # Construir barra
        bar = f"{color}{'█' * filled}{reset}{'░' * (bar_width - filled)}"
        
        # Construir línea completa
        line = (f"\r{animation} {bold}Essentia Smart-60:{reset} "
                f"[{bar}] "
                f"{color}{percent:5.1f}%{reset} | "
                f"{analyzed:4}/{total} | "
                f"⏳ {pending:4} | "
                f"⚡ {avg_rate*60:.0f}/min | "
                f"🕐 {eta_str}  ")
        
        # Escribir sin salto de línea
        sys.stdout.write(line)
        sys.stdout.flush()
    
    def run(self):
        """Ejecutar monitor continuo"""
        print("\n" + "="*80)
        print("📊 ESSENTIA SMART-60 - ANÁLISIS DE 7 PARÁMETROS")
        print("="*80)
        print()
        
        try:
            while True:
                self.update()
                time.sleep(2)
                
                # Verificar si se completó
                total, analyzed = self.get_stats()
                if analyzed >= total and total > 0:
                    print("\n\n✅ ¡Análisis completado!")
                    print(f"   Total: {analyzed:,} archivos")
                    elapsed = time.time() - self.start_time
                    print(f"   Tiempo: {elapsed/3600:.1f} horas")
                    break
                    
        except KeyboardInterrupt:
            print("\n\n⚠️ Monitor detenido")
            total, analyzed = self.get_stats()
            print(f"   Progreso: {analyzed:,}/{total:,} ({analyzed/total*100:.1f}%)")

if __name__ == '__main__':
    monitor = LiveProgress()
    monitor.run()