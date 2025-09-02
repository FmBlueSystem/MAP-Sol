"""
Playlist exporter module for M3U format and Serato database.
"""

from pathlib import Path
from typing import List, Union, Dict
import platform
import csv
import json
import base64
import tempfile


class PlaylistExporter:
    """Export playlists to various formats."""
    
    def export_m3u(self, tracks: List[Union[str, Dict]], filepath: Union[str, Path]) -> None:
        """
        Export tracks to M3U playlist format.
        
        Args:
            tracks: List of track paths (strings) or dicts with 'filepath', 
                   'duration', 'artist', 'title' keys
            filepath: Destination path for the M3U file
        """
        filepath = Path(filepath)
        
        # Create parent directory if it doesn't exist
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            # Write M3U header
            f.write('#EXTM3U\n')
            
            for track in tracks:
                if isinstance(track, dict):
                    # Extract track information
                    track_path = track.get('filepath') or track.get('file_path', '')
                    duration = track.get('duration', -1)
                    artist = track.get('artist', '')
                    title = track.get('title', '')
                    
                    # Write EXTINF line if we have metadata
                    if duration and (artist or title):
                        # Duration should be in seconds (integer)
                        duration_int = int(duration) if duration != -1 else -1
                        
                        # Format display name
                        if artist and title:
                            display_name = f"{artist} - {title}"
                        elif title:
                            display_name = title
                        else:
                            display_name = artist
                        
                        f.write(f'#EXTINF:{duration_int},{display_name}\n')
                    
                    # Normalize and write the file path
                    if track_path:
                        normalized_path = Path(track_path).expanduser().resolve()
                        f.write(f'{normalized_path}\n')
                else:
                    # Simple string path
                    normalized_path = Path(track).expanduser().resolve()
                    f.write(f'{normalized_path}\n')
    
    def export_serato_database(self, tracks: List[Union[str, Dict]], 
                               serato_root: Union[str, Path], 
                               crate_name: str = "MusicAnalyzerPro") -> Dict:
        """
        Export tracks to Serato database format.
        
        Creates/updates:
        - database V2: Main database file with all track paths
        - Subcrates/<crate_name>.crate: Specific crate file for this playlist
        
        Args:
            tracks: List of tracks (strings, dicts with filepath/file_path)
            serato_root: Root directory for Serato (_Serato_ folder)
            crate_name: Name for the crate file
            
        Returns:
            Dict with database_path, crate_path, and written count
        """
        # Normalize serato root path
        serato_root = Path(serato_root).expanduser().resolve()
        
        # Ensure directory structure exists
        serato_root.mkdir(parents=True, exist_ok=True)
        subcrates_dir = serato_root / "Subcrates"
        subcrates_dir.mkdir(exist_ok=True)
        
        # Define file paths
        database_path = serato_root / "database V2"
        crate_path = subcrates_dir / f"{crate_name}.crate"
        
        # Extract and normalize track paths
        track_paths = []
        for track in tracks:
            if isinstance(track, dict):
                # Try different key names
                track_path = track.get('filepath') or track.get('file_path')
            elif isinstance(track, (list, tuple)) and len(track) > 0:
                # Handle row-like data where first element is path
                track_path = track[0]
            else:
                # Assume it's a string path
                track_path = track
            
            if track_path:
                # Normalize to absolute path
                normalized = Path(track_path).expanduser().resolve()
                track_paths.append(str(normalized))
        
        # Read existing database entries to avoid duplicates
        existing_entries = set()
        if database_path.exists():
            try:
                with open(database_path, 'r', encoding='utf-8', errors='ignore') as f:
                    existing_entries = set(line.strip() for line in f if line.strip())
            except Exception:
                # If read fails, start fresh
                pass
        
        # Add new entries to database (idempotent)
        new_entries = []
        for path in track_paths:
            if path not in existing_entries:
                new_entries.append(path)
                existing_entries.add(path)
        
        # Write/append to database V2
        if new_entries:
            with open(database_path, 'a', encoding='utf-8') as f:
                for entry in new_entries:
                    f.write(f"{entry}\n")
        
        # Write crate file (overwrite with current playlist)
        with open(crate_path, 'w', encoding='utf-8') as f:
            for path in track_paths:
                f.write(f"{path}\n")
        
        return {
            'database_path': str(database_path),
            'crate_path': str(crate_path),
            'written': len(track_paths)
        }
    
    def get_default_serato_root(self) -> Path:
        """
        Get the default Serato root directory based on OS.
        
        Returns:
            Path to default Serato directory
        """
        system = platform.system()
        
        if system == "Darwin":  # macOS
            return Path.home() / "Music" / "_Serato_"
        elif system == "Windows":
            return Path.home() / "Music" / "_Serato_"
        else:  # Linux and others
            return Path.home() / "Music" / "_Serato_"
    
    def export_csv(self, tracks: List[Union[str, Dict]], filepath: Union[str, Path]) -> dict:
        """
        Export tracks to CSV format.
        
        Args:
            tracks: List of track paths (strings) or dicts with track information
            filepath: Destination path for the CSV file
            
        Returns:
            Dict with status and path
        """
        filepath = Path(filepath).expanduser().resolve()
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # CSV headers
        headers = ['filepath', 'title', 'artist', 'bpm', 'camelot_key', 'energy_level', 'duration']
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            
            for track in tracks:
                row = {}
                if isinstance(track, dict):
                    # Get filepath (try different keys)
                    track_path = track.get('filepath') or track.get('file_path', '')
                    row['filepath'] = str(Path(track_path).expanduser().resolve()) if track_path else ''
                    row['title'] = track.get('title', '')
                    row['artist'] = track.get('artist', '')
                    row['bpm'] = track.get('bpm', '')
                    row['camelot_key'] = track.get('camelot_key', '')
                    row['energy_level'] = track.get('energy_level', '')
                    row['duration'] = track.get('duration', '')
                else:
                    # Simple string path
                    row['filepath'] = str(Path(track).expanduser().resolve())
                    row['title'] = ''
                    row['artist'] = ''
                    row['bpm'] = ''
                    row['camelot_key'] = ''
                    row['energy_level'] = ''
                    row['duration'] = ''
                
                writer.writerow(row)
        
        return {
            'status': 'success',
            'path': str(filepath),
            'track_count': len(tracks)
        }
    
    def export_json(self, tracks: List[Union[str, Dict]], filepath: Union[str, Path]) -> dict:
        """
        Export tracks to JSON format.
        
        Args:
            tracks: List of track paths (strings) or dicts with track information
            filepath: Destination path for the JSON file
            
        Returns:
            Dict with status and path
        """
        filepath = Path(filepath).expanduser().resolve()
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        output_tracks = []
        for track in tracks:
            if isinstance(track, dict):
                # Normalize filepath
                track_path = track.get('filepath') or track.get('file_path', '')
                track_data = {
                    'filepath': str(Path(track_path).expanduser().resolve()) if track_path else '',
                    'title': track.get('title', ''),
                    'artist': track.get('artist', ''),
                    'bpm': track.get('bpm', ''),
                    'camelot_key': track.get('camelot_key', ''),
                    'energy_level': track.get('energy_level', ''),
                    'duration': track.get('duration', '')
                }
            else:
                # Simple string path
                track_data = {
                    'filepath': str(Path(track).expanduser().resolve()),
                    'title': '',
                    'artist': '',
                    'bpm': '',
                    'camelot_key': '',
                    'energy_level': '',
                    'duration': ''
                }
            output_tracks.append(track_data)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output_tracks, f, indent=2, ensure_ascii=False)
        
        return {
            'status': 'success',
            'path': str(filepath),
            'track_count': len(tracks)
        }
    
    def build_share_link(self, tracks: List[Union[str, Dict]]) -> str:
        """
        Build a shareable link with base64url-encoded track data.
        
        Args:
            tracks: List of tracks with at least filepath, title, artist
            
        Returns:
            Share link string (musicanalyzer://... or file://... if too large)
        """
        # Build minimal track data for sharing
        share_data = []
        for track in tracks[:500]:  # Limit to 500 tracks max
            if isinstance(track, dict):
                track_path = track.get('filepath') or track.get('file_path', '')
                share_item = {
                    'filepath': str(Path(track_path).expanduser().resolve()) if track_path else '',
                    'title': track.get('title', ''),
                    'artist': track.get('artist', '')
                }
            else:
                share_item = {
                    'filepath': str(Path(track).expanduser().resolve()),
                    'title': '',
                    'artist': ''
                }
            share_data.append(share_item)
        
        # Convert to compact JSON
        json_str = json.dumps(share_data, separators=(',', ':'), ensure_ascii=False)
        json_bytes = json_str.encode('utf-8')
        
        # Check size (100KB limit)
        if len(json_bytes) > 102400:  # 100KB
            # Too large, save to temp file and return file:// link
            temp_file = tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.json',
                prefix='playlist_',
                delete=False,
                encoding='utf-8'
            )
            temp_file.write(json_str)
            temp_file.close()
            return f"file://{temp_file.name}"
        
        # Encode to base64url (no padding)
        b64_data = base64.urlsafe_b64encode(json_bytes).decode('ascii').rstrip('=')
        
        return f"musicanalyzer://playlist?data={b64_data}"