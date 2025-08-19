#!/usr/bin/env python3
"""Test Essentia processing speed"""

import essentia.standard as es
import numpy as np
import time
import sqlite3

# Get a test file
conn = sqlite3.connect('music_analyzer.db')
cursor = conn.cursor()
cursor.execute("SELECT file_path FROM audio_files WHERE file_path LIKE '%.flac' LIMIT 1")
file_path = cursor.fetchone()[0]
conn.close()

print(f"Testing with: {file_path}")

try:
    start_total = time.time()
    
    # 1. Loading time
    start = time.time()
    loader = es.MonoLoader(filename=file_path, sampleRate=44100)
    audio = loader()
    load_time = time.time() - start
    
    print(f"\n📁 File loaded in {load_time:.2f}s")
    print(f"   Duration: {len(audio)/44100:.1f}s")
    print(f"   Samples: {len(audio):,}")
    
    # 2. Analysis time
    print("\n📊 Running analyses:")
    
    # Danceability (el más lento)
    start = time.time()
    danceability = es.Danceability()
    d = danceability(audio)
    dance_time = time.time() - start
    print(f"   Danceability: {d:.3f} (took {dance_time:.2f}s)")
    
    # Energy (rápido)
    start = time.time()
    energy = es.Energy()
    e = energy(audio)
    energy_time = time.time() - start
    print(f"   Energy: {e:.6f} (took {energy_time:.2f}s)")
    
    # Loudness (medio)
    start = time.time()
    loudness = es.LoudnessEBUR128()
    stats = loudness(audio)
    loud_time = time.time() - start
    print(f"   Loudness: {stats[0]:.2f} LUFS (took {loud_time:.2f}s)")
    
    # Dynamic Complexity (lento)
    start = time.time()
    dc = es.DynamicComplexity()
    complexity = dc(audio)
    dc_time = time.time() - start
    print(f"   Dynamic Complexity: {complexity:.3f} (took {dc_time:.2f}s)")
    
    total_time = time.time() - start_total
    
    print(f"\n⏱️ Total processing time: {total_time:.2f}s")
    print(f"   Loading: {load_time:.2f}s ({load_time/total_time*100:.1f}%)")
    print(f"   Analysis: {total_time-load_time:.2f}s ({(total_time-load_time)/total_time*100:.1f}%)")
    
    # Extrapolación
    print(f"\n📈 Speed estimation:")
    print(f"   Per file: ~{total_time:.1f}s")
    print(f"   Files/minute: ~{60/total_time:.0f}")
    print(f"   For 3,768 files: ~{3768*total_time/3600:.1f} hours")
    
except Exception as e:
    print(f"Error: {e}")