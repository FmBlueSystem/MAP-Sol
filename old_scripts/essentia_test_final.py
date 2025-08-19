#!/usr/bin/env python3
"""
Test robusto de Essentia - Version Final
Music Analyzer Pro
"""

import os
import sys
import essentia
import essentia.standard as es
import numpy as np
from pathlib import Path

def analyze_with_essentia(file_path):
    """Análisis robusto con Essentia - solo funciones probadas"""
    
    print(f"\n{'='*60}")
    print(f"🎵 ANÁLISIS CON ESSENTIA")
    print(f"📁 {Path(file_path).name}")
    print(f"{'='*60}")
    
    try:
        # Cargar audio en mono
        print("\n⏳ Cargando audio...")
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        
        if len(audio) == 0:
            print("❌ El archivo está vacío o no se pudo cargar")
            return None
        
        # Duración
        duration = len(audio) / 44100.0
        print(f"✅ Audio cargado: {duration:.2f} segundos")
        
        results = {}
        
        # 1. BPM y Ritmo
        print("\n🥁 Analizando ritmo...")
        try:
            rhythm = es.RhythmExtractor2013(method="multifeature")
            bpm, beats, confidence, _, intervals = rhythm(audio)
            results['bpm'] = round(bpm, 1)
            results['bpm_confidence'] = round(confidence, 2)
            results['beats_count'] = len(beats)
            print(f"  • BPM: {bpm:.1f} (confianza: {confidence:.0%})")
        except:
            print("  • BPM: No se pudo calcular")
            results['bpm'] = 0
        
        # 2. Tonalidad
        print("\n🎹 Analizando tonalidad...")
        try:
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            results['key'] = f"{key} {scale}"
            results['key_strength'] = round(strength, 2)
            print(f"  • Tonalidad: {key} {scale} (fuerza: {strength:.0%})")
        except:
            print("  • Tonalidad: No se pudo determinar")
            results['key'] = "Unknown"
        
        # 3. Energía y Loudness
        print("\n⚡ Analizando energía...")
        try:
            # Energía simple
            energy = es.Energy()(audio)
            results['energy'] = round(energy, 6)
            
            # RMS
            rms = es.RMS()(audio)
            results['rms'] = round(rms, 4)
            
            # Loudness simple
            loudness = es.Loudness()(audio[:44100])  # Primer segundo
            results['loudness'] = round(loudness, 2)
            
            print(f"  • Energía: {energy:.6f}")
            print(f"  • RMS: {rms:.4f}")
            print(f"  • Loudness: {loudness:.2f} dB")
        except Exception as e:
            print(f"  • Error en energía: {e}")
        
        # 4. Características espectrales básicas
        print("\n🌈 Analizando espectro...")
        try:
            # Tomar un frame representativo
            frame_size = 2048
            if len(audio) > frame_size:
                frame = audio[:frame_size]
                spectrum = es.Spectrum()(frame)
                
                # Centroide
                centroid = es.Centroid()(spectrum)
                results['spectral_centroid'] = round(centroid, 2)
                
                # Zero Crossing Rate
                zcr = es.ZeroCrossingRate()(frame)
                results['zcr'] = round(zcr, 4)
                
                print(f"  • Centroide espectral: {centroid:.2f} Hz")
                print(f"  • Zero Crossing Rate: {zcr:.4f}")
        except Exception as e:
            print(f"  • Error en espectro: {e}")
        
        # 5. Danceability
        print("\n💃 Calculando danceability...")
        try:
            danceability = es.Danceability()(audio)
            results['danceability'] = round(danceability, 2)
            print(f"  • Danceability: {danceability:.0%}")
        except:
            # Cálculo alternativo simple
            if 'bpm' in results and results['bpm'] > 0:
                # Danceability simple basado en BPM
                bpm_score = 1.0 - abs(results['bpm'] - 128) / 128
                bpm_score = max(0, min(1, bpm_score))
                results['danceability'] = round(bpm_score, 2)
                print(f"  • Danceability (estimado): {bpm_score:.0%}")
        
        # 6. Complejidad dinámica
        print("\n📊 Analizando dinámica...")
        try:
            complexity = es.DynamicComplexity()(audio)
            results['dynamic_complexity'] = round(complexity, 4)
            print(f"  • Complejidad dinámica: {complexity:.4f}")
        except:
            print("  • Complejidad: No se pudo calcular")
        
        # 7. Onset detection (para detectar percusión)
        print("\n🎵 Detectando eventos...")
        try:
            onset_rate = es.OnsetRate()(audio)
            results['onset_rate'] = round(onset_rate[0], 2)
            results['onset_count'] = int(onset_rate[1])
            print(f"  • Tasa de onsets: {onset_rate[0]:.2f} Hz")
            print(f"  • Total de onsets: {onset_rate[1]:.0f}")
        except:
            print("  • Onsets: No se pudieron detectar")
        
        # 8. Estimar MOOD
        print("\n😊 Estimando mood...")
        mood = estimate_mood(results)
        results['mood'] = mood
        print(f"  • Mood estimado: {mood}")
        
        # Resumen
        print("\n" + "="*60)
        print("📋 RESUMEN:")
        print("="*60)
        print(f"  • Duración: {duration:.1f}s")
        print(f"  • BPM: {results.get('bpm', 'N/A')}")
        print(f"  • Tonalidad: {results.get('key', 'N/A')}")
        print(f"  • Danceability: {results.get('danceability', 0):.0%}")
        print(f"  • Mood: {results.get('mood', 'N/A')}")
        
        results['duration'] = round(duration, 2)
        results['status'] = 'success'
        
        return results
        
    except Exception as e:
        print(f"\n❌ Error crítico: {e}")
        return {'status': 'error', 'error': str(e)}

def estimate_mood(features):
    """Estima el mood basado en las características extraídas"""
    
    moods = []
    
    # BPM
    bpm = features.get('bpm', 0)
    if bpm > 140:
        moods.append("Energetic")
    elif bpm > 120:
        moods.append("Upbeat")
    elif bpm > 90:
        moods.append("Moderate")
    elif bpm > 0:
        moods.append("Relaxed")
    
    # Tonalidad
    key = features.get('key', '')
    if 'major' in key.lower():
        moods.append("Happy")
    elif 'minor' in key.lower():
        moods.append("Melancholic")
    
    # Energía
    energy = features.get('energy', 0)
    if energy > 100000:
        moods.append("Intense")
    elif energy < 10000:
        moods.append("Calm")
    
    # Danceability
    dance = features.get('danceability', 0)
    if dance > 0.7:
        moods.append("Danceable")
    
    return " / ".join(set(moods)) if moods else "Neutral"

def test_with_sample():
    """Descarga y analiza un archivo de prueba"""
    import requests
    
    test_file = "test_sample.mp3"
    
    if not os.path.exists(test_file):
        print("📥 Descargando archivo de prueba...")
        url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
        
        try:
            response = requests.get(url, timeout=30)
            with open(test_file, 'wb') as f:
                f.write(response.content)
            print(f"✅ Descargado: {test_file}")
        except Exception as e:
            print(f"❌ Error descargando: {e}")
            return None
    
    return test_file

def main():
    print("\n" + "="*60)
    print("🎵 ESSENTIA - TEST FINAL")
    print("Music Analyzer Pro")
    print("="*60)
    
    # Verificar argumentos
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        if os.path.exists(file_path):
            print(f"\n📁 Analizando archivo proporcionado: {file_path}")
            results = analyze_with_essentia(file_path)
        else:
            print(f"❌ Archivo no encontrado: {file_path}")
            return
    else:
        # Usar archivo de prueba
        print("\n📌 No se proporcionó archivo, usando muestra de prueba")
        test_file = test_with_sample()
        
        if test_file:
            results = analyze_with_essentia(test_file)
        else:
            print("❌ No se pudo obtener archivo de prueba")
            return
    
    # Guardar resultados
    if results and results.get('status') == 'success':
        import json
        output_file = "essentia_results.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Resultados guardados en {output_file}")
        print("\n✅ ¡Essentia funciona correctamente!")
        print("🎉 Puedes usar este código para analizar tu biblioteca musical")
    else:
        print("\n⚠️ El análisis no se completó correctamente")

if __name__ == "__main__":
    main()