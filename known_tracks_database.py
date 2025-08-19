#!/usr/bin/env python3
"""
Base de datos de canciones conocidas para validación cruzada
Cuando el ISRC es incorrecto o está reasignado, usamos esta base de datos
"""

KNOWN_TRACKS = {
    # 2 Unlimited
    "2 Unlimited - No Limit": {
        "year": 1993,
        "genre": "Eurodance",
        "notes": "Hit mundial de Eurodance, NO del 2000"
    },
    "2 Unlimited - Get Ready for This": {
        "year": 1991,
        "genre": "Eurodance"
    },
    "2 Unlimited - Twilight Zone": {
        "year": 1992,
        "genre": "Eurodance"
    },
    
    # Frankie Goes To Hollywood
    "Frankie Goes To Hollywood - Relax": {
        "year": 1983,
        "genre": "New Wave/Synthpop",
        "notes": "Controversial hit de 1983"
    },
    "Frankie Goes To Hollywood - Two Tribes": {
        "year": 1984,
        "genre": "New Wave/Synthpop"
    },
    
    # George Michael / Wham!
    "George Michael - Careless Whisper": {
        "year": 1984,
        "genre": "Pop/Soul",
        "notes": "Originalmente acreditada a Wham! featuring George Michael"
    },
    "George Michael - Faith": {
        "year": 1987,
        "genre": "Pop/Rock"
    },
    "George Michael - Father Figure": {
        "year": 1987,
        "genre": "Pop/Soul"
    },
    
    # France Joli
    "France Joli - Come to Me": {
        "year": 1979,
        "genre": "Disco",
        "notes": "Producida por Tony Green"
    },
    "France Joli - Gonna Get Over You": {
        "year": 1981,
        "genre": "Post-Disco"
    },
    
    # Frankie Ruiz
    "Frankie Ruiz - Deseándote": {
        "year": 1991,
        "genre": "Salsa",
        "notes": "Salsa romántica"
    },
    "Frankie Ruiz - Tu Con El": {
        "year": 1985,
        "genre": "Salsa"
    },
    
    # Black Eyed Peas
    "Black Eyed Peas - My Humps": {
        "year": 2005,
        "genre": "Hip-Hop/Pop"
    },
    "Black Eyed Peas - I Gotta Feeling": {
        "year": 2009,
        "genre": "Pop/Dance"
    },
    
    # Classic Disco
    "George McCrae - Rock Your Baby": {
        "year": 1974,
        "genre": "Disco/Soul",
        "notes": "First #1 disco hit, produced by Harry Wayne Casey"
    },
    "Donna Summer - I Feel Love": {
        "year": 1977,
        "genre": "Disco",
        "notes": "Pionera del disco electrónico"
    },
    "Bee Gees - Stayin' Alive": {
        "year": 1977,
        "genre": "Disco"
    },
    "Gloria Gaynor - I Will Survive": {
        "year": 1978,
        "genre": "Disco"
    },
    
    # 80s Hits
    "Michael Jackson - Billie Jean": {
        "year": 1982,
        "genre": "Pop/Funk"
    },
    "Michael Jackson - Thriller": {
        "year": 1982,
        "genre": "Pop/Funk"
    },
    "Prince - Purple Rain": {
        "year": 1984,
        "genre": "Rock/Pop"
    },
    "Madonna - Like a Virgin": {
        "year": 1984,
        "genre": "Pop"
    },
    "Madonna - Material Girl": {
        "year": 1984,
        "genre": "Pop"
    },
    
    # 90s Dance
    "Haddaway - What Is Love": {
        "year": 1993,
        "genre": "Eurodance"
    },
    "Corona - The Rhythm of the Night": {
        "year": 1993,
        "genre": "Eurodance"
    },
    "La Bouche - Be My Lover": {
        "year": 1995,
        "genre": "Eurodance"
    },
    
    # Latin Classics
    "Celia Cruz - La Vida Es Un Carnaval": {
        "year": 1998,
        "genre": "Salsa"
    },
    "Marc Anthony - Vivir Mi Vida": {
        "year": 2013,
        "genre": "Salsa"
    },
    "Juan Luis Guerra - Bachata Rosa": {
        "year": 1990,
        "genre": "Bachata"
    },
    "Daddy Yankee - Gasolina": {
        "year": 2004,
        "genre": "Reggaeton"
    },
}

def lookup_track(artist: str, title: str) -> dict:
    """
    Busca una canción en la base de datos
    
    Args:
        artist: Nombre del artista
        title: Título de la canción
        
    Returns:
        Dict con información conocida o None
    """
    # Limpiar título (remover paréntesis con remix/mix info)
    import re
    clean_title = re.sub(r'\s*\([^)]*(?:mix|remix|version|edit|extended)[^)]*\)', '', title, flags=re.I)
    clean_title = clean_title.strip()
    
    # Intentar búsqueda exacta
    key = f"{artist} - {clean_title}"
    if key in KNOWN_TRACKS:
        return KNOWN_TRACKS[key]
    
    # Intentar búsqueda parcial
    for track_key, info in KNOWN_TRACKS.items():
        track_artist = track_key.split(' - ')[0].lower()
        track_title = track_key.split(' - ')[1].lower()
        
        if (artist.lower() == track_artist and 
            clean_title.lower() == track_title):
            return info
        
        # Búsqueda más flexible
        if (artist.lower() in track_artist or track_artist in artist.lower()) and \
           (clean_title.lower() in track_title or track_title in clean_title.lower()):
            return info
    
    return None

def validate_year(artist: str, title: str, isrc_year: int, metadata_year: int) -> tuple:
    """
    Valida el año usando la base de datos conocida
    
    Returns:
        Tuple de (año_correcto, explicación)
    """
    known = lookup_track(artist, title)
    
    if known:
        correct_year = known['year']
        
        # Si coincide con ISRC, confiar en ISRC
        if abs(isrc_year - correct_year) <= 1:
            return isrc_year, f"Year {isrc_year} confirmed by ISRC and database"
        
        # Si coincide con metadata, confiar en metadata
        if abs(metadata_year - correct_year) <= 1:
            return metadata_year, f"Year {metadata_year} confirmed by metadata and database"
        
        # Si ninguno coincide, usar el conocido
        notes = known.get('notes', '')
        return correct_year, f"Known track from {correct_year} (database). {notes}"
    
    # No está en la base de datos, usar lógica normal
    return None, None