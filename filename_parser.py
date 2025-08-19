#!/usr/bin/env python3
"""
Parser de nombres de archivo para extraer metadata cuando no hay tags
"""

import re
from typing import Dict, Optional

def parse_filename(filename: str) -> Dict[str, Optional[str]]:
    """
    Extrae artista, título y remix info desde el nombre de archivo
    
    Formatos soportados:
    - "Artist - Title.ext"
    - "Artist - Title (Remix).ext"
    - "Artist feat. Other - Title.ext"
    - "Artist, Other - Title (Extended Mix).ext"
    """
    
    # Remover extensión
    name = filename.rsplit('.', 1)[0]
    
    # Patrones comunes
    patterns = [
        # Artist feat/ft/featuring/& Other - Title (Mix)
        r'^(.+?(?:\s+(?:feat\.|ft\.|featuring|&)\s+.+?)?)\s*-\s*(.+?)(?:\s*\(([^)]+)\))?$',
        # Artist - Title
        r'^(.+?)\s*-\s*(.+?)$',
        # Solo título (sin guión)
        r'^(.+?)$'
    ]
    
    for pattern in patterns:
        match = re.match(pattern, name)
        if match:
            groups = match.groups()
            
            if len(groups) >= 2:
                artist = groups[0].strip()
                title = groups[1].strip()
                mix = groups[2].strip() if len(groups) > 2 and groups[2] else None
                
                # Limpiar título si tiene mix info
                if mix:
                    # Detectar tipo de mix
                    mix_lower = mix.lower()
                    if any(word in mix_lower for word in ['remix', 'mix', 'edit', 'version', 'extended', 'radio']):
                        title = f"{title} ({mix})"
                
                return {
                    'artist': artist,
                    'title': title,
                    'filename': filename
                }
            elif len(groups) == 1:
                # Solo tenemos el título
                return {
                    'artist': 'Unknown Artist',
                    'title': groups[0].strip(),
                    'filename': filename
                }
    
    # No se pudo parsear
    return {
        'artist': 'Unknown Artist',
        'title': name,
        'filename': filename
    }

def extract_year_from_filename(filename: str) -> Optional[int]:
    """
    Intenta extraer el año del nombre de archivo
    
    Busca patrones como:
    - (1984)
    - [1984]
    - _1984_
    """
    
    year_patterns = [
        r'\((\d{4})\)',  # (1984)
        r'\[(\d{4})\]',  # [1984]
        r'_(\d{4})_',    # _1984_
        r'\b(19[5-9]\d|20[0-2]\d)\b'  # Años 1950-2029 como palabra completa
    ]
    
    for pattern in year_patterns:
        match = re.search(pattern, filename)
        if match:
            year = int(match.group(1))
            if 1950 <= year <= 2030:  # Validar rango razonable
                return year
    
    return None

def detect_genre_from_filename(filename: str) -> Optional[str]:
    """
    Detecta género desde palabras clave en el nombre
    """
    
    filename_lower = filename.lower()
    
    genre_keywords = {
        'Disco': ['disco', '12"', '12 inch', 'extended'],
        'House': ['house', 'deep house', 'tech house'],
        'Techno': ['techno', 'minimal', 'detroit'],
        'Salsa': ['salsa', 'timba', 'mambo'],
        'Reggaeton': ['reggaeton', 'perreo', 'dembow'],
        'Hip-Hop': ['hip hop', 'rap', 'hip-hop'],
        'Rock': ['rock', 'metal', 'punk'],
        'Pop': ['pop'],
        'Jazz': ['jazz', 'bebop', 'swing'],
        'Classical': ['classical', 'symphony', 'orchestra'],
        'Electronic': ['electronic', 'edm', 'electro'],
        'R&B': ['r&b', 'rnb', 'soul', 'motown'],
    }
    
    for genre, keywords in genre_keywords.items():
        if any(keyword in filename_lower for keyword in keywords):
            return genre
    
    return None

# Tests
if __name__ == "__main__":
    test_files = [
        "Black Eyed Peas - My Humps.flac",
        "Frankie Goes To Hollywood - Relax (New York Mix).flac",
        "George Michael - Careless Whisper.flac",
        "2 Unlimited - No Limit (Extended Mix).flac",
        "Donna Summer - I Feel Love (12 Inch Version) (1977).flac",
        "Madonna feat. Justin Timberlake - 4 Minutes.mp3",
        "Unknown Track.flac"
    ]
    
    print("FILENAME PARSER TESTS:\n")
    for filename in test_files:
        result = parse_filename(filename)
        year = extract_year_from_filename(filename)
        genre = detect_genre_from_filename(filename)
        
        print(f"📁 {filename}")
        print(f"  • Artist: {result['artist']}")
        print(f"  • Title: {result['title']}")
        if year:
            print(f"  • Year: {year}")
        if genre:
            print(f"  • Genre hint: {genre}")
        print()