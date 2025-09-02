from __future__ import annotations

from typing import Dict, Any, Tuple


def infer_genre_mood(features: Dict[str, Any], fallback_bpm: float | None, existing: Dict[str, Any] | None = None) -> Tuple[str | None, str | None]:
    """Heuristic genre/mood inference using tempo and spectral features.

    This avoids requiring trained models while providing useful defaults.
    Returns (genre, mood) or (None, None) if indeterminate.
    """
    bpm = features.get("tempo") or fallback_bpm or 120.0
    spec = features.get("spectral_centroid") or 0.0
    # Normalize spectral centroid threshold roughly relative to 22kHz
    # Heuristic buckets
    if bpm < 95:
        genre = "Hip Hop" if spec < 2500 else "Pop"
        mood = "chill" if spec < 2500 else "uplifting"
    elif bpm < 115:
        genre = "Reggaeton" if spec < 3000 else "Pop"
        mood = "groovy" if spec < 3000 else "bright"
    elif bpm < 130:
        genre = "House"
        mood = "driving" if spec >= 3000 else "warm"
    elif bpm < 150:
        genre = "Techno"
        mood = "dark" if spec < 3000 else "energetic"
    else:
        genre = "Drum & Bass"
        mood = "energetic"

    # Respect existing hints if present
    if existing:
        if existing.get("genre"):
            genre = existing["genre"]
    return genre, mood

