#!/usr/bin/env python3
"""
Metadata extractor for audio files
Extracts metadata and artwork from audio files
"""

import os
from pathlib import Path
from io import BytesIO
from PyQt6.QtGui import QPixmap, QImage
from PyQt6.QtCore import QByteArray, QBuffer, QIODevice, Qt
from utils.logger import setup_logger
logger = setup_logger(__name__)
import base64


class MetadataExtractor:
    """Extract metadata and artwork from audio files"""
    
    @staticmethod
    def extract_metadata(file_path, with_pixmap: bool = True):
        """
        Extract metadata from audio file
        Returns dict with metadata including artwork
        """
        metadata = {
            'file_path': file_path,
            'title': None,
            'artist': None,
            'album': None,
            'album_artist': None,
            'genre': None,
            'year': None,
            'release_date': None,
            'track_number': None,
            'duration': None,
            'bitrate': None,
            'sample_rate': None,
            'file_size': os.path.getsize(file_path),
            'artwork_data': None,
            'artwork_pixmap': None
        }
        
        # Try to import mutagen for metadata extraction
        try:
            from mutagen import File
            from mutagen.id3 import ID3, APIC
            from mutagen.mp4 import MP4
            from mutagen.flac import FLAC
            
            audio_file = File(file_path)
            
            if audio_file is not None:
                # Extract common metadata
                metadata['title'] = MetadataExtractor._get_tag(audio_file, ['TIT2', 'Title', '\xa9nam'])
                metadata['artist'] = MetadataExtractor._get_tag(audio_file, ['TPE1', 'Artist', '\xa9ART'])
                metadata['album'] = MetadataExtractor._get_tag(audio_file, ['TALB', 'Album', '\xa9alb'])
                metadata['album_artist'] = MetadataExtractor._get_tag(audio_file, ['TPE2', 'AlbumArtist', 'aART'])
                metadata['genre'] = MetadataExtractor._get_tag(audio_file, ['TCON', 'Genre', '\xa9gen'])
                
                # Extract date/year (preserve full date if present)
                year = MetadataExtractor._get_tag(audio_file, ['TDRC', 'Date', '\xa9day'])
                if year:
                    metadata['release_date'] = str(year)
                    try:
                        metadata['year'] = int(str(year)[:4])
                    except:
                        pass
                
                # Extract track number
                track = MetadataExtractor._get_tag(audio_file, ['TRCK', 'TrackNumber', 'trkn'])
                if track:
                    try:
                        if isinstance(track, tuple):
                            metadata['track_number'] = track[0]
                        else:
                            metadata['track_number'] = int(str(track).split('/')[0])
                    except:
                        pass
                
                # Extract audio properties
                if hasattr(audio_file.info, 'length'):
                    metadata['duration'] = audio_file.info.length
                if hasattr(audio_file.info, 'bitrate'):
                    metadata['bitrate'] = audio_file.info.bitrate
                if hasattr(audio_file.info, 'sample_rate'):
                    metadata['sample_rate'] = audio_file.info.sample_rate

                # Extract MixedInKey fields when available
                try:
                    if hasattr(audio_file, 'keys'):
                        keys_method = audio_file.keys
                        if callable(keys_method):
                            keys_iter = list(keys_method())
                        else:
                            keys_iter = []
                    else:
                        keys_iter = []
                except Exception:
                    keys_iter = []
                upper_map = {str(k).upper(): k for k in keys_iter}

                # BPM (precise)
                for k in ['BPM', 'TBPM']:
                    if k in upper_map:
                        val = audio_file[upper_map[k]]
                        val = val.text[0] if hasattr(val, 'text') else (val[0] if isinstance(val, list) else val)
                        try:
                            metadata['BPM'] = float(str(val))
                        except Exception:
                            pass
                        break

                # INITIALKEY / KEY
                for k in ['INITIALKEY', 'TKEY', 'KEY']:
                    if k in upper_map:
                        val = audio_file[upper_map[k]]
                        val = val.text[0] if hasattr(val, 'text') else (val[0] if isinstance(val, list) else val)
                        metadata['INITIALKEY'] = str(val)
                        break

                # ENERGYLEVEL (1-10) / ENERGY
                for k in ['ENERGYLEVEL', 'ENERGY']:
                    if k in upper_map:
                        val = audio_file[upper_map[k]]
                        val = val.text[0] if hasattr(val, 'text') else (val[0] if isinstance(val, list) else val)
                        try:
                            metadata['ENERGYLEVEL'] = int(str(val))
                        except Exception:
                            pass
                        break

                # ISRC (ID3 TSRC, Vorbis/FLAC ISRC, MP4 iTunes freeform)
                isrc = None
                # Direct common tags first
                for k in ['TSRC', 'ISRC']:
                    if k in upper_map:
                        val = audio_file[upper_map[k]]
                        val = val.text[0] if hasattr(val, 'text') else (val[0] if isinstance(val, list) else val)
                        isrc = str(val)
                        break
                if not isrc:
                    # Search any key containing 'ISRC' (MP4 freeform often uses ----:com.apple.iTunes:ISRC)
                    try:
                        for raw_k in keys_iter:
                            kstr = str(raw_k)
                            if 'isrc' in kstr.lower():
                                val = audio_file[raw_k]
                                if isinstance(val, list) and val and isinstance(val[0], (bytes, bytearray)):
                                    try:
                                        isrc = val[0].decode('utf-8', errors='ignore').strip()
                                    except Exception:
                                        isrc = None
                                else:
                                    # generic coercion
                                    v = getattr(val, 'text', None)
                                    if v and isinstance(v, list) and v:
                                        isrc = str(v[0])
                                    else:
                                        isrc = str(val)
                                if isrc:
                                    break
                    except Exception:
                        pass
                if isrc:
                    metadata['isrc'] = isrc.strip()

                # Extract artwork (embedded first)
                artwork_data = MetadataExtractor._extract_artwork(audio_file, file_path)
                if artwork_data:
                    metadata['artwork_data'] = artwork_data
                    # Convert to QPixmap for display (UI thread only)
                    if with_pixmap:
                        metadata['artwork_pixmap'] = MetadataExtractor._bytes_to_pixmap(artwork_data)
                else:
                    # Try to find external artwork in the same folder
                    ext_bytes = MetadataExtractor._find_external_artwork(file_path)
                    if ext_bytes:
                        logger.debug(f"Using external artwork next to file: {Path(file_path).parent}")
                        metadata['artwork_data'] = ext_bytes
                        if with_pixmap:
                            metadata['artwork_pixmap'] = MetadataExtractor._bytes_to_pixmap(ext_bytes)
                    else:
                        # Fallback to bundled artwork if available
                        fb = MetadataExtractor._fallback_artwork_bytes()
                        if fb:
                            logger.debug("Using bundled fallback artwork")
                            metadata['artwork_data'] = fb
                            if with_pixmap:
                                metadata['artwork_pixmap'] = MetadataExtractor._bytes_to_pixmap(fb)
        
        except ImportError:
            # Mutagen not installed, use filename parsing
            pass
        except Exception as e:
            logger.error(f"Error extracting metadata: {e}", exc_info=True)
        
        # Fallback to filename parsing if no metadata
        if not metadata['title'] or not metadata['artist']:
            filename = Path(file_path).stem
            if ' - ' in filename:
                parts = filename.split(' - ', 1)
                metadata['artist'] = metadata['artist'] or parts[0].strip()
                metadata['title'] = metadata['title'] or parts[1].strip()
            else:
                metadata['title'] = metadata['title'] or filename
                metadata['artist'] = metadata['artist'] or 'Unknown Artist'
        
        # Set defaults
        metadata['title'] = metadata['title'] or Path(file_path).stem
        metadata['artist'] = metadata['artist'] or 'Unknown Artist'
        metadata['album'] = metadata['album'] or 'Unknown Album'
        
        return metadata
    
    @staticmethod
    def _get_tag(audio_file, tag_names):
        """Get tag value from audio file trying multiple tag names"""
        try:
            if hasattr(audio_file, 'keys'):
                keys_method = audio_file.keys
                if callable(keys_method):
                    keys_iter = list(keys_method())
                else:
                    keys_iter = []
            else:
                keys_iter = []
        except Exception:
            keys_iter = []
        key_map_lower = {str(k).lower(): k for k in keys_iter}
        for tag in tag_names:
            try:
                # Exact match first
                if tag in audio_file:
                    value = audio_file[tag]
                else:
                    # Case-insensitive lookup
                    lk = key_map_lower.get(str(tag).lower())
                    value = audio_file[lk] if lk and lk in audio_file else None
            except (ValueError, TypeError):
                # Some tags may not be valid for certain file types
                value = None
            if value:
                # Handle different tag value types
                if hasattr(value, 'text'):
                    return str(value.text[0]) if value.text else None
                elif isinstance(value, list) and len(value) > 0:
                    return str(value[0])
                else:
                    return str(value)
        return None
    
    @staticmethod
    def _extract_artwork(audio_file, file_path):
        """Extract artwork from audio file"""
        try:
            from mutagen.id3 import ID3, APIC
            from mutagen.mp4 import MP4
            from mutagen.flac import FLAC
            
            # MP3 files
            if file_path.lower().endswith('.mp3'):
                if 'APIC:' in audio_file:
                    return bytes(audio_file['APIC:'].data)
                try:
                    if hasattr(audio_file, 'keys') and callable(audio_file.keys):
                        for key in audio_file.keys():
                            if key.startswith('APIC'):
                                return bytes(audio_file[key].data)
                except Exception:
                    pass
            
            # MP4/M4A files
            elif file_path.lower().endswith(('.m4a', '.mp4')):
                if 'covr' in audio_file:
                    covers = audio_file['covr']
                    if covers:
                        return bytes(covers[0])
            
            # FLAC files
            elif file_path.lower().endswith('.flac'):
                if audio_file.pictures:
                    return bytes(audio_file.pictures[0].data)
            
            # OGG Vorbis
            elif file_path.lower().endswith('.ogg'):
                if 'metadata_block_picture' in audio_file:
                    import base64
                    from mutagen.flac import Picture
                    data = base64.b64decode(audio_file['metadata_block_picture'][0])
                    picture = Picture(data)
                    return bytes(picture.data)
        
        except Exception as e:
            print(f"Error extracting artwork: {e}")
        
        return None

    @staticmethod
    def _find_external_artwork(file_path: str):
        """Look for common artwork files next to the audio file.
        Returns image bytes or None.
        """
        try:
            p = Path(file_path)
            if not p.exists():
                return None
            exts = ['.jpg', '.jpeg', '.png', '.webp']
            names = [
                'cover', 'folder', 'album', 'front', 'artwork', 'art',
                p.stem, f"{p.stem}.cover", f"{p.stem}-cover"
            ]
            # Case-insensitive match by name without extension
            for f in p.parent.iterdir():
                if not f.is_file():
                    continue
                if f.suffix.lower() not in exts:
                    continue
                base = f.stem.lower()
                if base in [n.lower() for n in names]:
                    with open(f, 'rb') as fh:
                        return fh.read()
            return None
        except Exception:
            return None

    @staticmethod
    def _fallback_artwork_bytes():
        """Try to load a bundled fallback artwork image from resources.
        Returns bytes or None if not found.
        """
        try:
            # Look in common resource locations relative to this file
            here = Path(__file__).resolve()
            res = here.parents[1] / 'resources'
            candidates = [
                res / 'fallback_artwork.png',
                res / 'images' / 'fallback_artwork.png',
                res / 'images' / 'default-album.png',
                res / 'images' / 'default_album.png',
                res / 'images' / 'default.png',
            ]
            for p in candidates:
                if p.exists():
                    return p.read_bytes()
            # As a last resort, pick any PNG in resources/images
            img_dir = res / 'images'
            if img_dir.exists():
                for p in img_dir.iterdir():
                    if p.suffix.lower() == '.png' and p.is_file():
                        return p.read_bytes()
        except Exception:
            pass
        return None

    @staticmethod
    def extract_embedded_artwork(file_path: str):
        """Extract embedded artwork bytes only (no external/fallback).
        Returns bytes or None if not present.
        """
        try:
            from mutagen import File as MFile
            af = MFile(file_path)
            if af is None:
                return None
            return MetadataExtractor._extract_artwork(af, file_path)
        except Exception:
            return None
    
    @staticmethod
    def _bytes_to_pixmap(image_data):
        """Convert image bytes to QPixmap"""
        try:
            image = QImage()
            image.loadFromData(image_data)
            if not image.isNull():
                return QPixmap.fromImage(image)
        except Exception as e:
            print(f"Error converting image to pixmap: {e}")
        return None

    @staticmethod
    def downscale_pixmap(pixmap: QPixmap, max_size: int = 600) -> QPixmap:
        """Downscale a QPixmap preserving aspect ratio to max dimension."""
        try:
            if pixmap is None or pixmap.isNull():
                return pixmap
            w, h = pixmap.width(), pixmap.height()
            if max(w, h) <= max_size:
                return pixmap
            if w >= h:
                new_w = max_size
                new_h = int(h * (max_size / w))
            else:
                new_h = max_size
                new_w = int(w * (max_size / h))
            return pixmap.scaled(new_w, new_h, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
        except Exception:
            return pixmap
    
    @staticmethod
    def generate_default_artwork(title, artist):
        """Generate a default artwork with gradient and text"""
        from PyQt6.QtGui import QPainter, QLinearGradient, QColor, QFont
        from PyQt6.QtCore import Qt, QRect
        import random
        
        # Create pixmap
        pixmap = QPixmap(300, 300)
        
        # Create painter
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Generate random gradient colors
        colors = [
            (QColor(139, 69, 255), QColor(254, 100, 165)),  # Purple to Pink
            (QColor(32, 156, 255), QColor(104, 224, 207)),  # Blue to Teal
            (QColor(255, 95, 109), QColor(255, 195, 113)),  # Red to Orange
            (QColor(162, 155, 254), QColor(135, 206, 235)), # Lavender to Sky
            (QColor(255, 154, 0), QColor(255, 206, 84)),    # Orange to Yellow
            (QColor(237, 117, 23), QColor(245, 47, 87)),    # Orange to Pink
        ]
        
        color1, color2 = random.choice(colors)
        
        # Create gradient
        gradient = QLinearGradient(0, 0, 300, 300)
        gradient.setColorAt(0, color1)
        gradient.setColorAt(1, color2)
        
        # Fill background
        painter.fillRect(pixmap.rect(), gradient)
        
        # Add semi-transparent overlay
        painter.fillRect(pixmap.rect(), QColor(0, 0, 0, 60))
        
        # Draw text
        painter.setPen(QColor(255, 255, 255))
        
        # Title
        font = QFont("Arial", 18, QFont.Weight.Bold)
        painter.setFont(font)
        title_rect = QRect(20, 180, 260, 60)
        painter.drawText(title_rect, Qt.AlignmentFlag.AlignCenter | Qt.TextFlag.TextWordWrap, title[:30])
        
        # Artist
        font = QFont("Arial", 14)
        painter.setFont(font)
        artist_rect = QRect(20, 240, 260, 40)
        painter.drawText(artist_rect, Qt.AlignmentFlag.AlignCenter, artist[:30])
        
        painter.end()
        
        return pixmap
