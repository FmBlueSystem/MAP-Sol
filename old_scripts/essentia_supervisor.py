#!/usr/bin/env python3
"""
ESSENTIA SUPERVISOR
Mantiene el proceso de análisis corriendo continuamente
Reinicia automáticamente si se detiene
"""

import subprocess
import time
import sqlite3
import sys
import os
from datetime import datetime
import signal

class EssentiaSupervisor:
    def __init__(self, batch_size=100, max_retries=5):
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.db_path = 'music_analyzer.db'
        self.process = None
        self.running = True
        self.retry_count = 0
        
        # Manejar señales para salida limpia
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
    def signal_handler(self, sig, frame):
        """Manejar Ctrl+C y SIGTERM gracefully"""
        print("\n⚠️ Señal de terminación recibida. Finalizando...")
        self.running = False
        if self.process:
            self.process.terminate()
        sys.exit(0)
    
    def get_pending_count(self):
        """Obtener cantidad de archivos pendientes"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(DISTINCT af.id) 
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
                WHERE af.file_path IS NOT NULL
                AND (lm.AI_LOUDNESS IS NULL OR lm.AI_CONFIDENCE < 0.5)
            ''')
            count = cursor.fetchone()[0]
            conn.close()
            return count
        except Exception as e:
            print(f"Error checking pending: {e}")
            return 0
    
    def get_progress_stats(self):
        """Obtener estadísticas de progreso"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT af.id) as total,
                    COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as analyzed,
                    AVG(lm.AI_CONFIDENCE) as avg_conf
                FROM audio_files af
                LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            ''')
            total, analyzed, avg_conf = cursor.fetchone()
            conn.close()
            
            percent = (analyzed / total * 100) if total > 0 else 0
            return total, analyzed, percent, avg_conf
        except Exception as e:
            print(f"Error getting stats: {e}")
            return 0, 0, 0, 0
    
    def run_batch(self):
        """Ejecutar un batch de análisis"""
        pending = self.get_pending_count()
        
        if pending == 0:
            print("✅ Todos los archivos han sido procesados!")
            return False
        
        print(f"\n🚀 Iniciando batch de {min(self.batch_size, pending)} archivos...")
        print(f"   Pendientes: {pending}")
        
        # Ejecutar essentia_smart60.py
        cmd = ['python3', 'essentia_smart60.py', '--batch', str(self.batch_size)]
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                bufsize=1
            )
            
            # Monitorear la salida
            while True:
                output = self.process.stdout.readline()
                if output == '' and self.process.poll() is not None:
                    break
                if output:
                    # Mostrar solo líneas importantes
                    if any(keyword in output for keyword in ['File ID', '✅', '❌', 'Complete']):
                        print(output.strip())
            
            # Verificar código de salida
            rc = self.process.poll()
            if rc == 0:
                print("✅ Batch completado exitosamente")
                self.retry_count = 0  # Reset retry counter on success
                return True
            else:
                print(f"⚠️ Batch terminó con código {rc}")
                self.retry_count += 1
                return True  # Continuar intentando
                
        except Exception as e:
            print(f"❌ Error ejecutando batch: {e}")
            self.retry_count += 1
            return True  # Continuar intentando
    
    def run_supervisor(self):
        """Loop principal del supervisor"""
        print(f"""
╔══════════════════════════════════════════════╗
║     ESSENTIA SUPERVISOR v1.0                ║
║     Análisis continuo con auto-reinicio     ║
╚══════════════════════════════════════════════╝

📊 Configuración:
   - Batch size: {self.batch_size}
   - Max retries: {self.max_retries}
   - Database: {self.db_path}

Iniciando supervisión...
Press Ctrl+C para detener
        """)
        
        while self.running:
            # Mostrar estadísticas
            total, analyzed, percent, avg_conf = self.get_progress_stats()
            
            print(f"\n{'='*50}")
            print(f"📊 PROGRESO: {analyzed}/{total} ({percent:.1f}%)")
            print(f"⭐ Confidence promedio: {avg_conf:.2f}" if avg_conf else "")
            print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*50}")
            
            # Verificar límite de reintentos
            if self.retry_count >= self.max_retries:
                print(f"❌ Máximo de reintentos alcanzado ({self.max_retries})")
                print("💡 Verificar logs para resolver el problema")
                break
            
            # Ejecutar batch
            if not self.run_batch():
                # No hay más archivos pendientes
                break
            
            # Pequeña pausa entre batches
            print("\n⏳ Esperando 5 segundos antes del siguiente batch...")
            time.sleep(5)
        
        # Mostrar resumen final
        total, analyzed, percent, avg_conf = self.get_progress_stats()
        print(f"""
╔══════════════════════════════════════════════╗
║            RESUMEN FINAL                    ║
╚══════════════════════════════════════════════╝

✅ Archivos analizados: {analyzed}/{total} ({percent:.1f}%)
⭐ Confidence promedio: {avg_conf:.2f if avg_conf else 'N/A'}
🕐 Finalizado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """)

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Essentia Supervisor - Análisis continuo')
    parser.add_argument('--batch', type=int, default=100, help='Tamaño del batch')
    parser.add_argument('--max-retries', type=int, default=5, help='Máximo de reintentos')
    
    args = parser.parse_args()
    
    supervisor = EssentiaSupervisor(args.batch, args.max_retries)
    supervisor.run_supervisor()

if __name__ == '__main__':
    main()