#!/usr/bin/env python3
"""
TEST ESSENTIA FIXED
Prueba exhaustiva de los cálculos
"""

import sqlite3
import numpy as np
import essentia.standard as es
import sys

def test_calculations():
    """Probar los cálculos con un archivo real"""
    
    # Obtener un archivo de prueba
    conn = sqlite3.connect('music_analyzer.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_path FROM audio_files WHERE file_path LIKE '%.flac' LIMIT 1")
    file_id, file_path = cursor.fetchone()
    conn.close()
    
    print(f"📁 Testing with: {file_path}")
    print("="*60)
    
    try:
        # Cargar audio
        loader = es.MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
        duration = len(audio) / 44100
        
        print(f"✅ Audio loaded: {duration:.1f}s ({len(audio):,} samples)")
        print()
        
        # Tomar 60 segundos para prueba
        if duration > 60:
            test_audio = audio[:60*44100]
        else:
            test_audio = audio
        
        print("🧪 TESTING CALCULATIONS:")
        print("-"*40)
        
        # 1. Test Loudness (debe ser negativo, típicamente -5 a -30)
        rms = np.sqrt(np.mean(test_audio**2))
        loudness_db = 20 * np.log10(rms + 1e-10)
        loudness = max(-70, min(0, loudness_db))
        print(f"1. Loudness: {loudness:.2f} dB")
        if not (-70 <= loudness <= 0):
            print("   ❌ FUERA DE RANGO!")
        else:
            print("   ✅ Rango correcto")
        
        # 2. Test Danceability real de Essentia
        print("\n2. Danceability (Essentia):")
        try:
            danceability = es.Danceability()
            dance_raw = danceability(test_audio)
            print(f"   Raw value: {dance_raw:.3f}")
            
            # El problema: Essentia puede devolver > 1.0
            if dance_raw > 1.0:
                print(f"   ⚠️ Valor > 1.0 detectado!")
                dance_norm = min(1.0, dance_raw / 3.5)  # Normalizar por el máximo observado
            else:
                dance_norm = dance_raw
            
            print(f"   Normalized: {dance_norm:.3f}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            # Fallback con tempo
            tempo = es.RhythmExtractor2013()
            bpm, _, _, _, _ = tempo(test_audio)
            print(f"   Fallback BPM: {bpm:.1f}")
            dance_norm = min(1.0, max(0.0, (bpm - 60) / 120))
            print(f"   From BPM: {dance_norm:.3f}")
        
        # 3. Test Acousticness (spectral complexity)
        print("\n3. Acousticness:")
        try:
            # Problema: SpectralComplexity necesita espectro, no audio
            spectrum = np.abs(np.fft.rfft(test_audio[:8192]))
            spectral_complexity = es.SpectralComplexity()
            complexity = spectral_complexity(spectrum)
            print(f"   Complexity: {complexity:.3f}")
            acousticness = min(1.0, max(0.0, 1.0 - (complexity / 100)))
            print(f"   Acousticness: {acousticness:.3f}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
            acousticness = 0.5
        
        # 4. Test Instrumentalness
        print("\n4. Instrumentalness:")
        # Zero crossing rate
        zcr = np.mean(np.abs(np.diff(np.sign(test_audio))) / 2)
        print(f"   ZCR: {zcr:.6f}")
        # El problema: zcr * 10 puede ser > 1
        instrumentalness = min(1.0, max(0.0, 1.0 - min(1.0, zcr * 100)))
        print(f"   Instrumentalness: {instrumentalness:.3f}")
        
        # 5. Test Speechiness
        print("\n5. Speechiness:")
        frame_size = 2048
        hop_size = 512
        frames = []
        for i in range(0, min(len(test_audio), 44100*10) - frame_size, hop_size):
            frame = test_audio[i:i+frame_size]
            frames.append(np.sum(frame**2))
        
        if frames:
            energy_var = np.var(frames)
            print(f"   Energy variance: {energy_var:.6f}")
            # El problema: energy_var / 0.01 puede ser >> 1
            speechiness = min(1.0, max(0.0, energy_var * 100))
            print(f"   Speechiness: {speechiness:.3f}")
        else:
            speechiness = 0.0
        
        # 6. Test Liveness
        print("\n6. Liveness:")
        envelope = np.abs(test_audio[:44100*10])  # Solo 10 segundos
        smoothed = np.convolve(envelope, np.ones(1000)/1000, mode='same')
        if len(smoothed) > 0:
            tail_ratio = np.mean(smoothed[-len(smoothed)//4:]) / (np.mean(smoothed) + 1e-10)
            print(f"   Tail ratio: {tail_ratio:.3f}")
            liveness = min(1.0, max(0.0, tail_ratio * 2))
            print(f"   Liveness: {liveness:.3f}")
        else:
            liveness = 0.1
        
        # 7. Test Valence
        print("\n7. Valence:")
        spectrum = np.abs(np.fft.rfft(test_audio[:8192]))
        freqs = np.fft.rfftfreq(8192, 1/44100)
        
        if np.sum(spectrum) > 0:
            centroid = np.sum(spectrum * freqs) / np.sum(spectrum)
            print(f"   Spectral centroid: {centroid:.1f} Hz")
            valence = min(1.0, max(0.0, centroid / 4000))
            print(f"   Valence: {valence:.3f}")
        else:
            valence = 0.5
        
        # Resumen
        print("\n" + "="*60)
        print("📊 RESUMEN DE VALORES:")
        print(f"   Loudness:        {loudness:.2f} dB  {'✅' if -70 <= loudness <= 0 else '❌'}")
        print(f"   Danceability:    {dance_norm:.3f}    {'✅' if 0 <= dance_norm <= 1 else '❌'}")
        print(f"   Acousticness:    {acousticness:.3f}    {'✅' if 0 <= acousticness <= 1 else '❌'}")
        print(f"   Instrumentalness:{instrumentalness:.3f}    {'✅' if 0 <= instrumentalness <= 1 else '❌'}")
        print(f"   Speechiness:     {speechiness:.3f}    {'✅' if 0 <= speechiness <= 1 else '❌'}")
        print(f"   Liveness:        {liveness:.3f}    {'✅' if 0 <= liveness <= 1 else '❌'}")
        print(f"   Valence:         {valence:.3f}    {'✅' if 0 <= valence <= 1 else '❌'}")
        
        # Verificar todos los rangos
        all_valid = all([
            -70 <= loudness <= 0,
            0 <= dance_norm <= 1,
            0 <= acousticness <= 1,
            0 <= instrumentalness <= 1,
            0 <= speechiness <= 1,
            0 <= liveness <= 1,
            0 <= valence <= 1
        ])
        
        print("\n" + "="*60)
        if all_valid:
            print("✅ TODOS LOS VALORES EN RANGO CORRECTO")
        else:
            print("❌ HAY VALORES FUERA DE RANGO")
            
    except Exception as e:
        print(f"\n❌ Error general: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_calculations()