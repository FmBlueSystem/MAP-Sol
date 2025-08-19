#!/usr/bin/env python3
"""
ESSENTIA AUDIO ANALYZER - Python Implementation
Análisis completo de características de audio usando Essentia
"""

import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime
from pathlib import Path
import numpy as np

# Importar Essentia
try:
    import essentia
    import essentia.standard as es
    from essentia import Pool
    print("✅ Essentia imported successfully")
except ImportError as e:
    print(f"❌ Error importing Essentia: {e}")
    sys.exit(1)

class EssentiaAnalyzer:
    """Analizador de audio usando Essentia"""
    
    def __init__(self, db_path='music_analyzer.db'):
        """Inicializar analizador y conexión a BD"""
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        
        # Crear tabla si no existe
        self.create_tables()
        
        # Configuración de algoritmos
        self.sample_rate = 44100
        self.frame_size = 2048
        self.hop_size = 1024
        
    def create_tables(self):
        """Crear tabla para almacenar features de Essentia"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS audio_features_essentia (
                file_id INTEGER PRIMARY KEY,
                
                -- Loudness features
                loudness_integrated REAL,
                loudness_range REAL,
                dynamic_complexity REAL,
                
                -- Rhythm features
                bpm REAL,
                bpm_confidence REAL,
                beats_count INTEGER,
                onset_rate REAL,
                danceability REAL,
                
                -- Tonal features
                key TEXT,
                scale TEXT,
                key_strength REAL,
                tuning_frequency REAL,
                
                -- Spectral features
                spectral_centroid REAL,
                spectral_complexity REAL,
                spectral_energy REAL,
                spectral_rolloff REAL,
                dissonance REAL,
                pitch_salience REAL,
                
                -- Timbre features (MFCC)
                mfcc_mean TEXT,
                zero_crossing_rate REAL,
                
                -- High-level features
                acousticness REAL,
                instrumentalness REAL,
                liveness REAL,
                speechiness REAL,
                valence REAL,
                energy REAL,
                
                -- Metadata
                duration REAL,
                analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                essentia_version TEXT,
                
                FOREIGN KEY(file_id) REFERENCES audio_files(id)
            )
        ''')
        self.conn.commit()
        print("✅ Database tables ready")
    
    def analyze_file(self, file_path, file_id=None):
        """Analizar un archivo de audio"""
        try:
            print(f"\n🎵 Analyzing: {file_path}")
            
            # Cargar audio
            loader = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)
            audio = loader()
            
            # Pool para almacenar resultados
            pool = Pool()
            
            # 1. LOUDNESS (EBU R128)
            print("  📊 Computing loudness...")
            loudness = es.LoudnessEBUR128(sampleRate=self.sample_rate)
            _, _, integrated, loudness_range = loudness(audio)
            pool.add('loudness.integrated', integrated)
            pool.add('loudness.range', loudness_range)
            
            # 2. DYNAMIC COMPLEXITY
            dynamic = es.DynamicComplexity(sampleRate=self.sample_rate)
            complexity, avg_loudness = dynamic(audio)
            pool.add('dynamic.complexity', complexity)
            pool.add('dynamic.avgLoudness', avg_loudness)
            
            # 3. RHYTHM ANALYSIS
            print("  🥁 Extracting rhythm...")
            rhythm_extractor = es.RhythmExtractor2013()
            bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
            pool.add('rhythm.bpm', bpm)
            pool.add('rhythm.beats_confidence', beats_confidence)
            pool.add('rhythm.beats_count', len(beats))
            
            # Onset detection
            onset_rate = es.OnsetRate()
            onsets = onset_rate(audio)[0]
            pool.add('rhythm.onset_rate', onsets)
            
            # Danceability
            danceability = es.Danceability(sampleRate=self.sample_rate)
            dance_value, dfa = danceability(audio)
            pool.add('highlevel.danceability', dance_value)
            
            # 4. KEY DETECTION
            print("  🎹 Detecting key...")
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            pool.add('tonal.key', key)
            pool.add('tonal.scale', scale)
            pool.add('tonal.key_strength', strength)
            
            # Tuning frequency
            tuning = es.TuningFrequency()
            tuning_freq, _ = tuning(audio)
            pool.add('tonal.tuning_frequency', tuning_freq)
            
            # 5. SPECTRAL FEATURES
            print("  🌈 Computing spectral features...")
            
            # Spectral centroid
            centroid = es.Centroid()
            spectrum = es.Spectrum()
            w = es.Windowing(type='hann')
            
            centroids = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                centroids.append(centroid(spec))
            pool.add('spectral.centroid', np.mean(centroids))
            
            # Spectral complexity
            spectral_complexity = es.SpectralComplexity()
            complexities = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                complexities.append(spectral_complexity(spec))
            pool.add('spectral.complexity', np.mean(complexities))
            
            # Spectral energy
            energy = es.Energy()
            energies = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                energies.append(energy(frame))
            pool.add('spectral.energy', np.mean(energies))
            
            # Spectral rolloff
            rolloff = es.RollOff()
            rolloffs = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                rolloffs.append(rolloff(spec))
            pool.add('spectral.rolloff', np.mean(rolloffs))
            
            # Dissonance
            dissonance = es.Dissonance()
            spectral_peaks = es.SpectralPeaks()
            dissonances = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                freqs, mags = spectral_peaks(spec)
                if len(freqs) > 1:
                    dissonances.append(dissonance(freqs, mags))
            pool.add('spectral.dissonance', np.mean(dissonances) if dissonances else 0)
            
            # Pitch salience
            pitch_salience = es.PitchSalience()
            saliences = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                saliences.append(pitch_salience(spec))
            pool.add('spectral.pitch_salience', np.mean(saliences))
            
            # 6. MFCC (Timbre)
            print("  🎨 Extracting timbre features...")
            mfcc = es.MFCC()
            mfccs = []
            for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                spec = spectrum(w(frame))
                _, mfcc_coeffs = mfcc(spec)
                mfccs.append(mfcc_coeffs)
            mfcc_mean = np.mean(mfccs, axis=0).tolist() if mfccs else []
            pool.add('timbre.mfcc_mean', json.dumps(mfcc_mean[:13]))  # First 13 coefficients
            
            # Zero crossing rate
            zcr = es.ZeroCrossingRate()
            zcr_value = zcr(audio)
            pool.add('timbre.zcr', zcr_value)
            
            # 7. HIGH-LEVEL FEATURES
            print("  🎯 Computing high-level features...")
            
            # Duration
            duration = len(audio) / self.sample_rate
            pool.add('metadata.duration', duration)
            
            # Calcular features derivados
            acousticness = self.estimate_acousticness(pool)
            instrumentalness = self.estimate_instrumentalness(pool)
            liveness = self.estimate_liveness(pool)
            speechiness = self.estimate_speechiness(pool)
            valence = self.estimate_valence(pool)
            energy_score = self.estimate_energy(pool)
            
            pool.add('highlevel.acousticness', acousticness)
            pool.add('highlevel.instrumentalness', instrumentalness)
            pool.add('highlevel.liveness', liveness)
            pool.add('highlevel.speechiness', speechiness)
            pool.add('highlevel.valence', valence)
            pool.add('highlevel.energy', energy_score)
            
            # Guardar en base de datos
            if file_id:
                self.save_to_database(file_id, pool)
            
            # Imprimir resumen
            print(f"""
  ✅ Analysis complete:
     BPM: {bpm:.1f} (confidence: {beats_confidence:.2f})
     Key: {key} {scale} (strength: {strength:.2f})
     Danceability: {dance_value:.2f}
     Energy: {energy_score:.2f}
     Valence: {valence:.2f}
     Loudness: {integrated:.1f} LUFS
            """)
            
            return pool
            
        except Exception as e:
            print(f"  ❌ Error analyzing file: {e}")
            return None
    
    def estimate_acousticness(self, pool):
        """Estimar acousticness basado en features espectrales"""
        centroid = pool['spectral.centroid'] if 'spectral.centroid' in pool else 4000
        # Más bajo centroid = más acústico
        return max(0, min(1, 1.0 - (centroid / 8000)))
    
    def estimate_instrumentalness(self, pool):
        """Estimar instrumentalness basado en ZCR y pitch"""
        zcr = pool['timbre.zcr'] if 'timbre.zcr' in pool else 0.1
        # Menor ZCR = más instrumental
        return max(0, min(1, 1.0 - (zcr * 5)))
    
    def estimate_liveness(self, pool):
        """Estimar liveness basado en complejidad dinámica"""
        complexity = pool['dynamic.complexity'] if 'dynamic.complexity' in pool else 5
        # Mayor complejidad = más "en vivo"
        return max(0, min(1, complexity / 20))
    
    def estimate_speechiness(self, pool):
        """Estimar speechiness basado en ZCR y onset rate"""
        zcr = pool['timbre.zcr'] if 'timbre.zcr' in pool else 0.1
        onset = pool['rhythm.onset_rate'] if 'rhythm.onset_rate' in pool else 1
        # Alto ZCR y alto onset = más speech
        return max(0, min(1, (zcr * 2 + onset / 10) / 2))
    
    def estimate_valence(self, pool):
        """Estimar valence (positividad) basado en modo y tempo"""
        scale = pool['tonal.scale'] if 'tonal.scale' in pool else 'minor'
        bpm = pool['rhythm.bpm'] if 'rhythm.bpm' in pool else 120
        dance = pool['highlevel.danceability'] if 'highlevel.danceability' in pool else 0.5
        
        # Major = más positivo, tempo alto = más positivo
        base_valence = 0.6 if scale == 'major' else 0.4
        tempo_factor = min(0.3, (bpm - 60) / 200)
        
        return max(0, min(1, base_valence + tempo_factor + dance * 0.2))
    
    def estimate_energy(self, pool):
        """Estimar energy basado en loudness, tempo y spectral energy"""
        loudness = pool['dynamic.avgLoudness'] if 'dynamic.avgLoudness' in pool else 0.5
        bpm = pool['rhythm.bpm'] if 'rhythm.bpm' in pool else 120
        spectral = pool['spectral.energy'] if 'spectral.energy' in pool else 0.5
        dance = pool['highlevel.danceability'] if 'highlevel.danceability' in pool else 0.5
        
        # Normalizar y combinar
        loudness_norm = min(1, loudness + 60) / 60  # Assuming -60 to 0 dB range
        tempo_norm = min(1, bpm / 180)
        
        return max(0, min(1, (loudness_norm + tempo_norm + spectral + dance) / 4))
    
    def save_to_database(self, file_id, pool):
        """Guardar resultados en base de datos"""
        try:
            # Preparar valores
            values = (
                file_id,
                pool.get('loudness.integrated', 0),
                pool.get('loudness.range', 0),
                pool.get('dynamic.complexity', 0),
                pool.get('rhythm.bpm', 0),
                pool.get('rhythm.beats_confidence', 0),
                pool.get('rhythm.beats_count', 0),
                pool.get('rhythm.onset_rate', 0),
                pool.get('highlevel.danceability', 0),
                pool.get('tonal.key', ''),
                pool.get('tonal.scale', ''),
                pool.get('tonal.key_strength', 0),
                pool.get('tonal.tuning_frequency', 440),
                pool.get('spectral.centroid', 0),
                pool.get('spectral.complexity', 0),
                pool.get('spectral.energy', 0),
                pool.get('spectral.rolloff', 0),
                pool.get('spectral.dissonance', 0),
                pool.get('spectral.pitch_salience', 0),
                pool.get('timbre.mfcc_mean', '[]'),
                pool.get('timbre.zcr', 0),
                pool.get('highlevel.acousticness', 0),
                pool.get('highlevel.instrumentalness', 0),
                pool.get('highlevel.liveness', 0),
                pool.get('highlevel.speechiness', 0),
                pool.get('highlevel.valence', 0),
                pool.get('highlevel.energy', 0),
                pool.get('metadata.duration', 0),
                essentia.__version__
            )
            
            # Insertar o actualizar
            self.cursor.execute('''
                INSERT OR REPLACE INTO audio_features_essentia (
                    file_id, loudness_integrated, loudness_range, dynamic_complexity,
                    bpm, bpm_confidence, beats_count, onset_rate, danceability,
                    key, scale, key_strength, tuning_frequency,
                    spectral_centroid, spectral_complexity, spectral_energy,
                    spectral_rolloff, dissonance, pitch_salience,
                    mfcc_mean, zero_crossing_rate,
                    acousticness, instrumentalness, liveness, speechiness,
                    valence, energy, duration, essentia_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', values)
            
            self.conn.commit()
            print("  💾 Saved to database")
            
        except Exception as e:
            print(f"  ❌ Error saving to database: {e}")
    
    def process_pending_files(self, limit=100):
        """Procesar archivos pendientes de análisis"""
        print("\n🔍 Finding pending files...")
        
        # Buscar archivos sin análisis
        self.cursor.execute('''
            SELECT af.id, af.file_path 
            FROM audio_files af
            LEFT JOIN audio_features_essentia afe ON af.id = afe.file_id
            WHERE afe.file_id IS NULL
            AND af.file_path IS NOT NULL
            ORDER BY af.id
            LIMIT ?
        ''', (limit,))
        
        pending = self.cursor.fetchall()
        total = len(pending)
        
        if total == 0:
            print("✅ No pending files to analyze")
            return
        
        print(f"📦 Found {total} files to analyze\n")
        
        # Procesar cada archivo
        for i, (file_id, file_path) in enumerate(pending, 1):
            print(f"[{i}/{total}] Processing file ID {file_id}")
            
            # Verificar que el archivo existe
            if not os.path.exists(file_path):
                print(f"  ⚠️ File not found: {file_path}")
                continue
            
            # Analizar
            self.analyze_file(file_path, file_id)
        
        print(f"\n✅ Processed {total} files")
    
    def get_statistics(self):
        """Obtener estadísticas del análisis"""
        self.cursor.execute('''
            SELECT 
                COUNT(*) as total_files,
                COUNT(afe.file_id) as analyzed_files,
                AVG(afe.bpm) as avg_bpm,
                AVG(afe.danceability) as avg_danceability,
                AVG(afe.energy) as avg_energy,
                AVG(afe.valence) as avg_valence
            FROM audio_files af
            LEFT JOIN audio_features_essentia afe ON af.id = afe.file_id
        ''')
        
        stats = self.cursor.fetchone()
        
        print(f"""
📊 ESSENTIA ANALYSIS STATISTICS
================================
Total files:        {stats[0]}
Analyzed files:     {stats[1]} ({stats[1]/stats[0]*100:.1f}%)
Average BPM:        {stats[2]:.1f}
Average Danceability: {stats[3]:.2f}
Average Energy:     {stats[4]:.2f}
Average Valence:    {stats[5]:.2f}
        """)
    
    def close(self):
        """Cerrar conexión a base de datos"""
        self.conn.close()

def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description='Essentia Audio Analyzer')
    parser.add_argument('--db', default='music_analyzer.db', help='Database path')
    parser.add_argument('--file', help='Analyze single file')
    parser.add_argument('--file-id', type=int, help='File ID for single file')
    parser.add_argument('--limit', type=int, default=100, help='Limit for batch processing')
    parser.add_argument('--stats', action='store_true', help='Show statistics')
    
    args = parser.parse_args()
    
    # Crear analizador
    analyzer = EssentiaAnalyzer(args.db)
    
    try:
        if args.stats:
            # Mostrar estadísticas
            analyzer.get_statistics()
        elif args.file:
            # Analizar archivo único
            analyzer.analyze_file(args.file, args.file_id)
        else:
            # Procesar archivos pendientes
            analyzer.process_pending_files(args.limit)
    
    finally:
        analyzer.close()

if __name__ == '__main__':
    main()