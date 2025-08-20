#!/usr/bin/env python3
"""
Generador de archivos FLAC de prueba con metadatos específicos
Para probar MAP-Sol (Music Analyzer Pro)
"""

import numpy as np
import soundfile as sf
import os
from mutagen.flac import FLAC
import datetime

# Crear directorio para archivos de prueba
output_dir = "test-audio"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Definir los archivos de prueba con sus metadatos
test_files = [
    {
        "filename": "Electronic_Dance_Track_01.flac",
        "artist": "DJ Test Master",
        "title": "Energy Burst",
        "year": "2024",
        "isrc": "USTEST2024001",
        "key": "8A",  # Camelot notation
        "comment": "High energy electronic dance track for testing",
        "energy": "0.9",
        "genre": "Electronic",
        "bpm": "128"
    },
    {
        "filename": "House_Music_Track_02.flac",
        "artist": "House Producer",
        "title": "Deep Groove",
        "year": "2024",
        "isrc": "USTEST2024002",
        "key": "5B",
        "comment": "Deep house track with smooth bassline",
        "energy": "0.7",
        "genre": "House",
        "bpm": "124"
    },
    {
        "filename": "Techno_Track_03.flac",
        "artist": "Techno Artist",
        "title": "Dark Matter",
        "year": "2023",
        "isrc": "USTEST2023003",
        "key": "2A",
        "comment": "Dark techno track with industrial elements",
        "energy": "0.85",
        "genre": "Techno",
        "bpm": "135"
    },
    {
        "filename": "Ambient_Track_04.flac",
        "artist": "Ambient Creator",
        "title": "Peaceful Journey",
        "year": "2024",
        "isrc": "USTEST2024004",
        "key": "12A",
        "comment": "Relaxing ambient soundscape",
        "energy": "0.3",
        "genre": "Ambient",
        "bpm": "75"
    },
    {
        "filename": "Trance_Track_05.flac",
        "artist": "Trance Master",
        "title": "Euphoria Rising",
        "year": "2024",
        "isrc": "USTEST2024005",
        "key": "9B",
        "comment": "Uplifting trance with melodic progression",
        "energy": "0.95",
        "genre": "Trance",
        "bpm": "138"
    },
    {
        "filename": "Drum_Bass_Track_06.flac",
        "artist": "DNB Producer",
        "title": "Liquid Flow",
        "year": "2023",
        "isrc": "USTEST2023006",
        "key": "6A",
        "comment": "Liquid drum and bass with smooth vocals",
        "energy": "0.8",
        "genre": "Drum & Bass",
        "bpm": "174"
    },
    {
        "filename": "Dubstep_Track_07.flac",
        "artist": "Bass Wobbler",
        "title": "Heavy Drop",
        "year": "2024",
        "isrc": "USTEST2024007",
        "key": "1B",
        "comment": "Heavy dubstep with massive bass drops",
        "energy": "0.88",
        "genre": "Dubstep",
        "bpm": "140"
    },
    {
        "filename": "Minimal_Track_08.flac",
        "artist": "Minimal Tech",
        "title": "Subtle Motion",
        "year": "2024",
        "isrc": "USTEST2024008",
        "key": "7A",
        "comment": "Minimal techno with hypnotic groove",
        "energy": "0.6",
        "genre": "Minimal",
        "bpm": "126"
    },
    {
        "filename": "Progressive_Track_09.flac",
        "artist": "Progressive Sound",
        "title": "Building Layers",
        "year": "2023",
        "isrc": "USTEST2023009",
        "key": "4B",
        "comment": "Progressive house with evolving elements",
        "energy": "0.75",
        "genre": "Progressive House",
        "bpm": "122"
    },
    {
        "filename": "Experimental_Track_10.flac",
        "artist": "Sound Explorer",
        "title": "Abstract Dimensions",
        "year": "2024",
        "isrc": "USTEST2024010",
        "key": "11B",
        "comment": "Experimental electronic with unique textures",
        "energy": "0.65",
        "genre": "Experimental",
        "bpm": "95"
    }
]

def generate_audio_signal(duration_seconds=30, sample_rate=44100, bpm=120, energy=0.5):
    """
    Genera una señal de audio sintética basada en los parámetros
    """
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds))
    
    # Frecuencia base del kick drum basada en BPM
    kick_freq = bpm / 60.0  # Beats por segundo
    
    # Generar diferentes componentes
    # Kick drum (bajo)
    kick = np.sin(2 * np.pi * 60 * t) * np.sin(2 * np.pi * kick_freq * t) * energy
    
    # Hi-hats (frecuencias altas)
    hihat_freq = kick_freq * 4  # 16th notes
    hihat = np.random.normal(0, 0.05 * energy, len(t)) * (np.sin(2 * np.pi * hihat_freq * t) > 0.8)
    
    # Synth melody (frecuencias medias)
    melody_freqs = [220, 246.94, 261.63, 293.66, 329.63]  # A, B, C, D, E
    melody = np.zeros_like(t)
    for i, freq in enumerate(melody_freqs):
        phase = i * len(t) // len(melody_freqs)
        melody += np.sin(2 * np.pi * freq * t) * 0.3 * energy * (t > phase/sample_rate)
    
    # Combinar todas las señales
    audio = kick + hihat + melody
    
    # Aplicar envolvente simple
    envelope = np.exp(-t/duration_seconds * 0.5)
    audio = audio * envelope
    
    # Normalizar
    audio = audio / np.max(np.abs(audio)) * 0.8
    
    return audio

# Generar cada archivo de prueba
for idx, track_info in enumerate(test_files, 1):
    print(f"Generando {idx}/{len(test_files)}: {track_info['filename']}")
    
    # Generar señal de audio
    bpm = int(track_info.get('bpm', 120))
    energy = float(track_info.get('energy', 0.5))
    
    audio_signal = generate_audio_signal(
        duration_seconds=30,  # 30 segundos de duración
        sample_rate=44100,
        bpm=bpm,
        energy=energy
    )
    
    # Guardar archivo FLAC
    output_path = os.path.join(output_dir, track_info['filename'])
    sf.write(output_path, audio_signal, 44100, format='FLAC', subtype='PCM_16')
    
    # Agregar metadatos usando mutagen
    audio_file = FLAC(output_path)
    
    # Metadatos principales - Usando tags estándar FLAC/Vorbis
    audio_file['ARTIST'] = track_info['artist']
    audio_file['TITLE'] = track_info['title']
    audio_file['DATE'] = track_info['year']
    audio_file['YEAR'] = track_info['year']  # Algunos reproductores usan YEAR
    audio_file['ISRC'] = track_info['isrc']
    
    # Comentario indicando que es archivo de prueba
    audio_file['COMMENT'] = f"ARCHIVO DE PRUEBA - {track_info['comment']}"
    audio_file['DESCRIPTION'] = f"Test file for MAP-Sol - {track_info['comment']}"
    
    # Metadatos adicionales estándar
    audio_file['GENRE'] = track_info.get('genre', 'Electronic')
    audio_file['ALBUM'] = f"MAP-Sol Test Collection {track_info['year']}"
    audio_file['TRACKNUMBER'] = str(idx)
    audio_file['ALBUMARTIST'] = track_info['artist']
    
    # Metadatos de análisis musical (formato MixedInKey/DJ software)
    audio_file['KEY'] = track_info['key']
    audio_file['INITIALKEY'] = track_info['key']  # MixedInKey format
    audio_file['BPM'] = track_info.get('bpm', '120')
    audio_file['ENERGY'] = track_info['energy']
    
    # Tags adicionales para compatibilidad
    audio_file['ENERGYLEVEL'] = track_info['energy']  # Traktor format
    audio_file['TEMPO'] = track_info.get('bpm', '120')  # Alternative BPM tag
    
    # Guardar metadatos
    audio_file.save()
    
    print(f"  ✓ Creado: {output_path}")
    print(f"    - Artista: {track_info['artist']}")
    print(f"    - Título: {track_info['title']}")
    print(f"    - Key: {track_info['key']}")
    print(f"    - BPM: {bpm}")
    print(f"    - Energy: {energy}")
    print()

print(f"\n✅ {len(test_files)} archivos FLAC de prueba generados en ./test-audio/")
print("\nMetadatos incluidos en cada archivo:")
print("- Artista")
print("- Nombre de la canción (title)")
print("- Año")
print("- ISRC")
print("- Key (tonalidad)")
print("- Comentario")
print("- Energía")
print("\nLa aplicación MAP-Sol completará el resto del proceso de análisis.")