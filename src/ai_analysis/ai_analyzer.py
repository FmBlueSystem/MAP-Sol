"""AI Analyzer module for orchestrating music analysis."""

from datetime import datetime
from ai_analysis.genre_classifier import GenreClassifier
from ai_analysis.mood_analyzer import MoodAnalyzer
from ai_analysis.structure_detector import StructureDetector
from ai_analysis.lyrics_analyzer import LyricsAnalyzer
from ai_analysis.similarity_engine import SimilarityEngine


class AIAnalyzer:
    """Main AI analysis orchestrator for track analysis."""
    
    def __init__(self):
        self.ai_version = "1.0"
        self.genre_classifier = GenreClassifier()
        self.mood_analyzer = MoodAnalyzer()
        self.structure_detector = StructureDetector()
        self.lyrics_analyzer = LyricsAnalyzer()
        self.similarity_engine = SimilarityEngine()

    def analyze_track(self, audio_file, existing_metadata):
        """Analyze a track using AI models with fallback to heuristics.
        
        Args:
            audio_file: Path to the audio file
            existing_metadata: Dictionary with existing metadata
            
        Returns:
            dict: Analysis results compatible with ai_analysis table
        """
        if existing_metadata is None:
            existing_metadata = {}
        
        # Initialize result dict with all expected fields
        result = {
            'genre': None,
            'subgenre': '',
            'mood': None,
            'era': None,
            'year_estimate': None,
            'tags': [],
            'structure': {},
            'quality_metrics': {},
            'similar_tracks': [],
            'ai_version': self.ai_version,
            'analysis_date': datetime.now().isoformat()
        }
        
        # Try genre classification
        try:
            genre_result = self.genre_classifier.predict(audio_file)
            result['genre'] = genre_result.get('genre')
            result['subgenre'] = genre_result.get('subgenre', '')
        except NotImplementedError:
            # Fallback to existing metadata
            result['genre'] = existing_metadata.get('genre', 'Unknown')
        
        # Try mood analysis
        try:
            mood_result = self.mood_analyzer.analyze(audio_file)
            result['mood'] = mood_result.get('mood')
        except NotImplementedError:
            # Fallback based on energy
            energy = existing_metadata.get('energy', 0.5)
            # If energy is 0-1, use as is; if 0-10, scale down
            if energy > 1:
                energy = energy / 10.0
            
            if energy < 0.4:
                result['mood'] = 'calm'
            elif energy <= 0.6:
                result['mood'] = 'warm'
            else:
                result['mood'] = 'driving'
        
        # Try structure detection
        try:
            structure_result = self.structure_detector.detect(audio_file)
            result['structure'] = structure_result
        except NotImplementedError:
            # Leave as empty dict
            pass
        
        # Try lyrics analysis
        try:
            lyrics_result = self.lyrics_analyzer.analyze(audio_file)
            result['tags'] = lyrics_result.get('tags', [])
        except NotImplementedError:
            # Leave as empty list
            pass
        
        # Try similarity engine
        try:
            similar = self.similarity_engine.similar_to(existing_metadata, top_k=5)
            result['similar_tracks'] = similar
        except NotImplementedError:
            # Leave as empty list
            pass
        
        # Extract year if available
        if 'year' in existing_metadata:
            result['year_estimate'] = existing_metadata['year']
        
        return result

