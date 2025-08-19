#!/usr/bin/env python3
"""
ESSENTIA FAST ANALYZER
Versión optimizada para procesamiento rápido de los 7 parámetros
"""

import os
import sys
import sqlite3
import argparse
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

try:
    import essentia
    import essentia.standard as es
    from essentia import Pool
except ImportError as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

class FastAnalyzer:
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, timeout=30)
        self.cursor = self.conn.cursor()
        self.sample_rate = 44100
        
    def analyze_fast(self, file_path, file_id):
        """Análisis rápido de los 7 parámetros"""
        try:
            # Verificar archivo
            if not os.path.exists(file_path):
                print(f"❌ File not found: {file_path}")
                return False
            
            file_size = os.path.getsize(file_path) / (1024*1024)  # MB
            print(f"📁 File ID {file_id}: {os.path.basename(file_path)} ({file_size:.1f} MB)")
            
            # Cargar audio completo
            loader = es.MonoLoader(
                filename=file_path, 
                sampleRate=self.sample_rate
            )
            audio = loader()
            
            # Limitar a primeros 60 segundos para análisis más rápido
            max_samples = self.sample_rate * 60
            if len(audio) > max_samples:
                audio = audio[:max_samples]
            
            if len(audio) < self.sample_rate:  # Menos de 1 segundo
                print(f"⚠️ Audio too short")
                return False
            
            # Preparar para análisis
            results = {}
            
            # 1. LOUDNESS (simplificado)
            try:
                # Usar RMS como aproximación rápida si EBU falla
                rms = np.sqrt(np.mean(audio**2))
                loudness_db = 20 * np.log10(rms + 1e-10)
                results['loudness'] = round(max(-60, min(0, loudness_db)), 2)
            except:
                results['loudness'] = -23.0
            
            # 2. DANCEABILITY (simplificado)
            try:
                # Usar onset rate como proxy rápido
                onset_rate = es.OnsetRate()
                onsets = onset_rate(audio)[0]
                results['danceability'] = round(min(1.0, onsets / 3), 3)
            except:
                results['danceability'] = 0.5
            
            # 3. ACOUSTICNESS (simplificado)
            try:
                # Usar spectral centroid
                spectrum = es.Spectrum()
                w = es.Windowing(type='hann')
                centroid = es.Centroid()
                
                # Analizar solo 10 frames
                frame_size = 2048
                hop_size = 1024
                centroids = []
                for i in range(0, min(10*hop_size, len(audio)-frame_size), hop_size):
                    frame = audio[i:i+frame_size]
                    spec = spectrum(w(frame))
                    centroids.append(centroid(spec))
                
                avg_centroid = np.mean(centroids) if centroids else 4000
                results['acousticness'] = round(1.0 - min(1.0, avg_centroid / 8000), 3)
            except:
                results['acousticness'] = 0.3
            
            # 4. INSTRUMENTALNESS (simplificado)
            try:
                # Usar ZCR rápido
                zcr = es.ZeroCrossingRate()
                zcr_value = zcr(audio[:self.sample_rate*10])  # Solo 10 segundos
                results['instrumentalness'] = round(1.0 - min(1.0, zcr_value * 10), 3)
            except:
                results['instrumentalness'] = 0.7
            
            # 5. LIVENESS (valor fijo por ahora)
            results['liveness'] = 0.1
            
            # 6. SPEECHINESS (valor fijo por ahora)
            results['speechiness'] = 0.05
            
            # 7. VALENCE (basado en modo si está disponible)
            try:
                # Obtener modo de la BD
                self.cursor.execute('SELECT AI_MODE FROM llm_metadata WHERE file_id = ?', (file_id,))
                row = self.cursor.fetchone()
                mode = row[0] if row and row[0] else 'minor'
                results['valence'] = 0.6 if mode.lower() == 'major' else 0.4
            except:
                results['valence'] = 0.5
            
            # Guardar en BD
            self.save_results(file_id, results)
            
            print(f"✅ Analyzed: L:{results['loudness']:.1f} D:{results['danceability']:.2f} "
                  f"A:{results['acousticness']:.2f} V:{results['valence']:.2f}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    def save_results(self, file_id, results):
        """Guardar resultados en BD"""
        try:
            # Actualizar o insertar
            self.cursor.execute('''
                INSERT INTO llm_metadata (file_id, AI_LOUDNESS, AI_DANCEABILITY, 
                    AI_ACOUSTICNESS, AI_INSTRUMENTALNESS, AI_LIVENESS, 
                    AI_SPEECHINESS, AI_VALENCE, AI_ANALYZED, AI_ANALYZED_DATE)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
                ON CONFLICT(file_id) DO UPDATE SET
                    AI_LOUDNESS = excluded.AI_LOUDNESS,
                    AI_DANCEABILITY = excluded.AI_DANCEABILITY,
                    AI_ACOUSTICNESS = excluded.AI_ACOUSTICNESS,
                    AI_INSTRUMENTALNESS = excluded.AI_INSTRUMENTALNESS,
                    AI_LIVENESS = excluded.AI_LIVENESS,
                    AI_SPEECHINESS = excluded.AI_SPEECHINESS,
                    AI_VALENCE = excluded.AI_VALENCE,
                    AI_ANALYZED = 1,
                    AI_ANALYZED_DATE = datetime('now')
            ''', (
                file_id,
                results['loudness'],
                results['danceability'],
                results['acousticness'],
                results['instrumentalness'],
                results['liveness'],
                results['speechiness'],
                results['valence']
            ))
            
            self.conn.commit()
            
        except Exception as e:
            print(f"DB Error: {e}")
            self.conn.rollback()
    
    def process_batch(self, limit=100):
        """Procesar lote de archivos"""
        print(f"\n🚀 Fast batch processing (limit: {limit})\n")
        
        # Obtener archivos pendientes
        self.cursor.execute('''
            SELECT af.id, af.file_path
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE (lm.AI_LOUDNESS IS NULL OR lm.AI_VALENCE IS NULL)
            AND af.file_path IS NOT NULL
            ORDER BY af.id
            LIMIT ?
        ''', (limit,))
        
        files = self.cursor.fetchall()
        total = len(files)
        
        if total == 0:
            print("✅ No pending files")
            return
        
        print(f"Found {total} files to process\n")
        
        success = 0
        errors = 0
        
        for i, (file_id, file_path) in enumerate(files, 1):
            print(f"[{i}/{total}]", end=" ")
            
            if self.analyze_fast(file_path, file_id):
                success += 1
            else:
                errors += 1
        
        print(f"\n✅ Complete: {success} success, {errors} errors")
        
        # Mostrar estadísticas
        self.show_stats()
    
    def show_stats(self):
        """Mostrar estadísticas"""
        self.cursor.execute('''
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN AI_LOUDNESS IS NOT NULL THEN 1 END) as with_analysis
            FROM llm_metadata
        ''')
        
        total, analyzed = self.cursor.fetchone()
        print(f"\n📊 Stats: {analyzed}/{total} analyzed ({analyzed/total*100:.1f}%)")
    
    def close(self):
        self.conn.close()

def main():
    parser = argparse.ArgumentParser(description='Fast Essentia Analyzer')
    parser.add_argument('--batch', type=int, default=10, help='Batch size')
    parser.add_argument('--file', help='Single file to analyze')
    parser.add_argument('--file-id', type=int, help='File ID')
    
    args = parser.parse_args()
    
    analyzer = FastAnalyzer()
    
    try:
        if args.file and args.file_id:
            analyzer.analyze_fast(args.file, args.file_id)
        else:
            analyzer.process_batch(args.batch)
    finally:
        analyzer.close()

if __name__ == '__main__':
    main()