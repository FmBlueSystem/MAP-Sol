"""
Music key conversion utilities for Camelot Wheel notation.
"""


def normalize_camelot(code: str) -> str | None:
    """
    Normalize a Camelot code to standard format (e.g., '8A', '10B').
    
    Args:
        code: Camelot code to normalize
        
    Returns:
        Normalized Camelot code or None if invalid
    """
    if not code:
        return None
    
    # Remove spaces and convert to uppercase
    code = code.strip().upper()
    
    # Check valid format: 1-12 followed by A or B
    if len(code) < 2 or len(code) > 3:
        return None
    
    # Extract number and letter parts
    if code[-1] not in ('A', 'B'):
        return None
    
    try:
        num = int(code[:-1])
        if num < 1 or num > 12:
            return None
        letter = code[-1]
        return f"{num}{letter}"
    except ValueError:
        return None


def to_camelot(key: str) -> str | None:
    """
    Convert a musical key to Camelot notation.
    
    Args:
        key: Musical key in standard notation (e.g., 'C', 'Am', 'F#m') 
             or already in Camelot notation
             
    Returns:
        Camelot code (e.g., '8B', '8A') or None if not recognized
    """
    if not key:
        return None
    
    # First try to normalize as Camelot
    camelot = normalize_camelot(key)
    if camelot:
        return camelot
    
    # Standard to Camelot mapping
    # Major keys (B suffix in Camelot)
    major_to_camelot = {
        'C': '8B',
        'G': '9B', 
        'D': '10B',
        'A': '11B',
        'E': '12B',
        'B': '1B',
        'F#': '2B', 'Gb': '2B',
        'C#': '3B', 'Db': '3B',
        'G#': '4B', 'Ab': '4B',
        'D#': '5B', 'Eb': '5B',
        'A#': '6B', 'Bb': '6B',
        'F': '7B',
    }
    
    # Minor keys (A suffix in Camelot)
    minor_to_camelot = {
        'Am': '8A', 'A min': '8A', 'A minor': '8A',
        'Em': '9A', 'E min': '9A', 'E minor': '9A',
        'Bm': '10A', 'B min': '10A', 'B minor': '10A',
        'F#m': '11A', 'Gbm': '11A', 'F# min': '11A', 'Gb min': '11A',
        'C#m': '12A', 'Dbm': '12A', 'C# min': '12A', 'Db min': '12A',
        'G#m': '1A', 'Abm': '1A', 'G# min': '1A', 'Ab min': '1A',
        'D#m': '2A', 'Ebm': '2A', 'D# min': '2A', 'Eb min': '2A',
        'A#m': '3A', 'Bbm': '3A', 'A# min': '3A', 'Bb min': '3A',
        'Fm': '4A', 'F min': '4A', 'F minor': '4A',
        'Cm': '5A', 'C min': '5A', 'C minor': '5A',
        'Gm': '6A', 'G min': '6A', 'G minor': '6A',
        'Dm': '7A', 'D min': '7A', 'D minor': '7A',
    }
    
    # Normalize input
    key = key.strip()
    
    # Check major keys
    if key in major_to_camelot:
        return major_to_camelot[key]
    
    # Check minor keys
    if key in minor_to_camelot:
        return minor_to_camelot[key]
    
    # Try with 'maj' suffix for major keys
    if key.endswith(' maj') or key.endswith(' major'):
        base_key = key.replace(' major', '').replace(' maj', '').strip()
        if base_key in major_to_camelot:
            return major_to_camelot[base_key]
    
    return None