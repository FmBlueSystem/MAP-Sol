"""Lyrics analysis using OpenAI for deep contextual understanding."""

import os
import json
from typing import Dict, Optional, Any, List
from pathlib import Path
import re
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Try to import OpenAI
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI not installed. Install with: pip install openai")


class LyricsAnalyzerOpenAI:
    """Advanced lyrics analysis using OpenAI GPT for context and meaning."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the lyrics analyzer.
        
        Args:
            api_key: OpenAI API key. If not provided, looks for OPENAI_API_KEY env var
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        if OPENAI_AVAILABLE and self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
            self.enabled = True
        else:
            self.client = None
            self.enabled = False
            if not self.api_key:
                logger.info("OpenAI API key not found. Set OPENAI_API_KEY environment variable.")
    
    def analyze_from_file(self, audio_file: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze lyrics from an audio file by searching for .lrc or .txt files.
        
        Args:
            audio_file: Path to the audio file
            metadata: Existing metadata with title and artist
            
        Returns:
            Analysis results including language, themes, mood, etc.
        """
        # Try to find lyrics file
        lyrics_text = self._find_lyrics_file(audio_file)
        
        # If no file found, try to extract from title/artist context
        if not lyrics_text:
            return self._analyze_from_metadata(metadata)
        
        # Analyze the lyrics
        return self.analyze_text(lyrics_text, metadata)
    
    def analyze_text(self, lyrics: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze lyrics text using OpenAI.
        
        Args:
            lyrics: Lyrics text
            metadata: Track metadata for context
            
        Returns:
            Comprehensive analysis results
        """
        if not self.enabled or not lyrics:
            return self._fallback_analysis(lyrics, metadata)
        
        try:
            # Prepare context
            title = metadata.get("title", "Unknown")
            artist = metadata.get("artist", "Unknown")
            genre = metadata.get("genre", "")
            
            # Create prompt for OpenAI
            prompt = f"""Analyze the following song lyrics and provide a detailed JSON response.

Song: "{title}" by {artist}
Genre: {genre if genre else "Unknown"}

Lyrics:
{lyrics[:3000]}  # Limit to avoid token limits

Provide analysis in this exact JSON format:
{{
    "language": "detected language code (es, en, pt, fr, etc)",
    "language_name": "full language name",
    "themes": ["list", "of", "main", "themes"],
    "mood": "primary mood (happy, sad, energetic, melancholic, aggressive, romantic, etc)",
    "sentiment": "positive, negative, or neutral",
    "explicit_content": true/false,
    "explicit_themes": ["list of explicit themes if any"],
    "context": {{
        "setting": "club, street, home, etc",
        "time_period": "night, day, summer, etc",
        "narrative": "first person, third person, dialogue, etc"
    }},
    "emotions": ["list", "of", "emotions", "expressed"],
    "topics": ["love", "party", "social", "personal", etc],
    "energy_level": "high, medium, or low",
    "danceability_context": "very danceable, somewhat danceable, not danceable",
    "lyrical_complexity": "simple, moderate, or complex",
    "cultural_references": ["list of cultural references if any"],
    "target_audience": "youth, adults, general, etc",
    "commercial_viability": "mainstream, underground, niche",
    "summary": "2-3 sentence summary of the song's meaning"
}}

Return ONLY the JSON, no additional text."""

            # Make API call
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",  # Use gpt-4 for better results if available
                messages=[
                    {"role": "system", "content": "You are a music analyst expert in lyrics interpretation, cultural context, and emotional analysis."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent output
                max_tokens=800
            )
            
            # Parse response
            result_text = response.choices[0].message.content.strip()
            
            # Try to extract JSON from response
            try:
                # Find JSON in response (in case there's extra text)
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning("Failed to parse OpenAI response as JSON")
                return self._fallback_analysis(lyrics, metadata)
            
            # Add word count and other metrics
            result["word_count"] = len(lyrics.split())
            result["line_count"] = len(lyrics.splitlines())
            result["has_lyrics"] = True
            result["analysis_method"] = "openai"
            
            return result
            
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return self._fallback_analysis(lyrics, metadata)
    
    def _find_lyrics_file(self, audio_file: str) -> Optional[str]:
        """
        Find lyrics file associated with audio file.
        
        Looks for:
        - Same name with .lrc extension
        - Same name with .txt extension
        - lyrics.txt in same directory
        """
        audio_path = Path(audio_file)
        
        # Try different lyrics file patterns
        patterns = [
            audio_path.with_suffix('.lrc'),
            audio_path.with_suffix('.txt'),
            audio_path.parent / 'lyrics.txt',
            audio_path.parent / f"{audio_path.stem}.lyrics.txt"
        ]
        
        for pattern in patterns:
            if pattern.exists():
                try:
                    with open(pattern, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Clean LRC timestamps if present
                        content = re.sub(r'\[\d+:\d+\.\d+\]', '', content)
                        return content.strip()
                except Exception as e:
                    logger.debug(f"Failed to read lyrics file {pattern}: {e}")
        
        return None
    
    def _analyze_from_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze based on metadata when lyrics are not available.
        Uses title, artist, and genre to infer context.
        """
        if not self.enabled:
            return self._fallback_analysis("", metadata)
        
        try:
            title = metadata.get("title", "Unknown")
            artist = metadata.get("artist", "Unknown")
            genre = metadata.get("genre", "")
            
            prompt = f"""Based on the song title, artist, and genre, provide contextual analysis.

Song: "{title}"
Artist: {artist}
Genre: {genre if genre else "Unknown"}

Without the actual lyrics, provide educated analysis based on:
1. Common themes in this genre
2. Artist's typical style (if known)
3. Title implications

Provide analysis in this exact JSON format:
{{
    "language": "likely language code based on artist/title",
    "language_name": "full language name",
    "likely_themes": ["probable", "themes"],
    "likely_mood": "probable mood based on genre and title",
    "genre_characteristics": ["typical characteristics of this genre"],
    "target_audience": "likely audience",
    "commercial_viability": "mainstream, underground, or niche",
    "has_lyrics": false,
    "analysis_method": "metadata_inference"
}}

Return ONLY the JSON."""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a music expert who can infer song characteristics from metadata."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=400
            )
            
            result_text = response.choices[0].message.content.strip()
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
        except Exception as e:
            logger.debug(f"Metadata analysis failed: {e}")
        
        return self._fallback_analysis("", metadata)
    
    def _fallback_analysis(self, lyrics: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback analysis using simple heuristics when OpenAI is not available.
        """
        result = {
            "language": None,
            "language_name": None,
            "themes": [],
            "mood": None,
            "sentiment": "neutral",
            "explicit_content": False,
            "explicit_themes": [],
            "context": {},
            "emotions": [],
            "topics": [],
            "has_lyrics": bool(lyrics),
            "analysis_method": "heuristic"
        }
        
        if lyrics:
            lyrics_lower = lyrics.lower()
            
            # Simple language detection
            if any(word in lyrics_lower for word in ["love", "heart", "baby", "night", "time"]):
                result["language"] = "en"
                result["language_name"] = "English"
            elif any(word in lyrics_lower for word in ["amor", "corazón", "noche", "vida", "baby"]):
                result["language"] = "es"
                result["language_name"] = "Spanish"
            elif any(word in lyrics_lower for word in ["amour", "coeur", "nuit", "vie"]):
                result["language"] = "fr"
                result["language_name"] = "French"
            
            # Detect explicit content
            explicit_words = ["fuck", "shit", "bitch", "ass", "damn", "hell"]
            if any(word in lyrics_lower for word in explicit_words):
                result["explicit_content"] = True
                result["explicit_themes"] = ["profanity"]
            
            # Simple theme detection
            if "love" in lyrics_lower or "heart" in lyrics_lower:
                result["themes"].append("love")
            if "party" in lyrics_lower or "dance" in lyrics_lower:
                result["themes"].append("party")
            if "money" in lyrics_lower or "cash" in lyrics_lower:
                result["themes"].append("wealth")
            
            # Simple mood detection based on keywords
            if any(word in lyrics_lower for word in ["happy", "joy", "celebrate", "party"]):
                result["mood"] = "happy"
                result["sentiment"] = "positive"
            elif any(word in lyrics_lower for word in ["sad", "cry", "tears", "broken"]):
                result["mood"] = "sad"
                result["sentiment"] = "negative"
            elif any(word in lyrics_lower for word in ["angry", "hate", "fight"]):
                result["mood"] = "aggressive"
                result["sentiment"] = "negative"
        
        # Use title for additional context
        title = metadata.get("title", "").lower()
        if "love" in title:
            result["themes"].append("love")
        if "party" in title or "dance" in title:
            result["themes"].append("party")
        
        # Ensure themes list is unique
        result["themes"] = list(set(result["themes"]))
        
        return result
    
    def analyze_batch(self, tracks: List[Dict[str, Any]], max_parallel: int = 5) -> List[Dict[str, Any]]:
        """
        Analyze multiple tracks in batch for efficiency.
        
        Args:
            tracks: List of track dictionaries with file_path and metadata
            max_parallel: Maximum parallel API calls (be mindful of rate limits)
            
        Returns:
            List of analysis results
        """
        results = []
        
        for track in tracks:
            try:
                analysis = self.analyze_from_file(
                    track.get("file_path", ""),
                    track.get("metadata", {})
                )
                results.append({
                    "track_id": track.get("id"),
                    "analysis": analysis
                })
            except Exception as e:
                logger.error(f"Failed to analyze track {track.get('id')}: {e}")
                results.append({
                    "track_id": track.get("id"),
                    "analysis": self._fallback_analysis("", track.get("metadata", {}))
                })
        
        return results