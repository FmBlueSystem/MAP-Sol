"""Complete metadata enrichment using OpenAI for deep musical analysis post-HAMMS."""

import os
import json
import sqlite3
from typing import Dict, Optional, Any, List, Tuple
from pathlib import Path
from datetime import datetime
import re
from utils.logger import setup_logger

logger = setup_logger(__name__)

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI not installed. Install with: pip install openai")


class MetadataEnrichmentOpenAI:
    """
    Complete metadata enrichment using OpenAI GPT-4 for comprehensive music analysis.
    This runs AFTER HAMMS analysis to add contextual and semantic information.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        """
        Initialize the enrichment system.
        
        Args:
            api_key: OpenAI API key. If not provided, looks for OPENAI_API_KEY env var
            model: Model to use (gpt-4, gpt-3.5-turbo, etc.)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        
        if OPENAI_AVAILABLE and self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
            self.enabled = True
            logger.info(f"OpenAI enrichment enabled with model: {model}")
        else:
            self.client = None
            self.enabled = False
            if not self.api_key:
                logger.warning("OpenAI API key not found. Set OPENAI_API_KEY environment variable.")
    
    def enrich_track(self, track_data: Dict[str, Any], hamms_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a single track with comprehensive metadata using OpenAI.
        
        Args:
            track_data: Basic track metadata (title, artist, album, etc.)
            hamms_data: HAMMS analysis results (BPM, key, energy, etc.)
            
        Returns:
            Enriched metadata dictionary
        """
        if not self.enabled:
            return self._fallback_enrichment(track_data, hamms_data)
        
        try:
            # Prepare comprehensive prompt
            prompt = self._build_enrichment_prompt(track_data, hamms_data)
            
            # Make API call
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system", 
                        "content": """You are an expert music analyst, DJ, and musicologist with deep knowledge of:
- All music genres and subgenres
- Musical theory and composition
- DJ mixing techniques and harmonic compatibility
- Music history and cultural context
- Commercial and underground music scenes
- Multiple languages and international music

Provide detailed, accurate analysis based on the given data."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Low temperature for consistency
                max_tokens=2000
            )
            
            # Parse response
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                enriched_data = json.loads(json_match.group())
            else:
                enriched_data = json.loads(result_text)
            
            # Add metadata about the enrichment
            enriched_data["enrichment_metadata"] = {
                "method": "openai",
                "model": self.model,
                "timestamp": datetime.now().isoformat(),
                "version": "2.0"
            }
            
            return enriched_data
            
        except Exception as e:
            logger.error(f"OpenAI enrichment failed: {e}")
            return self._fallback_enrichment(track_data, hamms_data)
    
    def _build_enrichment_prompt(self, track_data: Dict[str, Any], hamms_data: Dict[str, Any]) -> str:
        """Build comprehensive prompt for OpenAI analysis."""
        
        # Extract key information
        title = track_data.get("title", "Unknown")
        artist = track_data.get("artist", "Unknown")
        album = track_data.get("album", "")
        year = track_data.get("year", "")
        duration = track_data.get("duration", 0)
        
        # HAMMS data
        bpm = hamms_data.get("bpm", 0)
        key = hamms_data.get("key", "")
        energy = hamms_data.get("energy_level", 0)
        
        # Find lyrics if available
        lyrics_snippet = self._get_lyrics_snippet(track_data.get("file_path", ""))
        
        prompt = f"""Analyze this track and provide comprehensive metadata enrichment:

TRACK INFORMATION:
- Title: {title}
- Artist: {artist}
- Album: {album}
- Year: {year}
- Duration: {duration} seconds

HAMMS ANALYSIS (Already completed):
- BPM: {bpm}
- Key: {key}
- Energy Level: {energy}/10

LYRICS SNIPPET (if available):
{lyrics_snippet if lyrics_snippet else "No lyrics available"}

Based on this information, provide a comprehensive analysis in the following JSON format:

{{
    "genre": {{
        "primary": "Main genre",
        "secondary": "Secondary genre if applicable",
        "subgenre": "Specific subgenre",
        "micro_genre": "Very specific style/movement",
        "genre_confidence": 0.0-1.0
    }},
    "mood_analysis": {{
        "primary_mood": "Main emotional mood",
        "secondary_moods": ["list", "of", "secondary", "moods"],
        "energy_description": "Description of energy level",
        "emotional_valence": "positive/negative/neutral/mixed",
        "arousal_level": "high/medium/low",
        "danceability": "very danceable/danceable/moderate/not danceable"
    }},
    "context": {{
        "era": "Musical era (e.g., '2010s', 'late 90s')",
        "scene": "Music scene/movement",
        "cultural_origin": "Cultural/geographic origin",
        "influences": ["list", "of", "musical", "influences"],
        "similar_artists": ["list", "of", "similar", "artists"],
        "production_style": "Production characteristics"
    }},
    "use_cases": {{
        "best_time_to_play": "peak time/warm up/cool down/after hours",
        "venue_type": ["club", "festival", "radio", "lounge", "gym"],
        "mixing_energy_position": "opener/builder/peak/breakdown/closer",
        "compatible_genres": ["genres", "that", "mix", "well"],
        "avoid_mixing_with": ["incompatible", "genres"]
    }},
    "technical_analysis": {{
        "structure_type": "verse-chorus/build-drop/loop-based/other",
        "arrangement_style": "minimal/layered/complex",
        "production_era": "Sounds like it was produced in...",
        "mastering_characteristics": "loud/dynamic/compressed/vintage",
        "signature_elements": ["distinctive", "sounds", "or", "techniques"]
    }},
    "commercial_analysis": {{
        "target_audience": "Description of target listeners",
        "market_position": "mainstream/underground/crossover/niche",
        "chart_potential": "high/medium/low/none",
        "streaming_playlist_fit": ["playlist", "types", "it", "fits"],
        "radio_format": "Format if radio-friendly, null if not"
    }},
    "lyrics_analysis": {{
        "language": "Primary language code",
        "themes": ["main", "lyrical", "themes"],
        "explicit_content": true/false,
        "narrative_style": "storytelling/abstract/repetitive/instrumental",
        "message_tone": "celebratory/introspective/aggressive/romantic/neutral"
    }},
    "dj_mixing_notes": {{
        "mix_in_point": "Suggestion for where to start mixing in",
        "mix_out_point": "Suggestion for where to mix out",
        "key_compatible_keys": ["List of harmonic keys that work well"],
        "bpm_range_compatible": "{{"min": X, "max": Y}}",
        "energy_transition": "How to manage energy when mixing",
        "special_considerations": "Any special mixing notes"
    }},
    "tags": ["comprehensive", "list", "of", "descriptive", "tags"],
    "quality_score": {{
        "production": 0-10,
        "creativity": 0-10,
        "commercial_appeal": 0-10,
        "dj_utility": 0-10,
        "overall": 0-10
    }},
    "ai_confidence": 0.0-1.0,
    "analysis_notes": "Any additional observations or context"
}}

Provide ONLY the JSON response, no additional text. Be specific and accurate based on the actual track data."""
        
        return prompt
    
    def _get_lyrics_snippet(self, file_path: str, max_lines: int = 8) -> Optional[str]:
        """Get a snippet of lyrics from associated .lrc file if available."""
        if not file_path:
            return None
        
        audio_path = Path(file_path)
        lrc_path = audio_path.with_suffix('.lrc')
        
        if lrc_path.exists():
            try:
                with open(lrc_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    # Clean LRC timestamps and get first few lines
                    clean_lines = []
                    for line in lines[:max_lines * 2]:  # Read more to account for timestamps
                        cleaned = re.sub(r'\[\d+:\d+\.\d+\]', '', line).strip()
                        if cleaned and not cleaned.startswith('['):
                            clean_lines.append(cleaned)
                        if len(clean_lines) >= max_lines:
                            break
                    return '\n'.join(clean_lines)
            except Exception as e:
                logger.debug(f"Could not read lyrics: {e}")
        
        return None
    
    def _fallback_enrichment(self, track_data: Dict[str, Any], hamms_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback enrichment using heuristics when OpenAI is not available."""
        
        bpm = hamms_data.get("bpm", 120)
        energy = hamms_data.get("energy_level", 5) / 10.0
        key = hamms_data.get("key", "")
        
        # Simple genre inference
        if bpm < 90:
            genre = "Hip Hop" if energy < 0.5 else "Trap"
        elif bpm < 115:
            genre = "Reggaeton" if energy > 0.6 else "R&B"
        elif bpm < 130:
            genre = "House"
        elif bpm < 150:
            genre = "Techno" if energy > 0.7 else "Tech House"
        else:
            genre = "Drum & Bass"
        
        # Simple mood inference
        if energy < 0.4:
            mood = "chill"
        elif energy < 0.6:
            mood = "groovy"
        elif energy < 0.8:
            mood = "energetic"
        else:
            mood = "intense"
        
        return {
            "genre": {
                "primary": genre,
                "secondary": None,
                "subgenre": None,
                "genre_confidence": 0.5
            },
            "mood_analysis": {
                "primary_mood": mood,
                "energy_description": f"Energy level {int(energy * 10)}/10",
                "danceability": "danceable" if bpm >= 120 and bpm <= 130 else "moderate"
            },
            "use_cases": {
                "best_time_to_play": "warm up" if energy < 0.6 else "peak time",
                "venue_type": ["club"] if bpm >= 120 else ["lounge", "radio"]
            },
            "tags": [genre.lower(), mood, f"{int(bpm)}bpm"],
            "enrichment_metadata": {
                "method": "heuristic",
                "timestamp": datetime.now().isoformat(),
                "version": "1.0"
            }
        }
    
    def batch_enrich(self, db_path: str, limit: Optional[int] = None) -> int:
        """
        Enrich multiple tracks from database that don't have AI analysis yet.
        
        Args:
            db_path: Path to the music database
            limit: Maximum number of tracks to process
            
        Returns:
            Number of tracks enriched
        """
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            # Find tracks that need enrichment (have HAMMS but no AI analysis)
            query = """
                SELECT t.*, h.bpm, h.initial_key, h.energy_level
                FROM tracks t
                LEFT JOIN hamms_advanced h ON t.id = h.track_id
                LEFT JOIN ai_analysis a ON t.id = a.track_id
                WHERE h.track_id IS NOT NULL AND a.track_id IS NULL
            """
            if limit:
                query += f" LIMIT {limit}"
            
            tracks = cursor.execute(query).fetchall()
            enriched_count = 0
            
            for track in tracks:
                try:
                    # Prepare track data
                    track_data = dict(track)
                    hamms_data = {
                        "bpm": track["bpm"],
                        "key": track["initial_key"],
                        "energy_level": track["energy_level"]
                    }
                    
                    # Enrich with OpenAI
                    enriched = self.enrich_track(track_data, hamms_data)
                    
                    # Store in ai_analysis table
                    self._store_enrichment(conn, track["id"], enriched)
                    enriched_count += 1
                    
                    logger.info(f"Enriched track {track['id']}: {track['title']}")
                    
                except Exception as e:
                    logger.error(f"Failed to enrich track {track['id']}: {e}")
                    continue
            
            conn.commit()
            return enriched_count
            
        finally:
            conn.close()
    
    def _store_enrichment(self, conn: sqlite3.Connection, track_id: int, enriched_data: Dict[str, Any]):
        """Store enriched data in the ai_analysis table."""
        
        # Extract and format data for storage
        genre_data = enriched_data.get("genre", {})
        mood_data = enriched_data.get("mood_analysis", {})
        context_data = enriched_data.get("context", {})
        use_cases = enriched_data.get("use_cases", {})
        lyrics_data = enriched_data.get("lyrics_analysis", {})
        
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO ai_analysis (
                track_id, genre, subgenre, mood, 
                language, explicit, era, tags,
                context_tags, quality_metrics, ai_version,
                analysis_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            track_id,
            genre_data.get("primary"),
            genre_data.get("subgenre"),
            mood_data.get("primary_mood"),
            lyrics_data.get("language"),
            1 if lyrics_data.get("explicit_content") else 0,
            context_data.get("era"),
            json.dumps(enriched_data.get("tags", [])),
            json.dumps(use_cases),
            json.dumps(enriched_data.get("quality_score", {})),
            enriched_data.get("enrichment_metadata", {}).get("version", "2.0"),
            datetime.now().isoformat()
        ))