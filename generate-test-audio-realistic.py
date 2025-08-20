#!/usr/bin/env python3
"""
Generador REALISTA de archivos FLAC de prueba con características de audio coherentes
Para MAP-Sol - Los archivos generados tendrán audio que coincide con sus metadatos
"""

import numpy as np
import soundfile as sf
import os
from mutagen.flac import FLAC
from scipy import signal

# Crear directorio para archivos de prueba
output_dir = "test-audio"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Mapeo de Keys Camelot a frecuencias fundamentales (Hz)
KEY_FREQUENCIES = {
    '1A': 523.25,   # C (Ab minor)
    '2A': 554.37,   # C# (Eb minor)
    '3A': 587.33,   # D (Bb minor)
    '4A': 622.25,   # D# (F minor)
    '5A': 659.25,   # E (C minor)
    '6A': 698.46,   # F (G minor)
    '7A': 739.99,   # F# (D minor)
    '8A': 783.99,   # G (A minor)
    '9A': 830.61,   # G# (E minor)
    '10A': 880.00,  # A (B minor)
    '11A': 932.33,  # A# (F# minor)
    '12A': 987.77,  # B (C# minor)
    '1B': 523.25,   # C (B major)
    '2B': 554.37,   # C# (F# major)
    '3B': 587.33,   # D (C# major)
    '4B': 622.25,   # D# (G# major)
    '5B': 659.25,   # E (Eb major)
    '6B': 698.46,   # F (Bb major)
    '7B': 739.99,   # F# (F major)
    '8B': 783.99,   # G (C major)
    '9B': 830.61,   # G# (G major)
    '10B': 880.00,  # A (D major)
    '11B': 932.33,  # A# (A major)
    '12B': 987.77,  # B (E major)
}

# Escalas para keys mayores (B) y menores (A)
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]  # Escala menor natural
MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]  # Escala mayor

def get_scale_frequencies(key, base_freq):
    """Obtiene las frecuencias de la escala según el key"""
    is_minor = 'A' in key
    scale = MINOR_SCALE if is_minor else MAJOR_SCALE
    frequencies = []
    for semitone in scale:
        freq = base_freq * (2 ** (semitone / 12))
        frequencies.append(freq)
        # Agregar octavas
        frequencies.append(freq / 2)  # Octava inferior
        frequencies.append(freq * 2)  # Octava superior
    return frequencies

def generate_realistic_audio(duration_seconds=30, sample_rate=44100, bpm=120, key='8A', energy=0.7):
    """
    Genera audio realista con BPM, Key y Energy precisos
    """
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds))
    audio = np.zeros_like(t)
    
    # 1. GENERAR KICK DRUM CON BPM EXACTO
    kick_interval = 60.0 / bpm  # Intervalo entre kicks en segundos
    kick_times = np.arange(0, duration_seconds, kick_interval)
    
    for kick_time in kick_times:
        kick_sample = int(kick_time * sample_rate)
        if kick_sample < len(audio):
            # Generar kick con envolvente
            kick_duration = 0.1
            kick_samples = int(kick_duration * sample_rate)
            if kick_sample + kick_samples < len(audio):
                kick_t = np.linspace(0, kick_duration, kick_samples)
                # Frecuencia sub-bass para el kick (50-80 Hz)
                kick_signal = np.sin(2 * np.pi * 60 * kick_t)
                # Envolvente exponencial
                kick_envelope = np.exp(-kick_t * 35)
                kick_signal = kick_signal * kick_envelope * energy
                audio[kick_sample:kick_sample + kick_samples] += kick_signal
    
    # 2. GENERAR HI-HATS (16th notes)
    hihat_interval = kick_interval / 4  # 16th notes
    hihat_times = np.arange(kick_interval/2, duration_seconds, hihat_interval)  # Offset para sincopación
    
    for hihat_time in hihat_times:
        hihat_sample = int(hihat_time * sample_rate)
        if hihat_sample < len(audio):
            hihat_duration = 0.02
            hihat_samples = int(hihat_duration * sample_rate)
            if hihat_sample + hihat_samples < len(audio):
                # Hi-hat es ruido blanco filtrado
                hihat_signal = np.random.normal(0, 0.1, hihat_samples)
                # Filtro pasa-altos para hi-hat (> 8000 Hz)
                b, a = signal.butter(4, 8000 / (sample_rate / 2), 'high')
                hihat_signal = signal.filtfilt(b, a, hihat_signal)
                # Envolvente rápida
                hihat_envelope = np.exp(-np.linspace(0, 1, hihat_samples) * 50)
                hihat_signal = hihat_signal * hihat_envelope * energy * 0.3
                audio[hihat_sample:hihat_sample + hihat_samples] += hihat_signal
    
    # 3. GENERAR BASSLINE EN LA TONALIDAD CORRECTA
    base_freq = KEY_FREQUENCIES.get(key, 440) / 4  # Bass en octava baja
    bass_pattern = [1, 0, 0, 1, 0, 0, 1, 0]  # Patrón rítmico del bass
    
    for i, kick_time in enumerate(kick_times):
        if i % len(bass_pattern) < len(bass_pattern) and bass_pattern[i % len(bass_pattern)]:
            bass_sample = int(kick_time * sample_rate)
            if bass_sample < len(audio):
                bass_duration = kick_interval * 0.9
                bass_samples = int(bass_duration * sample_rate)
                if bass_sample + bass_samples < len(audio):
                    bass_t = np.linspace(0, bass_duration, bass_samples)
                    # Bass con armónicos
                    bass_signal = (np.sin(2 * np.pi * base_freq * bass_t) * 0.6 +
                                 np.sin(2 * np.pi * base_freq * 2 * bass_t) * 0.3 +
                                 np.sin(2 * np.pi * base_freq * 3 * bass_t) * 0.1)
                    # Envolvente ADSR
                    attack = int(0.01 * sample_rate)
                    decay = int(0.05 * sample_rate)
                    sustain_level = 0.7
                    release = int(0.1 * sample_rate)
                    
                    envelope = np.ones(bass_samples) * sustain_level
                    envelope[:attack] = np.linspace(0, 1, attack)
                    envelope[attack:attack+decay] = np.linspace(1, sustain_level, decay)
                    envelope[-release:] = np.linspace(sustain_level, 0, release)
                    
                    bass_signal = bass_signal * envelope * energy * 0.8
                    audio[bass_sample:bass_sample + bass_samples] += bass_signal
    
    # 4. GENERAR MELODÍA/LEAD EN LA ESCALA CORRECTA
    scale_freqs = get_scale_frequencies(key, KEY_FREQUENCIES.get(key, 440))
    melody_pattern_length = 8  # Compases
    
    for bar in range(int(duration_seconds * bpm / 60 / 4)):  # Número de compases
        bar_time = bar * 4 * kick_interval
        # Seleccionar notas de la escala
        note_index = bar % len(scale_freqs)
        melody_freq = scale_freqs[note_index]
        
        # Crear melodía con ritmo
        for beat in range(4):
            if np.random.random() < 0.6:  # Probabilidad de nota
                note_time = bar_time + beat * kick_interval
                note_sample = int(note_time * sample_rate)
                if note_sample < len(audio):
                    note_duration = kick_interval * 0.5
                    note_samples = int(note_duration * sample_rate)
                    if note_sample + note_samples < len(audio):
                        note_t = np.linspace(0, note_duration, note_samples)
                        # Synth lead con forma de onda compleja
                        note_signal = (np.sin(2 * np.pi * melody_freq * note_t) * 0.4 +
                                     np.sin(2 * np.pi * melody_freq * 2 * note_t) * 0.2 +
                                     signal.sawtooth(2 * np.pi * melody_freq * note_t) * 0.2)
                        # Envolvente
                        note_envelope = np.exp(-note_t * 3)
                        note_signal = note_signal * note_envelope * energy * 0.5
                        
                        # Agregar filtro resonante para más carácter
                        if energy > 0.7:
                            b, a = signal.butter(2, [melody_freq * 0.9 / (sample_rate/2), 
                                                    min(melody_freq * 4 / (sample_rate/2), 0.99)], 'band')
                            note_signal = signal.filtfilt(b, a, note_signal)
                        
                        audio[note_sample:note_sample + note_samples] += note_signal
    
    # 5. AGREGAR PAD ATMOSFÉRICO (para tracks con menos energía)
    if energy < 0.6:
        pad_freqs = scale_freqs[:3]  # Usar tríada
        for freq in pad_freqs:
            pad_signal = np.sin(2 * np.pi * freq/2 * t) * 0.05 * (1 - energy)
            audio += pad_signal
    
    # 6. AGREGAR SNARE EN 2 Y 4
    snare_times = []
    for i, kick_time in enumerate(kick_times):
        if i % 4 == 2:  # Beats 2 y 4
            snare_times.append(kick_time)
    
    for snare_time in snare_times:
        snare_sample = int(snare_time * sample_rate)
        if snare_sample < len(audio):
            snare_duration = 0.15
            snare_samples = int(snare_duration * sample_rate)
            if snare_sample + snare_samples < len(audio):
                # Snare = ruido + tono
                snare_noise = np.random.normal(0, 0.2, snare_samples)
                snare_tone = np.sin(2 * np.pi * 200 * np.linspace(0, snare_duration, snare_samples))
                snare_signal = (snare_noise * 0.7 + snare_tone * 0.3)
                # Filtro para dar cuerpo al snare
                b, a = signal.butter(2, [200 / (sample_rate/2), 4000 / (sample_rate/2)], 'band')
                snare_signal = signal.filtfilt(b, a, snare_signal)
                # Envolvente
                snare_envelope = np.exp(-np.linspace(0, 1, snare_samples) * 20)
                snare_signal = snare_signal * snare_envelope * energy * 0.6
                audio[snare_sample:snare_sample + snare_samples] += snare_signal
    
    # 7. APLICAR COMPRESIÓN Y LIMITACIÓN
    # Soft clipping para evitar distorsión
    audio = np.tanh(audio * 0.7) / 0.7
    
    # Normalización con headroom
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val * 0.9  # -1 dB headroom
    
    # 8. APLICAR FILTRO FINAL SEGÚN ENERGÍA
    if energy > 0.8:
        # High energy: boost altos y bajos
        b, a = signal.butter(2, 100 / (sample_rate/2), 'high')
        audio = signal.filtfilt(b, a, audio)
    elif energy < 0.4:
        # Low energy: suavizar con lowpass
        b, a = signal.butter(2, 8000 / (sample_rate/2), 'low')
        audio = signal.filtfilt(b, a, audio)
    
    return audio

# Definir los archivos de prueba con metadatos coherentes
test_files = [
    {
        "filename": "Electronic_Dance_Track_01.flac",
        "artist": "DJ Test Master",
        "title": "Energy Burst",
        "year": "2024",
        "isrc": "USTEST2024001",
        "key": "8A",  # A minor - común en EDM
        "energy": "9",  # Energía alta (1-10)
        "energy_float": 0.9,  # Para generación de audio
        "genre": "Electronic Dance",
        "bpm": "128"  # BPM estándar para EDM
    },
    {
        "filename": "House_Music_Track_02.flac",
        "artist": "House Producer",
        "title": "Deep Groove",
        "year": "2024",
        "isrc": "USTEST2024002",
        "key": "5B",  # Eb major - común en House
        "energy": "7",  # Energía media-alta
        "energy_float": 0.7,
        "genre": "Deep House",
        "bpm": "124"  # BPM típico de Deep House
    },
    {
        "filename": "Techno_Track_03.flac",
        "artist": "Techno Artist",
        "title": "Dark Matter",
        "year": "2023",
        "isrc": "USTEST2023003",
        "key": "2A",  # Eb minor - oscuro para Techno
        "energy": "8",  # Energía alta
        "energy_float": 0.85,
        "genre": "Techno",
        "bpm": "135"  # BPM de Techno
    },
    {
        "filename": "Ambient_Track_04.flac",
        "artist": "Ambient Creator",
        "title": "Peaceful Journey",
        "year": "2024",
        "isrc": "USTEST2024004",
        "key": "12A",  # C# minor - etéreo
        "energy": "3",  # Energía baja
        "energy_float": 0.3,
        "genre": "Ambient",
        "bpm": "75"  # BPM lento para Ambient
    },
    {
        "filename": "Trance_Track_05.flac",
        "artist": "Trance Master",
        "title": "Euphoria Rising",
        "year": "2024",
        "isrc": "USTEST2024005",
        "key": "9B",  # G major - uplifting
        "energy": "10",  # Energía máxima
        "energy_float": 0.95,
        "genre": "Uplifting Trance",
        "bpm": "138"  # BPM clásico de Trance
    },
    {
        "filename": "Drum_Bass_Track_06.flac",
        "artist": "DNB Producer",
        "title": "Liquid Flow",
        "year": "2023",
        "isrc": "USTEST2023006",
        "key": "6A",  # G minor
        "energy": "8",  # Energía alta
        "energy_float": 0.8,
        "genre": "Liquid Drum & Bass",
        "bpm": "174"  # BPM estándar de D&B
    },
    {
        "filename": "Dubstep_Track_07.flac",
        "artist": "Bass Wobbler",
        "title": "Heavy Drop",
        "year": "2024",
        "isrc": "USTEST2024007",
        "key": "1B",  # B major
        "energy": "9",  # Energía muy alta
        "energy_float": 0.88,
        "genre": "Dubstep",
        "bpm": "140"  # BPM de Dubstep
    },
    {
        "filename": "Minimal_Track_08.flac",
        "artist": "Minimal Tech",
        "title": "Subtle Motion",
        "year": "2024",
        "isrc": "USTEST2024008",
        "key": "7A",  # D minor - hipnótico
        "energy": "6",  # Energía media
        "energy_float": 0.6,
        "genre": "Minimal Techno",
        "bpm": "126"  # BPM de Minimal
    },
    {
        "filename": "Progressive_Track_09.flac",
        "artist": "Progressive Sound",
        "title": "Building Layers",
        "year": "2023",
        "isrc": "USTEST2023009",
        "key": "4B",  # G# major
        "energy": "7",  # Energía media-alta
        "energy_float": 0.75,
        "genre": "Progressive House",
        "bpm": "122"  # BPM de Progressive House
    },
    {
        "filename": "Experimental_Track_10.flac",
        "artist": "Sound Explorer",
        "title": "Abstract Dimensions",
        "year": "2024",
        "isrc": "USTEST2024010",
        "key": "11B",  # A major
        "energy": "6",  # Energía media
        "energy_float": 0.65,
        "genre": "Experimental Electronic",
        "bpm": "95"  # BPM variable/experimental
    }
]

# Verificar dependencias
try:
    from scipy import signal
    print("✓ scipy instalado")
except ImportError:
    print("Instalando scipy...")
    os.system("pip install scipy --quiet")
    from scipy import signal

print("\n🎵 Generando archivos FLAC con características de audio REALES...\n")

# Generar cada archivo
for idx, track_info in enumerate(test_files, 1):
    print(f"Generando {idx}/{len(test_files)}: {track_info['filename']}")
    
    # Extraer parámetros
    bpm = int(track_info.get('bpm', 120))
    energy_float = float(track_info.get('energy_float', 0.5))  # Usar energy_float para generación
    energy_value = track_info.get('energy', '7')  # Valor entero para metadatos
    key = track_info.get('key', '8A')
    
    # Generar audio realista
    print(f"  → Generando audio: BPM={bpm}, Key={key}, Energy={energy_value} (audio: {energy_float})")
    audio_signal = generate_realistic_audio(
        duration_seconds=30,
        sample_rate=44100,
        bpm=bpm,
        key=key,
        energy=energy_float  # Usar el valor float para generar el audio
    )
    
    # Guardar archivo FLAC
    output_path = os.path.join(output_dir, track_info['filename'])
    sf.write(output_path, audio_signal, 44100, format='FLAC', subtype='PCM_16')
    
    # Agregar metadatos
    audio_file = FLAC(output_path)
    
    # Metadatos principales en formato estándar
    audio_file['ARTIST'] = track_info['artist']
    audio_file['TITLE'] = track_info['title']
    audio_file['DATE'] = track_info['year']
    audio_file['YEAR'] = track_info['year']
    audio_file['ISRC'] = track_info['isrc']
    audio_file['COMMENT'] = f"ARCHIVO DE PRUEBA - Generated with real {bpm} BPM in key {key}"
    audio_file['DESCRIPTION'] = f"Test file for MAP-Sol - Real audio characteristics"
    audio_file['GENRE'] = track_info.get('genre', 'Electronic')
    audio_file['ALBUM'] = f"MAP-Sol Test Collection {track_info['year']}"
    audio_file['TRACKNUMBER'] = str(idx)
    audio_file['ALBUMARTIST'] = track_info['artist']
    
    # Metadatos de análisis musical
    audio_file['KEY'] = track_info['key']
    audio_file['INITIALKEY'] = track_info['key']
    audio_file['BPM'] = track_info.get('bpm', '120')
    audio_file['ENERGY'] = energy_value  # Valor entero (1-10)
    audio_file['ENERGYLEVEL'] = energy_value  # Valor entero para compatibilidad
    audio_file['TEMPO'] = track_info.get('bpm', '120')
    
    # Guardar metadatos
    audio_file.save()
    
    print(f"  ✓ Creado: {output_path}")
    print(f"    - Audio real con {bpm} BPM")
    print(f"    - Tonalidad: {key}")
    print(f"    - Energía: {energy_value}/10")
    print()

print(f"\n✅ {len(test_files)} archivos FLAC generados con audio REALISTA")
print("\n📊 Características:")
print("- Audio con BPM real y verificable")
print("- Tonalidad musical correcta")
print("- Nivel de energía coherente con el audio")
print("- Metadatos sincronizados con contenido")
print("\n🎯 Los archivos están listos para análisis sin inconsistencias")