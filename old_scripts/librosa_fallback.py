#!/usr/bin/env python3
"""
Analizador de audio usando Librosa como fallback
Para archivos que causan crashes con Essentia
"""

import os
import sys
import warnings
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger(__name__)

# Suprimir warnings
warnings.filterwarnings('ignore')

try:
    import librosa
    import librosa.feature
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("Librosa not available. Install with: pip install librosa")

class LibrosaAnalyzer:
    """Analizador de audio usando Librosa"""
    
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        
    def analyze_file(self, file_path: str, duration: int = 60) -> Dict[str, Any]:
        """
        Analiza un archivo de audio usando Librosa
        """
        if not LIBROSA_AVAILABLE:
            return {
                'status': 'error',
                'error': 'Librosa not available'
            }
            
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'status': 'processing'
        }
        
        try:
            # Cargar audio con librosa (más robusto para diferentes formatos)
            logger.info(f"Loading with librosa: {Path(file_path).name}")
            
            # Cargar solo los primeros 60 segundos
            y, sr = librosa.load(
                file_path, 
                sr=self.sample_rate,
                duration=duration,
                mono=True
            )
            
            if len(y) == 0:
                result['status'] = 'error'
                result['error'] = 'Empty audio file'
                return result
                
            # Calcular features
            features = {}
            
            # 1. Tempo (BPM)
            try:
                tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
                features['bpm'] = float(tempo)
                features['bpm_confidence'] = 0.8  # Librosa no da confidence
            except:
                features['bpm'] = 120.0
                features['bpm_confidence'] = 0.5
                
            # 2. Loudness (usando RMS como proxy)
            try:
                rms = librosa.feature.rms(y=y)
                db = librosa.amplitude_to_db(rms.mean())
                features['loudness'] = float(np.clip(db, -60, 0))
            except:
                features['loudness'] = -23.0
                
            # 3. Energy (basado en RMS)
            try:
                rms = librosa.feature.rms(y=y)
                energy = np.mean(rms)
                features['energy'] = float(np.clip(energy * 5, 0, 1))  # Escalar
            except:
                features['energy'] = 0.5
                
            # 4. Spectral features
            try:
                # Centroide espectral (brillo)
                cent = librosa.feature.spectral_centroid(y=y, sr=sr)
                features['brightness'] = float(np.mean(cent) / sr)
                
                # Contraste espectral
                contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
                features['contrast'] = float(np.mean(contrast))
                
                # Roll-off
                rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
                features['rolloff'] = float(np.mean(rolloff) / sr)
                
            except:
                features['brightness'] = 0.5
                features['contrast'] = 0.5
                features['rolloff'] = 0.5
                
            # 5. Zero crossing rate (para speechiness)
            try:
                zcr = librosa.feature.zero_crossing_rate(y)
                features['speechiness'] = float(np.clip(np.mean(zcr) * 10, 0, 1))
            except:
                features['speechiness'] = 0.1
                
            # 6. MFCCs (características tímbricas)
            try:
                mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
                features['mfcc_mean'] = float(np.mean(mfccs))
                features['mfcc_var'] = float(np.var(mfccs))
            except:
                features['mfcc_mean'] = 0.0
                features['mfcc_var'] = 0.0
                
            # 7. Chroma (para detectar tonalidad)
            try:
                chroma = librosa.feature.chroma_stft(y=y, sr=sr)
                chroma_mean = np.mean(chroma, axis=1)
                
                # Detectar tonalidad basándose en chroma más fuerte
                pitch_classes = ['C', 'C#', 'D', 'D#', 'E', 'F', 
                               'F#', 'G', 'G#', 'A', 'A#', 'B']
                key_idx = np.argmax(chroma_mean)
                features['key'] = pitch_classes[key_idx]
                features['key_confidence'] = float(chroma_mean[key_idx])
                
            except:
                features['key'] = 'C'
                features['key_confidence'] = 0.5
                
            # 8. Onset strength (para danceability)
            try:
                onset_env = librosa.onset.onset_strength(y=y, sr=sr)
                features['onset_rate'] = float(np.mean(onset_env))
                
                # Danceability basada en tempo y onset rate
                tempo_score = np.clip((features['bpm'] - 60) / 80, 0, 1)
                onset_score = np.clip(features['onset_rate'] / 5, 0, 1)
                features['danceability'] = float((tempo_score + onset_score) / 2)
                
            except:
                features['onset_rate'] = 0.5
                features['danceability'] = 0.5
                
            # 9. Estimaciones heurísticas para otros features
            features['acousticness'] = float(1.0 - features.get('brightness', 0.5))
            features['instrumentalness'] = float(1.0 - features.get('speechiness', 0.1))
            features['liveness'] = 0.1  # Difícil de detectar sin modelo ML
            features['valence'] = float((features.get('energy', 0.5) + 
                                        features.get('brightness', 0.5)) / 2)
            
            # Asegurar que todos los valores estén en rango [0, 1] excepto loudness y BPM
            for key in ['energy', 'danceability', 'acousticness', 'instrumentalness', 
                       'liveness', 'speechiness', 'valence']:
                if key in features:
                    features[key] = float(np.clip(features[key], 0, 1))
                    
            result['features'] = features
            result['status'] = 'success'
            result['analyzer'] = 'librosa'
            
            logger.info(f"✅ Analysis complete: BPM={features['bpm']:.1f}, Key={features['key']}")
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            logger.error(f"Error analyzing {Path(file_path).name}: {e}")
            
        return result


def analyze_with_fallback(file_path: str) -> Dict[str, Any]:
    """
    Intenta analizar con Essentia, si falla usa Librosa
    """
    import subprocess
    import json
    
    file_name = Path(file_path).name
    logger.info(f"Attempting analysis: {file_name}")
    
    # Primero intentar con Essentia
    try:
        cmd = [
            sys.executable,
            'essentia_enhanced_v2.py',
            file_path,
            '--strategy', 'smart60',
            '--json', '-'
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=20
        )
        
        if result.returncode == 0 and result.stdout:
            # Buscar JSON en la salida
            for line in result.stdout.strip().split('\n'):
                if line.strip().startswith('{'):
                    try:
                        data = json.loads(line)
                        if data.get('status') == 'success':
                            logger.info(f"✅ Essentia analysis successful: {file_name}")
                            return data
                    except:
                        pass
                        
    except subprocess.TimeoutExpired:
        logger.warning(f"Essentia timeout for: {file_name}")
    except Exception as e:
        logger.warning(f"Essentia failed for {file_name}: {e}")
        
    # Si Essentia falla, usar Librosa
    logger.info(f"Falling back to Librosa for: {file_name}")
    analyzer = LibrosaAnalyzer()
    return analyzer.analyze_file(file_path)


def main():
    """Función principal para pruebas"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Librosa Audio Analyzer')
    parser.add_argument('file', help='Audio file to analyze')
    parser.add_argument('--json', help='Export to JSON file')
    
    args = parser.parse_args()
    
    # Instalar librosa si no está disponible
    if not LIBROSA_AVAILABLE:
        print("Installing librosa...")
        os.system(f"{sys.executable} -m pip install librosa")
        print("Please restart the script")
        sys.exit(1)
        
    print(f"🎵 Analyzing: {Path(args.file).name}")
    
    # Analizar con fallback
    result = analyze_with_fallback(args.file)
    
    # Mostrar resultado
    if result['status'] == 'success':
        print(f"✅ Success! (Analyzer: {result.get('analyzer', 'unknown')})")
        if 'features' in result:
            features = result['features']
            print(f"  BPM: {features.get('bpm', 'N/A'):.1f}")
            print(f"  Key: {features.get('key', 'N/A')}")
            print(f"  Energy: {features.get('energy', 'N/A'):.3f}")
            print(f"  Danceability: {features.get('danceability', 'N/A'):.3f}")
    else:
        print(f"❌ Error: {result.get('error')}")
        
    # Exportar JSON si se solicita
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"📄 Exported to: {args.json}")


if __name__ == '__main__':
    main()