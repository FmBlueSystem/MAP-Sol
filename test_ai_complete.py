#!/usr/bin/env python3
"""
Complete test suite for AI analysis system.
Tests all components: OpenAI enrichment, fingerprinting, vocal analysis, and cache.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from ai_analysis.metadata_enrichment_openai import MetadataEnrichmentOpenAI
from ai_analysis.audio_fingerprint import AudioFingerprinter
from ai_analysis.vocal_instrument_analyzer import VocalInstrumentAnalyzer
from ai_analysis.cache_manager import OpenAICacheManager
from utils.logger import setup_logger

logger = setup_logger(__name__)


def test_cache_manager():
    """Test cache management system."""
    print("\n" + "="*60)
    print("🧪 TESTING CACHE MANAGER")
    print("="*60)
    
    cache = OpenAICacheManager()
    
    # Test cache operations
    test_request = {
        "title": "Test Track",
        "artist": "Test Artist"
    }
    
    # Check initial stats
    stats = cache.get_stats()
    print(f"\n📊 Initial Cache Stats:")
    print(f"  - Total entries: {stats['total_entries']}")
    print(f"  - Total hits: {stats['total_hits']}")
    print(f"  - Cost saved: ${stats['total_cost_saved']:.2f}")
    print(f"  - Cache size: {stats['cache_size_mb']:.2f} MB")
    
    # Test cache miss
    result = cache.get("test_type", test_request)
    print(f"\n🔍 Cache lookup (should miss): {result}")
    
    # Store in cache
    test_response = {
        "genre": "Electronic",
        "mood": "Energetic",
        "analysis": "Test analysis"
    }
    cache.set("test_type", test_request, test_response, cost_estimate=0.02)
    print("✅ Stored response in cache")
    
    # Test cache hit
    result = cache.get("test_type", test_request)
    print(f"🎯 Cache lookup (should hit): {result is not None}")
    
    # Updated stats
    stats = cache.get_stats()
    print(f"\n📊 Updated Cache Stats:")
    print(f"  - Total entries: {stats['total_entries']}")
    print(f"  - Total hits: {stats['total_hits']}")
    print(f"  - Cost saved: ${stats['total_cost_saved']:.2f}")
    
    return True


def test_fingerprinting():
    """Test audio fingerprinting."""
    print("\n" + "="*60)
    print("🧪 TESTING AUDIO FINGERPRINTING")
    print("="*60)
    
    fingerprinter = AudioFingerprinter()
    
    # Check if fpcalc is available
    if fingerprinter.fpcalc_path:
        print(f"✅ fpcalc found at: {fingerprinter.fpcalc_path}")
    else:
        print("⚠️  fpcalc not found. Install with: brew install chromaprint")
        print("   Fingerprinting will use MD5 hash only")
    
    # Find a test audio file
    test_files = list(Path.home().glob(".music_player_qt/test_audio/*.mp3"))
    if not test_files:
        test_files = list(Path("/Users/freddymolina/Desktop/music-app-qt/tmp").glob("*.mp3"))
    
    if test_files:
        test_file = str(test_files[0])
        print(f"\n🎵 Testing with: {Path(test_file).name}")
        
        # Generate fingerprint
        fp_data = fingerprinter.generate_fingerprint(test_file)
        
        print(f"\n📋 Fingerprint Results:")
        print(f"  - MD5 hash: {fp_data['md5'][:16]}..." if fp_data['md5'] else "  - MD5: Not generated")
        print(f"  - Chromaprint: {fp_data['chromaprint'][:20]}..." if fp_data['chromaprint'] else "  - Chromaprint: Not available")
        print(f"  - Duration: {fp_data['duration']:.2f} seconds" if fp_data['duration'] else "  - Duration: Unknown")
        print(f"  - Confidence: {fp_data['confidence']:.2f}")
        
        # Test duplicate detection
        print("\n🔍 Testing duplicate detection...")
        test_fingerprints = [
            {'track_id': 1, 'md5': fp_data['md5'], 'chromaprint': fp_data['chromaprint']},
            {'track_id': 2, 'md5': fp_data['md5'], 'chromaprint': fp_data['chromaprint']},  # Duplicate
            {'track_id': 3, 'md5': 'different_hash', 'chromaprint': 'different_fp'}
        ]
        
        duplicates = fingerprinter.find_duplicates(test_fingerprints)
        if duplicates:
            print(f"✅ Found duplicates: {duplicates}")
        else:
            print("📝 No duplicates found")
    else:
        print("⚠️  No test audio files found")
    
    return True


def test_vocal_instrument_analysis():
    """Test vocal and instrument analysis."""
    print("\n" + "="*60)
    print("🧪 TESTING VOCAL/INSTRUMENT ANALYSIS")
    print("="*60)
    
    analyzer = VocalInstrumentAnalyzer()
    
    # Check if librosa is available
    try:
        import librosa
        print("✅ Librosa available for analysis")
    except ImportError:
        print("⚠️  Librosa not available. Install with: pip install librosa")
        return False
    
    # Find a test audio file
    test_files = list(Path.home().glob(".music_player_qt/test_audio/*.mp3"))
    if not test_files:
        test_files = list(Path("/Users/freddymolina/Desktop/music-app-qt/tmp").glob("*.mp3"))
    
    if test_files:
        test_file = str(test_files[0])
        print(f"\n🎵 Analyzing: {Path(test_file).name}")
        
        # Perform analysis
        analysis = analyzer.analyze_track(test_file)
        
        # Display vocal characteristics
        vocal = analysis['vocal_characteristics']
        print(f"\n🎤 Vocal Analysis:")
        print(f"  - Has vocals: {vocal.get('has_vocals', 'Unknown')}")
        print(f"  - Vocal gender: {vocal.get('vocal_gender', 'N/A')}")
        print(f"  - Vocal style: {vocal.get('vocal_style', 'N/A')}")
        print(f"  - Presence ratio: {vocal.get('vocal_presence_ratio', 0):.2%}")
        if vocal.get('pitch_range'):
            print(f"  - Pitch range: {vocal['pitch_range']['min_note']} - {vocal['pitch_range']['max_note']}")
        print(f"  - Vibrato detected: {vocal.get('vibrato', False)}")
        
        # Display instruments
        instruments = analysis['instrumentation']
        print(f"\n🎸 Instrument Detection:")
        if instruments['detected']:
            print(f"  - Detected: {', '.join(instruments['detected'])}")
            print(f"  - Dominant: {instruments.get('dominant', 'None')}")
            print(f"  - Categories: {', '.join(instruments.get('categories', []))}")
            if instruments['confidence']:
                print("  - Confidence scores:")
                for inst, conf in instruments['confidence'].items():
                    print(f"    • {inst}: {conf:.2f}")
        else:
            print("  - No instruments detected")
        
        # Display source separation
        separation = analysis['source_separation']
        print(f"\n🎼 Source Separation:")
        print(f"  - Vocal/Instrumental ratio: {separation.get('vocal_instrumental_ratio', 0):.2f}")
        print(f"  - Separation quality: {separation.get('separation_quality', 0):.2f}")
        if separation.get('components'):
            print(f"  - Components: {', '.join(separation['components'])}")
    else:
        print("⚠️  No test audio files found")
    
    return True


def test_openai_enrichment():
    """Test OpenAI enrichment."""
    print("\n" + "="*60)
    print("🧪 TESTING OPENAI ENRICHMENT")
    print("="*60)
    
    enricher = MetadataEnrichmentOpenAI()
    
    if not enricher.enabled:
        print("❌ OpenAI not enabled. Check API key in .env file")
        return False
    
    print(f"✅ OpenAI enabled with model: {enricher.model}")
    
    # Test data
    track_data = {
        'title': 'Test Track',
        'artist': 'Test Artist',
        'album': 'Test Album',
        'year': 2024,
        'duration': 240.5
    }
    
    hamms_data = {
        'bpm': 128,
        'key': '8A',
        'energy': 8,
        'danceability': 0.85,
        'mood_valence': 0.7
    }
    
    print("\n📝 Test Track Info:")
    print(f"  - Title: {track_data['title']}")
    print(f"  - Artist: {track_data['artist']}")
    print(f"  - BPM: {hamms_data['bpm']}")
    print(f"  - Key: {hamms_data['key']}")
    
    # Check cache first
    print("\n🔍 Checking cache...")
    cache_key = enricher.cache.get_cache_key('enrich_track', {
        'track': track_data,
        'hamms': hamms_data
    })
    cached = enricher.cache.get('enrich_track', {
        'track': track_data,
        'hamms': hamms_data
    })
    
    if cached:
        print("✅ Found in cache (no API call needed)")
        result = cached
    else:
        print("📡 Not in cache, calling OpenAI API...")
        print("⏳ This may take a few seconds...")
        
        try:
            result = enricher.enrich_track(track_data, hamms_data)
            print("✅ OpenAI enrichment successful")
        except Exception as e:
            print(f"❌ OpenAI error: {e}")
            return False
    
    # Display results
    if result:
        print("\n🎯 Enrichment Results:")
        print(f"  - Genre: {result.get('genre', 'N/A')}")
        print(f"  - Subgenre: {result.get('subgenre', 'N/A')}")
        print(f"  - Mood: {result.get('mood', 'N/A')}")
        print(f"  - Era: {result.get('era', 'N/A')}")
        print(f"  - Production quality: {result.get('production_quality', 0)}/10")
        print(f"  - Commercial potential: {result.get('commercial_potential', 0)}/10")
        
        if result.get('dj_notes'):
            print(f"\n🎧 DJ Notes:")
            print(f"  {result['dj_notes'][:200]}...")
        
        # Show cache stats
        stats = enricher.cache.get_stats()
        print(f"\n💰 Cache Statistics:")
        print(f"  - Total API calls cached: {stats['total_entries']}")
        print(f"  - Cache hits: {stats['total_hits']}")
        print(f"  - Estimated cost saved: ${stats['total_cost_saved']:.2f}")
    
    return True


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("   🚀 COMPLETE AI ANALYSIS SYSTEM TEST")
    print("="*80)
    print(f"\nStarting tests at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        ("Cache Manager", test_cache_manager),
        ("Audio Fingerprinting", test_fingerprinting),
        ("Vocal/Instrument Analysis", test_vocal_instrument_analysis),
        ("OpenAI Enrichment", test_openai_enrichment)
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            logger.error(f"Test {name} failed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*80)
    print("   📊 TEST SUMMARY")
    print("="*80)
    
    for name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"  {name}: {status}")
    
    total_passed = sum(1 for _, s in results if s)
    total_tests = len(results)
    
    print(f"\n  Total: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("\n🎉 All AI analysis systems are operational!")
    else:
        print("\n⚠️  Some systems need attention. Check the logs above.")
    
    # Final recommendations
    print("\n" + "="*80)
    print("   💡 RECOMMENDATIONS")
    print("="*80)
    
    recommendations = []
    
    # Check fpcalc
    fp = AudioFingerprinter()
    if not fp.fpcalc_path:
        recommendations.append("Install chromaprint: brew install chromaprint")
    
    # Check OpenAI
    enricher = MetadataEnrichmentOpenAI()
    if not enricher.enabled:
        recommendations.append("Configure OpenAI API key in .env file")
    
    # Check librosa
    try:
        import librosa
    except ImportError:
        recommendations.append("Install librosa: pip install librosa")
    
    if recommendations:
        print("\nTo enable all features:")
        for rec in recommendations:
            print(f"  • {rec}")
    else:
        print("\n✅ All dependencies are installed and configured!")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    main()