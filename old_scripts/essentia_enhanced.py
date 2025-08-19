#!/usr/bin/env python3
"""
Essentia Enhanced - Versión mejorada con todas las sugerencias implementadas
"""

import os
import sys
import json
import warnings
import logging
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import sqlite3
from datetime import datetime
import hashlib

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suprimir warnings de librerías
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

import essentia
import essentia.standard as es
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.mp3 import MP3

# Desactivar logs de Essentia
essentia.log.warningActive = False
essentia.log.infoActive = False
essentia.log.errorActive = False


class EssentiaEnhanced:
    """Analizador de audio mejorado con detección avanzada y validación"""
    
    def __init__(self, sample_rate=44100, use_cache=True):
        self.sample_rate = sample_rate
        self.use_cache = use_cache
        self.cache = {}
        
        # Rangos válidos para validación
        self.valid_ranges = {
            'energy': (0, 1),
            'danceability': (0, 1),
            'valence': (0, 1),
            'acousticness': (0, 1),
            'instrumentalness': (0, 1),
            'liveness': (0, 1),
            'speechiness': (0, 1),
            'bpm': (40, 200),
            'loudness': (-60, 0),
            'bpm_confidence': (0, 5),
            'key_confidence': (0, 1)
        }
        
        logger.info(f"Analizador inicializado (SR: {sample_rate}Hz, Cache: {use_cache})")
        
    def get_file_hash(self, file_path: str) -> str:
        """Genera hash único para el archivo"""
        stat = os.stat(file_path)
        return hashlib.md5(f"{file_path}_{stat.st_size}_{stat.st_mtime}".encode()).hexdigest()
    
    def load_audio(self, file_path: str, duration: int = 60) -> Optional[np.ndarray]:
        """Carga audio con manejo mejorado de memoria"""
        try:
            logger.info(f"Cargando: {Path(file_path).name}")
            
            # Usar EasyLoader para mayor compatibilidad
            loader = es.EasyLoader(filename=file_path, sampleRate=self.sample_rate)
            audio, sample_rate, channels, codec, bitrate = loader()
            
            # Convertir a mono si es necesario
            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=0)
            
            # Limitar duración inteligentemente
            total_duration = len(audio) / self.sample_rate
            if total_duration > duration:
                # Tomar sección más representativa (evitar intro/outro largos)
                skip_intro = int(10 * self.sample_rate)  # Skip primeros 10s
                skip_outro = int(10 * self.sample_rate)  # Skip últimos 10s
                
                if total_duration > (duration + 20):
                    # Si la canción es suficientemente larga, skip intro/outro
                    start = skip_intro
                    end = len(audio) - skip_outro
                    available = end - start
                    
                    if available > duration * self.sample_rate:
                        # Tomar del medio
                        start = start + (available - duration * self.sample_rate) // 2
                        audio = audio[start:start + duration * self.sample_rate]
                    else:
                        audio = audio[start:end]
                else:
                    # Canción corta, tomar del centro
                    max_samples = duration * self.sample_rate
                    start = (len(audio) - max_samples) // 2
                    audio = audio[start:start + max_samples]
            
            logger.info(f"Audio cargado: {len(audio)/self.sample_rate:.1f}s")
            return audio
            
        except Exception as e:
            logger.error(f"Error cargando audio: {e}")
            return None
    
    def calculate_features(self, audio: np.ndarray) -> Dict[str, Any]:
        """Calcula features con métodos mejorados"""
        
        features = {}
        
        # 1. LOUDNESS (LUFS) - Mejorado con rango dinámico
        features.update(self._calculate_loudness(audio))
        
        # 2. BPM y Rhythm - Mejorado
        features.update(self._calculate_rhythm(audio))
        
        # 3. KEY - Mejorado
        features.update(self._calculate_key(audio))
        
        # 4. ENERGY - Calibrado
        features.update(self._calculate_energy(audio))
        
        # 5. DANCEABILITY - Mejorado
        features.update(self._calculate_danceability(audio, features))
        
        # 6. ACOUSTICNESS - Mejorado con HPSS
        features.update(self._calculate_acousticness(audio))
        
        # 7. INSTRUMENTALNESS - Mejorado con pitch salience
        features.update(self._calculate_instrumentalness(audio))
        
        # 8. LIVENESS - Mejorado
        features.update(self._calculate_liveness(audio))
        
        # 9. SPEECHINESS - Mejorado con MFCCs
        features.update(self._calculate_speechiness(audio))
        
        # 10. VALENCE - Mejorado
        features.update(self._calculate_valence(audio, features))
        
        # 11. Características adicionales
        features['duration'] = round(len(audio) / self.sample_rate, 2)
        
        # Validar rangos
        features = self._validate_features(features)
        
        return features
    
    def _calculate_loudness(self, audio: np.ndarray) -> Dict:
        """Calcula loudness con métricas adicionales"""
        try:
            audio_stereo = np.array([audio, audio])
            loudness_calc = es.LoudnessEBUR128(startAtZero=True)
            momentary, shortterm, integrated, loudness_range = loudness_calc(audio_stereo)
            
            return {
                'loudness': round(integrated, 2),
                'loudness_range': round(loudness_range, 2),
                'dynamic_range': round(np.max(momentary) - np.min(momentary), 2)
            }
        except:
            rms = es.RMS()(audio)
            return {
                'loudness': round(20 * np.log10(max(rms, 1e-10)), 2),
                'loudness_range': 0,
                'dynamic_range': 0
            }
    
    def _calculate_rhythm(self, audio: np.ndarray) -> Dict:
        """Calcula BPM con método mejorado"""
        try:
            # Usar múltiples métodos y promediar
            rhythm1 = es.RhythmExtractor2013(method="multifeature")
            bpm1, _, conf1, _, beats_intervals = rhythm1(audio)
            
            rhythm2 = es.RhythmExtractor2013(method="degara")
            bpm2, _, conf2, _, _ = rhythm2(audio)
            
            # Promediar si ambos tienen confianza alta
            if conf1 > 1 and conf2 > 1:
                bpm = (bpm1 + bpm2) / 2
                confidence = (conf1 + conf2) / 2
            elif conf1 > conf2:
                bpm = bpm1
                confidence = conf1
            else:
                bpm = bpm2
                confidence = conf2
            
            # Calcular regularidad del beat
            if len(beats_intervals) > 1:
                beat_regularity = 1.0 - np.std(beats_intervals) / np.mean(beats_intervals)
            else:
                beat_regularity = 0.5
            
            return {
                'bpm': int(round(bpm)),
                'bpm_confidence': round(confidence, 2),
                'beat_regularity': round(beat_regularity, 3)
            }
        except:
            return {
                'bpm': 120,
                'bpm_confidence': 0.5,
                'beat_regularity': 0.5
            }
    
    def _calculate_key(self, audio: np.ndarray) -> Dict:
        """Detecta tonalidad con validación"""
        try:
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            
            # Validar fuerza de detección
            if strength < 0.3:
                key_label = "Unknown"
            else:
                key_label = f"{key} {scale}"
            
            return {
                'key': key_label,
                'key_confidence': round(strength, 2)
            }
        except:
            return {
                'key': "Unknown",
                'key_confidence': 0.0
            }
    
    def _calculate_energy(self, audio: np.ndarray) -> Dict:
        """Calcula energy calibrado con múltiples métricas"""
        try:
            # Energy básico
            raw_energy = es.Energy()(audio)
            
            # RMS energy
            rms = es.RMS()(audio)
            
            # Spectral energy
            spectrum = es.Spectrum()(audio)
            spectral_energy = np.sum(spectrum ** 2)
            
            # Combinar métricas
            combined_energy = (raw_energy * 10 + rms + min(1.0, spectral_energy / 1000)) / 3
            
            return {
                'energy': round(min(1.0, combined_energy), 3)
            }
        except:
            return {'energy': 0.5}
    
    def _calculate_danceability(self, audio: np.ndarray, features: Dict) -> Dict:
        """Calcula danceability con múltiples factores"""
        try:
            bpm = features.get('bpm', 120)
            energy = features.get('energy', 0.5)
            beat_regularity = features.get('beat_regularity', 0.5)
            
            # BPM óptimo para bailar (120-128)
            bpm_score = 1.0 - min(1.0, abs(bpm - 124) / 50.0)
            
            # Onset rate (percusividad)
            onset_rate = self._calculate_onset_rate(audio)
            
            # Flux (variación espectral)
            spectral_flux = es.Flux()(es.Spectrum()(audio))
            flux_score = min(1.0, spectral_flux * 100)
            
            # Combinar factores con pesos
            danceability = (
                bpm_score * 0.25 +
                energy * 0.25 +
                onset_rate * 0.2 +
                beat_regularity * 0.2 +
                flux_score * 0.1
            )
            
            return {'danceability': round(danceability, 3)}
        except:
            return {'danceability': 0.5}
    
    def _calculate_acousticness(self, audio: np.ndarray) -> Dict:
        """Calcula acousticness usando HPSS (Harmonic-Percussive Source Separation)"""
        try:
            # Calcular espectrograma
            stft = es.STFT(frameSize=2048, hopSize=512)
            spectrum_frames = []
            
            for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=512):
                spectrum = stft(frame)
                spectrum_frames.append(np.abs(spectrum))
            
            if not spectrum_frames:
                return {'acousticness': 0.5}
            
            # Analizar contenido armónico vs percusivo
            spectrogram = np.array(spectrum_frames).T
            
            # Separación simplificada harmonic/percussive
            # Mediana horizontal = harmónico, vertical = percusivo
            harmonic = np.median(spectrogram, axis=1)
            percussive = np.median(spectrogram, axis=0)
            
            h_energy = np.sum(harmonic ** 2)
            p_energy = np.sum(percussive ** 2)
            
            # Ratio armónico/(armónico+percusivo)
            if h_energy + p_energy > 0:
                acousticness = h_energy / (h_energy + p_energy)
            else:
                acousticness = 0.5
            
            # Ajustar para música electrónica (tiende a ser menos acústica)
            spectral_flatness = es.FlatnessDB()(es.Spectrum()(audio))
            if spectral_flatness > 0.3:  # Alta flatness = sintético
                acousticness *= 0.5
            
            return {'acousticness': round(acousticness, 3)}
        except:
            return {'acousticness': 0.5}
    
    def _calculate_instrumentalness(self, audio: np.ndarray) -> Dict:
        """Detecta instrumentalness usando pitch salience"""
        try:
            # Pitch salience - alta en voz, baja en instrumental
            spectrum = es.Spectrum()(audio)
            pitch_salience = es.PitchSalience()(spectrum)
            
            # Spectral contrast - diferente para voz vs instrumental
            spectral_contrast = es.SpectralContrast()(spectrum)
            contrast_mean = np.mean(spectral_contrast)
            
            # ZCR como indicador adicional
            zcr = es.ZeroCrossingRate()(audio)
            
            # Combinar indicadores
            # Alta salience + alto contrast = probable voz
            vocal_likelihood = (pitch_salience * 0.5 + contrast_mean * 0.3 + zcr * 0.2)
            
            # Invertir para obtener instrumentalness
            instrumentalness = max(0, 1.0 - vocal_likelihood)
            
            return {'instrumentalness': round(instrumentalness, 3)}
        except:
            return {'instrumentalness': 0.5}
    
    def _calculate_liveness(self, audio: np.ndarray) -> Dict:
        """Detecta características de grabación en vivo"""
        try:
            # Reverb amount (más reverb = más probabilidad de ser en vivo)
            # Aproximación: analizar decay de energía
            envelope = es.Envelope()(audio)
            
            # Calcular tiempo de decay
            peak_idx = np.argmax(envelope)
            if peak_idx < len(envelope) - 100:
                decay_segment = envelope[peak_idx:peak_idx+100]
                decay_rate = np.polyfit(range(len(decay_segment)), decay_segment, 1)[0]
            else:
                decay_rate = 0
            
            # Ruido de fondo (audiencia)
            silence_threshold = np.percentile(np.abs(audio), 5)
            noise_level = np.mean(np.abs(audio[np.abs(audio) < silence_threshold]))
            
            # Variación dinámica (en vivo tiene más variación)
            dynamics = np.std(es.Envelope()(audio))
            
            # Combinar indicadores
            liveness = min(0.4, (
                abs(decay_rate) * 1000 +  # Decay rate
                noise_level * 10 +         # Ruido de fondo
                dynamics * 2               # Variación dinámica
            ))
            
            return {'liveness': round(liveness, 3)}
        except:
            return {'liveness': 0.1}
    
    def _calculate_speechiness(self, audio: np.ndarray) -> Dict:
        """Detecta presencia de habla usando MFCCs"""
        try:
            # Calcular MFCCs (característicos del habla)
            spectrum = es.Spectrum()(audio)
            mfcc_extractor = es.MFCC()
            mfcc_bands, mfcc_coeffs = mfcc_extractor(spectrum)
            
            # Analizar variación temporal de MFCCs (alta en habla)
            mfcc_var = np.var(mfcc_coeffs)
            
            # Centroide espectral (más bajo en habla)
            centroid = es.SpectralCentroidTime()(audio)
            mean_centroid = np.mean(centroid)
            
            # Ratio de pausas (más pausas = más probable habla)
            envelope = es.Envelope()(audio)
            silence_ratio = np.sum(envelope < 0.01) / len(envelope)
            
            # Combinar indicadores
            speechiness = min(1.0, (
                mfcc_var * 0.4 +
                (1.0 - min(1.0, mean_centroid / 5000)) * 0.4 +
                silence_ratio * 0.2
            ))
            
            return {'speechiness': round(speechiness, 3)}
        except:
            return {'speechiness': 0.1}
    
    def _calculate_valence(self, audio: np.ndarray, features: Dict) -> Dict:
        """Calcula valencia emocional con múltiples factores"""
        try:
            # Modo musical (mayor = más positivo)
            key = features.get('key', '')
            is_major = 'major' in key.lower()
            
            # Tempo (más rápido = más energético/positivo)
            bpm = features.get('bpm', 120)
            tempo_score = min(1.0, bpm / 140)
            
            # Energy
            energy = features.get('energy', 0.5)
            
            # Brillo espectral (más brillante = más positivo)
            spectrum = es.Spectrum()(audio)
            spectral_centroid = es.Centroid()(spectrum)
            brightness = min(1.0, spectral_centroid / 4000)
            
            # Disonancia (menos disonancia = más positivo)
            dissonance = es.Dissonance()(spectrum)
            consonance = 1.0 - min(1.0, dissonance)
            
            # Combinar factores
            valence = 0.3  # Base
            if is_major:
                valence += 0.2
            
            valence += tempo_score * 0.15
            valence += energy * 0.15
            valence += brightness * 0.1
            valence += consonance * 0.1
            
            return {'valence': round(min(1.0, valence), 3)}
        except:
            return {'valence': 0.5}
    
    def _calculate_onset_rate(self, audio: np.ndarray) -> float:
        """Calcula tasa de onsets mejorada"""
        try:
            # Detectar onsets con múltiples métodos
            od_hfc = es.OnsetDetection(method='hfc')
            od_complex = es.OnsetDetection(method='complex')
            
            pool = essentia.Pool()
            
            w = es.Windowing(type='hann')
            fft = es.FFT()
            
            for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=512):
                magnitude, phase = fft(w(frame))
                pool.add('onsets.hfc', od_hfc(magnitude, phase))
                pool.add('onsets.complex', od_complex(magnitude, phase))
            
            # Combinar detecciones
            onsets_hfc = pool['onsets.hfc']
            onsets_complex = pool['onsets.complex']
            
            # Contar picos significativos
            threshold_hfc = np.percentile(onsets_hfc, 75)
            threshold_complex = np.percentile(onsets_complex, 75)
            
            peaks_hfc = np.sum(onsets_hfc > threshold_hfc)
            peaks_complex = np.sum(onsets_complex > threshold_complex)
            
            # Normalizar por duración
            duration = len(audio) / self.sample_rate
            onset_rate = (peaks_hfc + peaks_complex) / 2 / duration / 10
            
            return min(1.0, onset_rate)
        except:
            return 0.5
    
    def _validate_features(self, features: Dict) -> Dict:
        """Valida que todos los valores estén en rangos esperados"""
        for key, value in features.items():
            if key in self.valid_ranges and value is not None:
                min_val, max_val = self.valid_ranges[key]
                features[key] = round(np.clip(value, min_val, max_val), 3)
        
        return features
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """Procesa un archivo completo con cache opcional"""
        
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'status': 'processing',
            'timestamp': datetime.now().isoformat()
        }
        
        # Check cache
        if self.use_cache:
            file_hash = self.get_file_hash(file_path)
            if file_hash in self.cache:
                logger.info(f"Usando cache para: {Path(file_path).name}")
                cached = self.cache[file_hash].copy()
                cached['from_cache'] = True
                return cached
        
        # Cargar audio
        audio = self.load_audio(file_path, duration=60)
        if audio is None:
            result['status'] = 'error'
            result['error'] = 'Could not load audio'
            return result
        
        # Calcular features
        try:
            features = self.calculate_features(audio)
            result['features'] = features
            result['status'] = 'success'
            
            # Guardar en cache
            if self.use_cache:
                self.cache[file_hash] = result.copy()
                
            logger.info(f"✅ Análisis completado: {Path(file_path).name}")
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            logger.error(f"Error analizando {Path(file_path).name}: {e}")
        
        return result
    
    def save_to_db(self, result: Dict, db_path: str = 'music_analyzer.db'):
        """Guarda resultado en base de datos con logging"""
        
        if result.get('status') != 'success':
            return False
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Buscar file_id
            file_path = result['file_path']
            cursor.execute('SELECT id FROM audio_files WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            
            if not row:
                logger.warning(f"Archivo no encontrado en BD: {result['file_name']}")
                return False
            
            file_id = row[0]
            features = result['features']
            
            # Verificar si ya existe
            cursor.execute('SELECT file_id FROM llm_metadata WHERE file_id = ?', (file_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Actualizar
                cursor.execute('''
                    UPDATE llm_metadata
                    SET AI_LOUDNESS = ?, AI_BPM = ?, AI_KEY = ?,
                        AI_ENERGY = ?, AI_DANCEABILITY = ?, AI_ACOUSTICNESS = ?,
                        AI_INSTRUMENTALNESS = ?, AI_LIVENESS = ?, AI_SPEECHINESS = ?,
                        AI_VALENCE = ?, AI_TEMPO_CONFIDENCE = ?, AI_KEY_CONFIDENCE = ?
                    WHERE file_id = ?
                ''', (
                    features.get('loudness', 0),
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('valence', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0),
                    file_id
                ))
                logger.info(f"Actualizado en BD: {result['file_name']}")
            else:
                # Insertar
                cursor.execute('''
                    INSERT INTO llm_metadata (
                        file_id, AI_LOUDNESS, AI_BPM, AI_KEY,
                        AI_ENERGY, AI_DANCEABILITY, AI_ACOUSTICNESS,
                        AI_INSTRUMENTALNESS, AI_LIVENESS, AI_SPEECHINESS,
                        AI_VALENCE, AI_TEMPO_CONFIDENCE, AI_KEY_CONFIDENCE
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    file_id,
                    features.get('loudness', 0),
                    features.get('bpm', 0),
                    features.get('key', ''),
                    features.get('energy', 0),
                    features.get('danceability', 0),
                    features.get('acousticness', 0),
                    features.get('instrumentalness', 0),
                    features.get('liveness', 0),
                    features.get('speechiness', 0),
                    features.get('valence', 0),
                    features.get('bpm_confidence', 0),
                    features.get('key_confidence', 0)
                ))
                logger.info(f"Insertado en BD: {result['file_name']}")
            
            conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error guardando en BD: {e}")
            return False
        finally:
            conn.close()


def main():
    """Función principal mejorada con más opciones"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Essentia Enhanced - Análisis avanzado de audio')
    parser.add_argument('file', help='Archivo o directorio a procesar')
    parser.add_argument('--save-db', action='store_true', help='Guardar en BD')
    parser.add_argument('--no-cache', action='store_true', help='Desactivar cache')
    parser.add_argument('--json', help='Exportar a JSON')
    parser.add_argument('--verbose', action='store_true', help='Salida detallada')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    analyzer = EssentiaEnhanced(use_cache=not args.no_cache)
    
    # Procesar archivo o directorio
    file_path = Path(args.file)
    
    if file_path.is_file():
        # Procesar archivo único
        print(f"🎵 Analizando: {file_path.name}")
        result = analyzer.process_file(str(file_path))
        
        if result['status'] == 'success':
            print("\n✅ Análisis completado:")
            print("-" * 50)
            for key, value in sorted(result['features'].items()):
                print(f"  {key:20s}: {value}")
            
            if args.save_db:
                if analyzer.save_to_db(result):
                    print("\n💾 Guardado en base de datos")
            
            if args.json:
                with open(args.json, 'w') as f:
                    json.dump(result, f, indent=2)
                print(f"\n📄 Exportado a: {args.json}")
        else:
            print(f"❌ Error: {result.get('error')}")
            
    elif file_path.is_dir():
        # Procesar directorio
        print(f"📁 Procesando directorio: {file_path}")
        
        audio_files = list(file_path.glob("*.flac")) + \
                     list(file_path.glob("*.mp3")) + \
                     list(file_path.glob("*.m4a"))
        
        results = []
        for audio_file in audio_files[:10]:  # Limitar a 10 para pruebas
            print(f"\n[{len(results)+1}/{min(10, len(audio_files))}] {audio_file.name}")
            result = analyzer.process_file(str(audio_file))
            
            if result['status'] == 'success':
                print("  ✅ Procesado")
                if args.save_db:
                    analyzer.save_to_db(result)
                results.append(result)
            else:
                print(f"  ❌ Error: {result.get('error')}")
        
        if args.json and results:
            with open(args.json, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n📄 {len(results)} resultados exportados a: {args.json}")
        
        print(f"\n✅ Procesados: {len(results)}/{len(audio_files)} archivos")
    else:
        print(f"❌ No encontrado: {file_path}")


if __name__ == '__main__':
    main()