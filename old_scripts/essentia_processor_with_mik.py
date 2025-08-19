#!/usr/bin/env python3
"""
Procesador de Essentia con datos de Mixed In Key
Usa BPM, Key y Energy de MIK para calcular las 7 características
"""

import os
import sys
import json
import warnings
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

# Suprimir warnings
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

# Redirigir stderr para suprimir warnings de FFmpeg
import io
sys.stderr = io.StringIO()

import essentia
import essentia.standard as es

# Desactivar logs de Essentia
essentia.log.warningActive = False
essentia.log.infoActive = False
essentia.log.errorActive = False

# Importar el lector de metadata
from metadata_reader_complete import CompleteMetadataReader


class EssentiaProcessorWithMIK:
    """
    Procesador de Essentia que usa datos de Mixed In Key
    para calcular las 7 características de forma más precisa
    """
    
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        self.metadata_reader = CompleteMetadataReader()
        
    def process_file(self, file_path: str) -> Dict[str, Any]:
        """
        Procesa un archivo usando metadata MIK + Essentia
        
        Returns:
            Dict con metadata original + 7 características calculadas
        """
        
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'status': 'processing',
            'metadata': {},
            'essentia_features': {},
            'errors': []
        }
        
        # Paso 1: Leer metadata completa (incluye MIK)
        try:
            metadata = self.metadata_reader.read_all_metadata(file_path)
            result['metadata'] = metadata
            
            # Extraer datos MIK
            mik_bpm = metadata.get('bpm')
            mik_key = metadata.get('key')
            mik_energy = metadata.get('energy')
            
            # Si energy está en escala MIK (1-10), convertir a 0-1
            if mik_energy and mik_energy > 1:
                mik_energy_normalized = mik_energy / 10.0
            else:
                mik_energy_normalized = mik_energy
                
            print(f"\n📊 Datos MIK encontrados:")
            print(f"  • BPM: {mik_bpm or 'No disponible'}")
            print(f"  • Key: {mik_key or 'No disponible'}")
            print(f"  • Energy: {mik_energy or 'No disponible'}")
            if mik_energy:
                print(f"  • Energy normalizada: {mik_energy_normalized:.2f}")
                
        except Exception as e:
            result['errors'].append(f"Error leyendo metadata: {str(e)}")
            metadata = {}
            mik_bpm = None
            mik_key = None
            mik_energy_normalized = None
            
        # Paso 2: Cargar audio con Essentia
        try:
            # Restaurar stderr temporalmente
            sys.stderr = sys.__stderr__
            print(f"\n🎵 Cargando audio...")
            sys.stderr = io.StringIO()
            
            audio = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)()
            
            if len(audio) == 0:
                raise ValueError("Audio vacío")
                
            duration = len(audio) / self.sample_rate
            
        except Exception as e:
            result['status'] = 'error'
            result['errors'].append(f"Error cargando audio: {str(e)}")
            return result
            
        # Paso 3: Calcular las 7 características usando datos MIK
        try:
            features = self.calculate_seven_features(
                audio=audio,
                mik_bpm=mik_bpm,
                mik_key=mik_key,
                mik_energy=mik_energy_normalized
            )
            
            result['essentia_features'] = features
            result['status'] = 'success'
            
            # Restaurar stderr para mostrar resultados
            sys.stderr = sys.__stderr__
            print(f"\n✅ Características calculadas:")
            for key, value in features.items():
                if isinstance(value, float):
                    print(f"  • {key}: {value:.3f}")
                else:
                    print(f"  • {key}: {value}")
            sys.stderr = io.StringIO()
            
        except Exception as e:
            result['status'] = 'partial'
            result['errors'].append(f"Error calculando características: {str(e)}")
            
        return result
    
    def calculate_seven_features(self, audio: np.ndarray, 
                                mik_bpm: Optional[float] = None,
                                mik_key: Optional[str] = None,
                                mik_energy: Optional[float] = None) -> Dict[str, Any]:
        """
        Calcula las 7 características usando datos MIK como base
        
        Args:
            audio: Señal de audio
            mik_bpm: BPM de Mixed In Key
            mik_key: Tonalidad de Mixed In Key
            mik_energy: Energía normalizada (0-1) de Mixed In Key
            
        Returns:
            Dict con las 7 características
        """
        
        features = {}
        
        # 1. LUFS (Loudness) - Siempre se calcula del audio
        try:
            # Crear versión estéreo si es necesario
            audio_stereo = np.array([audio, audio])
            
            # Calcular LUFS integrado
            loudness = es.LoudnessEBUR128(startAtZero=True)
            _, _, integrated, loudness_range = loudness(audio_stereo)
            
            # Limitar a rango típico
            features['loudness'] = round(max(-60, min(0, integrated)), 2)
        except:
            # Fallback: usar RMS
            rms = es.RMS()(audio)
            lufs = 20 * np.log10(max(rms, 1e-10))
            features['loudness'] = round(max(-60, min(0, lufs)), 2)
            
        # 2. Danceability (usa BPM y Energy de MIK)
        try:
            # Si tenemos BPM de MIK, usarlo; si no, calcularlo
            if mik_bpm:
                bpm = mik_bpm
                bpm_confidence = 1.0  # Alta confianza en MIK
            else:
                rhythm = es.RhythmExtractor2013(method="degara")
                bpm, beats, bpm_confidence, _, _ = rhythm(audio)
                
            # Si tenemos energy de MIK, usarla; si no, calcularla
            if mik_energy is not None:
                energy_norm = mik_energy
            else:
                energy = es.Energy()(audio)
                energy_norm = min(1.0, energy / 1000000) if energy > 1 else energy
                
            # Calcular danceability combinando BPM y energy
            # BPM ideal para bailar: 120-130
            bpm_score = 1.0 - min(1.0, abs(bpm - 125) / 60)
            
            # Peso mayor a energy si viene de MIK (más confiable)
            if mik_energy is not None:
                features['danceability'] = round(0.4 * bpm_score + 0.6 * energy_norm, 3)
            else:
                features['danceability'] = round(0.6 * bpm_score + 0.4 * energy_norm, 3)
                
            # Guardar BPM y energy también
            features['bpm'] = round(bpm)
            features['energy'] = round(energy_norm, 3)
            
        except Exception as e:
            features['danceability'] = 0.5
            features['bpm'] = mik_bpm or 120
            features['energy'] = mik_energy or 0.5
            
        # 3. Acousticness (análisis espectral)
        try:
            # Calcular spectral flatness (menos plano = más acústico)
            spectrum = es.Spectrum()(audio[:2048] if len(audio) > 2048 else audio)
            flatness = es.Flatness()(spectrum)
            
            # Calcular spectral centroid (más bajo = más acústico)
            centroid = es.Centroid()(spectrum)
            centroid_norm = min(1.0, centroid / 5000)  # Normalizar
            
            # Combinar métricas
            acousticness = 1.0 - (0.6 * flatness + 0.4 * centroid_norm)
            features['acousticness'] = round(max(0, min(1, acousticness)), 3)
            
        except:
            features['acousticness'] = 0.5
            
        # 4. Instrumentalness (detección de voz)
        try:
            # Zero Crossing Rate - alta variación sugiere voz
            zcr = es.ZeroCrossingRate()(audio[:2048] if len(audio) > 2048 else audio)
            
            # Spectral rolloff - voz tiene rolloff más bajo
            rolloff = es.RollOff()(spectrum)
            rolloff_norm = rolloff / (self.sample_rate / 2)
            
            # Si ZCR muy bajo o muy alto, probablemente instrumental
            if zcr < 0.05 or zcr > 0.3:
                instrumentalness = 0.8
            else:
                # Usar rolloff para afinar
                instrumentalness = 0.3 + (0.5 * rolloff_norm)
                
            features['instrumentalness'] = round(instrumentalness, 3)
            
        except:
            features['instrumentalness'] = 0.7
            
        # 5. Liveness (complejidad dinámica y reverb)
        try:
            # Dynamic complexity
            complexity = es.DynamicComplexity()(audio)
            if isinstance(complexity, tuple):
                complexity = complexity[0]
                
            # Calcular variación de energía (más variación = más live)
            frame_size = int(0.5 * self.sample_rate)
            hop_size = int(0.25 * self.sample_rate)
            
            energy_frames = []
            for i in range(0, len(audio) - frame_size, hop_size):
                frame = audio[i:i+frame_size]
                energy_frames.append(es.Energy()(frame))
                
            if energy_frames:
                energy_std = np.std(energy_frames)
                energy_mean = np.mean(energy_frames)
                energy_variation = energy_std / (energy_mean + 1e-10)
                
                # Combinar complejidad y variación
                liveness = min(1.0, complexity * 0.6 + energy_variation * 0.4)
            else:
                liveness = complexity
                
            features['liveness'] = round(liveness, 3)
            
        except:
            features['liveness'] = 0.1
            
        # 6. Speechiness (detección de habla)
        try:
            # Análisis de pausas y patrones de habla
            frame_size = int(0.025 * self.sample_rate)
            hop_size = int(0.010 * self.sample_rate)
            
            energy_values = []
            zcr_values = []
            
            for i in range(0, min(len(audio), self.sample_rate*30), hop_size):
                if i + frame_size < len(audio):
                    frame = audio[i:i+frame_size]
                    energy_values.append(es.Energy()(frame))
                    zcr_values.append(es.ZeroCrossingRate()(frame))
                    
            if energy_values:
                # Detectar pausas (silencio típico del habla)
                energy_threshold = np.mean(energy_values) * 0.1
                silence_ratio = sum(1 for e in energy_values if e < energy_threshold) / len(energy_values)
                
                # ZCR medio (habla tiene ZCR característico)
                mean_zcr = np.mean(zcr_values)
                speech_zcr = 1.0 if 0.1 < mean_zcr < 0.25 else 0.0
                
                speechiness = min(1.0, silence_ratio * 0.6 + speech_zcr * 0.4)
            else:
                speechiness = 0.0
                
            features['speechiness'] = round(speechiness, 3)
            
        except:
            features['speechiness'] = 0.0
            
        # 7. Valence (positividad - usa Key de MIK)
        try:
            # Si tenemos key de MIK, usarla
            if mik_key:
                # Camelot Wheel: A = minor, B = major
                if 'B' in str(mik_key).upper() or 'MAJ' in str(mik_key).upper():
                    key_score = 0.8  # Mayor = más positivo
                else:
                    key_score = 0.3  # Menor = menos positivo
                    
                key_confidence = 1.0  # Alta confianza en MIK
            else:
                # Calcular key con Essentia
                key_extractor = es.KeyExtractor()
                key, scale, key_confidence = key_extractor(audio)
                key_score = 0.7 if scale == 'major' else 0.3
                
            # Tempo score (usa BPM)
            bpm = features.get('bpm', 120)
            if 120 <= bpm <= 140:
                tempo_score = 0.8  # Tempo alegre
            elif bpm < 80:
                tempo_score = 0.3  # Tempo lento/triste
            elif bpm > 180:
                tempo_score = 0.5  # Muy rápido, puede ser agresivo
            else:
                tempo_score = 0.5
                
            # Energy también afecta valence
            energy_score = features.get('energy', 0.5)
            
            # Combinar scores (más peso a key si viene de MIK)
            if mik_key:
                valence = (key_score * 0.5 + tempo_score * 0.3 + energy_score * 0.2)
            else:
                valence = (key_score * 0.4 + tempo_score * 0.35 + energy_score * 0.25)
                
            features['valence'] = round(valence, 3)
            
            # Guardar key también
            features['key'] = mik_key or f"{key} {scale}"
            
        except:
            features['valence'] = 0.5
            features['key'] = mik_key or 'unknown'
            
        return features
    
    def process_batch(self, folder_path: str, limit: Optional[int] = None) -> list:
        """
        Procesa múltiples archivos de una carpeta
        
        Args:
            folder_path: Ruta a la carpeta
            limit: Número máximo de archivos a procesar
            
        Returns:
            Lista de resultados
        """
        
        results = []
        folder = Path(folder_path)
        
        # Obtener archivos FLAC
        files = list(folder.glob('*.flac'))
        if limit:
            files = files[:limit]
            
        print(f"\n{'='*70}")
        print(f"🎵 PROCESAMIENTO CON ESSENTIA + MIXED IN KEY")
        print(f"{'='*70}")
        print(f"📁 Carpeta: {folder_path}")
        print(f"📊 Archivos a procesar: {len(files)}")
        print(f"{'='*70}")
        
        for i, file_path in enumerate(files, 1):
            # Restaurar stderr para print
            sys.stderr = sys.__stderr__
            
            print(f"\n[{i}/{len(files)}] Procesando: {file_path.name}")
            print("-"*50)
            
            # Volver a suprimir stderr
            sys.stderr = io.StringIO()
            
            # Procesar archivo
            result = self.process_file(str(file_path))
            results.append(result)
            
            # Mostrar resumen
            sys.stderr = sys.__stderr__
            if result['status'] == 'success':
                print(f"✅ Procesado exitosamente")
            elif result['status'] == 'partial':
                print(f"⚠️ Procesado parcialmente")
            else:
                print(f"❌ Error en procesamiento")
                
            sys.stderr = io.StringIO()
            
        # Resumen final
        sys.stderr = sys.__stderr__
        
        successful = sum(1 for r in results if r['status'] == 'success')
        partial = sum(1 for r in results if r['status'] == 'partial')
        failed = sum(1 for r in results if r['status'] == 'error')
        
        print(f"\n{'='*70}")
        print(f"📊 RESUMEN")
        print(f"{'='*70}")
        print(f"✅ Exitosos: {successful}")
        print(f"⚠️ Parciales: {partial}")
        print(f"❌ Fallidos: {failed}")
        print(f"📈 Total: {len(results)}")
        
        # Guardar resultados
        output_file = f"essentia_mik_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
            
        print(f"\n💾 Resultados guardados en: {output_file}")
        
        return results


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Procesador Essentia con Mixed In Key')
    parser.add_argument('path', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas",
                       help='Archivo o carpeta a procesar')
    parser.add_argument('--limit', type=int, default=5,
                       help='Límite de archivos a procesar')
    
    args = parser.parse_args()
    
    # Crear procesador
    processor = EssentiaProcessorWithMIK()
    
    path = Path(args.path)
    
    if path.is_file():
        # Procesar archivo único
        result = processor.process_file(str(path))
        print(json.dumps(result, indent=2, default=str))
    elif path.is_dir():
        # Procesar carpeta
        results = processor.process_batch(str(path), limit=args.limit)
    else:
        print(f"❌ Ruta no válida: {path}")


if __name__ == "__main__":
    # Asegurar que stderr esté restaurado al final
    try:
        main()
    finally:
        sys.stderr = sys.__stderr__