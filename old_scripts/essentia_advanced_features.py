#!/usr/bin/env python3
"""
Extracción avanzada de características con Essentia
Music Analyzer Pro - Características profesionales para análisis musical
"""

import os
import sys
import json
import sqlite3
import numpy as np
from pathlib import Path
import essentia
import essentia.standard as es
from essentia import Pool

class AdvancedAudioAnalyzer:
    """Analizador avanzado de audio usando Essentia"""
    
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        self.results = {}
        
    def load_audio(self, file_path):
        """Carga audio en mono y estéreo"""
        try:
            # Cargar en mono para la mayoría de análisis
            self.audio_mono = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)()
            
            # Cargar en estéreo para LUFS
            loader_stereo = es.AudioLoader(filename=file_path)
            self.audio_stereo, self.sr, _, _, _, _ = loader_stereo()
            
            # Si es mono, duplicar canal para tener "estéreo"
            if self.audio_stereo.shape[1] == 1:
                self.audio_stereo = np.column_stack((self.audio_stereo[:, 0], self.audio_stereo[:, 0]))
            
            self.duration = len(self.audio_mono) / self.sample_rate
            return True
            
        except Exception as e:
            print(f"❌ Error cargando audio: {e}")
            return False
    
    def calculate_lufs(self):
        """
        1. LUFS integrado (LoudnessEBUR128.integrated)
        Retorna loudness en LUFS, clamped a [-60, 0]
        """
        try:
            print("  📊 Calculando LUFS integrado...")
            
            # LoudnessEBUR128 necesita audio estéreo
            loudness = es.LoudnessEBUR128(startAtZero=True, hopSize=0.1)
            
            # Procesar el audio estéreo
            momentary, shortterm, integrated, loudness_range = loudness(self.audio_stereo)
            
            # Clamp entre -60 y 0
            lufs_integrated = max(-60, min(0, integrated))
            
            self.results['loudness'] = round(lufs_integrated, 2)
            print(f"    ✓ LUFS integrado: {lufs_integrated:.2f} dB")
            
            return lufs_integrated
            
        except Exception as e:
            print(f"    ✗ Error calculando LUFS: {e}")
            # Fallback: usar Loudness simple
            try:
                loudness_simple = es.Loudness()(self.audio_mono[:self.sample_rate*10])  # 10 segundos
                loudness_db = 20 * np.log10(max(loudness_simple, 1e-10))
                self.results['loudness'] = round(max(-60, min(0, loudness_db)), 2)
                print(f"    ✓ Loudness (fallback): {self.results['loudness']:.2f} dB")
            except:
                self.results['loudness'] = -30.0  # Default value
            
            return self.results['loudness']
    
    def calculate_danceability(self):
        """
        2. Danceability (rhythm.danceability)
        Retorna valor entre 0-1
        """
        try:
            print("  💃 Calculando Danceability...")
            
            # Método directo de Essentia
            danceability = es.Danceability()(self.audio_mono)
            
            # Danceability puede retornar tuple, extraer primer valor
            if isinstance(danceability, tuple):
                danceability = danceability[0]
            
            # Normalizar a 0-1 si es necesario
            danceability = min(1.0, max(0.0, float(danceability)))
            
            self.results['danceability'] = round(danceability, 3)
            print(f"    ✓ Danceability: {self.results['danceability']:.3f}")
            
            return self.results['danceability']
            
        except Exception as e:
            print(f"    ✗ Error con Danceability nativo: {e}")
            # Fallback: calcular basado en BPM y energía
            try:
                rhythm = es.RhythmExtractor2013(method="multifeature")
                bpm, _, confidence, _, _ = rhythm(self.audio_mono)
                
                # BPM ideal para bailar: 120-130
                bpm_score = 1.0 - abs(bpm - 125) / 125
                bpm_score = max(0, min(1, bpm_score))
                
                # Energía
                energy = es.Energy()(self.audio_mono)
                energy_norm = min(1, energy / 1000000)  # Normalizar
                
                # Combinar
                danceability = 0.7 * bpm_score + 0.3 * energy_norm
                
                self.results['danceability'] = round(float(danceability), 3)
                print(f"    ✓ Danceability (calculado): {self.results['danceability']:.3f}")
                
            except:
                self.results['danceability'] = 0.5  # Default
                
            return self.results['danceability']
    
    def calculate_acousticness(self):
        """
        3. Acousticness
        Combina spectral_flatness, HNR y low_freq_ratio
        """
        try:
            print("  🎸 Calculando Acousticness...")
            
            # Calcular en frames
            frame_size = 2048
            hop_size = 1024
            
            flatness_values = []
            hnr_values = []
            low_freq_ratios = []
            
            for i in range(0, len(self.audio_mono) - frame_size, hop_size):
                frame = self.audio_mono[i:i+frame_size]
                
                # Spectral Flatness (bajo = más tonal/acústico)
                spectrum = es.Spectrum()(frame)
                flatness = es.Flatness()(spectrum)
                flatness_values.append(flatness)
                
                # HNR (Harmonic to Noise Ratio) - proxy
                # Usar autocorrelación para detectar armonicidad
                autocorr = np.correlate(frame, frame, mode='full')
                autocorr = autocorr[len(autocorr)//2:]
                if len(autocorr) > 1:
                    hnr_proxy = autocorr[1] / (autocorr[0] + 1e-10)
                    hnr_values.append(abs(hnr_proxy))
                
                # Low frequency ratio
                fft = np.fft.rfft(frame)
                freqs = np.fft.rfftfreq(len(frame), 1/self.sample_rate)
                low_freq_idx = np.where(freqs < 2000)[0]  # Bajo 2kHz
                if len(low_freq_idx) > 0:
                    low_energy = np.sum(np.abs(fft[low_freq_idx])**2)
                    total_energy = np.sum(np.abs(fft)**2) + 1e-10
                    low_freq_ratios.append(low_energy / total_energy)
            
            # Combinar métricas
            avg_flatness = np.mean(flatness_values) if flatness_values else 0.5
            avg_hnr = np.mean(hnr_values) if hnr_values else 0.5
            avg_low_freq = np.mean(low_freq_ratios) if low_freq_ratios else 0.5
            
            # Acousticness: inverso de flatness + HNR + low freq emphasis
            acousticness = (1 - avg_flatness) * 0.4 + avg_hnr * 0.3 + avg_low_freq * 0.3
            acousticness = max(0, min(1, acousticness))
            
            self.results['acousticness'] = round(float(acousticness), 3)
            print(f"    ✓ Acousticness: {self.results['acousticness']:.3f}")
            
            return self.results['acousticness']
            
        except Exception as e:
            print(f"    ✗ Error calculando Acousticness: {e}")
            self.results['acousticness'] = 0.5
            return self.results['acousticness']
    
    def calculate_instrumentalness(self):
        """
        4. Instrumentalness
        Detecta presencia de voz vs instrumental
        """
        try:
            print("  🎹 Calculando Instrumentalness...")
            
            # Método 1: Usar zero crossing rate y spectral rolloff
            # La voz humana tiene características espectrales específicas
            
            zcr_values = []
            rolloff_values = []
            centroid_values = []
            
            frame_size = 2048
            hop_size = 1024
            
            for i in range(0, len(self.audio_mono) - frame_size, hop_size):
                frame = self.audio_mono[i:i+frame_size]
                
                # Zero Crossing Rate (voz tiene ZCR medio)
                zcr = es.ZeroCrossingRate()(frame)
                zcr_values.append(zcr)
                
                # Spectral features
                spectrum = es.Spectrum()(frame)
                
                # Rolloff (frecuencia bajo la cual está el 85% de energía)
                rolloff = es.RollOff()(spectrum)
                rolloff_values.append(rolloff)
                
                # Centroid
                centroid = es.Centroid()(spectrum)
                centroid_values.append(centroid)
            
            # Análisis: la voz tiene rolloff y centroid en rango medio
            avg_rolloff = np.mean(rolloff_values) if rolloff_values else 0.5
            avg_centroid = np.mean(centroid_values) if centroid_values else 0.5
            avg_zcr = np.mean(zcr_values) if zcr_values else 0.1
            
            # Voz humana típicamente: 300-3400 Hz
            # Si el contenido está muy fuera de este rango, es más instrumental
            voice_range_score = 1.0
            if 0.3 < avg_rolloff < 0.7:  # Normalizado
                voice_range_score = 0.3  # Probablemente voz
            
            # ZCR muy alto o muy bajo indica instrumental
            zcr_instrumental = 1.0 if (avg_zcr < 0.05 or avg_zcr > 0.3) else 0.5
            
            # Combinar
            instrumentalness = (voice_range_score * 0.6 + zcr_instrumental * 0.4)
            instrumentalness = max(0, min(1, instrumentalness))
            
            self.results['instrumentalness'] = round(float(instrumentalness), 3)
            print(f"    ✓ Instrumentalness: {self.results['instrumentalness']:.3f}")
            
            return self.results['instrumentalness']
            
        except Exception as e:
            print(f"    ✗ Error calculando Instrumentalness: {e}")
            self.results['instrumentalness'] = 0.7  # Default: asume más instrumental
            return self.results['instrumentalness']
    
    def calculate_liveness(self):
        """
        5. Liveness (proxy robusto)
        Combina dynamic_complexity y variabilidad de spectral_flux
        """
        try:
            print("  🎤 Calculando Liveness...")
            
            # Dynamic Complexity
            dynamic_complexity = es.DynamicComplexity()(self.audio_mono)
            if isinstance(dynamic_complexity, tuple):
                dynamic_complexity = dynamic_complexity[0]
            
            # Spectral Flux variability
            flux_values = []
            frame_size = 2048
            hop_size = 512
            prev_spectrum = None
            
            for i in range(0, len(self.audio_mono) - frame_size, hop_size):
                frame = self.audio_mono[i:i+frame_size]
                spectrum = es.Spectrum()(frame)
                
                if prev_spectrum is not None:
                    # Flux: diferencia entre espectros consecutivos
                    flux = np.sum((spectrum - prev_spectrum)**2)
                    flux_values.append(flux)
                
                prev_spectrum = spectrum
            
            # Variabilidad del flux (más variable = más "live")
            flux_variance = np.var(flux_values) if flux_values else 0
            flux_variance_norm = min(1, flux_variance / 1000)  # Normalizar
            
            # Normalizar dynamic complexity
            complexity_norm = min(1, dynamic_complexity * 2)  # Escalar a 0-1
            
            # Combinar: liveness = 0.5·complexity + 0.5·flux_variance
            liveness = 0.5 * complexity_norm + 0.5 * flux_variance_norm
            liveness = max(0, min(1, liveness))
            
            self.results['liveness'] = round(float(liveness), 3)
            print(f"    ✓ Liveness: {self.results['liveness']:.3f}")
            
            return self.results['liveness']
            
        except Exception as e:
            print(f"    ✗ Error calculando Liveness: {e}")
            self.results['liveness'] = 0.1  # Default: asume grabación de estudio
            return self.results['liveness']
    
    def calculate_speechiness(self):
        """
        6. Speechiness
        Detecta presencia de habla vs música
        """
        try:
            print("  🗣️ Calculando Speechiness...")
            
            # Método: Analizar patrones temporales y espectrales
            # El habla tiene pausas y patrones rítmicos diferentes a la música
            
            # 1. Calcular envolvente de energía
            frame_size = int(0.025 * self.sample_rate)  # 25ms frames
            hop_size = int(0.010 * self.sample_rate)   # 10ms hop
            
            energy_envelope = []
            for i in range(0, len(self.audio_mono) - frame_size, hop_size):
                frame = self.audio_mono[i:i+frame_size]
                energy = es.Energy()(frame)
                energy_envelope.append(energy)
            
            if len(energy_envelope) > 0:
                # Normalizar energía
                energy_envelope = np.array(energy_envelope)
                energy_envelope = energy_envelope / (np.max(energy_envelope) + 1e-10)
                
                # 2. Detectar pausas (silencio)
                silence_threshold = 0.05
                is_silence = energy_envelope < silence_threshold
                
                # 3. Calcular ratio de silencio (habla tiene más pausas)
                silence_ratio = np.sum(is_silence) / len(is_silence)
                
                # 4. Calcular variabilidad de energía (habla es más variable)
                energy_variance = np.var(energy_envelope)
                
                # 5. Analizar periodicidad (música es más periódica)
                autocorr = np.correlate(energy_envelope, energy_envelope, mode='full')
                autocorr = autocorr[len(autocorr)//2:]
                autocorr = autocorr / (autocorr[0] + 1e-10)
                
                # Buscar picos periódicos (música)
                peaks = []
                for i in range(10, min(100, len(autocorr)-1)):
                    if autocorr[i] > autocorr[i-1] and autocorr[i] > autocorr[i+1]:
                        peaks.append(autocorr[i])
                
                periodicity_score = np.mean(peaks) if peaks else 0
                
                # Combinar métricas
                # Alto silence_ratio + alta variance + baja periodicidad = habla
                speechiness = (
                    silence_ratio * 0.3 +          # Pausas
                    energy_variance * 0.3 +        # Variabilidad
                    (1 - periodicity_score) * 0.4  # No periódico
                )
                
                speechiness = max(0, min(1, speechiness))
            else:
                speechiness = 0.0
            
            self.results['speechiness'] = round(float(speechiness), 3)
            print(f"    ✓ Speechiness: {self.results['speechiness']:.3f}")
            
            return self.results['speechiness']
            
        except Exception as e:
            print(f"    ✗ Error calculando Speechiness: {e}")
            self.results['speechiness'] = 0.0  # Default: asume música
            return self.results['speechiness']
    
    def calculate_valence(self):
        """
        7. Valence
        Estima positividad emocional usando tonalidad, tempo y brillo espectral
        """
        try:
            print("  😊 Calculando Valence...")
            
            # 1. Tonalidad (mayor = más positivo)
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(self.audio_mono)
            
            # Score basado en escala
            scale_score = 0.7 if scale == "major" else 0.3
            
            # 2. Tempo (más rápido generalmente más alegre, pero no siempre)
            rhythm = es.RhythmExtractor2013(method="multifeature")
            bpm, _, _, _, _ = rhythm(self.audio_mono)
            
            # BPM óptimo para felicidad: 120-140
            if 120 <= bpm <= 140:
                tempo_score = 1.0
            elif 100 <= bpm < 120 or 140 < bpm <= 160:
                tempo_score = 0.7
            elif bpm < 80 or bpm > 180:
                tempo_score = 0.3
            else:
                tempo_score = 0.5
            
            # 3. Brillo espectral (centroide)
            centroid_values = []
            frame_size = 2048
            hop_size = 1024
            
            for i in range(0, min(len(self.audio_mono) - frame_size, self.sample_rate * 30), hop_size):
                frame = self.audio_mono[i:i+frame_size]
                spectrum = es.Spectrum()(frame)
                centroid = es.Centroid()(spectrum)
                centroid_values.append(centroid)
            
            avg_centroid = np.mean(centroid_values) if centroid_values else 0.5
            # Normalizar centroide (0-1)
            brightness_score = min(1, avg_centroid / 0.5)  # Normalizado
            
            # 4. Consonancia (usando dissonance invertida)
            dissonance_values = []
            for i in range(0, min(len(self.audio_mono) - frame_size, self.sample_rate * 30), hop_size * 4):
                frame = self.audio_mono[i:i+frame_size]
                spectrum = es.Spectrum()(frame)
                peaks = es.SpectralPeaks()(spectrum)
                if len(peaks[0]) > 1:
                    dissonance = es.Dissonance()(peaks[0], peaks[1])
                    dissonance_values.append(dissonance)
            
            avg_dissonance = np.mean(dissonance_values) if dissonance_values else 0.5
            consonance_score = 1 - min(1, avg_dissonance * 2)  # Invertir y normalizar
            
            # Combinar todas las métricas
            valence = (
                scale_score * 0.35 +       # Tonalidad es importante
                tempo_score * 0.25 +       # Tempo contribuye
                brightness_score * 0.20 +  # Brillo
                consonance_score * 0.20    # Consonancia
            )
            
            # Ajustar con strength de la tonalidad
            valence = valence * (0.7 + 0.3 * strength)
            
            valence = max(0, min(1, valence))
            
            self.results['valence'] = round(float(valence), 3)
            print(f"    ✓ Valence: {self.results['valence']:.3f}")
            
            return self.results['valence']
            
        except Exception as e:
            print(f"    ✗ Error calculando Valence: {e}")
            self.results['valence'] = 0.5  # Default: neutral
            return self.results['valence']
    
    def analyze(self, file_path):
        """Ejecuta todos los análisis"""
        print(f"\n{'='*60}")
        print(f"🎵 ANÁLISIS AVANZADO: {Path(file_path).name}")
        print(f"{'='*60}")
        
        # Cargar audio
        if not self.load_audio(file_path):
            return None
        
        print(f"✅ Audio cargado: {self.duration:.2f} segundos\n")
        
        # Ejecutar todos los análisis
        print("📊 Extrayendo características avanzadas:\n")
        
        self.calculate_lufs()
        self.calculate_danceability()
        self.calculate_acousticness()
        self.calculate_instrumentalness()
        self.calculate_liveness()
        self.calculate_speechiness()
        self.calculate_valence()
        
        # Agregar información básica
        self.results['duration'] = round(self.duration, 2)
        self.results['file'] = Path(file_path).name
        
        return self.results


def test_with_file(file_path=None):
    """Función de prueba"""
    
    if file_path is None:
        # Descargar archivo de prueba si no se proporciona
        import requests
        
        test_file = "test_advanced.mp3"
        if not os.path.exists(test_file):
            print("📥 Descargando archivo de prueba...")
            url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
            
            try:
                response = requests.get(url, timeout=30)
                with open(test_file, 'wb') as f:
                    f.write(response.content)
                print(f"✅ Descargado: {test_file}\n")
                file_path = test_file
            except Exception as e:
                print(f"❌ Error descargando: {e}")
                return None
        else:
            file_path = test_file
    
    # Analizar
    analyzer = AdvancedAudioAnalyzer()
    results = analyzer.analyze(file_path)
    
    if results:
        # Mostrar resumen
        print(f"\n{'='*60}")
        print("📋 RESUMEN DE CARACTERÍSTICAS AVANZADAS")
        print(f"{'='*60}")
        
        print(f"""
  📊 LUFS (Loudness):      {results.get('loudness', 'N/A')} dB
  💃 Danceability:         {results.get('danceability', 0):.1%}
  🎸 Acousticness:         {results.get('acousticness', 0):.1%}
  🎹 Instrumentalness:     {results.get('instrumentalness', 0):.1%}
  🎤 Liveness:            {results.get('liveness', 0):.1%}
  🗣️ Speechiness:         {results.get('speechiness', 0):.1%}
  😊 Valence:             {results.get('valence', 0):.1%}
        """)
        
        # Guardar resultados
        output_file = "essentia_advanced_results.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n💾 Resultados guardados en: {output_file}")
        print("\n✅ ¡Análisis avanzado completado con éxito!")
        
        return results
    
    return None


def update_database(results, file_id, db_path="music_analyzer.db"):
    """Actualiza la base de datos con los resultados"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Actualizar tabla llm_metadata
        update_query = """
        UPDATE llm_metadata 
        SET 
            AI_LOUDNESS = ?,
            AI_DANCEABILITY = ?,
            AI_ACOUSTICNESS = ?,
            AI_INSTRUMENTALNESS = ?,
            AI_LIVENESS = ?,
            AI_SPEECHINESS = ?,
            AI_VALENCE = ?
        WHERE file_id = ?
        """
        
        cursor.execute(update_query, (
            results.get('loudness', -30),
            results.get('danceability', 0),
            results.get('acousticness', 0),
            results.get('instrumentalness', 0),
            results.get('liveness', 0),
            results.get('speechiness', 0),
            results.get('valence', 0.5),
            file_id
        ))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Base de datos actualizada para file_id: {file_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error actualizando base de datos: {e}")
        return False


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🎵 ESSENTIA - ANÁLISIS AVANZADO DE CARACTERÍSTICAS")
    print("Music Analyzer Pro - Versión Profesional")
    print("="*60)
    
    if len(sys.argv) > 1:
        # Analizar archivo proporcionado
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            test_with_file(file_path)
        else:
            print(f"❌ Archivo no encontrado: {file_path}")
    else:
        # Usar archivo de prueba
        test_with_file()