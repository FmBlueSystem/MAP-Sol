#!/usr/bin/env python3
"""
ESSENTIA 7 PARAMETERS ANALYZER
Calcula los 7 parámetros específicos usando Essentia:
1. Loudness (LUFS integrado)
2. Danceability
3. Acousticness
4. Instrumentalness
5. Liveness
6. Speechiness
7. Valence

Aprovecha BPM, Energy y Key existentes en la BD.
"""

import os
import sys
import json
import sqlite3
import argparse
import numpy as np
from datetime import datetime
from pathlib import Path

try:
    import essentia
    import essentia.standard as es
    from essentia import Pool
    print("✅ Essentia version:", essentia.__version__)
except ImportError as e:
    print(f"❌ Error: {e}")
    print("Install with: pip3 install --user --break-system-packages essentia")
    sys.exit(1)

class Essentia7Params:
    """Analizador optimizado para 7 parámetros específicos"""
    
    def __init__(self, db_path='music_analyzer.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        
        # Configuración
        self.sample_rate = 44100
        self.frame_size = 2048
        self.hop_size = 1024
        
        print(f"📊 Connected to database: {db_path}")
    
    def analyze_file(self, file_path, file_id=None):
        """Analizar archivo y calcular los 7 parámetros"""
        try:
            if not os.path.exists(file_path):
                print(f"❌ File not found: {file_path}")
                return None
            
            print(f"\n🎵 Analyzing: {os.path.basename(file_path)}")
            print(f"   File ID: {file_id}")
            
            # Cargar audio
            loader = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)
            audio = loader()
            
            if len(audio) == 0:
                print("❌ Empty audio file")
                return None
            
            # Obtener datos existentes de la BD
            existing_data = self.get_existing_data(file_id) if file_id else {}
            
            # Pool para resultados
            pool = Pool()
            
            # ====================================
            # 1. LOUDNESS (LUFS Integrado EBU R128)
            # ====================================
            print("  📊 [1/7] Computing LOUDNESS (EBU R128)...")
            try:
                # LoudnessEBUR128 requiere señal estéreo, convertir si es necesario
                loudness = es.LoudnessEBUR128(sampleRate=self.sample_rate)
                
                # Crear señal estéreo duplicando el canal mono
                stereo_audio = np.array([audio, audio]).T
                
                momentary, shortterm, integrated, loudness_range = loudness(stereo_audio)
                
                # Clamp a [-60, 0] dB con 2 decimales
                loudness_value = round(max(-60.0, min(0.0, integrated)), 2)
                pool.add('loudness', loudness_value)
                print(f"     ✓ Loudness: {loudness_value:.2f} LUFS")
            except Exception as e:
                print(f"     ⚠️ Loudness error: {e}")
                pool.add('loudness', -23.0)  # Default broadcast standard
            
            # ====================================
            # 2. DANCEABILITY
            # ====================================
            print("  💃 [2/7] Computing DANCEABILITY...")
            try:
                danceability = es.Danceability(sampleRate=self.sample_rate)
                dance_value, dfa = danceability(audio)
                
                # Asegurar rango [0, 1]
                dance_value = round(max(0.0, min(1.0, dance_value)), 3)
                pool.add('danceability', dance_value)
                print(f"     ✓ Danceability: {dance_value:.3f}")
            except Exception as e:
                print(f"     ⚠️ Danceability error: {e}")
                # Fallback usando BPM existente
                bpm = existing_data.get('AI_BPM', 120)
                dance_value = round(min(1.0, max(0.0, (bpm - 60) / 120)), 3)
                pool.add('danceability', dance_value)
            
            # ====================================
            # 3. ACOUSTICNESS
            # ====================================
            print("  🎸 [3/7] Computing ACOUSTICNESS...")
            try:
                # Método 1: Spectral Flatness (lower = more acoustic)
                spectrum = es.Spectrum()
                w = es.Windowing(type='hann')
                flatness_db = es.FlatnessDB()
                
                flatness_values = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    flatness_values.append(flatness_db(spec))
                
                avg_flatness = np.mean(flatness_values) if flatness_values else 0
                
                # Método 2: Harmonic to Noise Ratio (HNR)
                # Mayor HNR = más tonal/acústico
                pitch_yin = es.PitchYin()
                hnr_values = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size*2, hopSize=self.hop_size):
                    pitch, confidence = pitch_yin(frame)
                    if confidence > 0.5:  # Solo frames con pitch confiable
                        hnr_values.append(confidence)
                
                avg_hnr = np.mean(hnr_values) if hnr_values else 0.5
                
                # Método 3: Low frequency ratio
                centroid = es.Centroid()
                centroids = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    centroids.append(centroid(spec))
                
                avg_centroid = np.mean(centroids) if centroids else 4000
                low_freq_ratio = 1.0 - min(1.0, avg_centroid / 8000)
                
                # Combinar métodos: menos flatness + más HNR + más low freq = más acústico
                acousticness = (
                    0.4 * (1.0 - min(1.0, avg_flatness / 10)) +  # Invertir flatness
                    0.3 * avg_hnr +                               # HNR directo
                    0.3 * low_freq_ratio                          # Low freq ratio
                )
                
                acousticness = round(max(0.0, min(1.0, acousticness)), 3)
                pool.add('acousticness', acousticness)
                print(f"     ✓ Acousticness: {acousticness:.3f}")
                
            except Exception as e:
                print(f"     ⚠️ Acousticness error: {e}")
                pool.add('acousticness', 0.5)
            
            # ====================================
            # 4. INSTRUMENTALNESS
            # ====================================
            print("  🎹 [4/7] Computing INSTRUMENTALNESS...")
            try:
                # Método 1: Zero Crossing Rate (menor = más instrumental)
                zcr = es.ZeroCrossingRate()
                zcr_value = zcr(audio)
                
                # Método 2: Spectral Complexity (menor en música instrumental)
                spectral_complexity = es.SpectralComplexity()
                complexities = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    complexities.append(spectral_complexity(spec))
                
                avg_complexity = np.mean(complexities) if complexities else 5
                
                # Método 3: Pitch Salience (mayor en música instrumental)
                pitch_salience = es.PitchSalience()
                saliences = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    saliences.append(pitch_salience(spec))
                
                avg_salience = np.mean(saliences) if saliences else 0.5
                
                # Combinar: menor ZCR + menor complexity + mayor salience = más instrumental
                instrumentalness = (
                    0.4 * (1.0 - min(1.0, zcr_value * 10)) +     # Invertir ZCR
                    0.3 * (1.0 - min(1.0, avg_complexity / 20)) + # Invertir complexity
                    0.3 * min(1.0, avg_salience * 2)              # Salience directo
                )
                
                instrumentalness = round(max(0.0, min(1.0, instrumentalness)), 3)
                pool.add('instrumentalness', instrumentalness)
                print(f"     ✓ Instrumentalness: {instrumentalness:.3f}")
                
            except Exception as e:
                print(f"     ⚠️ Instrumentalness error: {e}")
                pool.add('instrumentalness', 0.7)
            
            # ====================================
            # 5. LIVENESS
            # ====================================
            print("  🎤 [5/7] Computing LIVENESS...")
            try:
                # Método 1: Dynamic Complexity
                dynamic = es.DynamicComplexity(sampleRate=self.sample_rate)
                complexity, avg_loudness = dynamic(audio)
                
                # Normalizar complexity (típicamente 0-20)
                norm_complexity = min(1.0, complexity / 15)
                
                # Método 2: Variabilidad del Spectral Flux
                spectral_flux = es.Flux()
                flux_values = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    flux_values.append(spectral_flux(spec))
                
                if flux_values:
                    flux_variance = np.var(flux_values)
                    norm_flux_var = min(1.0, flux_variance * 100)  # Normalizar
                else:
                    norm_flux_var = 0.1
                
                # Método 3: Detectar ruido de ambiente (proxy simple)
                # Alta energía en frecuencias muy altas puede indicar ruido de sala
                high_freq_energy = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    # Energía en la parte alta del espectro (última cuarta parte)
                    high_band = spec[3*len(spec)//4:]
                    high_freq_energy.append(np.sum(high_band))
                
                avg_high_freq = np.mean(high_freq_energy) if high_freq_energy else 0
                norm_high_freq = min(1.0, avg_high_freq * 1000)
                
                # Combinar: complexity + flux variance + high freq energy
                liveness = (
                    0.4 * norm_complexity +
                    0.4 * norm_flux_var +
                    0.2 * norm_high_freq
                )
                
                liveness = round(max(0.0, min(1.0, liveness)), 3)
                pool.add('liveness', liveness)
                print(f"     ✓ Liveness: {liveness:.3f}")
                
            except Exception as e:
                print(f"     ⚠️ Liveness error: {e}")
                pool.add('liveness', 0.1)
            
            # ====================================
            # 6. SPEECHINESS
            # ====================================
            print("  🗣️ [6/7] Computing SPEECHINESS...")
            try:
                # Método 1: Zero Crossing Rate (alto = más speech)
                zcr_for_speech = zcr_value if 'zcr_value' in locals() else es.ZeroCrossingRate()(audio)
                
                # Método 2: Spectral Rolloff (speech tiene rolloff más bajo)
                rolloff = es.RollOff()
                rolloffs = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    rolloffs.append(rolloff(spec))
                
                avg_rolloff = np.mean(rolloffs) if rolloffs else 0.85
                
                # Método 3: Onset Rate (speech tiene menos onsets que música)
                onset_rate = es.OnsetRate()
                onsets, onset_times = onset_rate(audio)[:2]
                
                # Normalizar onset rate (típicamente 0-5 Hz)
                norm_onset = min(1.0, onsets / 5)
                
                # Combinar: alto ZCR + bajo rolloff + bajo onset = más speech
                speechiness = (
                    0.4 * min(1.0, float(zcr_for_speech) * 10) +    # ZCR alto
                    0.3 * (1.0 - float(avg_rolloff)) +               # Rolloff bajo
                    0.3 * (1.0 - float(norm_onset))                  # Onset rate bajo
                )
                
                # Ajustar a rango típico (música raramente > 0.3)
                speechiness = round(max(0.0, min(0.3, speechiness * 0.5)), 3)
                pool.add('speechiness', speechiness)
                print(f"     ✓ Speechiness: {speechiness:.3f}")
                
            except Exception as e:
                print(f"     ⚠️ Speechiness error: {e}")
                pool.add('speechiness', 0.05)
            
            # ====================================
            # 7. VALENCE
            # ====================================
            print("  😊 [7/7] Computing VALENCE...")
            try:
                # Obtener key y mode de la BD o calcular
                key_data = existing_data.get('AI_KEY', '')
                mode = existing_data.get('AI_MODE', '')
                bpm = existing_data.get('AI_BPM', 120)
                
                # Si no hay key/mode, calcularlo
                if not key_data or not mode:
                    key_extractor = es.KeyExtractor()
                    key, scale, strength = key_extractor(audio)
                    mode = scale  # 'major' o 'minor'
                else:
                    mode = mode.lower()
                
                # Base valence por modo musical
                base_valence = 0.6 if mode == 'major' else 0.4
                
                # Factor de tempo (BPM)
                # Tempo rápido = más positivo (120-140 óptimo para felicidad)
                tempo_factor = 0
                if 60 <= bpm <= 90:
                    tempo_factor = 0.1
                elif 90 < bpm <= 120:
                    tempo_factor = 0.2
                elif 120 < bpm <= 140:
                    tempo_factor = 0.3
                elif bpm > 140:
                    tempo_factor = 0.25
                
                # Factor de brillo espectral (centroid)
                # Más brillante = más positivo
                avg_centroid = np.mean(centroids) if 'centroids' in locals() else 4000
                brightness_factor = min(0.2, (avg_centroid - 2000) / 10000)
                
                # Factor de consonancia (dissonance inversa)
                dissonance = es.Dissonance()
                spectral_peaks = es.SpectralPeaks()
                dissonances = []
                for frame in es.FrameGenerator(audio, frameSize=self.frame_size, hopSize=self.hop_size):
                    spec = spectrum(w(frame))
                    freqs, mags = spectral_peaks(spec)
                    if len(freqs) > 1:
                        dissonances.append(dissonance(freqs, mags))
                
                avg_dissonance = np.mean(dissonances) if dissonances else 0.3
                consonance_factor = 0.1 * (1.0 - min(1.0, avg_dissonance * 2))
                
                # Combinar factores
                valence = base_valence + tempo_factor + brightness_factor + consonance_factor
                
                # Ajustar con danceability (música bailable suele ser más positiva)
                dance_boost = pool['danceability'] * 0.1 if 'danceability' in pool else 0.05
                valence += dance_boost
                
                valence = round(max(0.0, min(1.0, valence)), 3)
                pool.add('valence', valence)
                print(f"     ✓ Valence: {valence:.3f}")
                
            except Exception as e:
                print(f"     ⚠️ Valence error: {e}")
                # Fallback simple basado en modo y BPM
                mode = existing_data.get('AI_MODE', 'minor').lower()
                bpm = existing_data.get('AI_BPM', 120)
                valence = 0.6 if mode == 'major' else 0.4
                valence += min(0.2, (bpm - 60) / 200)
                pool.add('valence', round(valence, 3))
            
            # ====================================
            # RESUMEN Y GUARDADO
            # ====================================
            print("\n📊 ANALYSIS COMPLETE:")
            print(f"   Loudness:        {float(pool['loudness']):.2f} LUFS")
            print(f"   Danceability:    {float(pool['danceability']):.3f}")
            print(f"   Acousticness:    {float(pool['acousticness']):.3f}")
            print(f"   Instrumentalness:{float(pool['instrumentalness']):.3f}")
            print(f"   Liveness:        {float(pool['liveness']):.3f}")
            print(f"   Speechiness:     {float(pool['speechiness']):.3f}")
            print(f"   Valence:         {float(pool['valence']):.3f}")
            
            # Guardar en BD si tenemos file_id
            if file_id:
                self.save_to_database(file_id, pool)
            
            return pool
            
        except Exception as e:
            print(f"❌ Fatal error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_existing_data(self, file_id):
        """Obtener datos existentes de la BD"""
        try:
            self.cursor.execute('''
                SELECT AI_BPM, AI_ENERGY, AI_KEY, AI_MODE
                FROM llm_metadata
                WHERE file_id = ?
            ''', (file_id,))
            
            row = self.cursor.fetchone()
            if row:
                return {
                    'AI_BPM': row[0] or 120,
                    'AI_ENERGY': row[1] or 0.5,
                    'AI_KEY': row[2] or '',
                    'AI_MODE': row[3] or ''
                }
        except:
            pass
        
        return {}
    
    def save_to_database(self, file_id, pool):
        """Guardar los 7 parámetros en la BD"""
        try:
            # Actualizar llm_metadata con los 7 parámetros
            self.cursor.execute('''
                UPDATE llm_metadata
                SET 
                    AI_LOUDNESS = ?,
                    AI_DANCEABILITY = ?,
                    AI_ACOUSTICNESS = ?,
                    AI_INSTRUMENTALNESS = ?,
                    AI_LIVENESS = ?,
                    AI_SPEECHINESS = ?,
                    AI_VALENCE = ?,
                    AI_ANALYZED = 1,
                    AI_ANALYZED_DATE = datetime('now')
                WHERE file_id = ?
            ''', (
                float(pool['loudness']),
                float(pool['danceability']),
                float(pool['acousticness']),
                float(pool['instrumentalness']),
                float(pool['liveness']),
                float(pool['speechiness']),
                float(pool['valence']),
                file_id
            ))
            
            # Si no existe el registro, crearlo
            if self.cursor.rowcount == 0:
                self.cursor.execute('''
                    INSERT INTO llm_metadata (
                        file_id, AI_LOUDNESS, AI_DANCEABILITY, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS, AI_VALENCE,
                        AI_ANALYZED, AI_ANALYZED_DATE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
                ''', (
                    file_id,
                    float(pool['loudness']),
                    float(pool['danceability']),
                    float(pool['acousticness']),
                    float(pool['instrumentalness']),
                    float(pool['liveness']),
                    float(pool['speechiness']),
                    float(pool['valence'])
                ))
            
            self.conn.commit()
            print(f"💾 Saved to database (file_id: {file_id})")
            
        except Exception as e:
            print(f"❌ Database error: {e}")
            self.conn.rollback()
    
    def process_batch(self, limit=10, offset=0):
        """Procesar múltiples archivos"""
        print(f"\n🔄 Processing batch (limit: {limit}, offset: {offset})")
        
        # Buscar archivos sin análisis de los 7 parámetros
        self.cursor.execute('''
            SELECT 
                af.id, 
                af.file_path,
                lm.AI_LOUDNESS
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
            WHERE af.file_path IS NOT NULL
            AND (
                lm.AI_LOUDNESS IS NULL 
                OR lm.AI_DANCEABILITY IS NULL
                OR lm.AI_ACOUSTICNESS IS NULL
                OR lm.AI_INSTRUMENTALNESS IS NULL
                OR lm.AI_LIVENESS IS NULL
                OR lm.AI_SPEECHINESS IS NULL
                OR lm.AI_VALENCE IS NULL
            )
            ORDER BY af.id
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        files = self.cursor.fetchall()
        total = len(files)
        
        if total == 0:
            print("✅ No pending files found")
            return 0
        
        print(f"📦 Found {total} files to process\n")
        
        processed = 0
        for i, (file_id, file_path, has_loudness) in enumerate(files, 1):
            print(f"\n[{i}/{total}] File ID: {file_id}")
            
            if self.analyze_file(file_path, file_id):
                processed += 1
        
        print(f"\n✅ Processed {processed}/{total} files successfully")
        return processed
    
    def get_statistics(self):
        """Mostrar estadísticas"""
        self.cursor.execute('''
            SELECT 
                COUNT(DISTINCT af.id) as total_files,
                COUNT(DISTINCT CASE WHEN lm.AI_LOUDNESS IS NOT NULL THEN lm.file_id END) as with_loudness,
                COUNT(DISTINCT CASE WHEN lm.AI_DANCEABILITY IS NOT NULL THEN lm.file_id END) as with_danceability,
                COUNT(DISTINCT CASE WHEN lm.AI_ACOUSTICNESS IS NOT NULL THEN lm.file_id END) as with_acousticness,
                COUNT(DISTINCT CASE WHEN lm.AI_INSTRUMENTALNESS IS NOT NULL THEN lm.file_id END) as with_instrumentalness,
                COUNT(DISTINCT CASE WHEN lm.AI_LIVENESS IS NOT NULL THEN lm.file_id END) as with_liveness,
                COUNT(DISTINCT CASE WHEN lm.AI_SPEECHINESS IS NOT NULL THEN lm.file_id END) as with_speechiness,
                COUNT(DISTINCT CASE WHEN lm.AI_VALENCE IS NOT NULL THEN lm.file_id END) as with_valence,
                AVG(lm.AI_LOUDNESS) as avg_loudness,
                AVG(lm.AI_DANCEABILITY) as avg_danceability,
                AVG(lm.AI_VALENCE) as avg_valence
            FROM audio_files af
            LEFT JOIN llm_metadata lm ON af.id = lm.file_id
        ''')
        
        stats = self.cursor.fetchone()
        
        print(f"""
╔══════════════════════════════════════════╗
║     ESSENTIA 7-PARAMS STATISTICS        ║
╚══════════════════════════════════════════╝

📁 Total files:          {stats[0]:,}
✅ Complete analysis:    {stats[7]:,} ({stats[7]/stats[0]*100:.1f}%)

Parameter Coverage:
├─ Loudness:        {stats[1]:,} ({stats[1]/stats[0]*100:.1f}%)
├─ Danceability:    {stats[2]:,} ({stats[2]/stats[0]*100:.1f}%)
├─ Acousticness:    {stats[3]:,} ({stats[3]/stats[0]*100:.1f}%)
├─ Instrumentalness:{stats[4]:,} ({stats[4]/stats[0]*100:.1f}%)
├─ Liveness:        {stats[5]:,} ({stats[5]/stats[0]*100:.1f}%)
├─ Speechiness:     {stats[6]:,} ({stats[6]/stats[0]*100:.1f}%)
└─ Valence:         {stats[7]:,} ({stats[7]/stats[0]*100:.1f}%)

Averages:
├─ Avg Loudness:    {stats[8]:.2f} LUFS
├─ Avg Danceability:{stats[9]:.3f}
└─ Avg Valence:     {stats[10]:.3f}
        """)
    
    def close(self):
        """Cerrar conexión"""
        self.conn.close()

def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description='Essentia 7 Parameters Analyzer')
    parser.add_argument('--db', default='music_analyzer.db', help='Database path')
    parser.add_argument('--file', help='Analyze single file')
    parser.add_argument('--file-id', type=int, help='File ID for single file')
    parser.add_argument('--batch', type=int, default=10, help='Batch size')
    parser.add_argument('--offset', type=int, default=0, help='Offset for batch')
    parser.add_argument('--stats', action='store_true', help='Show statistics')
    
    args = parser.parse_args()
    
    analyzer = Essentia7Params(args.db)
    
    try:
        if args.stats:
            analyzer.get_statistics()
        elif args.file:
            analyzer.analyze_file(args.file, args.file_id)
        else:
            analyzer.process_batch(args.batch, args.offset)
    finally:
        analyzer.close()

if __name__ == '__main__':
    main()