#!/usr/bin/env python3
"""
Test mínimo de Essentia para diagnosticar segmentation faults
"""

import sys
import os

# Configurar para máximo silencio
os.environ['ESSENTIA_LOG_LEVEL'] = 'ERROR'

print("1. Importando Essentia...")
try:
    import essentia
    import essentia.standard as es
    print(f"   ✅ Essentia {essentia.__version__} importado")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("\n2. Probando con archivo simple...")

# Archivo de prueba - probemos con FLAC
test_file = '/Volumes/My Passport/Ojo otra vez musica de Tidal Original descarga/Consolidado2025/Tracks/ATB - 9 Pm - Till I Come.flac'

if not os.path.exists(test_file):
    print(f"   ❌ Archivo no encontrado: {test_file}")
    sys.exit(1)

print(f"   📁 Archivo: {os.path.basename(test_file)}")

try:
    print("\n3. Cargando audio con MonoLoader...")
    # Usar MonoLoader con configuración mínima
    loader = es.MonoLoader(filename=test_file, sampleRate=44100)
    audio = loader()
    print(f"   ✅ Audio cargado: {len(audio)} samples")
    
    print("\n4. Calculando características básicas...")
    
    # Probar cada característica individualmente
    try:
        print("   - Calculando RMS...")
        rms = es.RMS()(audio)
        print(f"     ✅ RMS: {rms}")
    except Exception as e:
        print(f"     ❌ RMS falló: {e}")
    
    try:
        print("   - Calculando Energy...")
        energy = es.Energy()(audio)
        print(f"     ✅ Energy: {energy}")
    except Exception as e:
        print(f"     ❌ Energy falló: {e}")
    
    try:
        print("   - Calculando ZeroCrossingRate...")
        zcr = es.ZeroCrossingRate()(audio)
        print(f"     ✅ ZCR: {zcr}")
    except Exception as e:
        print(f"     ❌ ZCR falló: {e}")
    
    try:
        print("   - Calculando Loudness (simple)...")
        loudness = es.Loudness()(audio)
        print(f"     ✅ Loudness: {loudness}")
    except Exception as e:
        print(f"     ❌ Loudness falló: {e}")
    
    print("\n5. Probando algoritmos complejos...")
    
    try:
        print("   - Calculando Danceability...")
        danceability = es.Danceability()(audio)
        print(f"     ✅ Danceability: {danceability}")
    except Exception as e:
        print(f"     ❌ Danceability falló: {e}")
    
    try:
        print("   - Calculando BPM...")
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
        print(f"     ✅ BPM: {bpm}")
    except Exception as e:
        print(f"     ❌ BPM falló: {e}")
    
    print("\n✅ TEST COMPLETADO SIN CRASHES")
    
except Exception as e:
    print(f"\n❌ Error general: {e}")
    import traceback
    traceback.print_exc()