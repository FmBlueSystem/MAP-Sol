"""
Tests for the harmonic engine module.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from playlist_generation.harmonic_engine import HarmonicEngine


def test_compatibles():
    """Test compatible keys generation."""
    he = HarmonicEngine()
    
    # Test 8A compatibility
    comp_8a = sorted(he.compatibles('8A'))
    assert '8A' in comp_8a, "Should include same key"
    assert '7A' in comp_8a, "Should include -1 on wheel"
    assert '9A' in comp_8a, "Should include +1 on wheel"
    assert '8B' in comp_8a, "Should include relative key"
    assert '6A' in comp_8a, "Should include -2 on wheel (good)"
    assert '10A' in comp_8a, "Should include +2 on wheel (good)"
    
    # Test edge cases (wrap around)
    comp_1a = he.compatibles('1A')
    assert '12A' in comp_1a, "Should wrap from 1 to 12"
    assert '2A' in comp_1a, "Should include next"
    
    comp_12b = he.compatibles('12B')
    assert '1B' in comp_12b, "Should wrap from 12 to 1"
    assert '11B' in comp_12b, "Should include previous"
    
    print("✓ compatibles tests passed")


def test_is_compatible():
    """Test key compatibility checking."""
    he = HarmonicEngine()
    
    # Perfect matches
    assert he.is_compatible('8A', '9A'), "Adjacent keys should be compatible"
    assert he.is_compatible('8A', '7A'), "Adjacent keys should be compatible"
    assert he.is_compatible('8A', '8B'), "Relative keys should be compatible"
    
    # Good matches
    assert he.is_compatible('8A', '10A'), "+2 should be compatible"
    assert he.is_compatible('8A', '6A'), "-2 should be compatible"
    
    # Non-compatible
    assert not he.is_compatible('8A', '3A'), "Distant keys should not be compatible"
    assert not he.is_compatible('8A', '1A'), "Distant keys should not be compatible"
    
    # Invalid input
    assert not he.is_compatible('invalid', '8A'), "Invalid key should return False"
    assert not he.is_compatible('8A', ''), "Empty key should return False"
    
    print("✓ is_compatible tests passed")


def test_compatibility_score():
    """Test compatibility scoring."""
    he = HarmonicEngine()
    
    # Same key
    assert he.compatibility_score('8A', '8A') == 1.0, "Same key should score 1.0"
    
    # Perfect matches
    score_adjacent = he.compatibility_score('8A', '9A')
    assert 0.85 <= score_adjacent <= 0.95, f"Adjacent should score ~0.9, got {score_adjacent}"
    
    score_relative = he.compatibility_score('8A', '8B')
    assert 0.85 <= score_relative <= 0.95, f"Relative should score ~0.9, got {score_relative}"
    
    # Good matches
    score_good = he.compatibility_score('8A', '10A')
    assert 0.75 <= score_good <= 0.85, f"+2 should score ~0.8, got {score_good}"
    
    # Poor matches
    score_poor = he.compatibility_score('8A', '3A')
    assert score_poor < 0.7, f"Distant keys should score low, got {score_poor}"
    
    print("✓ compatibility_score tests passed")


def test_bpm_compatible():
    """Test BPM compatibility."""
    he = HarmonicEngine()
    
    # Flexible policy (±6%)
    assert he.bpm_compatible(125, 128, 'flexible'), "125->128 should be compatible (flexible)"
    assert he.bpm_compatible(125, 132, 'flexible'), "125->132 should be compatible (flexible)"
    assert not he.bpm_compatible(125, 135, 'flexible'), "125->135 should not be compatible (flexible)"
    
    # Strict policy (±3%)
    assert he.bpm_compatible(120, 123, 'strict'), "120->123 should be compatible (strict)"
    assert not he.bpm_compatible(120, 140, 'strict'), "120->140 should not be compatible (strict)"
    
    # Creative policy (±10% + half/double time)
    assert he.bpm_compatible(64, 128, 'creative'), "64->128 should be compatible (double time)"
    assert he.bpm_compatible(128, 64, 'creative'), "128->64 should be compatible (half time)"
    assert he.bpm_compatible(125, 137, 'creative'), "125->137 should be compatible (within 10%)"
    
    # Invalid input
    assert not he.bpm_compatible(0, 128, 'flexible'), "Zero BPM should return False"
    assert not he.bpm_compatible(None, 128, 'flexible'), "None BPM should return False"
    
    print("✓ bpm_compatible tests passed")


if __name__ == '__main__':
    test_compatibles()
    test_is_compatible()
    test_compatibility_score()
    test_bpm_compatible()
    print("\n✅ All harmonic engine tests passed!")