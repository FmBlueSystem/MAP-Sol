#!/usr/bin/env python3
"""
Procesador de Essentia optimizado para archivos FLAC
Procesa solo archivos FLAC que funcionan bien con Essentia
"""

import os
import sys
import json
import time
import warnings
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

# Silenciar completamente
warnings.filterwarnings('ignore')
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'
import logging
logging.getLogger().setLevel(logging.ERROR)

# Redirigir stderr
class DevNull:
    def write(self, msg):
        pass
    def flush(self):
        pass

sys.stderr = DevNull()

import essentia
import essentia.standard as es

class FLACEssentiaProcessor:
    def __init__(self, output_dir: str = "essentia_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.stats = {
            'total': 0,
            'processed': 0,
            'errors': 0,
            'skipped': 0,
            'start_time': time.time()
        }
        
        # Restaurar stderr para mensajes importantes
        sys.stderr = sys.__stderr__
        print(f"🎵 Essentia {essentia.__version__} listo para FLAC")
        sys.stderr = DevNull()
    
    def calculate_essentia_features(self, file_path: str) -> Optional[Dict]:
        """Calcula las 7 características de Essentia"""
        try:
            # Cargar audio
            loader = es.MonoLoader(filename=file_path, sampleRate=44100)
            audio = loader()
            
            if len(audio) == 0:
                return None
            
            features = {}
            
            # 1. LUFS integrado (aproximación usando ReplayGain)
            try:
                replay_gain = es.ReplayGain()(audio)
                # Convertir a LUFS (aproximación)
                features['loudness_lufs'] = -18.0 - replay_gain
            except:
                features['loudness_lufs'] = -14.0
            
            # 2. Danceability
            try:
                danceability, _ = es.Danceability()(audio)
                features['danceability'] = float(danceability)
            except:
                features['danceability'] = 0.5
            
            # 3. Acousticness (usando dissonancia y centroide espectral)
            try:
                spectrum = es.Spectrum()(audio)
                centroid = es.SpectralCentroid()(spectrum)
                dissonance = es.Dissonance()(spectrum)
                # Menor centroide y menor disonancia = más acústico
                features['acousticness'] = max(0, min(1, 1.0 - (centroid/5000.0 + dissonance)))
            except:
                features['acousticness'] = 0.5
            
            # 4. Instrumentalness (usando pitch salience)
            try:
                pitch_salience = es.PitchSalience()(spectrum)
                # Baja salience de pitch = más instrumental
                features['instrumentalness'] = max(0, min(1, 1.0 - pitch_salience))
            except:
                features['instrumentalness'] = 0.5
            
            # 5. Liveness (usando onset rate y energía dinámica)
            try:
                onsets = es.OnsetRate()(audio)
                dynamic_complexity = es.DynamicComplexity()(audio)
                features['liveness'] = min(1.0, (onsets[0] + dynamic_complexity) / 20.0)
            except:
                features['liveness'] = 0.1
            
            # 6. Speechiness (usando spectral rolloff y ZCR)
            try:
                zcr = es.ZeroCrossingRate()(audio)
                rolloff = es.RollOff()(spectrum)
                # Alto ZCR y bajo rolloff puede indicar speech
                features['speechiness'] = min(1.0, zcr * 2.0 * (1.0 - rolloff/22050.0))
            except:
                features['speechiness'] = 0.1
            
            # 7. Valence (usando modo, tempo y brillantez)
            try:
                # Detectar tonalidad
                key_extractor = es.KeyExtractor()
                key, scale, strength = key_extractor(audio)
                
                # BPM
                rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
                bpm, _, _, _, _ = rhythm_extractor(audio)
                
                # Brillantez espectral
                spectral_energy = es.EnergyBand(sampleRate=44100, startFrequency=4000, stopFrequency=20000)(spectrum)
                
                # Mayor + tempo rápido + brillante = más positivo
                valence = 0.5
                if scale == 'major':
                    valence += 0.2
                if bpm > 120:
                    valence += 0.1
                if spectral_energy > 0.1:
                    valence += 0.1
                
                features['valence'] = min(1.0, valence)
                features['bpm'] = float(bpm)
                features['key'] = f"{key} {scale}"
                
            except:
                features['valence'] = 0.5
                features['bpm'] = 120.0
                features['key'] = "Unknown"
            
            return features
            
        except Exception as e:
            return None
    
    def process_file(self, file_path: Path) -> bool:
        """Procesa un archivo FLAC"""
        
        # Verificar si ya existe
        output_file = self.output_dir / f"{file_path.stem}_essentia.json"
        if output_file.exists():
            self.stats['skipped'] += 1
            return True
        
        # Procesar
        features = self.calculate_essentia_features(str(file_path))
        
        if features:
            # Guardar resultado
            result = {
                'file_path': str(file_path),
                'file_name': file_path.name,
                'timestamp': datetime.now().isoformat(),
                'essentia_features': features,
                'format': 'FLAC',
                'processing': 'success'
            }
            
            # Usar nombre truncado si es muy largo
            if len(file_path.stem) > 100:
                safe_name = file_path.stem[:100] + "_" + str(hash(file_path.stem))[-8:]
                output_file = self.output_dir / f"{safe_name}_essentia.json"
            
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            self.stats['processed'] += 1
            return True
        else:
            self.stats['errors'] += 1
            return False
    
    def process_folder(self, folder: str, limit: Optional[int] = None):
        """Procesa solo archivos FLAC de la carpeta"""
        
        # Restaurar stderr temporalmente
        sys.stderr = sys.__stderr__
        
        print("="*80)
        print("🎵 PROCESAMIENTO DE ARCHIVOS FLAC CON ESSENTIA")
        print("="*80)
        print(f"📂 Carpeta: {folder}")
        print(f"💾 Salida: {self.output_dir}")
        print("="*80)
        
        folder_path = Path(folder)
        if not folder_path.exists():
            print(f"❌ Error: Carpeta no encontrada")
            return
        
        # Buscar solo archivos FLAC
        flac_files = list(folder_path.glob('*.flac'))
        flac_files.sort(key=lambda x: x.name)
        
        if limit:
            flac_files = flac_files[:limit]
        
        self.stats['total'] = len(flac_files)
        
        print(f"🎿 Archivos FLAC encontrados: {self.stats['total']}")
        print("\nProcesando...\n")
        
        # Volver a silenciar stderr
        sys.stderr = DevNull()
        
        # Procesar archivos
        last_print = 0
        for idx, file_path in enumerate(flac_files, start=1):
            self.process_file(file_path)
            
            # Actualizar progreso cada 1% o cada 50 archivos
            progress = idx * 100 // self.stats['total']
            if progress != last_print or idx % 50 == 0:
                # Restaurar stderr para imprimir
                sys.stderr = sys.__stderr__
                
                elapsed = time.time() - self.stats['start_time']
                rate = self.stats['processed'] / elapsed if elapsed > 0 else 0
                
                print(f"\r[{idx}/{self.stats['total']}] {progress}% | "
                      f"OK: {self.stats['processed']} | "
                      f"Skip: {self.stats['skipped']} | "
                      f"Err: {self.stats['errors']} | "
                      f"{rate:.1f} files/s", end='')
                
                last_print = progress
                
                # Silenciar de nuevo
                sys.stderr = DevNull()
        
        # Restaurar stderr para estadísticas finales
        sys.stderr = sys.__stderr__
        print()  # Nueva línea después del progreso
        self.print_final_stats()
    
    def print_final_stats(self):
        """Imprime estadísticas finales"""
        elapsed = time.time() - self.stats['start_time']
        
        print("\n" + "="*80)
        print("✅ PROCESAMIENTO COMPLETADO")
        print("="*80)
        
        print(f"\n📊 Estadísticas:")
        print(f"  • Total FLAC: {self.stats['total']}")
        print(f"  • Procesados: {self.stats['processed']}")
        print(f"  • Omitidos: {self.stats['skipped']}")
        print(f"  • Errores: {self.stats['errors']}")
        
        success_rate = (self.stats['processed'] * 100 / max(1, self.stats['total']))
        print(f"\n✅ Tasa de éxito: {success_rate:.1f}%")
        
        print(f"\n⏱️  Tiempo:")
        print(f"  • Total: {elapsed/60:.1f} minutos")
        if self.stats['processed'] > 0:
            print(f"  • Por archivo: {elapsed/self.stats['processed']:.2f} segundos")
            print(f"  • Velocidad: {self.stats['processed']*60/elapsed:.1f} archivos/minuto")
        
        # Guardar reporte
        report = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'elapsed_time': elapsed,
            'format': 'FLAC only'
        }
        
        report_file = self.output_dir / f"flac_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n💾 Reporte: {report_file}")
        print(f"📂 Resultados en: {self.output_dir}/")

def main():
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', nargs='?',
                       default='/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks')
    parser.add_argument('--limit', type=int, help='Limitar archivos')
    parser.add_argument('--output', default='essentia_results', help='Carpeta salida')
    
    args = parser.parse_args()
    
    processor = FLACEssentiaProcessor(output_dir=args.output)
    
    try:
        processor.process_folder(args.folder, args.limit)
    except KeyboardInterrupt:
        sys.stderr = sys.__stderr__
        print("\n\n⚠️ Interrumpido por usuario")
        processor.print_final_stats()

if __name__ == "__main__":
    main()