#!/usr/bin/env python3
"""
Test simple de Essentia con archivo de prueba
Music Analyzer Pro - Prueba con archivo local
"""

import os
import essentia
import essentia.standard as es
import numpy as np
import requests
from pathlib import Path

def download_test_file():
    """Descarga un archivo de prueba si no existe"""
    test_file = "test_audio.mp3"
    
    if not os.path.exists(test_file):
        print("📥 Descargando archivo de prueba...")
        # Archivo de prueba libre de derechos
        url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            with open(test_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✅ Archivo descargado: {test_file}")
        except Exception as e:
            print(f"❌ Error descargando archivo: {e}")
            return None
    else:
        print(f"✅ Usando archivo existente: {test_file}")
    
    return test_file

def analyze_audio_file(file_path):
    """Análisis completo de un archivo de audio con Essentia"""
    
    print(f"\n{'='*70}")
    print(f"🎵 ANÁLISIS COMPLETO CON ESSENTIA")
    print(f"📁 Archivo: {Path(file_path).name}")
    print(f"{'='*70}")
    
    try:
        # Cargar el audio
        print("\n⏳ Cargando audio...")
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        
        # Información básica
        duration = len(audio) / 44100.0
        print(f"\n📊 INFORMACIÓN BÁSICA:")
        print(f"  • Duración: {duration:.2f} segundos ({duration/60:.2f} minutos)")
        print(f"  • Muestras: {len(audio):,}")
        print(f"  • Sample Rate: 44,100 Hz")
        
        # 1. ANÁLISIS DE RITMO
        print("\n🥁 ANÁLISIS DE RITMO:")
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
        
        print(f"  • BPM: {bpm:.1f}")
        print(f"  • Confianza del BPM: {beats_confidence:.2%}")
        print(f"  • Beats detectados: {len(beats)}")
        
        # Tempo stability
        if len(beats_intervals) > 1:
            tempo_stability = 1.0 - np.std(beats_intervals) / np.mean(beats_intervals)
            print(f"  • Estabilidad del tempo: {tempo_stability:.2%}")
        
        # 2. ANÁLISIS TONAL
        print("\n🎹 ANÁLISIS TONAL:")
        key_extractor = es.KeyExtractor()
        key, scale, key_strength = key_extractor(audio)
        
        print(f"  • Tonalidad: {key} {scale}")
        print(f"  • Fuerza tonal: {key_strength:.2%}")
        
        # Tuning frequency (necesario para chord detection)
        tuning_freq = 440.0
        print(f"  • Frecuencia de afinación: {tuning_freq} Hz")
        
        # 3. ANÁLISIS DE ENERGÍA Y DINÁMICA
        print("\n⚡ ANÁLISIS DE ENERGÍA Y DINÁMICA:")
        
        # Energía
        energy = es.Energy()(audio)
        print(f"  • Energía total: {energy:.6f}")
        
        # RMS
        rms = es.RMS()(audio)
        print(f"  • RMS: {rms:.6f}")
        
        # Loudness
        loudness_extractor = es.LoudnessEBUR128(startAtZero=True)
        _, _, integrated_loudness, loudness_range = loudness_extractor(audio)
        print(f"  • Loudness integrado (LUFS): {integrated_loudness:.2f}")
        print(f"  • Rango dinámico (LU): {loudness_range:.2f}")
        
        # Dynamic complexity
        dynamic_complexity = es.DynamicComplexity()(audio)
        print(f"  • Complejidad dinámica: {dynamic_complexity:.4f}")
        
        # 4. ANÁLISIS ESPECTRAL
        print("\n🌈 ANÁLISIS ESPECTRAL:")
        
        # Calcular espectro para un frame
        spectrum = es.Spectrum()(audio[:2048])
        
        # Centroide espectral
        centroid = es.Centroid()(spectrum)
        print(f"  • Centroide espectral: {centroid:.2f} Hz")
        
        # Spectral contrast
        spectral_contrast = es.SpectralContrast()(spectrum)
        print(f"  • Contraste espectral medio: {np.mean(spectral_contrast):.4f}")
        
        # Spectral complexity
        spectral_complexity = es.SpectralComplexity()(spectrum)
        print(f"  • Complejidad espectral: {spectral_complexity:.4f}")
        
        # Zero Crossing Rate
        zcr = es.ZeroCrossingRate()(audio[:2048])
        print(f"  • Zero Crossing Rate: {zcr:.4f}")
        
        # 5. ANÁLISIS DE TIMBRE
        print("\n🎨 ANÁLISIS DE TIMBRE:")
        
        # MFCC
        mfcc = es.MFCC(numberCoefficients=13)(spectrum)
        print(f"  • MFCCs (primeros 4): [{', '.join([f'{x:.2f}' for x in mfcc[1][:4]])}]")
        
        # Dissonance
        spectral_peaks = es.SpectralPeaks()(spectrum)
        dissonance = es.Dissonance()(spectral_peaks[0], spectral_peaks[1])
        print(f"  • Disonancia: {dissonance:.4f}")
        
        # 6. ANÁLISIS DE CARACTERÍSTICAS MUSICALES
        print("\n🎼 CARACTERÍSTICAS MUSICALES:")
        
        # Danceability
        danceability = es.Danceability()(audio)
        print(f"  • Danceability: {danceability:.2%}")
        
        # Onset detection
        onset_extractor = es.OnsetRate()
        onset_rate = onset_extractor(audio)
        print(f"  • Tasa de onsets: {onset_rate[0]:.2f} Hz")
        print(f"  • Total de onsets: {onset_rate[1]}")
        
        # 7. CLASIFICACIÓN DE MOOD
        print("\n😊 ANÁLISIS DE MOOD:")
        
        # Características para mood
        arousal = (bpm / 200.0) * 0.3 + (energy * 10) * 0.3 + (centroid / 5000.0) * 0.4
        valence = 0.6 if scale == "major" else 0.4
        
        if arousal > 0.6:
            if valence > 0.5:
                mood = "Happy/Energetic"
            else:
                mood = "Angry/Aggressive"
        else:
            if valence > 0.5:
                mood = "Relaxed/Peaceful"
            else:
                mood = "Sad/Melancholic"
        
        print(f"  • Arousal: {arousal:.2%}")
        print(f"  • Valence: {valence:.2%}")
        print(f"  • Mood estimado: {mood}")
        
        # 8. RESUMEN FINAL
        print("\n" + "="*70)
        print("📋 RESUMEN EJECUTIVO:")
        print("="*70)
        print(f"  🎵 BPM: {bpm:.0f} | Tonalidad: {key} {scale}")
        print(f"  ⚡ Energía: {'Alta' if energy > 0.05 else 'Media' if energy > 0.01 else 'Baja'}")
        print(f"  💃 Danceability: {danceability:.0%}")
        print(f"  😊 Mood: {mood}")
        print(f"  📊 Loudness: {integrated_loudness:.1f} LUFS")
        print(f"  🎨 Complejidad: {'Alta' if dynamic_complexity > 0.5 else 'Media' if dynamic_complexity > 0.2 else 'Baja'}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante el análisis: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*70)
    print("🎵 ESSENTIA TEST - MUSIC ANALYZER PRO 🎵")
    print("="*70)
    print("\n📌 Este test analiza un archivo de audio con Essentia")
    print("📌 Se extraerán características musicales y técnicas")
    
    # Obtener archivo de prueba
    test_file = download_test_file()
    
    if test_file and os.path.exists(test_file):
        # Analizar archivo
        success = analyze_audio_file(test_file)
        
        if success:
            print("\n✅ Análisis completado exitosamente!")
            print("\n💡 Essentia está funcionando correctamente en tu ambiente virtual")
            print("💡 Puedes usar estas funciones para analizar tu biblioteca musical")
    else:
        print("\n❌ No se pudo obtener archivo de prueba")
        print("💡 Puedes probar con cualquier archivo MP3 local:")
        print("   python test_essentia_simple.py tu_archivo.mp3")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Si se proporciona un archivo como argumento
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            analyze_audio_file(file_path)
        else:
            print(f"❌ Archivo no encontrado: {file_path}")
    else:
        # Ejecutar con archivo de prueba
        main()