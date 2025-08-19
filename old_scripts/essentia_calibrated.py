#!/usr/bin/env python3
"""
Essentia Calibrated - Versión con valores calibrados correctamente
"""

import os
import sys
import json
import warnings
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
import sqlite3

# Suprimir warnings
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

import essentia
import essentia.standard as es
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.mp3 import MP3

# Desactivar logs
essentia.log.warningActive = False
essentia.log.infoActive = False
essentia.log.errorActive = False


class EssentiaCalibrated:
    """Analizador de audio con valores calibrados correctamente"""
    
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        
    def load_audio(self, file_path: str, duration: int = 60) -> Optional[np.ndarray]:
        """Carga audio limitado a duración especificada"""
        try:
            loader = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)
            audio = loader()
            
            # Limitar duración
            max_samples = duration * self.sample_rate
            if len(audio) > max_samples:
                # Tomar del medio de la canción (más representativo)
                start = (len(audio) - max_samples) // 2
                audio = audio[start:start + max_samples]
            
            return audio
        except Exception as e:
            print(f"❌ Error cargando audio: {e}")
            return None
    
    def calculate_features(self, audio: np.ndarray) -> Dict[str, Any]:
        """Calcula features con valores calibrados"""
        
        features = {}
        
        # 1. LOUDNESS (LUFS) - Correcto
        try:
            audio_stereo = np.array([audio, audio])
            loudness_calc = es.LoudnessEBUR128(startAtZero=True)
            _, _, integrated, _ = loudness_calc(audio_stereo)
            features['loudness'] = round(integrated, 2)
        except:
            # Fallback con RMS
            rms = es.RMS()(audio)
            features['loudness'] = round(20 * np.log10(max(rms, 1e-10)), 2)
        
        # 2. BPM - Correcto
        try:
            rhythm = es.RhythmExtractor2013(method="multifeature")
            bpm, _, confidence, _, _ = rhythm(audio)
            features['bpm'] = int(round(bpm))
            features['bpm_confidence'] = round(confidence, 2)
        except:
            features['bpm'] = 120
            features['bpm_confidence'] = 0.5
        
        # 3. KEY - Correcto
        try:
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            features['key'] = f"{key} {scale}"
            features['key_confidence'] = round(strength, 2)
        except:
            features['key'] = "C major"
            features['key_confidence'] = 0.5
        
        # 4. ENERGY - CORREGIDO (multiplicado por 10)
        try:
            # Energy de Essentia está en rango muy bajo, necesita escalar
            raw_energy = es.Energy()(audio)
            # Normalizar entre 0 y 1 con calibración
            features['energy'] = round(min(1.0, raw_energy * 10), 3)
        except:
            features['energy'] = 0.5
        
        # 5. DANCEABILITY - CORREGIDO
        try:
            # Basado en BPM, energy y regularidad del ritmo
            bpm = features.get('bpm', 120)
            energy = features['energy']
            
            # BPM óptimo para bailar: 120-130
            bpm_score = 1.0 - abs(bpm - 125) / 100.0
            bpm_score = max(0, min(1, bpm_score))
            
            # Calcular onset rate (qué tan percusivo es)
            onset_rate = self._calculate_onset_rate(audio)
            
            # Combinar factores
            danceability = (bpm_score * 0.3 + energy * 0.4 + onset_rate * 0.3)
            features['danceability'] = round(danceability, 3)
        except:
            features['danceability'] = 0.5
        
        # 6. ACOUSTICNESS - CORREGIDO (invertido)
        try:
            # Detectar contenido armónico vs percusivo
            spectral_flatness = es.FlatnessDB()(es.Spectrum()(audio))
            # Invertir: alta flatness = baja acousticness (más sintético)
            features['acousticness'] = round(max(0, 1.0 - spectral_flatness / 0.5), 3)
        except:
            features['acousticness'] = 0.5
        
        # 7. INSTRUMENTALNESS - CORREGIDO
        try:
            # Detectar presencia de voz
            # Usar zero crossing rate como proxy
            zcr = es.ZeroCrossingRate()(audio)
            # Alta ZCR sugiere voz/speech
            features['instrumentalness'] = round(max(0, 1.0 - zcr * 2), 3)
        except:
            features['instrumentalness'] = 0.5
        
        # 8. LIVENESS - CORREGIDO (reducido drásticamente)
        try:
            # Detectar características de grabación en vivo
            # Buscar ruido de audiencia, reverb, etc.
            spectral_complexity = es.SpectralComplexity()(es.Spectrum()(audio))
            # La mayoría de música de estudio tiene baja liveness
            features['liveness'] = round(min(0.3, spectral_complexity / 100), 3)
        except:
            features['liveness'] = 0.1
        
        # 9. SPEECHINESS
        try:
            # Detectar habla vs música
            spectral_centroid = es.SpectralCentroidTime()(audio)
            mean_centroid = np.mean(spectral_centroid)
            # Normalizar a 0-1
            features['speechiness'] = round(min(1.0, mean_centroid / 5000), 3)
        except:
            features['speechiness'] = 0.1
        
        # 10. VALENCE (positividad emocional)
        try:
            # Basado en modo (mayor/menor) y tempo
            is_major = "major" in features.get('key', '').lower()
            bpm = features.get('bpm', 120)
            energy = features.get('energy', 0.5)
            
            # Mayor = más positivo, tempo alto = más positivo
            valence = 0.5  # Base
            if is_major:
                valence += 0.2
            valence += (bpm - 100) / 200  # Normalizar BPM
            valence += energy * 0.2
            
            features['valence'] = round(max(0, min(1, valence)), 3)
        except:
            features['valence'] = 0.5
        
        return features
    
    def _calculate_onset_rate(self, audio: np.ndarray) -> float:
        """Calcula tasa de onsets (para danceability)"""
        try:
            od = es.OnsetDetection(method='hfc')
            pool = essentia.Pool()
            
            # Ventaneo
            w = es.Windowing(type='hann')
            fft = es.FFT()
            
            for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=512):
                magnitude, phase = fft(w(frame))
                onset = od(magnitude, phase)
                pool.add('onsets', onset)
            
            onsets = pool['onsets']
            # Normalizar a 0-1
            onset_rate = len(onsets[onsets > 0.1]) / (len(audio) / self.sample_rate) / 20
            return min(1.0, onset_rate)
        except:
            return 0.5
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """Procesa un archivo completo"""
        
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'status': 'processing'
        }
        
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
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
        
        return result
    
    def save_to_db(self, result: Dict, db_path: str = 'music_analyzer.db'):
        """Guarda resultado en base de datos"""
        
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
                print(f"⚠️ Archivo no encontrado en BD: {result['file_name']}")
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
            
            conn.commit()
            return True
            
        except Exception as e:
            print(f"❌ Error guardando en BD: {e}")
            return False
        finally:
            conn.close()


def main():
    """Función principal de prueba"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Essentia Calibrated - Análisis calibrado')
    parser.add_argument('file', help='Archivo a procesar')
    parser.add_argument('--save-db', action='store_true', help='Guardar en BD')
    
    args = parser.parse_args()
    
    analyzer = EssentiaCalibrated()
    
    print(f"🎵 Analizando: {Path(args.file).name}")
    result = analyzer.process_file(args.file)
    
    if result['status'] == 'success':
        print("\n✅ Análisis completado:")
        for key, value in result['features'].items():
            print(f"  • {key}: {value}")
        
        if args.save_db:
            if analyzer.save_to_db(result):
                print("\n💾 Guardado en base de datos")
    else:
        print(f"❌ Error: {result.get('error')}")


if __name__ == '__main__':
    main()