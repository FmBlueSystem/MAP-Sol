#!/usr/bin/env python3
"""
Metadata extractor for audio files
Extracts metadata and artwork from audio files
"""

import os
from pathlib import Path
from io import BytesIO
from PyQt6.QtGui import QPixmap, QImage
from PyQt6.QtCore import QByteArray, QBuffer, QIODevice
import base64


class MetadataExtractor:
    """Extract metadata and artwork from audio files"""
    
    @staticmethod
    def extract_metadata(file_path):
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
                
                # Extract year
                year = MetadataExtractor._get_tag(audio_file, ['TDRC', 'Date', '\xa9day'])
                if year:
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
                
                # Extract artwork
                artwork_data = MetadataExtractor._extract_artwork(audio_file, file_path)
                if artwork_data:
                    metadata['artwork_data'] = artwork_data
                    # Convert to QPixmap for display
                    metadata['artwork_pixmap'] = MetadataExtractor._bytes_to_pixmap(artwork_data)
        
        except ImportError:
            # Mutagen not installed, use filename parsing
            pass
        except Exception as e:
            print(f"Error extracting metadata: {e}")
        
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
        for tag in tag_names:
            if tag in audio_file:
                value = audio_file[tag]
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
                for key in audio_file.keys():
                    if key.startswith('APIC'):
                        return bytes(audio_file[key].data)
            
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