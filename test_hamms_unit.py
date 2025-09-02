#!/usr/bin/env python3
"""
Lightweight HAMMS unit tests for key mapping and compatibility.
Run with: PYTHONPATH=src pytest -q
"""

from pathlib import Path

import pytest


def _make_analyzer(tmp_db: Path):
    tmp_db.parent.mkdir(parents=True, exist_ok=True)
    from hamms_analyzer import HAMMSAnalyzer
    return HAMMSAnalyzer(db_path=tmp_db)


def test_camelot_numeric_mapping(tmp_path):
    analyzer = _make_analyzer(tmp_path / "hamms_test.db")
    try:
        # Standard keys
        assert analyzer.camelot_to_numeric("C") == pytest.approx(7 / 11, abs=1e-3)
        assert analyzer.camelot_to_numeric("Am") == pytest.approx((7 / 11) - 0.042, abs=1e-3)

        # Camelot inputs pass-through
        assert analyzer.camelot_to_numeric("8A") == pytest.approx((7 / 11) - 0.042, abs=1e-3)
        assert analyzer.camelot_to_numeric("11B") == pytest.approx((10 / 11), abs=1e-3)
    finally:
        analyzer.close()


def test_harmonic_distance(tmp_path):
    analyzer = _make_analyzer(tmp_path / "hamms_test.db")
    try:
        # Same key
        assert analyzer.calculate_harmonic_distance("8A", "8A") == 0
        # Adjacent numbers, same letter
        assert analyzer.calculate_harmonic_distance("8A", "9A") == 1
        # Same number, different letter (major/minor)
        assert analyzer.calculate_harmonic_distance("8A", "8B") == 1
        # Further apart
        assert analyzer.calculate_harmonic_distance("8A", "10B") == 3
    finally:
        analyzer.close()


def test_mix_compatibility_with_fallbacks(tmp_path):
    analyzer = _make_analyzer(tmp_path / "hamms_test.db")
    try:
        # Only initial_key and energy_level provided; bpm close
        t1 = {"initial_key": "8A", "energy_level": 7, "bpm": 128}
        t2 = {"initial_key": "9A", "energy_level": 7, "bpm": 129}
        comp = analyzer.calculate_mix_compatibility(t1, t2)
        assert comp["bpm_compatible"] is True
        assert comp["harmonic_compatible"] is True
        assert comp["compatibility_score"] > 0.75
    finally:
        analyzer.close()

