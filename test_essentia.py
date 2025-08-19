#!/usr/bin/env python3
"""
Test de Essentia para análisis de audio
Music Analyzer Pro - Prueba inicial
"""

import os
import sqlite3
import json
from pathlib import Path
import essentia
import essentia.standard as es
from essentia import Pool
import numpy as np

def get_sample_files(db_path="music_analyzer.db", limit=5):
    """Obtiene algunos archivos de muestra de la base de datos"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    query = """
    SELECT af.file_path, af.file_name, af.artist, af.title 
    FROM audio_files af
    WHERE af.file_path IS NOT NULL 
    AND (af.file_extension = 'mp3' OR af.file_extension = 'm4a')
    LIMIT ?
    """
    
    cursor.execute(query, (limit,))
    files = cursor.fetchall()
    conn.close()
    
    return files

def analyze_with_essentia(file_path):
    """Analiza un archivo de audio con Essentia"""
    print(f"\n{'='*60}")
    print(f"🎵 Analizando: {Path(file_path).name}")
    print(f"{'='*60}")
    
    try:
        # Cargar el audio
        loader = es.MonoLoader(filename=file_path)
        audio = loader()
        
        # Información básica
        duration = len(audio) / 44100.0  # Asumiendo 44.1kHz
        print(f"📊 Duración: {duration:.2f} segundos")
        
        # Análisis de ritmo
        print("\n🥁 ANÁLISIS DE RITMO:")
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
        print(f"  • BPM: {bpm:.1f}")
        print(f"  • Confianza: {beats_confidence:.2%}")
        print(f"  • Beats detectados: {len(beats)}")
        
        # Análisis tonal
        print("\n🎹 ANÁLISIS TONAL:")
        key_extractor = es.KeyExtractor()
        key, scale, key_strength = key_extractor(audio)
        print(f"  • Tonalidad: {key} {scale}")
        print(f"  • Fuerza tonal: {key_strength:.2%}")
        
        # Análisis espectral
        print("\n🌈 ANÁLISIS ESPECTRAL:")
        
        # Centroide espectral
        spectrum = es.Spectrum()(audio[:2048])
        centroid = es.Centroid()(spectrum)
        print(f"  • Centroide espectral: {centroid:.2f} Hz")
        
        # Energy
        energy = es.Energy()(audio[:2048])
        print(f"  • Energía: {energy:.4f}")
        
        # RMS
        rms = es.RMS()(audio[:2048])
        print(f"  • RMS: {rms:.4f}")
        
        # Loudness
        loudness = es.Loudness()(audio[:2048])
        print(f"  • Loudness: {loudness:.2f} dB")
        
        # Análisis de dinámica
        print("\n📈 ANÁLISIS DE DINÁMICA:")
        dynamic_complexity = es.DynamicComplexity()(audio)
        print(f"  • Complejidad dinámica: {dynamic_complexity:.4f}")
        
        # Zero Crossing Rate
        zcr = es.ZeroCrossingRate()(audio[:2048])
        print(f"  • Zero Crossing Rate: {zcr:.4f}")
        
        # Análisis de timbre
        print("\n🎨 ANÁLISIS DE TIMBRE:")
        
        # MFCC
        mfcc = es.MFCC()(spectrum)
        print(f"  • MFCCs (primeros 4): {mfcc[1][:4].round(2)}")
        
        # Dissonance
        spectral_peaks = es.SpectralPeaks()(spectrum)
        dissonance = es.Dissonance()(spectral_peaks[0], spectral_peaks[1])
        print(f"  • Disonancia: {dissonance:.4f}")
        
        # Danceability (estimación simple basada en BPM y energía)
        danceability = calculate_danceability(bpm, energy, dynamic_complexity)
        print(f"\n💃 DANCEABILITY: {danceability:.2%}")
        
        # Mood estimation
        mood = estimate_mood(key, scale, bpm, energy, centroid)
        print(f"😊 MOOD ESTIMADO: {mood}")
        
        return {
            "bpm": float(bpm),
            "key": f"{key} {scale}",
            "energy": float(energy),
            "loudness": float(loudness),
            "danceability": float(danceability),
            "mood": mood,
            "duration": float(duration)
        }
        
    except Exception as e:
        print(f"❌ Error analizando archivo: {e}")
        return None

def calculate_danceability(bpm, energy, dynamic_complexity):
    """Calcula un índice de danceability simple"""
    # BPM ideal para bailar: 120-130
    bpm_score = 1.0 - abs(bpm - 125) / 125
    bpm_score = max(0, min(1, bpm_score))
    
    # Energía normalizada
    energy_score = min(1, energy * 10)
    
    # Complejidad dinámica invertida (menos complejo = más bailable)
    complexity_score = 1.0 - min(1, dynamic_complexity)
    
    # Promedio ponderado
    danceability = (bpm_score * 0.5 + energy_score * 0.3 + complexity_score * 0.2)
    
    return danceability

def estimate_mood(key, scale, bpm, energy, centroid):
    """Estima el mood basado en características del audio"""
    moods = []
    
    # Escala mayor vs menor
    if scale == "major":
        moods.append("Happy" if bpm > 120 else "Relaxed")
    else:
        moods.append("Melancholic" if bpm < 100 else "Intense")
    
    # Energía
    if energy > 0.05:
        moods.append("Energetic")
    elif energy < 0.01:
        moods.append("Calm")
    
    # Centroide espectral (brillo)
    if centroid > 2000:
        moods.append("Bright")
    elif centroid < 1000:
        moods.append("Dark")
    
    # BPM
    if bpm > 140:
        moods.append("Aggressive")
    elif bpm < 80:
        moods.append("Chill")
    
    return " / ".join(set(moods)) if moods else "Neutral"

def main():
    print("\n🎵 MUSIC ANALYZER PRO - TEST DE ESSENTIA 🎵")
    print("=" * 60)
    
    # Obtener archivos de muestra
    print("\n📂 Obteniendo archivos de la base de datos...")
    files = get_sample_files(limit=3)
    
    if not files:
        print("❌ No se encontraron archivos en la base de datos")
        return
    
    print(f"✅ Encontrados {len(files)} archivos para analizar")
    
    results = []
    
    # Analizar cada archivo
    for file_path, file_name, artist, title in files:
        if os.path.exists(file_path):
            print(f"\n🎵 {artist or 'Unknown'} - {title or file_name}")
            result = analyze_with_essentia(file_path)
            if result:
                result['file'] = file_name
                result['artist'] = artist
                result['title'] = title
                results.append(result)
        else:
            print(f"\n⚠️ Archivo no encontrado: {file_path}")
    
    # Resumen de resultados
    if results:
        print("\n" + "="*60)
        print("📊 RESUMEN DE ANÁLISIS")
        print("="*60)
        
        for r in results:
            print(f"\n🎵 {r.get('artist', 'Unknown')} - {r.get('title', r['file'])}")
            print(f"  • BPM: {r['bpm']:.1f}")
            print(f"  • Tonalidad: {r['key']}")
            print(f"  • Danceability: {r['danceability']:.2%}")
            print(f"  • Mood: {r['mood']}")
        
        # Guardar resultados
        with open('essentia_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Resultados guardados en essentia_test_results.json")

if __name__ == "__main__":
    main()