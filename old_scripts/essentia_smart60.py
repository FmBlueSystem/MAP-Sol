#!/usr/bin/env python3
"""
Essentia Smart60 - Extracción inteligente de 60 segundos
Implementa estrategia optimizada con detección de chorus y agregación por métrica
"""

import os
import sys
import json
import warnings
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

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

# Importar módulos previos
from metadata_reader_complete import CompleteMetadataReader
from essentia_processor_with_mik import EssentiaProcessorWithMIK


class Smart60Analyzer:
    """
    Analizador Smart60: Extrae 60 segundos inteligentes del audio
    - start30: Primeros 30 segundos (intro + primer verso)
    - chorus30: 30 segundos del chorus detectado
    - end20: Últimos 20 segundos (outro + final)
    """
    
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        self.metadata_reader = CompleteMetadataReader()
        self.full_processor = EssentiaProcessorWithMIK(sample_rate)
        
        # Configuración de ventanas
        self.windows = {
            'start30': {'duration': 30, 'position': 'start'},
            'chorus30': {'duration': 30, 'position': 'chorus'},
            'end20': {'duration': 20, 'position': 'end'}
        }
        
        # Estrategias de agregación por métrica
        self.aggregation_strategies = {
            'loudness': 'max',        # Máximo volumen percibido
            'danceability': 'weighted_mean',  # Media ponderada
            'acousticness': 'median',  # Mediana para robustez
            'instrumentalness': 'min',  # Mínimo (si hay voz en alguna parte)
            'liveness': 'max',         # Máximo (capturar momentos live)
            'speechiness': 'percentile_75',  # Percentil 75
            'valence': 'weighted_mean',  # Media ponderada
            'energy': 'percentile_75',  # Percentil 75
            'bpm': 'mode',            # Moda (BPM más común)
            'key': 'mode'             # Moda (tonalidad más común)
        }
        
    def detect_chorus(self, audio: np.ndarray) -> Tuple[int, int]:
        """
        Detecta la posición del chorus usando análisis espectral
        
        Returns:
            Tuple con (inicio_chorus, fin_chorus) en samples
        """
        
        # Configuración para detección
        frame_size = 2048
        hop_size = 512
        
        # Calcular spectral flux para detectar cambios
        spectral_flux = []
        spectrum_prev = None
        
        for i in range(0, len(audio) - frame_size, hop_size):
            frame = audio[i:i+frame_size]
            
            # Aplicar ventana
            windowed = es.Windowing(type='hann')(frame)
            spectrum = es.Spectrum()(windowed)
            
            if spectrum_prev is not None:
                # Calcular flux (diferencia entre espectros consecutivos)
                flux = np.sum(np.maximum(0, spectrum - spectrum_prev))
                spectral_flux.append(flux)
            
            spectrum_prev = spectrum.copy()
        
        if not spectral_flux:
            # Fallback: usar posición típica del chorus (40-50% del track)
            start = int(len(audio) * 0.4)
            end = min(start + 30 * self.sample_rate, len(audio))
            return start, end
        
        # Suavizar flux
        spectral_flux = np.array(spectral_flux)
        window_size = 43  # ~0.5 segundos a 44100Hz con hop 512
        spectral_flux_smooth = np.convolve(spectral_flux, 
                                          np.ones(window_size)/window_size, 
                                          mode='same')
        
        # Buscar picos que indican secciones de alta energía (probable chorus)
        mean_flux = np.mean(spectral_flux_smooth)
        std_flux = np.std(spectral_flux_smooth)
        threshold = mean_flux + 0.5 * std_flux
        
        # Encontrar regiones por encima del threshold
        high_energy_regions = spectral_flux_smooth > threshold
        
        # Buscar la región continua más larga (probable chorus)
        regions = []
        start_idx = None
        
        for i, is_high in enumerate(high_energy_regions):
            if is_high and start_idx is None:
                start_idx = i
            elif not is_high and start_idx is not None:
                regions.append((start_idx, i))
                start_idx = None
        
        if start_idx is not None:
            regions.append((start_idx, len(high_energy_regions)))
        
        if not regions:
            # No se encontraron regiones claras, usar posición típica
            start = int(len(audio) * 0.4)
            end = min(start + 30 * self.sample_rate, len(audio))
            return start, end
        
        # Seleccionar la región más larga o la que esté en posición típica de chorus
        # Los chorus suelen estar entre 30-70% del track
        ideal_position = len(spectral_flux) * 0.5
        
        best_region = None
        best_score = -1
        
        for start_idx, end_idx in regions:
            length = end_idx - start_idx
            center = (start_idx + end_idx) / 2
            
            # Score basado en longitud y proximidad a posición ideal
            position_score = 1.0 - abs(center - ideal_position) / len(spectral_flux)
            length_score = length / len(spectral_flux)
            score = position_score * 0.6 + length_score * 0.4
            
            if score > best_score:
                best_score = score
                best_region = (start_idx, end_idx)
        
        if best_region:
            # Convertir índices de flux a samples
            start_sample = best_region[0] * hop_size
            end_sample = min(best_region[1] * hop_size, len(audio))
            
            # Asegurar que tenemos al menos 30 segundos
            if end_sample - start_sample < 30 * self.sample_rate:
                # Extender la ventana
                center = (start_sample + end_sample) // 2
                start_sample = max(0, center - 15 * self.sample_rate)
                end_sample = min(len(audio), start_sample + 30 * self.sample_rate)
            
            return start_sample, end_sample
        
        # Fallback final
        start = int(len(audio) * 0.4)
        end = min(start + 30 * self.sample_rate, len(audio))
        return start, end
    
    def extract_windows(self, audio: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Extrae las ventanas de audio según la estrategia Smart60
        
        Returns:
            Dict con las ventanas extraídas
        """
        
        windows = {}
        duration = len(audio) / self.sample_rate
        
        # Validar duración mínima
        if duration < 60:
            # Si el track es muy corto, usar todo el audio
            print(f"⚠️ Track corto ({duration:.1f}s), usando audio completo")
            return {'full': audio}
        
        # 1. Start30 - Primeros 30 segundos
        start30_samples = min(30 * self.sample_rate, len(audio))
        windows['start30'] = audio[:start30_samples]
        
        # 2. Chorus30 - Detectar y extraer chorus
        chorus_start, chorus_end = self.detect_chorus(audio)
        
        # Limitar a 30 segundos
        max_chorus_samples = 30 * self.sample_rate
        if chorus_end - chorus_start > max_chorus_samples:
            chorus_end = chorus_start + max_chorus_samples
        
        windows['chorus30'] = audio[chorus_start:chorus_end]
        
        # 3. End20 - Últimos 20 segundos
        end20_samples = min(20 * self.sample_rate, len(audio))
        windows['end20'] = audio[-end20_samples:]
        
        return windows
    
    def aggregate_features(self, features_by_window: Dict[str, Dict]) -> Dict[str, Any]:
        """
        Agrega características de múltiples ventanas según estrategia por métrica
        
        Args:
            features_by_window: Dict con features por ventana
            
        Returns:
            Dict con features agregadas
        """
        
        aggregated = {}
        
        # Recopilar valores por métrica
        metrics_values = {}
        for window_name, features in features_by_window.items():
            for metric, value in features.items():
                if metric not in metrics_values:
                    metrics_values[metric] = []
                if value is not None:
                    metrics_values[metric].append(value)
        
        # Aplicar estrategia de agregación por métrica
        for metric, values in metrics_values.items():
            if not values:
                aggregated[metric] = None
                continue
            
            strategy = self.aggregation_strategies.get(metric, 'mean')
            
            if strategy == 'max':
                aggregated[metric] = max(values)
            elif strategy == 'min':
                aggregated[metric] = min(values)
            elif strategy == 'mean':
                aggregated[metric] = np.mean(values)
            elif strategy == 'median':
                aggregated[metric] = np.median(values)
            elif strategy == 'weighted_mean':
                # Dar más peso al chorus
                weights = []
                for window_name in features_by_window.keys():
                    if 'chorus' in window_name:
                        weights.append(0.5)  # 50% peso al chorus
                    elif 'start' in window_name:
                        weights.append(0.3)  # 30% al inicio
                    else:
                        weights.append(0.2)  # 20% al final
                
                if len(weights) == len(values):
                    aggregated[metric] = np.average(values, weights=weights)
                else:
                    aggregated[metric] = np.mean(values)
                    
            elif strategy == 'percentile_75':
                aggregated[metric] = np.percentile(values, 75)
            elif strategy == 'mode':
                # Para valores discretos como BPM o key
                if isinstance(values[0], str):
                    # Para strings (key)
                    from collections import Counter
                    counter = Counter(values)
                    aggregated[metric] = counter.most_common(1)[0][0]
                else:
                    # Para números (BPM)
                    aggregated[metric] = round(np.median(values))
            else:
                # Default: mean
                aggregated[metric] = np.mean(values)
        
        # Redondear valores numéricos
        for metric in ['loudness', 'danceability', 'acousticness', 
                      'instrumentalness', 'liveness', 'speechiness', 
                      'valence', 'energy']:
            if metric in aggregated and aggregated[metric] is not None:
                aggregated[metric] = round(aggregated[metric], 3)
        
        return aggregated
    
    def calibrate_loudness(self, loudness_partial: float, window_type: str) -> float:
        """
        Calibra LUFS basado en ventana parcial
        
        Args:
            loudness_partial: LUFS calculado de ventana parcial
            window_type: Tipo de ventana usada
            
        Returns:
            LUFS calibrado
        """
        
        # Factores de calibración empíricos
        calibration_factors = {
            'start30': -1.5,   # El inicio suele ser más suave
            'chorus30': +0.5,  # El chorus suele ser más fuerte
            'end20': -0.8,     # El final puede variar
            'smart60': 0.0     # Ya está balanceado
        }
        
        factor = calibration_factors.get(window_type, 0.0)
        calibrated = loudness_partial + factor
        
        # Limitar a rango válido
        return max(-60, min(0, calibrated))
    
    def process_file(self, file_path: str, strategy: str = 'smart60') -> Dict[str, Any]:
        """
        Procesa archivo con estrategia Smart60 o alternativas
        
        Args:
            file_path: Ruta al archivo
            strategy: 'smart60', 'first60', 'full', o 'hybrid'
            
        Returns:
            Dict con análisis completo
        """
        
        result = {
            'file_path': file_path,
            'file_name': Path(file_path).name,
            'strategy': strategy,
            'windows_used': [],
            'status': 'processing',
            'metadata': {},
            'essentia_features': {},
            'comparison': {},
            'errors': []
        }
        
        # Leer metadata
        try:
            metadata = self.metadata_reader.read_all_metadata(file_path)
            result['metadata'] = metadata
            
            # Extraer datos MIK
            mik_bpm = metadata.get('bpm')
            mik_key = metadata.get('key')
            mik_energy = metadata.get('energy')
            
            # Normalizar energy si es necesario
            if mik_energy and mik_energy > 1:
                mik_energy = mik_energy / 10.0
                
        except Exception as e:
            result['errors'].append(f"Error leyendo metadata: {str(e)}")
            metadata = {}
            mik_bpm = None
            mik_key = None
            mik_energy = None
        
        # Cargar audio
        try:
            # Restaurar stderr temporalmente para mensajes
            sys.stderr = sys.__stderr__
            print(f"\n🎵 Cargando audio con estrategia: {strategy}")
            sys.stderr = io.StringIO()
            
            audio = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)()
            
            if len(audio) == 0:
                raise ValueError("Audio vacío")
            
            duration = len(audio) / self.sample_rate
            result['metadata']['duration_seconds'] = round(duration, 2)
            
        except Exception as e:
            result['status'] = 'error'
            result['errors'].append(f"Error cargando audio: {str(e)}")
            return result
        
        # Aplicar estrategia
        try:
            if strategy == 'full':
                # Procesamiento completo tradicional
                features = self.full_processor.calculate_seven_features(
                    audio, mik_bpm, mik_key, mik_energy
                )
                result['essentia_features'] = features
                result['windows_used'] = ['full']
                
            elif strategy == 'first60':
                # Solo primeros 60 segundos
                first60_samples = min(60 * self.sample_rate, len(audio))
                audio_first60 = audio[:first60_samples]
                
                features = self.full_processor.calculate_seven_features(
                    audio_first60, mik_bpm, mik_key, mik_energy
                )
                
                # Aplicar calibración
                if 'loudness' in features:
                    features['loudness'] = self.calibrate_loudness(
                        features['loudness'], 'start30'
                    )
                
                result['essentia_features'] = features
                result['windows_used'] = ['first60']
                
            elif strategy == 'smart60':
                # Estrategia Smart60
                sys.stderr = sys.__stderr__
                print(f"  • Extrayendo ventanas inteligentes...")
                sys.stderr = io.StringIO()
                
                # Extraer ventanas
                windows = self.extract_windows(audio)
                result['windows_used'] = list(windows.keys())
                
                # Calcular features por ventana
                features_by_window = {}
                
                for window_name, window_audio in windows.items():
                    sys.stderr = sys.__stderr__
                    print(f"  • Procesando {window_name} ({len(window_audio)/self.sample_rate:.1f}s)")
                    sys.stderr = io.StringIO()
                    
                    window_features = self.full_processor.calculate_seven_features(
                        window_audio, mik_bpm, mik_key, mik_energy
                    )
                    features_by_window[window_name] = window_features
                
                # Agregar features
                sys.stderr = sys.__stderr__
                print(f"  • Agregando características...")
                sys.stderr = io.StringIO()
                
                aggregated_features = self.aggregate_features(features_by_window)
                
                # Calibrar LUFS
                if 'loudness' in aggregated_features:
                    aggregated_features['loudness'] = self.calibrate_loudness(
                        aggregated_features['loudness'], 'smart60'
                    )
                
                result['essentia_features'] = aggregated_features
                result['features_by_window'] = features_by_window
                
            elif strategy == 'hybrid':
                # Combinar smart60 con validación full (para comparación)
                sys.stderr = sys.__stderr__
                print(f"  • Modo híbrido: Smart60 + Full")
                sys.stderr = io.StringIO()
                
                # Primero Smart60
                windows = self.extract_windows(audio)
                result['windows_used'] = list(windows.keys())
                
                features_by_window = {}
                for window_name, window_audio in windows.items():
                    window_features = self.full_processor.calculate_seven_features(
                        window_audio, mik_bpm, mik_key, mik_energy
                    )
                    features_by_window[window_name] = window_features
                
                smart60_features = self.aggregate_features(features_by_window)
                
                # Calibrar LUFS
                if 'loudness' in smart60_features:
                    smart60_features['loudness'] = self.calibrate_loudness(
                        smart60_features['loudness'], 'smart60'
                    )
                
                # Luego Full para comparación
                full_features = self.full_processor.calculate_seven_features(
                    audio, mik_bpm, mik_key, mik_energy
                )
                
                # Comparar resultados
                comparison = {}
                for metric in smart60_features.keys():
                    if metric in full_features:
                        smart_val = smart60_features[metric]
                        full_val = full_features[metric]
                        
                        if isinstance(smart_val, (int, float)) and isinstance(full_val, (int, float)):
                            diff = abs(smart_val - full_val)
                            diff_pct = (diff / abs(full_val) * 100) if full_val != 0 else 0
                            comparison[metric] = {
                                'smart60': smart_val,
                                'full': full_val,
                                'difference': round(diff, 3),
                                'difference_pct': round(diff_pct, 1)
                            }
                
                result['essentia_features'] = smart60_features
                result['comparison'] = comparison
                result['full_features'] = full_features
                
            else:
                raise ValueError(f"Estrategia no válida: {strategy}")
            
            result['status'] = 'success'
            
            # Mostrar resultados
            sys.stderr = sys.__stderr__
            print(f"\n✅ Análisis completado:")
            for key, value in result['essentia_features'].items():
                if isinstance(value, float):
                    print(f"  • {key}: {value:.3f}")
                else:
                    print(f"  • {key}: {value}")
            
            if result.get('comparison'):
                print(f"\n📊 Comparación Smart60 vs Full:")
                for metric, comp in result['comparison'].items():
                    print(f"  • {metric}: {comp['smart60']:.3f} vs {comp['full']:.3f} (diff: {comp['difference_pct']:.1f}%)")
            
            sys.stderr = io.StringIO()
            
        except Exception as e:
            result['status'] = 'error'
            result['errors'].append(f"Error en análisis: {str(e)}")
        
        return result
    
    def benchmark_strategies(self, file_path: str) -> Dict[str, Any]:
        """
        Compara todas las estrategias de extracción
        
        Returns:
            Dict con comparación de todas las estrategias
        """
        
        import time
        
        sys.stderr = sys.__stderr__
        print(f"\n{'='*70}")
        print(f"🔬 BENCHMARK DE ESTRATEGIAS")
        print(f"{'='*70}")
        print(f"📁 Archivo: {Path(file_path).name}")
        print(f"{'='*70}")
        
        strategies = ['full', 'first60', 'smart60']
        results = {}
        
        for strategy in strategies:
            print(f"\n📊 Estrategia: {strategy}")
            print("-"*50)
            
            start_time = time.time()
            result = self.process_file(file_path, strategy)
            elapsed = time.time() - start_time
            
            result['processing_time'] = round(elapsed, 2)
            results[strategy] = result
            
            print(f"⏱️ Tiempo: {elapsed:.2f}s")
        
        # Comparar resultados
        print(f"\n{'='*70}")
        print(f"📈 COMPARACIÓN DE RESULTADOS")
        print(f"{'='*70}")
        
        # Usar 'full' como referencia
        reference = results['full']['essentia_features']
        
        comparison_table = []
        for metric in reference.keys():
            if isinstance(reference[metric], (int, float)):
                row = {'metric': metric, 'full': reference[metric]}
                
                for strategy in ['first60', 'smart60']:
                    value = results[strategy]['essentia_features'].get(metric)
                    if value is not None:
                        row[strategy] = value
                        diff = abs(value - reference[metric])
                        diff_pct = (diff / abs(reference[metric]) * 100) if reference[metric] != 0 else 0
                        row[f'{strategy}_diff%'] = round(diff_pct, 1)
                
                comparison_table.append(row)
        
        # Mostrar tabla
        print(f"\n{'Métrica':<20} {'Full':<10} {'First60':<10} {'Diff%':<8} {'Smart60':<10} {'Diff%':<8}")
        print("-"*76)
        
        for row in comparison_table:
            metric = row['metric']
            full_val = f"{row['full']:.3f}" if isinstance(row['full'], float) else str(row['full'])
            
            first60_val = f"{row.get('first60', 0):.3f}" if 'first60' in row else 'N/A'
            first60_diff = f"{row.get('first60_diff%', 0):.1f}%" if 'first60_diff%' in row else 'N/A'
            
            smart60_val = f"{row.get('smart60', 0):.3f}" if 'smart60' in row else 'N/A'
            smart60_diff = f"{row.get('smart60_diff%', 0):.1f}%" if 'smart60_diff%' in row else 'N/A'
            
            print(f"{metric:<20} {full_val:<10} {first60_val:<10} {first60_diff:<8} {smart60_val:<10} {smart60_diff:<8}")
        
        # Comparar tiempos
        print(f"\n⏱️ TIEMPOS DE PROCESAMIENTO:")
        print("-"*40)
        for strategy, result in results.items():
            time_str = f"{result['processing_time']:.2f}s"
            speedup = results['full']['processing_time'] / result['processing_time']
            print(f"  • {strategy:<10}: {time_str:<8} (speedup: {speedup:.1f}x)")
        
        # Calcular accuracy promedio
        print(f"\n📊 ACCURACY PROMEDIO (vs Full):")
        print("-"*40)
        
        for strategy in ['first60', 'smart60']:
            diffs = []
            for row in comparison_table:
                if f'{strategy}_diff%' in row:
                    diffs.append(row[f'{strategy}_diff%'])
            
            if diffs:
                avg_diff = np.mean(diffs)
                accuracy = 100 - avg_diff
                print(f"  • {strategy:<10}: {accuracy:.1f}% accuracy")
        
        return results


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Essentia Smart60 - Extracción inteligente')
    parser.add_argument('file', nargs='?',
                       default="/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/pruebas/2 Unlimited - No Limit (Extended Mix).flac",
                       help='Archivo a procesar')
    parser.add_argument('--strategy', default='smart60',
                       choices=['full', 'first60', 'smart60', 'hybrid', 'benchmark'],
                       help='Estrategia de extracción')
    parser.add_argument('--output', help='Archivo de salida para resultados')
    
    args = parser.parse_args()
    
    # Crear analizador
    analyzer = Smart60Analyzer()
    
    try:
        if args.strategy == 'benchmark':
            # Comparar todas las estrategias
            results = analyzer.benchmark_strategies(args.file)
            
            # Guardar resultados si se especificó
            if args.output:
                output_file = args.output
            else:
                output_file = f"smart60_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            
            print(f"\n💾 Resultados guardados en: {output_file}")
            
        else:
            # Procesar con estrategia específica
            result = analyzer.process_file(args.file, args.strategy)
            
            # Guardar resultado
            if args.output:
                output_file = args.output
            else:
                output_file = f"smart60_{args.strategy}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            
            print(f"\n💾 Resultado guardado en: {output_file}")
            
    finally:
        # Asegurar que stderr esté restaurado
        sys.stderr = sys.__stderr__


if __name__ == "__main__":
    try:
        main()
    finally:
        sys.stderr = sys.__stderr__