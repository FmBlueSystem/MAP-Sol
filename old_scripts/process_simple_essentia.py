#!/usr/bin/env python3
"""
Procesador Simple y Directo de Essentia
Versión que SÍ funciona con archivos del disco externo
"""

import os
import sys
import sqlite3
import time
import warnings
from datetime import datetime
from pathlib import Path
import numpy as np

# Configuración para suprimir warnings
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

# Redirigir stderr para eliminar warnings de FFmpeg
import io
sys.stderr = io.StringIO()

import essentia
import essentia.standard as es

# Desactivar todos los logs de Essentia
essentia.log.warningActive = False
essentia.log.infoActive = False
essentia.log.errorActive = False


class SimpleEssentiaProcessor:
    """Procesador simple que funciona"""
    
    def __init__(self, db_path="music_analyzer.db"):
        self.db_path = db_path
        self.processed = 0
        self.errors = 0
        self.start_time = time.time()
        
    def analyze_file(self, file_path):
        """Analiza un archivo y retorna las 7 características"""
        try:
            # Cargar audio (mono, 44100 Hz)
            audio = es.MonoLoader(filename=file_path, sampleRate=44100)()
            
            if len(audio) == 0:
                return None
            
            # Calcular características básicas
            results = {}
            
            # 1. LUFS (aproximado usando RMS)
            rms = es.RMS()(audio)
            lufs = 20 * np.log10(max(rms, 1e-10))
            results['loudness'] = round(max(-60, min(0, lufs)), 1)
            
            # 2. Danceability (basado en BPM y energía)
            rhythm = es.RhythmExtractor2013(method="degara")
            bpm, beats, confidence, _, _ = rhythm(audio)
            energy = es.Energy()(audio)
            
            # Normalizar BPM (120-130 es ideal para bailar)
            bpm_score = 1.0 - min(1.0, abs(bpm - 125) / 60)
            energy_norm = min(1.0, energy / 1000000) if energy > 1 else energy
            results['danceability'] = round(0.6 * bpm_score + 0.4 * energy_norm, 3)
            
            # 3. Acousticness (basado en spectral flatness)
            spectrum = es.Spectrum()(audio[:2048] if len(audio) > 2048 else audio)
            flatness = es.Flatness()(spectrum)
            results['acousticness'] = round(1.0 - flatness, 3)
            
            # 4. Instrumentalness (basado en ZCR)
            zcr = es.ZeroCrossingRate()(audio[:2048] if len(audio) > 2048 else audio)
            if zcr < 0.05 or zcr > 0.3:
                results['instrumentalness'] = 0.8
            else:
                results['instrumentalness'] = 0.3
                
            # 5. Liveness (basado en complejidad dinámica)
            try:
                complexity = es.DynamicComplexity()(audio)
                if isinstance(complexity, tuple):
                    complexity = complexity[0]
                results['liveness'] = round(min(1.0, float(complexity) * 2), 3)
            except:
                results['liveness'] = 0.1
                
            # 6. Speechiness (basado en energía)
            # Análisis simple de pausas
            frame_size = int(0.025 * 44100)
            hop_size = int(0.010 * 44100)
            energy_values = []
            
            for i in range(0, min(len(audio), 44100*30), hop_size):
                if i + frame_size < len(audio):
                    frame = audio[i:i+frame_size]
                    energy_values.append(es.Energy()(frame))
                    
            if energy_values:
                threshold = np.mean(energy_values) * 0.1
                silence_ratio = sum(1 for e in energy_values if e < threshold) / len(energy_values)
                results['speechiness'] = round(min(1.0, silence_ratio * 2), 3)
            else:
                results['speechiness'] = 0.0
                
            # 7. Valence (basado en tonalidad y tempo)
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            
            scale_score = 0.7 if scale == 'major' else 0.3
            tempo_score = 0.8 if 120 <= bpm <= 140 else 0.5
            results['valence'] = round(scale_score * 0.6 + tempo_score * 0.4, 3)
            
            # Agregar BPM y key para referencia
            results['bpm'] = round(bpm)
            results['key'] = f"{key} {scale}"
            results['energy'] = round(energy_norm, 3)
            
            return results
            
        except Exception as e:
            return None
            
    def process_batch(self, limit=100):
        """Procesa un lote de archivos"""
        
        # Restaurar stderr temporalmente para print
        original_stderr = sys.stderr
        sys.stderr = sys.__stderr__
        
        print("\n" + "="*60)
        print("🎵 PROCESADOR SIMPLE DE ESSENTIA")
        print("="*60)
        
        # Obtener archivos pendientes
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                af.id,
                af.file_path,
                af.file_name
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE (lm.ESSENTIA_PROCESSED IS NULL OR lm.ESSENTIA_PROCESSED = 0)
            AND LOWER(af.file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')
            ORDER BY af.id
            LIMIT ?
        """, (limit,))
        
        files = cursor.fetchall()
        
        if not files:
            print("✅ No hay archivos pendientes")
            conn.close()
            return
            
        print(f"📊 Procesando {len(files)} archivos...")
        print("-"*60)
        
        # Procesar cada archivo
        for i, (file_id, file_path, file_name) in enumerate(files, 1):
            # Mostrar progreso
            if len(file_name) > 50:
                display_name = file_name[:47] + "..."
            else:
                display_name = file_name
                
            print(f"[{i}/{len(files)}] {display_name}", end=" ... ")
            
            # Verificar si existe
            if not os.path.exists(file_path):
                print("❌ No existe")
                self.errors += 1
                continue
                
            # Volver a suprimir stderr para el análisis
            sys.stderr = io.StringIO()
            
            # Analizar
            results = self.analyze_file(file_path)
            
            # Restaurar stderr para print
            sys.stderr = sys.__stderr__
            
            if results:
                # Actualizar BD
                try:
                    # Asegurar que existe registro en llm_metadata
                    cursor.execute("SELECT file_id FROM llm_metadata WHERE file_id = ?", (file_id,))
                    if not cursor.fetchone():
                        cursor.execute("INSERT INTO llm_metadata (file_id) VALUES (?)", (file_id,))
                    
                    # Actualizar con resultados
                    cursor.execute("""
                        UPDATE llm_metadata 
                        SET 
                            AI_LOUDNESS = ?,
                            AI_DANCEABILITY = ?,
                            AI_ACOUSTICNESS = ?,
                            AI_INSTRUMENTALNESS = ?,
                            AI_LIVENESS = ?,
                            AI_SPEECHINESS = ?,
                            AI_VALENCE = ?,
                            AI_BPM = ?,
                            AI_ENERGY = ?,
                            AI_KEY = ?,
                            ESSENTIA_PROCESSED = 1,
                            ESSENTIA_DATE = ?
                        WHERE file_id = ?
                    """, (
                        results.get('loudness', -23),
                        results.get('danceability', 0.5),
                        results.get('acousticness', 0.5),
                        results.get('instrumentalness', 0.7),
                        results.get('liveness', 0.1),
                        results.get('speechiness', 0),
                        results.get('valence', 0.5),
                        results.get('bpm', 120),
                        results.get('energy', 0.5),
                        results.get('key', 'C major'),
                        datetime.now().isoformat(),
                        file_id
                    ))
                    
                    conn.commit()
                    self.processed += 1
                    print(f"✅ BPM:{results['bpm']} Val:{results['valence']:.0%}")
                    
                except Exception as e:
                    print(f"❌ Error BD: {e}")
                    self.errors += 1
            else:
                print("❌ Error análisis")
                self.errors += 1
                
            # Mostrar progreso cada 10 archivos
            if i % 10 == 0:
                elapsed = time.time() - self.start_time
                rate = self.processed / elapsed if elapsed > 0 else 0
                print(f"\n--- Progreso: {self.processed} OK | {self.errors} errores | {rate:.1f} archivos/seg ---\n")
                
            # Volver a suprimir stderr
            sys.stderr = io.StringIO()
        
        conn.close()
        
        # Restaurar stderr para resumen final
        sys.stderr = sys.__stderr__
        
        # Resumen
        elapsed = time.time() - self.start_time
        print("\n" + "="*60)
        print("📊 RESUMEN")
        print("="*60)
        print(f"✅ Procesados: {self.processed}")
        print(f"❌ Errores: {self.errors}")
        print(f"⏱️ Tiempo: {elapsed:.1f} segundos")
        print(f"📈 Velocidad: {self.processed/elapsed:.2f} archivos/segundo")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador simple de Essentia')
    parser.add_argument('--limit', type=int, default=100,
                       help='Número de archivos a procesar (default: 100)')
    parser.add_argument('--check-status', action='store_true',
                       help='Ver estado del procesamiento')
    
    args = parser.parse_args()
    
    if args.check_status:
        # Verificar estado
        conn = sqlite3.connect("music_analyzer.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM audio_files WHERE LOWER(file_extension) IN ('mp3', 'm4a', 'flac', 'wav', 'ogg')")
        total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM llm_metadata WHERE ESSENTIA_PROCESSED = 1")
        processed = cursor.fetchone()[0]
        
        print(f"\n📊 ESTADO:")
        print(f"  Total: {total}")
        print(f"  Procesados: {processed}")
        print(f"  Pendientes: {total - processed}")
        print(f"  Progreso: {processed/total*100:.1f}%")
        
        conn.close()
    else:
        # Procesar archivos
        processor = SimpleEssentiaProcessor()
        processor.process_batch(limit=args.limit)


if __name__ == "__main__":
    main()