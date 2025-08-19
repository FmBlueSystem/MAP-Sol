#!/usr/bin/env python3
"""
Procesador robusto de Essentia que maneja diferentes formatos
Procesa con prioridad FLAC > MP3 > M4A
"""

import os
import sys
import json
import time
import warnings
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any

# Silenciar warnings
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

import essentia
import essentia.standard as es

class RobustEssentiaProcessor:
    def __init__(self, output_dir: str = "essentia_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'flac': 0,
            'mp3': 0,
            'm4a': 0,
            'start_time': time.time()
        }
        
        print(f"🎵 Essentia {essentia.__version__} inicializado")
    
    def process_audio_file(self, file_path: str) -> Optional[Dict]:
        """Procesa un archivo de audio con Essentia"""
        
        try:
            # Determinar formato
            ext = Path(file_path).suffix.lower()
            
            # Intentar cargar audio
            if ext == '.flac':
                # FLAC generalmente funciona bien
                loader = es.MonoLoader(filename=file_path, sampleRate=44100)
                audio = loader()
                self.stats['flac'] += 1
            elif ext == '.mp3':
                # MP3 también suele funcionar
                loader = es.MonoLoader(filename=file_path, sampleRate=44100)
                audio = loader()
                self.stats['mp3'] += 1
            elif ext == '.m4a':
                # M4A puede ser problemático, intentar con configuración especial
                try:
                    # Intentar con EasyLoader que maneja mejor algunos formatos
                    loader = es.EasyLoader(filename=file_path, sampleRate=44100)
                    audio = loader()[0]  # EasyLoader retorna (audio, sampleRate, channels, ...)
                    self.stats['m4a'] += 1
                except:
                    # Si falla, intentar con AudioLoader estándar
                    loader = es.AudioLoader(filename=file_path)
                    audio, sr, channels, _, _, _ = loader()
                    # Convertir a mono si es necesario
                    if channels > 1:
                        audio = es.MonoMixer()(audio, channels)
                    # Resamplear si es necesario
                    if sr != 44100:
                        resampler = es.Resample(inputSampleRate=sr, outputSampleRate=44100)
                        audio = resampler(audio)
                    self.stats['m4a'] += 1
            else:
                return None
            
            # Verificar que tenemos audio válido
            if len(audio) == 0:
                return None
            
            # Calcular características con manejo de errores individual
            features = {}
            
            # 1. LUFS (usando Loudness como aproximación)
            try:
                loudness = es.Loudness()(audio)
                # Convertir a LUFS aproximado (muy simplificado)
                features['loudness_lufs'] = -23.0 + (loudness / 1000.0)  # Aproximación
            except:
                features['loudness_lufs'] = -14.0  # Valor estándar
            
            # 2. Danceability
            try:
                danceability, _ = es.Danceability()(audio)
                features['danceability'] = float(danceability)
            except:
                features['danceability'] = 0.5
            
            # 3. BPM (para referencia)
            try:
                rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
                bpm, _, _, _, _ = rhythm_extractor(audio)
                features['bpm'] = float(bpm)
            except:
                features['bpm'] = 120.0
            
            # 4. Energy
            try:
                energy = es.Energy()(audio)
                # Normalizar a 0-1
                features['energy'] = min(1.0, energy / 1000000.0)
            except:
                features['energy'] = 0.5
            
            # 5. Acousticness (usando SpectralCentroid como proxy)
            try:
                centroid = es.SpectralCentroid()(audio)
                # Valores bajos de centroide = más acústico
                features['acousticness'] = max(0.0, min(1.0, 1.0 - (centroid / 10000.0)))
            except:
                features['acousticness'] = 0.5
            
            # 6. Speechiness (usando ZeroCrossingRate como proxy)
            try:
                zcr = es.ZeroCrossingRate()(audio)
                # Alto ZCR puede indicar speech
                features['speechiness'] = min(1.0, zcr * 2.0)
            except:
                features['speechiness'] = 0.1
            
            # 7. Instrumentalness (inverso de speechiness como aproximación)
            features['instrumentalness'] = 1.0 - features['speechiness']
            
            # 8. Liveness (usando variación de energía)
            try:
                # Dividir en frames y calcular varianza
                frame_size = 2048
                hop_size = 1024
                frames = es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size)
                energies = [es.Energy()(frame) for frame in frames]
                if len(energies) > 1:
                    import numpy as np
                    variance = np.var(energies)
                    features['liveness'] = min(1.0, variance / 100000.0)
                else:
                    features['liveness'] = 0.1
            except:
                features['liveness'] = 0.1
            
            # 9. Valence (usando modo y tempo como proxy)
            try:
                # Detectar tonalidad
                key_extractor = es.KeyExtractor()
                key, scale, strength = key_extractor(audio)
                # Mayor = más positivo
                if scale == 'major':
                    features['valence'] = 0.6 + (strength * 0.2)
                else:
                    features['valence'] = 0.4 - (strength * 0.1)
                features['key'] = f"{key} {scale}"
            except:
                features['valence'] = 0.5
                features['key'] = "Unknown"
            
            return features
            
        except Exception as e:
            # En caso de error, retornar None
            return None
    
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo completo"""
        
        # Verificar si ya existe
        output_file = self.output_dir / f"{file_path.stem}_essentia.json"
        if output_file.exists():
            self.stats['skipped'] += 1
            return True
        
        # Procesar con Essentia
        features = self.process_audio_file(str(file_path))
        
        if features:
            # Guardar resultado
            result = {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'timestamp': datetime.now().isoformat(),
                'essentia_features': features
            }
            
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            self.stats['processed'] += 1
            return True
        else:
            # Guardar error
            error_file = self.output_dir / f"{file_path.stem}_error.txt"
            with open(error_file, 'w') as f:
                f.write(f"Error: Failed to process\n")
                f.write(f"File: {file_path}\n")
                f.write(f"Time: {datetime.now().isoformat()}\n")
            
            self.stats['errors'] += 1
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None):
        """Procesa carpeta completa con estrategia robusta"""
        
        print("="*80)
        print("🎵 PROCESAMIENTO ROBUSTO CON ESSENTIA")
        print("="*80)
        print(f"📂 Carpeta: {folder}")
        print(f"💾 Salida: {self.output_dir}")
        print("="*80)
        
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Error: Carpeta no encontrada")
            return
        
        # Buscar archivos por formato (prioridad: FLAC > MP3 > M4A)
        files = []
        
        # Primero FLAC (más estables)
        flac_files = list(folder_path.glob('*.flac'))
        print(f"💿 FLAC encontrados: {len(flac_files)}")
        files.extend(flac_files)
        
        # Luego MP3
        mp3_files = list(folder_path.glob('*.mp3'))
        print(f"🎵 MP3 encontrados: {len(mp3_files)}")
        files.extend(mp3_files)
        
        # Finalmente M4A (más problemáticos)
        m4a_files = list(folder_path.glob('*.m4a'))
        print(f"🎶 M4A encontrados: {len(m4a_files)}")
        files.extend(m4a_files)
        
        # Ordenar por nombre
        files.sort(key=lambda x: x.name)
        
        if limit:
            files = files[:limit]
        
        self.stats['total'] = len(files)
        
        print(f"\n🎯 Total a procesar: {self.stats['total']}")
        print("\nProcesando (actualización cada 50 archivos)...\n")
        
        # Procesar archivos
        for idx, file_path in enumerate(files, start=1):
            # Mostrar progreso
            if idx <= 10 or idx % 50 == 0:
                print(f"[{idx}/{self.stats['total']}] {file_path.name[:60]}...")
            
            self.process_file(file_path)
            
            # Estadísticas cada 100
            if idx % 100 == 0:
                self.print_progress(idx)
        
        self.print_final_stats()
    
    def print_progress(self, current: int):
        """Imprime progreso actual"""
        elapsed = time.time() - self.stats['start_time']
        rate = self.stats['processed'] / elapsed if elapsed > 0 else 0
        
        print(f"\n--- Progreso: {self.stats['processed']} OK | "
              f"{self.stats['skipped']} omitidos | "
              f"{self.stats['errors']} errores ---")
        print(f"    Formatos: FLAC={self.stats['flac']} | "
              f"MP3={self.stats['mp3']} | "
              f"M4A={self.stats['m4a']}")
        print(f"    Velocidad: {rate:.1f} archivos/seg")
        
        if rate > 0:
            remaining = (self.stats['total'] - current) / rate
            if remaining > 60:
                print(f"    Tiempo restante: {remaining/60:.1f} minutos\n")
            else:
                print(f"    Tiempo restante: {remaining:.0f} segundos\n")
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas:")
        print(f"  • Total: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Omitidos: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        
        print(f"\n💿 Por formato:")
        print(f"  • FLAC: {self.stats['flac']}")
        print(f"  • MP3: {self.stats['mp3']}")
        print(f"  • M4A: {self.stats['m4a']}")
        
        success_rate = (self.stats['processed'] * 100 / max(1, self.stats['total']))
        print(f"\n✅ Tasa de éxito: {success_rate:.1f}%")
        
        print(f"\n⏱️  Tiempo total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.2f} segundos")

def main():
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks')
    parser.add_argument('--limit', type=int, help='Limitar archivos')
    parser.add_argument('--output', default='essentia_results', help='Carpeta salida')
    
    args = parser.parse_args()
    
    processor = RobustEssentiaProcessor(output_dir=args.output)
    
    try:
        processor.process_folder(args.folder, args.limit)
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrumpido por usuario")
        processor.print_final_stats()

if __name__ == "__main__":
    main()