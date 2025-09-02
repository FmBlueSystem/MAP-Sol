"""
Harmonic compatibility engine for Camelot Wheel and BPM matching.
"""

from utils.music_keys import normalize_camelot


class HarmonicEngine:
    """Engine for harmonic and BPM compatibility calculations."""
    
    def __init__(self):
        """Initialize the harmonic engine."""
        pass
    
    def compatibles(self, camelot_key: str, mode: str = 'perfect_good') -> list[str]:
        """
        Get compatible keys based on Camelot Wheel rules.
        
        Args:
            camelot_key: Camelot key (e.g., '8A', '10B')
            mode: Compatibility mode
                - 'perfect': same key, ±1 on wheel, relative (A↔B)
                - 'good': ±2 on wheel
                - 'perfect_good': both perfect and good (default)
                
        Returns:
            List of compatible Camelot keys
        """
        # Normalize input
        key = normalize_camelot(camelot_key)
        if not key:
            return []
        
        # Parse key components
        num = int(key[:-1])
        letter = key[-1]
        
        compatible_keys = []
        
        # Always include same key
        compatible_keys.append(key)
        
        # Perfect matches: ±1 on the wheel
        prev_num = 12 if num == 1 else num - 1
        next_num = 1 if num == 12 else num + 1
        
        compatible_keys.append(f"{prev_num}{letter}")  # -1 same letter
        compatible_keys.append(f"{next_num}{letter}")  # +1 same letter
        
        # Relative key (A↔B)
        relative_letter = 'B' if letter == 'A' else 'A'
        compatible_keys.append(f"{num}{relative_letter}")
        
        # Good matches: ±2 on the wheel
        if mode in ('good', 'perfect_good'):
            prev2_num = 11 if num == 1 else 12 if num == 2 else num - 2
            next2_num = 2 if num == 12 else 1 if num == 11 else num + 2
            
            compatible_keys.append(f"{prev2_num}{letter}")  # -2 same letter
            compatible_keys.append(f"{next2_num}{letter}")  # +2 same letter
        
        return compatible_keys
    
    def is_compatible(self, k1: str, k2: str, mode: str = 'perfect_good') -> bool:
        """
        Check if two keys are compatible.
        
        Args:
            k1: First Camelot key
            k2: Second Camelot key
            mode: Compatibility mode (same as compatibles())
            
        Returns:
            True if compatible, False otherwise
        """
        # Normalize inputs
        key1 = normalize_camelot(k1)
        key2 = normalize_camelot(k2)
        
        if not key1 or not key2:
            return False
        
        # Get compatible keys for k1
        compatible = self.compatibles(key1, mode)
        
        return key2 in compatible
    
    def compatibility_score(self, k1: str, k2: str) -> float:
        """
        Calculate compatibility score between two keys.
        
        Args:
            k1: First Camelot key
            k2: Second Camelot key
            
        Returns:
            Score from 0.0 to 1.0
            - 1.0: same key
            - ~0.9: perfect match (±1 or relative)
            - ~0.8: good match (±2)
            - decreasing with distance
        """
        # Normalize inputs
        key1 = normalize_camelot(k1)
        key2 = normalize_camelot(k2)
        
        if not key1 or not key2:
            return 0.0
        
        # Same key
        if key1 == key2:
            return 1.0
        
        # Parse keys
        num1 = int(key1[:-1])
        letter1 = key1[-1]
        num2 = int(key2[:-1])
        letter2 = key2[-1]
        
        # Calculate distance on wheel
        num_dist = abs(num1 - num2)
        # Handle circular distance
        if num_dist > 6:
            num_dist = 12 - num_dist
        
        # Perfect matches
        if num_dist == 0 and letter1 != letter2:  # Relative key
            return 0.9
        elif num_dist == 1 and letter1 == letter2:  # ±1 same letter
            return 0.9
        # Good matches
        elif num_dist == 2 and letter1 == letter2:  # ±2 same letter
            return 0.8
        # Other distances
        else:
            # Score decreases with distance
            base_score = 0.7
            if letter1 != letter2:
                base_score -= 0.1  # Different letter penalty
            score = base_score - (num_dist * 0.1)
            return max(0.0, score)
    
    def bpm_compatible(self, bpm1: float, bpm2: float, policy: str = 'flexible') -> bool:
        """
        Check if two BPMs are compatible based on policy.
        
        Args:
            bpm1: First BPM
            bpm2: Second BPM
            policy: Compatibility policy
                - 'strict': ±3%
                - 'flexible': ±6% (default)
                - 'creative': ±10% with half/double time support
                
        Returns:
            True if compatible, False otherwise
        """
        if not bpm1 or not bpm2:
            return False
        
        # Calculate percentage difference
        diff_percent = abs(bpm1 - bpm2) / bpm1 * 100
        
        if policy == 'strict':
            return diff_percent <= 3.0
        elif policy == 'flexible':
            return diff_percent <= 6.0
        elif policy == 'creative':
            # Direct compatibility within 10%
            if diff_percent <= 10.0:
                return True
            
            # Check half-time compatibility (e.g., 64 ↔ 128)
            half_bpm1 = bpm1 / 2
            double_bpm1 = bpm1 * 2
            
            # Check if bpm2 is compatible with half or double of bpm1
            half_diff = abs(half_bpm1 - bpm2) / half_bpm1 * 100 if half_bpm1 > 0 else 100
            double_diff = abs(double_bpm1 - bpm2) / double_bpm1 * 100
            
            return half_diff <= 10.0 or double_diff <= 10.0
        
        return False