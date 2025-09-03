"""Advanced genre classification with subgenres based on audio features."""

from typing import Dict, Tuple, Optional, Any
import numpy as np
from utils.logger import setup_logger

logger = setup_logger(__name__)


class AdvancedGenreClassifier:
    """Advanced genre and subgenre classification using multiple audio features."""
    
    # Genre definitions with BPM ranges and characteristics
    GENRE_PROFILES = {
        "Electronic": {
            "bpm_range": (110, 180),
            "subgenres": {
                "House": {"bpm": (118, 135), "energy": (0.5, 0.8), "spectral": (2500, 4000)},
                "Deep House": {"bpm": (118, 125), "energy": (0.4, 0.6), "spectral": (2000, 3000)},
                "Tech House": {"bpm": (124, 130), "energy": (0.6, 0.8), "spectral": (3000, 4000)},
                "Progressive House": {"bpm": (126, 132), "energy": (0.6, 0.85), "spectral": (3000, 4500)},
                "Techno": {"bpm": (130, 150), "energy": (0.7, 0.9), "spectral": (2500, 4000)},
                "Minimal Techno": {"bpm": (125, 135), "energy": (0.5, 0.7), "spectral": (2000, 3000)},
                "Trance": {"bpm": (135, 145), "energy": (0.7, 0.95), "spectral": (3500, 5000)},
                "Drum & Bass": {"bpm": (160, 180), "energy": (0.8, 1.0), "spectral": (3000, 5000)},
                "Dubstep": {"bpm": (138, 142), "energy": (0.6, 0.9), "spectral": (1500, 3000)},
                "Future Bass": {"bpm": (140, 160), "energy": (0.6, 0.85), "spectral": (3000, 4500)},
                "Melodic Techno": {"bpm": (120, 125), "energy": (0.5, 0.75), "spectral": (2500, 3500)},
                "Afro House": {"bpm": (120, 124), "energy": (0.6, 0.8), "spectral": (2500, 3500)},
            }
        },
        "Hip Hop": {
            "bpm_range": (65, 115),
            "subgenres": {
                "Trap": {"bpm": (130, 150), "energy": (0.7, 0.95), "spectral": (2000, 3500)},
                "Boom Bap": {"bpm": (85, 95), "energy": (0.5, 0.7), "spectral": (2000, 3000)},
                "Lo-Fi Hip Hop": {"bpm": (70, 90), "energy": (0.3, 0.5), "spectral": (1500, 2500)},
                "Drill": {"bpm": (138, 144), "energy": (0.7, 0.9), "spectral": (2000, 3000)},
                "Cloud Rap": {"bpm": (120, 140), "energy": (0.4, 0.6), "spectral": (2000, 3000)},
                "G-Funk": {"bpm": (90, 100), "energy": (0.5, 0.7), "spectral": (2500, 3500)},
            }
        },
        "Pop": {
            "bpm_range": (100, 130),
            "subgenres": {
                "Dance Pop": {"bpm": (120, 128), "energy": (0.7, 0.9), "spectral": (3000, 4500)},
                "Electropop": {"bpm": (115, 130), "energy": (0.6, 0.85), "spectral": (3000, 4000)},
                "Indie Pop": {"bpm": (110, 125), "energy": (0.4, 0.7), "spectral": (2500, 3500)},
                "Synth Pop": {"bpm": (110, 125), "energy": (0.5, 0.8), "spectral": (3000, 4000)},
                "K-Pop": {"bpm": (120, 140), "energy": (0.7, 0.95), "spectral": (3500, 5000)},
            }
        },
        "Latin": {
            "bpm_range": (90, 180),
            "subgenres": {
                "Reggaeton": {"bpm": (90, 100), "energy": (0.7, 0.9), "spectral": (2500, 3500)},
                "Perreo": {"bpm": (88, 95), "energy": (0.75, 0.95), "spectral": (2500, 3500)},
                "Latin Trap": {"bpm": (85, 95), "energy": (0.7, 0.9), "spectral": (2000, 3000)},
                "Salsa": {"bpm": (150, 180), "energy": (0.7, 0.9), "spectral": (3000, 4000)},
                "Bachata": {"bpm": (120, 140), "energy": (0.5, 0.7), "spectral": (2500, 3500)},
                "Cumbia": {"bpm": (85, 110), "energy": (0.6, 0.8), "spectral": (2500, 3500)},
                "Merengue": {"bpm": (120, 140), "energy": (0.7, 0.9), "spectral": (3000, 4000)},
            }
        },
        "R&B": {
            "bpm_range": (60, 100),
            "subgenres": {
                "Contemporary R&B": {"bpm": (70, 90), "energy": (0.4, 0.7), "spectral": (2000, 3000)},
                "Alternative R&B": {"bpm": (70, 95), "energy": (0.3, 0.6), "spectral": (1800, 2800)},
                "Neo Soul": {"bpm": (75, 95), "energy": (0.4, 0.6), "spectral": (2000, 3000)},
                "Trap Soul": {"bpm": (120, 140), "energy": (0.5, 0.7), "spectral": (2000, 3000)},
            }
        },
        "Rock": {
            "bpm_range": (100, 180),
            "subgenres": {
                "Alternative Rock": {"bpm": (110, 140), "energy": (0.6, 0.85), "spectral": (2500, 4000)},
                "Indie Rock": {"bpm": (110, 135), "energy": (0.5, 0.75), "spectral": (2500, 3500)},
                "Punk Rock": {"bpm": (140, 180), "energy": (0.8, 1.0), "spectral": (3000, 4500)},
                "Hard Rock": {"bpm": (110, 140), "energy": (0.7, 0.95), "spectral": (3000, 4500)},
            }
        },
        "Jazz": {
            "bpm_range": (60, 180),
            "subgenres": {
                "Smooth Jazz": {"bpm": (80, 120), "energy": (0.3, 0.5), "spectral": (2000, 3000)},
                "Bebop": {"bpm": (140, 280), "energy": (0.6, 0.8), "spectral": (2500, 3500)},
                "Cool Jazz": {"bpm": (100, 140), "energy": (0.3, 0.5), "spectral": (2000, 3000)},
                "Jazz Fusion": {"bpm": (100, 140), "energy": (0.5, 0.8), "spectral": (2500, 4000)},
            }
        },
        "Ambient": {
            "bpm_range": (60, 100),
            "subgenres": {
                "Ambient": {"bpm": (60, 90), "energy": (0.1, 0.3), "spectral": (1000, 2000)},
                "Chillout": {"bpm": (80, 100), "energy": (0.2, 0.4), "spectral": (1500, 2500)},
                "Downtempo": {"bpm": (70, 100), "energy": (0.3, 0.5), "spectral": (1800, 2800)},
            }
        }
    }
    
    @classmethod
    def classify(cls, features: Dict[str, Any], existing_genre: Optional[str] = None) -> Dict[str, Any]:
        """
        Classify genre and subgenre based on audio features.
        
        Args:
            features: Audio features including tempo, energy, spectral_centroid
            existing_genre: Existing genre tag if available
            
        Returns:
            Dict with genre, subgenre, confidence, and characteristics
        """
        # Extract features
        bpm = features.get("tempo", 120)
        energy = features.get("energy", 0.5)
        spectral = features.get("spectral_centroid", 3000)
        
        # Normalize energy to 0-1 if it's 0-10
        if energy > 1:
            energy = energy / 10.0
            
        # If we have existing genre, try to find subgenre within it
        if existing_genre:
            for main_genre, profile in cls.GENRE_PROFILES.items():
                if existing_genre.lower() in main_genre.lower():
                    subgenre, confidence = cls._find_best_subgenre(
                        bpm, energy, spectral, profile["subgenres"]
                    )
                    return {
                        "genre": main_genre,
                        "subgenre": subgenre,
                        "confidence": confidence,
                        "characteristics": cls._get_characteristics(bpm, energy, spectral)
                    }
        
        # Find best matching genre and subgenre
        best_genre = None
        best_subgenre = None
        best_score = 0
        
        for genre, profile in cls.GENRE_PROFILES.items():
            # Check if BPM is in general range
            if profile["bpm_range"][0] <= bpm <= profile["bpm_range"][1]:
                subgenre, score = cls._find_best_subgenre(
                    bpm, energy, spectral, profile["subgenres"]
                )
                if score > best_score:
                    best_score = score
                    best_genre = genre
                    best_subgenre = subgenre
        
        # Fallback if no good match
        if not best_genre:
            best_genre = cls._fallback_genre(bpm, energy)
            best_subgenre = None
            best_score = 0.3
        
        return {
            "genre": best_genre,
            "subgenre": best_subgenre,
            "confidence": best_score,
            "characteristics": cls._get_characteristics(bpm, energy, spectral)
        }
    
    @staticmethod
    def _find_best_subgenre(bpm: float, energy: float, spectral: float, 
                           subgenres: Dict) -> Tuple[str, float]:
        """Find best matching subgenre based on features."""
        best_match = None
        best_score = 0
        
        for subgenre, profile in subgenres.items():
            score = 0
            weight_sum = 0
            
            # BPM matching (most important)
            if profile["bpm"][0] <= bpm <= profile["bpm"][1]:
                bpm_center = (profile["bpm"][0] + profile["bpm"][1]) / 2
                bpm_range = profile["bpm"][1] - profile["bpm"][0]
                bpm_score = 1.0 - abs(bpm - bpm_center) / (bpm_range / 2)
                score += bpm_score * 0.5
                weight_sum += 0.5
            
            # Energy matching
            if profile["energy"][0] <= energy <= profile["energy"][1]:
                energy_center = (profile["energy"][0] + profile["energy"][1]) / 2
                energy_range = profile["energy"][1] - profile["energy"][0]
                energy_score = 1.0 - abs(energy - energy_center) / (energy_range / 2)
                score += energy_score * 0.3
                weight_sum += 0.3
            
            # Spectral matching
            if profile["spectral"][0] <= spectral <= profile["spectral"][1]:
                spectral_center = (profile["spectral"][0] + profile["spectral"][1]) / 2
                spectral_range = profile["spectral"][1] - profile["spectral"][0]
                spectral_score = 1.0 - abs(spectral - spectral_center) / (spectral_range / 2)
                score += spectral_score * 0.2
                weight_sum += 0.2
            
            # Normalize score
            if weight_sum > 0:
                score = score / weight_sum
            
            if score > best_score:
                best_score = score
                best_match = subgenre
        
        return best_match, best_score
    
    @staticmethod
    def _fallback_genre(bpm: float, energy: float) -> str:
        """Simple fallback genre classification."""
        if bpm < 90:
            return "Hip Hop" if energy < 0.5 else "R&B"
        elif bpm < 115:
            return "Pop" if energy > 0.6 else "R&B"
        elif bpm < 130:
            return "Electronic"
        elif bpm < 150:
            return "Electronic" if energy > 0.7 else "Pop"
        else:
            return "Electronic"
    
    @staticmethod
    def _get_characteristics(bpm: float, energy: float, spectral: float) -> Dict[str, str]:
        """Get musical characteristics based on features."""
        characteristics = {}
        
        # Tempo characteristics
        if bpm < 70:
            characteristics["tempo"] = "very_slow"
        elif bpm < 90:
            characteristics["tempo"] = "slow"
        elif bpm < 110:
            characteristics["tempo"] = "moderate"
        elif bpm < 130:
            characteristics["tempo"] = "upbeat"
        elif bpm < 150:
            characteristics["tempo"] = "fast"
        else:
            characteristics["tempo"] = "very_fast"
        
        # Energy characteristics
        if energy < 0.3:
            characteristics["energy"] = "chill"
        elif energy < 0.5:
            characteristics["energy"] = "relaxed"
        elif energy < 0.7:
            characteristics["energy"] = "moderate"
        elif energy < 0.85:
            characteristics["energy"] = "energetic"
        else:
            characteristics["energy"] = "intense"
        
        # Brightness characteristics (from spectral centroid)
        if spectral < 2000:
            characteristics["brightness"] = "dark"
        elif spectral < 3000:
            characteristics["brightness"] = "warm"
        elif spectral < 4000:
            characteristics["brightness"] = "bright"
        else:
            characteristics["brightness"] = "brilliant"
        
        return characteristics