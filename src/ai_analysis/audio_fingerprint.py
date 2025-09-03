"""
Audio fingerprinting for duplicate detection and track identification.
Uses chromaprint/acoustid for robust audio fingerprinting.
"""

import hashlib
import subprocess
import json
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Try to import acoustid/chromaprint
try:
    import acoustid
    ACOUSTID_AVAILABLE = True
except ImportError:
    ACOUSTID_AVAILABLE = False
    logger.info("Acoustid not installed. Install with: pip install pyacoustid")


class AudioFingerprinter:
    """Generate and manage audio fingerprints for duplicate detection."""
    
    def __init__(self, acoustid_api_key: Optional[str] = None):
        """
        Initialize fingerprinter.
        
        Args:
            acoustid_api_key: Optional AcoustID API key for online lookup
        """
        self.api_key = acoustid_api_key
        self.fpcalc_path = self._find_fpcalc()
        
    def _find_fpcalc(self) -> Optional[str]:
        """Find fpcalc executable for chromaprint."""
        # Common locations for fpcalc
        locations = [
            'fpcalc',  # In PATH
            '/usr/local/bin/fpcalc',
            '/usr/bin/fpcalc',
            '/opt/homebrew/bin/fpcalc',  # Homebrew on Apple Silicon
            'C:\\Program Files\\Chromaprint\\fpcalc.exe',
            'C:\\Program Files (x86)\\Chromaprint\\fpcalc.exe'
        ]
        
        for loc in locations:
            try:
                result = subprocess.run([loc, '-v'], capture_output=True, text=True)
                if result.returncode == 0:
                    logger.info(f"Found fpcalc at: {loc}")
                    return loc
            except:
                continue
        
        logger.warning("fpcalc not found. Install chromaprint for fingerprinting.")
        return None
    
    def generate_fingerprint(self, audio_file: str) -> Dict[str, any]:
        """
        Generate audio fingerprint for a file.
        
        Args:
            audio_file: Path to audio file
            
        Returns:
            Dict with fingerprint data including:
            - chromaprint: Chromaprint fingerprint
            - duration: Track duration
            - md5: MD5 hash of audio data
            - acoustid: AcoustID if available
        """
        result = {
            'chromaprint': None,
            'duration': None,
            'md5': None,
            'acoustid': None,
            'confidence': 0.0
        }
        
        audio_path = Path(audio_file)
        if not audio_path.exists():
            logger.error(f"Audio file not found: {audio_file}")
            return result
        
        # Generate MD5 hash of file (quick duplicate check)
        try:
            with open(audio_path, 'rb') as f:
                # Read in chunks to handle large files
                md5_hash = hashlib.md5()
                for chunk in iter(lambda: f.read(8192), b''):
                    md5_hash.update(chunk)
                result['md5'] = md5_hash.hexdigest()
        except Exception as e:
            logger.error(f"Error generating MD5: {e}")
        
        # Generate Chromaprint fingerprint
        if self.fpcalc_path:
            try:
                # Run fpcalc to get fingerprint
                cmd = [self.fpcalc_path, '-json', str(audio_path)]
                process = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                if process.returncode == 0:
                    data = json.loads(process.stdout)
                    result['chromaprint'] = data.get('fingerprint')
                    result['duration'] = data.get('duration')
                    result['confidence'] = 1.0
                    logger.debug(f"Generated chromaprint for: {audio_path.name}")
                else:
                    logger.error(f"fpcalc error: {process.stderr}")
                    
            except subprocess.TimeoutExpired:
                logger.error("Fingerprint generation timed out")
            except Exception as e:
                logger.error(f"Error generating chromaprint: {e}")
        
        # Try acoustid for online lookup
        if ACOUSTID_AVAILABLE and result['chromaprint'] and self.api_key:
            try:
                # Lookup on AcoustID database
                matches = acoustid.lookup(
                    self.api_key,
                    result['chromaprint'],
                    result['duration']
                )
                
                for match in matches:
                    if match.get('recordings'):
                        result['acoustid'] = match['id']
                        # Could also extract MusicBrainz IDs here
                        break
                        
            except Exception as e:
                logger.debug(f"AcoustID lookup failed: {e}")
        
        return result
    
    def find_duplicates(self, fingerprints: List[Dict]) -> List[List[int]]:
        """
        Find duplicate tracks based on fingerprints.
        
        Args:
            fingerprints: List of fingerprint dicts with track_id
            
        Returns:
            List of duplicate groups (list of track IDs)
        """
        duplicates = []
        processed = set()
        
        for i, fp1 in enumerate(fingerprints):
            if i in processed:
                continue
                
            group = [fp1['track_id']]
            
            for j, fp2 in enumerate(fingerprints[i+1:], i+1):
                if j in processed:
                    continue
                    
                # Check for duplicate
                if self._are_duplicates(fp1, fp2):
                    group.append(fp2['track_id'])
                    processed.add(j)
            
            if len(group) > 1:
                duplicates.append(group)
                processed.add(i)
        
        return duplicates
    
    def _are_duplicates(self, fp1: Dict, fp2: Dict) -> bool:
        """
        Check if two fingerprints represent the same track.
        
        Args:
            fp1, fp2: Fingerprint dictionaries
            
        Returns:
            True if tracks are duplicates
        """
        # Quick check: MD5 hash
        if fp1.get('md5') and fp2.get('md5'):
            if fp1['md5'] == fp2['md5']:
                return True
        
        # Check chromaprint similarity
        if fp1.get('chromaprint') and fp2.get('chromaprint'):
            similarity = self._chromaprint_similarity(
                fp1['chromaprint'],
                fp2['chromaprint']
            )
            if similarity > 0.95:  # 95% similarity threshold
                return True
        
        # Check AcoustID
        if fp1.get('acoustid') and fp2.get('acoustid'):
            if fp1['acoustid'] == fp2['acoustid']:
                return True
        
        return False
    
    def _chromaprint_similarity(self, fp1: str, fp2: str) -> float:
        """
        Calculate similarity between two chromaprint fingerprints.
        
        Args:
            fp1, fp2: Chromaprint fingerprint strings
            
        Returns:
            Similarity score 0.0-1.0
        """
        try:
            # This is a simplified similarity check
            # In production, use proper chromaprint comparison
            if fp1 == fp2:
                return 1.0
            
            # Compare first N characters as rough approximation
            min_len = min(len(fp1), len(fp2))
            if min_len == 0:
                return 0.0
            
            matches = sum(1 for a, b in zip(fp1[:min_len], fp2[:min_len]) if a == b)
            return matches / min_len
            
        except Exception as e:
            logger.error(f"Error comparing fingerprints: {e}")
            return 0.0
    
    def identify_track(self, audio_file: str) -> Dict[str, any]:
        """
        Identify a track using various methods.
        
        Args:
            audio_file: Path to audio file
            
        Returns:
            Dict with identification results
        """
        result = {
            'fingerprint': None,
            'isrc': None,
            'musicbrainz_id': None,
            'spotify_id': None,
            'title': None,
            'artist': None,
            'confidence': 0.0
        }
        
        # Generate fingerprint
        fp_data = self.generate_fingerprint(audio_file)
        result['fingerprint'] = fp_data.get('chromaprint')
        
        # Try to extract ISRC from metadata
        try:
            from mutagen import File
            audio = File(audio_file)
            if audio:
                # Try various ISRC tag formats
                for tag in ['TSRC', 'ISRC', '----:com.apple.iTunes:ISRC']:
                    if tag in audio:
                        isrc = str(audio[tag][0] if isinstance(audio[tag], list) else audio[tag])
                        if isrc:
                            result['isrc'] = isrc.strip()
                            result['confidence'] = 0.8
                            break
        except Exception as e:
            logger.debug(f"Could not extract ISRC: {e}")
        
        # If we have AcoustID results, extract MusicBrainz data
        if fp_data.get('acoustid') and ACOUSTID_AVAILABLE and self.api_key:
            try:
                # Full lookup with metadata
                results = acoustid.match(
                    self.api_key,
                    audio_file,
                    parse=True
                )
                
                for score, recording_id, title, artist in results:
                    if score > 0.8:  # High confidence match
                        result['musicbrainz_id'] = recording_id
                        result['title'] = title
                        result['artist'] = artist
                        result['confidence'] = score
                        break
                        
            except Exception as e:
                logger.debug(f"MusicBrainz lookup failed: {e}")
        
        return result