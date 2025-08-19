#!/usr/bin/env python3
import essentia.standard as es
import numpy as np

file_path = "/Volumes/My Passport/Ojo otra vez muscia de Tidal Original descarga de musica/Consolidado2025/Tracks/Ace Of Base - Never Gonna Say I'm Sorry (Lenny B's Organ-Ic House Mix).flac"

print('Testing file #62...')
print(f'File: {file_path.split("/")[-1]}')

# Test MonoLoader
try:
    loader = es.MonoLoader(filename=file_path, sampleRate=44100)
    audio = loader()
    print(f'✅ MonoLoader OK: {len(audio)} samples, dtype={audio.dtype}')
except Exception as e:
    print(f'❌ MonoLoader failed: {e}')

# Test AudioLoader
try:
    loader = es.AudioLoader(filename=file_path)
    audio, sr, ch, md, br, codec = loader()
    print(f'✅ AudioLoader OK: shape={audio.shape}, sr={sr}, channels={ch}, codec={codec}')
    
    # Test if stereo to mono conversion works
    if ch == 2 and len(audio.shape) == 2:
        print(f'   Audio is stereo with shape: {audio.shape}')
        # Try different mono conversion
        mono = es.MonoMixer()(audio, audio.shape[1])
        print(f'   ✅ MonoMixer works: {len(mono)} samples')
except Exception as e:
    print(f'❌ AudioLoader failed: {e}')

# Test specific algorithms
try:
    loader = es.MonoLoader(filename=file_path, sampleRate=44100)
    audio = loader()
    
    # Test each algorithm
    print('\nTesting algorithms:')
    
    # LoudnessEBUR128
    try:
        loudness = es.LoudnessEBUR128(sampleRate=44100)(audio)
        print(f'✅ LoudnessEBUR128: {loudness:.2f} LUFS')
    except Exception as e:
        print(f'❌ LoudnessEBUR128: {e}')
    
    # RhythmExtractor2013
    try:
        bpm, beats, confidence, _, intervals = es.RhythmExtractor2013()(audio)
        print(f'✅ RhythmExtractor2013: {bpm:.1f} BPM')
    except Exception as e:
        print(f'❌ RhythmExtractor2013: {e}')
        
    # KeyExtractor
    try:
        key, scale, strength = es.KeyExtractor()(audio)
        print(f'✅ KeyExtractor: {key} {scale}')
    except Exception as e:
        print(f'❌ KeyExtractor: {e}')
        
except Exception as e:
    print(f'❌ General error: {e}')